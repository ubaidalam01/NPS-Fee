import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FeeCollectionClient } from "@/components/fee/FeeCollectionClient";
import { toBillingMonth } from "@/lib/utils";

export default async function FeeCollectionPage() {
  const user = await getAppUser();
  const supabase = await createClient();
  const schoolId = user.schoolId!;
  const month = toBillingMonth();

  const [
    { data: students },
    { data: feeHeads },
    { data: structure },
    { data: vouchers },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("name"),
    supabase.from("fee_heads").select("*").eq("school_id", schoolId),
    supabase.from("class_fee_structures").select("*").eq("school_id", schoolId),
    supabase
      .from("fee_vouchers")
      .select("id, student_id, status, total_amount, voucher_no, billing_month")
      .eq("school_id", schoolId)
      .eq("billing_month", month),
  ]);

  return (
    <FeeCollectionClient
      students={students ?? []}
      feeHeads={feeHeads ?? []}
      structure={structure ?? []}
      initialVouchers={vouchers ?? []}
    />
  );
}
