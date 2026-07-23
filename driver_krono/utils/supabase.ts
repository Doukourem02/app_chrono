import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import { logger } from './logger'

const extra = Constants.expoConfig?.extra

const SUPABASE_URL =
  (extra?.supabaseUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  ''

const SUPABASE_ANON_KEY =
  (extra?.supabaseAnonKey as string | undefined) ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  ''

if (__DEV__ && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  logger.warn(
    'Supabase non configuré — définis EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (.env ou secrets EAS), puis relance Metro.',
    'supabase'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default supabase
