"use client";

import { ChangeEvent, Fragment, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Heart, ImagePlus, List, PenLine, Search, X } from "lucide-react";
import TulipIcon from "./TulipIcon";
import { preparePhoto } from "../lib/photo";
import { KIND_LABELS } from "./refugio-types";
import type { RefugioItem, RefugioSuggestion } from "./refugio-types";

export type Memory = {
  id: string;
  text: string;
  created_at: string | null;
  photo_url: string | null;
  photo_caption: string | null;
};

type IngestResult = { memory?: Memory | null; refugio?: RefugioItem[]; refugio_suggestions?: RefugioSuggestion[] };

type Props = {
  onClose: () => void;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};

// `preview` es null si el celular no pudo leerla (HEIC): la convierte el servidor.
type Photo = { data: string; type: string; preview: string | null };

const MAX_TEXT = 10_000;
const MAX_CAPTION = 40;
const ZONE = "America/Mexico_City";

const PROMPTS = [
  { label: "una anécdota", placeholder: "Cuéntame algo que te pasó, con todo y detalles…" },
  { label: "una canción", placeholder: "¿Qué canción es y qué significa para ti?" },
  { label: "un gusto", placeholder: "Algo que te encanta y por qué…" },
  { label: "algo importante", placeholder: "Un dato que el biógrafo nunca debería olvidar…" },
];

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ---------- Fechas en hora del centro de México ----------

