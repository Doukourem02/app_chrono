-- Migration 005: Créer la table driver_profiles pour le statut online/offline des chauffeurs
-- Date: 30 octobre 2025

-- Créer la table driver_profiles
CREATE TABLE IF NOT EXISTS public.driver_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    vehicle_type VARCHAR(50) DEFAULT 'moto',
    license_number VARCHAR(50),
    is_online BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    last_location_update TIMESTAMPTZ DEFAULT NOW(),
    rating DECIMAL(3, 2) DEFAULT 5.0,
    total_deliveries INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT unique_user_driver UNIQUE(user_id),
    CONSTRAINT valid_rating CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT valid_latitude CHECK (current_latitude >= -90 AND current_latitude <= 90),
    CONSTRAINT valid_longitude CHECK (current_longitude >= -180 AND current_longitude <= 180)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON public.driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_is_online ON public.driver_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_is_available ON public.driver_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_location ON public.driver_profiles(current_latitude, current_longitude);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_email ON public.driver_profiles(email);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_driver_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_profiles_updated_at
    BEFORE UPDATE ON public.driver_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_profiles_updated_at();

-- Fonction pour calculer la distance entre deux points (en km)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL(10, 8),
    lon1 DECIMAL(11, 8), 
    lat2 DECIMAL(10, 8),
    lon2 DECIMAL(11, 8)
) RETURNS DECIMAL(10, 2) AS $$
DECLARE
    earth_radius DECIMAL := 6371; -- Rayon de la Terre en km
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql;

-- Activer Row Level Security (RLS)
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

-- Politique RLS : Les chauffeurs peuvent voir et modifier leurs propres données
CREATE POLICY "Drivers can view and edit own profile" ON public.driver_profiles
    FOR ALL USING (auth.uid() = user_id);

-- Politique RLS : Tout le monde peut voir les chauffeurs online (pour l'app utilisateur)
CREATE POLICY "Everyone can view online drivers" ON public.driver_profiles
    FOR SELECT USING (is_online = true AND is_available = true);

-- Insérer quelques chauffeurs de test
INSERT INTO public.driver_profiles (
    user_id,
    first_name,
    last_name,
    email,
    phone,
    vehicle_type,
    license_number,
    is_online,
    is_available,
    current_latitude,
    current_longitude,
    rating,
    total_deliveries
) VALUES 
-- Chauffeur test 1 - Online à Abidjan Centre
(
    gen_random_uuid(),
    'Kouame',
    'Jean',
    'kouame.jean@test.com',
    '+225 07 12 34 56 78',
    'moto',
    'AB123456',
    true,
    true,
    5.3165,
    -4.0266,
    4.8,
    127
),
-- Chauffeur test 2 - Online à Cocody
(
    gen_random_uuid(),
    'Diallo',
    'Fatoumata',
    'diallo.fatoumata@test.com',
    '+225 05 98 76 54 32',
    'vehicule',
    'CD789012',
    true,
    true,
    5.3532,
    -3.9851,
    4.9,
    89
),
-- Chauffeur test 3 - Offline
(
    gen_random_uuid(),
    'Traore',
    'Mamadou',
    'traore.mamadou@test.com',
    '+225 01 11 22 33 44',
    'cargo',
    'EF345678',
    false,
    true,
    5.2945,
    -4.0419,
    4.7,
    203
);

-- Commenter le succès de la migration
COMMENT ON TABLE public.driver_profiles IS 'Table des profils chauffeurs avec statut online/offline et localisation GPS';