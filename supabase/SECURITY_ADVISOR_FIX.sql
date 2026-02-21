-- Chrono Livraison - Supabase Security Advisor Fix (pré-prod)
-- Objectif: corriger les alertes critiques vues dans Security Advisor:
--  - "RLS Enabled No Policy" (RLS activé mais aucune policy)
--  - "RLS Policy Always True" (policies trop permissives: USING(true) / WITH CHECK(true))
--  - "Function Search Path Mutable" (search_path non fixé sur des fonctions)
--
-- ⚠️ Recommandation: exécuter d'abord sur un projet/staging.

-- ==========================================================
-- A) Supprimer les policies dangereuses (USING true / CHECK true)
-- ==========================================================
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') = 'true'
        or coalesce(with_check, '') = 'true'
      )
  loop
    raise notice 'Dropping permissive policy %.% on %.%', r.schemaname, r.policyname, r.schemaname, r.tablename;
    execute format('drop policy if exists %I on %I.%I;', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ==========================================================
-- B) Fix "Function Search Path Mutable"
-- ==========================================================
-- Fixe search_path pour toutes les fonctions du schema public qui n'ont pas de search_path explicite.
do $$
declare r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proconfig is null
        or not exists (
          select 1
          from unnest(p.proconfig) c
          where c like 'search_path=%'
        )
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, extensions, pg_catalog;',
      r.schema_name, r.function_name, r.args
    );
  end loop;
end $$;

-- ==========================================================
-- C) RLS policies minimales (sans ouverture)
-- ==========================================================
-- Helper "admin?" via table public.users.role
-- (Si ta table role est ailleurs, adapte la sous-requête.)

-- ---------- conversations ----------
do $$
begin
  if to_regclass('public.conversations') is not null then
    execute 'alter table public.conversations enable row level security;';

    execute 'drop policy if exists "conversations_select_participants" on public.conversations;';
    execute $sql$
      create policy "conversations_select_participants"
      on public.conversations
      for select
      to authenticated
      using (
        participant_1_id = auth.uid()
        or participant_2_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid()
            and u.role in ('admin','super_admin')
        )
      );
    $sql$;

    execute 'drop policy if exists "conversations_insert_participants" on public.conversations;';
    execute $sql$
      create policy "conversations_insert_participants"
      on public.conversations
      for insert
      to authenticated
      with check (
        participant_1_id = auth.uid()
        or participant_2_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid()
            and u.role in ('admin','super_admin')
        )
      );
    $sql$;
  end if;
end $$;

-- ---------- messages ----------
do $$
begin
  if to_regclass('public.messages') is not null then
    execute 'alter table public.messages enable row level security;';

    execute 'drop policy if exists "messages_select_conversation_members" on public.messages;';
    execute $sql$
      create policy "messages_select_conversation_members"
      on public.messages
      for select
      to authenticated
      using (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (
              c.participant_1_id = auth.uid()
              or c.participant_2_id = auth.uid()
              or exists (
                select 1 from public.users u
                where u.id = auth.uid()
                  and u.role in ('admin','super_admin')
              )
            )
        )
      );
    $sql$;

    execute 'drop policy if exists "messages_insert_sender_in_conversation" on public.messages;';
    execute $sql$
      create policy "messages_insert_sender_in_conversation"
      on public.messages
      for insert
      to authenticated
      with check (
        sender_id = auth.uid()
        and exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (
              c.participant_1_id = auth.uid()
              or c.participant_2_id = auth.uid()
              or exists (
                select 1 from public.users u
                where u.id = auth.uid()
                  and u.role in ('admin','super_admin')
              )
            )
        )
      );
    $sql$;

    -- Optionnel: update (marquer lu) uniquement si participant
    execute 'drop policy if exists "messages_update_read_participant" on public.messages;';
    execute $sql$
      create policy "messages_update_read_participant"
      on public.messages
      for update
      to authenticated
      using (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (c.participant_1_id = auth.uid() or c.participant_2_id = auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (c.participant_1_id = auth.uid() or c.participant_2_id = auth.uid())
        )
      );
    $sql$;
  end if;
end $$;

-- ---------- ratings ----------
do $$
begin
  if to_regclass('public.ratings') is not null then
    execute 'alter table public.ratings enable row level security;';

    execute 'drop policy if exists "ratings_select_related" on public.ratings;';
    execute $sql$
      create policy "ratings_select_related"
      on public.ratings
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or driver_id = auth.uid()
        or exists (
          select 1 from public.users u
          where u.id = auth.uid()
            and u.role in ('admin','super_admin')
        )
      );
    $sql$;

    execute 'drop policy if exists "ratings_insert_own" on public.ratings;';
    execute $sql$
      create policy "ratings_insert_own"
      on public.ratings
      for insert
      to authenticated
      with check (user_id = auth.uid());
    $sql$;
  end if;
end $$;

-- ==========================================================
-- D) Tables en "RLS Enabled No Policy" (policies minimales)
-- ==========================================================
-- Pour ces tables, on applique le principe: "owner only" + admin.
-- On détecte dynamiquement une colonne owner parmi: user_id / driver_id.

do $$
declare
  t text;
  owner_col text;
begin
  FOREACH t IN ARRAY ARRAY['driver_locations','driver_payouts','driver_wallet_transactions','driver_wallets','notifications','order_status_history','profiles']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security;', t);

    -- choisir une colonne "owner"
    owner_col := null;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='user_id') then
      owner_col := 'user_id';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='driver_id') then
      owner_col := 'driver_id';
    end if;

    if owner_col is not null then
      execute format('drop policy if exists %I on public.%I;', t || '_select_owner_or_admin', t);
      execute format($sql$
        create policy %I
        on public.%I
        for select
        to authenticated
        using (
          %I = auth.uid()
          or exists (
            select 1 from public.users u
            where u.id = auth.uid()
              and u.role in ('admin','super_admin')
          )
        );
      $sql$, t || '_select_owner_or_admin', t, owner_col);
    else
      -- Si pas de colonne owner reconnue, on ne crée pas de policy (sécurité > accessibilité)
      raise notice 'Table % sans colonne user_id/driver_id -> aucune policy auto créée (à configurer manuellement)', t;
    end if;

    -- Notifications: permettre update (ex: is_read) uniquement au owner
    if t = 'notifications' and owner_col is not null then
      execute format('drop policy if exists %I on public.%I;', 'notifications_update_owner', t);
      execute format($sql$
        create policy %I
        on public.%I
        for update
        to authenticated
        using (%I = auth.uid())
        with check (%I = auth.uid());
      $sql$, 'notifications_update_owner', t, owner_col, owner_col);
    end if;
  end loop;
end $$;

