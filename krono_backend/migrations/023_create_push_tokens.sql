-- 023 — Table push_tokens (Expo Push, client + livreur)
-- À exécuter sur la MÊME base que DATABASE_URL du backend (ex. Supabase → SQL Editor, ou psql).
-- Voir docs/notifications-expo-token.md

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  app_role TEXT NOT NULL CHECK (app_role IN ('client', 'driver')),
  device_id TEXT NULL,
  invalidated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_tokens_expo_push_token_key UNIQUE (expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active_by_user
  ON public.push_tokens(user_id)
  WHERE invalidated_at IS NULL;

COMMENT ON TABLE public.push_tokens IS 'Tokens Expo Push — écrits uniquement par chrono_backend (POST /api/push/register).';

-- Pas de RLS : le pool Node doit voir RETURNING après INSERT. Si RLS avait été activé ailleurs sans politique, exécuter aussi :
ALTER TABLE public.push_tokens DISABLE ROW LEVEL SECURITY;
