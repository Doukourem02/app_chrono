-- Migration 035: Ajout colonnes B2B sur orders
-- partner_id   : rattache une commande à un partenaire (NULL = B2C classique)
-- is_b2b_order : formalise en vraie colonne le flag actuellement stocké dans pickup._chrono_admin

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS partner_id   UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_b2b_order BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_partner_id   ON public.orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_b2b_order ON public.orders(is_b2b_order) WHERE is_b2b_order = true;

-- Rétro-compatibilité : on lit is_b2b_order depuis le JSONB _chrono_admin pour les commandes existantes
-- (les nouvelles commandes l'auront directement en colonne)
-- Colonnes réelles en prod : pickup_address / dropoff_address (pas pickup/dropoff)
UPDATE public.orders
SET is_b2b_order = true
WHERE
  is_b2b_order = false
  AND (
    (pickup_address->'_chrono_admin'->>'is_b2b_order')::boolean = true
    OR
    (dropoff_address->'_chrono_admin'->>'is_b2b_order')::boolean = true
  );

-- Note : partner_id reste NULL pour les commandes existantes.
-- La mise à jour vers les vrais partner_id se fait via le script de migration
-- décrit en §10 du blueprint (UPDATE orders SET partner_id = ? WHERE ...).
