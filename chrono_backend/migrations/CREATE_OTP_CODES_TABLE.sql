-- ============================================================
-- CRÉATION DE LA TABLE otp_codes
-- ============================================================
-- Date: 2025
-- Description: Script SQL pour créer la table otp_codes avec toutes les colonnes nécessaires
-- ============================================================

-- Supprimer la table si elle existe déjà (pour réinitialisation)
-- DROP TABLE IF EXISTS otp_codes CASCADE;

-- Créer la table otp_codes
CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (email, phone, role)
);

-- Index pour nettoyer rapidement les codes expirés
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_otp_email_phone_role ON otp_codes(email, phone, role);
CREATE INDEX IF NOT EXISTS idx_otp_verified ON otp_codes(verified);

-- Fonction pour nettoyer automatiquement les codes expirés
CREATE OR REPLACE FUNCTION cleanup_expired_otp()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE otp_codes IS 'Stockage des codes OTP avec expiration automatique';
COMMENT ON COLUMN otp_codes.email IS 'Email de l''utilisateur';
COMMENT ON COLUMN otp_codes.phone IS 'Téléphone de l''utilisateur';
COMMENT ON COLUMN otp_codes.role IS 'Rôle de l''utilisateur (client, driver, etc.)';
COMMENT ON COLUMN otp_codes.code IS 'Code OTP généré';
COMMENT ON COLUMN otp_codes.expires_at IS 'Date d''expiration du code';
COMMENT ON COLUMN otp_codes.verified IS 'Indique si le code a été vérifié';
COMMENT ON COLUMN otp_codes.created_at IS 'Date de création du code';

-- Vérification
DO $$
BEGIN
    RAISE NOTICE '✅ Table otp_codes créée avec succès !';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Colonnes créées :';
    RAISE NOTICE '  - email (TEXT, NOT NULL)';
    RAISE NOTICE '  - phone (TEXT, NOT NULL)';
    RAISE NOTICE '  - role (TEXT, NOT NULL)';
    RAISE NOTICE '  - code (TEXT, NOT NULL)';
    RAISE NOTICE '  - expires_at (TIMESTAMP, NOT NULL)';
    RAISE NOTICE '  - verified (BOOLEAN, DEFAULT FALSE)';
    RAISE NOTICE '  - created_at (TIMESTAMP, DEFAULT NOW())';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Index créés :';
    RAISE NOTICE '  - idx_otp_expires (sur expires_at)';
    RAISE NOTICE '  - idx_otp_email_phone_role (sur email, phone, role)';
    RAISE NOTICE '  - idx_otp_verified (sur verified)';
END $$;

