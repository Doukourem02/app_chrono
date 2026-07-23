-- Supprimer le doublon sur la table ratings
-- "Users can insert own ratings" est un doublon de "Users can create own ratings"

DROP POLICY IF EXISTS "Users can insert own ratings" ON public.ratings;

-- Vérification
SELECT 
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'ratings'
AND cmd = 'INSERT'
ORDER BY policyname;

