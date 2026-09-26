import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCouriers } from "@/lib/couriers";
import {
  getDefaultCourierId,
  getDeliveryFee,
  getLoyaltyConfig,
} from "@/lib/settings";
import SettingsManager from "@/components/admin/SettingsManager";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  await requireSection("ajustes");

  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase (en <code>.env.local</code>) para guardar los ajustes.
        </p>
      </div>
    );
  }

  const [couriers, defaultCourierId, deliveryFee, loyalty] = await Promise.all([
    getCouriers(),
    getDefaultCourierId(),
    getDeliveryFee(),
    getLoyaltyConfig(),
  ]);

  return (
    <SettingsManager
      couriers={couriers}
      defaultCourierId={defaultCourierId}
      deliveryFee={deliveryFee}
      loyalty={loyalty}
    />
  );
}
