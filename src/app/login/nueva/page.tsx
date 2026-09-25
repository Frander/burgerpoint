import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import NewPasswordForm from "@/components/auth/NewPasswordForm";

/**
 * Llega aquí desde el enlace de recuperación (/auth/confirm ya abrió sesión).
 * Sin sesión el enlace no sirvió o ya venció: de vuelta al login con aviso.
 */
export default async function NuevaContrasenaPage() {
  if (!isSupabaseConfigured()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=enlace");

  return <NewPasswordForm email={user.email ?? ""} />;
}
