"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import { buildOrderMessage, buildWhatsappLink } from "@/lib/whatsapp";
import { createOrder } from "@/app/(public)/actions";
import type { OrderType } from "@/lib/types";

interface Confirmation {
  code: string;
  waLink: string;
  preview: boolean;
}

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { items, total, increment, decrement, remove, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<OrderType>("delivery");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createOrder({
      customer_name: name,
      customer_phone: phone,
      type,
      address,
      notes,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        notes: i.notes,
        modifiers: i.modifiers.map((m) => ({
          modifier_id: m.id,
          name: m.name,
          extra_price: m.extra_price,
          group_name: m.group_name,
        })),
      })),
    });

    if (!result.ok || !result.code) {
      setError(result.error ?? "No se pudo enviar el pedido.");
      setSubmitting(false);
      return;
    }

    const message = buildOrderMessage({
      code: result.code,
      items,
      total,
      customerName: name,
      type,
      address,
      notes,
    });

    setConfirmation({
      code: result.code,
      waLink: buildWhatsappLink(message),
      preview: Boolean(result.preview),
    });
    setSubmitting(false);
  }

  function handleFinish() {
    clear();
    setConfirmation(null);
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      {/* Fondo */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Panel */}
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-[var(--background)] shadow-xl">
        <div className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/10">
          <h2 className="text-lg font-semibold">Tu pedido</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-2xl leading-none text-black/50 dark:text-white/50"
          >
            ×
          </button>
        </div>

        {confirmation ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-4xl">✅</div>
            <h3 className="text-lg font-semibold">¡Pedido listo!</h3>
            <p className="text-sm text-black/60 dark:text-white/60">
              Folio <span className="font-mono font-medium">{confirmation.code}</span>.
              {confirmation.preview
                ? " (Modo vista previa: no se guardó en la base.)"
                : " Envíalo por WhatsApp para confirmar."}
            </p>
            <a
              href={confirmation.waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleFinish}
              className="w-full rounded-full bg-[#25D366] px-5 py-3 font-medium text-white"
            >
              Enviar por WhatsApp
            </a>
            <button
              type="button"
              onClick={handleFinish}
              className="text-sm text-black/50 underline dark:text-white/50"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <div className="flex-1 space-y-3 p-4">
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-black/60 dark:text-white/60">
                  Tu carrito está vacío.
                </p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.lineId}
                    className="flex items-start gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-black/60 dark:text-white/60">
                          {item.modifiers.map((m) => m.name).join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs italic text-black/50 dark:text-white/50">
                          “{item.notes}”
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-black/60 dark:text-white/60">
                        {formatMoney(item.unitPrice)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Quitar uno"
                        onClick={() => decrement(item.lineId)}
                        className="h-7 w-7 rounded-full border border-black/15 leading-none dark:border-white/15"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Agregar uno"
                        onClick={() => increment(item.lineId)}
                        className="h-7 w-7 rounded-full border border-black/15 leading-none dark:border-white/15"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label="Eliminar"
                        onClick={() => remove(item.lineId)}
                        className="ml-1 text-sm text-red-600"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))
              )}

              {items.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between border-t border-black/10 pt-3 font-semibold dark:border-white/10">
                    <span>Total</span>
                    <span>{formatMoney(total)}</span>
                  </div>

                  <input
                    required
                    placeholder="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                  <input
                    placeholder="Teléfono (opcional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />

                  <div className="flex gap-2">
                    {(["delivery", "pickup"] as OrderType[]).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                          type === t
                            ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-black/15 dark:border-white/15"
                        }`}
                      >
                        {t === "delivery" ? "Entrega" : "Recoger"}
                      </button>
                    ))}
                  </div>

                  {type === "delivery" && (
                    <input
                      required
                      placeholder="Dirección de entrega"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                    />
                  )}

                  <textarea
                    placeholder="Notas (opcional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />

                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-black/10 p-4 dark:border-white/10">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {submitting ? "Enviando…" : `Confirmar pedido · ${formatMoney(total)}`}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
