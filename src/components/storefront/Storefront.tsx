import Image from "next/image";
import Link from "next/link";
import CategoryTabs from "@/components/storefront/CategoryTabs";
import ProductCard from "@/components/storefront/ProductCard";
import type { MenuCategory } from "@/lib/types";

const ADDRESS = "México 188 246, Ticul, 97864 Ticul, Yuc., México";

export default function Storefront({
  menu,
  previewMode,
}: {
  menu: MenuCategory[];
  previewMode: boolean;
}) {
  return (
    <div className="min-h-full bg-white text-gray-900">
      {/* Portada con logo superpuesto, como la página de OlaClick */}
      <header className="relative">
        <div className="relative h-36 w-full sm:h-44">
          <Image
            src="/banner.jpg"
            alt="Portada de Burguer Point"
            fill
            priority
            className="object-cover"
          />
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow-sm transition-colors hover:bg-white"
          >
            ←
          </Link>
        </div>
        <div className="mx-auto w-full max-w-4xl px-4">
          <div className="mt-3 flex items-center gap-3">
            <Image
              src="/logo.jpg"
              alt="Logo de Burguer Point"
              width={64}
              height={64}
              className="h-16 w-16 rounded-lg border-2 border-white object-cover shadow-md"
            />
            <h1 className="text-2xl font-bold tracking-tight">
              Burguer Point
            </h1>
          </div>
          <p className="mt-2 text-sm text-gray-500">{ADDRESS}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 pb-4 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Abierto
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
              🛵 Entrega 20 - 35 min.
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
              ⭐ 4.6
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 pb-28">
        {previewMode && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Modo vista previa: mostrando un menú de ejemplo. Conecta Supabase
            para ver el menú real.
          </div>
        )}

        {menu.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
            Aún no hay productos en el menú.
          </p>
        ) : (
          <>
            <CategoryTabs
              categories={menu.map(({ id, name }) => ({ id, name }))}
            />

            <div className="space-y-10 pt-6">
              {menu.map((category) => (
                <section key={category.id} id={`cat-${category.id}`}>
                  <h2 className="scroll-mt-16 text-lg font-semibold tracking-tight">
                    {category.name}
                  </h2>
                  <div className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                    {category.products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        <footer className="mt-12 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          <p>Menú Digital de Burguer Point</p>
          <Link
            href="/admin"
            className="mt-1 inline-block underline hover:text-gray-600"
          >
            Acceso al panel administrativo
          </Link>
        </footer>
      </div>
    </div>
  );
}
