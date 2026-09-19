"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SchoolProfileUpdate = {
  schoolId: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  logo_url: string | null;
};

export type SaveSchoolProfileResult =
  | { ok: true; logo_url: string | null }
  | { ok: false; error: string };

/**
 * Persist school profile. Uses the session to authorize, then writes with
 * service role so a missing/broken schools UPDATE RLS policy cannot silently
 * no-op (0 rows / HTTP 204). Still returns a clear error if nothing is saved.
 */
export async function saveSchoolProfile(
  input: SchoolProfileUpdate
): Promise<SaveSchoolProfileResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Not signed in." };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        ok: false,
        error: profileError?.message || "Could not load your profile.",
      };
    }

    if (
      profile.role !== "school_admin" &&
      profile.role !== "super_admin"
    ) {
      return { ok: false, error: "You do not have permission to update school settings." };
    }

    if (
      profile.role === "school_admin" &&
      profile.school_id !== input.schoolId
    ) {
      return { ok: false, error: "You can only update your own school." };
    }

    const admin = createAdminClient();
    const { data: updated, error: updateError } = await admin
      .from("schools")
      .update({
        name: input.name,
        address: input.address,
        contact_phone: input.contact_phone,
        contact_email: input.contact_email,
        logo_url: input.logo_url,
      })
      .eq("id", input.schoolId)
      .select("id, logo_url")
      .single();

    if (updateError || !updated) {
      return {
        ok: false,
        error:
          updateError?.message ||
          "Failed to save — please try again or contact support",
      };
    }

    return { ok: true, logo_url: updated.logo_url };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to save — please try again or contact support",
    };
  }
}
