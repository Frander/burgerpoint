import { getMenu } from "@/lib/menu";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CartProvider } from "@/components/cart/CartProvider";
import Storefront from "@/components/storefront/Storefront";

export default async function StorefrontPage() {
  const menu = await getMenu();
  const previewMode = !isSupabaseConfigured();

  return (
    <CartProvider>
      <Storefront menu={menu} previewMode={previewMode} />
    </CartProvider>
  );
}