const parts = (iso: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("es-MX", { timeZone: ZONE, ...options }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );

const timeLabel = (iso: string) => {
  const p = parts(iso, { hour: "numeric", minute: "2-digit", hour12: true });
  const period = (p.dayPeriod ?? "").replace(/[\s.]/g, "").toLowerCase();
  return `${p.hour}:${p.minute} ${period}`.trim();
};

const dateBits = (iso: string) => {
  const p = parts(iso, { day: "numeric", month: "long", year: "numeric" });
  const month = p.month.toLowerCase();
  return { day: p.day, month, short: month.slice(0, 3), year: p.year, time: timeLabel(iso) };
};

const monthKey = (iso: string | null) => {
  if (!iso) return "los primeros";
  const { month, year } = dateBits(iso);
  return `${month} ${year}`;
};

// "2026-11-24": el día en México, que es el que ella vivió.
const dayKey = (iso: string) => {
  const p = parts(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const UNDATED = "sin-fecha";

type Month = { y: number; m: number }; // m: 0 = enero
const monthOf = (key: string): Month => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1 });
const monthIndex = ({ y, m }: Month) => y * 12 + m;
const pad = (n: number) => String(n).padStart(2, "0");
const dayLabel = (key: string) => `${Number(key.slice(8, 10))} de ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Cell = { key: string; day: number; inMonth: boolean };

// Semanas de lunes a domingo, con los días vecinos en gris para cerrar la cuadrícula.
function monthCells({ y, m }: Month): Cell[] {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const date = new Date(Date.UTC(y, m, 1 - lead + i));
    return {
      key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === m,
    };
  });
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Reduce la foto antes de subirla: pesa menos y cabe de sobra en el límite del servidor.
async function shrinkPhoto(file: File): Promise<Photo> {
  const { photo_base64, photo_type } = await preparePhoto(file);
  return { data: photo_base64, type: photo_type, preview: photo_type === "image/jpeg" ? photo_base64 : null };
}

const photoError = (cause: unknown) => (cause instanceof Error && cause.message ? cause.message : "No pude leer esa foto. Prueba con otra.");

// Icono del botón: dos notitas con un corazón.
export function MemoriesIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" className={className}>
      <rect x="6.5" y="3.5" width="13" height="15" rx="1.5" transform="rotate(8 13 11)" />
      <rect x="4" y="5.5" width="13" height="15" rx="1.5" fill="#fffcf8" />
      <path d="M10.5 15.6s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z" fill="#f7a8bf" stroke="none" />
    </svg>
  );
}

function PhotoPicker({ onPick, disabled, className, children, label }: { onPick: (file: File) => void; disabled?: boolean; className: string; children: ReactNode; label?: string }) {
  return (
    <label className={`${className} ${disabled ? "pointer-events-none opacity-60" : "cursor-pointer"}`} aria-label={label}>
      {children}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

export default function MemoriesBox({ onClose, api }: Props) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"home" | "new">("home");
  // Siempre abre en calendario; la lista es para buscar o leer de corrido.
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const [month, setMonth] = useState<Month>(() => monthOf(dayKey(new Date().toISOString())));
  const [selected, setSelected] = useState<string | null>(null);
  // El recuerdo abierto y los de su mismo día, para pasar de uno a otro.
  const [openId, setOpenId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  // Hoja nueva
  const [draft, setDraft] = useState("");
  const [prompt, setPrompt] = useState(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());

  // Lo que el recuerdo recién guardado llevó (o podría llevar) al Refugio
  const [refugioAdded, setRefugioAdded] = useState<RefugioItem[]>([]);
  const [refugioSuggestions, setRefugioSuggestions] = useState<RefugioSuggestion[]>([]);

  // Los enlaces de las fotos caducan a la hora: al volver, o si una foto no carga, se piden nuevos.
  const signedAt = useRef(0);
  const refreshing = useRef(false);
  const refreshPhotos = () => {
    if (refreshing.current || !signedAt.current || Date.now() - signedAt.current < 60_000) return;
    refreshing.current = true;
    api<Memory[]>("recuerdos")
      .then((data) => {
        setMemories(data);
        signedAt.current = Date.now();
      })
      .catch(() => null)
      .finally(() => (refreshing.current = false));
  };
  const refreshRef = useRef(refreshPhotos);
  refreshRef.current = refreshPhotos;

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && signedAt.current && Date.now() - signedAt.current > 50 * 60_000) refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    api<Memory[]>("recuerdos")
      .then((data) => {
        setMemories(data);
        signedAt.current = Date.now();
        // Al abrir queda elegido el último día con recuerdos (hoy, si ya guardó algo).
        const latest = data.find((m) => m.created_at)?.created_at;
        if (latest) {
          setSelected(dayKey(latest));
          setMonth(monthOf(dayKey(latest)));
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No pude abrir tus recuerdos."))
      .finally(() => setLoading(false));
    // Solo al abrir: `api` cambia de identidad en cada render del chat.
  }, []);

  useEffect(() => {
    if (view !== "new") return;
    setNow(new Date().toISOString());
    const timer = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(timer);
  }, [view]);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return memories;
    return memories.filter((m) => normalize(`${m.text} ${m.photo_caption ?? ""}`).includes(needle));
  }, [memories, query]);

  const groups = useMemo(() => {
    const result: { key: string; items: Memory[] }[] = [];
    for (const memory of visible) {
      const key = monthKey(memory.created_at);
      const last = result[result.length - 1];
      if (last?.key === key) last.items.push(memory);
      else result.push({ key, items: [memory] });
    }
    return result;
  }, [visible]);

  const byDay = useMemo(() => {
    const result = new Map<string, Memory[]>();
    for (const memory of memories) {
      const key = memory.created_at ? dayKey(memory.created_at) : UNDATED;
      result.set(key, [...(result.get(key) ?? []), memory]);
    }
    return result;
  }, [memories]);

  const firstDated = [...memories].reverse().find((m) => m.created_at);
  const opened = memories.find((m) => m.id === openId) ?? null;
  const todayKey = dayKey(now);
  const thisMonth = monthOf(todayKey);
  const firstMonth = firstDated?.created_at ? monthOf(dayKey(firstDated.created_at)) : thisMonth;
  const canPrev = monthIndex(month) > monthIndex(firstMonth);
  const canNext = monthIndex(month) < monthIndex(thisMonth);
  const monthPrefix = `${month.y}-${pad(month.m + 1)}`;
  const monthDays = [...byDay.keys()].filter((key) => key.startsWith(monthPrefix));
  const monthCount = monthDays.reduce((sum, key) => sum + (byDay.get(key)?.length ?? 0), 0);
  const undated = byDay.get(UNDATED) ?? [];
  const selectedItems = selected ? (byDay.get(selected) ?? []) : [];

  const moveMonth = (step: number) => {
    const index = monthIndex(month) + step;
    setMonth({ y: Math.floor(index / 12), m: index % 12 });
    setSelected(null);
  };

  const openMemory = (memory: Memory) => {
    const key = memory.created_at ? dayKey(memory.created_at) : UNDATED;
    setOpenIds((byDay.get(key) ?? [memory]).map((m) => m.id));
    setOpenId(memory.id);
  };

  const pickDay = (key: string) => {
    setSelected(key);
    const items = byDay.get(key) ?? [];
    if (items.length === 1 && key !== UNDATED) openMemory(items[0]);
  };

  const openIndex = opened ? openIds.indexOf(opened.id) : -1;
  const stepOpen = (step: number) => {
    const next = openIds[openIndex + step];
    if (next) setOpenId(next);
  };

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

  const replace = (memory: Memory) => setMemories((current) => current.map((m) => (m.id === memory.id ? memory : m)));

  const pickDraftPhoto = async (file: File) => {
    setError("");
    try {
      setPhoto(await shrinkPhoto(file));
    } catch (cause) {
      setError(photoError(cause));
    }
  };

  const save = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<IngestResult>("ingest", {
        method: "POST",
        ...json({
          text,
          ...(photo ? { photo_base64: photo.data, photo_type: photo.type, photo_caption: caption.trim() || null } : {}),
        }),
      });
      const created = result.memory;
      if (created) {
        setMemories((current) => [created, ...current]);
        setJustSaved(created.id);
      } else {
        // Se guardó, pero no volvió completo: se recarga la lista.
        api<Memory[]>("recuerdos").then(setMemories).catch(() => null);
      }
      setRefugioAdded(result.refugio ?? []);
      setRefugioSuggestions(result.refugio_suggestions ?? []);
      setDraft("");
      setPhoto(null);
      setCaption("");
      setPrompt(0);
      setQuery("");
      // Vuelve al calendario con hoy abierto, donde quedó el recuerdo nuevo.
      const today = dayKey(new Date().toISOString());
      setSelected(today);
      setMonth(monthOf(today));
      setView("home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (memory: Memory, body: Record<string, unknown>) => {
    setBusyId(memory.id);
    setError("");
    try {
      replace(await api<Memory>(`recuerdos/${memory.id}`, { method: "PATCH", ...json(body) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el cambio.");
    } finally {
      setBusyId(null);
    }
  };

  const setMemoryPhoto = async (memory: Memory, file: File) => {
    let shrunk: Photo;
    try {
      shrunk = await shrinkPhoto(file);
    } catch (cause) {
      setError(photoError(cause));
      return;
    }
    await patch(memory, { photo_base64: shrunk.data, photo_type: shrunk.type });
  };

  const undoRefugio = async () => {
    const items = refugioAdded;
    setRefugioAdded([]);
    await Promise.all(items.map((item) => api(`refugio/items/${item.id}`, { method: "DELETE" }).catch(() => null)));
  };

  const answerSuggestion = async (suggestion: RefugioSuggestion, keep: boolean) => {
    setRefugioSuggestions((current) => current.filter((item) => item !== suggestion));
    if (!keep) return;
    try {
      const created = await api<RefugioItem>("refugio/items", { method: "POST", ...json(suggestion) });
      setRefugioAdded((current) => [...current, created]);
    } catch {
      // Si ya existía (409) no hay nada que avisar.
    }
  };

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = memories.length;
  const showRefugio = refugioAdded.length > 0 || refugioSuggestions.length > 0;
  const today = dateBits(now);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#381a24]/30 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <section aria-label="Mis recuerdos" className="mem-album bubble-in" onClick={(event) => event.stopPropagation()}>
        <span aria-hidden="true" className="mem-grabber sm:hidden" />
        <span aria-hidden="true" className="panel-tape -left-6 top-6 hidden -rotate-[38deg] sm:block" />
        <span aria-hidden="true" className="panel-tape -right-6 top-6 hidden rotate-[38deg] sm:block" />

        {view === "new" ? (
          // ---------- Escribir un recuerdo ----------
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex items-start justify-between gap-3 px-6 pt-8 sm:px-7">
              <div>
                <h2 className="font-hand text-[40px] font-semibold leading-none text-[#9e3b56]">nuevo recuerdo</h2>
                <p className="mt-1.5 text-[13px] text-[#7d4a5a]">el biógrafo lo tendrá en cuenta desde tu próxima conversación</p>
              </div>
              <div className="mem-stamp" aria-label={`Hoy, ${today.day} de ${today.month}, ${today.time}`}>
                <span className="font-hand text-base text-[#9e3b56]">hoy</span>
                <span className="font-display text-[24px] font-semibold text-[#421f2b]">
                  {today.day} {today.short}
                </span>
                <span className="text-[11px] font-medium text-[#85505f]">{today.time}</span>
              </div>
            </header>

            <div className="flex flex-wrap items-center gap-2 px-6 pt-3 sm:px-7">
              <span className="mr-0.5 font-hand text-lg text-[#85505f]">¿qué quieres guardar?</span>
              {PROMPTS.map((item, index) => (
                <button key={item.label} type="button" onClick={() => setPrompt(index)} aria-pressed={prompt === index} className={`mem-chip ${prompt === index ? "is-on" : ""}`}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mem-lined mt-3">
              <label htmlFor="mem-draft" className="sr-only">
                Tu recuerdo
              </label>
              <textarea
                id="mem-draft"
                autoFocus
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError("");
                }}
                maxLength={MAX_TEXT}
                placeholder={PROMPTS[prompt].placeholder}
                className="mem-textarea"
              />
              {photo && (
                <div className="mem-pol mem-pol-draft">
                  <span aria-hidden="true" className="mem-tape-sm" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photo.preview ? (
                    <img src={photo.preview} alt="La foto que elegiste" />
                  ) : (
                    <span className="mem-ph-pending">foto lista para subir</span>
                  )}
                  <label htmlFor="mem-draft-caption" className="sr-only">
                    Pie de foto (opcional)
                  </label>
                  <input
                    id="mem-draft-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    maxLength={MAX_CAPTION}
                    placeholder="pie de foto…"
                    className="mem-caption mem-caption-sm"
                  />
                  <button type="button" onClick={() => setPhoto(null)} aria-label="Quitar la foto" className="mem-pol-remove">
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>

            {error && <p className="px-7 pt-2 text-sm text-rose-700">{error}</p>}
            <footer className="flex items-center gap-2 border-t border-[#f3d3dc] px-4 py-3.5 sm:gap-3 sm:px-6">
              <PhotoPicker onPick={(file) => void pickDraftPhoto(file)} disabled={saving} className="mem-photo-btn" label={photo ? "Cambiar la foto" : "Agregar una foto"}>
                <ImagePlus size={18} />
              </PhotoPicker>
              <span className="min-w-0 flex-1 truncate font-hand text-[18px] text-[#85505f]">
                {draft.length.toLocaleString("es-MX")} / 10 000<span className="hidden sm:inline"> · foto opcional</span>
              </span>
              <button type="button" onClick={() => setView("home")} className="min-h-11 rounded-full px-3 text-sm text-[#7a2c43] hover:bg-[#fae6ec] sm:px-4">
                cancelar
              </button>
              <button type="button" onClick={() => void save()} disabled={!draft.trim() || saving} className="mem-primary px-4 sm:px-5">
                <Heart size={15} fill="#f7a8bf" stroke="#f7a8bf" />
                {saving ? "guardando…" : "guardar"}
                <span className="hidden sm:inline">{saving ? "" : " recuerdo"}</span>
              </button>
            </footer>
          </div>
        ) : (
          // ---------- La lista ----------
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex items-start justify-between gap-3 px-6 pt-5 sm:px-8 sm:pt-9">
              <div>
                <h2 className="font-hand text-[42px] font-semibold leading-[.95] text-[#9e3b56] sm:text-[46px]">mis recuerdos</h2>
                <p className="mt-1.5 text-[13px] text-[#7d4a5a]">todo lo que me has contado, para que el biógrafo nunca lo olvide</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Cerrar recuerdos" className="rounded-full p-2.5 text-[#8f475a] hover:bg-[#fae6ec]">
                <X size={18} />
              </button>
            </header>

            {count > 0 && (
              <>
                <div className="flex items-center justify-between gap-3 px-5 pt-3 sm:px-8">
                  <div role="group" aria-label="Cómo ver tus recuerdos" className="mem-switch">
                    <button type="button" aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")}>
                      <CalendarDays size={16} />
                      calendario
                    </button>
                    <button type="button" aria-pressed={mode === "list"} onClick={() => setMode("list")}>
                      <List size={16} />
                      lista
                    </button>
                  </div>
                  <span className="text-right font-hand text-[19px] leading-tight text-[#9e3b56] sm:text-xl">
                    {plural(count, "recuerdo", "recuerdos")}
                  </span>
                </div>
                {mode === "list" && (
                  <label className="mem-search mx-6 mt-3 sm:mx-8">
                    <Search size={15} className="shrink-0 text-[#9e3b56]" />
                    <span className="sr-only">Buscar en tus recuerdos</span>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="buscar en tus recuerdos…" />
                  </label>
                )}
              </>
            )}

            <div className={`mem-scroll px-5 pb-6 sm:px-8 ${mode === "calendar" ? "pt-6" : "pt-4"}`}>
              {loading ? (
                <p className="animate-pulse py-10 text-center font-hand text-2xl text-[#b07d8d]">abriendo tu álbum…</p>
              ) : error && !count ? (
                <p className="py-10 text-center text-sm text-rose-700">{error}</p>
              ) : !count ? (
                <div className="py-12 text-center">
                  <p className="font-hand text-[26px] text-[#9e3b56]">aún no hay recuerdos aquí</p>
                  <p className="mt-1 text-sm text-[#7d4a5a]">el primero que escribas estrena el álbum</p>
                </div>
              ) : mode === "calendar" ? (
                // ---------- El calendario ----------
                <>
                  <div className="mem-cal">
                    <span aria-hidden="true" className="panel-tape mem-cal-tape" />
                    <div className="flex items-center justify-between gap-2 px-0.5 pb-2">
                      <button type="button" onClick={() => moveMonth(-1)} disabled={!canPrev} aria-label="Mes anterior" className="mem-cal-nav">
                        <ChevronLeft size={18} />
                      </button>
                      <div className="min-w-0 text-center" aria-live="polite">
                        <div className="mem-cal-month">
                          {MONTHS[month.m]} <span className="text-[#9e3b56]">{month.y}</span>
                        </div>
                        <div className="mt-0.5 font-hand text-[17px] leading-tight text-[#85505f]">
                          {monthCount ? `${plural(monthCount, "recuerdo", "recuerdos")} en ${plural(monthDays.length, "día", "días")}` : "este mes aún está en blanco"}
                        </div>
                      </div>
                      <button type="button" onClick={() => moveMonth(1)} disabled={!canNext} aria-label="Mes siguiente" className="mem-cal-nav">
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <div aria-hidden="true" className="mem-week">
                      {WEEKDAYS.map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                    <div className="mem-grid">
                      {monthCells(month).map((cell) => {
                        const items = cell.inMonth ? (byDay.get(cell.key) ?? []) : [];
                        const future = cell.key > todayKey;
                        const label = `${cell.day} de ${MONTHS[Number(cell.key.slice(5, 7)) - 1]}, ${items.length ? plural(items.length, "recuerdo", "recuerdos") : "sin recuerdos"}`;
                        return (
                          <button
                            key={cell.key}
                            type="button"
                            disabled={!cell.inMonth || future}
                            onClick={() => pickDay(cell.key)}
                            aria-pressed={cell.inMonth && selected === cell.key}
                            aria-label={label}
                            data-n={Math.min(items.length, 3) || undefined}
                            className={`mem-dayc ${cell.inMonth ? "" : "is-out"} ${cell.key === todayKey && cell.inMonth ? "is-today" : ""}`}
                          >
                            {cell.day}
                            {items.length > 0 && <b>{items.length}</b>}
                            {items.some((m) => m.photo_url) && <i aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>

                    <div aria-hidden="true" className="mem-legend">
                      <span>
                        <b>2</b>recuerdos del día
                      </span>
                      <span>
                        <i />
                        trae foto
                      </span>
                      <span>
                        <u />
                        hoy
                      </span>
                    </div>
                  </div>

                  {undated.length > 0 && (
                    <button type="button" onClick={() => pickDay(UNDATED)} aria-pressed={selected === UNDATED} className="mem-undated">
                      <span aria-hidden="true" className="mem-undated-seal">
                        ∞
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-hand text-[20px] leading-tight text-[#9e3b56]">{undated.length} de los primeros</span>
                        <span className="block text-xs text-[#85505f]">los que me contaste antes de que tuvieran fecha</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[#9e3b56]" />
                    </button>
                  )}

                  {selected ? (
                    <div key={selected} className="mem-rise">
                      <div className="mem-dayhead">
                        <span className="font-display text-[26px] font-semibold leading-none text-[#421f2b]">{selected === UNDATED ? "de los primeros" : dayLabel(selected)}</span>
                        <span className="font-hand text-xl leading-none text-[#9e3b56]">{selectedItems.length ? plural(selectedItems.length, "recuerdo", "recuerdos") : "sin recuerdos"}</span>
                        <i aria-hidden="true" />
                      </div>
                      {selectedItems.length ? (
                        <div className="flex flex-col gap-3">
                          {selectedItems.map((memory) => {
                            const [hour, period] = memory.created_at ? timeLabel(memory.created_at).split(" ") : ["∞", "sin fecha"];
                            return (
                              <button key={memory.id} type="button" onClick={() => openMemory(memory)} className={`mem-mini ${justSaved === memory.id ? "is-new" : ""}`}>
                                <span className="mem-date">
                                  <span className="mem-day">{hour}</span>
                                  <span className="mem-mon">{period}</span>
                                </span>
                                <span className="mem-text is-clamped">{memory.text}</span>
                                {memory.photo_url && (
                                  <span className="mem-pol mem-pol-thumb" aria-hidden="true">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={memory.photo_url} alt="" onError={refreshPhotos} />
                                  </span>
                                )}
                                {justSaved === memory.id && <span className="mem-stamp-done">¡guardado!</span>}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border-[1.5px] border-dashed border-[#ecbccb] bg-[#fffaf6] px-4 py-6 text-center">
                          <p className="font-hand text-[23px] leading-tight text-[#9e3b56]">ese día no guardaste nada… todavía</p>
                          <p className="mt-1 text-[12.5px] text-[#7d4a5a]">el álbum tiene espacio para lo que quieras contarme</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-6 text-center font-hand text-[22px] text-[#9e3b56]">toca un día con número para abrir sus recuerdos</p>
                  )}
                </>
              ) : !visible.length ? (
                <p className="py-10 text-center font-hand text-2xl text-[#9e3b56]">ningún recuerdo dice eso… todavía</p>
              ) : (
                groups.map((group) => (
                  <Fragment key={group.key}>
                    <div className="mem-month">
                      <span>{group.key}</span>
                      <i />
                    </div>
                    <div className="mem-list">
                      {group.items.map((memory) => {
                        const bits = memory.created_at ? dateBits(memory.created_at) : null;
                        const isOpen = expanded.has(memory.id);
                        const long = memory.text.length > 150 || memory.text.split("\n").length > 3;
                        return (
                          <article key={memory.id} className={`mem-card ${justSaved === memory.id ? "is-new" : ""}`}>
                            {justSaved === memory.id && <span aria-hidden="true" className="panel-tape mem-card-tape" />}
                            <div className="mem-date">
                              {bits ? (
                                <>
                                  <span className="mem-day">{bits.day}</span>
                                  <span className="mem-mon">{bits.short}</span>
                                  <span className="mem-time">{bits.time}</span>
                                </>
                              ) : (
                                <>
                                  <span className="mem-day text-[24px] text-[#9e3b56]">—</span>
                                  <span className="mem-mon text-center text-base leading-none">sin fecha</span>
                                </>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-start gap-4">
                                <button type="button" onClick={() => toggle(memory.id)} aria-expanded={isOpen} className={`mem-text ${isOpen ? "" : "is-clamped"}`}>
                                  {memory.text}
                                </button>
                                {memory.photo_url && (
                                  <button type="button" onClick={() => openMemory(memory)} className="mem-pol mem-pol-thumb" aria-label="Ver el recuerdo con su foto">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={memory.photo_url} alt="" onError={refreshPhotos} />
                                  </button>
                                )}
                              </div>
                              {(long || isOpen) && (
                                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                  <button type="button" onClick={() => toggle(memory.id)} className="mem-more">
                                    {isOpen ? "ver menos" : "seguir leyendo"}
                                  </button>
                                  {isOpen && !memory.photo_url && (
                                    <PhotoPicker onPick={(file) => void setMemoryPhoto(memory, file)} disabled={busyId === memory.id} className="mem-add">
                                      <ImagePlus size={16} />
                                      {busyId === memory.id ? "pegando…" : "agregarle una foto"}
                                    </PhotoPicker>
                                  )}
                                </div>
                              )}
                            </div>
                            {justSaved === memory.id && <span className="mem-stamp-done">¡guardado!</span>}
                          </article>
                        );
                      })}
                    </div>
                  </Fragment>
                ))
              )}
              {error && count > 0 && <p className="mt-4 text-center text-sm text-rose-700">{error}</p>}
            </div>

            {showRefugio ? (
              <div className="bubble-in mx-4 mb-5 rounded-3xl bg-gradient-to-br from-[#5c2a3c] to-[#4a2230] p-4 text-[#fff3f6] shadow-[0_16px_30px_-16px_rgba(74,34,48,.9)] sm:mx-6 sm:p-5">
                {refugioAdded.length > 0 && (
                  <div className="flex items-start gap-3">
                    <TulipIcon size={22} className="mt-0.5 shrink-0 text-[#f7a8bf]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">También lo guardé en El Refugio</p>
                      <ul className="mt-1.5 space-y-0.5 text-[13px] text-[#ffdfe8]">
                        {refugioAdded.map((item) => (
                          <li key={item.id} className="truncate">
                            <span className="font-hand text-[16px] text-[#f7a8bf]">{KIND_LABELS[item.kind]}:</span> {item.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button type="button" onClick={() => void undoRefugio()} className="shrink-0 font-hand text-lg text-[#f7a8bf] underline-offset-4 hover:underline">
                      deshacer
                    </button>
                  </div>
                )}
                {refugioSuggestions.map((suggestion) => (
                  <div key={`${suggestion.kind}-${suggestion.title}`} className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3 first:mt-0 first:border-0 first:pt-0">
                    <p className="min-w-0 flex-1 text-[13px]">
                      ¿Guardo también <strong>{suggestion.title}</strong> <span className="text-[#ffdfe8]">({KIND_LABELS[suggestion.kind]})</span> en El Refugio?
                    </p>
                    <button type="button" onClick={() => void answerSuggestion(suggestion, true)} className="rounded-full bg-[#f7a8bf] px-3.5 py-1.5 text-xs font-medium text-[#4a2230] hover:bg-[#ffc2d3]">
                      Sí
                    </button>
                    <button type="button" onClick={() => void answerSuggestion(suggestion, false)} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-[#ffdfe8] hover:bg-white/10">
                      No
                    </button>
                  </div>
                ))}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setRefugioAdded([]);
                      setRefugioSuggestions([]);
                    }}
                    className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium hover:bg-white/25"
                  >
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <footer className="border-t border-[#f3d3dc] px-5 pb-6 pt-3.5 sm:px-6">
                <button type="button" onClick={() => setView("new")} className="mem-primary w-full">
                  <PenLine size={17} />
                  escribir un recuerdo
                </button>
              </footer>
            )}
          </div>
        )}

        {view === "home" && opened && (
          // ---------- Un recuerdo abierto ----------
          <div className="mem-overlay" onClick={() => setOpenId(null)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={opened.created_at ? `Recuerdo del ${dateBits(opened.created_at).day} de ${dateBits(opened.created_at).month}` : "Recuerdo sin fecha"}
              className="mem-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <span aria-hidden="true" className="panel-tape mem-dialog-tape" />
              <div className="flex items-center justify-between gap-2 pl-5 pr-2 pt-2.5">
                <span className="font-hand text-[19px] text-[#9e3b56]">
                  {openIds.length > 1 ? `${openIndex + 1} de ${openIds.length} ${opened.created_at ? "ese día" : "sin fecha"}` : opened.created_at ? "un recuerdo" : "de los primeros"}
                </span>
                <button type="button" autoFocus onClick={() => setOpenId(null)} aria-label="Cerrar el recuerdo" className="rounded-full p-3 text-[#8f475a] hover:bg-[#fae6ec]">
                  <X size={18} />
                </button>
              </div>

              <div className="mem-scroll px-6 pb-5">
                {opened.photo_url ? (
                  <>
                    <figure className={`mem-pol mem-pol-big ${busyId === opened.id ? "animate-pulse" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={opened.photo_url} alt={opened.photo_caption ?? "Foto del recuerdo"} onError={refreshPhotos} />
                      <figcaption>
                        <label htmlFor="mem-caption" className="sr-only">
                          Pie de foto
                        </label>
                        <input
                          id="mem-caption"
                          key={`${opened.id}-${opened.photo_caption ?? ""}`}
                          defaultValue={opened.photo_caption ?? ""}
                          maxLength={MAX_CAPTION}
                          placeholder="escribe un pie de foto…"
                          className="mem-caption"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                          }}
                          onBlur={(event) => {
                            const value = event.target.value.trim();
                            if (value !== (opened.photo_caption ?? "")) void patch(opened, { photo_caption: value });
                          }}
                        />
                      </figcaption>
                    </figure>
                    <div className="mt-4 flex justify-center gap-2">
                      <PhotoPicker onPick={(file) => void setMemoryPhoto(opened, file)} disabled={busyId === opened.id} className="mem-ghost">
                        <ImagePlus size={15} />
                        cambiar foto
                      </PhotoPicker>
                      <button type="button" onClick={() => void patch(opened, { remove_photo: true })} disabled={busyId === opened.id} className="mem-ghost">
                        <X size={15} />
                        quitar foto
                      </button>
                    </div>
                  </>
                ) : (
                  <PhotoPicker onPick={(file) => void setMemoryPhoto(opened, file)} disabled={busyId === opened.id} className={`mem-add-big ${busyId === opened.id ? "animate-pulse" : ""}`}>
                    <ImagePlus size={26} />
                    {busyId === opened.id ? "pegando tu foto…" : "agregarle una foto"}
                  </PhotoPicker>
                )}

                <div className="mt-6 flex flex-wrap items-baseline gap-x-2.5">
                  {opened.created_at ? (
                    <>
                      <span className="font-display text-[28px] font-semibold leading-none text-[#421f2b]">
                        {dateBits(opened.created_at).day} de {dateBits(opened.created_at).month}
                      </span>
                      <span className="font-hand text-xl text-[#9e3b56]">
                        {dateBits(opened.created_at).year} · {dateBits(opened.created_at).time}
                      </span>
                    </>
                  ) : (
                    <span className="font-hand text-2xl text-[#9e3b56]">de los primeros · sin fecha</span>
                  )}
                </div>
                <p className="mt-2.5 whitespace-pre-line break-words text-[15px] leading-[1.7] text-[#42222b]">{opened.text}</p>
                {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
              </div>

              {openIds.length > 1 && (
                <div className="flex shrink-0 items-center justify-between gap-2 border-t-[1.5px] border-dashed border-[#f0c3d0] px-3 pb-3 pt-2">
                  <button type="button" onClick={() => stepOpen(-1)} disabled={openIndex <= 0} className="mem-step">
                    <ChevronLeft size={16} />
                    anterior
                  </button>
                  <span aria-hidden="true" className="mem-dots">
                    {openIds.map((id, index) => (
                      <span key={id} className={index === openIndex ? "is-on" : ""} />
                    ))}
                  </span>
                  <button type="button" onClick={() => stepOpen(1)} disabled={openIndex >= openIds.length - 1} className="mem-step">
                    siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
