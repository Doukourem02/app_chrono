-- Migration: Ajouter les colonnes first_name et last_name à la table users
-- Exécutez ce script dans Supabase Dashboard → SQL Editor

-- Vérifier si les colonnes existent déjà, sinon les ajouter
DO $$ 
BEGIN

    -- Ajouter first_name
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN first_name TEXT;
        
        COMMENT ON COLUMN users.first_name IS 'Prénom de l''utilisateur';
    ELSE
        RAISE NOTICE 'La colonne first_name existe déjà dans la table users';
    END IF;

    -- Ajouter last_name
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN last_name TEXT;
        
        COMMENT ON COLUMN users.last_name IS 'Nom de famille de l''utilisateur';
    ELSE
        RAISE NOTICE 'La colonne last_name existe déjà dans la table users';
    END IF;
END $$;

-- Vérifier que les colonnes ont été ajoutées
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name IN ('first_name', 'last_name')
ORDER BY column_name;

