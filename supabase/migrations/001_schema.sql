-- School Fee Management System — Schema + RLS
-- Run this in the Supabase SQL Editor

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type school_status as enum ('pending', 'active', 'suspended', 'rejected');
create type user_role as enum ('school_admin', 'super_admin');
create type student_status as enum ('active', 'graduated', 'left');
create type fee_frequency as enum ('recurring', 'non_recurring');
create type voucher_status as enum ('pending', 'paid', 'void');
create type payment_status as enum ('completed', 'reversed');

-- Schools
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  contact_phone text,
  contact_email text,
  status school_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  full_name text not null,
  role user_role not null default 'school_admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  father_name text not null,
  class_name text not null,
  section text not null default 'A',
  roll_no text not null,
  admission_date date not null default current_date,
  monthly_tuition_fee numeric(12,2) not null default 0,
  status student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, class_name, section, roll_no)
);

create index students_school_idx on public.students(school_id);
create index students_class_section_idx on public.students(school_id, class_name, section);

-- Fee heads
create table public.fee_heads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  frequency fee_frequency not null default 'recurring',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- Fee structure (class × fee head matrix)
create table public.fee_structure (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_name text not null,
  fee_head_id uuid not null references public.fee_heads(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, class_name, fee_head_id)
);

-- Fee vouchers
create table public.fee_vouchers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  voucher_no text not null,
  billing_month date not null, -- first day of month
  total_amount numeric(12,2) not null default 0,
  status voucher_status not null default 'pending',
  generated_at timestamptz not null default now(),
  unique (school_id, voucher_no),
  unique (school_id, student_id, billing_month)
);

create index vouchers_school_month_idx on public.fee_vouchers(school_id, billing_month);
create index vouchers_status_idx on public.fee_vouchers(school_id, status);

-- Voucher line items
create table public.voucher_items (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.fee_vouchers(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  fee_head_id uuid references public.fee_heads(id) on delete set null,
  fee_head_name text not null,
  amount numeric(12,2) not null default 0
);

-- Payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  voucher_id uuid not null references public.fee_vouchers(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  receipt_no text not null,
  amount numeric(12,2) not null,
  payment_method text not null default 'cash',
  paid_at timestamptz not null default now(),
  status payment_status not null default 'completed',
  notes text,
  created_by uuid references public.profiles(id),
  unique (school_id, receipt_no)
);

create index payments_school_paid_idx on public.payments(school_id, paid_at);
create index payments_status_idx on public.payments(school_id, status);

-- Payment reversals (audit trail — never delete payments)
create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict,
  reason text not null,
  reversed_at timestamptz not null default now(),
  reversed_by uuid references public.profiles(id)
);

-- Helper: current user's school_id
-- IMPORTANT: use plpgsql (not language sql) so SECURITY DEFINER is not inlined
-- into RLS policies (inlining causes "stack depth limit exceeded").
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

-- Alias used by school update policies (independent body — no mutual calls)
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

create or replace function public.current_user_role()
returns user_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r user_role;
begin
  select p.role into r
  from public.profiles p
  where p.id = auth.uid();
  return r;
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
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
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

-- Auto-create default fee heads when school becomes active
create or replace function public.seed_default_fee_heads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    insert into public.fee_heads (school_id, name, frequency, is_default)
    values
      (new.id, 'Tuition Fee', 'recurring', true),
      (new.id, 'Exam Fee', 'non_recurring', true)
    on conflict (school_id, name) do nothing;
  end if;
  return new;
end;
$$;

create trigger schools_seed_fee_heads
after update of status on public.schools
for each row execute function public.seed_default_fee_heads();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger schools_updated_at before update on public.schools
for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students
for each row execute function public.set_updated_at();
create trigger fee_structure_updated_at before update on public.fee_structure
for each row execute function public.set_updated_at();

-- RLS
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.fee_heads enable row level security;
alter table public.fee_structure enable row level security;
alter table public.fee_vouchers enable row level security;
alter table public.voucher_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_reversals enable row level security;

-- Schools policies
create policy "schools_select_own_or_super"
  on public.schools for select
  using (
    id = public.get_my_school_id()
    or public.is_super_admin()
  );

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

create policy "schools_insert_signup"
  on public.schools for insert
  with check (true);

-- Profiles policies
create policy "profiles_select_own_or_super"
  on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid() or public.is_super_admin());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid() or public.is_super_admin());

-- Generic school-scoped CRUD for school_admin
create policy "students_all_own"
  on public.students for all
  using (school_id = public.current_school_id() and public.is_approved_school_admin())
  with check (school_id = public.current_school_id() and public.is_approved_school_admin());

create policy "fee_heads_all_own"
  on public.fee_heads for all
  using (school_id = public.current_school_id() and public.is_approved_school_admin())
  with check (school_id = public.current_school_id() and public.is_approved_school_admin());

create policy "fee_structure_all_own"
  on public.fee_structure for all
  using (school_id = public.current_school_id() and public.is_approved_school_admin())
  with check (school_id = public.current_school_id() and public.is_approved_school_admin());

create policy "vouchers_all_own"
  on public.fee_vouchers for all
  using (school_id = public.current_school_id() and public.is_approved_school_admin())
  with check (school_id = public.current_school_id() and public.is_approved_school_admin());

create policy "voucher_items_all_own"
  on public.voucher_items for all
  using (school_id = public.current_school_id() and public.is_approved_school_admin())
  with check (school_id = public.current_school_id() and public.is_approved_school_admin());

create policy "payments_all_own"
  on public.payments for all
  using (school_id = public.current_school_id() and public.is_approved_school_admin())
  with check (school_id = public.current_school_id() and public.is_approved_school_admin());

create policy "reversals_all_own"
  on public.payment_reversals for all
  using (school_id = public.current_school_id() and public.is_approved_school_admin())
  with check (school_id = public.current_school_id() and public.is_approved_school_admin());

-- Super admin can read all schools for approval queue
create policy "schools_super_select_all"
  on public.schools for select
  using (public.is_super_admin());

-- Storage bucket for logos (run separately if needed)
-- insert into storage.buckets (id, name, public) values ('school-logos', 'school-logos', true);
