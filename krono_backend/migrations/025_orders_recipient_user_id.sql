-- Lie la commande au compte client du destinataire (nécessaire pour les push in-app).
-- À exécuter sur la même base que DATABASE_URL (Supabase SQL editor ou psql).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS recipient_is_registered BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_recipient_user_id
  ON public.orders (recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;
