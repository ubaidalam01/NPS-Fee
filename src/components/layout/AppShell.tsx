"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Grid3X3,
  Wallet,
  History,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  GraduationCap,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/types";
import { AppAlertHost } from "@/components/AppAlertHost";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Student Manager", icon: Users },
  { href: "/fee-structure", label: "Fee Structure", icon: Grid3X3 },
  { href: "/fee-collection", label: "Fee Collection", icon: Wallet },
  { href: "/payment-history", label: "Payment History", icon: History },
  { href: "/reports/pending", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/settings", label: "School Settings", icon: Settings },
];

/** Primary destinations shown in the mobile bottom bar */
const bottomNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/fee-collection", label: "Collect", icon: Wallet },
  { href: "/payment-history", label: "History", icon: History },
];

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const SidebarContent = (
    <>
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5 pr-10 lg:pr-0">
          {user.schoolLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.schoolLogoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover bg-white ring-1 ring-border"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-lime">
              <GraduationCap className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-navy leading-tight">
              NPS Fee
            </p>
            <p className="text-[11px] text-muted truncate">{user.schoolName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 pb-4 overflow-y-auto">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-sidebar-active text-navy shadow-sm"
                  : "text-navy/80 hover:bg-white/70"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-teal" : "text-muted")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 mt-auto rounded-xl border border-white bg-white/80 p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-lime">
            {initials(user.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">
              {user.fullName}
            </p>
            <p className="text-[11px] text-muted">School Administrator</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sidebar px-2 py-2.5 text-sm font-semibold text-navy hover:bg-sidebar-active"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen min-w-0 overflow-x-clip bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/50 bg-sidebar lg:flex">
        {SidebarContent}
      </aside>

      {/* Mobile / tablet drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy/40 animate-fade-in"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col bg-sidebar shadow-xl animate-fade-up"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <button
              type="button"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/60"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 bg-navy px-3 text-white shadow-md sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              {user.schoolLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.schoolLogoUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-cover bg-white"
                />
              ) : (
                <GraduationCap className="h-5 w-5 shrink-0 text-lime" />
              )}
              <span className="truncate font-bold tracking-wide text-sm sm:text-base">
                <span className="sm:hidden">NPS Fee</span>
                <span className="hidden sm:inline">NPS Fee Manager</span>
              </span>
            </div>
          </div>

          <div className="absolute left-1/2 hidden -translate-x-1/2 sm:block">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime/20 ring-2 ring-lime/40">
              <GraduationCap className="h-4 w-4 text-lime" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-white/90">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <Users className="h-3.5 w-3.5" />
            </div>
            <span className="hidden sm:inline">Administrator</span>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-clip p-4 pb-20 sm:p-6 lg:pb-6 animate-fade-up">
          {children}
        </main>
      </div>

      {/* Mobile / tablet bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-border bg-white safe-bottom lg:hidden">
        {bottomNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold",
                active ? "text-teal" : "text-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold",
            open ? "text-teal" : "text-muted"
          )}
          aria-label="More menu"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      <AppAlertHost />
    </div>
  );
}
