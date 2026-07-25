-- 016b — QR code de preuve de livraison + historique des scans
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- le fichier original n'a jamais été committé, seules les colonnes/table vivent en base.
-- La contrainte qr_code_type est volontairement restreinte à 'delivery' ici : c'est l'état
-- initial réel, élargi ensuite par la migration 040 (qui existe déjà dans ce dossier).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_qr_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_qr_scanned_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS delivery_qr_scanned_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.qr_code_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  qr_code_type TEXT NOT NULL DEFAULT 'delivery'
    CONSTRAINT qr_code_scans_qr_code_type_check CHECK (qr_code_type = 'delivery'),
  scanned_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scanned_at TIMESTAMP DEFAULT NOW(),
  location JSONB NULL,
  device_info JSONB NULL,
  is_valid BOOLEAN DEFAULT true,
  validation_error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_type ON public.qr_code_scans(qr_code_type);
CREATE INDEX IF NOT EXISTS idx_qr_scans_order ON public.qr_code_scans(order_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_by ON public.qr_code_scans(scanned_by);

ALTER TABLE public.qr_code_scans ENABLE ROW LEVEL SECURITY;

-- Voir 022_qr_code_scans_unique_order_scanner.sql pour l'index unique (order_id, scanned_by)
-- et 040_qr_code_scans_allow_delivery_proof_types.sql pour l'élargissement de la contrainte ci-dessus.
