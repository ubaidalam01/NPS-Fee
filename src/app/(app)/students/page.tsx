import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StudentsClient } from "@/components/students/StudentsClient";

export default async function StudentsPage() {
  // Shares React cache() with layout — no extra auth/profile fetch
  const user = await getAppUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("school_id", user.schoolId!)
    .order("class")
    .order("section")
    .order("name");

  return <StudentsClient initialStudents={data ?? []} />;
}
