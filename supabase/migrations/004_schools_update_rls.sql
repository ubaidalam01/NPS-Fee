-- Fix schools UPDATE RLS: school_admin could not persist profile/logo changes
-- (silent 0-row updates under PostgREST when USING/WITH CHECK were wrong/missing).
-- Run in Supabase SQL Editor after 001_schema.sql

-- Alias used by app policies (same as current_school_id)
-- IMPORTANT: plpgsql so SECURITY DEFINER is not inlined into RLS (avoids recursion)
create or replace function public.get_my_school_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  select p.school_id into sid
  from public.profiles p
  where p.id = auth.uid();
  return sid;
end;
$$;

grant execute on function public.get_my_school_id() to authenticated;
grant execute on function public.get_my_school_id() to anon;

-- Drop any catch-all / legacy update policies that may block WITH CHECK
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'schools'
      and (
        cmd = 'ALL'
        or cmd = 'UPDATE'
        or policyname in (
          'schools_update_own',
          'school_admin can update own school',
          'schools_all',
          'Enable all for authenticated users'
        )
      )
  loop
    execute format('drop policy if exists %I on public.schools', pol.policyname);
  end loop;
end $$;

-- Explicit SELECT (keep / recreate — do not rely on FOR ALL)
drop policy if exists "schools_select_own_or_super" on public.schools;
create policy "schools_select_own_or_super"
  on public.schools for select
  using (
    id = public.get_my_school_id()
    or public.is_super_admin()
  );

-- Explicit UPDATE with BOTH using + with check
create policy "school_admin can update own school"
  on public.schools for update
  using (
    id = public.get_my_school_id()
    or public.is_super_admin()
  )
  with check (
    id = public.get_my_school_id()
    or public.is_super_admin()
  );
