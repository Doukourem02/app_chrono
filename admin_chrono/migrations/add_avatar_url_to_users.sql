-- Migration: Ajouter la colonne avatar_url à la table users
-- Exécutez ce script dans Supabase Dashboard → SQL Editor

-- Vérifier si la colonne existe déjà, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN avatar_url TEXT;
        
        COMMENT ON COLUMN users.avatar_url IS 'URL de l''avatar de l''utilisateur stocké dans Supabase Storage';
    ELSE
        RAISE NOTICE 'La colonne avatar_url existe déjà dans la table users';
    END IF;
END $$;

-- Vérifier que la colonne a été ajoutée
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name = 'avatar_url';

