-- Migration pour créer la structure utilisateurs avec rôles
-- À exécuter dans Supabase SQL Editor

-- 1. Création du type ENUM pour les rôles
CREATE TYPE user_role AS ENUM ('client', 'driver', 'partner', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending');

-- 2. Table users principale
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255), -- Pour l'auth custom si nécessaire
    role user_role NOT NULL DEFAULT 'client',
    status user_status NOT NULL DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Supabase Auth integration
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. Table profiles clients
CREATE TABLE IF NOT EXISTS client_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    profile_image_url TEXT,
    default_pickup_address TEXT,
    default_delivery_address TEXT,
    preferences JSONB DEFAULT '{}', -- Préférences utilisateur
    total_orders INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table profiles chauffeurs
CREATE TABLE IF NOT EXISTS driver_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    license_number VARCHAR(50) UNIQUE,
    license_expiry DATE,
    vehicle_type VARCHAR(50), -- moto, voiture, camionnette
    vehicle_plate VARCHAR(20),
    vehicle_model VARCHAR(100),
    vehicle_year INTEGER,
    profile_image_url TEXT,
    identity_document_url TEXT,
    license_document_url TEXT,
    vehicle_document_url TEXT,
    
    -- Géolocalisation
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT FALSE,
    
    -- Stats
    total_deliveries INTEGER DEFAULT 0,
    completed_deliveries INTEGER DEFAULT 0,
    cancelled_deliveries INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    total_earnings DECIMAL(10,2) DEFAULT 0.0,
    
    -- Dates importantes
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Table profiles partenaires (restaurants, magasins, etc.)
CREATE TABLE IF NOT EXISTS partner_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(200) NOT NULL,
    business_type VARCHAR(100), -- restaurant, magasin, pharmacie, etc.
    contact_person VARCHAR(100),
    siret VARCHAR(50),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Informations business
    opening_hours JSONB, -- {lundi: "08:00-18:00", ...}
    logo_url TEXT,
    cover_image_url TEXT,
    description TEXT,
    website VARCHAR(255),
    
    -- Documents légaux
    business_license_url TEXT,
    insurance_document_url TEXT,
    
    -- Stats
    total_orders INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    commission_rate DECIMAL(5,2) DEFAULT 10.0, -- Pourcentage de commission
    
    -- Statut de validation
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Index pour les performances
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_driver_location ON driver_profiles(current_latitude, current_longitude);
CREATE INDEX idx_driver_online ON driver_profiles(is_online, is_available);
CREATE INDEX idx_partner_location ON partner_profiles(latitude, longitude);

-- 7. Fonctions pour mise à jour automatique du timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Triggers pour les timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON client_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_profiles_updated_at BEFORE UPDATE ON partner_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Politique de sécurité RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_profiles ENABLE ROW LEVEL SECURITY;

-- Politiques de base (à personnaliser selon les besoins)
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (auth.uid() = auth_user_id);