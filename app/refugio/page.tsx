"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Camera, ChevronLeft, EyeOff, MessageCircle, Music, Plus, RefreshCw, Sparkles, Tv, Wind } from "lucide-react";
import TulipIcon from "../components/TulipIcon";
import { SKIP_CURTAIN_KEY } from "../components/WelcomeCurtain";
import { KIND_LABELS, RECALL_KEY } from "../components/refugio-types";
import { LYRICS } from "../components/scrapbook";
import type { RecallMoment, RefugioItem, RefugioKind } from "../components/refugio-types";
import AddToRefugio, { resizePhoto } from "./AddToRefugio";
import BreatheBox from "./BreatheBox";

type BoxId = "songs" | "series" | "anime" | "bibble" | "breathe" | "quotes" | "books" | "other";
type Mood = "triste" | "cansada" | "nostalgica" | "bonito";

const MOODS: { id: Mood; label: string }[] = [
  { id: "triste", label: "un poquito triste" },
  { id: "cansada", label: "cansada" },
  { id: "nostalgica", label: "nostálgica" },
  { id: "bonito", label: "solo quiero algo bonito" },
];

// Según cómo llegue, primero ve lo que más le puede ayudar.
const BOX_ORDER: Record<Mood | "default", BoxId[]> = {
  default: ["songs", "series", "anime", "bibble", "breathe", "quotes", "books", "other"],
  triste: ["songs", "bibble", "breathe", "quotes", "series", "anime", "other", "books"],
  cansada: ["breathe", "series", "songs", "anime", "bibble", "quotes", "other", "books"],
  nostalgica: ["quotes", "songs", "series", "anime", "bibble", "breathe", "other", "books"],
  bonito: ["anime", "series", "bibble", "songs", "quotes", "other", "breathe", "books"],
};

const BOX_KINDS: Partial<Record<BoxId, RefugioKind[]>> = {
  songs: ["song"],
  series: ["series", "kdrama", "movie"],
  anime: ["anime"],
  quotes: ["quote"],
  books: ["book"],
  other: ["other"],
};

const BOX_COPY: Record<BoxId, { kicker: string; title: string; empty: string; icon: ReactNode }> = {
  songs: { kicker: "para escuchar abrazada", title: "Canciones que abrazan", empty: "Cuando guardes una canción que te haga bien, aparecerá aquí.", icon: <Music size={18} /> },
  series: { kicker: "maratón con cobija", title: "Series & K-dramas", empty: "Tus series favoritas llegarán aquí solitas.", icon: <Tv size={18} /> },
  anime: { kicker: "personajes que te acompañan", title: "Anime", empty: "Aún no hay anime guardado.", icon: <Sparkles size={18} /> },
  bibble: { kicker: "tu dosis de tontería", title: "Bibble dice…", empty: "", icon: null },
  breathe: { kicker: "un minuto para ti", title: "Respira conmigo", empty: "", icon: <Wind size={18} /> },
  quotes: { kicker: "palabras que sostienen", title: "Frases", empty: "Las frases que te dan ánimo vivirán aquí.", icon: <TulipIcon size={18} /> },
  books: { kicker: "para leer despacio", title: "Libros", empty: "Cuando guardes un libro que te haga bien, aparecerá aquí solito.", icon: <BookOpen size={18} /> },
  other: { kicker: "cositas que te alegran", title: "Otras cosas bonitas", empty: "", icon: <Sparkles size={18} /> },
};

// Cuántos elementos se ven por cajita antes de "ver todas".
const BOX_LIMIT = 6;

