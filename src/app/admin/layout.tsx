import Link from "next/link";
import { getProfile } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/cocina", label: "Cocina" },
  { href: "/admin/menu", label: "Menú" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/reportes", label: "Reportes" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = isSupabaseConfigured() ? await getProfile() : null;

  return (
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-black/10 bg-black/[.02] p-4 dark:border-white/10 dark:bg-white/[.02]">
        <Link href="/admin" className="block text-lg font-bold">
          🍔 Burger Point
        </Link>
        <p className="mb-6 text-xs text-black/50 dark:text-white/50">Panel</p>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {profile && (
          <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
            <p className="truncate text-xs font-medium" title={profile.email ?? ""}>
              {profile.email}
            </p>
            <p className="mb-2 text-xs capitalize text-black/50 dark:text-white/50">
              {profile.role}
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
