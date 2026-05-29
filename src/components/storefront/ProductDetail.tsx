"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, type CartModifier } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import type { ModifierGroupWithOptions, ProductWithModifiers } from "@/lib/types";

function groupHint(g: ModifierGroupWithOptions): string {
  const required = g.min_select >= 1;
  if (g.max_select === 1) {
    return required ? "Obligatorio · elige 1" : "Opcional · elige 1";
  }
  if (required) return `Obligatorio · elige ${g.min_select} a ${g.max_select}`;
  return `Opcional · hasta ${g.max_select}`;
}

export default function ProductDetail({
  product,
}: {
  product: ProductWithModifiers;
}) {
  const router = useRouter();
  const { addLine } = useCart();

  // groupId -> ids de opciones elegidas.
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const groups = product.modifier_groups;

  function toggle(group: ModifierGroupWithOptions, optionId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      // Elección única (radio): reemplaza.
      if (group.max_select === 1) {
        return { ...prev, [group.id]: [optionId] };
      }
      // Múltiple (checkbox): alterna respetando el máximo.
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.max_select) return prev; // tope alcanzado
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  // Modificadores elegidos (planos) y validación.
  const { chosenModifiers, extras, missing } = useMemo(() => {
    const chosen: CartModifier[] = [];
    let extra = 0;
    const missingGroups: string[] = [];
    for (const g of groups) {
      const ids = selected[g.id] ?? [];
      if (ids.length < g.min_select) missingGroups.push(g.name);
      for (const opt of g.modifiers) {
        if (ids.includes(opt.id)) {
          chosen.push({
            id: opt.id,
            name: opt.name,
            extra_price: opt.extra_price,
            group_name: g.name,
          });
          extra += opt.extra_price;
        }
      }
    }
    return { chosenModifiers: chosen, extras: extra, missing: missingGroups };
  }, [groups, selected]);

  const unitPrice = product.price + extras;
  const lineTotal = unitPrice * quantity;
  const canAdd = missing.length === 0;

  function handleAdd() {
    if (!canAdd) return;
    addLine({
      productId: product.id,
      name: product.name,
      basePrice: product.price,
      quantity,
      modifiers: chosenModifiers,
      notes,
    });
    router.push("/menu");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-40">
      <header className="py-6">
        <Link
          href="/menu"
          className="text-sm text-black/50 hover:underline dark:text-white/50"
        >
          ← Menú
        </Link>
      </header>

      {product.image_url && (
        <Image
          src={product.image_url}
          alt={product.name}
          width={672}
          height={320}
          className="mb-4 h-56 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
      {product.description && (
        <p className="mt-1 text-black/60 dark:text-white/60">
          {product.description}
        </p>
      )}
      <p className="mt-2 text-lg font-semibold">{formatMoney(product.price)}</p>

      {/* Grupos de opciones */}
      <div className="mt-6 space-y-6">
        {groups.map((group) => {
          const ids = selected[group.id] ?? [];
          const single = group.max_select === 1;
          const atMax = !single && ids.length >= group.max_select;
          return (
            <section key={group.id}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{group.name}</h2>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {groupHint(group)}
                </span>
              </div>
              <div className="space-y-2">
                {group.modifiers.map((opt) => {
                  const checked = ids.includes(opt.id);
                  const disabled = !checked && atMax;
                  return (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                        checked
                          ? "border-black bg-black/[0.03] dark:border-white dark:bg-white/[0.06]"
                          : "border-black/15 dark:border-white/15"
                      } ${disabled ? "opacity-40" : ""}`}
                    >
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={group.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(group, opt.id)}
                        className="h-4 w-4 accent-black dark:accent-white"
                      />
                      <span className="flex-1">{opt.name}</span>
                      {opt.extra_price > 0 && (
                        <span className="text-black/60 dark:text-white/60">
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
      </div>

      {/* Comentarios */}
      <div className="mt-6">
        <label className="mb-1 block text-sm font-medium">Comentarios</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Ej. sin sal, término medio…"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
      </div>

      {/* Barra fija: cantidad + agregar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-[var(--background)] p-4 dark:border-white/10">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Menos"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-9 w-9 rounded-full border border-black/15 text-lg leading-none dark:border-white/15"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-medium">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Más"
              onClick={() => setQuantity((q) => q + 1)}
              className="h-9 w-9 rounded-full border border-black/15 text-lg leading-none dark:border-white/15"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 rounded-full bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {canAdd
              ? `Agregar · ${formatMoney(lineTotal)}`
              : `Falta elegir: ${missing.join(", ")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
