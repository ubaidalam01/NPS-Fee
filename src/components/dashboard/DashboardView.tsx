import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  Receipt,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { formatPKR, formatDate, cn } from "@/lib/utils";
import { Card, CardHeader, Badge, EmptyState, Button } from "@/components/ui";
import { MonthlyTrendChart, PaymentStatusDonut } from "./Charts";

const iconStyles = {
  teal: "bg-teal/15 text-teal",
  olive: "bg-olive/15 text-olive",
  navy: "bg-navy/10 text-navy",
  warning: "bg-warning/15 text-warning",
} as const;

export function KpiCard({
  label,
  value,
  href,
  linkLabel,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  href: string;
  linkLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof iconStyles;
}) {
  return (
    <Card className="p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {label}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            iconStyles[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
      >
        {linkLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}

export function DashboardView({
  kpis,
  trend,
  paidTotal,
  pendingTotal,
  recentPayments,
  pendingStudents,
}: {
  kpis: {
    today: number;
    monthly: number;
    receipts: number;
    pending: number;
  };
  trend: { month: string; amount: number }[];
  paidTotal: number;
  pendingTotal: number;
  recentPayments: {
    id: string;
    receipt_no: string;
    amount: number;
    paid_at: string;
    student_name: string;
  }[];
  pendingStudents: {
    id: string;
    name: string;
    class: string;
    section: string;
    amount: number;
  }[];
}) {
  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Overview of collections, receipts, and pending dues
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Today's Collection"
          value={formatPKR(kpis.today)}
          href="/payment-history"
          linkLabel="View receipts"
          icon={Banknote}
          tone="teal"
        />
        <KpiCard
          label="Monthly Collection"
          value={formatPKR(kpis.monthly)}
          href="/payment-history"
          linkLabel="This month"
          icon={CalendarDays}
          tone="olive"
        />
        <KpiCard
          label="Receipts Generated"
          value={String(kpis.receipts)}
          href="/fee-collection"
          linkLabel="Collect fees"
          icon={Receipt}
          tone="navy"
        />
        <KpiCard
          label="Total Pending"
          value={formatPKR(kpis.pending)}
          href="/reports/pending"
          linkLabel="Pending report"
          icon={AlertCircle}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Monthly Collection Trend"
            subtitle="Last 6 months"
          />
          <div className="p-4">
            <MonthlyTrendChart data={trend} />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Payment Status"
            subtitle="Paid vs pending vouchers"
          />
          <div className="p-4">
            <PaymentStatusDonut paid={paidTotal} pending={pendingTotal} />
            <div className="mt-2 flex justify-center gap-6 text-xs font-semibold">
              <span className="flex items-center gap-2 text-teal">
                <span className="h-2.5 w-2.5 rounded-full bg-teal" /> Paid
              </span>
              <span className="flex items-center gap-2 text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-[#c5d4db]" /> Pending
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-sm font-bold text-navy">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/fee-collection">
            <Button variant="primary">Collect Fees</Button>
          </Link>
          <Link href="/students">
            <Button variant="navy">Add Student</Button>
          </Link>
          <Link href="/fee-structure">
            <Button variant="navy">Fee Structure</Button>
          </Link>
          <Link href="/reports/pending">
            <Button variant="navy">Pending Dues</Button>
          </Link>
          <Link href="/settings/export">
            <Button variant="navy">Export Data</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Payment Receipts" />
          {recentPayments.length === 0 ? (
            <EmptyState message="No payments collected yet." />
          ) : (
            <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto">
              {recentPayments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">
                      {p.student_name}
                    </p>
                    <p className="text-xs text-muted">
                      {p.receipt_no} · {formatDate(p.paid_at)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-teal">
                    {formatPKR(p.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Students with Pending Dues"
            action={
              <Link href="/reports/pending">
                <Badge tone="warning">View all</Badge>
              </Link>
            }
          />
          {pendingStudents.length === 0 ? (
            <EmptyState message="No pending dues. Great work!" />
          ) : (
            <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto">
              {pendingStudents.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">
                      {s.name}
                    </p>
                    <p className="text-xs text-muted">
                      Class {s.class}-{s.section}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-warning">
                    {formatPKR(s.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
