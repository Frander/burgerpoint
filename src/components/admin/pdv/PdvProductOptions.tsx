"use client";

import { useMemo, useState } from "react";
import type { OrderModifierInput } from "@/lib/order-insert";
import { formatMoney } from "@/lib/format";
import type { ModifierGroupWithOptions, ProductWithModifiers } from "@/lib/types";

export interface OptionLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  modifiers?: OrderModifierInput[];
}

function groupHint(g: ModifierGroupWithOptions): string {
  if (g.max_select === 1) {
    return g.min_select >= 1 ? "Elige 1" : "Elige hasta 1";
  }
  if (g.min_select >= 1) return `Elige de ${g.min_select} a ${g.max_select}`;
  return `Elige hasta ${g.max_select}`;
}

/** Selector compacto de opciones para el PDV (mismas reglas que el storefront). */
export default function PdvProductOptions({
  product,
  onClose,
  onAdd,
}: {
  product: ProductWithModifiers;
  onClose: () => void;
  onAdd: (line: OptionLine) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const groups = product.modifier_groups;

  function toggle(group: ModifierGroupWithOptions, optionId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.max_select === 1) return { ...prev, [group.id]: [optionId] };
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.max_select) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  const { chosen, extras, missing } = useMemo(() => {
    const picked: OrderModifierInput[] = [];
    let extra = 0;
    const missingGroups: string[] = [];
    for (const g of groups) {
      const ids = selected[g.id] ?? [];
      if (ids.length < g.min_select) missingGroups.push(g.name);
      for (const opt of g.modifiers) {
        if (ids.includes(opt.id)) {
          picked.push({
            modifier_id: opt.id,
            name: opt.name,
            extra_price: opt.extra_price,
            group_name: g.name,
          });
          extra += opt.extra_price;
        }
      }
    }
    return { chosen: picked, extras: extra, missing: missingGroups };
  }, [groups, selected]);

  const unitPrice = product.price + extras;
  const canAdd = missing.length === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <h3 className="font-bold">{product.name}</h3>
            <p className="text-xs text-gray-500">{formatMoney(product.price)}</p>
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

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {groups.map((group) => {
            const ids = selected[group.id] ?? [];
            const single = group.max_select === 1;
            const atMax = !single && ids.length >= group.max_select;
            return (
              <section key={group.id}>
                <h4 className="text-sm font-semibold">
                  {group.name}{" "}
                  <span className="font-normal text-gray-400">
                    · {groupHint(group)}
                  </span>
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.modifiers.map((opt) => {
                    const checked = ids.includes(opt.id);
                    const disabled = !checked && atMax;
                    return (
                      <label
                        key={opt.id}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${
                          checked
                            ? "border-gray-900 bg-gray-50 font-medium"
                            : "border-gray-200 hover:border-gray-400"
                        } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={group.id}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(group, opt.id)}
                          className="h-3.5 w-3.5 accent-gray-900"
                        />
                        <span>{opt.name}</span>
                        {opt.extra_price > 0 && (
                          <span className="text-gray-500">
                            +{formatMoney(opt.extra_price)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nota de la línea (opcional)"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-gray-900 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 p-4">
          <div className="flex items-center rounded-lg border border-gray-200">
            <button
              type="button"
              aria-label="Menos"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center hover:bg-gray-50"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Más"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-10 w-10 items-center justify-center hover:bg-gray-50"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() =>
              onAdd({
                productId: product.id,
                name: product.name,
                unitPrice,
                quantity,
                notes: notes.trim() || undefined,
                modifiers: chosen,
              })
            }
            className="h-10 flex-1 rounded-lg bg-gray-900 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {canAdd
              ? `Agregar ${formatMoney(unitPrice * quantity)}`
              : `Falta: ${missing.join(", ")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
