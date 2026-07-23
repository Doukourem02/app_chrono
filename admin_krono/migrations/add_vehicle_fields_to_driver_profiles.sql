-- Migration: Créer la table driver_profiles si elle n'existe pas, puis ajouter les colonnes vehicle_brand, vehicle_color et license_number
-- Exécutez ce script dans Supabase Dashboard → SQL Editor
-- 
-- IMPORTANT: Après avoir exécuté cette migration, exécutez également:
-- setup_driver_profiles_rls.sql pour configurer les politiques RLS (Row Level Security)

-- Créer la table driver_profiles si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'driver_profiles'
    ) THEN
        CREATE TABLE driver_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            email TEXT,
            phone TEXT,
            first_name TEXT,
            last_name TEXT,
            vehicle_type TEXT DEFAULT 'moto' CHECK (vehicle_type IN ('moto', 'vehicule', 'cargo')),
            vehicle_plate TEXT,
            vehicle_model TEXT,
            vehicle_brand TEXT,
            vehicle_color TEXT,
            license_number TEXT,
            is_online BOOLEAN DEFAULT false,
            is_available BOOLEAN DEFAULT true,
            current_latitude DOUBLE PRECISION,
            current_longitude DOUBLE PRECISION,
            last_location_update TIMESTAMP WITH TIME ZONE,
            rating DOUBLE PRECISION DEFAULT 5.0,
            total_deliveries INTEGER DEFAULT 0,
            completed_deliveries INTEGER DEFAULT 0,
            profile_image_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Créer un index sur user_id pour améliorer les performances
        CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON driver_profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_driver_profiles_is_online ON driver_profiles(is_online) WHERE is_online = true;

        COMMENT ON TABLE driver_profiles IS 'Profils des chauffeurs/livreurs';
        COMMENT ON COLUMN driver_profiles.vehicle_type IS 'Type de véhicule: moto, vehicule ou cargo';
        COMMENT ON COLUMN driver_profiles.vehicle_brand IS 'Marque du véhicule (ex: Yamaha, Toyota)';
        COMMENT ON COLUMN driver_profiles.vehicle_color IS 'Couleur du véhicule';
        COMMENT ON COLUMN driver_profiles.license_number IS 'Numéro de permis de conduire du chauffeur';

        -- Activer RLS sur la table (les politiques seront configurées dans setup_driver_profiles_rls.sql)
        ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

        RAISE NOTICE 'Table driver_profiles créée avec succès';
    ELSE
        RAISE NOTICE 'La table driver_profiles existe déjà';
    END IF;
END $$;

-- Ajouter les colonnes manquantes si la table existe déjà
DO $$ 
BEGIN
    -- Ajouter vehicle_brand
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'driver_profiles' 
        AND column_name = 'vehicle_brand'
    ) THEN
        ALTER TABLE driver_profiles 
        ADD COLUMN vehicle_brand TEXT;
        
        COMMENT ON COLUMN driver_profiles.vehicle_brand IS 'Marque du véhicule (ex: Yamaha, Toyota)';
    ELSE
        RAISE NOTICE 'La colonne vehicle_brand existe déjà dans la table driver_profiles';
    END IF;

    -- Ajouter vehicle_color
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'driver_profiles' 
        AND column_name = 'vehicle_color'
    ) THEN
        ALTER TABLE driver_profiles 
        ADD COLUMN vehicle_color TEXT;
        
        COMMENT ON COLUMN driver_profiles.vehicle_color IS 'Couleur du véhicule';
    ELSE
        RAISE NOTICE 'La colonne vehicle_color existe déjà dans la table driver_profiles';
    END IF;

    -- Ajouter license_number
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'driver_profiles' 
        AND column_name = 'license_number'
    ) THEN
        ALTER TABLE driver_profiles 
        ADD COLUMN license_number TEXT;
        
        COMMENT ON COLUMN driver_profiles.license_number IS 'Numéro de permis de conduire du chauffeur';
    ELSE
        RAISE NOTICE 'La colonne license_number existe déjà dans la table driver_profiles';
    END IF;
END $$;

-- Activer RLS sur la table si elle existe déjà (au cas où elle a été créée manuellement)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'driver_profiles'
    ) THEN
        -- Vérifier si RLS est déjà activé
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'driver_profiles' 
            AND rowsecurity = true
        ) THEN
            ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
            RAISE NOTICE 'RLS activé sur la table driver_profiles';
        ELSE
            RAISE NOTICE 'RLS est déjà activé sur la table driver_profiles';
        END IF;
    END IF;
END $$;

-- Vérifier que les colonnes ont été ajoutées
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'driver_profiles' 
AND column_name IN ('vehicle_brand', 'vehicle_color', 'license_number')
ORDER BY column_name;

