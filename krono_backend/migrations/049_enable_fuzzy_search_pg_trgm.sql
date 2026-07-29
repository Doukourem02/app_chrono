-- 049 — Tolérance aux fautes de frappe et aux accents sur la recherche globale du Dashboard
-- admin (admin_krono, barre de recherche du Header). Ajoute pg_trgm (similarité de trigrammes,
-- opérateur `%`, seuil par défaut 0.3) et unaccent, utilisés par getAdminGlobalSearch
-- (adminDashboardController.ts) pour les recherches qui ressemblent à un nom.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() est marquée STABLE (elle dépend du dictionnaire de recherche configuré en session),
-- donc inutilisable directement dans un index. On l'enveloppe dans une fonction IMMUTABLE qui
-- fixe le dictionnaire 'unaccent', pour pouvoir indexer dessus.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text AS
$$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE INDEX IF NOT EXISTS idx_users_first_name_trgm
  ON public.users USING gin (public.f_unaccent(LOWER(first_name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm
  ON public.users USING gin (public.f_unaccent(LOWER(last_name)) gin_trgm_ops);
