-- Migration: Création des tables pour la gestion de flotte
-- Exécutez ce script dans Supabase Dashboard → SQL Editor
-- 
-- Ce script crée toutes les tables nécessaires pour :
-- 1. Gérer la flotte de véhicules
-- 2. Suivre les coûts (carburant/électricité + maintenance)
-- 3. Calculer le ROI par véhicule
-- 4. Gérer les documents légaux
-- 5. Suivre le kilométrage

-- ============================================
-- Table principale : Gestion de la flotte
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_plate TEXT NOT NULL UNIQUE, -- Plaque d'immatriculation (clé unique)
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('moto', 'vehicule', 'cargo')),
  vehicle_brand TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  fuel_type TEXT CHECK (fuel_type IN ('essence', 'gazole', 'electrique', 'hybride')),
  current_driver_id UUID REFERENCES driver_profiles(user_id) ON DELETE SET NULL, -- Livreur actuel
  purchase_date DATE, -- Date d'achat
  purchase_price DECIMAL, -- Prix d'achat
  current_odometer INTEGER DEFAULT 0, -- Kilométrage actuel
  last_odometer_update TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired', 'reserved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_plate ON fleet_vehicles(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_driver ON fleet_vehicles(current_driver_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_status ON fleet_vehicles(status);

COMMENT ON TABLE fleet_vehicles IS 'Gestion de la flotte de véhicules de Chrono';
COMMENT ON COLUMN fleet_vehicles.vehicle_plate IS 'Plaque d''immatriculation (unique)';
COMMENT ON COLUMN fleet_vehicles.fuel_type IS 'Type de carburant : essence, gazole, electrique, hybride';
COMMENT ON COLUMN fleet_vehicles.current_odometer IS 'Kilométrage actuel du véhicule';

-- ============================================
-- Table : Suivi des coûts de carburant/électricité
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_plate TEXT NOT NULL REFERENCES fleet_vehicles(vehicle_plate) ON DELETE CASCADE,
  driver_id UUID REFERENCES driver_profiles(user_id) ON DELETE SET NULL,
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('essence', 'gazole', 'electric', 'hybride')),
  quantity DECIMAL NOT NULL, -- Litres pour essence/gazole, kWh pour électrique
  unit_price DECIMAL NOT NULL, -- Prix par litre ou par kWh
  total_cost DECIMAL NOT NULL, -- Coût total (quantity × unit_price)
  odometer_before INTEGER,
  odometer_after INTEGER,
  distance_km DECIMAL, -- Distance parcourue depuis dernier plein
  consumption_per_100km DECIMAL, -- Consommation calculée (L/100km ou kWh/100km)
  station_location TEXT, -- Lieu de ravitaillement
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID -- Admin qui a enregistré (référence users.id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle ON vehicle_fuel_logs(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_date ON vehicle_fuel_logs(created_at);

COMMENT ON TABLE vehicle_fuel_logs IS 'Historique des ravitaillements (carburant/électricité)';
COMMENT ON COLUMN vehicle_fuel_logs.quantity IS 'Quantité : litres pour essence/gazole, kWh pour électrique';
COMMENT ON COLUMN vehicle_fuel_logs.consumption_per_100km IS 'Consommation calculée automatiquement';

-- ============================================
-- Table : Maintenance des véhicules
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_plate TEXT NOT NULL REFERENCES fleet_vehicles(vehicle_plate) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN (
    'routine', -- Révision périodique
    'repair', -- Réparation
    'inspection', -- Contrôle technique
    'insurance', -- Assurance
    'registration', -- Carte grise
    'tire_change', -- Changement pneus
    'battery_replacement', -- Changement batterie (électrique)
    'other' -- Autre
  )),
  description TEXT,
  scheduled_date DATE,
  completed_date DATE,
  odometer_at_maintenance INTEGER, -- Kilométrage au moment de la maintenance
  cost DECIMAL DEFAULT 0, -- Coût de la maintenance
  service_provider TEXT, -- Garage/prestataire
  invoice_url TEXT, -- URL facture (Supabase Storage)
  documents JSONB, -- Documents associés (URLs, métadonnées)
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'overdue', 'cancelled')),
  notes TEXT,
  created_by UUID, -- Admin qui a créé (référence users.id)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON vehicle_maintenance(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON vehicle_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled ON vehicle_maintenance(scheduled_date);

COMMENT ON TABLE vehicle_maintenance IS 'Historique et planification des maintenances';
COMMENT ON COLUMN vehicle_maintenance.odometer_at_maintenance IS 'Kilométrage au moment de la maintenance';

-- ============================================
-- Table : Documents légaux (carte grise, assurance, permis)
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_plate TEXT NOT NULL REFERENCES fleet_vehicles(vehicle_plate) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'carte_grise', -- Carte grise
    'assurance', -- Assurance
    'controle_technique', -- Contrôle technique
    'permis_conduire' -- Permis du livreur
  )),
  document_number TEXT, -- Numéro du document
  issue_date DATE, -- Date d'émission
  expiry_date DATE, -- Date d'expiration
  document_url TEXT, -- URL du document (Supabase Storage)
  is_valid BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Un seul document de chaque type par véhicule
  UNIQUE(vehicle_plate, document_type)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_documents_vehicle ON vehicle_documents(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON vehicle_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_type ON vehicle_documents(document_type);

COMMENT ON TABLE vehicle_documents IS 'Documents légaux des véhicules (carte grise, assurance, contrôle technique, permis)';
COMMENT ON COLUMN vehicle_documents.expiry_date IS 'Date d''expiration pour alertes automatiques';

-- ============================================
-- Table : Logs de kilométrage après chaque livraison
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_mileage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  vehicle_plate TEXT NOT NULL REFERENCES fleet_vehicles(vehicle_plate) ON DELETE CASCADE,
  driver_id UUID REFERENCES driver_profiles(user_id) ON DELETE SET NULL,
  distance_km DECIMAL NOT NULL, -- Distance de cette livraison
  odometer_before INTEGER, -- Kilométrage avant la livraison
  odometer_after INTEGER, -- Kilométrage après la livraison
  fuel_consumed DECIMAL, -- Carburant consommé (calculé selon consommation moyenne)
  battery_used_percent INTEGER, -- Batterie utilisée % (si électrique, 0-100)
  revenue_generated DECIMAL, -- Revenu généré par cette livraison (price_cfa de la commande)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_mileage_logs_vehicle ON delivery_mileage_logs(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_order ON delivery_mileage_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_date ON delivery_mileage_logs(created_at);

COMMENT ON TABLE delivery_mileage_logs IS 'Logs de kilométrage et revenus après chaque livraison';
COMMENT ON COLUMN delivery_mileage_logs.fuel_consumed IS 'Carburant consommé calculé selon consommation moyenne du véhicule';

-- ============================================
-- Table : Revenus et coûts par véhicule (vue agrégée)
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_financial_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_plate TEXT NOT NULL REFERENCES fleet_vehicles(vehicle_plate) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue DECIMAL DEFAULT 0, -- Revenus générés (somme des commandes)
  total_fuel_cost DECIMAL DEFAULT 0, -- Coût carburant/électricité
  total_maintenance_cost DECIMAL DEFAULT 0, -- Coût maintenance
  total_distance_km DECIMAL DEFAULT 0, -- Distance totale
  total_deliveries INTEGER DEFAULT 0, -- Nombre de livraisons
  net_profit DECIMAL DEFAULT 0, -- Revenus - coûts
  roi_percentage DECIMAL, -- ROI en % : ((revenus - coûts) / coûts) × 100
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Un seul résumé par véhicule et période
  UNIQUE(vehicle_plate, period_start, period_end)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_financial_summary_vehicle ON vehicle_financial_summary(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_financial_summary_period ON vehicle_financial_summary(period_start, period_end);

COMMENT ON TABLE vehicle_financial_summary IS 'Résumé financier par véhicule et période (calculé automatiquement)';
COMMENT ON COLUMN vehicle_financial_summary.roi_percentage IS 'ROI calculé : ((revenus - coûts) / coûts) × 100';

-- ============================================
-- Fonction : Mise à jour automatique de updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS update_fleet_vehicles_updated_at ON fleet_vehicles;
CREATE TRIGGER update_fleet_vehicles_updated_at
  BEFORE UPDATE ON fleet_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicle_maintenance_updated_at ON vehicle_maintenance;
CREATE TRIGGER update_vehicle_maintenance_updated_at
  BEFORE UPDATE ON vehicle_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicle_documents_updated_at ON vehicle_documents;
CREATE TRIGGER update_vehicle_documents_updated_at
  BEFORE UPDATE ON vehicle_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicle_financial_summary_updated_at ON vehicle_financial_summary;
CREATE TRIGGER update_vehicle_financial_summary_updated_at
  BEFORE UPDATE ON vehicle_financial_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Fonction : Calcul automatique de la consommation
-- ============================================
CREATE OR REPLACE FUNCTION calculate_fuel_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculer la consommation si on a odometer_before, odometer_after et quantity
  IF NEW.odometer_before IS NOT NULL 
     AND NEW.odometer_after IS NOT NULL 
     AND NEW.quantity IS NOT NULL 
     AND NEW.quantity > 0 THEN
    
    DECLARE
      distance_traveled DECIMAL;
    BEGIN
      distance_traveled := NEW.odometer_after - NEW.odometer_before;
      
      IF distance_traveled > 0 THEN
        -- Consommation en L/100km ou kWh/100km
        NEW.consumption_per_100km := (NEW.quantity / distance_traveled) * 100;
        NEW.distance_km := distance_traveled;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer automatiquement la consommation
DROP TRIGGER IF EXISTS calculate_consumption_trigger ON vehicle_fuel_logs;
CREATE TRIGGER calculate_consumption_trigger
  BEFORE INSERT OR UPDATE ON vehicle_fuel_logs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_fuel_consumption();

-- ============================================
-- Fonction : Mise à jour automatique du kilométrage du véhicule
-- ============================================
CREATE OR REPLACE FUNCTION update_vehicle_odometer()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour le kilométrage actuel du véhicule
  IF NEW.odometer_after IS NOT NULL THEN
    UPDATE fleet_vehicles
    SET current_odometer = NEW.odometer_after,
        last_odometer_update = NOW()
    WHERE vehicle_plate = NEW.vehicle_plate
      AND (current_odometer IS NULL OR NEW.odometer_after > current_odometer);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour le kilométrage après un ravitaillement
DROP TRIGGER IF EXISTS update_odometer_from_fuel_log ON vehicle_fuel_logs;
CREATE TRIGGER update_odometer_from_fuel_log
  AFTER INSERT OR UPDATE ON vehicle_fuel_logs
  FOR EACH ROW
  WHEN (NEW.odometer_after IS NOT NULL)
  EXECUTE FUNCTION update_vehicle_odometer();

-- Trigger pour mettre à jour le kilométrage après une livraison
DROP TRIGGER IF EXISTS update_odometer_from_delivery ON delivery_mileage_logs;
CREATE TRIGGER update_odometer_from_delivery
  AFTER INSERT OR UPDATE ON delivery_mileage_logs
  FOR EACH ROW
  WHEN (NEW.odometer_after IS NOT NULL)
  EXECUTE FUNCTION update_vehicle_odometer();

-- ============================================
-- SÉCURITÉ : ROW LEVEL SECURITY (RLS)
-- ============================================

-- Fonction helper pour vérifier si l'utilisateur est admin
-- (Crée la fonction si elle n'existe pas, sinon la remplace)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. RLS pour fleet_vehicles
-- ============================================
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Admins can view all fleet vehicles" ON fleet_vehicles;
DROP POLICY IF EXISTS "Admins can insert fleet vehicles" ON fleet_vehicles;
DROP POLICY IF EXISTS "Admins can update fleet vehicles" ON fleet_vehicles;
DROP POLICY IF EXISTS "Admins can delete fleet vehicles" ON fleet_vehicles;
DROP POLICY IF EXISTS "Drivers can view assigned vehicles" ON fleet_vehicles;

-- Admins peuvent tout faire
CREATE POLICY "Admins can view all fleet vehicles"
ON fleet_vehicles FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert fleet vehicles"
ON fleet_vehicles FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update fleet vehicles"
ON fleet_vehicles FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete fleet vehicles"
ON fleet_vehicles FOR DELETE
USING (is_admin());

-- Drivers peuvent voir leur véhicule assigné
CREATE POLICY "Drivers can view assigned vehicles"
ON fleet_vehicles FOR SELECT
USING (
  current_driver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'driver'
    AND users.id = fleet_vehicles.current_driver_id
  )
);

-- ============================================
-- 2. RLS pour vehicle_fuel_logs
-- ============================================
ALTER TABLE vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all fuel logs" ON vehicle_fuel_logs;
DROP POLICY IF EXISTS "Admins can insert fuel logs" ON vehicle_fuel_logs;
DROP POLICY IF EXISTS "Admins can update fuel logs" ON vehicle_fuel_logs;
DROP POLICY IF EXISTS "Admins can delete fuel logs" ON vehicle_fuel_logs;
DROP POLICY IF EXISTS "Drivers can view their fuel logs" ON vehicle_fuel_logs;

CREATE POLICY "Admins can view all fuel logs"
ON vehicle_fuel_logs FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert fuel logs"
ON vehicle_fuel_logs FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update fuel logs"
ON vehicle_fuel_logs FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete fuel logs"
ON vehicle_fuel_logs FOR DELETE
USING (is_admin());

-- Drivers peuvent voir les logs de leur véhicule assigné
CREATE POLICY "Drivers can view their fuel logs"
ON vehicle_fuel_logs FOR SELECT
USING (
  driver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM fleet_vehicles
    WHERE fleet_vehicles.vehicle_plate = vehicle_fuel_logs.vehicle_plate
    AND fleet_vehicles.current_driver_id = auth.uid()
  )
);

-- ============================================
-- 3. RLS pour vehicle_maintenance
-- ============================================
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all maintenance" ON vehicle_maintenance;
DROP POLICY IF EXISTS "Admins can insert maintenance" ON vehicle_maintenance;
DROP POLICY IF EXISTS "Admins can update maintenance" ON vehicle_maintenance;
DROP POLICY IF EXISTS "Admins can delete maintenance" ON vehicle_maintenance;
DROP POLICY IF EXISTS "Drivers can view their vehicle maintenance" ON vehicle_maintenance;

CREATE POLICY "Admins can view all maintenance"
ON vehicle_maintenance FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert maintenance"
ON vehicle_maintenance FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update maintenance"
ON vehicle_maintenance FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete maintenance"
ON vehicle_maintenance FOR DELETE
USING (is_admin());

-- Drivers peuvent voir les maintenances de leur véhicule assigné
CREATE POLICY "Drivers can view their vehicle maintenance"
ON vehicle_maintenance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fleet_vehicles
    WHERE fleet_vehicles.vehicle_plate = vehicle_maintenance.vehicle_plate
    AND fleet_vehicles.current_driver_id = auth.uid()
  )
);

