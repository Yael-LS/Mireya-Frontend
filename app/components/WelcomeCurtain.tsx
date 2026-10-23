"use client";

import { useCallback, useEffect, useState } from "react";
import PinPad from "./PinPad";

const AUTO_OPEN_MS = 1000;
// Pausa para ver los corazones llenos antes de abrir el telón.
const UNLOCKED_PAUSE_MS = 650;
// Duración del recorrido completo: las cortinas (2.35 s) y la cenefa (2.6 s).
const OPEN_DURATION_MS = 2800;
// El Refugio lo marca al volver al chat para no repetir el telón en la misma visita.
export const SKIP_CURTAIN_KEY = "mireya:skip-curtain";

type Phase = "checking" | "locked" | "closed" | "opening" | "gone";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function consumeSkipFlag(): boolean {
  try {
    const skip = sessionStorage.getItem(SKIP_CURTAIN_KEY) === "1";
    sessionStorage.removeItem(SKIP_CURTAIN_KEY);
    return skip;
  } catch {
    return false;
  }
}

const checkSitePin = async (pin: string) =>
  (
    await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    })
  ).ok;

type Props = { onUnlock: () => void; onOpen: () => void };

export default function WelcomeCurtain({ onUnlock, onOpen }: Props) {
  const [phase, setPhase] = useState<Phase>("checking");
  // Si entró con el PIN, el teclado sigue visible mientras se abre el telón.
  const [unlockedByPin, setUnlockedByPin] = useState(false);

  const open = useCallback(() => setPhase((current) => (current === "closed" ? "opening" : current)), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/unlock", { cache: "no-store" })
      .then((response) => response.json())
      .catch(() => ({ unlocked: false }))
      .then(({ unlocked }: { unlocked: boolean }) => {
        if (cancelled) return;
        if (!unlocked) return setPhase("locked");
        onUnlock();
        setPhase(consumeSkipFlag() || prefersReducedMotion() ? "gone" : "closed");
      });
    return () => {
      cancelled = true;
    };
  }, [onUnlock]);

  useEffect(() => {
    if (phase !== "closed") return;
    const timer = setTimeout(open, AUTO_OPEN_MS);
    return () => clearTimeout(timer);
  }, [phase, open]);

  useEffect(() => {
    if (phase !== "opening" && phase !== "gone") return;
    onOpen();
    if (phase !== "opening") return;
    const timer = setTimeout(() => setPhase("gone"), OPEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [phase, onOpen]);

  const pinAccepted = useCallback(() => {
    setUnlockedByPin(true);
    onUnlock();
    setTimeout(() => setPhase(prefersReducedMotion() ? "gone" : "opening"), UNLOCKED_PAUSE_MS);
  }, [onUnlock]);

  if (phase === "gone") return null;

  return (
    <div className={`curtain-stage ${phase === "opening" ? "is-open" : ""}`}>
      <div className="curtain curtain-left" />
      <div className="curtain curtain-right" />
      <div className="curtain-valance" />

      {phase === "locked" || (phase === "opening" && unlockedByPin) ? (
        <div className="curtain-seal-wrap">
          <PinPad
            onSubmit={checkSitePin}
            onSuccess={pinAccepted}
            seal={<span className="pin-seal">M</span>}
            title="Mireya AI"
            prompt="escribe tu clave secreta"
            hint="la fecha más especial del año"
          />
        </div>
      ) : phase !== "checking" ? (
        <div className="curtain-seal-wrap">
          <button type="button" onClick={open} className="curtain-seal" aria-label="Abrir el telón">
            <span className="curtain-seal-ring">M</span>
          </button>
          <p className="font-display text-[26px] italic text-[#fff4f6] [text-shadow:0_2px_10px_rgba(60,10,25,.5)] sm:text-[30px]">
            Mireya AI
          </p>
          <p className="-mt-2 font-hand text-[19px] text-[#ffe3ea] sm:text-[22px]">una biografía viva</p>
        </div>
      ) : null}
    </div>
  );
}
