"use client";

import { useEffect, useRef, useState } from "react";
import { softNavigate } from "../components/PageVeil";
import { SKIP_CURTAIN_KEY } from "../components/WelcomeCurtain";
import { RECALL_KEY } from "../components/refugio-types";
import type { RecallMoment } from "../components/refugio-types";
import type { Api, Mood } from "./types";
import { json } from "./types";

// Decoración que viste cada página según el sentimiento.
export function MoodDecor({ mood, big = false }: { mood: Mood | null; big?: boolean }) {
  const s = big ? 1.4 : 1;
  if (mood === "heartbreak")
    return (
      <span aria-hidden="true" className="acm-decor">
        <span className="acm-blinds" />
        <span className="acm-coffee" style={{ width: 90 * s, height: 90 * s }} />
        <svg className="acm-leaf" width={84 * s} height={78 * s} viewBox="0 0 120 110"><path d="M60 8C88 24 100 56 86 86 72 104 46 104 32 86 18 60 32 26 60 8z" fill="#b07a4c" /><path d="M60 10C58 44 54 74 40 98" stroke="#7a4f2c" strokeWidth="2" fill="none" /></svg>
      </span>
    );
  if (mood === "strength")
    return (
      <span aria-hidden="true" className="acm-decor">
        <span className="acm-sun" />
        <svg className="acm-flower" width={78 * s} height={78 * s} viewBox="0 0 80 80"><g fill="#f2a65a"><circle cx="40" cy="40" r="8" /><ellipse cx="40" cy="20" rx="7" ry="12" /><ellipse cx="40" cy="60" rx="7" ry="12" /><ellipse cx="20" cy="40" rx="12" ry="7" /><ellipse cx="60" cy="40" rx="12" ry="7" /></g></svg>
      </span>
    );
  if (mood === "nostalgia")
    return (
      <span aria-hidden="true" className="acm-decor">
        <span className="acm-rain" />
        <span className="acm-faded" style={{ width: 90 * s, height: 104 * s }} />
      </span>
    );
  if (mood === "dance")
    return (
      <span aria-hidden="true" className="acm-decor">
        <svg className="acm-star" width={66 * s} height={66 * s} viewBox="0 0 24 24"><path d="M12 2l2.6 6.4L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.6z" fill="#e98aa5" /></svg>
        <svg className="acm-star acm-star-2" width={34 * s} height={34 * s} viewBox="0 0 24 24"><path d="M12 2l2.6 6.4L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.6z" fill="#d9567a" /></svg>
      </span>
    );
  return null;
}

export function ShareToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="acm-share">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span aria-hidden="true" className={`acm-switch ${value ? "is-on" : ""}`}>
        <span />
      </span>
      que el biógrafo lo sepa
    </label>
  );
}

const HEART = "M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8.5a3.9 3.9 0 0 1 7 2.3C19 15.6 12 20 12 20z";

export function Hearts({ value, onChange, size = 24 }: { value: number | null; onChange?: (value: number) => void; size?: number }) {
  return (
    <div className="flex gap-1" role={onChange ? "radiogroup" : undefined} aria-label={onChange ? "Valoración" : `${value ?? 0} de 5 corazones`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} de 5 corazones`} onClick={() => onChange(value === n ? 0 : n)} className="acm-heart-btn">
            <svg width={size} height={size} viewBox="0 0 24 24" fill={(value ?? 0) >= n ? "#e05c82" : "#f3d3dc"}><path d={HEART} /></svg>
          </button>
        ) : (
          <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={(value ?? 0) >= n ? "#e05c82" : "#f3d3dc"} aria-hidden="true"><path d={HEART} /></svg>
        ),
      )}
    </div>
  );
}

// «Platicarla en el chat»: igual que «recordarlo en el chat» del Refugio.
export function chatAbout(recall: RecallMoment) {
  try {
    sessionStorage.setItem(RECALL_KEY, JSON.stringify(recall));
    sessionStorage.setItem(SKIP_CURTAIN_KEY, "1");
  } catch {
    // Sin sessionStorage el chat abre normal.
  }
  softNavigate("/");
}

export async function saveToRefugio(api: Api, item: { kind: string; title: string; creator?: string | null; url?: string | null; note?: string | null }) {
  try {
    await api("refugio/items", { method: "POST", ...json(item) });
    return "Guardado en tu Refugio.";
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    return message.includes("ya está") ? "Ya estaba en tu Refugio." : message || "No se pudo guardar en el Refugio.";
  }
}

// Guarda un texto mientras ella escribe, sin esperar a que salga. Solo cuando el
// texto cambió de verdad: abrir la pantalla nunca guarda nada (ni en modo estricto).
export function useAutosave(value: string, save: (value: string) => Promise<unknown>, delay = 900) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saved = useRef(value);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (value === saved.current) return;
    setState("saving");
    const timer = setTimeout(() => {
      saveRef.current(value).then(
        () => {
          saved.current = value;
          setState("saved");
        },
        () => setState("error"),
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return state;
}

export function SaveHint({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return <span className={`text-[11px] ${state === "error" ? "text-rose-700" : "text-current opacity-70"}`}>{state === "saving" ? "guardando…" : state === "saved" ? "guardado" : "no se pudo guardar"}</span>;
}

export function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
