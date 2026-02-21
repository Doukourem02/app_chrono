-- Chrono Livraison - RLS starter kit (à exécuter dans Supabase SQL Editor)
-- Objectif: empêcher tout vol de données si un token utilisateur fuit.
-- NOTE: adapte les noms de colonnes si ton schéma diffère.

-- =========================
-- 1) Activer RLS
-- =========================
alter table public.users enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;

-- =========================
-- 2) Helper: rôle depuis JWT claims
-- =========================
-- Recommandé: stocker role dans users.role et/ou dans app_metadata.
-- Ici, on utilise users.role comme source d'autorité.

-- =========================
-- 3) USERS
-- =========================
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- IMPORTANT:
-- Ne pas créer de policy "admin global" sur public.users en se basant sur public.users lui-même:
-- cela peut provoquer une récursion RLS (500 côté PostgREST / supabase-js).
-- Pour les écrans admin qui doivent lister tous les users, passe plutôt par ton backend (service role)
-- ou une fonction SECURITY DEFINER dédiée.

-- =========================
-- 4) DRIVER_PROFILES
-- =========================
drop policy if exists "driver_profiles_select_own" on public.driver_profiles;
create policy "driver_profiles_select_own"
on public.driver_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "driver_profiles_update_own" on public.driver_profiles;
create policy "driver_profiles_update_own"
on public.driver_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "driver_profiles_select_admin" on public.driver_profiles;
create policy "driver_profiles_select_admin"
on public.driver_profiles
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin','super_admin')
  )
);

-- =========================
-- 5) ORDERS
-- =========================
-- Client: voit ses commandes
drop policy if exists "orders_select_client_own" on public.orders;
create policy "orders_select_client_own"
on public.orders
for select
to authenticated
using (user_id = auth.uid());

-- Driver: voit ses commandes assignées
drop policy if exists "orders_select_driver_assigned" on public.orders;
create policy "orders_select_driver_assigned"
on public.orders
for select
to authenticated
using (driver_id = auth.uid());

-- Client: créer une commande pour soi-même (si insertion via client)
drop policy if exists "orders_insert_client_own" on public.orders;
create policy "orders_insert_client_own"
on public.orders
for insert
to authenticated
with check (user_id = auth.uid());

-- Driver: mise à jour du statut uniquement si assigné
drop policy if exists "orders_update_driver_assigned" on public.orders;
create policy "orders_update_driver_assigned"
on public.orders
for update
to authenticated
using (driver_id = auth.uid())
with check (driver_id = auth.uid());

-- Admin: accès global
drop policy if exists "orders_select_admin" on public.orders;
create policy "orders_select_admin"
on public.orders
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin','super_admin')
  )
);

-- =========================
-- 6) PAYMENT_METHODS
-- =========================
drop policy if exists "payment_methods_select_own" on public.payment_methods;
create policy "payment_methods_select_own"
on public.payment_methods
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "payment_methods_modify_own" on public.payment_methods;
create policy "payment_methods_modify_own"
on public.payment_methods
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =========================
-- 7) TRANSACTIONS
-- =========================
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
on public.transactions
for select
to authenticated
using (user_id = auth.uid());

-- Admin: lecture globale transactions
drop policy if exists "transactions_select_admin" on public.transactions;
create policy "transactions_select_admin"
on public.transactions
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin','super_admin')
  )
);

