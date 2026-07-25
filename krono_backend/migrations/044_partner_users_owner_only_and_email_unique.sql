-- 044 — Portail partenaire rôle unique + unicité stricte des partenaires
-- Corrige docs/taches.md (section B2B) :
-- 1) Le code applicatif (partnerUserController.ts) n'écrit plus jamais 'manager' depuis
--    longtemps, mais le schéma autorisait/défaultait encore dessus (CHECK + DEFAULT).
--    Vérifié avant migration : aucune ligne 'manager' en prod (SELECT role, COUNT(*)
--    FROM partner_users GROUP BY role -> uniquement 'owner').
-- 2) Aucune contrainte n'empêchait de créer deux fiches partenaire avec le même e-mail
--    (doublon admin + app). Vérifié avant migration : aucun doublon d'e-mail existant.

ALTER TABLE public.partner_users ALTER COLUMN role SET DEFAULT 'owner';

ALTER TABLE public.partner_users DROP CONSTRAINT IF EXISTS partner_users_role_check;
ALTER TABLE public.partner_users ADD CONSTRAINT partner_users_role_check CHECK (role = 'owner');

CREATE UNIQUE INDEX IF NOT EXISTS partners_email_unique_idx
  ON public.partners (lower(email))
  WHERE email IS NOT NULL;
