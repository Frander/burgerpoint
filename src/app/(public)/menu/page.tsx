import { getMenu } from "@/lib/menu";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Storefront from "@/components/storefront/Storefront";

export default async function MenuPage() {
  const menu = await getMenu();
  const previewMode = !isSupabaseConfigured();

  return <Storefront menu={menu} previewMode={previewMode} />;
}
