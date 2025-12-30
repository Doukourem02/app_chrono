-- ============================================================================
-- SCRIPT DE SÉCURITÉ : ACTIVATION RLS SUR TOUTES LES TABLES CRITIQUES
-- ============================================================================
-- ⚠️ IMPORTANT : Exécutez ce script dans Supabase Dashboard → SQL Editor
-- Ce script active RLS et crée les politiques de base pour protéger vos données
-- ============================================================================

-- ============================================================================
-- 1. ACTIVATION RLS SUR TOUTES LES TABLES CRITIQUES
-- ============================================================================

-- Orders (Commandes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur orders';
  ELSE
    RAISE NOTICE 'Table orders n''existe pas';
  END IF;
END $$;

-- Transactions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur transactions';
  ELSE
    RAISE NOTICE 'Table transactions n''existe pas';
  END IF;
END $$;

-- Commission Balance
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commission_balance') THEN
    ALTER TABLE public.commission_balance ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur commission_balance';
  ELSE
    RAISE NOTICE 'Table commission_balance n''existe pas';
  END IF;
END $$;

-- Commission Transactions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commission_transactions') THEN
    ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur commission_transactions';
  ELSE
    RAISE NOTICE 'Table commission_transactions n''existe pas';
  END IF;
END $$;

-- Ratings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings') THEN
    ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur ratings';
  ELSE
    RAISE NOTICE 'Table ratings n''existe pas';
  END IF;
END $$;

-- OTP Codes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'otp_codes') THEN
    ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur otp_codes';
  ELSE
    RAISE NOTICE 'Table otp_codes n''existe pas';
  END IF;
END $$;

-- Order Assignments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_assignments') THEN
    ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur order_assignments';
  ELSE
    RAISE NOTICE 'Table order_assignments n''existe pas';
  END IF;
END $$;

-- ============================================================================
-- 2. SUPPRESSION DES ANCIENNES POLITIQUES (si elles existent)
-- ============================================================================

-- Orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can update assigned orders" ON public.orders;

-- Transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;

-- Commission Balance
DROP POLICY IF EXISTS "Drivers can view own commission" ON public.commission_balance;
DROP POLICY IF EXISTS "Admins can view all commission" ON public.commission_balance;

-- Commission Transactions
DROP POLICY IF EXISTS "Drivers can view own transactions" ON public.commission_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.commission_transactions;

-- Ratings
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can create own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Admins can view all ratings" ON public.ratings;

-- Order Assignments
DROP POLICY IF EXISTS "Users can view own assignments" ON public.order_assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.order_assignments;

-- ============================================================================
-- 3. CRÉATION DES POLITIQUES RLS POUR ORDERS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    -- Les utilisateurs peuvent voir leurs propres commandes
    EXECUTE 'CREATE POLICY "Users can view own orders"
             ON public.orders
             FOR SELECT
             USING (user_id = auth.uid())';
    
    -- Les utilisateurs peuvent créer leurs propres commandes
    EXECUTE 'CREATE POLICY "Users can create own orders"
             ON public.orders
             FOR INSERT
             WITH CHECK (user_id = auth.uid())';
    
    -- Les utilisateurs peuvent modifier leurs propres commandes (seulement si pending)
    EXECUTE 'CREATE POLICY "Users can update own orders"
             ON public.orders
             FOR UPDATE
             USING (user_id = auth.uid() AND status = ''pending'')';
    
    -- Les admins peuvent voir toutes les commandes
    EXECUTE 'CREATE POLICY "Admins can view all orders"
             ON public.orders
             FOR SELECT
             USING (is_admin())';
    
    -- Les admins peuvent modifier toutes les commandes
    EXECUTE 'CREATE POLICY "Admins can update all orders"
             ON public.orders
             FOR UPDATE
             USING (is_admin())';
    
    -- Les drivers peuvent voir les commandes qui leur sont assignées
    EXECUTE 'CREATE POLICY "Drivers can view assigned orders"
             ON public.orders
             FOR SELECT
             USING (driver_id = auth.uid())';
    
    -- Les drivers peuvent modifier les commandes qui leur sont assignées
    EXECUTE 'CREATE POLICY "Drivers can update assigned orders"
             ON public.orders
             FOR UPDATE
             USING (driver_id = auth.uid())';
    
    RAISE NOTICE 'Politiques RLS créées pour orders';
  END IF;
END $$;

-- ============================================================================
-- 4. CRÉATION DES POLITIQUES RLS POUR TRANSACTIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    -- Les utilisateurs peuvent voir leurs propres transactions
    -- user_id dans transactions représente le payeur
    EXECUTE 'CREATE POLICY "Users can view own transactions"
             ON public.transactions
             FOR SELECT
             USING (user_id = auth.uid())';
    
    -- Les admins peuvent voir toutes les transactions
    EXECUTE 'CREATE POLICY "Admins can view all transactions"
             ON public.transactions
             FOR SELECT
             USING (is_admin())';
    
    -- Note: Les transactions sont créées uniquement par le backend (service_role)
    -- Pas de politique INSERT pour les utilisateurs
    
    RAISE NOTICE 'Politiques RLS créées pour transactions';
  END IF;
END $$;

