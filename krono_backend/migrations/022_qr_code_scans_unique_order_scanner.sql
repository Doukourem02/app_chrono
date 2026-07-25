-- 022 — Index unique (order_id, scanned_by) sur qr_code_scans
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- requis pour les ON CONFLICT du service QR (un même scanner ne peut scanner une
-- commande donnée qu'une seule fois).

CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_code_scans_order_id_scanned_by
  ON public.qr_code_scans(order_id, scanned_by);
