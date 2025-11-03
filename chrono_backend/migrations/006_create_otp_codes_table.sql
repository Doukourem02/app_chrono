-- Table pour stocker les codes OTP de manière persistante
CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (email, phone, role)
);

-- Index pour nettoyer rapidement les codes expirés
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- Fonction pour nettoyer automatiquement les codes expirés (optionnel)
CREATE OR REPLACE FUNCTION cleanup_expired_otp()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Commentaire
COMMENT ON TABLE otp_codes IS 'Stockage des codes OTP avec expiration automatique';
