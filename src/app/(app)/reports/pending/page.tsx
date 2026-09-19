import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PendingReportClient } from "@/components/reports/PendingReportClient";

export default async function PendingReportPage() {
  const user = await getAppUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("fee_vouchers")
    .select(
      "id, total_amount, billing_month, voucher_no, students(name, class, section, gr_no)"
    )
    .eq("school_id", user.schoolId!)
    .eq("status", "unpaid")
    .order("billing_month", { ascending: false });

  const rows =
    data?.map((v) => {
      const s = Array.isArray(v.students) ? v.students[0] : v.students;
      return {
        id: v.id,
        total_amount: Number(v.total_amount),
        billing_month: v.billing_month,
        voucher_no: v.voucher_no,
        student_name: s?.name ?? "—",
        class: s?.class ?? "—",
        section: s?.section ?? "—",
        gr_no: s?.gr_no ?? "—",
      };
    }) ?? [];

  return <PendingReportClient rows={rows} />;
}
