import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import { homeForProfile, type AuthProfile } from "@/lib/auth-routing";
import type { UserRole } from "@/lib/types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const { url, anonKey, configured } = getSupabaseEnv();

  if (!configured) {
    if (
      path.startsWith("/setup") ||
      path.startsWith("/_next") ||
      path === "/favicon.ico"
    ) {
      return supabaseResponse;
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/setup";
    return NextResponse.redirect(redirect);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicAuth =
    path.startsWith("/login") || path.startsWith("/setup");
  const isAppRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/students") ||
    path.startsWith("/fee-structure") ||
    path.startsWith("/fee-collection") ||
    path.startsWith("/payment-history") ||
    path.startsWith("/reports") ||
    path.startsWith("/settings");

  function redirectTo(pathname: string) {
    const redirect = NextResponse.redirect(new URL(pathname, request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value);
    });
    return redirect;
  }

  async function signOutAndRedirect(pathname: string) {
    await supabase.auth.signOut();
    return redirectTo(pathname);
  }

  // Unauthenticated — protect app routes only
  if (!user) {
    if (isAppRoute || path === "/") {
      return redirectTo("/login");
    }
    return supabaseResponse;
  }

  // In-app navigation: session check only. Profile/school gate lives in
  // (app)/layout via requireSchoolAdmin (avoids overlapping profile fetch).
  if (isAppRoute) {
    return supabaseResponse;
  }

  // /login, /setup, / — load profile once to bounce valid admins into the app
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = profileRow?.role as UserRole | undefined;
  const profile: AuthProfile | null =
    role === "school_admin" && profileRow?.school_id
      ? { role, schoolId: profileRow.school_id }
      : null;

  if (!profile) {
    if (isPublicAuth) {
      await supabase.auth.signOut();
      return redirectTo(path);
    }
    return signOutAndRedirect("/login");
  }

  if (path === "/" || isPublicAuth) {
    return redirectTo(homeForProfile(profile));
  }

  return supabaseResponse;
}
