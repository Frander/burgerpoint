import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage() {
  // Si Supabase está configurado y ya hay sesión, ir directo al panel.
  if (isSupabaseConfigured()) {
    const profile = await getProfile();
    if (profile) redirect("/admin");
  }

  return <LoginForm />;
}
