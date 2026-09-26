"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { canjear, salir } from "@/app/(public)/cuenta/actions";
import type { CouponRow, CustomerSummary } from "@/lib/loyalty";

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Merida",
  });
}

export default function CuentaCliente({
  resumen,
  cupones,
}: {
  resumen: CustomerSummary;
  cupones: CouponRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<string | null>(null);

  const puedeCanjear = resumen.faltan === 0;
  const progreso = Math.min(
    Math.round((resumen.points / resumen.config.puntosPorCupon) * 100),
    100,
  );
  const disponibles = cupones.filter((c) => !c.used_at);

  function onCanjear() {
    setError(null);
    setNuevo(null);
    startTransition(async () => {
      const res = await canjear();
      if (res.ok) {
        setNuevo(res.code ?? null);
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo canjear.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/10 p-5">
        <p className="text-sm text-black/60">Hola, {resumen.name}</p>
        <p className="mt-1 text-4xl font-bold">
          {resumen.points}
          <span className="ml-2 text-base font-normal text-black/50">
            {resumen.points === 1 ? "punto" : "puntos"}
          </span>
        </p>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full bg-black" style={{ width: `${progreso}%` }} />
        </div>
        <p className="mt-2 text-sm text-black/60">
          {puedeCanjear
            ? `¡Ya puedes cambiarlos por un ${resumen.config.porcentaje}% de descuento!`
            : `Te faltan ${resumen.faltan} puntos para un ${resumen.config.porcentaje}% de descuento.`}
        </p>
        <p className="mt-1 text-xs text-black/45">
          Ganas 1 punto por cada ${resumen.config.pesosPorPunto} de comida, al
          entregarse y pagarse tu pedido. El envío no suma puntos.
        </p>

        <button
          type="button"
          onClick={onCanjear}
          disabled={pending || !puedeCanjear}
          className="mt-4 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending
            ? "Canjeando…"
            : `Canjear ${resumen.config.puntosPorCupon} puntos`}
        </button>

        {nuevo && (
          <p className="mt-3 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            ¡Listo! Tu cupón es <strong>{nuevo}</strong>. Úsalo al hacer tu
            pedido.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Mis cupones</h2>
        {disponibles.length === 0 ? (
          <p className="text-sm text-black/50">
            Todavía no tienes cupones sin usar.
          </p>
        ) : (
          <ul className="space-y-2">
            {disponibles.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-lg font-bold tracking-widest">
                    {c.code}
                  </p>
                  <p className="text-xs text-black/50">
                    {Number(c.percent)}% de descuento
                    {c.expires_at ? ` · vence el ${fecha(c.expires_at)}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {cupones.some((c) => c.used_at) && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-black/50">
              Ver cupones ya usados
            </summary>
            <ul className="mt-2 space-y-1">
              {cupones
                .filter((c) => c.used_at)
                .map((c) => (
                  <li key={c.id} className="text-xs text-black/45">
                    <span className="font-mono">{c.code}</span> · usado el{" "}
                    {fecha(c.used_at!)}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      <form
        action={() => {
          startTransition(async () => {
            await salir();
            router.refresh();
          });
        }}
      >
        <button
          type="submit"
          className="text-sm text-black/50 hover:underline"
          disabled={pending}
        >
          Salir
        </button>
      </form>
    </div>
  );
}
