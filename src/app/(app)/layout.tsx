import { requireSchoolAdmin } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { AppSessionProvider } from "@/components/providers/AppSessionProvider";

export const dynamic = "force-dynamic";

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
