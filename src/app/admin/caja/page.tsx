import { createClient } from "@/lib/supabase/server";
import { requireSection } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { CashMovement, CashSession, OrderPayment } from "@/lib/types";
import CashManager from "@/components/admin/CashManager";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  await requireSection("caja");
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Caja</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Conecta Supabase para usar la caja.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: openSessionData, error: tableErr } = await supabase
    .from("cash_sessions")
    .select("*")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tableErr) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Caja</h1>
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Falta ejecutar la migración <code>0007_caja.sql</code> en el SQL
          Editor de Supabase.
        </p>
      </div>
    );
  }

  const session = (openSessionData as CashSession | null) ?? null;

  let payments: OrderPayment[] = [];
  let movements: CashMovement[] = [];
  if (session) {
    const [{ data: pays }, { data: moves }] = await Promise.all([
      supabase
        .from("order_payments")
        .select("*")
        .eq("cash_session_id", session.id),
      supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false }),
    ]);
    payments = (pays ?? []) as OrderPayment[];
    movements = (moves ?? []) as CashMovement[];
  }

  const { data: history } = await supabase
    .from("cash_sessions")
    .select("*")
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(20);

  return (
    <CashManager
      session={session}
      payments={payments}
      movements={movements}
      history={(history ?? []) as CashSession[]}
    />
  );
}
