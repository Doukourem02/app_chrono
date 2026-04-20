-- 028 — Journal anti-spam des campagnes de notifications périodiques.
-- Les campagnes sont décidées côté backend et consultent cette table avant envoi.

CREATE TABLE IF NOT EXISTS public.notification_campaign_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_role TEXT NOT NULL CHECK (app_role IN ('client', 'driver')),
  campaign_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_notification_campaign_user_campaign_sent
  ON public.notification_campaign_deliveries(user_id, campaign_key, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_campaign_sent_at
  ON public.notification_campaign_deliveries(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_campaign_role_campaign_sent
  ON public.notification_campaign_deliveries(app_role, campaign_key, sent_at DESC);

COMMENT ON TABLE public.notification_campaign_deliveries IS
  'Journal backend des notifications périodiques/réengagement, utilisé pour limiter la fréquence et éviter le spam.';

ALTER TABLE public.notification_campaign_deliveries DISABLE ROW LEVEL SECURITY;
