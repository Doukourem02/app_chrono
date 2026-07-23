-- Migration pour corriger la contrainte circulaire users_id_fkey
-- À exécuter dans Supabase SQL Editor

-- 1. Identifier et supprimer la contrainte problématique
-- Vérifier d'abord quelle contrainte existe
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'users'::regclass;

-- Supprimer la contrainte problématique si elle existe
-- (Ajuste le nom de la contrainte selon ce qui est trouvé ci-dessus)
DO $$ 
BEGIN
    -- Essayer de supprimer la contrainte users_id_fkey si elle existe
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_id_fkey' 
        AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_id_fkey;
        RAISE NOTICE 'Contrainte users_id_fkey supprimée avec succès';
    ELSE
        RAISE NOTICE 'Contrainte users_id_fkey non trouvée';
    END IF;
END $$;

-- 2. Ajouter la contrainte correcte vers auth.users si nécessaire
-- (Seulement si la table doit vraiment référencer auth.users)
-- ALTER TABLE users 
-- ADD CONSTRAINT users_auth_fkey 
-- FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Vérifier le résultat
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'users'::regclass;

-- 4. Test d'insertion pour vérifier que ça marche
-- INSERT INTO users (id, email, phone, role) 
-- VALUES ('550e8400-e29b-41d4-a716-446655440000', 'test@example.com', '+1234567890', 'client');

-- 5. Nettoyer le test
-- DELETE FROM users WHERE email = 'test@example.com';