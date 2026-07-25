-- 047 — Rédemption réelle des codes promo
-- Corrige docs/futur_feature_admin_krono.md : un code promo créé par un admin
-- (createAdminPromoCode) n'avait jusqu'ici aucun effet sur le prix d'une commande.
--
-- Décision produit (2026-07-25) : la commission du livreur reste calculée sur le
-- prix PLEIN, avant réduction — Krono absorbe seul le coût de la promo. D'où la
-- distinction entre price_cfa (montant réellement facturé au client, inchangé
-- dans sa signification pour tout le reste du code : analytics, dashboards,
-- factures) et full_price_cfa (prix de référence avant réduction, utilisé
-- uniquement pour le calcul de la commission livreur).

-- Table promo_codes : promue en migration trackée (existait jusqu'ici seulement
-- via un CREATE TABLE IF NOT EXISTS à la volée dans adminModerationController.ts).
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL,
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID NULL REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount_cfa INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS full_price_cfa INTEGER NULL;

COMMENT ON COLUMN public.orders.discount_amount_cfa IS
  'Montant déduit du prix plein suite à l''application d''un code promo (0 si aucun code appliqué).';
COMMENT ON COLUMN public.orders.full_price_cfa IS
  'Prix de référence avant réduction promo, utilisé pour calculer la commission du livreur. NULL = aucune promo appliquée, price_cfa fait foi.';

-- fn_create_order : ajoute 3 paramètres optionnels (rétrocompatible — les appels
-- existants qui ne les passent pas obtiennent les valeurs par défaut, donc
-- aucun changement de comportement pour une commande sans code promo).
CREATE OR REPLACE FUNCTION public.fn_create_order(
  p_user_id UUID,
  p_pickup JSONB,
  p_dropoff JSONB,
  p_method TEXT,
  p_price INTEGER,
  p_distance NUMERIC,
  p_promo_code_id UUID DEFAULT NULL,
  p_discount_amount_cfa INTEGER DEFAULT 0,
  p_full_price_cfa INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_eta_minutes INTEGER;
  v_distance_numeric NUMERIC;
  v_profile_exists BOOLEAN;
BEGIN
  v_profile_exists := EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id);

  IF NOT v_profile_exists THEN
    IF EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
      INSERT INTO profiles (id, updated_at)
      VALUES (p_user_id, NOW())
      ON CONFLICT (id) DO NOTHING;
    ELSE
      RAISE EXCEPTION 'User with id % does not exist in profiles or auth.users', p_user_id;
    END IF;
  END IF;

  v_order_id := gen_random_uuid();
  v_distance_numeric := COALESCE(p_distance::NUMERIC, 0);

  CASE p_method
    WHEN 'moto' THEN
      v_eta_minutes := GREATEST(5, CEIL(v_distance_numeric / 25.0 * 60));
    WHEN 'vehicule' THEN
      v_eta_minutes := GREATEST(5, CEIL(v_distance_numeric / 20.0 * 60));
    WHEN 'cargo' THEN
      v_eta_minutes := GREATEST(5, CEIL(v_distance_numeric / 18.0 * 60));
    ELSE
      v_eta_minutes := GREATEST(5, CEIL(v_distance_numeric / 20.0 * 60));
  END CASE;

  INSERT INTO orders (
    id,
    user_id,
    pickup_address,
    dropoff_address,
    delivery_method,
    price_cfa,
    distance_km,
    eta_minutes,
    status,
    promo_code_id,
    discount_amount_cfa,
    full_price_cfa,
    created_at,
    updated_at
  ) VALUES (
    v_order_id,
    p_user_id,
    p_pickup,
    p_dropoff,
    p_method,
    p_price,
    v_distance_numeric,
    v_eta_minutes,
    'pending',
    p_promo_code_id,
    COALESCE(p_discount_amount_cfa, 0),
    p_full_price_cfa,
    NOW(),
    NOW()
  );

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_create_order(UUID, JSONB, JSONB, TEXT, INTEGER, NUMERIC, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_order(UUID, JSONB, JSONB, TEXT, INTEGER, NUMERIC, UUID, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_create_order(UUID, JSONB, JSONB, TEXT, INTEGER, NUMERIC, UUID, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.fn_create_order IS 'Crée une nouvelle commande de livraison (avec application optionnelle d''un code promo) et retourne son ID';
