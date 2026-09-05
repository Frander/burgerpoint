import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { canAccess, homeFor, type AdminSection } from "@/lib/roles";
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

/**
 * Modo preview (sin credenciales de Supabase): no hay sesión que validar, así
 * que las guardas dejan pasar. Las páginas ya avisan que falta conectar la base.
 */
const PREVIEW_PROFILE: StaffProfile = {
  id: "preview",
  email: null,
  full_name: null,
  role: "admin",
};

/**
 * Guarda de **página**: exige sesión y que el rol tenga alguna de las secciones.
 * Si no le toca, lo manda a su propia pantalla en vez de mostrar un error.
 */
export async function requireSection(
  ...sections: AdminSection[]
): Promise<StaffProfile> {
  if (!isSupabaseConfigured()) return PREVIEW_PROFILE;
  const profile = await requireProfile();
  if (!canAccess(profile.role, sections)) redirect(homeFor(profile.role));
  return profile;
}

/**
 * Guarda de **acción de servidor**: igual que `requireSection` pero lanza, para
 * que un rol sin permiso no pueda escribir aunque llame la acción a mano (el
 * menú lateral se puede esconder; una server action hay que cerrarla).
 */
export async function assertSection(
  ...sections: AdminSection[]
): Promise<StaffProfile> {
  if (!isSupabaseConfigured()) return PREVIEW_PROFILE;
  const profile = await requireProfile();
  if (!canAccess(profile.role, sections)) {
    throw new Error("No tienes permiso para esta acción.");
  }
  return profile;
}

/** Cliente de Supabase para una acción de servidor, ya validado el permiso. */
export async function sectionClient(...sections: AdminSection[]) {
  await assertSection(...sections);
  return createClient();
}
