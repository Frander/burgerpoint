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
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-[var(--background)] p-4 dark:border-white/10">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <span className="text-sm">
              {itemCount} {itemCount === 1 ? "producto" : "productos"} ·{" "}
              <span className="font-semibold">{formatMoney(total)}</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Ver pedido
            </button>
          </div>
        </div>
      )}

      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
