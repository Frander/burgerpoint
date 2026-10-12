import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getProduct } from "@/lib/menu";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getHorario } from "@/lib/settings";
import { estaAbierto } from "@/lib/hours";
import ProductDetail from "@/components/storefront/ProductDetail";

// En Next.js 16 `params` es una Promesa.
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Abierto o cerrado depende de la hora: nunca se prerenderiza.
  await connection();
  const { id } = await params;
  const [product, horario] = await Promise.all([getProduct(id), getHorario()]);
  if (!product) notFound();

  return (
    <ProductDetail
      product={product}
      abierto={!isSupabaseConfigured() || estaAbierto(horario)}
    />
  );
}
