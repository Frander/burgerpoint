"use client";

import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  const { items, add, increment, decrement } = useCart();
  const inCart = items.find((i) => i.productId === product.id);

  return (
    <div className="flex items-start gap-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex-1">
        <h3 className="font-semibold">{product.name}</h3>
        {product.description && (
          <p className="mt-0.5 text-sm text-black/60 dark:text-white/60">
            {product.description}
          </p>
        )}
        <p className="mt-2 font-medium">{formatMoney(product.price)}</p>
      </div>

      <div className="shrink-0">
        {inCart ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Quitar uno"
              onClick={() => decrement(product.id)}
              className="h-8 w-8 rounded-full border border-black/15 text-lg leading-none dark:border-white/15"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-medium">
              {inCart.quantity}
            </span>
            <button
              type="button"
              aria-label="Agregar uno"
              onClick={() => increment(product.id)}
              className="h-8 w-8 rounded-full border border-black/15 text-lg leading-none dark:border-white/15"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => add(product)}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Agregar
          </button>
        )}
      </div>
    </div>
  );
}
