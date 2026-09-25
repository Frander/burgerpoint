import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { homeFor } from "@/lib/roles";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Si ya hay sesión, ir directo a la pantalla del rol (el repartidor no
  // tiene por qué pasar por el panel para que este lo rebote).
  if (isSupabaseConfigured()) {
    const profile = await getProfile();
    if (profile) redirect(homeFor(profile.role));
  }

  const { error } = await searchParams;
  return <LoginForm linkError={error === "enlace"} />;
}
