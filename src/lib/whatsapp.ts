import { formatMoney } from "@/lib/format";
import type { CartItem } from "@/components/cart/CartProvider";
import type { OrderType } from "@/lib/types";

interface OrderSummary {
  code: string;
  items: CartItem[];
  total: number;
  customerName: string;
  type: OrderType;
  address?: string;
  notes?: string;
}

/** Construye el mensaje de WhatsApp con el resumen del pedido. */
export function buildOrderMessage(order: OrderSummary): string {
  const lines: string[] = [];
  const restaurant =
    process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Burger Point";

  lines.push(`*Nuevo pedido — ${restaurant}*`);
  lines.push(`Folio: ${order.code}`);
  lines.push("");
  lines.push(`*Cliente:* ${order.customerName}`);
  lines.push(`*Tipo:* ${order.type === "delivery" ? "Entrega a domicilio" : "Recoger en sucursal"}`);
  if (order.type === "delivery" && order.address) {
    lines.push(`*Dirección:* ${order.address}`);
  }
  lines.push("");
  lines.push("*Pedido:*");
  for (const item of order.items) {
    lines.push(
      `• ${item.quantity}x ${item.name} — ${formatMoney(item.unitPrice * item.quantity)}`,
    );
    for (const mod of item.modifiers) {
      const extra = mod.extra_price > 0 ? ` (+${formatMoney(mod.extra_price)})` : "";
      lines.push(`   – ${mod.name}${extra}`);
    }
    if (item.notes) {
      lines.push(`   _${item.notes}_`);
    }
  }
  lines.push("");
  lines.push(`*Total: ${formatMoney(order.total)}*`);
  if (order.notes) {
    lines.push("");
    lines.push(`*Notas:* ${order.notes}`);
  }
  return lines.join("\n");
}

/** Devuelve el enlace wa.me con el mensaje codificado. */
export function buildWhatsappLink(message: string): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE?.replace(/\D/g, "");
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}
