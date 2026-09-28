"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHorario } from "@/app/admin/ajustes/actions";
import { DIAS, estaAbierto, lineasHorario, type Horario } from "@/lib/hours";

/** Lunes primero en pantalla; en los datos el domingo es el 0. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

/**
 * Ajustes → Horario de atención. Fuera de él el bot contesta con el horario y
 * la web no acepta pedidos; el PDV sigue funcionando siempre.
 */
export default function HorarioManager({
  horario,
  horaActual,
}: {
  horario: Horario;
  /** "14:05", hora de Yucatán al cargar la página. */
  horaActual: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Horario>(horario);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(horario);
  const abiertoAhora = estaAbierto(horario);

  function cambiarDia(i: number, patch: Partial<Horario["dias"][number]>) {
    setSaved(false);
    setDraft((h) => ({
      ...h,
      dias: h.dias.map((d, j) => (j === i ? { ...d, ...patch } : d)),
    }));
  }

  /** Copia las horas de ese día a todos los días abiertos. */
  function copiarATodos(i: number) {
    const { desde, hasta } = draft.dias[i];
    setSaved(false);
    setDraft((h) => ({ ...h, dias: h.dias.map((d) => ({ ...d, desde, hasta })) }));
  }

  function guardar() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setHorario(draft);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Horario de atención</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Hora de Yucatán. Fuera de este horario el bot de WhatsApp contesta
            que está cerrado y manda el horario, y la web no acepta pedidos. El
            PDV funciona siempre.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            abiertoAhora
              ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
          }`}
        >
          {horaActual} · {abiertoAhora ? "Abierto" : "Cerrado"}
        </span>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={draft.activo}
          onChange={(e) => {
            setSaved(false);
            setDraft((h) => ({ ...h, activo: e.target.checked }));
          }}
          disabled={pending}
          className="h-4 w-4"
        />
        Aplicar horario
        {!draft.activo && (
          <span className="font-normal text-black/50 dark:text-white/50">
            (apagado: se reciben pedidos a cualquier hora)
          </span>
        )}
      </label>

      <div className={`mt-4 space-y-2 ${draft.activo ? "" : "opacity-50"}`}>
        {ORDEN.map((i) => {
          const d = draft.dias[i];
          const cruzaMedianoche = d.abierto && d.hasta <= d.desde;
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <label className="flex w-32 items-center gap-2">
                <input
                  type="checkbox"
                  checked={d.abierto}
                  onChange={(e) => cambiarDia(i, { abierto: e.target.checked })}
                  disabled={pending}
                  className="h-4 w-4"
                />
                {DIAS[i]}
              </label>
              {d.abierto ? (
                <>
                  <input
                    type="time"
                    value={d.desde}
                    onChange={(e) => cambiarDia(i, { desde: e.target.value })}
                    disabled={pending}
                    aria-label={`${DIAS[i]}: abre`}
                    className="rounded-md border border-black/15 px-2 py-1.5 disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
                  />
                  <span className="text-black/50 dark:text-white/50">a</span>
                  <input
                    type="time"
                    value={d.hasta}
                    onChange={(e) => cambiarDia(i, { hasta: e.target.value })}
                    disabled={pending}
                    aria-label={`${DIAS[i]}: cierra`}
                    className="rounded-md border border-black/15 px-2 py-1.5 disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
                  />
                  {cruzaMedianoche && (
                    <span className="text-xs text-black/50 dark:text-white/50">
                      cierra al día siguiente
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => copiarATodos(i)}
                    disabled={pending}
                    className="text-xs text-black/50 underline hover:text-black dark:text-white/50 dark:hover:text-white"
                  >
                    Copiar a todos
                  </button>
                </>
              ) : (
                <span className="text-black/50 dark:text-white/50">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>

      {draft.activo && (
        <div className="mt-4 rounded-lg bg-black/[.03] px-3 py-2 text-xs text-black/60 dark:bg-white/5 dark:text-white/60">
          <p className="font-medium">Así lo verá el cliente:</p>
          <ul className="mt-1 space-y-0.5">
            {lineasHorario(draft).map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={pending || !dirty}
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>

      {saved && !dirty && (
        <p className="mt-3 text-sm text-green-700 dark:text-green-400">
          Guardado. Ya aplica en el bot y en la web.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
