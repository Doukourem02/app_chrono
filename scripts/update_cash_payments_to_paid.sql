-- Script SQL pour mettre à jour tous les paiements en espèces (cash) en pending vers paid
-- À exécuter dans Supabase SQL Editor
-- 
-- Ce script met à jour :
-- 1. Les transactions avec payment_method_type = 'cash' et status = 'pending'
-- 2. Les commandes (orders) correspondantes si les colonnes de paiement existent
--
-- IMPORTANT : Ce script met à jour uniquement les paiements en espèces par le client
-- qui sont en pending. Les paiements différés et autres méthodes ne sont pas affectés.

BEGIN;

-- Afficher le nombre de transactions qui seront mises à jour (pour vérification)
DO $$
DECLARE
  transactions_count INTEGER;
  orders_to_update_count INTEGER;
BEGIN
  -- Compter les transactions à mettre à jour
  SELECT COUNT(*) INTO transactions_count
  FROM transactions
  WHERE payment_method_type = 'cash'
    AND payer_type = 'client'
    AND status = 'pending';
  
  -- Compter les commandes correspondantes (si les colonnes existent)
  SELECT COUNT(*) INTO orders_to_update_count
  FROM orders o
  INNER JOIN transactions t ON o.id = t.order_id
  WHERE t.payment_method_type = 'cash'
    AND t.payer_type = 'client'
    AND t.status = 'pending';
  
  RAISE NOTICE 'Nombre de transactions à mettre à jour : %', transactions_count;
  RAISE NOTICE 'Nombre de commandes concernées : %', orders_to_update_count;
END $$;

-- 1. Mettre à jour les transactions avec paiement en espèces en pending
UPDATE transactions
SET 
  status = 'paid',
  updated_at = NOW()
WHERE payment_method_type = 'cash'
  AND payer_type = 'client'
  AND status = 'pending';

-- 2. Mettre à jour les commandes correspondantes (si les colonnes existent)
-- On vérifie d'abord si les colonnes existent avant de les mettre à jour
DO $$
BEGIN
  -- Vérifier si la colonne payment_status existe dans orders
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_status'
  ) THEN
    -- Mettre à jour payment_status dans orders pour les commandes avec transactions cash payées
    UPDATE orders o
    SET 
      payment_status = 'paid',
      updated_at = NOW()
    FROM transactions t
    WHERE o.id = t.order_id
      AND t.payment_method_type = 'cash'
      AND t.payer_type = 'client'
      AND t.status = 'paid'
      AND (
        -- Mettre à jour seulement si payment_status est pending ou NULL
        o.payment_status IS NULL 
        OR o.payment_status = 'pending'
      );
    
    RAISE NOTICE '✅ Colonnes de paiement trouvées dans orders - Mise à jour effectuée';
  ELSE
    RAISE NOTICE '⚠️ Colonnes de paiement non trouvées dans orders - Seules les transactions ont été mises à jour';
  END IF;
END $$;

-- Afficher le résultat final
DO $$
DECLARE
  transactions_updated INTEGER;
BEGIN
  -- Compter les transactions mises à jour
  SELECT COUNT(*) INTO transactions_updated
  FROM transactions
  WHERE payment_method_type = 'cash'
    AND payer_type = 'client'
    AND status = 'paid';
  
  RAISE NOTICE '✅ Mise à jour terminée !';
  RAISE NOTICE 'Transactions avec paiement cash payé : %', transactions_updated;
END $$;

COMMIT;

-- Vérification finale : Afficher un échantillon des transactions mises à jour
SELECT 
  t.id as transaction_id,
  t.order_id,
  t.user_id,
  t.payment_method_type,
  t.payer_type,
  t.status as transaction_status,
  t.amount,
  t.created_at,
  t.updated_at,
  o.status as order_status
FROM transactions t
LEFT JOIN orders o ON t.order_id = o.id
WHERE t.payment_method_type = 'cash'
  AND t.payer_type = 'client'
  AND t.status = 'paid'
ORDER BY t.updated_at DESC
LIMIT 10;

