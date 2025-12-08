-- Script SQL pour vérifier l'état des paiements différés dans la base de données
-- À exécuter dans Supabase SQL Editor

-- 1. Compter les transactions différées par statut
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM transactions
WHERE payment_method_type = 'deferred'
  AND payer_type = 'client'
GROUP BY status
ORDER BY status;

-- 2. Afficher les détails des transactions différées non payées
SELECT 
  t.id as transaction_id,
  t.order_id,
  t.user_id,
  t.amount,
  t.status,
  t.created_at,
  t.updated_at,
  o.status as order_status,
  o.completed_at,
  CASE 
    WHEN o.completed_at IS NOT NULL THEN 'Commande complétée'
    ELSE 'Commande non complétée'
  END as order_completion_status
FROM transactions t
LEFT JOIN orders o ON t.order_id = o.id
WHERE t.payment_method_type = 'deferred'
  AND t.payer_type = 'client'
  AND t.status IN ('delayed', 'pending')
ORDER BY t.created_at DESC;

-- 3. Compter les transactions différées par mois
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  status
FROM transactions
WHERE payment_method_type = 'deferred'
  AND payer_type = 'client'
GROUP BY DATE_TRUNC('month', created_at), status
ORDER BY month DESC, status;