-- ============================================
-- 4. RLS pour vehicle_documents
-- ============================================
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Admins can insert documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Admins can update documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Drivers can view their vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Drivers can insert their vehicle documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Drivers can update their vehicle documents" ON vehicle_documents;

CREATE POLICY "Admins can view all documents"
ON vehicle_documents FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert documents"
ON vehicle_documents FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update documents"
ON vehicle_documents FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete documents"
ON vehicle_documents FOR DELETE
USING (is_admin());

-- Drivers peuvent voir les documents de leur véhicule assigné
CREATE POLICY "Drivers can view their vehicle documents"
ON vehicle_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fleet_vehicles
    WHERE fleet_vehicles.vehicle_plate = vehicle_documents.vehicle_plate
    AND fleet_vehicles.current_driver_id = auth.uid()
  )
);

-- Drivers peuvent insérer/modifier les documents de leur véhicule assigné
-- (pour permettre l'upload de documents dans l'app driver)
CREATE POLICY "Drivers can insert their vehicle documents"
ON vehicle_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fleet_vehicles
    WHERE fleet_vehicles.vehicle_plate = vehicle_documents.vehicle_plate
    AND fleet_vehicles.current_driver_id = auth.uid()
  )
);

CREATE POLICY "Drivers can update their vehicle documents"
ON vehicle_documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM fleet_vehicles
    WHERE fleet_vehicles.vehicle_plate = vehicle_documents.vehicle_plate
    AND fleet_vehicles.current_driver_id = auth.uid()
  )
);

