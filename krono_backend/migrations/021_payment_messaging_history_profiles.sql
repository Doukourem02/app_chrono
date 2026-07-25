-- 021 — profiles (minimal), payment_methods, transactions, invoices,
-- order_status_history, conversations, messages
-- RECONSTRUIT le 2026-07-22 à partir du schéma réel Supabase (projet chrono_delivery) :
-- le fichier original n'a jamais été committé, seules les tables vivent en base.
-- Suppose que le type ENUM public.order_status existe déjà (créé par une migration
-- antérieure, ex. 007_create_orders_table.sql) : valeurs observées en prod = draft,
-- pending, searching_driver, accepted, picked_up, enroute, completed, cancelled,
-- declined, delivering, in_progress (delivering/in_progress ajoutés par 031).

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'driver', 'admin')),
  first_name TEXT NULL,
  last_name TEXT NULL,
  phone TEXT NULL,
  avatar_url TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('orange_money', 'wave', 'cash', 'deferred')),
  provider_account TEXT NULL,
  provider_name TEXT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_provider_account CHECK (
    (method_type IN ('orange_money', 'wave') AND provider_account IS NOT NULL)
    OR (method_type IN ('cash', 'deferred'))
  )
);

COMMENT ON TABLE public.payment_methods IS 'Méthodes de paiement des utilisateurs. Les méthodes "cash" et "deferred" sont créées automatiquement lors de l''inscription.';

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id UUID NULL REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  payment_method_type TEXT NOT NULL CHECK (payment_method_type IN ('orange_money', 'wave', 'cash', 'deferred')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'XOF',
  fee NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refused', 'delayed', 'refunded', 'cancelled')),
  provider_transaction_id TEXT NULL,
  provider_response JSONB NULL,
  is_partial BOOLEAN DEFAULT false,
  partial_amount NUMERIC NULL,
  remaining_amount NUMERIC NULL,
  payer_type TEXT DEFAULT 'client' CHECK (payer_type IN ('client', 'recipient')),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  refunded_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.transactions IS 'Transactions de paiement pour les commandes';

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_id UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date TIMESTAMPTZ DEFAULT NOW(),
  subtotal NUMERIC NOT NULL,
  tax NUMERIC DEFAULT 0,
  fee NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  distance NUMERIC NULL,
  price_per_km NUMERIC NULL,
  urgency_fee NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  notes TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.invoices IS 'Factures pour les commandes de livraison';

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  detail JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  driver_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  latitude NUMERIC NULL,
  longitude NUMERIC NULL,
  accuracy NUMERIC NULL
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('order', 'support', 'admin')),
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  participant_1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.conversations IS 'Conversations entre utilisateurs (admin, client, driver)';

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

COMMENT ON TABLE public.messages IS 'Messages échangés dans les conversations';

CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
