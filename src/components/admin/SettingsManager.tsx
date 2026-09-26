"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setDefaultCourier,
  setDeliveryFee,
  setLoyaltyConfig,
} from "@/app/admin/ajustes/actions";
import type { LoyaltyConfig } from "@/lib/settings";
import type { Courier } from "@/lib/types";

export default function SettingsManager({
  couriers,
  defaultCourierId,
  deliveryFee,
  loyalty,
}: {
  couriers: Courier[];
  defaultCourierId: string | null;
  deliveryFee: number;
  loyalty: LoyaltyConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(defaultCourierId ?? "");
  const [fee, setFee] = useState(String(deliveryFee));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"courier" | "fee" | "loyalty" | null>(null);
  const [pesos, setPesos] = useState(String(loyalty.pesosPorPunto));
  const [puntos, setPuntos] = useState(String(loyalty.puntosPorCupon));
  const [porcentaje, setPorcentaje] = useState(String(loyalty.porcentaje));

  const dirty = selected !== (defaultCourierId ?? "");
  const feeDirty = fee.trim() !== "" && Number(fee) !== deliveryFee;

  function guardar() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await setDefaultCourier(selected);
      if (res.ok) {
        setSaved("courier");
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo guardar.");
      }
    });
  }

  const loyaltyDirty =
    Number(pesos) !== loyalty.pesosPorPunto ||
    Number(puntos) !== loyalty.puntosPorCupon ||
    Number(porcentaje) !== loyalty.porcentaje;

  function guardarPuntos() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await setLoyaltyConfig({
        pesosPorPunto: Number(pesos),
        puntosPorCupon: Number(puntos),
        porcentaje: Number(porcentaje),
      });
      if (res.ok) {
        setSaved("loyalty");
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo guardar.");
      }
    });
  }

  function guardarEnvio() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await setDeliveryFee(Number(fee));
      if (res.ok) {
        setSaved("fee");
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Preferencias del negocio. Solo el admin las cambia.
      </p>

      <section className="mt-8 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Repartidor por defecto</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Al mandar un pedido a domicilio en camino sin elegir a nadie, se le
          asigna este repartidor. En el PDV siempre se puede elegir otro antes
          de mandarlo.
        </p>

        {couriers.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            No hay repartidores dados de alta. Créalos en Usuarios, con el rol
            repartidor.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setSaved(null);
              }}
              disabled={pending}
              className="min-w-56 flex-1 rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
            >
              <option value="">Ninguno (la elige la caja cada vez)</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={guardar}
              disabled={pending || !dirty}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}

        {saved === "courier" && !dirty && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-400">
            Guardado.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Precio de envío</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Se suma al total de todos los pedidos a domicilio —web, WhatsApp y
          PDV— y es lo que gana el repartidor por esa entrega. En el PDV la
          cajera puede cambiarlo en un pedido suelto. Déjalo en 0 para que el
          envío sea gratis.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={fee}
            onChange={(e) => {
              setFee(e.target.value);
              setSaved(null);
            }}
            disabled={pending}
            className="w-32 rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
          />
          <button
            type="button"
            onClick={guardarEnvio}
            disabled={pending || !feeDirty}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>

        {saved === "fee" && !feeDirty && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-400">
            Guardado. Los pedidos nuevos ya lo cobran.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Programa de puntos</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          El cliente junta puntos con cada pedido entregado y pagado, y los
          cambia por un cupón de descuento. El envío no da puntos.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-56">1 punto por cada…</span>
            <span>$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={pesos}
              onChange={(e) => {
                setPesos(e.target.value);
                setSaved(null);
              }}
              disabled={pending}
              className="w-28 rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
            />
            <span className="text-black/50 dark:text-white/50">de comida</span>
          </label>

          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-56">El cupón cuesta…</span>
            <input
              type="number"
              min="1"
              step="1"
              value={puntos}
              onChange={(e) => {
                setPuntos(e.target.value);
                setSaved(null);
              }}
              disabled={pending}
              className="w-28 rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
            />
            <span className="text-black/50 dark:text-white/50">puntos</span>
          </label>

          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-56">y descuenta…</span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                setSaved(null);
              }}
              disabled={pending}
              className="w-28 rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
            />
            <span className="text-black/50 dark:text-white/50">% de la comida</span>
          </label>
        </div>

        <p className="mt-3 text-xs text-black/45 dark:text-white/45">
          Con estos valores, un pedido de $200 de comida da{" "}
          {Math.floor(200 / (Number(pesos) || 1))} puntos, y el cliente necesita{" "}
          {puntos} para un {porcentaje}% de descuento.
        </p>

        <button
          type="button"
          onClick={guardarPuntos}
          disabled={pending || !loyaltyDirty}
          className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>

        {saved === "loyalty" && !loyaltyDirty && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-400">
            Guardado.
          </p>
        )}
      </section>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
