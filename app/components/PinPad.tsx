"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Delete, Heart } from "lucide-react";

const PIN_LENGTH = 6;

type PinState = "idle" | "checking" | "wrong" | "right";

type Props = {
  /** Devuelve si la clave es correcta (la valida el servidor). */
  onSubmit: (pin: string) => Promise<boolean>;
  onSuccess: () => void;
  seal: ReactNode;
  title: string;
  prompt: string;
  hint?: string | null;
  /** "curtain": texto claro sobre el telón; "light": texto ciruela sobre papel rosa. */
  variant?: "curtain" | "light";
};

// Teclado de la clave con corazones que se llenan; acepta también el teclado físico.
export default function PinPad({ onSubmit, onSuccess, seal, title, prompt, hint, variant = "curtain" }: Props) {
  const [digits, setDigits] = useState("");
  const [pinState, setPinState] = useState<PinState>("idle");

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
    onSubmit(digits)
      .catch(() => false)
      .then((ok) => {
        if (ok) {
          setPinState("right");
          onSuccess();
          return;
        }
        setPinState("wrong");
        setTimeout(() => {
          setDigits("");
          setPinState("idle");
        }, 900);
      });
  }, [digits, pinState, onSubmit, onSuccess]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") erase();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, erase]);

  return (
    <div className={`pin-card pin-${pinState} ${variant === "light" ? "pin-card--light" : ""}`}>
      {seal}
      <p className="pin-title font-display text-[26px] italic leading-none sm:text-[30px]">{title}</p>
      <p className="pin-prompt font-hand text-[20px] leading-none sm:text-[22px]">
        {pinState === "wrong" ? "esa no es… intenta otra vez" : pinState === "right" ? "¡bienvenida!" : prompt}
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

      {hint && <p className="pin-hint">pista: {hint}</p>}

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
  );
}
