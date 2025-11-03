-- ============================================
-- Script de test pour vérifier le calcul de la moyenne des notes
-- ============================================

-- 1️⃣ EXEMPLE AVEC UN VRAI DRIVER_ID
-- Remplacez '2730de06-8444-4e28-873e-ba7267c4ca54' par un vrai UUID de livreur de votre base
SELECT 
    driver_id,
    COUNT(*) as nombre_evaluations,
    AVG(rating) as note_moyenne_calculée,
    ROUND(AVG(rating)::numeric, 2) as note_moyenne_arrondie,
    MIN(rating) as note_min,
    MAX(rating) as note_max,
    -- Détail : voir toutes les notes pour vérifier le calcul
    STRING_AGG(rating::text, ' + ') as détail_calcul
FROM ratings
WHERE driver_id = '2730de06-8444-4e28-873e-ba7267c4ca54'  -- ⚠️ Remplacez par un vrai UUID
GROUP BY driver_id;

-- 2️⃣ VOIR TOUTES LES ÉVALUATIONS D'UN LIVREUR (pour vérifier manuellement)
SELECT 
    id,
    rating,
    comment,
    user_id as client_id,
    created_at
FROM ratings
WHERE driver_id = '2730de06-8444-4e28-873e-ba7267c4ca54'  -- ⚠️ Remplacez par un vrai UUID
ORDER BY created_at DESC;

-- 3️⃣ TESTER LA FONCTION DIRECTEMENT (utilise la fonction PostgreSQL)
-- Cela déclenchera aussi la mise à jour dans driver_profiles
SELECT update_driver_average_rating('2730de06-8444-4e28-873e-ba7267c4ca54'::uuid);
-- ⚠️ Remplacez par un vrai UUID

-- 4️⃣ VOIR TOUS LES LIVREURS AVEC LEURS NOTES MOYENNES
SELECT 
    driver_id,
    COUNT(*) as nombre_evaluations,
    ROUND(AVG(rating)::numeric, 2) as note_moyenne,
    STRING_AGG(rating::text, ', ') as toutes_les_notes
FROM ratings
GROUP BY driver_id
ORDER BY note_moyenne DESC, nombre_evaluations DESC;

-- 5️⃣ EXEMPLE DE CALCUL MANUEL (vérifier que AVG fonctionne bien)
-- Si un livreur a reçu : 5, 2, 4, 5
-- La moyenne doit être : (5 + 2 + 4 + 5) / 4 = 16 / 4 = 4.00
-- Exécutez cette requête avec un driver_id réel pour voir :
SELECT 
    driver_id,
    COUNT(*) as nombre,
    SUM(rating) as somme_totale,
    AVG(rating) as moyenne_AVG,
    SUM(rating)::numeric / COUNT(*)::numeric as moyenne_manuelle,
    ROUND(AVG(rating)::numeric, 2) as moyenne_arrondie
FROM ratings
WHERE driver_id = '2730de06-8444-4e28-873e-ba7267c4ca54'  -- ⚠️ Remplacez par un vrai UUID
GROUP BY driver_id;

