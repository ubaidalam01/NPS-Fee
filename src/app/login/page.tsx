"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Card } from "@/components/ui";
import { homeForProfile } from "@/lib/auth-routing";
import type { UserRole } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();

    try {
      const loginResult = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Login timed out. Please try again.")),
            20000
          )
        ),
      ]);

      const { data, error: authError } = loginResult;

      if (authError || !data.user) {
        setError(authError?.message ?? "Login failed");
        return;
      }

      const profileResult = await Promise.race([
        supabase
          .from("profiles")
          .select("role, school_id")
          .eq("id", data.user.id)
          .maybeSingle(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Could not load your profile (timed out). Please try again."
                )
              ),
            15000
          )
        ),
      ]);

      const { data: profile, error: profileError } = profileResult;

      if (profileError || !profile?.role) {
        setError(
          profileError?.message ||
            "Profile not found. Contact support."
        );
        await supabase.auth.signOut();
        return;
      }

      const role = profile.role as UserRole;

      if (role !== "school_admin" || !profile.school_id) {
        setError("This account is not authorized for school access.");
        await supabase.auth.signOut();
        return;
      }

      router.replace(
        homeForProfile({
          role: "school_admin",
          schoolId: profile.school_id,
        })
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#d4ebef_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_#e8f4c8_0%,_transparent_45%)]" />
      <Card className="relative w-full max-w-md p-8 animate-fade-up">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-lime">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-navy">NPS Fee Manager</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to manage your school fees
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@school.edu.pk"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
