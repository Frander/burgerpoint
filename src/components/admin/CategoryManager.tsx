"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  type ActionResult,
} from "@/app/admin/menu/actions";
import SortableList from "@/components/admin/SortableList";
import type { Category } from "@/lib/types";

type Run = (fn: () => Promise<ActionResult>) => void;

export default function CategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run: Run = (fn) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  };

  return (
    <section>
      <h2 className="text-lg font-semibold">Categorías</h2>
      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        Arrastra ⠿ para cambiar el orden en que aparecen en el menú. Edita el
        nombre y pulsa Guardar (o Enter).
      </p>

      <SortableList
        items={categories}
        disabled={isPending}
        onReorder={(ids) => run(() => reorderCategories(ids))}
        renderItem={(category, handle) => (
          <CategoryRow
            category={category}
            handle={handle}
            disabled={isPending}
            run={run}
          />
        )}
      />

      <div className="mt-3 flex gap-2">
        <input
          placeholder="Nueva categoría"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <button
          type="button"
          disabled={isPending || !newName.trim()}
          onClick={() =>
            run(async () => {
              const res = await createCategory(newName, categories.length);
              if (res.ok) setNewName("");
              return res;
            })
          }
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Agregar
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function CategoryRow({
  category,
  handle,
  disabled,
  run,
}: {
  category: Category;
  handle: React.ReactNode;
  disabled: boolean;
  run: Run;
}) {
  const [draft, setDraft] = useState(category.name);
  // Evita reenviar el mismo nombre cuando Enter y el blur se disparan seguidos.
  const [submitted, setSubmitted] = useState(category.name);

  const value = draft.trim();
  const dirty =
    value !== "" && value !== category.name && value !== submitted;

  function save() {
    if (!dirty) return;
    setSubmitted(value);
    run(async () => {
      const res = await updateCategory(category.id, { name: value });
      if (!res.ok) setSubmitted(category.name); // permite reintentar
      return res;
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-black">
      {handle}
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            setDraft(category.name);
          }
        }}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-black/15 focus:border-black/30 dark:hover:border-white/15"
      />
      {dirty && (
        <button
          type="button"
          disabled={disabled}
          // El blur guardaría antes del click; así solo se envía una vez.
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
        onClick={() =>
          run(() => updateCategory(category.id, { active: !category.active }))
        }
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
          category.active
            ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
            : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
        }`}
      >
        {category.active ? "Activa" : "Oculta"}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (confirm(`¿Eliminar la categoría "${category.name}"?`))
            run(() => deleteCategory(category.id));
        }}
        className="shrink-0 text-sm text-red-600"
        aria-label="Eliminar categoría"
      >
        🗑
      </button>
    </div>
  );
}
