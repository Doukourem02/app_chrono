-- Migration 036: Backfill partenaires B2B existants
-- Objectif : pour chaque user qui a des commandes is_b2b_order = true sans partner_id,
--   1. créer une entrée dans partners
--   2. créer une entrée dans partner_users (role owner)
--   3. renseigner orders.partner_id pour leurs commandes historiques
--
-- ⚠️  AVANT D'EXÉCUTER :
--   Inspecter les utilisateurs concernés avec la requête de diagnostic ci-dessous,
--   puis adapter la section « données réelles » si tu veux personnaliser name / email / phone.
--
-- DIAGNOSTIC — coller dans Supabase SQL Editor pour voir les partenaires à migrer :
-- ─────────────────────────────────────────────────────────────────────────────────
-- SELECT
--   u.id           AS user_id,
--   u.email        AS user_email,
--   u.phone        AS user_phone,
--   COUNT(o.id)    AS nb_commandes_b2b
-- FROM orders o
-- JOIN users u ON u.id = o.user_id
-- WHERE o.is_b2b_order = true
--   AND o.partner_id IS NULL
-- GROUP BY u.id, u.email, u.phone
-- ORDER BY nb_commandes_b2b DESC;
-- ─────────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. Créer un partenaire pour chaque user B2B sans partner existant ───────────
--
-- Le nom du partenaire est initialisé à l'email (à renommer manuellement depuis
-- l'admin si besoin). La colonne `notes` enregistre le user_id d'origine.

WITH b2b_users AS (
  SELECT DISTINCT ON (o.user_id)
    o.user_id,
    u.email  AS user_email,
    u.phone  AS user_phone
  FROM public.orders o
  JOIN public.users u ON u.id = o.user_id
  WHERE o.is_b2b_order = true
    AND o.partner_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.partner_users pu WHERE pu.user_id = o.user_id
    )
),
inserted_partners AS (
  INSERT INTO public.partners (name, email, phone, plan, status, commission_rate, notes)
  SELECT
    COALESCE(NULLIF(TRIM(b.user_email), ''), 'Partenaire sans nom') AS name,
    b.user_email,
    b.user_phone,
    'none'                  AS plan,
    'active'                AS status,
    0.20                    AS commission_rate,   -- 20% Axe 1 par défaut
    'migré auto depuis user_id=' || b.user_id::text AS notes
  FROM b2b_users b
  RETURNING id, notes  -- notes contient le user_id d'origine
)

-- ─── 2. Créer les entrées partner_users (role owner) ─────────────────────────────
INSERT INTO public.partner_users (partner_id, user_id, role)
SELECT
  p.id AS partner_id,
  -- Extraire le user_id stocké dans notes
  REPLACE(p.notes, 'migré auto depuis user_id=', '')::uuid AS user_id,
  'owner' AS role
FROM inserted_partners p
ON CONFLICT (partner_id, user_id) DO NOTHING;

-- ─── 3. Backfill orders.partner_id ───────────────────────────────────────────────
--
-- Pour chaque commande B2B sans partner_id, on trouve le partner via partner_users.

UPDATE public.orders o
SET partner_id = pu.partner_id
FROM public.partner_users pu
WHERE pu.user_id  = o.user_id
  AND o.is_b2b_order = true
  AND o.partner_id IS NULL;

-- ─── 4. Vérification post-migration ──────────────────────────────────────────────
--
-- Ces requêtes doivent retourner 0 ligne si la migration est complète.

DO $$
DECLARE
  orphan_orders   INTEGER;
  orphan_users    INTEGER;
BEGIN
  -- Commandes B2B encore sans partner_id
  SELECT COUNT(*) INTO orphan_orders
  FROM public.orders
  WHERE is_b2b_order = true AND partner_id IS NULL;

  -- Users B2B sans entrée partner_users
  SELECT COUNT(DISTINCT o.user_id) INTO orphan_users
  FROM public.orders o
  WHERE o.is_b2b_order = true
    AND NOT EXISTS (
      SELECT 1 FROM public.partner_users pu WHERE pu.user_id = o.user_id
    );

  IF orphan_orders > 0 OR orphan_users > 0 THEN
    RAISE WARNING 'Migration incomplète : % commandes B2B sans partner_id, % users sans partner_users',
      orphan_orders, orphan_users;
  ELSE
    RAISE NOTICE 'Migration 036 OK — tous les partenaires existants ont été rattachés.';
  END IF;
END $$;

COMMIT;
