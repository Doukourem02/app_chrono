-- 050 — Corrige l'alerte sécurité Supabase "Function Search Path Mutable" sur f_unaccent
-- (introduite par la migration 049). Fixe explicitement le search_path pour éviter qu'un
-- rôle malveillant ne puisse détourner la résolution de fonctions non qualifiées.

ALTER FUNCTION public.f_unaccent(text) SET search_path = public, pg_catalog;
