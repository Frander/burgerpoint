"use client";

import { useEffect } from "react";

/** Lanza el diálogo de impresión al cargar la página del ticket. */
export default function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    // Pequeña espera para que carguen logo y QR antes de imprimir.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [enabled]);

  return (
    <div className="mx-auto flex w-[72mm] gap-2 py-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white"
      >
        🖨 Imprimir
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="flex-1 rounded-lg border border-gray-300 py-2 text-sm"
      >
        Cerrar
      </button>
    </div>
  );
}
