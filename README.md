# NPS Fee Manager

School fee management for Pakistani educational institutions.

**Stack:** Next.js (App Router) · Tailwind CSS · Supabase (Auth + Postgres + RLS) · Recharts · Vercel

## Features

1. Student Manager — CRUD, search/filter by class & section  
2. Fee Structure — class × fee-head matrix + fee heads  
3. Fee Collection — monthly vouchers, full cash payment only  
4. Payment History — filter, reprint receipt, void with audit trail  
5. Pending Fee Report  
6. Dashboard — KPIs, trend line, paid-vs-pending donut  
7. School Profile  
8. Data Export (CSV / Excel)  
9. Login for the school admin (single-client deployment)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `supabase/migrations/001_schema.sql`.
3. Run `supabase/migrations/003_school_logos_storage.sql` (creates the public `school-logos` Storage bucket + upload policies). If the bucket already exists, the policies section is still required.
4. Run `supabase/migrations/004_schools_update_rls.sql` (fixes schools UPDATE RLS so school profile / logo_url can persist).
5. Run `supabase/migrations/005_fix_rls_helper_recursion.sql` (required after 004 — prevents login hang from RLS helper recursion).
6. Create the school + admin user (see **Single-client bootstrap** below, or `supabase/migrations/002_bootstrap_school.sql`).
7. Copy Project URL and anon key from **Settings → API**.

### 2. App

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Single-client bootstrap

There is no public signup. Create the school and admin once in Supabase (see `002_bootstrap_school.sql` and the steps documented after deploy changes).

School `status` must be `active` so RLS (`is_approved_school_admin`) allows data access. Updating a school from `pending` → `active` also seeds default fee heads (Tuition Fee, Exam Fee).

### 4. Deploy on Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add the same env vars in Vercel project settings.
3. Deploy.

## Roles

| Role | Access |
|------|--------|
| `school_admin` | Own school data only (RLS via `school_id`) |

The schema still supports `super_admin` and multi-school rows for a possible future multi-tenant mode; the UI no longer exposes signup or an approval panel.

## Out of scope (v1)

Payment gateways · attendance/payroll · multi-user roles · SMS/email · partial payments / discounts
