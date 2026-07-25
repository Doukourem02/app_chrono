-- 024 — Colonnes profil utilisateur (prénom, nom, avatar)
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- requis pour compléter le profil (app livreur / client).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;
