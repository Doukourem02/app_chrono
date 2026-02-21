-- Chrono Livraison - Supabase Storage policies (exemples)
-- À adapter selon tes buckets: avatars, proofs, packages, documents, etc.
-- Recommandation: buckets privés + URLs signées plutôt que publicUrl.

-- IMPORTANT:
-- - Exécute d'abord: "Enable RLS" dans Storage (table storage.objects est déjà sous RLS).
-- - Change 'avatars' / 'proofs' selon tes buckets réels.

-- =========================
-- Avatars: lecture pour owner + admin, écriture pour owner
-- =========================
drop policy if exists "avatars_read_owner_or_admin" on storage.objects;
create policy "avatars_read_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (
    owner = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin','super_admin')
    )
  )
);

drop policy if exists "avatars_write_owner" on storage.objects;
create policy "avatars_write_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
);

-- =========================
-- Proofs: uniquement owner + admin (jamais public)
-- =========================
drop policy if exists "proofs_read_owner_or_admin" on storage.objects;
create policy "proofs_read_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'proofs'
  and (
    owner = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin','super_admin')
    )
  )
);

drop policy if exists "proofs_write_owner" on storage.objects;
create policy "proofs_write_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'proofs'
  and owner = auth.uid()
);

