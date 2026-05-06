-- Autorise les types de preuves de livraison utilisés par le backend QR/B2B.
-- Ancien schéma prod observé : CHECK (qr_code_type = 'delivery'), ce qui
-- faisait échouer les validations manuelles avec qr_code_type = 'manual_code'.

ALTER TABLE public.qr_code_scans
  DROP CONSTRAINT IF EXISTS qr_code_scans_qr_code_type_check;

ALTER TABLE public.qr_code_scans
  ADD CONSTRAINT qr_code_scans_qr_code_type_check
  CHECK (
    qr_code_type IN (
      'delivery',
      'pickup',
      'qr_scan',
      'manual_code',
      'photo_signature',
      'batch_driver_confirmation'
    )
  );
