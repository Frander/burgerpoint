import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/types";

export interface StaffProfile {
  id: string;
  full_name: string | null;
  role: StaffRole;
  email: string | null;
}

/**
 * Devuelve el perfil del staff autenticado, o null si no hay sesión.
 * Combina auth.users (email) con la tabla profiles (rol).
 */
export async function getProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    full_name: profile?.full_name ?? null,
    role: (profile?.role as StaffRole) ?? "cajero",
  };
}

/** Igual que getProfile pero redirige a /login si no hay sesión. */
export async function requireProfile(): Promise<StaffProfile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}
