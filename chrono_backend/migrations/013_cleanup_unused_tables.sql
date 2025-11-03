-- Migration 013: Nettoyage des tables inutilisées
-- Date: 2025
-- Description: Ce script supprime toutes les tables qui ne sont pas utilisées dans le code
--              après une analyse complète du codebase

-- ============================================================
-- TABLES UTILISÉES (à CONSERVER) :
-- ============================================================
-- ✅ users - Utilisée partout (authController, userController, etc.)
-- ✅ orders - Utilisée partout (orderStorage, deliveryController, etc.)
-- ✅ order_status_history - Utilisée dans orderStorage.js
-- ✅ order_assignments - Utilisée dans orderStorage.js et ratingController.js
-- ✅ driver_profiles - Utilisée dans authController.js et driverController.js
-- ✅ ratings - Utilisée dans ratingController.js
-- ✅ profiles - Utilisée dans fn_create_order et orderApi.ts
-- ✅ otp_codes - Utilisée dans otpStorage.js et otpService.js
-- ✅ delivery_proofs - Utilisée dans orderStorage.js (ligne 586)
-- ✅ deliveries - Utilisée dans deliveryController.js (lignes 12, 162)
-- ✅ client_profiles - Potentiellement utilisée (table de profils clients)
-- ✅ partner_profiles - Potentiellement utilisée (table de profils partenaires)

-- ============================================================
-- TABLES À SUPPRIMER (Vraiment inutiles) :
-- ============================================================
-- ❌ drivers - Non utilisée (on utilise driver_profiles à la place)
-- ❌ reviews - Non utilisée (on utilise ratings.comment à la place)

-- ============================================================
-- TABLES À CONSERVER (Fonctionnalités futures importantes) :
-- ============================================================
-- ✅ driver_wallets - CRITIQUE pour système de portefeuille chauffeurs
-- ✅ driver_wallet_transactions - CRITIQUE pour historique transactions financières
-- ✅ driver_payouts - CRITIQUE pour demandes de retrait chauffeurs
-- ✅ payments - CRITIQUE pour paiements clients
-- ✅ addresses - UTILE pour gestion centralisée des adresses (si nécessaire)
-- ✅ notifications - UTILE pour notifications push/email (si nécessaire)
-- ✅ driver_vehicles - OPTIONNEL pour multi-véhicules (si nécessaire plus tard)
-- ✅ driver_locations - OPTIONNEL pour historique GPS (si nécessaire plus tard)
-- ✅ driver_status_logs - OPTIONNEL pour analytique statuts (si nécessaire plus tard)
-- ✅ loyalty_transactions - OPTIONNEL pour programme de fidélité (si nécessaire plus tard)

-- ============================================================
-- SCRIPT DE SUPPRESSION
-- ============================================================

-- Étape 1: Vérifier l'existence des tables avant suppression
DO $$
DECLARE
    table_name_var TEXT;
    tables_to_drop TEXT[] := ARRAY[
        'drivers',  -- Remplacée par driver_profiles
        'reviews'  -- Utilisez ratings.comment à la place
    ];
    table_exists BOOLEAN;
    drop_count INTEGER := 0;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '🔍 DÉBUT DU NETTOYAGE DES TABLES INUTILISÉES';
    RAISE NOTICE '============================================================';
    
    -- Parcourir chaque table à supprimer
    FOREACH table_name_var IN ARRAY tables_to_drop
    LOOP
        -- Vérifier si la table existe
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name_var
        ) INTO table_exists;
        
        IF table_exists THEN
            -- Vérifier si la table contient des données
            EXECUTE format('SELECT COUNT(*) FROM %I', table_name_var) INTO drop_count;
            
            IF drop_count > 0 THEN
                RAISE NOTICE '⚠️  Table % contient % lignes - Suppression quand même', table_name_var, drop_count;
            ELSE
                RAISE NOTICE '✅ Table % est vide - Suppression...', table_name_var;
            END IF;
            
            -- Supprimer la table avec CASCADE pour supprimer aussi les dépendances
            EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', table_name_var);
            RAISE NOTICE '🗑️  Table % supprimée avec succès', table_name_var;
        ELSE
            RAISE NOTICE 'ℹ️  Table % n''existe pas - Ignorée', table_name_var;
        END IF;
    END LOOP;
    
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ NETTOYAGE TERMINÉ';
    RAISE NOTICE '============================================================';
