-- Abonnements Web Push pour la page de suivi public (/track/:token)
CREATE TABLE IF NOT EXISTS track_web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_token TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tracking_token, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_track_web_push_subscriptions_token
  ON track_web_push_subscriptions (tracking_token);
