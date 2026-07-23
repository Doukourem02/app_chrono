-- Livreurs dedies partenaires + demandes de rattachement

CREATE TABLE IF NOT EXISTS public.partner_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_drivers_partner_driver_uidx
  ON public.partner_drivers(partner_id, driver_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS partner_drivers_one_default_per_partner_uidx
  ON public.partner_drivers(partner_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS partner_drivers_driver_user_id_idx
  ON public.partner_drivers(driver_user_id);

CREATE TABLE IF NOT EXISTS public.partner_driver_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('known_driver', 'previous_krono_driver', 'general_request')),
  driver_name text,
  driver_phone text,
  source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  comment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  review_note text,
  approved_driver_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS partner_driver_requests_partner_status_idx
  ON public.partner_driver_requests(partner_id, status, created_at DESC);

ALTER TABLE public.partner_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_driver_requests ENABLE ROW LEVEL SECURITY;
