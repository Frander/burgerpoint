import type { Metadata } from "next";
import { getProfile } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Mis entregas — Burguer Point",
};

/**
 * Shell de la pantalla del repartidor. A diferencia del panel, no hay menú
 * lateral: el repartidor trabaja desde el celular con una sola mano, así que
 * la pantalla es una columna y la barra superior es fija.
 */
export default async function RepartidorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = isSupabaseConfigured() ? await getProfile() : null;
  const nombre = profile?.full_name || profile?.email || "";

  return (
    <div className="flex min-h-full flex-col bg-black/[.02] dark:bg-transparent">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-black/80">
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight">🛵 Mis entregas</p>
          <p className="truncate text-xs text-black/50 dark:text-white/50">
            {nombre}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="shrink-0 rounded-full border border-black/15 px-3 py-1.5 text-xs text-red-600 dark:border-white/15"
          >
            Salir
          </button>
        </form>
      </header>
      <main className="flex-1 px-3 pb-24 pt-3">{children}</main>
    </div>
  );
}
