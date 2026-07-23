-- Politiques RLS pour permettre aux admins d'accéder aux données
-- À exécuter dans Supabase SQL Editor

-- 1. Fonction helper pour vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role_value TEXT;
  has_auth_user_id BOOLEAN;
BEGIN
  -- Vérifier si la colonne auth_user_id existe
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'auth_user_id'
  ) INTO has_auth_user_id;
  
  -- Vérifier d'abord dans public.users avec id = auth.uid()
  BEGIN
    SELECT role::TEXT INTO user_role_value
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Si trouvé et admin, retourner true
    IF user_role_value IN ('admin', 'super_admin') THEN
      RETURN TRUE;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Continuer si erreur
      NULL;
  END;
  
  -- Si auth_user_id existe, vérifier avec auth_user_id
  IF has_auth_user_id THEN
    BEGIN
      SELECT role::TEXT INTO user_role_value
      FROM public.users
      WHERE auth_user_id = auth.uid()
      LIMIT 1;
      
      -- Si trouvé et admin, retourner true
      IF user_role_value IN ('admin', 'super_admin') THEN
        RETURN TRUE;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Continuer si erreur
        NULL;
    END;
  END IF;
  
  -- Si la table users n'existe pas ou n'a pas de colonne role,
  -- vérifier dans auth.users directement (si la colonne existe)
  BEGIN
    SELECT user_role::TEXT INTO user_role_value
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF user_role_value IN ('admin', 'super_admin') THEN
      RETURN TRUE;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- La colonne user_role n'existe peut-être pas dans auth.users
      NULL;
  END;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Note: La fonction is_admin() utilise SECURITY DEFINER, donc elle contourne RLS
-- Cependant, si RLS bloque complètement l'accès, nous devons créer une politique de base
-- pour permettre aux utilisateurs authentifiés de lire leur propre enregistrement
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
    
    -- Supprimer les anciennes politiques si elles existent
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own data" ON public.users';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to read own role" ON public.users';
    
    -- Créer une politique adaptée selon la structure de la table
    IF has_auth_user_id THEN
      -- Si auth_user_id existe, utiliser les deux conditions
      EXECUTE 'CREATE POLICY "Users can view own data"
               ON public.users
               FOR SELECT
               USING (id = auth.uid() OR auth_user_id = auth.uid())';
    ELSE
      -- Sinon, utiliser seulement id = auth.uid()
      EXECUTE 'CREATE POLICY "Users can view own data"
               ON public.users
               FOR SELECT
               USING (id = auth.uid())';
    END IF;
  END IF;
END $$;

-- 3. Supprimer les anciennes politiques admin si elles existent (pour éviter les conflits)
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

-- 4. Politiques pour la table orders (si elle existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    -- Permettre aux admins de voir toutes les commandes
    EXECUTE 'CREATE POLICY "Admins can view all orders"
             ON public.orders
             FOR SELECT
             USING (is_admin())';
    
    -- Permettre aux admins de modifier toutes les commandes
    EXECUTE 'CREATE POLICY "Admins can update all orders"
             ON public.orders
             FOR UPDATE
             USING (is_admin())';
    
    -- Permettre aux admins de supprimer toutes les commandes
    EXECUTE 'CREATE POLICY "Admins can delete all orders"
             ON public.orders
             FOR DELETE
             USING (is_admin())';
  END IF;
END $$;

-- 5. Politiques pour la table users (si elle existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    -- Permettre aux admins de voir tous les utilisateurs
    EXECUTE 'CREATE POLICY "Admins can view all users"
             ON public.users
             FOR SELECT
             USING (is_admin())';
    
    -- Permettre aux admins de modifier tous les utilisateurs
    EXECUTE 'CREATE POLICY "Admins can update all users"
             ON public.users
             FOR UPDATE
             USING (is_admin())';
  END IF;
END $$;

-- 6. Politiques pour la table driver_profiles (si elle existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'driver_profiles') THEN
    -- Permettre aux admins de voir tous les profils chauffeurs
    EXECUTE 'CREATE POLICY "Admins can view all driver profiles"
             ON public.driver_profiles
             FOR SELECT
             USING (is_admin())';
    
    -- Permettre aux admins de modifier tous les profils chauffeurs
    EXECUTE 'CREATE POLICY "Admins can update all driver profiles"
             ON public.driver_profiles
             FOR UPDATE
             USING (is_admin())';
  END IF;
END $$;

-- 7. Politiques pour la table client_profiles (si elle existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_profiles') THEN
    -- Permettre aux admins de voir tous les profils clients
    EXECUTE 'CREATE POLICY "Admins can view all client profiles"
             ON public.client_profiles
             FOR SELECT
             USING (is_admin())';
    
    -- Permettre aux admins de modifier tous les profils clients
    EXECUTE 'CREATE POLICY "Admins can update all client profiles"
             ON public.client_profiles
             FOR UPDATE
             USING (is_admin())';
  END IF;
END $$;

-- 8. Politiques pour la table ratings (si elle existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings') THEN
    -- Permettre aux admins de voir toutes les notes
    EXECUTE 'CREATE POLICY "Admins can view all ratings"
             ON public.ratings
             FOR SELECT
             USING (is_admin())';
  END IF;
END $$;

-- 9. Politiques pour la table transactions (si elle existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    -- Supprimer la politique si elle existe déjà
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions';
    
    -- Créer la politique
    EXECUTE 'CREATE POLICY "Admins can view all transactions"
             ON public.transactions
             FOR SELECT
             USING (is_admin())';
  END IF;
END $$;

-- Note: Assurez-vous que RLS est activé sur ces tables
-- Si RLS n'est pas activé, exécutez ces commandes :
-- ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

