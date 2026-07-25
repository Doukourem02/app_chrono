-- 020 — Historique GPS livreur + flux de notifications admin persisté
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- le fichier original n'a jamais été committé, seules les tables vivent en base.

CREATE TABLE IF NOT EXISTS public.driver_locations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id UUID NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC NULL,
  speed NUMERIC NULL,
  heading NUMERIC NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'app'
);

CREATE INDEX IF NOT EXISTS driver_locations_driver_idx ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS driver_locations_recorded_idx ON public.driver_locations(recorded_at);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_recorded ON public.driver_locations(driver_id, recorded_at DESC);

COMMENT ON TABLE public.driver_locations IS 'Historique GPS livreur (insertion throttlée depuis updateDriverStatus)';

CREATE TABLE IF NOT EXISTS public.admin_notification_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'admin_feed',
  title TEXT NOT NULL,
  body TEXT NULL,
  payload JSONB NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_feed_created ON public.admin_notification_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notification_feed_category ON public.admin_notification_feed(category, created_at DESC);

COMMENT ON TABLE public.admin_notification_feed IS 'Événements commandes pour admin (persisté) — complément du Socket';

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_feed ENABLE ROW LEVEL SECURITY;
