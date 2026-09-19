export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    url: url?.trim() || "",
    anonKey: anonKey?.trim() || "",
    configured: Boolean(url?.trim() && anonKey?.trim()),
  };
}
