import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { format, subMonths } from "date-fns";

/** Pakistan Standard Time — no DST (UTC+5). School cash dates use local calendar days. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Instant for 00:00:00 on the PKT calendar day that contains `d`. */
function startOfDayPktIso(d = new Date()): string {
  const pkt = new Date(d.getTime() + PKT_OFFSET_MS);
  const y = pkt.getUTCFullYear();
  const m = pkt.getUTCMonth();
  const day = pkt.getUTCDate();
  return new Date(Date.UTC(y, m, day) - PKT_OFFSET_MS).toISOString();
}

/** Instant for 00:00:00 on the 1st of the PKT calendar month that contains `d`. */
function startOfMonthPktIso(d = new Date()): string {
  const pkt = new Date(d.getTime() + PKT_OFFSET_MS);
  const y = pkt.getUTCFullYear();
  const m = pkt.getUTCMonth();
  return new Date(Date.UTC(y, m, 1) - PKT_OFFSET_MS).toISOString();
}

function sumAmounts(
  rows: { amount?: number; total_amount?: number }[] | null
): number {
  return (rows ?? []).reduce(
    (acc, r) => acc + Number(r.amount ?? r.total_amount ?? 0),
    0
  );
}

export default async function DashboardPage() {
  // getAppUser shares React cache() with (app)/layout — no second auth round trip
  const user = await getAppUser();
  const supabase = await createClient();
  const schoolId = user.schoolId!;

  const now = new Date();
  // Monthly / today's collection = cash received (paid_at), not billing_month
  const todayStart = startOfDayPktIso(now);
  const monthStart = startOfMonthPktIso(now);
  // Inclusive window: start of (now − 5 months) → start of next month (UTC calendar OK for trend buckets)
  const trendRangeStart = startOfMonthPktIso(subMonths(now, 5));
  const trendRangeEnd = startOfMonthPktIso(subMonths(now, -1));

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
    // Today's Collection — paid_at since start of today (PKT), exclude voided
    supabase
      .from("payments")
      .select("amount")
      .eq("school_id", schoolId)
      .eq("is_voided", false)
      .gte("paid_at", todayStart),
    // Monthly Collection — paid_at since start of this calendar month (PKT)
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
    // Total Pending — unpaid voucher dues (not payments)
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

  const pendingTotal = sumAmounts(pendingVouchersRes.data);
  const paidTotal = sumAmounts(paidVouchersRes.data);

  const monthBuckets = Array.from({ length: 6 }, (_, idx) => {
    const d = subMonths(now, 5 - idx);
    const pkt = new Date(d.getTime() + PKT_OFFSET_MS);
    const y = pkt.getUTCFullYear();
    const m = pkt.getUTCMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const labelDate = new Date(Date.UTC(y, m, 15));
    return {
      key,
      month: format(labelDate, "MMM"),
      amount: 0,
    };
  });
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const row of trendRes.data ?? []) {
    // Bucket by PKT calendar month of paid_at
    const pkt = new Date(new Date(row.paid_at).getTime() + PKT_OFFSET_MS);
    const key = `${pkt.getUTCFullYear()}-${String(pkt.getUTCMonth() + 1).padStart(2, "0")}`;
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
        today: sumAmounts(todayRes.data),
        monthly: sumAmounts(monthRes.data),
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
