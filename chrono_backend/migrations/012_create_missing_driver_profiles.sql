-- Migration 012: Créer les profils driver manquants pour les utilisateurs existants avec rôle 'driver'
-- Date: 2025
-- Description: Ce script crée automatiquement un profil driver_profiles pour tous les utilisateurs
--              qui ont le rôle 'driver' dans la table users mais qui n'ont pas encore de profil driver

-- Fonction pour créer automatiquement les profils driver manquants
DO $$
DECLARE
    driver_user RECORD;
    created_count INTEGER := 0;
BEGIN
    -- Parcourir tous les utilisateurs avec rôle 'driver' qui n'ont pas de profil driver
    FOR driver_user IN 
        SELECT 
            u.id AS user_id,
            u.email,
            u.phone,
            u.created_at
        FROM users u
        WHERE u.role = 'driver'
        AND NOT EXISTS (
            SELECT 1 
            FROM driver_profiles dp 
            WHERE dp.user_id = u.id
        )
    LOOP
        -- Créer un profil driver pour cet utilisateur
        INSERT INTO driver_profiles (
            user_id,
            email,
            phone,
            vehicle_type,
            is_online,
            is_available,
            rating,
            total_deliveries,
            created_at
        ) VALUES (
            driver_user.user_id,
            driver_user.email,
            driver_user.phone,
            'moto', -- Valeur par défaut
            false,  -- Pas en ligne par défaut
            true,   -- Disponible par défaut
            5.0,    -- Note par défaut
            0,      -- Aucune livraison par défaut
            driver_user.created_at
        )
        ON CONFLICT (user_id) DO NOTHING; -- Ignorer si le profil existe déjà
        
        created_count := created_count + 1;
        
        RAISE NOTICE '✅ Profil driver créé pour utilisateur: % (%)', driver_user.email, driver_user.user_id;
    END LOOP;
    
    RAISE NOTICE '📊 Total profils driver créés: %', created_count;
END $$;

-- Vérification: Afficher les statistiques
SELECT 
    COUNT(*) as total_users_driver,
    (SELECT COUNT(*) FROM driver_profiles) as total_driver_profiles,
    COUNT(*) - (SELECT COUNT(*) FROM driver_profiles WHERE user_id IN (SELECT id FROM users WHERE role = 'driver')) as missing_profiles
FROM users 
WHERE role = 'driver';

-- Commentaire
COMMENT ON TABLE driver_profiles IS 'Table des profils chauffeurs - Migration 012: Profils manquants créés automatiquement';

