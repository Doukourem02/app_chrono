-- 042 — Verrou + idempotence sur la déduction de commission
-- Corrige docs/audit_krono.md #5 : deduct_commission() lisait le solde par simple
-- SELECT (pas de FOR UPDATE) puis le réécrivait -> deux déductions concurrentes pour
-- le même livreur pouvaient produire un "lost update". Aucune contrainte n'empêchait
-- non plus une double déduction pour la même commande.
-- Idempotent : CREATE OR REPLACE FUNCTION + IF NOT EXISTS.

-- Empêche toute deuxième transaction 'deduction' pour la même commande.
-- Si des doublons existent déjà en prod, cette commande échouera : diagnostiquer
-- et nettoyer manuellement avant d'appliquer cette migration, par ex. :
-- SELECT order_id, COUNT(*) FROM public.commission_transactions
--   WHERE transaction_type = 'deduction' GROUP BY order_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS commission_transactions_order_deduction_uidx
  ON public.commission_transactions(order_id)
  WHERE transaction_type = 'deduction';

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
    WHERE driver_id = p_driver_id
    FOR UPDATE;

    IF v_balance_id IS NULL THEN
        SELECT initialize_commission_balance(p_driver_id, COALESCE(p_commission_rate, 10.00)) INTO v_balance_id;
        SELECT balance, commission_rate INTO v_balance_before, v_actual_rate
        FROM public.commission_balance
        WHERE id = v_balance_id
        FOR UPDATE;
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

    -- La contrainte unique commission_transactions_order_deduction_uidx fait
    -- échouer cet INSERT (et donc toute la transaction) en cas de double
    -- déduction concurrente pour la même commande.
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
