import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'
import { logger } from '@/utils/logger'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

const GENERIC_MESSAGE = "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé."

/**
 * Demande de réinitialisation de mot de passe (staff admin uniquement).
 * Réponse volontairement identique que l'email existe ou non, pour ne pas
 * permettre de deviner quels emails ont un compte admin (même logique que
 * /api/auth/login qui ne révèle jamais si l'email existe).
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const identifier = getRateLimitIdentifier(request)
    const limitResult = await rateLimit(`forgot-password:${identifier}`, 3, 15 * 60)

    if (!limitResult.success) {
      return NextResponse.json(
        {
          error: 'Trop de demandes. Réessayez plus tard.',
          reset: limitResult.reset,
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((limitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
    }

    const origin = request.headers.get('origin') || `https://${request.headers.get('host')}`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })

    if (error) {
      logger.error('Erreur resetPasswordForEmail:', error)
    }

    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('Error in forgot-password API:', error)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
