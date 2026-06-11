"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { items, addProduct, increment, decrement } = useCart();
  // Línea simple (sin opciones) de este producto.
  const inCart = items.find(
    (i) => i.productId === product.id && i.modifiers.length === 0 && !i.notes,
  );

  function handleAdd() {
    if (product.has_modifiers) {
      router.push(`/menu/${product.id}`);
      return;
    }
    addProduct(product);
  }

  const addButton = (
    <button
      type="button"
      aria-label={`Agregar ${product.name}`}
      onClick={handleAdd}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xl leading-none text-white shadow-md transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
    >
      +
    </button>
  );

  const stepper = inCart && (
    <div className="flex items-center gap-1 rounded-full bg-gray-900 text-white shadow-md">
      <button
        type="button"
        aria-label="Quitar uno"
        onClick={() => decrement(inCart.lineId)}
        className="flex h-9 w-8 items-center justify-center rounded-l-full text-lg leading-none transition-colors hover:bg-gray-700"
      >
        −
      </button>
      <span className="w-4 text-center text-sm font-semibold">
        {inCart.quantity}
      </span>
      <button
        type="button"
        aria-label="Agregar uno"
        onClick={() => increment(inCart.lineId)}
        className="flex h-9 w-8 items-center justify-center rounded-r-full text-lg leading-none transition-colors hover:bg-gray-700"
      >
        +
      </button>
    </div>
  );

  return (
    <div className="flex items-start gap-3 py-4">
      <Link href={`/menu/${product.id}`} className="group min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-snug group-hover:underline">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
            {product.description}
          </p>
        )}
        <p className="mt-2 text-sm font-bold">{formatMoney(product.price)}</p>
      </Link>

      {product.image_url ? (
        <div className="relative shrink-0">
          <Link href={`/menu/${product.id}`}>
            <Image
              src={product.image_url}
              alt={product.name}
              width={96}
              height={96}
              className="h-24 w-24 rounded-lg object-cover"
            />
          </Link>
          <div className="absolute -bottom-2 -right-2">
            {stepper ?? addButton}
          </div>
        </div>
      ) : (
        <div className="shrink-0 self-center">{stepper ?? addButton}</div>
      )}
    </div>
  );
}
