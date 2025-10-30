-- Version simplifiée pour créer rapidement la table driver_profiles
CREATE TABLE public.driver_profiles (
    user_id UUID PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    vehicle_type VARCHAR(50) DEFAULT 'moto',
    is_online BOOLEAN DEFAULT false,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    rating DECIMAL(3, 2) DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer quelques chauffeurs de test
INSERT INTO public.driver_profiles VALUES 
('11111111-1111-1111-1111-111111111111', 'Kouame', 'Jean', 'moto', true, 5.3165, -4.0266, 4.8, NOW()),
('22222222-2222-2222-2222-222222222222', 'Diallo', 'Fatoumata', 'vehicule', true, 5.3532, -3.9851, 4.9, NOW()),
('33333333-3333-3333-3333-333333333333', 'Traore', 'Mamadou', 'cargo', false, 5.2945, -4.0419, 4.7, NOW());