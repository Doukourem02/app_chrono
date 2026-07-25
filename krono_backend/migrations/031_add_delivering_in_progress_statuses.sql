-- Migration 031 : Ajouter 'delivering' et 'in_progress' à l'enum order_status
--
-- Contexte : L'app utilise ces statuts côté socket mais l'enum PostgreSQL ne les connaissait pas.
-- 'delivering' était mappé vers 'picked_up' dans updateOrderStatus — ce mapping est maintenant retiré.
-- 'in_progress' correspond à "livreur arrivé au point de retrait".

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivering';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_progress';
