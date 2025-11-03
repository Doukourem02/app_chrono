-- Migration 010: Créer la table ratings pour le système d'évaluation des livreurs par les clients
-- Date: 2025

-- Table pour stocker les évaluations des livreurs par les clients
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Client qui note
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Livreur noté
    
    -- Évaluation (note de 1 à 5)
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    
    -- Commentaire optionnel
    comment TEXT,
    
    -- Catégories d'évaluation (optionnel - pour analyser la qualité du service)
    timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5), -- Ponctualité
    professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5), -- Professionnalisme
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5), -- Communication
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte : un client ne peut noter qu'une fois par commande
    CONSTRAINT unique_order_rating UNIQUE(order_id, user_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_ratings_driver_id ON public.ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON public.ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_order_id ON public.ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON public.ratings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON public.ratings(rating);

-- Index composite pour récupérer les évaluations d'un livreur triées par date
CREATE INDEX IF NOT EXISTS idx_ratings_driver_created ON public.ratings(driver_id, created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ratings_updated_at
    BEFORE UPDATE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_ratings_updated_at();

-- Fonction pour calculer et mettre à jour la note moyenne d'un livreur
CREATE OR REPLACE FUNCTION update_driver_average_rating(p_driver_id UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    v_average_rating DECIMAL(3,2);
    v_total_ratings INTEGER;
BEGIN
    -- Calculer la moyenne des notes
    SELECT 
        COALESCE(AVG(rating), 5.0),
        COUNT(*)
    INTO 
        v_average_rating,
        v_total_ratings
    FROM ratings
    WHERE driver_id = p_driver_id;
    
    -- Mettre à jour la note moyenne dans driver_profiles si la table existe
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'driver_profiles'
    ) THEN
        UPDATE driver_profiles
        SET 
            rating = ROUND(v_average_rating::numeric, 2),
            updated_at = NOW()
        WHERE user_id = p_driver_id;
    END IF;
    
    RETURN v_average_rating;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement la note moyenne après chaque évaluation
CREATE OR REPLACE FUNCTION trigger_update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_driver_average_rating(NEW.driver_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_rating_insert_update_avg
    AFTER INSERT OR UPDATE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_driver_rating();

-- RLS (Row Level Security) - IMPORTANT pour permettre les insertions
-- Activer RLS sur la table ratings
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux clients d'insérer leurs propres évaluations
-- Les clients peuvent créer une évaluation si user_id correspond à leur auth.uid()
CREATE POLICY "Users can insert own ratings" ON public.ratings
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

-- Politique pour permettre aux clients de voir leurs propres évaluations
CREATE POLICY "Users can view own ratings" ON public.ratings
    FOR SELECT
    USING (
        auth.uid() = user_id
    );

-- Politique pour permettre aux clients de mettre à jour leurs propres évaluations
CREATE POLICY "Users can update own ratings" ON public.ratings
    FOR UPDATE
    USING (
        auth.uid() = user_id
    );

-- Politique pour permettre aux livreurs de voir les évaluations les concernant
CREATE POLICY "Drivers can view ratings about them" ON public.ratings
    FOR SELECT
    USING (
        auth.uid() = driver_id
    );

-- Politique pour permettre au service role (backend) d'accéder à toutes les évaluations
-- Note: Cette politique sera utilisée par le backend avec le service role key
CREATE POLICY "Service role can do all operations" ON public.ratings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Commentaires
COMMENT ON TABLE public.ratings IS 'Évaluations des livreurs par les clients après chaque livraison';
COMMENT ON COLUMN public.ratings.rating IS 'Note globale de 1 à 5';
COMMENT ON COLUMN public.ratings.comment IS 'Commentaire textuel optionnel du client';
COMMENT ON COLUMN public.ratings.timeliness_rating IS 'Note de ponctualité (optionnel)';
COMMENT ON COLUMN public.ratings.professionalism_rating IS 'Note de professionnalisme (optionnel)';
COMMENT ON COLUMN public.ratings.communication_rating IS 'Note de communication (optionnel)';

