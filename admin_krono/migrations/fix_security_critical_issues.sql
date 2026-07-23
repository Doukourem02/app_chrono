-- ============================================================================
-- CORRECTIONS DE SÉCURITÉ CRITIQUES
-- ============================================================================
-- ⚠️ IMPORTANT : Exécutez ce script dans Supabase Dashboard → SQL Editor
-- Ce script corrige deux failles de sécurité critiques
-- ============================================================================

-- ============================================================================
-- 1. CORRIGER LA FONCTION fn_create_order
-- ============================================================================
-- PROBLÈME : La fonction ne vérifie pas que p_user_id = auth.uid()
-- RISQUE : Un utilisateur peut créer des commandes pour d'autres utilisateurs
-- ============================================================================

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
  -- ⚠️ SÉCURITÉ : Vérifier que l'utilisateur ne peut créer que ses propres commandes
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only create orders for yourself. Expected user_id: %, provided: %', auth.uid(), p_user_id;
  END IF;
  
  -- Vérifier que l'utilisateur existe dans la table profiles (contrainte FK)
  v_profile_exists := EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id);
  
  -- Si le profil n'existe pas, vérifier dans auth.users et créer un profil minimal
  IF NOT v_profile_exists THEN
    -- Vérifier si l'utilisateur existe dans auth.users
    IF EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
      -- Créer un enregistrement minimal dans profiles
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
    p_pickup,
    p_dropoff,
    p_method,
    p_price,
    v_distance_numeric,
    v_eta_minutes,
    'pending',
    NOW(),
    NOW()
  );
  
  -- Retourner l'ID de la commande créée
  RETURN v_order_id;
END;
$$;

-- ============================================================================
-- 2. AJOUTER POLITIQUE RLS POUR UPDATE SUR users
-- ============================================================================
-- PROBLÈME : Pas de politique pour que les utilisateurs modifient uniquement leur propre profil
-- RISQUE : Si RLS n'est pas strict, un utilisateur pourrait modifier d'autres utilisateurs
-- ============================================================================

DO $$
DECLARE
  has_auth_user_id BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    -- Vérifier si la colonne auth_user_id existe
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'auth_user_id'
    ) INTO has_auth_user_id;
    
    -- Supprimer l'ancienne politique si elle existe
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own data" ON public.users';
    
    -- Créer une politique stricte : les utilisateurs ne peuvent modifier QUE leur propre profil
    IF has_auth_user_id THEN
      EXECUTE 'CREATE POLICY "Users can update own data"
               ON public.users
               FOR UPDATE
               USING (id = auth.uid() OR auth_user_id = auth.uid())
               WITH CHECK (id = auth.uid() OR auth_user_id = auth.uid())';
    ELSE
      EXECUTE 'CREATE POLICY "Users can update own data"
               ON public.users
               FOR UPDATE
               USING (id = auth.uid())
               WITH CHECK (id = auth.uid())';
    END IF;
    
    -- Supprimer l'ancienne politique INSERT si elle existe
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own data" ON public.users';
    
    -- Créer une politique pour INSERT : les utilisateurs ne peuvent créer QUE leur propre profil
    IF has_auth_user_id THEN
      EXECUTE 'CREATE POLICY "Users can insert own data"
               ON public.users
               FOR INSERT
               WITH CHECK (id = auth.uid() OR auth_user_id = auth.uid())';
    ELSE
      EXECUTE 'CREATE POLICY "Users can insert own data"
               ON public.users
               FOR INSERT
               WITH CHECK (id = auth.uid())';
    END IF;
    
    RAISE NOTICE 'Politiques RLS créées pour users (UPDATE et INSERT)';
  END IF;
END $$;

-- ============================================================================
-- 3. VÉRIFICATION
-- ============================================================================

-- Vérifier que la fonction est bien sécurisée
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'fn_create_order'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Vérifier les politiques RLS sur users
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
-- ✅ Après exécution :
-- 1. La fonction fn_create_order vérifie maintenant que p_user_id = auth.uid()
-- 2. Les utilisateurs ne peuvent modifier que leur propre profil dans users
-- 3. Les utilisateurs ne peuvent créer que leur propre profil dans users
-- ============================================================================

