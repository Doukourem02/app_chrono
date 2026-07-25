-- Migration 037: Ajouter `inactive` au CHECK constraint de partners.status
-- Le backend utilise `inactive` depuis la migration 032 (deregister),
-- mais le constraint original ne l'incluait pas → toutes les mises à jour `inactive` échouaient silencieusement.

ALTER TABLE public.partners
  DROP CONSTRAINT IF EXISTS partners_status_check;

ALTER TABLE public.partners
  ADD CONSTRAINT partners_status_check
    CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));
