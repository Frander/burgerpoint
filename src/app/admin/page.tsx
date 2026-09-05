import Link from "next/link";
import { requireSection } from "@/lib/supabase/auth";
import { navFor } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Portada del panel. Solo la ve `admin`: al cajero y a cocina `requireSection`
 * los manda directo a su pantalla de trabajo (PDV y KDS).
 */
export default async function AdminHome() {
  const profile = await requireSection("inicio");
  const modules = navFor(profile.role).filter((s) => s.id !== "inicio");

  return (
    <div>
      <h1 className="text-2xl font-bold">Panel administrativo</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Administra tu restaurante desde aquí.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-black/10 p-5 transition hover:border-black/30 hover:bg-black/[.02] dark:border-white/10 dark:hover:border-white/30 dark:hover:bg-white/[.02]"
          >
            <h2 className="font-semibold">{m.label}</h2>
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              {m.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
