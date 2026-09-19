import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SchoolProfileClient } from "@/components/settings/SchoolProfileClient";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const user = await getAppUser();
  const supabase = await createClient();
  const { data: school } = await supabase
    .from("schools")
    .select("*")
    .eq("id", user.schoolId!)
    .single();

  if (!school) redirect("/dashboard");

  return <SchoolProfileClient school={school} />;
}
