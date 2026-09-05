"use server";

import { revalidatePath } from "next/cache";
import { assertSection } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/roles";
import type { StaffRole } from "@/lib/types";

export interface Result {
  ok: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath("/admin/usuarios");
}

/**
 * Crear, borrar y cambiar contraseñas toca `auth.users`, y a eso solo se llega
 * con la llave de servicio. Todas las acciones de este archivo exigen antes el
 * permiso de la sección "usuarios", que solo tiene el admin.
 */
async function adminClient() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno: sin ella no se pueden administrar usuarios.",
    );
  }
  return admin;
}

function validarRol(role: string): role is StaffRole {
  return (ROLES as string[]).includes(role);
}

/** Da de alta a alguien del staff y le pone su rol de una vez. */
export async function createStaffUser(input: {
  email: string;
  password: string;
  full_name: string;
  role: string;
}): Promise<Result> {
  await assertSection("usuarios");

  const email = input.email.trim().toLowerCase();
  const nombre = input.full_name.trim();
  if (!email) return { ok: false, error: "Falta el correo." };
  if (!nombre) return { ok: false, error: "Falta el nombre." };
  if (input.password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!validarRol(input.role)) return { ok: false, error: "Rol inválido." };

  const admin = await adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true, // el staff no verifica correo: lo da de alta el jefe
  });
  if (error) return { ok: false, error: error.message };

  // El trigger handle_new_user ya creó el perfil; aquí solo se completa.
  const { error: perfilErr } = await admin
    .from("profiles")
    .update({ role: input.role, full_name: nombre })
    .eq("id", data.user.id);
  if (perfilErr) {
    // Sin rol el usuario existiría a medias; se deshace el alta.
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: `No se pudo asignar el rol: ${perfilErr.message}` };
  }

  revalidate();
  return { ok: true };
}

/** Cambia el rol de alguien. Nadie puede cambiarse el suyo (evita quedarse fuera). */
export async function updateStaffRole(
  userId: string,
  role: string,
): Promise<Result> {
  const yo = await assertSection("usuarios");
  if (!validarRol(role)) return { ok: false, error: "Rol inválido." };
  if (userId === yo.id) {
    return {
      ok: false,
      error: "No puedes cambiar tu propio rol: pídeselo a otro administrador.",
    };
  }

  const admin = await adminClient();
  if (await esUltimoAdmin(userId, role)) {
    return {
      ok: false,
      error: "Es el único administrador que queda. Nombra otro antes de bajarlo de rol.",
    };
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function updateStaffName(
  userId: string,
  fullName: string,
): Promise<Result> {
  await assertSection("usuarios");
  const nombre = fullName.trim();
  if (!nombre) return { ok: false, error: "El nombre no puede quedar vacío." };

  const admin = await adminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: nombre })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

/** Le pone una contraseña nueva a alguien (los correos internos no tienen recuperación). */
export async function resetStaffPassword(
  userId: string,
  password: string,
): Promise<Result> {
  await assertSection("usuarios");
  if (password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = await adminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

/** Borra una cuenta. No te puedes borrar a ti mismo ni dejar al negocio sin admin. */
export async function deleteStaffUser(userId: string): Promise<Result> {
  const yo = await assertSection("usuarios");
  if (userId === yo.id) {
    return { ok: false, error: "No puedes borrar tu propia cuenta." };
  }

  const admin = await adminClient();
  if (await esUltimoAdmin(userId, null)) {
    return {
      ok: false,
      error: "Es el único administrador que queda. Nombra otro antes de borrarlo.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

/**
 * ¿Este cambio dejaría al negocio sin ningún admin? `nuevoRol` null = se borra.
 * Red de seguridad para no quedarse sin quien entre al panel completo.
 */
async function esUltimoAdmin(
  userId: string,
  nuevoRol: string | null,
): Promise<boolean> {
  if (nuevoRol === "admin") return false;

  const admin = await adminClient();
  const { data } = await admin.from("profiles").select("id").eq("role", "admin");
  const admins = (data ?? []) as { id: string }[];
  return admins.length <= 1 && admins.some((a) => a.id === userId);
}
