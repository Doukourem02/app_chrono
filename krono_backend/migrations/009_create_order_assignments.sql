-- Table pour suivre les attributions de commandes aux livreurs
CREATE TABLE IF NOT EXISTS order_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_order_driver UNIQUE (order_id, driver_id)
);

-- Index pour accélérer les requêtes par driver et par order
CREATE INDEX IF NOT EXISTS idx_order_assignments_driver ON order_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_order_assignments_order ON order_assignments(order_id);

-- Trigger simple pour updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_assignments_updated_at ON order_assignments;
CREATE TRIGGER trg_order_assignments_updated_at
BEFORE UPDATE ON order_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE order_assignments IS 'Historique des tentatives d\'attribution de commandes aux livreurs';

