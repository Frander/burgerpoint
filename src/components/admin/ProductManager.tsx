"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  type ActionResult,
} from "@/app/admin/menu/actions";
import { formatMoney } from "@/lib/format";
import { uploadProductImage } from "@/lib/upload";
import type { Category, Product } from "@/lib/types";

/** Campo de imagen: sube al Storage y devuelve la URL pública vía onChange. */
function ImageField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <Image
          src={value}
          alt="Imagen del producto"
          width={56}
          height={56}
          className="h-14 w-14 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-black/20 text-xl text-black/30 dark:border-white/20 dark:text-white/30">
          🍔
        </div>
      )}
      <div className="space-y-1">
        <label className="inline-block cursor-pointer rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/15">
          {uploading ? "Subiendo…" : value ? "Cambiar foto" : "Subir foto"}
          <input
            type="file"
            accept="image/*"
            disabled={disabled || uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
        </label>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 text-xs text-red-600"
          >
            Quitar
          </button>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

export default function ProductManager({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Estado del formulario de alta
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Productos</h2>

      {/* Alta */}
      <div className="mb-6 space-y-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Precio"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <input
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <ImageField value={imageUrl} onChange={setImageUrl} disabled={isPending} />
        <div className="flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !name.trim() || !price}
            onClick={() =>
              run(async () => {
                const res = await createProduct({
                  name,
                  description,
                  price: Number(price),
                  category_id: categoryId || null,
                  image_url: imageUrl,
                });
                if (res.ok) {
                  setName("");
                  setPrice("");
                  setDescription("");
                  setImageUrl(null);
                }
                return res;
              })
            }
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Agregar producto
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Lista */}
      <div className="space-y-2">
        {products.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">
            Aún no hay productos.
          </p>
        )}
        {products.map((p) => (
          <ProductRow
            key={p.id}
            product={p}
            categories={categories}
            disabled={isPending}
            onSave={(fields) => run(() => updateProduct(p.id, fields))}
            onToggle={() =>
              run(() => updateProduct(p.id, { available: !p.available }))
            }
            onDelete={() => {
              if (confirm(`¿Eliminar "${p.name}"?`))
                run(() => deleteProduct(p.id));
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ProductRow({
  product,
  categories,
  disabled,
  onSave,
  onToggle,
  onDelete,
}: {
  product: Product;
  categories: Category[];
  disabled: boolean;
  onSave: (fields: {
    name: string;
    price: number;
    description: string | null;
    category_id: string | null;
    image_url: string | null;
  }) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [description, setDescription] = useState(product.description ?? "");
  const [categoryId, setCategoryId] = useState(product.category_id ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(product.image_url);

  const categoryName =
    categories.find((c) => c.id === product.category_id)?.name ?? "Sin categoría";

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-black/20 p-3 dark:border-white/20">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <ImageField value={imageUrl} onChange={setImageUrl} disabled={disabled} />
        <div className="flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onSave({
                name,
                price: Number(price),
                description: description || null,
                category_id: categoryId || null,
                image_url: imageUrl,
              });
              setEditing(false);
            }}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
      {product.image_url ? (
        <Image
          src={product.image_url}
          alt={product.name}
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-black/5 text-lg dark:bg-white/10">
          🍔
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">
          {product.name}{" "}
          <span className="text-black/40 dark:text-white/40">
            · {categoryName}
          </span>
        </p>
        {product.description && (
          <p className="text-xs text-black/50 dark:text-white/50">
            {product.description}
          </p>
        )}
      </div>
      <span className="text-sm font-medium">{formatMoney(product.price)}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`rounded-full px-2.5 py-1 text-xs ${
          product.available
            ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
            : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
        }`}
      >
        {product.available ? "Disponible" : "Agotado"}
      </button>
      <Link
        href={`/admin/menu/${product.id}`}
        className="text-sm text-black/60 hover:underline dark:text-white/60"
      >
        Opciones
      </Link>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm text-black/60 hover:underline dark:text-white/60"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="text-sm text-red-600"
        aria-label="Eliminar producto"
      >
        🗑
      </button>
    </div>
  );
}
