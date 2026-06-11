import Image from "next/image";
import Link from "next/link";

const ADDRESS = "México 188 246, Ticul, 97864 Ticul, Yuc., México";
const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=20.39692167,-89.54447556";
const REVIEWS_URL =
  "https://search.google.com/local/reviews?placeid=ChIJnXY2cpdTVo8Rcp3_7ONQUE4";
const WHATSAPP_URL =
  "https://api.whatsapp.com/send?phone=529971224633&text=" +
  encodeURIComponent("👋 Hola, vengo de \nDeseo realizar el siguiente pedido:\n");
const FACEBOOK_URL = "https://www.facebook.com/theburguerpointticul";

// Reseñas reales de Google mostradas en burguer-point.ola.click
const REVIEWS = [
  { author: "Román Dzul", comment: "Exelente servicio,no tardó 😋" },
  {
    author: "Claudia Rojas Moo",
    comment: "Excelente servicio y excelente comida, es una opción segura",
  },
  {
    author: "Silvana Dominguez",
    comment:
      "Excelente servicio, es un local climatizado con un ambiente familiar muy bueno ideal para pasarla en familia o amig@s. La comida es muy buena y si es a domicilio llega super rápido, el trato es amable",
  },
];

function Stars() {
  return (
    <span aria-hidden className="text-sm tracking-tight text-amber-400">
      ★★★★★
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className="relative flex-1 text-white">
      {/* Fondo: portada del restaurante con velo oscuro */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/banner.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Barra superior */}
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-4">
        <Image
          src="/logo.jpg"
          alt="Burguer Point"
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg object-cover"
        />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <a
            href={REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <span className="text-amber-400">★</span> 4.6
          </a>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-emerald-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Abierto
          </span>
        </div>
        <Link
          href="/menu"
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Pedir
        </Link>
      </header>

      {/* Héroe */}
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-12 pt-10 text-center">
        <Image
          src="/logo.jpg"
          alt="Logo de Burguer Point"
          width={96}
          height={96}
          className="h-24 w-24 rounded-2xl object-cover shadow-lg"
        />
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Burguer Point
        </h1>
        <a
          href={REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/80 hover:underline"
        >
          <Stars /> 4.6 en Google
        </a>

        <h2 className="mt-8 text-2xl font-semibold">🤩Bienvenid@s</h2>
        <p className="mt-2 max-w-md text-balance text-white/85">
          Bienvenidos al lugar para los amantes de las hamburguesas 🍔
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="rounded-full bg-white/15 px-3.5 py-1.5 font-medium backdrop-blur-sm">
            🛍️ Para llevar
          </span>
          <span className="rounded-full bg-white/15 px-3.5 py-1.5 font-medium backdrop-blur-sm">
            🛵 A domicilio
          </span>
        </div>

        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 max-w-sm text-sm text-white/70 underline-offset-2 hover:underline"
        >
          📍 {ADDRESS}
        </a>

        <Link
          href="/menu"
          className="mt-8 inline-flex w-full max-w-xs items-center justify-center rounded-full bg-white px-10 py-4 text-base font-semibold text-gray-900 shadow-lg transition hover:bg-gray-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Menu
        </Link>
      </section>

      {/* Reseñas */}
      <section className="mx-auto w-full max-w-2xl px-4 pb-10">
        <h2 className="mb-4 text-center text-lg font-semibold">
          Lo que dicen nuestros clientes
        </h2>
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {REVIEWS.map((review) => (
            <figure
              key={review.author}
              className="w-72 shrink-0 snap-start rounded-xl bg-white p-4 text-left text-gray-900 shadow-md"
            >
              <Stars />
              <blockquote className="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-600">
                {review.comment}
              </blockquote>
              <figcaption className="mt-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {review.author[0]}
                </span>
                <span className="text-sm font-medium">{review.author}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Contacto */}
      <section className="mx-auto w-full max-w-2xl space-y-3 px-4 pb-10">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl bg-white p-4 text-gray-900 shadow-md transition-shadow hover:shadow-lg"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/15 text-lg">
              💬
            </span>
            <span>
              <span className="block text-sm font-semibold">WhatsApp</span>
              <span className="block text-xs text-gray-500">997 122 4633</span>
            </span>
          </span>
          <span className="text-sm font-medium text-primary">Ir al enlace</span>
        </a>
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl bg-white p-4 text-gray-900 shadow-md transition-shadow hover:shadow-lg"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
              👍
            </span>
            <span>
              <span className="block text-sm font-semibold">Facebook</span>
              <span className="block text-xs text-gray-500">
                @theburguerpointticul
              </span>
            </span>
          </span>
          <span className="text-sm font-medium text-primary">Ir al enlace</span>
        </a>
      </section>

      {/* Pie */}
      <footer className="mx-auto w-full max-w-2xl space-y-1 px-4 pb-8 text-center text-xs text-white/60">
        <p>Menú Digital de Burguer Point</p>
        <p>Tipos de servicio y horarios · Todos los días de 6:00pm a 11:00pm</p>
        <p>
          <Link href="/admin" className="underline hover:text-white">
            Acceso al panel administrativo
          </Link>
        </p>
      </footer>
    </main>
  );
}
