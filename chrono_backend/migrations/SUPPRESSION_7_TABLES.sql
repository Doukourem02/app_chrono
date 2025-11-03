-- ============================================================
-- SUPPRESSION DES 8 TABLES SELON LE PLAN FINAL
-- ============================================================
-- Date: 2025
-- Description: Script SQL pour supprimer les 8 tables inutilisées
-- ============================================================

-- Tables à supprimer :
-- 1. drivers - Remplacée par driver_profiles
-- 2. reviews - Utilisez ratings.comment à la place
-- 3. driver_vehicles - Non utilisée
-- 4. loyalty_transactions - Non utilisée
-- 5. driver_status_logs - Non utilisée
-- 6. delivery_proofs - À supprimer (remplacée par autre système)
-- 7. addresses - Non utilisée (adresses en JSONB dans orders)
-- 8. otp_codes - Non nécessaire (fallback mémoire fonctionne)

-- ⚠️ ATTENTIONS :
--    - delivery_proofs est actuellement utilisée dans le code (orderStorage.js ligne 586)
--      Il faudra adapter le code après suppression
--    - otp_codes : Non nécessaire car le fallback mémoire fonctionne déjà

-- ============================================================
-- SUPPRESSION DES TABLES
-- ============================================================

DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS driver_vehicles CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS driver_status_logs CASCADE;
DROP TABLE IF EXISTS delivery_proofs CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS otp_codes CASCADE;

-- ============================================================
-- VÉRIFICATION - Lister les tables restantes
-- ============================================================

SELECT 
    table_name as "Table conservée",
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = t.table_name) as "Nombre de colonnes"
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================
-- CONFIRMATION
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Suppression terminée !';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables supprimées :';
    RAISE NOTICE '  ❌ drivers';
    RAISE NOTICE '  ❌ reviews';
    RAISE NOTICE '  ❌ driver_vehicles';
    RAISE NOTICE '  ❌ loyalty_transactions';
    RAISE NOTICE '  ❌ driver_status_logs';
    RAISE NOTICE '  ❌ delivery_proofs';
    RAISE NOTICE '  ❌ addresses';
    RAISE NOTICE '  ❌ otp_codes (fallback mémoire utilisé)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  N''oubliez pas d''adapter le code qui utilise delivery_proofs !';
END $$;

