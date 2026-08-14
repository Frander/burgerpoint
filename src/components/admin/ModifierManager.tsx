"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  reorderGroups,
  createModifier,
  updateModifier,
  deleteModifier,
  reorderModifiers,
  type ActionResult,
} from "@/app/admin/menu/actions";
import SortableList from "@/components/admin/SortableList";
import type { Modifier, ModifierGroupWithOptions } from "@/lib/types";

type Run = (fn: () => Promise<ActionResult>) => void;

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

  const run: Run = (fn) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {groups.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          Este producto aún no tiene grupos de opciones.
        </p>
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          Arrastra ⠿ para reordenar los grupos y sus opciones. Edita cualquier
          texto o precio y pulsa Guardar (o Enter).
        </p>
      )}

      <SortableList
        items={groups}
        disabled={isPending}
        className="space-y-4"
        onReorder={(ids) => run(() => reorderGroups(productId, ids))}
        renderItem={(group, handle) => (
          <GroupCard
            group={group}
            handle={handle}
            productId={productId}
            disabled={isPending}
            run={run}
          />
        )}
      />

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
  handle,
  productId,
  disabled,
  run,
}: {
  group: ModifierGroupWithOptions;
  handle: React.ReactNode;
  productId: string;
  disabled: boolean;
  run: Run;
}) {
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");

  const [nameDraft, setNameDraft] = useState(group.name);
  const [submittedName, setSubmittedName] = useState(group.name);

  const required = group.min_select >= 1;
  const single = group.max_select === 1;

  const name = nameDraft.trim();
  const nameDirty =
    name !== "" && name !== group.name && name !== submittedName;

  function saveName() {
    if (!nameDirty) return;
    setSubmittedName(name);
    run(async () => {
      const res = await updateGroup(group.id, productId, { name });
      if (!res.ok) setSubmittedName(group.name);
      return res;
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black">
      <div className="flex items-start gap-2">
        {handle}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={nameDraft}
              disabled={disabled}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveName();
                } else if (e.key === "Escape") {
                  setNameDraft(group.name);
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-black/15 focus:border-black/30 dark:hover:border-white/15"
            />
            {nameDirty && (
              <button
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={saveName}
                className="shrink-0 rounded-md bg-black px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                Guardar
              </button>
            )}
          </div>
          <p className="px-2 text-xs text-black/50 dark:text-white/50">
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
          className="shrink-0 text-sm text-red-600"
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
      {group.modifiers.length === 0 ? (
        <p className="text-xs text-black/50 dark:text-white/50">
          Sin opciones todavía.
        </p>
      ) : (
        <SortableList
          items={group.modifiers}
          disabled={disabled}
          className="space-y-1.5"
          onReorder={(ids) => run(() => reorderModifiers(productId, ids))}
          renderItem={(option, optionHandle) => (
            <OptionRow
              option={option}
              handle={optionHandle}
              productId={productId}
              disabled={disabled}
              run={run}
            />
          )}
        />
      )}

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

function OptionRow({
  option,
  handle,
  productId,
  disabled,
  run,
}: {
  option: Modifier;
  handle: React.ReactNode;
  productId: string;
  disabled: boolean;
  run: Run;
}) {
  const [nameDraft, setNameDraft] = useState(option.name);
  const [priceDraft, setPriceDraft] = useState(String(option.extra_price));
  // Lo último que se mandó a guardar, para no repetir el envío con Enter + blur.
  const [submitted, setSubmitted] = useState({
    name: option.name,
    price: option.extra_price,
  });

  const name = nameDraft.trim();
  const price = Number(priceDraft);
  const priceValid =
    priceDraft.trim() !== "" && Number.isFinite(price) && price >= 0;
  const changed =
    name !== option.name || (priceValid && price !== option.extra_price);
  const alreadySent = name === submitted.name && price === submitted.price;
  const dirty = name !== "" && priceValid && changed && !alreadySent;

  function save() {
    if (!dirty) return;
    setSubmitted({ name, price });
    run(async () => {
      const res = await updateModifier(option.id, productId, {
        name,
        extra_price: price,
      });
      if (!res.ok) {
        setSubmitted({ name: option.name, price: option.extra_price });
      }
      return res;
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      setNameDraft(option.name);
      setPriceDraft(String(option.extra_price));
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-black">
      {handle}
      <input
        value={nameDraft}
        disabled={disabled}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-black/15 focus:border-black/30 dark:hover:border-white/15"
      />
      <label className="flex shrink-0 items-center gap-1 text-black/60 dark:text-white/60">
        +$
        <input
          type="number"
          min="0"
          step="0.01"
          value={priceDraft}
          disabled={disabled}
          onChange={(e) => setPriceDraft(e.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
          className="w-20 rounded-md border border-transparent bg-transparent px-1 py-1 text-right hover:border-black/15 focus:border-black/30 dark:hover:border-white/15"
        />
      </label>
      {dirty && (
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          className="shrink-0 rounded-md bg-black px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Guardar
        </button>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (confirm(`¿Eliminar la opción "${option.name}"?`))
            run(() => deleteModifier(option.id, productId));
        }}
        className="shrink-0 text-red-600"
        aria-label="Eliminar opción"
      >
        🗑
      </button>
    </div>
  );
}
