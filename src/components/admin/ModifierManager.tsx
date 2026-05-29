"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  createModifier,
  deleteModifier,
  type ActionResult,
} from "@/app/admin/menu/actions";
import { formatMoney } from "@/lib/format";
import type { ModifierGroupWithOptions } from "@/lib/types";

export default function ModifierManager({
  productId,
  groups,
}: {
  productId: string;
  groups: ModifierGroupWithOptions[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form de alta de grupo
  const [name, setName] = useState("");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("1");

  function run(fn: () => Promise<ActionResult>) {
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

      {groups.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">
          Este producto aún no tiene grupos de opciones.
        </p>
      )}

      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          productId={productId}
          disabled={isPending}
          run={run}
        />
      ))}

      {/* Alta de grupo */}
      <div className="space-y-2 rounded-lg border border-dashed border-black/20 p-4 dark:border-white/20">
        <h3 className="text-sm font-semibold">Nuevo grupo de opciones</h3>
        <input
          placeholder="Nombre (ej. Sin, Sabor bebida, Agrégale)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Mínimo
            <input
              type="number"
              min="0"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-16 rounded-md border border-black/15 px-2 py-1 dark:border-white/15 dark:bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2">
            Máximo
            <input
              type="number"
              min="1"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="w-16 rounded-md border border-black/15 px-2 py-1 dark:border-white/15 dark:bg-transparent"
            />
          </label>
          <span className="text-xs text-black/50 dark:text-white/50">
            Mín ≥ 1 = obligatorio · Máx 1 = elección única
          </span>
        </div>
        <button
          type="button"
          disabled={isPending || !name.trim()}
          onClick={() =>
            run(async () => {
              const res = await createGroup(productId, {
                name,
                min_select: Number(min),
                max_select: Number(max),
                sort_order: groups.length,
              });
              if (res.ok) {
                setName("");
                setMin("0");
                setMax("1");
              }
              return res;
            })
          }
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Agregar grupo
        </button>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  productId,
  disabled,
  run,
}: {
  group: ModifierGroupWithOptions;
  productId: string;
  disabled: boolean;
  run: (fn: () => Promise<ActionResult>) => void;
}) {
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");

  const required = group.min_select >= 1;
  const single = group.max_select === 1;

  return (
    <div className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{group.name}</h3>
          <p className="text-xs text-black/50 dark:text-white/50">
            {required ? "Obligatorio" : "Opcional"} ·{" "}
            {single ? "elección única" : `hasta ${group.max_select}`} · mín{" "}
            {group.min_select}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (confirm(`¿Eliminar el grupo "${group.name}" y sus opciones?`))
              run(() => deleteGroup(group.id, productId));
          }}
          className="text-sm text-red-600"
          aria-label="Eliminar grupo"
        >
          Eliminar grupo
        </button>
      </div>

      {/* Editar reglas del grupo */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Mínimo
          <input
            type="number"
            min="0"
            defaultValue={group.min_select}
            disabled={disabled}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== group.min_select)
                run(() => updateGroup(group.id, productId, { min_select: v }));
            }}
            className="w-16 rounded-md border border-black/15 px-2 py-1 dark:border-white/15 dark:bg-transparent"
          />
        </label>
        <label className="flex items-center gap-2">
          Máximo
          <input
            type="number"
            min="1"
            defaultValue={group.max_select}
            disabled={disabled}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== group.max_select)
                run(() => updateGroup(group.id, productId, { max_select: v }));
            }}
            className="w-16 rounded-md border border-black/15 px-2 py-1 dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>

      {/* Opciones */}
      <div className="space-y-1.5">
        {group.modifiers.length === 0 && (
          <p className="text-xs text-black/50 dark:text-white/50">
            Sin opciones todavía.
          </p>
        )}
        {group.modifiers.map((opt) => (
          <div
            key={opt.id}
            className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
          >
            <span className="flex-1">{opt.name}</span>
            <span className="text-black/60 dark:text-white/60">
              {opt.extra_price > 0 ? `+${formatMoney(opt.extra_price)}` : "—"}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => run(() => deleteModifier(opt.id, productId))}
              className="text-red-600"
              aria-label="Eliminar opción"
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {/* Alta de opción */}
      <div className="flex gap-2">
        <input
          placeholder="Opción (ej. Tocino)"
          value={optName}
          onChange={(e) => setOptName(e.target.value)}
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="+$ extra"
          value={optPrice}
          onChange={(e) => setOptPrice(e.target.value)}
          className="w-24 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <button
          type="button"
          disabled={disabled || !optName.trim()}
          onClick={() =>
            run(async () => {
              const res = await createModifier(group.id, productId, {
                name: optName,
                extra_price: Number(optPrice) || 0,
                sort_order: group.modifiers.length,
              });
              if (res.ok) {
                setOptName("");
                setOptPrice("");
              }
              return res;
            })
          }
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
        >
          Añadir
        </button>
      </div>
    </div>
  );
}
