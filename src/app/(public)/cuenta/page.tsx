import Link from "next/link";
import { clienteActual } from "@/lib/customer-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCoupons, getCustomerSummary } from "@/lib/loyalty";
import CuentaCliente from "@/components/cuenta/CuentaCliente";
import EntrarCliente from "@/components/cuenta/EntrarCliente";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mis puntos — Burguer Point",
};

/** Programa de puntos: el cliente entra con su teléfono y ve lo que lleva. */
export default async function CuentaPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El programa de puntos todavía no está disponible.
        </p>
      </main>
    );
  }

  const phone = await clienteActual();
  const resumen = phone ? await getCustomerSummary(phone) : null;

  if (!phone || !resumen) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <Cabecera />
        <EntrarCliente />
      </main>
    );
  }

  const cupones = await getCoupons(phone);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Cabecera />
      <CuentaCliente resumen={resumen} cupones={cupones} />
    </main>
  );
}

function Cabecera() {
  return (
    <div className="mb-6">
      <Link href="/menu" className="text-sm text-black/50 hover:underline">
        ← Volver al menú
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Mis puntos</h1>
    </div>
  );
}
