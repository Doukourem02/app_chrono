-- 016a — Système de commission prépayée pour livreurs partenaires
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery,
-- ref gglpozefhtzgakivvfxm) : le fichier original n'a jamais été committé dans ce repo,
-- seule la table/les fonctions vivent en base. Contenu vérifié colonne par colonne et
-- fonction par fonction contre la prod — pas une reconstitution approximative.
-- Idempotent (IF NOT EXISTS) pour rester safe sur une base qui a déjà ce schéma.

CREATE TABLE IF NOT EXISTS public.commission_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0.00,
  is_suspended BOOLEAN DEFAULT false,
  suspended_at TIMESTAMPTZ NULL,
  suspended_reason TEXT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT commission_balance_driver_id_key UNIQUE (driver_id)
);

CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL
    CHECK (transaction_type IN ('recharge', 'deduction', 'refund')),
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_method VARCHAR(50) NULL
    CHECK (payment_method IN ('mobile_money', 'admin', 'cash')),
  payment_provider VARCHAR(50) NULL,
  payment_transaction_id TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_transaction_type CHECK (
    (transaction_type = 'recharge' AND order_id IS NULL)
    OR (transaction_type IN ('deduction', 'refund') AND order_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_commission_transactions_driver_id ON public.commission_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_order_id ON public.commission_transactions(order_id);

COMMENT ON TABLE public.commission_balance IS 'Soldes commission prépayée pour les livreurs partenaires';
COMMENT ON TABLE public.commission_transactions IS 'Historique des transactions commission (recharges, déductions, remboursements)';

-- Initialise (ou renvoie) le solde commission d'un livreur.
CREATE OR REPLACE FUNCTION public.initialize_commission_balance(
  p_driver_id UUID,
  p_commission_rate NUMERIC DEFAULT 10.00
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
    v_balance_id UUID;
BEGIN
    SELECT id INTO v_balance_id
    FROM public.commission_balance
    WHERE driver_id = p_driver_id;

    IF v_balance_id IS NULL THEN
        INSERT INTO public.commission_balance (driver_id, balance, commission_rate)
        VALUES (p_driver_id, 0.00, p_commission_rate)
        RETURNING id INTO v_balance_id;
    END IF;

    RETURN v_balance_id;
END;
$function$;

-- Prélève la commission d'une livraison completed sur le solde du livreur partenaire.
CREATE OR REPLACE FUNCTION public.deduct_commission(
  p_driver_id UUID,
  p_order_id UUID,
  p_order_price NUMERIC,
  p_commission_rate NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
    v_balance_id UUID;
    v_balance_before DECIMAL;
    v_balance_after DECIMAL;
    v_commission_amount DECIMAL;
    v_actual_rate DECIMAL;
    v_transaction_id UUID;
    v_is_suspended BOOLEAN;
BEGIN
    SELECT id, balance, is_suspended, commission_rate
    INTO v_balance_id, v_balance_before, v_is_suspended, v_actual_rate
    FROM public.commission_balance
    WHERE driver_id = p_driver_id;

    IF v_balance_id IS NULL THEN
        SELECT initialize_commission_balance(p_driver_id, COALESCE(p_commission_rate, 10.00)) INTO v_balance_id;
        SELECT balance, commission_rate INTO v_balance_before, v_actual_rate
        FROM public.commission_balance
        WHERE id = v_balance_id;
    END IF;

    v_actual_rate := COALESCE(p_commission_rate, v_actual_rate);
    v_commission_amount := (p_order_price * v_actual_rate) / 100.00;

    IF v_balance_before < v_commission_amount THEN
        RAISE EXCEPTION 'Solde commission insuffisant. Solde: %, Commission requise: %',
            v_balance_before, v_commission_amount;
    END IF;

    v_balance_after := v_balance_before - v_commission_amount;

    UPDATE public.commission_balance
    SET balance = v_balance_after,
        is_suspended = CASE WHEN v_balance_after <= 0 THEN true ELSE is_suspended END,
        suspended_at = CASE WHEN v_balance_after <= 0 AND NOT is_suspended THEN NOW() ELSE suspended_at END,
        suspended_reason = CASE WHEN v_balance_after <= 0 AND NOT is_suspended THEN 'Solde épuisé' ELSE suspended_reason END
    WHERE id = v_balance_id;

    INSERT INTO public.commission_transactions (
        driver_id, transaction_type, amount, balance_before, balance_after, order_id, description
    )
    VALUES (
        p_driver_id, 'deduction', v_commission_amount, v_balance_before, v_balance_after, p_order_id,
        format('Commission %s%% sur commande %s', v_actual_rate, p_order_id)
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$function$;

-- Recharge (admin ou paiement) le solde commission d'un livreur.
CREATE OR REPLACE FUNCTION public.recharge_commission_balance(
  p_driver_id UUID,
  p_amount NUMERIC,
  p_payment_method VARCHAR DEFAULT 'admin',
  p_payment_provider VARCHAR DEFAULT NULL,
  p_payment_transaction_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
    v_balance_id UUID;
    v_balance_before DECIMAL;
    v_balance_after DECIMAL;
    v_transaction_id UUID;
BEGIN
    SELECT initialize_commission_balance(p_driver_id) INTO v_balance_id;

    SELECT balance INTO v_balance_before
    FROM public.commission_balance
    WHERE id = v_balance_id;

    v_balance_after := v_balance_before + p_amount;

    UPDATE public.commission_balance
    SET balance = v_balance_after,
        is_suspended = false,
        suspended_at = NULL,
        suspended_reason = NULL
    WHERE id = v_balance_id;

    INSERT INTO public.commission_transactions (
        driver_id, transaction_type, amount, balance_before, balance_after,
        payment_method, payment_provider, payment_transaction_id, description
    )
    VALUES (
        p_driver_id, 'recharge', p_amount, v_balance_before, v_balance_after,
        p_payment_method, p_payment_provider, p_payment_transaction_id, p_description
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$function$;

ALTER TABLE public.commission_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
