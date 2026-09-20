import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PaymentHistoryClient } from "@/components/payments/PaymentHistoryClient";

export default async function PaymentHistoryPage() {
  // Shares React cache() with layout — no extra auth/profile fetch
  const user = await getAppUser();
  const supabase = await createClient();
  const schoolId = user.schoolId!;

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, receipt_no, amount, paid_at, is_voided, voided_at, voucher_id, fee_vouchers(voucher_no, billing_month, student_id, students(name, father_name, class, section, gr_no))"
    )
    .eq("school_id", schoolId)
    .order("paid_at", { ascending: false });

  const rows =
    payments?.map((p) => {
      const voucher = Array.isArray(p.fee_vouchers)
        ? p.fee_vouchers[0]
        : p.fee_vouchers;
      const studentRaw = voucher?.students;
      const students = Array.isArray(studentRaw)
        ? studentRaw[0]
        : studentRaw ?? null;
      return {
        id: p.id,
        receipt_no: p.receipt_no,
        amount: Number(p.amount),
        paid_at: p.paid_at,
        is_voided: Boolean(p.is_voided),
        voided_at: p.voided_at,
        voucher_id: p.voucher_id,
        students,
        fee_vouchers: voucher
          ? {
              voucher_no: voucher.voucher_no,
              billing_month: voucher.billing_month,
            }
          : null,
      };
    }) ?? [];

  return <PaymentHistoryClient initialPayments={rows} />;
}
