-- ============================================================
-- AJOUTER LA COLONNE verified À LA TABLE otp_codes
-- ============================================================
-- Date: 2025
-- Description: Script SQL pour ajouter la colonne verified si elle n'existe pas
-- ============================================================

-- Ajouter la colonne verified si elle n'existe pas
ALTER TABLE otp_codes 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Créer l'index si nécessaire
CREATE INDEX IF NOT EXISTS idx_otp_verified ON otp_codes(verified);

-- Vérification
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'otp_codes' 
        AND column_name = 'verified'
    ) THEN
        RAISE NOTICE '✅ Colonne verified ajoutée ou déjà existante dans otp_codes';
    ELSE
        RAISE NOTICE '⚠️  Colonne verified n''a pas pu être ajoutée';
    END IF;
END $$;

