-- 017b — Token de suivi public pour une commande (lien /track/{token})
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- le fichier original n'a jamais été committé, seule la colonne/l'index vivent en base.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_token TEXT NULL;

-- Deux index uniques observés en prod sur la même colonne (probable doublon historique
-- créé par deux migrations manuelles distinctes) : conservés à l'identique pour ne pas
-- diverger du schéma réel.
CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_key ON public.orders(tracking_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_token ON public.orders(tracking_token) WHERE tracking_token IS NOT NULL;
