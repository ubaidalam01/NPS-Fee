-- Fix "stack depth limit exceeded" after 004.
-- Cause: language sql SECURITY DEFINER helpers (current_school_id / get_my_school_id)
-- are inlined into RLS expressions, which re-enter the same policies recursively.
-- Fix: redefine as language plpgsql (not inlined) and keep schools SELECT+UPDATE explicit.
--
-- Run in Supabase SQL Editor.

create or replace function public.current_school_id()
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
  -- Inline profiles read — do not call current_school_id() (avoids mutual recursion)
  select p.school_id into sid
  from public.profiles p
  where p.id = auth.uid();
  return sid;
end;
$$;

create or replace function public.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
end;
$$;

create or replace function public.is_approved_school_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.profiles p
    join public.schools s on s.id = p.school_id
    where p.id = auth.uid()
      and p.role = 'school_admin'
      and s.status = 'active'
  );
end;
$$;

grant execute on function public.current_school_id() to authenticated, anon;
grant execute on function public.get_my_school_id() to authenticated, anon;
grant execute on function public.is_super_admin() to authenticated, anon;
grant execute on function public.is_approved_school_admin() to authenticated, anon;

-- Ensure schools SELECT was not left missing after 004
drop policy if exists "schools_select_own_or_super" on public.schools;
create policy "schools_select_own_or_super"
  on public.schools for select
  using (
    id = public.get_my_school_id()
    or public.is_super_admin()
  );

drop policy if exists "school_admin can update own school" on public.schools;
drop policy if exists "schools_update_own" on public.schools;
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

-- Convenience: expose current schools policies for debugging
create or replace function public.debug_schools_policies()
returns table (
  policyname text,
  cmd text,
  roles text[],
  qual text,
  with_check text
)
language sql
security definer
set search_path = public
as $$
  select
    p.policyname::text,
    p.cmd::text,
    p.roles,
    p.qual,
    p.with_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'schools'
  order by p.policyname;
$$;

grant execute on function public.debug_schools_policies() to authenticated, service_role;
