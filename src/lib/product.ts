import type { Product } from "@/lib/types";

/**
 * Un producto está agotado si el staff lo marcó como no disponible o si lleva
 * control de inventario y se quedó en cero. Los agotados siguen apareciendo en
 * el menú, marcados, pero no se pueden pedir.
 */
export function isSoldOut(
  product: Pick<Product, "available" | "track_stock" | "stock">,
): boolean {
  return !product.available || (product.track_stock && product.stock <= 0);
}
