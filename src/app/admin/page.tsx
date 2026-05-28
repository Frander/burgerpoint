import Link from "next/link";

const MODULES = [
  { href: "/admin/pedidos", title: "Pedidos", desc: "Ver y gestionar pedidos entrantes" },
  { href: "/admin/cocina", title: "Cocina", desc: "Pantalla en tiempo real" },
  { href: "/admin/menu", title: "Menú", desc: "Categorías y productos" },
  { href: "/admin/inventario", title: "Inventario", desc: "Control de stock" },
  { href: "/admin/reportes", title: "Reportes", desc: "Ventas y productos top" },
];

export default function AdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Panel administrativo</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Administra tu restaurante desde aquí.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-black/10 p-5 transition hover:border-black/30 hover:bg-black/[.02] dark:border-white/10 dark:hover:border-white/30 dark:hover:bg-white/[.02]"
          >
            <h2 className="font-semibold">{m.title}</h2>
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              {m.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
