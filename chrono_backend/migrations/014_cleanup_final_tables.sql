-- Migration 014: Nettoyage final des tables selon le plan validé
-- Date: 2025
-- Description: Ce script supprime les tables inutilisées selon le plan final validé

-- ============================================================
-- PLAN FINAL VALIDÉ :
-- ============================================================
-- 🟢 GARDER : 
--   users, profiles, orders, order_status_history, ratings, 
--   payments, driver_wallets, driver_wallet_transactions, 
--   driver_payouts, notifications, driver_locations
--
-- 🔴 SUPPRIMER :
--   drivers, reviews, driver_vehicles, loyalty_transactions,
--   driver_status_logs, delivery_proofs, addresses, otp_codes
-- ============================================================

DO $$
DECLARE
    table_name_var TEXT;
    tables_to_drop TEXT[] := ARRAY[
        'drivers',              -- Remplacée par driver_profiles
        'reviews',              -- Utilisez ratings.comment à la place
        'driver_vehicles',      -- Non utilisée
        'loyalty_transactions', -- Non utilisée
        'driver_status_logs',   -- Non utilisée
        'delivery_proofs',      -- À supprimer (remplacée par autre système)
        'addresses',            -- Non utilisée (adresses en JSONB dans orders)
        'otp_codes'             -- Non nécessaire (fallback mémoire fonctionne)
    ];
    table_exists BOOLEAN;
    row_count INTEGER := 0;
    total_dropped INTEGER := 0;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '🔍 DÉBUT DU NETTOYAGE FINAL DES TABLES';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PLAN APPLIQUÉ :';
    RAISE NOTICE '  🟢 GARDER : users, profiles, orders, order_status_history,';
    RAISE NOTICE '              ratings, payments, driver_wallets,';
    RAISE NOTICE '              driver_wallet_transactions, driver_payouts,';
    RAISE NOTICE '              notifications, driver_locations';
    RAISE NOTICE '  🔴 SUPPRIMER : drivers, reviews, driver_vehicles,';
    RAISE NOTICE '                 loyalty_transactions, driver_status_logs,';
    RAISE NOTICE '                 delivery_proofs, addresses, otp_codes';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    
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
            EXECUTE format('SELECT COUNT(*) FROM %I', table_name_var) INTO row_count;
            
            IF row_count > 0 THEN
                RAISE NOTICE '⚠️  Table % contient % ligne(s) - Suppression...', table_name_var, row_count;
            ELSE
                RAISE NOTICE '✅ Table % est vide - Suppression...', table_name_var;
            END IF;
            
            -- Supprimer la table avec CASCADE pour supprimer aussi les dépendances
            EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', table_name_var);
            RAISE NOTICE '🗑️  Table % supprimée avec succès', table_name_var;
            total_dropped := total_dropped + 1;
        ELSE
            RAISE NOTICE 'ℹ️  Table % n''existe pas - Ignorée', table_name_var;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ NETTOYAGE TERMINÉ : % table(s) supprimée(s)', total_dropped;
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 TABLES CONSERVÉES (selon plan) :';
    RAISE NOTICE '  ✅ users';
    RAISE NOTICE '  ✅ profiles';
    RAISE NOTICE '  ✅ orders';
    RAISE NOTICE '  ✅ order_status_history';
    RAISE NOTICE '  ✅ ratings';
    RAISE NOTICE '  ✅ payments';
    RAISE NOTICE '  ✅ driver_wallets';
    RAISE NOTICE '  ✅ driver_wallet_transactions';
    RAISE NOTICE '  ✅ driver_payouts';
    RAISE NOTICE '  ✅ notifications';
    RAISE NOTICE '  ✅ driver_locations';
    RAISE NOTICE '';
    RAISE NOTICE '📌 Note: Les tables actuellement utilisées dans le code';
    RAISE NOTICE '   (order_assignments, driver_profiles, deliveries,';
    RAISE NOTICE '    client_profiles, partner_profiles) sont conservées également.';
END $$;

-- Vérification finale - Lister toutes les tables restantes
SELECT 
    table_name as "Table conservée",
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = t.table_name) as "Colonnes"
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Statistiques des tables conservées (si elles existent)
DO $$
DECLARE
    table_list TEXT[] := ARRAY[
        -- Tables du plan à garder
        'users', 'profiles', 'orders', 'order_status_history', 'ratings',
        'payments', 'driver_wallets', 'driver_wallet_transactions',
        'driver_payouts', 'notifications', 'driver_locations',
        -- Tables actuellement utilisées dans le code
        'order_assignments', 'driver_profiles', 
        'deliveries', 'client_profiles', 'partner_profiles'
    ];
    tbl TEXT;
    row_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 STATISTIQUES DES TABLES CONSERVÉES :';
    RAISE NOTICE '============================================================';
    
    FOREACH tbl IN ARRAY table_list
    LOOP
        -- Vérifier si la table existe et compter les lignes
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('SELECT COUNT(*) FROM %I', tbl) INTO row_count;
            RAISE NOTICE '  ✅ % : % ligne(s)', tbl, row_count;
        ELSE
            RAISE NOTICE '  ⚠️  % : Table n''existe pas encore', tbl;
        END IF;
    END LOOP;
    
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ATTENTIONS :';
    RAISE NOTICE '    - delivery_proofs a été supprimée alors qu''elle';
    RAISE NOTICE '      est actuellement utilisée dans orderStorage.js (ligne 586).';
    RAISE NOTICE '      Il faudra adapter le code pour utiliser un autre système.';
    RAISE NOTICE '    - otp_codes a été supprimée : le fallback mémoire fonctionne automatiquement.';
    RAISE NOTICE '';
END $$;
