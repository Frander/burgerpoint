import Link from "next/link";

const ADDRESS = "México 188 246, Ticul, 97864 Ticul, Yuc., México";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  ADDRESS,
)}`;

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4">
      <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 text-5xl dark:bg-amber-500/15">
          🍔
        </div>

        <h1 className="text-4xl font-bold tracking-tight">Burger Point</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Ticul, Yucatán
        </p>

        <h2 className="mt-8 text-2xl font-semibold">🤩 ¡Bienvenid@s!</h2>
        <p className="mt-2 max-w-md text-balance text-black/70 dark:text-white/70">
          Bienvenidos al lugar para los amantes de las hamburguesas 🍔
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="rounded-full border border-black/15 px-3 py-1 dark:border-white/15">
            🛍️ Para llevar
          </span>
          <span className="rounded-full border border-black/15 px-3 py-1 dark:border-white/15">
            🛵 A domicilio
          </span>
        </div>

        <Link
          href="/menu"
          className="mt-10 inline-flex items-center justify-center rounded-full bg-black px-10 py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          Ver menú y pedir
        </Link>

        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 max-w-xs text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50"
        >
          📍 {ADDRESS}
        </a>
      </section>

      <footer className="border-t border-black/10 py-6 text-center text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        <Link href="/admin" className="underline hover:text-black/70">
          Acceso al panel administrativo
        </Link>
      </footer>
    </main>
  );
}
