-- 043 — Traçabilité des changements de statut partenaire
-- Corrige docs/taches.md #6 (audit_krono.md) : aucune trace des désactivations/
-- réactivations/suspensions de partenaire n'était conservée (actor, ancien/nouveau
-- statut, raison). Table append-only, écrite en best-effort depuis
-- partnerCrudController.ts (updatePartnerStatus, activatePartner) — un échec
-- d'insertion de log ne doit jamais faire échouer la requête admin principale.

CREATE TABLE IF NOT EXISTS public.partner_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  admin_id     UUID NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('status_change', 'delete')),
  old_status   TEXT,
  new_status   TEXT,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_audit_logs_partner_id
  ON public.partner_audit_logs(partner_id, created_at DESC);

ALTER TABLE public.partner_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on partner_audit_logs"
  ON public.partner_audit_logs FOR ALL USING (true) WITH CHECK (true);
