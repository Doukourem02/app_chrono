-- 016 (nom historique conservé, voir README_016_add_driver_client_info_to_transactions.md)
-- Colonnes dénormalisées livreur/client sur transactions + triggers de synchronisation.
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- le fichier original n'a jamais été committé, seuls colonnes/fonctions/triggers vivent en base.
--
-- IMPORTANT — malgré le préfixe "016" hérité du nom de fichier documenté dans le README
-- associé, cette migration dépend de la table public.transactions (créée en 021) et doit
-- donc être exécutée APRÈS 021_payment_messaging_history_profiles.sql, pas à la place de 016a/016b.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS driver_id UUID NULL,
  ADD COLUMN IF NOT EXISTS driver_first_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS driver_last_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS driver_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS driver_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_first_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_last_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS client_phone TEXT NULL;

CREATE OR REPLACE FUNCTION public.update_transaction_driver_client_info(p_transaction_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_order_driver_id UUID;
  v_order_user_id UUID;
  v_driver_first_name TEXT;
  v_driver_last_name TEXT;
  v_driver_email TEXT;
  v_driver_phone TEXT;
  v_client_first_name TEXT;
  v_client_last_name TEXT;
  v_client_email TEXT;
  v_client_phone TEXT;
BEGIN
  SELECT o.driver_id, o.user_id
  INTO v_order_driver_id, v_order_user_id
  FROM transactions t
  JOIN orders o ON t.order_id = o.id
  WHERE t.id = p_transaction_id;

  IF v_order_driver_id IS NULL AND v_order_user_id IS NULL THEN
    RETURN;
  END IF;

  IF v_order_driver_id IS NOT NULL THEN
    SELECT first_name, last_name, email, phone
    INTO v_driver_first_name, v_driver_last_name, v_driver_email, v_driver_phone
    FROM users
    WHERE id = v_order_driver_id;
  END IF;

  IF v_order_user_id IS NOT NULL THEN
    SELECT first_name, last_name, email, phone
    INTO v_client_first_name, v_client_last_name, v_client_email, v_client_phone
    FROM users
    WHERE id = v_order_user_id;
  END IF;

  UPDATE transactions
  SET
    driver_id = v_order_driver_id,
    driver_first_name = v_driver_first_name,
    driver_last_name = v_driver_last_name,
    driver_email = v_driver_email,
    driver_phone = v_driver_phone,
    client_first_name = v_client_first_name,
    client_last_name = v_client_last_name,
    client_email = v_client_email,
    client_phone = v_client_phone
  WHERE id = p_transaction_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_update_transaction_driver_client_info()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  PERFORM update_transaction_driver_client_info(NEW.id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_update_transactions_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  IF (TG_OP = 'UPDATE' AND (OLD.driver_id IS DISTINCT FROM NEW.driver_id OR OLD.user_id IS DISTINCT FROM NEW.user_id))
     OR TG_OP = 'INSERT' THEN
    PERFORM update_transaction_driver_client_info(t.id)
    FROM transactions t
    WHERE t.order_id = COALESCE(NEW.id, OLD.id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_transactions_update_driver_client_info ON public.transactions;
CREATE TRIGGER trg_transactions_update_driver_client_info
  AFTER INSERT OR UPDATE OF order_id ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_transaction_driver_client_info();

DROP TRIGGER IF EXISTS trg_orders_update_transactions_info ON public.orders;
CREATE TRIGGER trg_orders_update_transactions_info
  AFTER INSERT OR UPDATE OF driver_id, user_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_transactions_on_order_change();

-- Pour initialiser les transactions déjà existantes après application sur une base qui en a :
-- SELECT public.initialize_transactions_driver_client_info();
CREATE OR REPLACE FUNCTION public.initialize_transactions_driver_client_info()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_transaction RECORD;
BEGIN
  FOR v_transaction IN
    SELECT id FROM transactions
  LOOP
    PERFORM update_transaction_driver_client_info(v_transaction.id);
  END LOOP;

  RAISE NOTICE 'Initialisation terminée: toutes les transactions ont été mises à jour';
END;
$function$;
