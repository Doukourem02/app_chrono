-- Migration pour adapter le système à votre table users existante
-- À exécuter dans Supabase SQL Editor

-- 1. Créer les types ENUM pour standardiser les rôles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('client', 'driver', 'partner', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Ajouter les colonnes manquantes à votre table users existante
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS user_role user_role DEFAULT 'client',
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- 3. Créer une vue pour simplifier l'accès aux données utilisateur
CREATE OR REPLACE VIEW public.users_view AS
SELECT 
    id,
    email,
    phone,
    role as existing_role,
    user_role as new_role,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN true 
        ELSE false 
    END as email_verified,
    phone_verified,
    status,
    created_at,
    updated_at,
    last_sign_in_at as last_login
FROM auth.users;

-- 4. Créer les tables de profils spécialisés
CREATE TABLE IF NOT EXISTS public.client_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    profile_image_url TEXT,
    default_pickup_address TEXT,
    default_delivery_address TEXT,
    preferences JSONB DEFAULT '{}',
    total_orders INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.driver_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    license_number VARCHAR(50) UNIQUE,
    license_expiry DATE,
    vehicle_type VARCHAR(50),
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
    
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name VARCHAR(200) NOT NULL,
    business_type VARCHAR(100),
    contact_person VARCHAR(100),
    siret VARCHAR(50),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Informations business
    opening_hours JSONB,
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
    commission_rate DECIMAL(5,2) DEFAULT 10.0,
    
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_user_role ON auth.users(user_role);
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth.users(status);
CREATE INDEX IF NOT EXISTS idx_auth_users_phone ON auth.users(phone);

-- 6. Fonction pour update automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Triggers pour les tables de profils
CREATE TRIGGER update_client_profiles_updated_at 
    BEFORE UPDATE ON public.client_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at 
    BEFORE UPDATE ON public.driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_profiles_updated_at 
    BEFORE UPDATE ON public.partner_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. RLS (Row Level Security) pour les profils
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS basiques (à adapter selon vos besoins)
CREATE POLICY "Users can view own client profile" ON public.client_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own client profile" ON public.client_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own driver profile" ON public.driver_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own driver profile" ON public.driver_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own partner profile" ON public.partner_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own partner profile" ON public.partner_profiles
    FOR UPDATE USING (auth.uid() = user_id);