"use client";

import { useState, useTransition } from "react";
import { registerPayment } from "@/app/admin/pdv/actions";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/orders";
import type { OrderFull, PaymentMethod } from "@/lib/types";

const METHODS: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];

export default function PdvPaymentModal({
  order,
  onClose,
  onPaid,
}: {
  order: OrderFull;
  onClose: () => void;
  onPaid: () => void;
}) {
  const paid = order.order_payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = Math.max(0, Number(order.total) - paid);

  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [amount, setAmount] = useState(String(due));
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const amountNum = Number(amount) || 0;
  const receivedNum = Number(received) || 0;
  const change = method === "efectivo" && receivedNum > amountNum
    ? receivedNum - amountNum
    : 0;

  function submit() {
    setError(null);
    if (!(amountNum > 0)) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    startTransition(async () => {
      const res = await registerPayment(
        order.id,
        method,
        amountNum,
        method === "efectivo" && receivedNum > 0 ? receivedNum : undefined,
      );
      if (!res.ok) setError(res.error ?? "No se pudo registrar el pago.");
      else onPaid();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <h3 className="font-bold">Registrar pago</h3>
            <p className="text-xs text-gray-500">
              {order.code} · Total {formatMoney(Number(order.total))}
              {paid > 0 ? ` · Pagado ${formatMoney(paid)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 text-xl text-gray-400 hover:text-gray-900"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-lg border px-2 py-2 text-sm ${
                  method === m
                    ? "border-gray-900 bg-gray-50 font-semibold"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                {PAYMENT_METHOD_META[m].icon} {PAYMENT_METHOD_META[m].label}
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Monto a pagar</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.5"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus:border-gray-900 focus:bg-white focus:outline-none"
            />
          </label>

          {method === "efectivo" && (
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">
                Efectivo recibido (para el cambio)
              </span>
              <input
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                type="number"
                min="0"
                step="0.5"
                placeholder={amount}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus:border-gray-900 focus:bg-white focus:outline-none"
              />
            </label>
          )}

          {change > 0 && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
              Cambio: {formatMoney(change)}
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={isPending}
            onClick={submit}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {isPending ? "Registrando…" : `Registrar ${formatMoney(amountNum)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
