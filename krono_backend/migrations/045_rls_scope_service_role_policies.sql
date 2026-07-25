-- 045 — Restreint les policies "Service role full access" au rôle service_role
-- Audit sécurité Supabase (advisor rls_policy_always_true, 2026-07-24) : ces 10 policies
-- ALL / USING(true) / WITH CHECK(true) n'avaient aucune clause TO, donc PostgreSQL les
-- appliquait à PUBLIC (tout rôle, y compris anon et authenticated) au lieu du seul
-- service_role prévu. Combinées en OR avec les policies plus restrictives existantes,
-- elles annulaient toute la protection RLS sur ces tables pour n'importe quel client
-- utilisant la clé anon. Vérifié avant migration : aucune policy dupliquée à ces noms.
--
-- Cas particulier `partners` : vérifié qu'aucune autre policy SELECT n'existait sur cette
-- table. Deux usages client (clé anon, rôle authenticated) en dépendaient directement :
-- - admin_krono/lib/partnerApiService.ts verifyAccess() lit partners.plan pour autoriser
--   l'accès au portail partenaire (admin_krono/app/(partner)/partner/[partnerId]/layout.tsx)
-- - admin_krono/app/(dashboard)/partners/page.tsx et [id]/page.tsx écoutent les
--   postgres_changes Realtime sur la table partners (respecte aussi RLS)
-- D'où l'ajout d'une policy SELECT dédiée ci-dessous, sinon ces deux usages cassent.

ALTER POLICY "Service role full access on batch_orders" ON public.batch_orders TO service_role;
ALTER POLICY "Service role full access on delivery_batches" ON public.delivery_batches TO service_role;
ALTER POLICY "Service role full access on partner_audit_logs" ON public.partner_audit_logs TO service_role;
ALTER POLICY "Service role full access on partner_drivers" ON public.partner_drivers TO service_role;
ALTER POLICY "Service role full access on partner_invoices" ON public.partner_invoices TO service_role;
ALTER POLICY "Service role full access on partner_subscriptions" ON public.partner_subscriptions TO service_role;
ALTER POLICY "Service role full access on partner_usage" ON public.partner_usage TO service_role;
ALTER POLICY "Service role full access on partner_users" ON public.partner_users TO service_role;
ALTER POLICY "Service role full access on partners" ON public.partners TO service_role;
ALTER POLICY "Service role full access" ON public.payment_disputes TO service_role;

CREATE POLICY "Partner members and admins can view partners"
  ON public.partners FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.partner_users pu
      WHERE pu.partner_id = partners.id AND pu.user_id = auth.uid()
    )
  );
