import Link from "next/link";

export default function StorefrontPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="border-b border-black/10 pb-6 dark:border-white/10">
        <h1 className="text-3xl font-bold tracking-tight">🍔 Burger Point</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Ticul, Yucatán · Entrega 20–35 min
        </p>
      </header>

      <section className="mt-10 rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
        <h2 className="text-lg font-semibold">Menú en construcción</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Aquí irá el catálogo de productos por categoría con carrito y pedido
          por WhatsApp.{" "}
          <span className="font-medium">(Fase 1)</span>
        </p>
      </section>

      <footer className="mt-10 text-center text-xs text-black/40 dark:text-white/40">
        <Link href="/admin" className="underline hover:text-black/70">
          Acceso al panel administrativo
        </Link>
      </footer>
    </main>
  );
}
