const MODULES = [
  { title: "Pedidos", desc: "Ver y gestionar pedidos entrantes", fase: "Fase 2" },
  { title: "Cocina (KDS)", desc: "Pantalla en tiempo real", fase: "Fase 3" },
  { title: "Menú", desc: "Productos y categorías", fase: "Fase 2" },
  { title: "Inventario", desc: "Control de stock", fase: "Fase 4" },
  { title: "Reportes", desc: "Ventas y productos top", fase: "Fase 4" },
];

export default function AdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Panel administrativo</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Estructura base lista (Fase 0). Cada módulo se construye en su fase.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <div
            key={m.title}
            className="rounded-xl border border-black/10 p-5 dark:border-white/10"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{m.title}</h2>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
                {m.fase}
              </span>
            </div>
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              {m.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
