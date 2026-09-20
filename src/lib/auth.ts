import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SchoolStatus, SessionUser, UserRole } from "@/lib/types";
import { redirect } from "next/navigation";

type SchoolEmbed = {
  id: string;
  name: string;
  status: SchoolStatus;
  address: string | null;
  contact_phone: string | null;
  logo_url: string | null;
};

function unwrapSchool(
  schools: SchoolEmbed | SchoolEmbed[] | null | undefined
): SchoolEmbed | null {
  if (!schools) return null;
  return Array.isArray(schools) ? (schools[0] ?? null) : schools;
}

/**
 * Request-scoped session load. React cache() ensures layout + pages +
 * server actions share one getUser + one joined profiles/schools query
 * per request (not once per caller).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  type ProfileRow = {
    full_name: string;
    role: string;
    school_id: string | null;
    schools?: SchoolEmbed | SchoolEmbed[] | null;
  };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "full_name, role, school_id, schools(id, name, status, address, contact_phone, logo_url)"
    )
    .eq("id", user.id)
    .maybeSingle();

  // If the schools embed fails (e.g. RLS helper recursion), fall back to
  // profile-only so login/layout are not stuck with a silent null session.
  let row: ProfileRow | null = profile as ProfileRow | null;
  if (profileError || !profile) {
    const { data: basic, error: basicError } = await supabase
      .from("profiles")
      .select("full_name, role, school_id")
      .eq("id", user.id)
      .maybeSingle();
    if (basicError || !basic?.role) return null;
    row = { ...basic, schools: null };
  }

  if (!row?.role) return null;

  const school = unwrapSchool(row.schools);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: row.full_name,
    role: row.role as UserRole,
    schoolId: row.school_id,
    schoolName: school?.name ?? null,
    schoolStatus: school?.status ?? null,
    schoolAddress: school?.address ?? null,
    schoolPhone: school?.contact_phone ?? null,
    schoolLogoUrl: school?.logo_url ?? null,
  };
});

/**
 * Gate for (app) routes. Also cached — safe to call from layout and pages
 * in the same request (no extra Supabase round trips).
 */
export const requireSchoolAdmin = cache(async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.role !== "school_admin" || !user.schoolId) {
    redirect("/login");
  }

  return user;
});

/** Read the request-cached school admin (alias of requireSchoolAdmin). */
export const getAppUser = requireSchoolAdmin;