// Fotos decorativas para el carrusel de fondo mientras haya pocos momentos con foto.
const DECOR_PHOTOS = ["/hortensia0.png", "/bibble2.png", "/dino0.png", "/hortensia1.png", "/bibble0.png", "/bungo0.png"];

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { cache: "no-store", ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "No se pudo completar la operación.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function dayOfYear() {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export default function RefugioPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<RefugioItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [adding, setAdding] = useState(false);
  const [joke, setJoke] = useState<string | null>(null);
  const [jokeLoading, setJokeLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<BoxId>>(new Set());
  const toggleExpanded = (id: BoxId) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [letter, setLetter] = useState<string | null>(null);
  const [letterLoading, setLetterLoading] = useState(false);
  const photoTarget = useRef<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const { unlocked } = await fetch("/api/unlock", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ unlocked: false }));
      if (!unlocked) return router.replace("/");
      setReady(true);
      try {
        setItems((await api<{ items: RefugioItem[] }>("refugio")).items);
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : "No pude abrir tu Refugio.");
      }
      void nextLetter();
      void nextJoke();
    })();
  }, []);

  const nextLetter = async () => {
    setLetterLoading(true);
    try {
      setLetter((await api<{ message: string }>("refugio/recuerda")).message);
    } catch {
      setLetter(
        "Nunca olvides lo especial que eres: no hay nadie en el mundo como tú. Tienes un corazón enorme, un alma tan pura que ilumina a quien está cerca y una sonrisa preciosa que hace más bonito cualquier día."
      );
    } finally {
      setLetterLoading(false);
    }
  };

  const nextJoke = async () => {
    setJokeLoading(true);
    try {
      setJoke((await api<{ joke: string }>("refugio/bibble")).joke);
    } catch {
      setJoke("Bibble se quedó dormido en una hortensia… inténtalo en un ratito.");
    } finally {
      setJokeLoading(false);
    }
  };

  const moments = items.filter((item) => item.kind === "moment");
  const quotes = items.filter((item) => item.kind === "quote");
  const noteOfDay = useMemo(() => {
    const pool = [...quotes.map((item) => ({ text: item.title, source: item.creator ?? "" })), ...LYRICS];
    return pool[dayOfYear() % pool.length];
  }, [quotes.length]);

  const backdropPhotos = useMemo(() => {
    const real = moments.map((item) => item.photo_url).filter((url): url is string => Boolean(url));
    return [...real, ...DECOR_PHOTOS].slice(0, Math.max(6, real.length));
  }, [moments]);

  const hide = async (item: RefugioItem) => {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    await api(`refugio/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: true }),
    }).catch(() => null);
  };

  const recall = (item: RefugioItem) => {
    try {
      sessionStorage.setItem(RECALL_KEY, JSON.stringify({ title: item.title } satisfies RecallMoment));
      sessionStorage.setItem(SKIP_CURTAIN_KEY, "1");
    } catch {
      // Sin sessionStorage el chat abre normal.
    }
    router.push("/");
  };

  const askPhotoFor = (item: RefugioItem) => {
    photoTarget.current = item.id;
    photoInput.current?.click();
  };

  const uploadPhoto = async (file: File | undefined) => {
    const id = photoTarget.current;
    if (!file || !id) return;
    try {
      const updated = await api<RefugioItem>(`refugio/items/${id}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await resizePhoto(file)),
      });
      setItems((current) => current.map((entry) => (entry.id === id ? updated : entry)));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "No se pudo subir la foto.");
    }
  };

  const markSkipCurtain = () => {
    try {
      sessionStorage.setItem(SKIP_CURTAIN_KEY, "1");
    } catch {
      // nada
    }
  };

  if (!ready) return <main className="refugio-bg min-h-dvh" />;

  const order = BOX_ORDER[mood ?? "default"];

  const renderBox = (id: BoxId) => {
    const copy = BOX_COPY[id];
    if (id === "bibble") {
      return (
        <section key={id} className="ref-box ref-box-warm">
          <div className="flex items-center gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_3px_#fff,0_0_0_5px_#f0cad5]">
              <Image src="/bibble2.png" alt="Bibble" fill sizes="56px" className="object-cover" />
            </div>
            <div>
              <p className="ref-kicker">{copy.kicker}</p>
              <h3 className="ref-title">{copy.title}</h3>
            </div>
          </div>
          <p className={`rounded-[1.25rem] bg-white px-4 py-3.5 font-hand text-[22px] leading-snug text-[#5c2338] ${jokeLoading ? "animate-pulse" : ""}`}>
            {joke ?? "Bibble está pensando algo tonto…"}
          </p>
          <button type="button" onClick={() => void nextJoke()} disabled={jokeLoading} className="ref-ghost self-start">
            <RefreshCw size={15} className={jokeLoading ? "animate-spin" : ""} /> Otro, Bibble
          </button>
        </section>
      );
    }
    if (id === "breathe") {
      return (
        <section key={id} className="ref-box">
          <BoxHeader copy={copy} />
          <BreatheBox />
        </section>
      );
    }

    // Lo que viene del perfil (su top de Taylor) va primero; luego lo más reciente.
    const allEntries = items
      .filter((item) => BOX_KINDS[id]?.includes(item.kind))
      .sort((a, b) => Number(b.source === "profile") - Number(a.source === "profile"));
    if (!allEntries.length && !copy.empty) return null;
    const isExpanded = expanded.has(id);
    const entries = isExpanded ? allEntries : allEntries.slice(0, BOX_LIMIT);
    return (
      <section key={id} className="ref-box">
        <BoxHeader copy={copy} />
        {entries.length ? (
          <ul className="flex flex-col gap-2">
            {entries.map((item) => (
              <li key={item.id} className="ref-row group">
                <div className="min-w-0 flex-1">
                  <p className={id === "quotes" ? "font-hand text-[22px] leading-tight text-[#5c2338]" : "text-[14.5px] font-semibold text-[#3f1f2a]"}>
                    {item.title}
                  </p>
                  {(item.creator || id !== "quotes") && (
                    <p className="mt-0.5 text-[12.5px] text-[#7d4a5a]">{item.creator ?? KIND_LABELS[item.kind]}</p>
                  )}
                  {item.note && <p className="mt-1 font-hand text-[17px] leading-tight text-[#9e3b56]">{item.note}</p>}
                </div>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="ref-play" aria-label={`Escuchar ${item.title}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
                  </a>
                )}
                <button type="button" onClick={() => void hide(item)} className="ref-hide" aria-label={`Quitar ${item.title} del Refugio`}>
                  <EyeOff size={14} />
                </button>
              </li>
            ))}
            {allEntries.length > BOX_LIMIT && (
              <li>
                <button type="button" onClick={() => toggleExpanded(id)} className="ref-ghost w-full bg-white/50 font-hand text-lg text-[#9e3b56]">
                  {isExpanded ? "ver menos" : `ver todas (${allEntries.length})`}
                </button>
              </li>
            )}
          </ul>
        ) : (
          <div className="ref-empty">
            <p className="font-hand text-[22px] text-[#9e3b56]">todavía no hay nada aquí</p>
            <p className="max-w-[260px] text-[13px] text-[#7d4a5a]">{copy.empty}</p>
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="refugio-bg relative min-h-dvh overflow-x-hidden pb-10 text-[#4a2230]">
      <input ref={photoInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <Link href="/" onClick={markSkipCurtain} className="ref-ghost" aria-label="Volver al chat">
          <ChevronLeft size={17} />
          <span className="hidden sm:inline">Volver al chat</span>
        </Link>
        <div className="flex items-center gap-2">
          <TulipIcon size={26} className="text-[#d9567a]" />
          <span className="font-display text-2xl font-semibold italic text-[#421f2b] sm:text-3xl">El Refugio</span>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="ref-ghost border-[#4a2230] bg-[#4a2230] text-[#fff3f6] hover:bg-[#3d1d27]" aria-label="Agregar al Refugio">
          <Plus size={17} />
          <span className="hidden sm:inline">Agregar al Refugio</span>
        </button>
      </header>

      {/* Carrusel de fondo: sus momentos (o fotos favoritas) desfilando despacio */}
      <div aria-hidden="true" className="ref-backdrop">
        <div className="ref-marquee">
          {[...backdropPhotos, ...backdropPhotos].map((src, index) => (
            <div key={index} className="ref-backdrop-pol" style={{ transform: `rotate(${index % 2 ? 5 : -5}deg)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-6 sm:px-8 sm:pt-10">
        <p className="font-hand text-2xl text-[#d9567a] sm:text-3xl">este rincón es tuyo</p>
        <h1 className="font-display text-[56px] font-medium italic leading-[.95] text-[#421f2b] sm:text-[88px]">Hola, Mireya.</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#6e3a4a] sm:text-lg">
          Aquí guardamos lo que te hace bien: tus canciones, tus series, tus momentos felices. Quédate el tiempo que necesites.
        </p>

        <p className="mb-2.5 mt-7 text-[11px] font-semibold uppercase tracking-[.16em] text-[#9e3b56]">¿Cómo llegas hoy?</p>
        <div className="-mr-4 flex gap-2 overflow-x-auto pb-1 pr-4 sm:mr-0 sm:flex-wrap sm:pr-0">
          {MOODS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mood === option.id}
              onClick={() => setMood((current) => (current === option.id ? null : option.id))}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm transition ${
                mood === option.id ? "border-[#4a2230] bg-[#4a2230] text-[#fff3f6]" : "border-white bg-white/65 text-[#4a2230] hover:bg-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="ref-note mt-7">
          <span className="washi washi-sm" />
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9e3b56]">Nota del día</p>
          <p className="font-hand text-[30px] font-semibold leading-tight text-[#5c2338]">{noteOfDay.text}</p>
          {noteOfDay.source && <p className="text-[10px] uppercase tracking-[.12em] text-[#8a4a5c]">{noteOfDay.source}</p>}
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-12 max-w-6xl px-4 sm:px-8">
        <div className="ref-letter">
          <span className="washi" />
          <div className="flex items-center justify-between gap-3">
            <p className="font-hand text-2xl text-[#d9567a] sm:text-[26px]">para que nunca lo olvides</p>
            <button
              type="button"
              onClick={() => void nextLetter()}
              disabled={letterLoading}
              className="ref-ghost shrink-0 bg-white/80 px-3"
              aria-label="Escribir otro mensaje"
              title="Otro mensaje"
            >
              <RefreshCw size={15} className={letterLoading ? "animate-spin" : ""} />
            </button>
          </div>
          <p className={`mt-2 font-display text-[22px] italic leading-snug text-[#421f2b] sm:text-[27px] ${letterLoading ? "animate-pulse" : ""}`}>
            {letter ?? "Escribiéndote algo bonito…"}
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-12 max-w-6xl px-4 sm:px-8">
        <p className="font-hand text-xl text-[#b8456a] sm:text-2xl">toca una foto para recordarla juntas</p>
        <h2 className="font-display text-3xl font-semibold text-[#421f2b] sm:text-4xl">Momentos felices</h2>

        <div className="-mx-4 mt-4 flex snap-x gap-5 overflow-x-auto px-4 pb-6 pt-4 sm:-mx-8 sm:px-8">
          <button type="button" onClick={() => setAdding(true)} className="ref-add-moment snap-start">
            <Camera size={30} strokeWidth={1.6} />
            <span className="font-hand text-2xl">añadir momento</span>
            <span className="text-xs text-[#8a4a5c]">foto + una frase</span>
          </button>
          {moments.map((item, index) => (
            <figure key={item.id} className="ref-moment snap-start" style={{ transform: `rotate(${[3, -3, 2, -2][index % 4]}deg)` }}>
              <span className="washi" />
              {item.photo_url ? (
                <div className="relative aspect-square overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.photo_url} alt={item.title} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="ref-moment-note">
                  <TulipIcon size={26} className="text-[#d9567a]" />
                  <p className="font-hand text-[22px] leading-tight text-[#5c2338]">{item.note ?? item.title}</p>
                  <button type="button" onClick={() => askPhotoFor(item)} className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs text-[#7a2c43] hover:bg-white">
                    <Camera size={13} /> añadir foto
                  </button>
                </div>
              )}
              <figcaption className="px-1 pb-1 pt-2 text-center">
                <span className="block truncate font-hand text-[20px] text-[#7a2c43]">{item.title}</span>
                {item.moment_date && <span className="block text-[11px] text-[#8a4a5c]">{formatDate(item.moment_date)}</span>}
              </figcaption>
              <button type="button" onClick={() => recall(item)} className="ref-recall">
                <MessageCircle size={14} /> recordarlo en el chat
              </button>
            </figure>
          ))}
        </div>
      </section>

      {loadError && <p className="relative z-10 mx-auto max-w-6xl px-4 text-sm text-rose-700 sm:px-8">{loadError}</p>}

      {/* Mosaico: cada cajita mide lo que su contenido, sin estirar a las vecinas */}
      <div className="relative z-10 mx-auto mt-6 max-w-6xl gap-5 px-4 sm:columns-2 sm:px-8 lg:columns-3">
        {order.map(renderBox)}
      </div>

      <footer className="relative z-10 mx-auto mt-10 flex max-w-6xl flex-col gap-2 px-4 sm:px-8">
        <div className="flex flex-col items-center gap-1 rounded-[1.5rem] border border-white bg-white/55 px-5 py-5 text-center">
          <p className="text-[14px] leading-relaxed text-[#5c2338]">Si lo que sientes pesa demasiado, no tienes que cargarlo sola.</p>
          <p className="font-hand text-[22px] text-[#b8456a]">aquí siempre hay lugar para ti</p>
        </div>
      </footer>

      {adding && <AddToRefugio api={api} onClose={() => setAdding(false)} onAdded={(item) => setItems((current) => [item, ...current])} />}
    </main>
  );
}

function BoxHeader({ copy }: { copy: { kicker: string; title: string; icon: ReactNode } }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fbe1e9] text-[#b8456a]">{copy.icon}</span>
      <div>
        <p className="ref-kicker">{copy.kicker}</p>
        <h3 className="ref-title">{copy.title}</h3>
      </div>
    </div>
  );
}
