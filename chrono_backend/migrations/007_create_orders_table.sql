-- Table pour persister les commandes (orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pickup JSONB NOT NULL,
  dropoff JSONB NOT NULL,
  price INTEGER NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('moto', 'vehicule', 'cargo')),
  distance DECIMAL(10, 2),
  estimated_duration TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'enroute', 'picked_up', 'completed', 'declined', 'cancelled')) DEFAULT 'pending',
  proof JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders(driver_id, status);

-- Commentaires
COMMENT ON TABLE orders IS 'Commandes de livraison avec historique complet';
COMMENT ON COLUMN orders.pickup IS 'Coordonnées et adresse de prise en charge (JSON)';
COMMENT ON COLUMN orders.dropoff IS 'Coordonnées et adresse de livraison (JSON)';
COMMENT ON COLUMN orders.proof IS 'Preuve de livraison (photo/signature) stockée en JSON';

