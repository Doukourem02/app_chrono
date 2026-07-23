-- Migration pour ajouter la colonne driver_id à la table orders si elle n'existe pas
-- Cette migration est nécessaire car la colonne driver_id peut être absente dans certaines versions de la base de données

-- Ajouter la colonne driver_id si elle n'existe pas déjà
DO $$ 
BEGIN
  -- Vérifier si la colonne driver_id existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'driver_id'
  ) THEN
    -- Ajouter la colonne driver_id
    ALTER TABLE orders 
    ADD COLUMN driver_id UUID REFERENCES users(id) ON DELETE SET NULL;
    
    -- Créer l'index pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
    
    -- Créer l'index composite pour les requêtes fréquentes
    CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders(driver_id, status);
    
    RAISE NOTICE 'Colonne driver_id ajoutée à la table orders';
  ELSE
    RAISE NOTICE 'Colonne driver_id existe déjà dans la table orders';
  END IF;
END $$;

-- Commentaire
COMMENT ON COLUMN orders.driver_id IS 'ID du livreur qui a accepté et complété la commande';

