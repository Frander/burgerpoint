"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMesa,
  createSala,
  deleteMesa,
  deleteSala,
  updateMesa,
  updateSala,
} from "@/app/admin/mesas/actions";
import type { SalaWithMesas } from "@/lib/types";

export default function MesaManager({ salas }: { salas: SalaWithMesas[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newSala, setNewSala] = useState("");
  const [newMesa, setNewMesa] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {salas.map((sala) => (
        <section
          key={sala.id}
          className="rounded-xl border border-black/10 p-4 dark:border-white/10"
        >
          <div className="flex items-center gap-3">
            <input
              defaultValue={sala.name}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== sala.name)
                  run(() => updateSala(sala.id, { name: value }));
              }}
              className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-black/15 focus:border-black/30 dark:hover:border-white/15"
            />
            <button
              type="button"
              onClick={() =>
                run(() => updateSala(sala.id, { active: !sala.active }))
              }
              className={`rounded-full px-2.5 py-1 text-xs ${
                sala.active
                  ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
              }`}
            >
              {sala.active ? "Activa" : "Oculta"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `¿Eliminar la sala "${sala.name}" y todas sus mesas?`,
                  )
                )
                  run(() => deleteSala(sala.id));
              }}
              className="text-sm text-red-600"
              aria-label="Eliminar sala"
            >
              🗑
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sala.mesas.map((mesa) => (
              <span
                key={mesa.id}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm dark:border-white/15 ${
                  mesa.active
                    ? "border-black/15"
                    : "border-black/10 opacity-50"
                }`}
              >
                <input
                  defaultValue={mesa.name}
                  size={Math.max(mesa.name.length, 4)}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== mesa.name)
                      run(() => updateMesa(mesa.id, { name: value }));
                  }}
                  className="border-none bg-transparent focus:outline-none"
                />
                <button
                  type="button"
                  title={mesa.active ? "Ocultar mesa" : "Mostrar mesa"}
                  onClick={() =>
                    run(() => updateMesa(mesa.id, { active: !mesa.active }))
                  }
                  className="text-xs text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
                >
                  {mesa.active ? "👁" : "🚫"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar "${mesa.name}"?`))
                      run(() => deleteMesa(mesa.id));
                  }}
                  className="text-xs text-red-600"
                  aria-label="Eliminar mesa"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              placeholder="Nueva mesa (ej. Mesa 6)"
              value={newMesa[sala.id] ?? ""}
              onChange={(e) =>
                setNewMesa((prev) => ({ ...prev, [sala.id]: e.target.value }))
              }
              className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
            />
            <button
              type="button"
              disabled={isPending || !(newMesa[sala.id] ?? "").trim()}
              onClick={() =>
                run(async () => {
                  const res = await createMesa(
                    sala.id,
                    newMesa[sala.id] ?? "",
                    sala.mesas.length,
                  );
                  if (res.ok)
                    setNewMesa((prev) => ({ ...prev, [sala.id]: "" }));
                  return res;
                })
              }
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Agregar mesa
            </button>
          </div>
        </section>
      ))}

      <div className="flex gap-2">
        <input
          placeholder="Nueva sala (ej. Terraza)"
          value={newSala}
          onChange={(e) => setNewSala(e.target.value)}
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <button
          type="button"
          disabled={isPending || !newSala.trim()}
          onClick={() =>
            run(async () => {
              const res = await createSala(newSala, salas.length);
              if (res.ok) setNewSala("");
              return res;
            })
          }
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Agregar sala
        </button>
      </div>
    </div>
  );
}
