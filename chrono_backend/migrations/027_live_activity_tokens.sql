-- 027 — Tokens APNs Live Activity (Dynamic Island / écran verrouillé iOS)
-- À exécuter sur la MÊME base que DATABASE_URL du backend.

CREATE TABLE IF NOT EXISTS public.live_activity_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id TEXT NULL,
  live_activity_name TEXT NOT NULL DEFAULT 'OrderTrackingLive',
  apns_push_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios' CHECK (platform = 'ios'),
  last_props JSONB NULL,
  last_apns_status TEXT NULL,
  last_apns_error TEXT NULL,
  last_payload_at TIMESTAMPTZ NULL,
  invalidated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_activity_tokens_apns_push_token_key UNIQUE (apns_push_token)
);

CREATE INDEX IF NOT EXISTS idx_live_activity_tokens_active_order
  ON public.live_activity_tokens(order_id, user_id)
  WHERE invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_activity_tokens_user
  ON public.live_activity_tokens(user_id);

COMMENT ON TABLE public.live_activity_tokens IS 'Tokens APNs ActivityKit pour mettre à jour la Live Activity iOS même quand l’app client n’est pas ouverte.';

ALTER TABLE public.live_activity_tokens DISABLE ROW LEVEL SECURITY;
