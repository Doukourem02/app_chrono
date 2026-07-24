import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'
import { logger } from '@/utils/logger'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Client anon : sert uniquement à vérifier la validité du token de l'appelant.
const supabaseAuthCheck = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// Client service_role : seul habilité à envoyer une invitation Supabase Auth
// (auth.admin.inviteUserByEmail) et à lire/écrire la table users sans RLS.
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

const VALID_ROLES = ['admin', 'super_admin'] as const
type InviteRole = (typeof VALID_ROLES)[number]

function isValidRole(role: unknown): role is InviteRole {
  return typeof role === 'string' && (VALID_ROLES as readonly string[]).includes(role)
}

/**
 * Invitation d'un membre du staff (admin ou super_admin) au dashboard Krono.
 * Réservé aux comptes super_admin — vérifié ici côté serveur, pas seulement
 * masqué côté écran (voir docs/roles_admin_super_admin.md).
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAuthCheck || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Rate limit : 10 invitations / heure par IP — généreux mais pas illimité.
    const identifier = getRateLimitIdentifier(request)
    const limitResult = await rateLimit(`invite-staff:${identifier}`, 10, 60 * 60)
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((limitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Authentifier l'appelant.
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user: callerUser }, error: callerAuthError } = await supabaseAuthCheck.auth.getUser(token)
    if (callerAuthError || !callerUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Vérifier le rôle réel en base (service_role, pas de RLS à contourner).
    const { data: callerRow, error: callerRoleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (callerRoleError || !callerRow || callerRow.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès réservé au super administrateur' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, role } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'Rôle invalide — admin ou super_admin uniquement' }, { status: 400 })
    }

    // Garde-fou "dernier super_admin" : pas nécessaire ICI, une invitation ne
    // fait qu'ajouter un compte, elle ne peut jamais faire tomber le nombre de
    // super_admin à 0. Ce garde-fou (compter les super_admin actifs, refuser
    // si l'action ferait tomber le total à 0) devra être ajouté le jour où une
    // action de type "changer le rôle d'un utilisateur existant" ou "supprimer
    // un compte staff" sera construite (n'existe pas encore dans admin_krono
    // au 2026-07-24, vérifié — aucune UI pour ça sur /users/[userId]).

    // Refuser si un compte existe déjà avec cet email (évite un doublon auth.users/users désynchronisé).
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 })
    }

    const origin = request.headers.get('origin') || `https://${request.headers.get('host')}`

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
      data: { role },
    })

    if (inviteError || !inviteData?.user) {
      logger.error('Erreur invitation staff:', inviteError)
      return NextResponse.json({ error: "Impossible d'envoyer l'invitation" }, { status: 500 })
    }

    const invitedUser = inviteData.user

    // Pas de trigger auth.users -> public.users dans ce projet (vérifié) : on
    // crée la ligne nous-mêmes, même pattern que syncAuthUserToPostgresFromVerify
    // dans krono_backend/src/controllers/authController.ts.
    const { error: insertError } = await supabaseAdmin.from('users').insert([
      {
        id: invitedUser.id,
        email: invitedUser.email,
        role,
        created_at: invitedUser.created_at || new Date().toISOString(),
      },
    ])

    if (insertError) {
      logger.error('Erreur insertion users après invitation staff:', insertError)
      return NextResponse.json(
        { error: "Invitation envoyée mais profil non créé — contacter le support technique" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Invitation envoyée' }, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('Error in invite API:', error)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
