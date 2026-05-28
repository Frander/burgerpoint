"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import ProductCard from "@/components/storefront/ProductCard";
import CartDrawer from "@/components/cart/CartDrawer";
import type { MenuCategory } from "@/lib/types";

export default function Storefront({
  menu,
  previewMode,
}: {
  menu: MenuCategory[];
  previewMode: boolean;
}) {
  const { itemCount, total } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28">
      <header className="py-8">
        <h1 className="text-3xl font-bold tracking-tight">🍔 Burger Point</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Ticul, Yucatán · Entrega 20–35 min
        </p>
      </header>

      {previewMode && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Modo vista previa: mostrando un menú de ejemplo. Conecta Supabase para
          ver el menú real.
        </div>
      )}

      {menu.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-black/60 dark:border-white/15 dark:text-white/60">
          Aún no hay productos en el menú.
        </p>
      ) : (
        <>
          <nav className="sticky top-0 z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-black/10 bg-[var(--background)] px-4 py-3 dark:border-white/10">
            {menu.map((category) => (
              <a
                key={category.id}
                href={`#cat-${category.id}`}
                className="whitespace-nowrap rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/15"
              >
                {category.name}
              </a>
            ))}
          </nav>

          <div className="space-y-8">
            {menu.map((category) => (
              <section key={category.id} id={`cat-${category.id}`}>
                <h2 className="mb-3 scroll-mt-16 text-lg font-semibold">
                  {category.name}
                </h2>
                <div className="space-y-3">
                  {category.products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <footer className="mt-12 border-t border-black/10 pt-6 text-center text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        <a href="/admin" className="underline hover:text-black/70">
          Acceso al panel administrativo
        </a>
      </footer>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-[var(--background)] p-4 dark:border-white/10">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <span className="text-sm">
              {itemCount} {itemCount === 1 ? "producto" : "productos"} ·{" "}
              <span className="font-semibold">{formatMoney(total)}</span>
            </span>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Ver pedido
            </button>
          </div>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