END $$;

-- Étape 2: Supprimer les contraintes de clés étrangères orphelines
-- (Les contraintes seront automatiquement supprimées avec CASCADE, mais on peut vérifier)

-- Étape 3: Vérification finale - Lister les tables restantes
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Étape 4: Statistiques des tables conservées
SELECT 
    'users' as table_name,
    (SELECT COUNT(*) FROM users) as row_count
UNION ALL
SELECT 
    'orders',
    (SELECT COUNT(*) FROM orders)
UNION ALL
SELECT 
    'order_status_history',
    (SELECT COUNT(*) FROM order_status_history)
UNION ALL
SELECT 
    'order_assignments',
    (SELECT COUNT(*) FROM order_assignments)
UNION ALL
SELECT 
    'driver_profiles',
    (SELECT COUNT(*) FROM driver_profiles)
UNION ALL
SELECT 
    'ratings',
    (SELECT COUNT(*) FROM ratings)
UNION ALL
SELECT 
    'profiles',
    (SELECT COUNT(*) FROM profiles)
UNION ALL
SELECT 
    'otp_codes',
    (SELECT COUNT(*) FROM otp_codes)
UNION ALL
SELECT 
    'delivery_proofs',
    (SELECT COUNT(*) FROM delivery_proofs)
UNION ALL
SELECT 
    'deliveries',
    (SELECT COUNT(*) FROM deliveries)
UNION ALL
SELECT 
    'client_profiles',
    (SELECT COUNT(*) FROM client_profiles)
UNION ALL
SELECT 
    'partner_profiles',
    (SELECT COUNT(*) FROM partner_profiles);

-- Commentaires finaux
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 TABLES CONSERVÉES :';
    RAISE NOTICE '  ✅ users';
    RAISE NOTICE '  ✅ orders';
    RAISE NOTICE '  ✅ order_status_history';
    RAISE NOTICE '  ✅ order_assignments';
    RAISE NOTICE '  ✅ driver_profiles';
    RAISE NOTICE '  ✅ ratings';
    RAISE NOTICE '  ✅ profiles';
    RAISE NOTICE '  ✅ otp_codes';
    RAISE NOTICE '  ✅ delivery_proofs';
    RAISE NOTICE '  ✅ deliveries';
    RAISE NOTICE '  ✅ client_profiles';
    RAISE NOTICE '  ✅ partner_profiles';
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  TABLES SUPPRIMÉES :';
    RAISE NOTICE '  ❌ drivers (remplacée par driver_profiles)';
    RAISE NOTICE '  ❌ reviews (utilisez ratings.comment)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ TABLES CONSERVÉES (Fonctionnalités futures) :';
    RAISE NOTICE '  💰 driver_wallets (portefeuilles chauffeurs)';
    RAISE NOTICE '  💰 driver_wallet_transactions (historique transactions)';
    RAISE NOTICE '  💰 driver_payouts (demandes de retrait)';
    RAISE NOTICE '  💳 payments (paiements clients)';
    RAISE NOTICE '  📍 addresses (adresses centralisées)';
    RAISE NOTICE '  🔔 notifications (notifications push/email)';
    RAISE NOTICE '  🚗 driver_vehicles (multi-véhicules)';
    RAISE NOTICE '  📍 driver_locations (historique GPS)';
    RAISE NOTICE '  📊 driver_status_logs (analytique statuts)';
    RAISE NOTICE '  🎁 loyalty_transactions (programme de fidélité)';
END $$;

