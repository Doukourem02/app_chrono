-- Créer la fonction fn_create_order pour créer une commande via Supabase RPC
-- Supprimer l'ancienne version si elle existe
DROP FUNCTION IF EXISTS public.fn_create_order(UUID, JSONB, JSONB, TEXT, INTEGER, NUMERIC);

CREATE OR REPLACE FUNCTION public.fn_create_order(
  p_user_id UUID,
  p_pickup JSONB,
  p_dropoff JSONB,
  p_method TEXT,
  p_price INTEGER,
  p_distance NUMERIC
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
  -- Vérifier que l'utilisateur existe dans la table profiles (contrainte FK)
  -- La table orders référence profiles selon l'erreur Supabase
  -- Dans Supabase, profiles.id référence généralement auth.users.id
  v_profile_exists := EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id);
  
  -- Si le profil n'existe pas, vérifier dans auth.users et créer un profil minimal
  IF NOT v_profile_exists THEN
    -- Vérifier si l'utilisateur existe dans auth.users
    IF EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
      -- Créer un enregistrement minimal dans profiles
      -- Structure Supabase standard : profiles.id = auth.users.id
      INSERT INTO profiles (id, updated_at)
      VALUES (p_user_id, NOW())
      ON CONFLICT (id) DO NOTHING;
    ELSE
      -- L'utilisateur n'existe nulle part, lever une erreur
      RAISE EXCEPTION 'User with id % does not exist in profiles or auth.users', p_user_id;
    END IF;
  END IF;
  
  -- Générer un UUID pour la commande
  v_order_id := gen_random_uuid();
  
  -- Convertir la distance en NUMERIC si nécessaire
  v_distance_numeric := COALESCE(p_distance::NUMERIC, 0);
  
  -- Calculer l'ETA approximatif en minutes basé sur la distance et le mode de transport
  -- Moto: ~25 km/h, Véhicule: ~20 km/h, Cargo: ~18 km/h
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
  
  -- Insérer la commande dans la table orders
  -- Utiliser pickup_address et dropoff_address (type JSONB)
  -- Les paramètres p_pickup et p_dropoff sont déjà JSONB, pas besoin de conversion
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
    created_at,
    updated_at
  ) VALUES (
    v_order_id,
    p_user_id,
    p_pickup,  -- JSONB directement, pas de conversion
    p_dropoff, -- JSONB directement, pas de conversion
    p_method,
    p_price,
    v_distance_numeric,
    v_eta_minutes,   -- INTEGER pour eta_minutes
    'pending',
    NOW(),
    NOW()            -- updated_at à la même valeur que created_at
  );
  
  -- Retourner l'ID de la commande créée
  RETURN v_order_id;
END;
$$;

-- Donner les permissions nécessaires avec la signature correcte
GRANT EXECUTE ON FUNCTION public.fn_create_order(UUID, JSONB, JSONB, TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_order(UUID, JSONB, JSONB, TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_create_order(UUID, JSONB, JSONB, TEXT, INTEGER, NUMERIC) TO service_role;

-- Commentaire
COMMENT ON FUNCTION public.fn_create_order IS 'Crée une nouvelle commande de livraison et retourne son ID';

