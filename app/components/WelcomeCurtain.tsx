"use client";

import { useCallback, useEffect, useState } from "react";
import { Delete, Heart } from "lucide-react";

const AUTO_OPEN_MS = 1000;
// Pausa para ver los corazones llenos antes de abrir el telón.
const UNLOCKED_PAUSE_MS = 650;
// Duración del recorrido completo: las cortinas (2.35 s) y la cenefa (2.6 s).
const OPEN_DURATION_MS = 2800;
const PIN_LENGTH = 6;
// El Refugio lo marca al volver al chat para no repetir el telón en la misma visita.
export const SKIP_CURTAIN_KEY = "mireya:skip-curtain";

type Phase = "checking" | "locked" | "closed" | "opening" | "gone";
type PinState = "idle" | "checking" | "wrong" | "right";

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

type Props = { onUnlock: () => void; onOpen: () => void };

export default function WelcomeCurtain({ onUnlock, onOpen }: Props) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [digits, setDigits] = useState("");
  const [pinState, setPinState] = useState<PinState>("idle");

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

  const press = useCallback(
    (digit: string) => {
      if (pinState !== "idle") return;
      setDigits((current) => (current.length < PIN_LENGTH ? current + digit : current));
    },
    [pinState]
  );

  const erase = useCallback(() => {
    if (pinState !== "idle") return;
    setDigits((current) => current.slice(0, -1));
  }, [pinState]);

  useEffect(() => {
    if (digits.length !== PIN_LENGTH || pinState !== "idle") return;
    setPinState("checking");
    void fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: digits }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("PIN incorrecto");
        setPinState("right");
        onUnlock();
        setTimeout(() => setPhase(prefersReducedMotion() ? "gone" : "opening"), UNLOCKED_PAUSE_MS);
      })
      .catch(() => {
        setPinState("wrong");
        setTimeout(() => {
          setDigits("");
          setPinState("idle");
        }, 900);
      });
  }, [digits, pinState, onUnlock]);

  useEffect(() => {
    if (phase !== "locked") return;
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") erase();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press, erase]);

  if (phase === "gone") return null;

  return (
    <div className={`curtain-stage ${phase === "opening" ? "is-open" : ""}`}>
      <div className="curtain curtain-left" />
      <div className="curtain curtain-right" />
      <div className="curtain-valance" />

      {phase === "locked" || (phase === "opening" && pinState === "right") ? (
        <div className="curtain-seal-wrap">
          <div className={`pin-card pin-${pinState}`}>
            <span className="pin-seal">M</span>
            <p className="font-display text-[26px] italic leading-none text-[#fff4f6] sm:text-[30px]">Mireya AI</p>
            <p className="font-hand text-[20px] leading-none text-[#ffe3ea] sm:text-[22px]">
              {pinState === "wrong" ? "esa no es… intenta otra vez" : pinState === "right" ? "¡bienvenida!" : "escribe tu clave secreta"}
            </p>

            <div className="pin-hearts" role="status" aria-label={`${digits.length} de ${PIN_LENGTH} dígitos`}>
              {Array.from({ length: PIN_LENGTH }, (_, index) => (
                <Heart
                  key={index}
                  aria-hidden="true"
                  className={index < digits.length ? "is-filled" : ""}
                  fill={index < digits.length ? "currentColor" : "none"}
                  strokeWidth={1.8}
                />
              ))}
            </div>

            <p className="pin-hint">pista: la fecha más especial del año</p>

            <div className="pin-pad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button key={digit} type="button" className="pin-key" onClick={() => press(digit)}>
                  {digit}
                </button>
              ))}
              <span aria-hidden="true" />
              <button type="button" className="pin-key" onClick={() => press("0")}>
                0
              </button>
              <button type="button" className="pin-key pin-key-soft" onClick={erase} aria-label="Borrar">
                <Delete size={22} strokeWidth={1.6} />
              </button>
            </div>
          </div>
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
