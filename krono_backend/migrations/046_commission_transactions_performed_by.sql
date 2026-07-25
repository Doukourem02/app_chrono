-- 046 — Traçabilité des recharges manuelles de commission
-- Corrige docs/correction_admin_krono.md (point 1) : une recharge manuelle par un
-- admin était déjà tracée dans commission_transactions (montant, solde avant/après,
-- méthode, description) mais rien n'enregistrait QUEL compte admin l'avait faite.

ALTER TABLE public.commission_transactions
  ADD COLUMN IF NOT EXISTS performed_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.commission_transactions.performed_by IS
  'Compte admin ayant déclenché une recharge/action manuelle (NULL pour les déductions/remboursements automatiques liés à une commande)';

-- Reprend fidèlement le corps de la fonction d'origine (migration 016) :
-- même logique de solde/suspension, seul ajout = le paramètre p_performed_by
-- et la colonne correspondante dans l'INSERT. Aucun autre comportement changé.
CREATE OR REPLACE FUNCTION public.recharge_commission_balance(
  p_driver_id UUID,
  p_amount NUMERIC,
  p_payment_method VARCHAR DEFAULT 'admin',
  p_payment_provider VARCHAR DEFAULT NULL,
  p_payment_transaction_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
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
        payment_method, payment_provider, payment_transaction_id, description, performed_by
    )
    VALUES (
        p_driver_id, 'recharge', p_amount, v_balance_before, v_balance_after,
        p_payment_method, p_payment_provider, p_payment_transaction_id, p_description, p_performed_by
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$function$;
