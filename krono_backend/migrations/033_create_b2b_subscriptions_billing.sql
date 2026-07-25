-- Migration 033: Tables billing B2B — partner_subscriptions, partner_usage, partner_invoices
-- Note: "invoices" est déjà prise (factures par livraison) → on utilise "partner_invoices"

-- ─── partner_subscriptions ────────────────────────────────────────────────────
-- Abonnement mensuel d'un partenaire (Phase 1 : activation manuelle par admin)
CREATE TABLE IF NOT EXISTS public.partner_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id             UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'business')),
  monthly_price          INTEGER NOT NULL,             -- en FCFA
  included_orders        INTEGER,                      -- NULL = illimité (plan Business)
  excess_commission_rate DECIMAL(5,4) NOT NULL,        -- ex: 0.15 = 15% sur dépassement quota
  starts_at              TIMESTAMPTZ NOT NULL,
  ends_at                TIMESTAMPTZ,                  -- nullable si politique sans fin fixe
  cancelled_at           TIMESTAMPTZ,                  -- résiliation explicite
  next_renewal_at        TIMESTAMPTZ,                  -- optionnel, renouvellement auto (Phase 2)
  payment_status         TEXT NOT NULL DEFAULT 'pending_payment'
                           CHECK (payment_status IN (
                             'trial', 'pending_payment', 'active', 'past_due', 'cancelled'
                           )),
  -- Phase 1 : is_active = true après validation admin une fois paiement manuel constaté
  -- is_active = false tant que payment_status != 'active' (ou 'trial' selon politique produit)
  is_active              BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_subs_partner_id     ON public.partner_subscriptions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_subs_payment_status ON public.partner_subscriptions(payment_status);
CREATE INDEX IF NOT EXISTS idx_partner_subs_is_active      ON public.partner_subscriptions(is_active);
-- Index pour trouver l'abonnement actif courant d'un partenaire
CREATE INDEX IF NOT EXISTS idx_partner_subs_active_lookup
  ON public.partner_subscriptions(partner_id, is_active, starts_at DESC);

CREATE OR REPLACE FUNCTION update_partner_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_partner_subscriptions_updated_at
  BEFORE UPDATE ON public.partner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_partner_subscriptions_updated_at();

ALTER TABLE public.partner_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on partner_subscriptions"
  ON public.partner_subscriptions FOR ALL USING (true) WITH CHECK (true);


-- ─── partner_usage ────────────────────────────────────────────────────────────
-- Compteur mensuel de courses B2B par partenaire (pour quota + dépassement)
CREATE TABLE IF NOT EXISTS public.partner_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  month             DATE NOT NULL,                     -- ex : 2026-05-01 (1er du mois)
  deliveries_count  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(partner_id, month)
);

CREATE INDEX IF NOT EXISTS idx_partner_usage_partner_month
  ON public.partner_usage(partner_id, month DESC);

ALTER TABLE public.partner_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on partner_usage"
  ON public.partner_usage FOR ALL USING (true) WITH CHECK (true);


-- ─── partner_invoices ─────────────────────────────────────────────────────────
-- Facture mensuelle B2B = forfait abonnement + dépassements (sans doublon avec commissions temps réel)
-- Distincte de "invoices" qui est la table de factures par livraison déjà existante
CREATE TABLE IF NOT EXISTS public.partner_invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,                       -- total dû en FCFA pour la période
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'paid', 'overdue')),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_invoices_partner_id ON public.partner_invoices(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_status     ON public.partner_invoices(status);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_period     ON public.partner_invoices(period_start DESC);

CREATE OR REPLACE FUNCTION update_partner_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_partner_invoices_updated_at
  BEFORE UPDATE ON public.partner_invoices
  FOR EACH ROW EXECUTE FUNCTION update_partner_invoices_updated_at();

ALTER TABLE public.partner_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on partner_invoices"
  ON public.partner_invoices FOR ALL USING (true) WITH CHECK (true);
