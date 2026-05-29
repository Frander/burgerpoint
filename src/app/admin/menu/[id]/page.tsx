import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ModifierGroupWithOptions, Product } from "@/lib/types";
import ModifierManager from "@/components/admin/ModifierManager";

export const dynamic = "force-dynamic";

export default async function ProductOptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Opciones</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para gestionar las opciones.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const { data: groups } = await supabase
    .from("modifier_groups")
    .select("*, modifiers(*)")
    .eq("product_id", id)
    .order("sort_order");

  const sortedGroups = ((groups ?? []) as ModifierGroupWithOptions[])
    .map((g) => ({
      ...g,
      modifiers: [...(g.modifiers ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/menu"
          className="text-sm text-black/50 hover:underline dark:text-white/50"
        >
          ← Menú
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          Opciones · {(product as Product).name}
        </h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Grupos de opciones que el cliente verá al pedir este producto (ej.
          “Sin”, “Sabor de bebida”, “Agrégale”).
        </p>
      </div>

      <ModifierManager productId={id} groups={sortedGroups} />
    </div>
  );
}
