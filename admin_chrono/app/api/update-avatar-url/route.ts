import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { logger } from '@/utils/logger'

const UpdateAvatarSchema = z.object({
  avatarUrl: z.string().url().max(2048),
})

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Créer un client Supabase avec service role key pour bypass RLS
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }

    // Vérifier l'authentification de l'utilisateur
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Extraire le token
    const token = authHeader.replace('Bearer ', '')
    
    // Vérifier le token avec Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Récupérer et valider les données
    const parseResult = UpdateAvatarSchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues.map(i => ({ path: i.path, message: i.message })) },
        { status: 400 }
      )
    }
    const { avatarUrl } = parseResult.data

    // Vérifier si l'utilisateur existe dans la table users
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', user.id)
      .single()

    if (process.env.NODE_ENV === 'development') {
      logger.debug(' User check result:', { hasUser: !!existingUser, error: checkError?.code })
    }

    if (checkError && checkError.code === 'PGRST116') {
      // L'utilisateur n'existe pas dans users — refuser plutôt qu'auto-créer avec role:'admin'.
      // Seul le flux d'inscription normal doit créer l'entrée dans users.
      return NextResponse.json(
        { error: 'User profile not found. Please complete registration first.' },
        { status: 403 }
      )
    } else if (checkError) {
      if (process.env.NODE_ENV === 'development') {
        logger.error('Error checking user profile:', checkError)
      }
      return NextResponse.json(
        { 
          error: process.env.NODE_ENV === 'production'
            ? 'Error checking user profile'
            : (checkError.message || 'Error checking user profile')
        },
        { status: 500 }
      )
    } else {
      // L'utilisateur existe, mettre à jour
      if (process.env.NODE_ENV === 'development') {
        logger.debug('User exists, updating avatar_url...')
      }
      // Essayer de mettre à jour avatar_url, mais gérer le cas où la colonne n'existe pas
      try {
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('users')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id)
          .select()

        if (process.env.NODE_ENV === 'development') {
          logger.debug(' Update result:', { hasData: !!updateData, error: updateError?.code })
        }

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            logger.error(' Update error details:', {
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint,
            })
          }

          // Si l'erreur est due à la colonne manquante
          if (
            updateError.message.includes('avatar_url') || 
            updateError.message.includes('column') ||
            updateError.message.includes('schema cache') ||
            updateError.code === '42703'
          ) {
            return NextResponse.json(
              { 
                error: 'La colonne avatar_url n\'existe pas dans la table users',
                hint: 'Exécutez ce script SQL dans Supabase SQL Editor:\n\nALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;'
              },
              { status: 500 }
            )
          }
          
          return NextResponse.json(
            { 
              error: updateError.message || 'Error updating profile',
              code: updateError.code,
              details: updateError.details,
            },
            { status: 500 }
          )
        }

        if (process.env.NODE_ENV === 'development') {
          logger.debug(' Avatar URL updated successfully')
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          logger.error(' Error in update catch:', err)
        }
        const errorMessage = err instanceof Error ? err.message : 'Error updating profile'
        return NextResponse.json(
          { 
            error: errorMessage,
            hint: 'La colonne avatar_url n\'existe peut-être pas. Exécutez le script SQL dans migrations/add_avatar_url_to_users.sql'
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Avatar URL updated successfully',
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('Error in update-avatar-url API:', error)
    }
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Internal server error')
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

