"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, type CartModifier } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import type { ModifierGroupWithOptions, ProductWithModifiers } from "@/lib/types";

function groupHint(g: ModifierGroupWithOptions): string {
  if (g.max_select === 1) {
    return g.min_select >= 1 ? "Seleccione 1 opción" : "Seleccione hasta 1 opción";
  }
  if (g.min_select >= 1) {
    return `Seleccione de ${g.min_select} a ${g.max_select} opciones`;
  }
  return `Seleccione hasta ${g.max_select} opciones`;
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
    <div className="min-h-full bg-white text-gray-900">
      <div className="mx-auto w-full max-w-4xl px-4 pb-32">
        {/* Encabezado: volver + título centrado, como el modal de OlaClick */}
        <header className="relative flex items-center justify-center py-5">
          <Link
            href="/menu"
            aria-label="Volver al menú"
            className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg transition-colors hover:bg-gray-50"
          >
            ←
          </Link>
          <h1 className="max-w-[70%] truncate text-xl font-bold tracking-tight">
            {product.name}
          </h1>
        </header>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Imagen */}
          {product.image_url && (
            <Image
              src={product.image_url}
              alt={product.name}
              width={672}
              height={672}
              className="w-full rounded-xl object-cover"
            />
          )}

          {/* Información + opciones */}
          <div className={product.image_url ? "" : "md:col-span-2"}>
            {product.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {product.description}
              </p>
            )}
            <p className="mt-3 text-lg font-bold">{formatMoney(product.price)}</p>

            {/* Grupos de opciones */}
            <div className="mt-6 space-y-6">
              {groups.map((group) => {
                const ids = selected[group.id] ?? [];
                const single = group.max_select === 1;
                const atMax = !single && ids.length >= group.max_select;
                return (
                  <section
                    key={group.id}
                    className="border-t border-gray-100 pt-4"
                  >
                    <h2 className="font-semibold">{group.name}</h2>
                    <p className="text-xs text-gray-400">{groupHint(group)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.modifiers.map((opt) => {
                        const checked = ids.includes(opt.id);
                        const disabled = !checked && atMax;
                        return (
                          <label
                            key={opt.id}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
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
                              className="h-4 w-4 accent-gray-900"
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
            </div>

            {/* Comentarios */}
            <div className="mt-6 border-t border-gray-100 pt-4">
              <label className="mb-2 block font-semibold">Comentarios</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="(Opcional)"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Barra fija: cantidad + agregar */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white p-4">
          <div className="mx-auto flex w-full max-w-md items-center justify-center gap-3">
            <div className="flex items-center rounded-lg border border-gray-200">
              <button
                type="button"
                aria-label="Menos"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center text-lg transition-colors hover:bg-gray-50"
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
                className="flex h-11 w-11 items-center justify-center text-lg transition-colors hover:bg-gray-50"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="h-11 flex-1 rounded-lg bg-gray-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              {canAdd
                ? `Agregar ${formatMoney(lineTotal)}`
                : `Falta elegir: ${missing.join(", ")}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
