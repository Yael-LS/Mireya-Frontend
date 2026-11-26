"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, MessageCircle, Music, Plus, Tv } from "lucide-react";
import { softNavigate } from "../components/PageVeil";
import { SKIP_CURTAIN_KEY } from "../components/WelcomeCurtain";
import { RECALL_KEY } from "../components/refugio-types";
import type { RecallMoment } from "../components/refugio-types";
import type { Api } from "./types";
import { json } from "./types";

// Un disco con la portada al centro; sin portada, el centro queda negro.
export function Disc({ src, spin = false, className = "", style }: { src?: string | null; spin?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={`disc ${spin ? "spin" : ""} ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="art" /> : <span className="art" />}
    </span>
  );
}

export function Art({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} loading="lazy" className={`art ${className}`} /> : <span aria-hidden="true" className={`art ${className}`} />;
}

export type Tab = "songs" | "series" | "etapas";

// Barra de abajo del celular: las secciones y el + siempre a la mano.
export function Dock({ tab, onTab, onAdd, addLabel }: { tab: Tab | null; onTab: (tab: Tab) => void; onAdd: () => void; addLabel: string }) {
  const item = (id: Tab, label: string, icon: ReactNode) => (
    <button type="button" onClick={() => onTab(id)} aria-current={tab === id ? "page" : undefined}>
      {icon}
      {label}
    </button>
  );
  return (
    <nav className="dock" aria-label="Secciones de la playlist">
      {item("songs", "canciones", <Music size={20} />)}
      {item("series", "series", <Tv size={20} />)}
      <button type="button" onClick={onAdd} className="fab" aria-label={addLabel}>
        <Plus size={26} strokeWidth={2.4} />
      </button>
      {item("etapas", "por etapas", <CalendarDays size={20} />)}
      <Link href="/" onClick={markSkipCurtain}>
        <MessageCircle size={20} />
        al chat
      </Link>
    </nav>
  );
}

export function markSkipCurtain() {
  try {
    sessionStorage.setItem(SKIP_CURTAIN_KEY, "1");
  } catch {
    // Sin sessionStorage solo se repite el telón.
  }
}

export function ShareToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-[13px]">
      <span>que el biógrafo pueda leer lo que escribí</span>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span aria-hidden="true" className={`switch ${value ? "is-on" : ""}`}>
        <span />
      </span>
    </label>
  );
}

const HEART = "M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8.5a3.9 3.9 0 0 1 7 2.3C19 15.6 12 20 12 20z";

export function Hearts({ value, onChange, size = 24 }: { value: number | null; onChange?: (value: number) => void; size?: number }) {
  return (
    <div className="flex gap-1" role={onChange ? "radiogroup" : undefined} aria-label={onChange ? "Valoración" : `${value ?? 0} de 5 corazones`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} de 5 corazones`} onClick={() => onChange(value === n ? 0 : n)} className="heart-btn">
            <svg width={size} height={size} viewBox="0 0 24 24" fill={(value ?? 0) >= n ? "#e05c82" : "rgba(247,168,191,.25)"}><path d={HEART} /></svg>
          </button>
        ) : (
          <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={(value ?? 0) >= n ? "#e05c82" : "rgba(247,168,191,.25)"} aria-hidden="true"><path d={HEART} /></svg>
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
  return <span className={`text-[11px] ${state === "error" ? "text-[#c2304f]" : "text-current opacity-70"}`}>{state === "saving" ? "guardando…" : state === "saved" ? "guardado" : "no se pudo guardar"}</span>;
}

export function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
