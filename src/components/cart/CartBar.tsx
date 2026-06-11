"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import CartDrawer from "@/components/cart/CartDrawer";

/**
 * Barra flotante con el resumen del carrito + el drawer de checkout.
 * Se monta en el layout público para estar disponible en el menú y el detalle.
 */
export default function CartBar() {
  const { itemCount, total } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-full bg-gray-900 px-5 py-3.5 text-white shadow-lg shadow-gray-900/30 transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
              {itemCount}
            </span>
            <span className="font-semibold">Ver mi pedido</span>
            <span className="font-semibold">{formatMoney(total)}</span>
          </button>
        </div>
      )}

      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
