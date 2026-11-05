"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PinPad from "../components/PinPad";
import { SKIP_CURTAIN_KEY } from "../components/WelcomeCurtain";

// Pausa para ver los corazones llenos antes de abrir el telón.
const UNLOCKED_PAUSE_MS = 650;
const OPEN_DURATION_MS = 2800;
// Si algo tarda de más, el telón se abre de todos modos.
const MAX_WAIT_MS = 6000;

type Phase = "locked" | "opening" | "gone";

// Por ahora usa la misma clave del sitio; después tendrá la suya.
const checkPin = async (pin: string) =>
  (
    await fetch("/api/unlock", {
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
  const [phase, setPhase] = useState<Phase>("locked");

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
            router.push("/");
          },
        });
      });
      await document.fonts.ready;
    })();
    return readyRef.current;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/unlock", { cache: "no-store" })
      .then((response) => response.json())
      .then(({ unlocked }) => {
        if (unlocked && !cancelled) void prepare();
      })
      .catch(() => null);
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      readyRef.current = null;
    };
  }, [prepare]);

  const accepted = useCallback(() => {
    const pause = new Promise((resolve) => setTimeout(resolve, UNLOCKED_PAUSE_MS));
    const limit = new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS));
    void Promise.race([Promise.all([pause, prepare()]), limit]).then(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setPhase("gone");
      setPhase("opening");
      setTimeout(() => setPhase("gone"), OPEN_DURATION_MS);
    });
  }, [prepare]);

  return (
    <>
      <div ref={rootRef} className="dy" />
      {phase !== "gone" && (
        <div className={`curtain-stage dy-curtain ${phase === "opening" ? "is-open" : ""}`}>
          <div className="curtain curtain-left" />
          <div className="curtain curtain-right" />
          <div className="curtain-valance" />
          <div className="curtain-seal-wrap">
            <PinPad
              onSubmit={checkPin}
              onSuccess={accepted}
              seal={<span className="pin-seal">M</span>}
              title="El diario de Mireya"
              prompt="escribe tu clave secreta"
            />
          </div>
        </div>
      )}
    </>
  );
}
