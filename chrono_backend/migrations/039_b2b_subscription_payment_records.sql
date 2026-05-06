-- Migration 039: Paiements d'abonnements et factures B2B
-- Ajoute les métadonnées de règlement manuel préparant l'intégration Wave / Orange Money / MTN.

ALTER TABLE public.partner_subscriptions
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_account TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount INTEGER,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

ALTER TABLE public.partner_invoices
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_account TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount INTEGER,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_subscriptions_payment_method_type_check'
  ) THEN
    ALTER TABLE public.partner_subscriptions
      ADD CONSTRAINT partner_subscriptions_payment_method_type_check
      CHECK (
        payment_method_type IS NULL OR payment_method_type IN (
          'wave',
          'orange_money',
          'mtn_money',
          'cash',
          'bank_transfer',
          'other'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_invoices_payment_method_type_check'
  ) THEN
    ALTER TABLE public.partner_invoices
      ADD CONSTRAINT partner_invoices_payment_method_type_check
      CHECK (
        payment_method_type IS NULL OR payment_method_type IN (
          'wave',
          'orange_money',
          'mtn_money',
          'cash',
          'bank_transfer',
          'other'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_subscriptions_payment_amount_check'
  ) THEN
    ALTER TABLE public.partner_subscriptions
      ADD CONSTRAINT partner_subscriptions_payment_amount_check
      CHECK (payment_amount IS NULL OR payment_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_invoices_payment_amount_check'
  ) THEN
    ALTER TABLE public.partner_invoices
      ADD CONSTRAINT partner_invoices_payment_amount_check
      CHECK (payment_amount IS NULL OR payment_amount >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_partner_subs_paid_at
  ON public.partner_subscriptions(paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_invoices_paid_at
  ON public.partner_invoices(paid_at DESC);
