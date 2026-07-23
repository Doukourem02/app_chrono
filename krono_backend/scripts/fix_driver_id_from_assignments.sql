-- Script pour remplir driver_id dans orders à partir de order_assignments
-- Pour les commandes completed qui n'ont pas de driver_id mais qui ont une entrée dans order_assignments

-- Mettre à jour les commandes completed qui ont un driver_id dans order_assignments
UPDATE orders o
SET driver_id = oa.driver_id
FROM order_assignments oa
WHERE o.id = oa.order_id
  AND o.status = 'completed'
  AND o.driver_id IS NULL
  AND oa.driver_id IS NOT NULL
  AND oa.accepted_at IS NOT NULL;  -- Seulement si la commande a été acceptée

-- Afficher le résultat
SELECT 
  COUNT(*) as orders_updated
FROM orders
WHERE status = 'completed'
  AND driver_id IS NOT NULL;

-- Afficher les commandes completed qui n'ont toujours pas de driver_id
SELECT 
  id,
  status,
  driver_id,
  completed_at,
  created_at
FROM orders
WHERE status = 'completed'
  AND driver_id IS NULL
ORDER BY completed_at DESC;

