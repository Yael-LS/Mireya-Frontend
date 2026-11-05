"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { softNavigate } from "../components/PageVeil";
import PinPad from "../components/PinPad";
import { SKIP_CURTAIN_KEY } from "../components/WelcomeCurtain";

// Pausa para ver los corazones llenos antes de abrir el telón.
const UNLOCKED_PAUSE_MS = 650;
const OPEN_DURATION_MS = 2800;
// Si algo tarda de más, el telón se abre de todos modos.
const MAX_WAIT_MS = 6000;

type Phase = "checking" | "locked" | "opening" | "gone";

const checkPin = async (pin: string) =>
  (
    await fetch("/api/diario-lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    })
  ).ok;

export default function DiarioPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [hint, setHint] = useState<string | null>(null);
  const [byPin, setByPin] = useState(false);

  // El diario se prepara detrás del telón, para que al abrirse ya esté completo.
  const prepare = useCallback(() => {
    if (readyRef.current) return readyRef.current;
    readyRef.current = (async () => {
      const { mount } = await import("./diary");
      await new Promise<void>((resolve) => {
        cleanupRef.current = mount(rootRef.current, {
          onReady: resolve,
          exit: () => {
            sessionStorage.setItem(SKIP_CURTAIN_KEY, "1");
            softNavigate("/");
          },
        });
      });
      await document.fonts.ready;
    })();
    return readyRef.current;
  }, []);

  const open = useCallback(
    (pauseMs: number) => {
      const pause = new Promise((resolve) => setTimeout(resolve, pauseMs));
      const limit = new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS));
      void Promise.race([Promise.all([pause, prepare()]), limit]).then(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setPhase("gone");
        setPhase("opening");
        setTimeout(() => setPhase("gone"), OPEN_DURATION_MS);
      });
    },
    [prepare]
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/diario-lock", { cache: "no-store" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) return router.replace("/");
        const status = await response.json().catch(() => null);
        setHint(status?.hint ?? null);
        if (status?.unlocked) open(0);
        else setPhase("locked");
      })
      .catch(() => !cancelled && setPhase("locked"));
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      readyRef.current = null;
    };
  }, [open, router]);

  const accepted = useCallback(() => {
    setByPin(true);
    open(UNLOCKED_PAUSE_MS);
  }, [open]);

  return (
    <>
      <div ref={rootRef} className="dy" />
      {phase !== "gone" && (
        <div className={`curtain-stage dy-curtain ${phase === "opening" ? "is-open" : ""}`}>
          <div className="curtain curtain-left" />
          <div className="curtain curtain-right" />
          <div className="curtain-valance" />
          {(phase === "locked" || byPin) && (
            <div className="curtain-seal-wrap">
              <PinPad
                onSubmit={checkPin}
                onSuccess={accepted}
                seal={<span className="pin-seal">M</span>}
                title="El diario de Mireya"
                prompt="escribe tu clave secreta"
                hint={hint}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
