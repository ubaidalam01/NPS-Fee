-- School logos: public Storage bucket + school-scoped write policies
-- Run in Supabase SQL Editor after 001_schema.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-logos',
  'school-logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (receipts / UI need unauthenticated img access)
drop policy if exists "school_logos_public_read" on storage.objects;
create policy "school_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'school-logos');

-- school_admin may upload only under their school_id folder
drop policy if exists "school_logos_admin_insert" on storage.objects;
create policy "school_logos_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'school-logos'
    and public.current_school_id() is not null
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "school_logos_admin_update" on storage.objects;
create policy "school_logos_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'school-logos'
    and public.current_school_id() is not null
    and (storage.foldername(name))[1] = public.current_school_id()::text
  )
  with check (
    bucket_id = 'school-logos'
    and public.current_school_id() is not null
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "school_logos_admin_delete" on storage.objects;
create policy "school_logos_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'school-logos'
    and public.current_school_id() is not null
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );
