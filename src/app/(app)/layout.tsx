import { requireSchoolAdmin } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { AppSessionProvider } from "@/components/providers/AppSessionProvider";

export const dynamic = "force-dynamic";
/** Run serverless functions in Tokyo — same region as Supabase (ap-northeast-1). */
export const preferredRegion = "hnd1";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSchoolAdmin();
  return (
    <AppSessionProvider user={user}>
      <AppShell user={user}>{children}</AppShell>
    </AppSessionProvider>
  );
}
