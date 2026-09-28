"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Timbre de "pedido nuevo" para el PDV y la cocina.
 *
 * El sonido se genera con Web Audio (sin archivo). Los navegadores no dejan
 * sonar nada hasta que la persona toca la página, así que:
 *   - la preferencia (encendido/apagado) se recuerda en este equipo, y
 *   - el audio se "desbloquea" con el primer clic en cualquier parte.
 */

const LLAVE = "bp-sonido-pedidos";

function leerPreferencia(): boolean {
  try {
    return localStorage.getItem(LLAVE) !== "0";
  } catch {
    return true;
  }
}

function guardarPreferencia(on: boolean) {
  try {
    localStorage.setItem(LLAVE, on ? "1" : "0");
  } catch {
    // Modo privado o almacenamiento bloqueado: solo dura esta visita.
  }
}

/** Dos "ding" ascendentes, repetidos: se oye en una cocina con ruido. */
function timbre(ctx: AudioContext) {
  const notas = [
    { f: 880, t: 0 }, // La5
    { f: 1318.5, t: 0.18 }, // Mi6
    { f: 880, t: 0.6 },
    { f: 1318.5, t: 0.78 },
  ];
  const inicio = ctx.currentTime + 0.02;
  for (const { f, t } of notas) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    vol.gain.setValueAtTime(0.0001, inicio + t);
    vol.gain.exponentialRampToValueAtTime(0.6, inicio + t + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, inicio + t + 0.45);
    osc.connect(vol).connect(ctx.destination);
    osc.start(inicio + t);
    osc.stop(inicio + t + 0.5);
  }
}

export function useOrderSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [activo, setActivo] = useState(true);
  const [desbloqueado, setDesbloqueado] = useState(false);

  // La preferencia vive en el navegador: se lee al montar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage no existe en el servidor
    setActivo(leerPreferencia());
  }, []);

  const contexto = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctxRef.current = new AC();
    return ctxRef.current;
  }, []);

  // Primer clic/tecla en la página: desbloquea el audio.
  useEffect(() => {
    function desbloquear() {
      const ctx = contexto();
      if (!ctx) return;
      void ctx.resume().then(() => setDesbloqueado(ctx.state === "running"));
    }
    window.addEventListener("pointerdown", desbloquear);
    window.addEventListener("keydown", desbloquear);
    return () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, [contexto]);

  const sonar = useCallback(() => {
    if (!activo) return;
    const ctx = contexto();
    if (!ctx || ctx.state !== "running") return;
    timbre(ctx);
  }, [activo, contexto]);

  const alternar = useCallback(() => {
    const nuevo = !activo;
    setActivo(nuevo);
    guardarPreferencia(nuevo);
    const ctx = contexto();
    // Al encenderlo suena una vez, para que se sepa cómo suena y a qué volumen.
    if (nuevo && ctx) {
      void ctx.resume().then(() => {
        setDesbloqueado(ctx.state === "running");
        timbre(ctx);
      });
    }
  }, [activo, contexto]);

  return { activo, desbloqueado, sonar, alternar };
}

export function OrderSoundToggle({
  activo,
  desbloqueado,
  alternar,
}: Pick<ReturnType<typeof useOrderSound>, "activo" | "desbloqueado" | "alternar">) {
  const pendiente = activo && !desbloqueado;
  return (
    <button
      type="button"
      onClick={alternar}
      title={
        activo
          ? "Suena cuando llega un pedido nuevo. Clic para silenciar."
          : "Clic para que suene cuando llegue un pedido nuevo."
      }
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        pendiente
          ? "animate-pulse border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
          : activo
            ? "border-green-600/40 text-green-700 dark:text-green-400"
            : "border-black/15 text-black/50 dark:border-white/20 dark:text-white/50"
      }`}
    >
      {pendiente ? "🔔 Toca para activar sonido" : activo ? "🔔 Sonido" : "🔕 Silencio"}
    </button>
  );
}
