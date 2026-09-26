"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { entrar, pedirCodigo } from "@/app/(public)/cuenta/actions";

/**
 * Entrar con el teléfono: se pide un código y se confirma. El nombre solo se
 * usa la primera vez, así que se pregunta junto al código para no hacer dos
 * pantallas de formulario.
 */
export default function EntrarCliente() {
  const router = useRouter();
  const [paso, setPaso] = useState<"telefono" | "codigo">("telefono");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pedir() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await pedirCodigo(phone);
      if (!res.ok) {
        setError(res.error ?? "No se pudo enviar el código.");
        return;
      }
      if (res.warning) setAviso(res.warning);
      setPaso("codigo");
    });
  }

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await entrar(phone, code, name);
      if (res.ok) router.refresh();
      else setError(res.error ?? "No se pudo entrar.");
    });
  }

  return (
    <div className="rounded-2xl border border-black/10 p-5">
      <p className="text-sm text-black/70">
        Junta puntos con cada pedido y cámbialos por un descuento. Entra con tu
        número de WhatsApp: te mandamos un código.
      </p>

      {paso === "telefono" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            pedir();
          }}
        >
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Tu WhatsApp (999 123 4567)"
            className="w-full rounded-lg border border-black/15 px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending || phone.trim().length < 10}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Enviando…" : "Mandarme el código"}
          </button>
        </form>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            confirmar();
          }}
        >
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de 6 dígitos"
            className="w-full rounded-lg border border-black/15 px-3 py-2.5 text-center text-lg tracking-[0.3em]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre (solo la primera vez)"
            className="w-full rounded-lg border border-black/15 px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending || code.trim().length < 4}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Entrando…" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPaso("telefono");
              setCode("");
              setError(null);
            }}
            className="w-full text-xs text-black/50 hover:underline"
          >
            Usar otro número
          </button>
        </form>
      )}

      {aviso && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {aviso}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
