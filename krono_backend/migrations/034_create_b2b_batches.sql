-- Migration 034: Tables tournées B2B — delivery_batches, batch_orders

-- ─── delivery_batches ─────────────────────────────────────────────────────────
-- Une tournée = un groupe de commandes envoyé à un livreur en une session
-- partner_id  : Profil 3 (portail partenaire)
-- user_id     : Profil 1/2 (app_chrono, contexte business)
-- driver_id   : snapshot du livreur exécutant la tournée (la relation persistante
--               commerçant ↔ livreur est dans partner_drivers, pas ici)
CREATE TABLE IF NOT EXISTS public.delivery_batches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES public.users(id)    ON DELETE SET NULL,
  driver_id   UUID REFERENCES public.users(id)    ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_batches_partner_id ON public.delivery_batches(partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_user_id    ON public.delivery_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_driver_id  ON public.delivery_batches(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_status     ON public.delivery_batches(status);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_created_at ON public.delivery_batches(created_at DESC);

CREATE OR REPLACE FUNCTION update_delivery_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_delivery_batches_updated_at
  BEFORE UPDATE ON public.delivery_batches
  FOR EACH ROW EXECUTE FUNCTION update_delivery_batches_updated_at();

ALTER TABLE public.delivery_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on delivery_batches"
  ON public.delivery_batches FOR ALL USING (true) WITH CHECK (true);


-- ─── batch_orders ─────────────────────────────────────────────────────────────
-- Lien entre une tournée et ses commandes, avec l'ordre de livraison optimisé
CREATE TABLE IF NOT EXISTS public.batch_orders (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id  UUID NOT NULL REFERENCES public.delivery_batches(id) ON DELETE CASCADE,
  order_id  UUID NOT NULL REFERENCES public.orders(id)           ON DELETE CASCADE,
  position  INTEGER NOT NULL,    -- ordre de livraison optimisé (1-based)
  UNIQUE(batch_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_orders_batch_id  ON public.batch_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_orders_order_id  ON public.batch_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_batch_orders_position  ON public.batch_orders(batch_id, position);

ALTER TABLE public.batch_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on batch_orders"
  ON public.batch_orders FOR ALL USING (true) WITH CHECK (true);
