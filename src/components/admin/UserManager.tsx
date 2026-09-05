"use client";

import { useState, useTransition } from "react";
import {
  createStaffUser,
  deleteStaffUser,
  resetStaffPassword,
  updateStaffName,
  updateStaffRole,
} from "@/app/admin/usuarios/actions";
import { ROLES, ROLE_META } from "@/lib/roles";
import type { StaffUser } from "@/lib/staff";
import type { StaffRole } from "@/lib/types";

/**
 * Contraseña legible para dictar por teléfono: dos bloques de letras y uno de
 * números, sin caracteres que se confundan (l/1, o/0). El encargado la genera
 * y se la pasa al empleado; no hay que inventarla.
 */
function generarPassword(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const numeros = "23456789";
  const pick = (set: string, n: number) => {
    const bytes = new Uint32Array(n);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => set[b % set.length]).join("");
  };
  return `${pick(letras, 4)}-${pick(letras, 4)}-${pick(numeros, 4)}`;
}

function fecha(iso: string | null): string {
  if (!iso) return "nunca";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      timeZone: "America/Merida",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function UserManager({
  users,
  currentUserId,
}: {
  users: StaffUser[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Alta
  const [abrirAlta, setAbrirAlta] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<StaffRole>("cajero");
  const [password, setPassword] = useState("");

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    exito?: string,
  ) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) setError(res.error ?? "No se pudo completar la acción.");
        else if (exito) setAviso(exito);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function crear() {
    if (!password) {
      setError("Genera una contraseña antes de crear la cuenta.");
      return;
    }
    const datos = { email, full_name: nombre, role: rol, password };
    run(async () => {
      const res = await createStaffUser(datos);
      if (res.ok) {
        setAviso(
          `Cuenta creada. Anota la contraseña de ${datos.email}: ${datos.password} — no se vuelve a mostrar.`,
        );
        setEmail("");
        setNombre("");
        setPassword("");
        setRol("cajero");
        setAbrirAlta(false);
      }
      return res;
    });
  }

  function nuevaPassword(u: StaffUser) {
    const nueva = generarPassword();
    if (
      !confirm(
        `Se le pondrá una contraseña nueva a ${u.email}.\n\n${nueva}\n\nAnótala: no se vuelve a mostrar. ¿Continuar?`,
      )
    )
      return;
    run(
      () => resetStaffPassword(u.id, nueva),
      `Contraseña nueva de ${u.email}: ${nueva}`,
    );
  }

  function borrar(u: StaffUser) {
    if (
      !confirm(
        `¿Borrar la cuenta de ${u.email}? Perderá el acceso al instante. Esto no se puede deshacer.`,
      )
    )
      return;
    run(() => deleteStaffUser(u.id), `Cuenta de ${u.email} borrada.`);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            El staff que puede entrar al sistema y qué ve cada quien.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAbrirAlta((v) => !v);
            setPassword("");
          }}
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {abrirAlta ? "Cancelar" : "+ Nuevo usuario"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200">
          {aviso}
        </p>
      )}

      {abrirAlta && (
        <div className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <h2 className="font-semibold">Nuevo usuario</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50 dark:text-white/50">
                Nombre
              </span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Juan Pérez"
                className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50 dark:text-white/50">
                Correo
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@burgerpoint.local"
                className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50 dark:text-white/50">Rol</span>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as StaffRole)}
                className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_META[r].label} — {ROLE_META[r].desc}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50 dark:text-white/50">
                Contraseña
              </span>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={password}
                  placeholder="Pulsa Generar"
                  className="w-full rounded-md border border-black/15 px-3 py-2 font-mono dark:border-white/15 dark:bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generarPassword())}
                  className="shrink-0 rounded-md border border-black/15 px-3 py-2 text-xs font-medium dark:border-white/15"
                >
                  Generar
                </button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-black/50 dark:text-white/50">
            Apunta la contraseña antes de crear la cuenta: no se vuelve a mostrar.
            Si se pierde, aquí mismo puedes generar otra.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={crear}
            className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Crear usuario
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {users.map((u) => {
          const soyYo = u.id === currentUserId;
          return (
            <div
              key={u.id}
              className="rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.full_name || "(sin nombre)"}
                    {soyYo && (
                      <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs font-normal dark:bg-white/10">
                        tú
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-black/60 dark:text-white/60">
                    {u.email}
                  </p>
                  <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                    Alta {fecha(u.created_at)} · Último acceso{" "}
                    {fecha(u.last_sign_in_at)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={u.role}
                    disabled={isPending || soyYo}
                    title={
                      soyYo
                        ? "No puedes cambiar tu propio rol"
                        : "Cambiar el rol"
                    }
                    onChange={(e) =>
                      run(
                        () => updateStaffRole(u.id, e.target.value),
                        `${u.email} ahora es ${
                          ROLE_META[e.target.value as StaffRole].label
                        }.`,
                      )
                    }
                    className="rounded-md border border-black/15 px-2 py-1.5 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const nuevo = prompt("Nombre:", u.full_name ?? "");
                      if (nuevo !== null)
                        run(() => updateStaffName(u.id, nuevo), "Nombre guardado.");
                    }}
                    className="rounded-full border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => nuevaPassword(u)}
                    className="rounded-full border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                  >
                    Nueva contraseña
                  </button>
                  <button
                    type="button"
                    disabled={isPending || soyYo}
                    onClick={() => borrar(u)}
                    className="rounded-full border border-black/15 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50 dark:border-white/15"
                  >
                    Borrar
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                {ROLE_META[u.role].desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