-- ============================================
-- 5. RLS pour delivery_mileage_logs
-- ============================================
ALTER TABLE delivery_mileage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all mileage logs" ON delivery_mileage_logs;
DROP POLICY IF EXISTS "Admins can insert mileage logs" ON delivery_mileage_logs;
DROP POLICY IF EXISTS "Admins can update mileage logs" ON delivery_mileage_logs;
DROP POLICY IF EXISTS "Admins can delete mileage logs" ON delivery_mileage_logs;
DROP POLICY IF EXISTS "Drivers can view their mileage logs" ON delivery_mileage_logs;

CREATE POLICY "Admins can view all mileage logs"
ON delivery_mileage_logs FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert mileage logs"
ON delivery_mileage_logs FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update mileage logs"
ON delivery_mileage_logs FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete mileage logs"
ON delivery_mileage_logs FOR DELETE
USING (is_admin());

-- Drivers peuvent voir leurs propres logs de kilométrage
CREATE POLICY "Drivers can view their mileage logs"
ON delivery_mileage_logs FOR SELECT
USING (
  driver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM fleet_vehicles
    WHERE fleet_vehicles.vehicle_plate = delivery_mileage_logs.vehicle_plate
    AND fleet_vehicles.current_driver_id = auth.uid()
  )
);

