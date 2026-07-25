-- Cap du livreur (degrés, horaire depuis le nord) pour suivi public / carte
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS heading_degrees double precision;

COMMENT ON COLUMN driver_profiles.heading_degrees IS 'Cap GPS (0–360°), optionnel — suivi destinataire';
