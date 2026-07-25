-- 017a — Type de livreur (interne Krono vs partenaire commission)
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- le fichier original n'a jamais été committé, seule la colonne vit en base.

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS driver_type VARCHAR NULL
    CONSTRAINT driver_profiles_driver_type_check CHECK (driver_type IN ('internal', 'partner'));
