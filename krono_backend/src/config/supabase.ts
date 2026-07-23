import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL');
}

if (!serviceRoleKey && !anonKey) {
  throw new Error(
    'Missing Supabase environment variables: provide SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY'
  );
}

if (!serviceRoleKey) {
  logger.warn(
    'SUPABASE_SERVICE_ROLE_KEY not set. Falling back to SUPABASE_ANON_KEY; some operations may fail due to RLS policies.'
  );
}

// Client principal (utilise service role key si disponible, sinon anon key)
const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey || anonKey!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Client admin séparé pour les opérations qui nécessitent la service role key (bypass RLS)
// Utilisé uniquement pour les insertions dans les tables qui ont RLS activé
export const supabaseAdmin: SupabaseClient | null = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export { supabase };
export default supabase;
