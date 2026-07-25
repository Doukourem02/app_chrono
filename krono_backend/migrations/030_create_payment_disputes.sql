-- Migration 030: Créer la table payment_disputes pour le système de réclamations
-- Date: 2026

CREATE TABLE IF NOT EXISTS public.payment_disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Qui a soumis la réclamation
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Commande concernée (optionnel)
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,

    -- Référence externe à une transaction (stockée comme texte, pas de FK)
    transaction_id TEXT,

    -- Type de réclamation
    dispute_type VARCHAR(50) NOT NULL DEFAULT 'other'
        CHECK (dispute_type IN ('refund_request', 'payment_issue', 'service_issue', 'other')),

    -- Montant en jeu
    amount NUMERIC(10, 2),

    -- Détails
    reason TEXT,
    description TEXT,

    -- Traitement admin
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'resolved', 'rejected')),
    admin_notes TEXT,

    -- Horodatage
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_payment_disputes_user_id   ON public.payment_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_order_id  ON public.payment_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status    ON public.payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_created_at ON public.payment_disputes(created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_payment_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_disputes_updated_at
    BEFORE UPDATE ON public.payment_disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_disputes_updated_at();

-- RLS
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

-- Les clients peuvent créer et voir leurs propres réclamations
CREATE POLICY "Users can insert own disputes" ON public.payment_disputes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own disputes" ON public.payment_disputes
    FOR SELECT USING (auth.uid() = user_id);

-- Le service role (backend) a accès total
CREATE POLICY "Service role full access" ON public.payment_disputes
    FOR ALL USING (true) WITH CHECK (true);
