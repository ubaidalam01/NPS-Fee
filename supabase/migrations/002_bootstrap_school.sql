-- Single-client bootstrap: one school + one school_admin
-- Run AFTER 001_schema.sql
--
-- Steps:
-- 1. Authentication → Users → Add user
--    - Email: your admin email
--    - Password: choose a strong password
--    - Auto Confirm User: ON
-- 2. Replace the placeholders below and run this script in SQL Editor

-- A) Create the school as pending first (status default), then activate.
--    Activating seeds default fee heads via trigger (Tuition Fee, Exam Fee).
insert into public.schools (name, contact_email, contact_phone, address, status)
values (
  'YOUR SCHOOL NAME',
  'school-contact@example.com',  -- optional public contact (not login)
  '0300-0000000',                -- optional
  'School address',              -- optional
  'pending'
)
returning id;
-- Copy the returned id, then:

update public.schools
set status = 'active'
where name = 'YOUR SCHOOL NAME';
-- Or: where id = 'PASTE_SCHOOL_UUID';

-- B) Link the Auth user as school_admin
insert into public.profiles (id, school_id, full_name, role)
select
  u.id,
  s.id,
  coalesce(u.raw_user_meta_data->>'full_name', 'School Admin'),
  'school_admin'
from auth.users u
cross join public.schools s
where u.email = 'YOUR_ADMIN@email.com'
  and s.name = 'YOUR SCHOOL NAME'
on conflict (id) do update
set
  school_id = excluded.school_id,
  full_name = excluded.full_name,
  role = 'school_admin';
