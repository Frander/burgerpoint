import { notFound } from "next/navigation";
import { getProduct } from "@/lib/menu";
import ProductDetail from "@/components/storefront/ProductDetail";

// En Next.js 16 `params` es una Promesa.
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return <ProductDetail product={product} />;
}
