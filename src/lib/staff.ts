import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffRole } from "@/lib/types";

export interface StaffUser {
  id: string;
  email: string;
  full_name: string | null;
  role: StaffRole;
  created_at: string;
  last_sign_in_at: string | null;
}

/**
 * El staff completo: `profiles` tiene el rol y el nombre, pero el correo vive
 * en `auth.users`, al que solo se llega con la llave de servicio. Por eso esta
 * función es server-only y nunca se expone al navegador.
 */
export async function getStaffUsers(): Promise<StaffUser[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const supabase = await createClient();
  const [{ data: perfiles }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role"),
    admin.auth.admin.listUsers({ perPage: 500 }),
  ]);

  const porId = new Map(
    ((perfiles ?? []) as { id: string; full_name: string | null; role: StaffRole }[]).map(
      (p) => [p.id, p],
    ),
  );

  return (auth?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(sin correo)",
      full_name: porId.get(u.id)?.full_name ?? null,
      role: porId.get(u.id)?.role ?? "cajero",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email, "es"));
}
