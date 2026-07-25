-- Migration 032: Tables core B2B — partners, partner_users, partner_drivers
-- Crée l'entité partenaire (distinct de partner_profiles qui est le profil livreur-type)

-- ─── partners ─────────────────────────────────────────────────────────────────
-- L'entreprise partenaire (restaurant, pharmacie, vendeuse TikTok structurée…)
CREATE TABLE IF NOT EXISTS public.partners (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  plan             TEXT NOT NULL DEFAULT 'none'
                     CHECK (plan IN ('none', 'starter', 'pro', 'business')),
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'suspended', 'pending')),
  commission_rate  DECIMAL(5,4) NOT NULL DEFAULT 0.20,  -- ex: 0.20 = 20%
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_status     ON public.partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_plan       ON public.partners(plan);
CREATE INDEX IF NOT EXISTS idx_partners_created_at ON public.partners(created_at DESC);

CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION update_partners_updated_at();

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Le service role (backend Express) a accès total
CREATE POLICY "Service role full access on partners"
  ON public.partners FOR ALL USING (true) WITH CHECK (true);


-- ─── partner_users ─────────────────────────────────────────────────────────────
-- Utilisateurs Krono autorisés à agir au nom d'un partenaire (owner ou manager)
CREATE TABLE IF NOT EXISTS public.partner_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'manager'
                 CHECK (role IN ('owner', 'manager')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_users_partner_id ON public.partner_users(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_user_id    ON public.partner_users(user_id);

ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;

-- Un utilisateur peut voir ses propres lignes (portail partenaire)
CREATE POLICY "Users can view own partner_users rows"
  ON public.partner_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on partner_users"
  ON public.partner_users FOR ALL USING (true) WITH CHECK (true);


-- ─── partner_drivers ──────────────────────────────────────────────────────────
-- Livreurs attitrés d'un partenaire (relation persistante, pas juste snapshot tournée)
CREATE TABLE IF NOT EXISTS public.partner_drivers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  driver_user_id  UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  is_default      BOOLEAN NOT NULL DEFAULT false,  -- livreur proposé par défaut dans l'UI tournée
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, driver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_drivers_partner_id     ON public.partner_drivers(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_drivers_driver_user_id ON public.partner_drivers(driver_user_id);

ALTER TABLE public.partner_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on partner_drivers"
  ON public.partner_drivers FOR ALL USING (true) WITH CHECK (true);
