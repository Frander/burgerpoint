"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMovement,
  closeSession,
  openSession,
} from "@/app/admin/caja/actions";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_META } from "@/lib/orders";
import type {
  CashMovement,
  CashMovementType,
  CashSession,
  OrderPayment,
  PaymentMethod,
} from "@/lib/types";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CashManager({
  session,
  payments,
  movements,
  history,
}: {
  session: CashSession | null;
  payments: OrderPayment[];
  movements: CashMovement[];
  history: CashSession[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Apertura
  const [openingAmount, setOpeningAmount] = useState("");

  // Movimiento manual
  const [showMovement, setShowMovement] = useState(false);
  const [movType, setMovType] = useState<CashMovementType>("gasto");
  const [movAmount, setMovAmount] = useState("");
  const [movMethod, setMovMethod] = useState<PaymentMethod>("efectivo");
  const [movCategory, setMovCategory] = useState("");
  const [movNotes, setMovNotes] = useState("");

  // Cierre
  const [showClose, setShowClose] = useState(false);
  const [counted, setCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  // Totales del turno
  const salesByMethod = new Map<PaymentMethod, number>();
  for (const p of payments) {
    salesByMethod.set(
      p.method,
      (salesByMethod.get(p.method) ?? 0) + Number(p.amount),
    );
  }
  const cashSales = salesByMethod.get("efectivo") ?? 0;
  const cashIn = movements
    .filter((m) => m.type === "ingreso" && m.method === "efectivo")
    .reduce((s, m) => s + Number(m.amount), 0);
  const cashOut = movements
    .filter((m) => m.type === "gasto" && m.method === "efectivo")
    .reduce((s, m) => s + Number(m.amount), 0);
  const expectedCash = session
    ? Number(session.opening_amount) + cashSales + cashIn - cashOut
    : 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Caja</h1>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!session ? (
        /* ---------- Sin caja abierta ---------- */
        <div className="mt-6 max-w-md rounded-xl border border-black/10 p-6 dark:border-white/10">
          <h2 className="font-semibold">Abrir caja</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Cuenta el efectivo inicial del cajón y ábrela para empezar el turno.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              type="number"
              min="0"
              step="0.5"
              placeholder="Efectivo inicial (MXN)"
              className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
            />
            <button
              type="button"
              disabled={isPending || openingAmount === ""}
              onClick={() => run(() => openSession(Number(openingAmount) || 0))}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Abrir caja
            </button>
          </div>
        </div>
      ) : (
        /* ---------- Caja abierta ---------- */
        <>
          <div className="mt-6 rounded-xl border border-black/10 p-5 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-black/60 dark:text-white/60">
                  Efectivo en caja (estimado)
                </p>
                <p className="text-3xl font-extrabold">
                  {formatMoney(expectedCash)}
                </p>
                <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                  Apertura: {formatDateTime(session.opened_at)} · Inicial{" "}
                  {formatMoney(Number(session.opening_amount))}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-500/20 dark:text-green-300">
                ● Abierta
              </span>
            </div>

            {/* Ventas por método */}
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["efectivo", "tarjeta", "transferencia"] as PaymentMethod[]).map(
                (m) => (
                  <div
                    key={m}
                    className="rounded-lg bg-black/[.03] px-3 py-2 text-sm dark:bg-white/[.05]"
                  >
                    <span className="text-black/60 dark:text-white/60">
                      {PAYMENT_METHOD_META[m].icon} Ventas{" "}
                      {PAYMENT_METHOD_META[m].label.toLowerCase()}
                    </span>
                    <p className="font-semibold">
                      {formatMoney(salesByMethod.get(m) ?? 0)}
                    </p>
                  </div>
                ),
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowMovement((v) => !v)}
                className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/15"
              >
                + Registrar ingreso/gasto
              </button>
              <button
                type="button"
                onClick={() => {
                  setCounted(String(expectedCash));
                  setShowClose(true);
                }}
                className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600"
              >
                🔒 Cerrar caja
              </button>
            </div>

            {/* Formulario de movimiento */}
            {showMovement && (
              <div className="mt-4 space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
                <div className="flex gap-2">
                  {(["gasto", "ingreso"] as CashMovementType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMovType(t)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        movType === t
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "border border-black/15 dark:border-white/15"
                      }`}
                    >
                      {t === "gasto" ? "− Gasto" : "+ Ingreso"}
                    </button>
                  ))}
                  <select
                    value={movMethod}
                    onChange={(e) => setMovMethod(e.target.value as PaymentMethod)}
                    className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/15 dark:bg-transparent"
                  >
                    {(
                      ["efectivo", "tarjeta", "transferencia"] as PaymentMethod[]
                    ).map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_META[m].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={movAmount}
                    onChange={(e) => setMovAmount(e.target.value)}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Monto"
                    className="w-28 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                  <input
                    value={movCategory}
                    onChange={(e) => setMovCategory(e.target.value)}
                    placeholder="Categoría (insumos, propina…)"
                    className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                  <input
                    value={movNotes}
                    onChange={(e) => setMovNotes(e.target.value)}
                    placeholder="Nota"
                    className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                  <button
                    type="button"
                    disabled={isPending || !(Number(movAmount) > 0)}
                    onClick={() =>
                      run(async () => {
                        const res = await addMovement({
                          type: movType,
                          amount: Number(movAmount),
                          method: movMethod,
                          category: movCategory,
                          notes: movNotes,
                        });
                        if (res.ok) {
                          setMovAmount("");
                          setMovCategory("");
                          setMovNotes("");
                          setShowMovement(false);
                        }
                        return res;
                      })
                    }
                    className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {/* Cierre con arqueo */}
            {showClose && (
              <div className="mt-4 space-y-2 rounded-lg border border-red-200 p-3 dark:border-red-500/30">
                <p className="text-sm">
                  Efectivo esperado:{" "}
                  <span className="font-semibold">
                    {formatMoney(expectedCash)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Efectivo contado"
                    className="w-40 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                  <input
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Nota del cierre (opcional)"
                    className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                  <button
                    type="button"
                    disabled={isPending || counted === ""}
                    onClick={() => {
                      const diff = Number(counted) - expectedCash;
                      if (
                        confirm(
                          `Cerrar caja.\nEsperado: ${formatMoney(expectedCash)}\nContado: ${formatMoney(Number(counted))}\nDiferencia: ${formatMoney(diff)}\n\n¿Confirmar?`,
                        )
                      )
                        run(async () => {
                          const res = await closeSession(
                            session.id,
                            Number(counted),
                            expectedCash,
                            closeNotes,
                          );
                          if (res.ok) setShowClose(false);
                          return res;
                        });
                    }}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Cerrar caja
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Registros financieros del turno */}
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">
              Registros financieros del turno
            </h2>
            {movements.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
                Sin movimientos manuales. Registra gastos (insumos, propinas) o
                ingresos extra.
              </p>
            ) : (
              <div className="space-y-2">
                {movements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <div>
                      <span
                        className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.type === "gasto"
                            ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                            : "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                        }`}
                      >
                        {m.type === "gasto" ? "Gasto" : "Ingreso"}
                      </span>
                      {m.category ?? "—"}
                      {m.notes ? (
                        <span className="text-black/50 dark:text-white/50">
                          {" "}
                          · {m.notes}
                        </span>
                      ) : null}
                      <span className="ml-2 text-xs text-black/40 dark:text-white/40">
                        {formatDateTime(m.created_at)} ·{" "}
                        {PAYMENT_METHOD_META[m.method].label}
                      </span>
                    </div>
                    <span
                      className={`font-semibold ${
                        m.type === "gasto" ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {m.type === "gasto" ? "−" : "+"}
                      {formatMoney(Number(m.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Historial de cajas */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Historial de cajas</h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            Aún no hay cajas cerradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="py-2 pr-3">Apertura</th>
                  <th className="py-2 pr-3">Cierre</th>
                  <th className="py-2 pr-3">Inicial</th>
                  <th className="py-2 pr-3">Esperado</th>
                  <th className="py-2 pr-3">Contado</th>
                  <th className="py-2">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => {
                  const diff =
                    s.closing_amount !== null && s.expected_amount !== null
                      ? Number(s.closing_amount) - Number(s.expected_amount)
                      : null;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-black/5 dark:border-white/5"
                    >
                      <td className="py-2 pr-3">{formatDateTime(s.opened_at)}</td>
                      <td className="py-2 pr-3">
                        {s.closed_at ? formatDateTime(s.closed_at) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {formatMoney(Number(s.opening_amount))}
                      </td>
                      <td className="py-2 pr-3">
                        {s.expected_amount !== null
                          ? formatMoney(Number(s.expected_amount))
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {s.closing_amount !== null
                          ? formatMoney(Number(s.closing_amount))
                          : "—"}
                      </td>
                      <td
                        className={`py-2 font-medium ${
                          diff === null
                            ? ""
                            : diff < 0
                              ? "text-red-600"
                              : diff > 0
                                ? "text-green-600"
                                : ""
                        }`}
                      >
                        {diff !== null ? formatMoney(diff) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