-- ============================================
-- 6. RLS pour vehicle_financial_summary
-- ============================================
ALTER TABLE vehicle_financial_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all financial summaries" ON vehicle_financial_summary;
DROP POLICY IF EXISTS "Admins can insert financial summaries" ON vehicle_financial_summary;
DROP POLICY IF EXISTS "Admins can update financial summaries" ON vehicle_financial_summary;
DROP POLICY IF EXISTS "Admins can delete financial summaries" ON vehicle_financial_summary;
DROP POLICY IF EXISTS "Drivers can view their vehicle financial summary" ON vehicle_financial_summary;

CREATE POLICY "Admins can view all financial summaries"
ON vehicle_financial_summary FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert financial summaries"
ON vehicle_financial_summary FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update financial summaries"
ON vehicle_financial_summary FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete financial summaries"
ON vehicle_financial_summary FOR DELETE
USING (is_admin());

-- Drivers peuvent voir le résumé financier de leur véhicule assigné (lecture seule)
CREATE POLICY "Drivers can view their vehicle financial summary"
ON vehicle_financial_summary FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fleet_vehicles
    WHERE fleet_vehicles.vehicle_plate = vehicle_financial_summary.vehicle_plate
    AND fleet_vehicles.current_driver_id = auth.uid()
  )
);

-- ============================================
-- Vérification des tables créées
-- ============================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN (
    'fleet_vehicles',
    'vehicle_fuel_logs',
    'vehicle_maintenance',
    'vehicle_documents',
    'delivery_mileage_logs',
    'vehicle_financial_summary'
  )
ORDER BY table_name;

-- ============================================
-- Vérification RLS activé
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'fleet_vehicles',
  'vehicle_fuel_logs',
  'vehicle_maintenance',
  'vehicle_documents',
  'delivery_mileage_logs',
  'vehicle_financial_summary'
)
ORDER BY tablename;

-- ============================================
-- Vérification des politiques RLS créées
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'fleet_vehicles',
  'vehicle_fuel_logs',
  'vehicle_maintenance',
  'vehicle_documents',
  'delivery_mileage_logs',
  'vehicle_financial_summary'
)
ORDER BY tablename, policyname;

