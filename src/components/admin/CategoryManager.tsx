"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/app/admin/menu/actions";
import type { Category } from "@/lib/types";

export default function CategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
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
    <section>
      <h2 className="mb-3 text-lg font-semibold">Categorías</h2>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10"
          >
            <input
              defaultValue={cat.name}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== cat.name)
                  run(() => updateCategory(cat.id, { name: value }));
              }}
              className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-black/15 focus:border-black/30 dark:hover:border-white/15"
            />
            <button
              type="button"
              onClick={() =>
                run(() => updateCategory(cat.id, { active: !cat.active }))
              }
              className={`rounded-full px-2.5 py-1 text-xs ${
                cat.active
                  ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
              }`}
            >
              {cat.active ? "Activa" : "Oculta"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar la categoría "${cat.name}"?`))
                  run(() => deleteCategory(cat.id));
              }}
              className="text-sm text-red-600"
              aria-label="Eliminar categoría"
            >
              🗑
            </button>
          </div>
        ))}
      </div>

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