-- ============================================================================
-- 5. CRÉATION DES POLITIQUES RLS POUR COMMISSION_BALANCE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commission_balance') THEN
    -- Les drivers peuvent voir leur propre solde de commission
    -- commission_balance utilise driver_id, pas user_id
    EXECUTE 'CREATE POLICY "Drivers can view own commission"
             ON public.commission_balance
             FOR SELECT
             USING (driver_id = auth.uid())';
    
    -- Les admins peuvent voir tous les soldes de commission
    EXECUTE 'CREATE POLICY "Admins can view all commission"
             ON public.commission_balance
             FOR SELECT
             USING (is_admin())';
    
    -- Note: Les modifications de commission sont faites uniquement par le backend
    -- Pas de politique UPDATE pour les utilisateurs
    
    RAISE NOTICE 'Politiques RLS créées pour commission_balance';
  END IF;
END $$;

-- ============================================================================
-- 5B. CRÉATION DES POLITIQUES RLS POUR COMMISSION_TRANSACTIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commission_transactions') THEN
    -- Les drivers peuvent voir leurs propres transactions de commission
    EXECUTE 'CREATE POLICY "Drivers can view own commission transactions"
             ON public.commission_transactions
             FOR SELECT
             USING (driver_id = auth.uid())';
    
    -- Les admins peuvent voir toutes les transactions de commission
    EXECUTE 'CREATE POLICY "Admins can view all commission transactions"
             ON public.commission_transactions
             FOR SELECT
             USING (is_admin())';
    
    -- Note: Les transactions de commission sont créées uniquement par le backend
    -- Pas de politique INSERT pour les utilisateurs
    
    RAISE NOTICE 'Politiques RLS créées pour commission_transactions';
  END IF;
END $$;

-- ============================================================================
-- 6. CRÉATION DES POLITIQUES RLS POUR RATINGS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings') THEN
    -- Tout le monde peut voir les notes (pour affichage public)
    EXECUTE 'CREATE POLICY "Anyone can view ratings"
             ON public.ratings
             FOR SELECT
             USING (true)';
    
    -- Les utilisateurs peuvent créer leurs propres notes
    EXECUTE 'CREATE POLICY "Users can create own ratings"
             ON public.ratings
             FOR INSERT
             WITH CHECK (user_id = auth.uid())';
    
    -- Les utilisateurs peuvent modifier leurs propres notes (seulement si récentes)
    EXECUTE 'CREATE POLICY "Users can update own ratings"
             ON public.ratings
             FOR UPDATE
             USING (
               user_id = auth.uid() 
               AND created_at > NOW() - INTERVAL ''1 hour''
             )';
    
    -- Les admins peuvent voir toutes les notes
    EXECUTE 'CREATE POLICY "Admins can view all ratings"
             ON public.ratings
             FOR SELECT
             USING (is_admin())';
    
    -- Les admins peuvent supprimer n'importe quelle note
    EXECUTE 'CREATE POLICY "Admins can delete ratings"
             ON public.ratings
             FOR DELETE
             USING (is_admin())';
    
    RAISE NOTICE 'Politiques RLS créées pour ratings';
  END IF;
END $$;

-- ============================================================================
-- 7. CRÉATION DES POLITIQUES RLS POUR ORDER_ASSIGNMENTS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_assignments') THEN
    -- Les utilisateurs peuvent voir les assignations de leurs commandes
    EXECUTE 'CREATE POLICY "Users can view own assignments"
             ON public.order_assignments
             FOR SELECT
             USING (
               EXISTS (
                 SELECT 1 FROM public.orders
                 WHERE orders.id = order_assignments.order_id
                 AND orders.user_id = auth.uid()
               )
               OR driver_id = auth.uid()
             )';
    
    -- Les admins peuvent voir toutes les assignations
    EXECUTE 'CREATE POLICY "Admins can view all assignments"
             ON public.order_assignments
             FOR SELECT
             USING (is_admin())';
    
    -- Note: Les assignations sont créées uniquement par le backend
    -- Pas de politique INSERT pour les utilisateurs
    
    RAISE NOTICE 'Politiques RLS créées pour order_assignments';
  END IF;
END $$;

-- ============================================================================
-- 8. OTP_CODES : AUCUNE POLITIQUE (BLOQUÉ PAR DÉFAUT)
-- ============================================================================
-- Les codes OTP sont sensibles et ne doivent être accessibles QUE par le backend
-- En n'ayant aucune politique, RLS bloque tout accès sauf service_role
-- C'est exactement ce qu'on veut pour otp_codes

-- ============================================================================
-- 9. VÉRIFICATION FINALE
-- ============================================================================

-- Afficher le statut RLS de toutes les tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('orders', 'transactions', 'commission_balance', 'commission_transactions', 'ratings', 'otp_codes', 'order_assignments', 'users', 'driver_profiles')
ORDER BY tablename;

-- Afficher toutes les politiques créées
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('orders', 'transactions', 'commission_balance', 'commission_transactions', 'ratings', 'otp_codes', 'order_assignments')
ORDER BY tablename, policyname;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
-- ✅ Après exécution, vérifiez que :
-- 1. Toutes les tables ont RLS activé (rowsecurity = true)
-- 2. Des politiques existent pour chaque table
-- 3. Testez avec différents rôles (client, driver, admin)
-- ============================================================================

