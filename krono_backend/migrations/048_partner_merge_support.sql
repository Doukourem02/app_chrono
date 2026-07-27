-- 048 — Support de la fusion de deux fiches partenaire (docs/taches.md, règles validées 2026-07-27)
-- La fiche fusionnée est archivée (status = 'merged' + pointeur vers la fiche survivante),
-- jamais supprimée physiquement : l'historique (commandes, factures, tournées) reste intact.

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS merged_into_partner_id UUID REFERENCES public.partners(id);

ALTER TABLE public.partners
  DROP CONSTRAINT IF EXISTS partners_status_check;

ALTER TABLE public.partners
  ADD CONSTRAINT partners_status_check
    CHECK (status IN ('active', 'inactive', 'suspended', 'pending', 'merged'));

ALTER TABLE public.partner_audit_logs
  DROP CONSTRAINT IF EXISTS partner_audit_logs_action_check;

ALTER TABLE public.partner_audit_logs
  ADD CONSTRAINT partner_audit_logs_action_check
    CHECK (action IN ('status_change', 'delete', 'merge'));

CREATE INDEX IF NOT EXISTS idx_partners_merged_into
  ON public.partners(merged_into_partner_id)
  WHERE merged_into_partner_id IS NOT NULL;
