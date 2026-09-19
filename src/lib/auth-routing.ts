import type { UserRole } from "@/lib/types";

export type AuthProfile = {
  role: UserRole;
  schoolId: string | null;
};

/** Where a logged-in school_admin should land. */
export function homeForProfile(profile: AuthProfile): string {
  if (profile.role === "school_admin" && profile.schoolId) {
    return "/dashboard";
  }
  return "/login";
}
