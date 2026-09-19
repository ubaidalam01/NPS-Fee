import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { format, startOfDay, startOfMonth, subMonths } from "date-fns";

export default async function DashboardPage() {
  const user = await getAppUser();
  const supabase = await createClient();
  const schoolId = user.schoolId!;

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  // Inclusive window: start of (now − 5 months) → start of next month
  const trendRangeStart = startOfMonth(subMonths(now, 5)).toISOString();
  const trendRangeEnd = startOfMonth(subMonths(now, -1)).toISOString();

  const [
    todayRes,
    monthRes,
    receiptsRes,
    pendingVouchersRes,
    paidVouchersRes,
    recentRes,
    trendRes,
    pendingListRes,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("school_id", schoolId)
      .eq("is_voided", false)
      .gte("paid_at", todayStart),
    supabase
      .from("payments")
      .select("amount")
      .eq("school_id", schoolId)
      .eq("is_voided", false)
      .gte("paid_at", monthStart),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_voided", false),
    supabase
      .from("fee_vouchers")
      .select("total_amount")
      .eq("school_id", schoolId)
      .eq("status", "unpaid"),
    supabase
      .from("fee_vouchers")
      .select("total_amount")
      .eq("school_id", schoolId)
      .eq("status", "paid"),
    supabase
      .from("payments")
      .select(
        "id, receipt_no, amount, paid_at, fee_vouchers(students(name))"
      )
      .eq("school_id", schoolId)
      .eq("is_voided", false)
      .order("paid_at", { ascending: false })
      .limit(8),
    // One range query instead of 6 sequential per-month queries
    supabase
      .from("payments")
      .select("amount, paid_at")
      .eq("school_id", schoolId)
      .eq("is_voided", false)
      .gte("paid_at", trendRangeStart)
      .lt("paid_at", trendRangeEnd),
    supabase
      .from("fee_vouchers")
      .select("id, total_amount, students(id, name, class, section)")
      .eq("school_id", schoolId)
      .eq("status", "unpaid")
      .order("total_amount", { ascending: false })
      .limit(8),
  ]);

  const sum = (rows: { amount?: number; total_amount?: number }[] | null) =>
    (rows ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? r.total_amount ?? 0),
      0
    );

  const pendingTotal = sum(pendingVouchersRes.data);
  const paidTotal = sum(paidVouchersRes.data);

  const monthBuckets = Array.from({ length: 6 }, (_, idx) => {
    const d = subMonths(now, 5 - idx);
    return {
      key: format(d, "yyyy-MM"),
      month: format(d, "MMM"),
      amount: 0,
    };
  });
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const row of trendRes.data ?? []) {
    const key = format(new Date(row.paid_at), "yyyy-MM");
    const bucket = bucketByKey.get(key);
    if (bucket) bucket.amount += Number(row.amount);
  }
  const trend = monthBuckets.map(({ month, amount }) => ({ month, amount }));

  const pendingStudents =
    pendingListRes.data?.map((v) => {
      const s = Array.isArray(v.students) ? v.students[0] : v.students;
      return {
        id: v.id,
        name: s?.name ?? "—",
        class: s?.class ?? "—",
        section: s?.section ?? "—",
        amount: Number(v.total_amount),
      };
    }) ?? [];

  const recentPayments =
    recentRes.data?.map((p) => {
      const voucher = Array.isArray(p.fee_vouchers)
        ? p.fee_vouchers[0]
        : p.fee_vouchers;
      const studentRaw = voucher?.students;
      const s = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
      return {
        id: p.id,
        receipt_no: p.receipt_no,
        amount: Number(p.amount),
        paid_at: p.paid_at,
        student_name: s?.name ?? "—",
      };
    }) ?? [];

  return (
    <DashboardView
      kpis={{
        today: sum(todayRes.data),
        monthly: sum(monthRes.data),
        receipts: receiptsRes.count ?? 0,
        pending: pendingTotal,
      }}
      trend={trend}
      paidTotal={paidTotal}
      pendingTotal={pendingTotal}
      recentPayments={recentPayments}
      pendingStudents={pendingStudents}
    />
  );
}
