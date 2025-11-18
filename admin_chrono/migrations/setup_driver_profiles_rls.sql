-- Migration: Configurer les politiques RLS pour la table driver_profiles
-- Exécutez ce script dans Supabase Dashboard → SQL Editor

-- Activer RLS sur la table driver_profiles
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Admins can view all driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can update all driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers can view their own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers can update their own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers can insert their own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Service role can access all driver profiles" ON public.driver_profiles;

-- 1. Politique pour permettre aux admins de voir tous les profils
CREATE POLICY "Admins can view all driver profiles"
ON public.driver_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin')
  )
);

-- 2. Politique pour permettre aux admins de modifier tous les profils
CREATE POLICY "Admins can update all driver profiles"
ON public.driver_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin')
  )
);

-- 3. Politique pour permettre aux drivers de voir leur propre profil
CREATE POLICY "Drivers can view their own profile"
ON public.driver_profiles
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'driver'
    AND users.id = driver_profiles.user_id
  )
);

-- 4. Politique pour permettre aux drivers de modifier leur propre profil
CREATE POLICY "Drivers can update their own profile"
ON public.driver_profiles
FOR UPDATE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'driver'
    AND users.id = driver_profiles.user_id
  )
);

-- 5. Politique pour permettre aux drivers d'insérer leur propre profil
CREATE POLICY "Drivers can insert their own profile"
ON public.driver_profiles
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'driver'
    AND users.id = driver_profiles.user_id
  )
);

-- Note: Le service role (utilisé par le backend) peut bypasser RLS automatiquement
-- Pas besoin de politique spécifique pour le service role

-- Vérifier que RLS est activé
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'driver_profiles';

-- Lister les politiques créées
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'driver_profiles'
ORDER BY policyname;

