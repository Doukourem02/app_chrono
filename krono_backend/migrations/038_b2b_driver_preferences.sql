-- Migration 038: préférences B2B livreur + choix de livreur attitré par commande

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS accepts_b2b_orders BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.driver_profiles.accepts_b2b_orders
  IS 'Le livreur accepte de recevoir des commandes B2B / partenaires.';

CREATE INDEX IF NOT EXISTS idx_driver_profiles_accepts_b2b_orders
  ON public.driver_profiles (accepts_b2b_orders)
  WHERE accepts_b2b_orders = true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS preferred_driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.preferred_driver_id
  IS 'Livreur attitré demandé par le partenaire. Non bloquant: fallback automatique si indisponible/refus.';

CREATE INDEX IF NOT EXISTS idx_orders_preferred_driver_id
  ON public.orders (preferred_driver_id)
  WHERE preferred_driver_id IS NOT NULL;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS use_preferred_drivers BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.partners.use_preferred_drivers
  IS 'Active l’UI de choix des livreurs attitrés dans le portail partenaire.';
