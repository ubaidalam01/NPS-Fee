import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FeeStructureClient } from "@/components/fee/FeeStructureClient";

export default async function FeeStructurePage() {
  const user = await getAppUser();
  const supabase = await createClient();
  const schoolId = user.schoolId!;

  const [{ data: heads }, { data: matrix }] = await Promise.all([
    supabase
      .from("fee_heads")
      .select("*")
      .eq("school_id", schoolId)
      .order("name"),
    supabase.from("class_fee_structures").select("*").eq("school_id", schoolId),
  ]);

  return (
    <FeeStructureClient
      initialHeads={heads ?? []}
      initialMatrix={matrix ?? []}
    />
  );
}
