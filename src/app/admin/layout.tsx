import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/cocina", label: "Cocina" },
  { href: "/admin/menu", label: "Menú" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/reportes", label: "Reportes" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-black/10 bg-black/[.02] p-4 dark:border-white/10 dark:bg-white/[.02]">
        <Link href="/admin" className="block text-lg font-bold">
          🍔 Burger Point
        </Link>
        <p className="mb-6 text-xs text-black/50 dark:text-white/50">Panel</p>
        <nav className="flex flex-col gap-1">
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
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
