"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  BrainCircuit,
  Camera,
  Check,
  ChevronLeft,
  Copy,
  Flower2,
  GraduationCap,
  Heart,
  Lightbulb,
  Menu,
  MessageCircle,
  Music,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import confetti from "canvas-confetti";
import Swal from "sweetalert2";
import AvatarPicker, { DEFAULT_AVATAR } from "./components/AvatarPicker";
import IdeasBox from "./components/IdeasBox";
import ScrapbookBackground from "./components/ScrapbookBackground";
import TulipIcon from "./components/TulipIcon";
import WelcomeCurtain from "./components/WelcomeCurtain";
import { KIND_LABELS, RECALL_KEY } from "./components/refugio-types";
import type { RecallMoment, RefugioItem, RefugioSuggestion } from "./components/refugio-types";

type Message = { id?: string; role: "user" | "assistant"; content: string; created_at?: string; hearted?: boolean };
type StreamEvent = { type: string; delta?: string; message?: string; user_message_id?: string; message_id?: string | null };
type Session = { id: string; title: string; created_at: string; updated_at: string };
type IngestResult = { refugio?: RefugioItem[]; refugio_suggestions?: RefugioSuggestion[] };

const DRAFT_KEY = "mireya-draft-";

function readDraft(sessionId: string) {
  try {
    return localStorage.getItem(DRAFT_KEY + sessionId) ?? "";
  } catch {
    return "";
  }
}

function takeRecallMoment(): RecallMoment | null {
  try {
    const raw = sessionStorage.getItem(RECALL_KEY);
    sessionStorage.removeItem(RECALL_KEY);
    return raw ? (JSON.parse(raw) as RecallMoment) : null;
  } catch {
    return null;
  }
}

const suggestions = [
  { icon: Music, title: "Su top de Taylor", label: "¿Cuáles son sus canciones favoritas de Taylor Swift y por qué?" },
  { icon: GraduationCap, title: "Momentos felices", label: "Cuéntame del día de su graduación." },
  { icon: Heart, title: "Su corazón", label: "¿Qué hace de Mireya una persona tan especial?" },
  { icon: Flower2, title: "Días grises", label: "¿Qué cosas la hacen sonreír en un día gris?" },
];

// Frases en primera persona que suenan a un día gris. Solo cuenta lo que ella
// dice de sí misma: "¿qué canciones tristes le gustan?" no debe activarlo.
const SAD_MESSAGE = new RegExp(
  [
    "\\b(me siento|estoy|ando|me encuentro|me sent[ií])\\s+(muy |bien |un poco |algo |super |s[uú]per )?(triste|mal|sola|deprimida|desanimada|agobiada|ansiosa|rota|vac[ií]a|perdida|abrumada|apagada)",
    "\\b(tuve|tengo|fue) un (mal|p[eé]simo|horrible|feo) d[ií]a",
    "\\b(quiero|tengo ganas de|me dan ganas de|necesito) llorar",
    "\\bestoy llorando",
    "\\bno (me )?siento bien",
    "\\bno puedo m[aá]s",
    "\\bme siento fatal",
  ].join("|"),
  "i"
);

function parseSse(chunk: string, onDelta: (delta: string) => void, onEvent?: (event: StreamEvent) => void) {
  for (const block of chunk.split("\n\n")) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (!data) continue;
    try {
      const event: StreamEvent = JSON.parse(data);
      onEvent?.(event);
      if (event.type === "response.output_text.delta") onDelta(event.delta ?? "");
      if (event.type === "error") throw new Error(event.message ?? "El agente no pudo responder.");
    } catch (error) {
      if (error instanceof Error && error.message !== "Unexpected end of JSON input") throw error;
    }
  }
}

function groupLabel(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days <= 7) return "Hace una semana";
  return "Anteriores";
}

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  return "";
}

function spotifyEmbedUrl(url: URL): { src: string; height: number } | null {
  if (!url.hostname.endsWith("spotify.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("intl-")) parts.shift();
  const [kind, id] = parts;
  if (!id || !["track", "album", "playlist"].includes(kind)) return null;
  return { src: `https://open.spotify.com/embed/${kind}/${id}`, height: kind === "track" ? 80 : 152 };
}

function youtubeEmbedUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  let id = "";
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (host === "youtube.com") {
    id = url.searchParams.get("v") ?? "";
    if (!id) id = url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] ?? "";
  }
  return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
}

function streamingPlatform(hostname: string) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (host.includes("netflix.com")) return "Netflix";
  if (host.includes("crunchyroll.com")) return "Crunchyroll";
  if (host === "max.com" || host.endsWith("max.com")) return "Max";
  if (host.includes("primevideo.com") || host.includes("amazon.com")) return "Prime Video";
  if (host.includes("disneyplus.com")) return "Disney+";
  if (host.includes("hulu.com")) return "Hulu";
  return null;
}

function MultimediaLink({ href, children, ...props }: ComponentProps<"a">) {
  const label = textFromChildren(children).trim() || "Abrir enlace";
  if (!href) return <a {...props} className="text-[#a45d6f] underline decoration-[#e4b5c0] underline-offset-2">{children}</a>;

  try {
    const url = new URL(href);
    const spotify = spotifyEmbedUrl(url);
    if (spotify) {
      return (
        <span className="my-3 block not-prose">
          <iframe
            src={spotify.src}
            title={`Spotify: ${label}`}
            width="100%"
            height={spotify.height}
            loading="lazy"
            className="rounded-2xl border-0 shadow-sm"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </span>
      );
    }

    const youtube = youtubeEmbedUrl(url);
    if (youtube) {
      return (
        <span className="my-3 block not-prose overflow-hidden rounded-2xl border border-[#f3d3dc] bg-[#fff8fa] shadow-sm">
          <iframe
            src={youtube}
            title={`YouTube: ${label}`}
            width="100%"
            height="190"
            loading="lazy"
            className="block border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </span>
      );
    }

    const platform = streamingPlatform(url.hostname);
    if (platform) {
      return (
        <span className="my-3 block not-prose rounded-2xl border border-[#f3d3dc] bg-[#fff8fa]/95 p-3.5 shadow-sm">
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="mb-1 inline-block rounded-full bg-[#fae1e7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[#9e4c61]">
                {platform}
              </span>
              <span className="block truncate font-serif text-sm font-medium text-[#4a2e35]">
                {label}
              </span>
            </span>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-xl border border-[#eec5cf] bg-white px-3 py-2 text-xs font-medium text-[#7d3c4d] no-underline transition hover:bg-[#faebef]"
            >
              Ver en {platform}
            </a>
          </span>
        </span>
      );
    }
  } catch {
    // Renderizado estándar si la URL falla
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
      className="font-medium text-[#a45d6f] underline decoration-[#e4b5c0] decoration-1 underline-offset-2 transition hover:text-[#6e2b3c]"
    >
      {children}
    </a>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryText, setMemoryText] = useState("");
  const [memoryStatus, setMemoryStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [poppedHeart, setPoppedHeart] = useState<string | null>(null);
  // Invitación al Refugio tras un mensaje triste: una sola vez por conversación.
  const [refugioHint, setRefugioHint] = useState(false);
  const hintedSessions = useRef<Set<string>>(new Set());
  const [unlocked, setUnlocked] = useState(false);
  const unlock = useCallback(() => setUnlocked(true), []);
  const [refugioAdded, setRefugioAdded] = useState<RefugioItem[]>([]);
  const [refugioSuggestions, setRefugioSuggestions] = useState<RefugioSuggestion[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`/api/backend/${path}`, { cache: "no-store", ...options });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.detail ?? "No se pudo completar la operación.");
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };

  const loadSessions = async () => {
    const data = await request<Session[]>("sessions");
    setSessions(data);
    return data;
  };

  const loadSession = async (id: string) => {
    if (isStreaming) return;
    setIsLoadingSession(true);
    setError("");
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    try {
      const data = await request<Message[]>(`sessions/${id}/messages`);
      setMessages(data);
      setRefugioHint(false);
      setCurrentSessionId(id);
      setInput(readDraft(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la conversación.");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const createSession = async (options: { title?: string; mode?: "normal" | "nostalgia" } = {}) => {
    if (isStreaming) return;
    setIsLoadingSession(true);
    setError("");
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    try {
      const session = await request<Session>("sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      setSessions((current) => [session, ...current]);
      setMessages([]);
      setRefugioHint(false);
      setCurrentSessionId(session.id);
      setInput("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la conversación.");
    } finally {
      setIsLoadingSession(false);
      textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!unlocked) return;
    request<{ url: string | null }>("profile/photo")
      .then(({ url }) => url && setAvatarUrl(url))
      .catch(() => null);
    void (async () => {
      try {
        const data = await loadSessions();
        // Viene de un momento del Refugio: charla nueva en modo nostalgia,
        // con el mensaje escrito pero sin enviar para que ella decida.
        const recall = takeRecallMoment();
        if (recall) {
          await createSession({ title: `Recordando: ${recall.title}`.slice(0, 100), mode: "nostalgia" });
          setInput(`Cuéntame otra vez de ${recall.title}…`);
        } else if (data[0]) await loadSession(data[0].id);
        else await createSession();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo conectar con el historial.");
        setIsLoadingSession(false);
      }
    })();
  }, [unlocked]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  // Borrador por conversación: si se cierra la pestaña a medio mensaje, no se pierde.
  useEffect(() => {
    if (!currentSessionId) return;
    try {
      if (input) localStorage.setItem(DRAFT_KEY + currentSessionId, input);
      else localStorage.removeItem(DRAFT_KEY + currentSessionId);
    } catch {}
  }, [input, currentSessionId]);

  const sendMessage = async (prompt?: string) => {
    const question = (prompt ?? input).trim();
    if (!question || isStreaming || !currentSessionId) return;

    if (/taylor|swift|bibble|fairytopia/i.test(question)) {
      confetti({
        particleCount: 45,
        spread: 80,
        colors: ["#F4A6B8", "#E8AEB7", "#D4AF37", "#E0BBE4"],
      });
    }

    setMessages((current) => [...current, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const result = await streamReply(currentSessionId, { message: question });
    if (result === "lost") {
      // Su mensaje no alcanzó a guardarse: se le devuelve a la caja de texto
      // para que no tenga que escribirlo otra vez.
      setMessages((current) => current.slice(0, -1));
      setInput(question);
    }

    // Tras la respuesta (no antes), una invitación suave a su Refugio.
    if (result === "ok" && SAD_MESSAGE.test(question) && !hintedSessions.current.has(currentSessionId)) {
      hintedSessions.current.add(currentSessionId);
      setRefugioHint(true);
    }
  };

  // Pide la respuesta del último mensaje que se quedó sin contestar, sin reenviarlo.
  const retryReply = async () => {
    if (isStreaming || !currentSessionId) return;
    setMessages((current) => [...current, { role: "assistant", content: "" }]);
    await streamReply(currentSessionId, { retry: true });
  };

  // "ok": hubo respuesta. "saved": su mensaje está guardado pero sin respuesta.
  // "lost": su mensaje no llegó al servidor.
  const streamReply = async (sessionId: string, payload: { message?: string; retry?: boolean }): Promise<"ok" | "saved" | "lost"> => {
    setError("");
    setIsStreaming(true);
    let saved = Boolean(payload.retry);
    let answered = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, stream: true, ...payload }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? "El biógrafo está descansando un momento.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const appendDelta = (delta: string) =>
        setMessages((current) =>
          current.map((message, index) =>
            index === current.length - 1 ? { ...message, content: message.content + delta } : message
          )
        );

      // El servidor manda los ids de ambos mensajes para poder reaccionarles con corazón.
      const assignIds = (event: StreamEvent) => {
        if (event.type === "response.created" && event.user_message_id) {
          saved = true;
          const id = event.user_message_id;
          setMessages((current) => current.map((message, index) => (index === current.length - 2 ? { ...message, id } : message)));
        }
        // La respuesta se cortó en el servidor y vuelve a empezar: se borra lo parcial.
        if (event.type === "response.output_text.reset") {
          setMessages((current) => current.map((message, index) => (index === current.length - 1 ? { ...message, content: "" } : message)));
        }
        if (event.type === "response.completed") {
          answered = true;
          if (event.message_id) {
            const id = event.message_id;
            setMessages((current) => current.map((message, index) => (index === current.length - 1 ? { ...message, id } : message)));
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        events.forEach((event) => parseSse(event, appendDelta, assignIds));
        if (done) break;
      }

      if (buffer.trim()) parseSse(buffer, appendDelta, assignIds);
      void loadSessions();
      if (!answered) throw new Error("La respuesta se interrumpió antes de terminar.");
      return "ok";
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Ocurrió un pequeño imprevisto con la memoria.";
      setError(msg);
      // Lo que alcanzó a salir de la respuesta no se guardó: se quita para que
      // "Reintentar" la genere completa. El mensaje de ella se queda.
      setMessages((current) => current.slice(0, -1));
      return saved ? "saved" : "lost";
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const toggleHeart = async (message: Message) => {
    if (!message.id || !currentSessionId) return;
    const hearted = !message.hearted;
    const setHearted = (value: boolean) =>
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, hearted: value } : item)));
    setHearted(hearted);
    if (hearted) setPoppedHeart(message.id);
    try {
      await request(`sessions/${currentSessionId}/messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearted }),
      });
    } catch {
      setHearted(!hearted);
    }
  };

  const renameSession = async (session: Session) => {
    const result = await Swal.fire({
      title: "Renombrar conversación",
      input: "text",
      inputValue: session.title,
      inputPlaceholder: "Escribe el nuevo nombre...",
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#fff8fa",
      color: "#421f2b",
      backdrop: "rgba(56, 26, 36, 0.35)",
      customClass: {
        popup: "rounded-3xl border border-[#f0cad5] shadow-2xl p-6 font-sans",
        title: "font-serif text-xl sm:text-2xl text-[#421f2b] tracking-wide",
        input: "!rounded-2xl !border !border-[#f0cad5] !bg-white !px-3.5 !py-2.5 !text-sm !text-[#42222b] !shadow-xs focus:!border-[#a45d6f] focus:!ring-4 focus:!ring-[#fae6ec] !outline-none",
        confirmButton: "!rounded-xl !bg-[#522b37] !px-4 !py-2.5 !text-xs sm:!text-sm !font-medium !text-[#fff0f3] hover:!bg-[#3d1d27] !transition !shadow-sm",
        cancelButton: "!rounded-xl !border !border-[#f0cad5] !bg-white !px-4 !py-2.5 !text-xs sm:!text-sm !font-medium !text-[#733b4b] hover:!bg-[#faebef] !transition !shadow-xs",
        actions: "gap-2.5",
      },
      buttonsStyling: false,
    });

    const title = result.value?.trim();
    if (!result.isConfirmed || !title) return;

    try {
      const updated = await request<Session>(`sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo renombrar.");
    }
  };

  const deleteSession = async (session: Session) => {
    const result = await Swal.fire({
      title: "¿Eliminar conversación?",
      html: `<span class="text-xs sm:text-sm text-[#733b4b] leading-relaxed">¿Deseas eliminar <b>“${session.title}”</b>? Esta acción no se puede deshacer.</span>`,
      imageUrl: "/bibble_asustado.jpeg",
      imageWidth: 80,
      imageHeight: 80,
      imageAlt: "Bibble asustado",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      background: "#fff8fa",
      color: "#421f2b",
      backdrop: "rgba(56, 26, 36, 0.35)",
      customClass: {
        popup: "rounded-3xl border border-[#f0cad5] shadow-2xl p-6 font-sans",
        title: "font-serif text-xl sm:text-2xl text-[#421f2b] tracking-wide",
        image: "rounded-2xl object-cover border border-[#f3cad5] shadow-xs my-2",
        confirmButton: "!rounded-xl !bg-[#be4d69] !px-4 !py-2.5 !text-xs sm:!text-sm !font-medium !text-white hover:!bg-[#9e3b52] !transition !shadow-sm",
        cancelButton: "!rounded-xl !border !border-[#f0cad5] !bg-white !px-4 !py-2.5 !text-xs sm:!text-sm !font-medium !text-[#733b4b] hover:!bg-[#faebef] !transition !shadow-xs",
        actions: "gap-2.5",
      },
      buttonsStyling: false,
    });

    if (!result.isConfirmed) return;

    try {
      await request<void>(`sessions/${session.id}`, { method: "DELETE" });
      const remaining = sessions.filter((item) => item.id !== session.id);
      setSessions(remaining);
      if (session.id === currentSessionId) {
        if (remaining[0]) await loadSession(remaining[0].id);
        else await createSession();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar.");
    }
  };

  const saveMemory = async () => {
    if (!memoryText.trim() || memoryStatus === "saving") return;
    setMemoryStatus("saving");
    try {
      const result = await request<IngestResult>("ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: memoryText }),
      });
      setMemoryText("");
      setMemoryStatus("saved");
      const added = result.refugio ?? [];
      const suggestions = result.refugio_suggestions ?? [];
      setRefugioAdded(added);
      setRefugioSuggestions(suggestions);
      // Si nada llegó al Refugio, el modal se cierra solo como antes.
      if (!added.length && !suggestions.length) setTimeout(closeMemory, 1100);
    } catch {
      setMemoryStatus("error");
    }
  };

  const closeMemory = () => {
    setMemoryOpen(false);
    setMemoryStatus("idle");
    setRefugioAdded([]);
    setRefugioSuggestions([]);
  };

  const undoRefugio = async () => {
    const items = refugioAdded;
    setRefugioAdded([]);
    await Promise.all(items.map((item) => request(`refugio/items/${item.id}`, { method: "DELETE" }).catch(() => null)));
  };

  const answerSuggestion = async (suggestion: RefugioSuggestion, keep: boolean) => {
    setRefugioSuggestions((current) => current.filter((item) => item !== suggestion));
    if (!keep) return;
    try {
      const created = await request<RefugioItem>("refugio/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suggestion),
      });
      setRefugioAdded((current) => [...current, created]);
    } catch {
      // Si ya existía (409) no hay nada que avisar.
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const grouped = sessions.reduce<Record<string, Session[]>>((acc, session) => {
    const label = groupLabel(session.updated_at ?? session.created_at);
    (acc[label] ??= []).push(session);
    return acc;
  }, {});

  return (
    <main className="relative isolate min-h-dvh px-2 py-14 md:p-5">
      <ScrapbookBackground revealed={revealed} />
      <WelcomeCurtain onUnlock={unlock} onOpen={reveal} />

      {/* En celular el collage ocupa la banda superior; en escritorio rodea el panel */}
      <div
        className={`relative z-10 mx-auto max-w-[1080px] transition duration-700 delay-700 ${
          revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
      <span aria-hidden="true" className="panel-tape -top-3 left-8 -rotate-6 sm:left-14" />
      <span aria-hidden="true" className="panel-tape -top-3 right-8 rotate-[5deg] sm:right-14" />
      <div className="glass-panel relative flex h-[calc(100dvh-7rem)] overflow-hidden rounded-[2rem] md:h-[94dvh]">

        {/* BACKDROP OSCURO EN MÓVIL AL ABRIR SIDEBAR */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-[#381a24]/20 backdrop-blur-[2px] md:hidden"
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-[#fff4f7]/75 p-4 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out md:static md:z-auto md:h-full md:bg-white/20 md:shadow-none md:backdrop-blur-none md:transition-all ${
            sidebarOpen ? "translate-x-0 md:w-72 md:p-4" : "-translate-x-full md:w-0 md:p-0 md:translate-x-0"
          } shrink-0 overflow-hidden border-r border-white/60`}
        >
          <div className="flex h-full w-64 flex-col">
            <div className="flex items-center justify-between px-1 pb-3">
              <span className="font-hand text-2xl leading-none text-[#9e3b56]">mis conversaciones</span>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar historial"
                className="rounded-full p-1.5 text-[#8f475a] hover:bg-white/60 md:hidden"
              >
                <X size={18} />
              </button>
            </div>

            <button
              onClick={() => void createSession()}
              disabled={isStreaming}
              className="flex items-center justify-center gap-2 rounded-full bg-[#522b37] px-4 py-3 text-sm font-medium text-[#fff0f3] shadow-[0_10px_20px_-10px_rgba(82,43,55,.8)] transition hover:-translate-y-0.5 hover:bg-[#3d1d27] disabled:opacity-50"
            >
              <Plus size={17} />
              Nueva conversación
            </button>

            <button
              onClick={() => {
                setMemoryOpen(true);
                if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
              }}
              className="mt-2.5 flex items-center justify-center gap-2 rounded-full border border-white/80 bg-white/45 px-4 py-2.5 text-sm text-[#733b4b] backdrop-blur-sm transition hover:bg-white/75"
            >
              <BrainCircuit size={16} className="text-[#be4d69]" />
              Guardar recuerdo
            </button>

            <Link
              href="/refugio"
              className="mt-2.5 flex items-center justify-center gap-2 rounded-full border border-white/80 bg-[#fbe1e9]/60 px-4 py-2.5 text-sm text-[#7a2c43] backdrop-blur-sm transition hover:bg-[#fbe1e9]/90"
            >
              <TulipIcon size={17} className="text-[#d9567a]" />
              El Refugio
            </Link>

            <button
              onClick={() => {
                setIdeasOpen(true);
                if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
              }}
              className="mt-2.5 flex items-center justify-center gap-2 rounded-full border border-white/80 bg-[#fff8f1]/70 px-4 py-2.5 text-sm text-[#7a2c43] backdrop-blur-sm transition hover:bg-[#fff8f1]"
            >
              <Lightbulb size={16} className="text-[#d9567a]" />
              Caja de ideas
            </button>

            <div className="scrollbar-soft mt-5 flex-1 overflow-y-auto pr-1">
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label} className="mb-4">
                  <p className="px-2 pb-1 font-hand text-lg lowercase text-[#be4d69]">{label}</p>
                  {items.map((session) => (
                    <div
                      key={session.id}
                      className={`group mb-1 flex items-center gap-1 rounded-2xl p-1 transition ${
                        session.id === currentSessionId
                          ? "bg-white/75 shadow-[0_6px_16px_-10px_rgba(122,44,67,.6)]"
                          : "hover:bg-white/45"
                      }`}
                    >
                      <button
                        onClick={() => void loadSession(session.id)}
                        className="min-w-0 flex-1 truncate px-2 py-2 text-left text-[13px] text-[#4a2230]"
                      >
                        <MessageCircle
                          className={`mr-2 inline size-3.5 ${session.id === currentSessionId ? "text-[#be4d69]" : "text-[#c98a9b]"}`}
                        />
                        {session.title}
                      </button>
                      <button
                        onClick={() => void renameSession(session)}
                        aria-label="Renombrar"
                        className="rounded-full p-1.5 text-[#9e6776] hover:bg-white md:hidden md:group-hover:block"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => void deleteSession(session)}
                        aria-label="Eliminar"
                        className="rounded-full p-1.5 text-[#be4d69] hover:bg-white md:hidden md:group-hover:block"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <p className="border-t border-white/60 px-2 pt-3 text-[10px] leading-relaxed text-[#8a4a5c]">
              Las conversaciones son privadas y el biógrafo solo consulta el contexto relevante.
            </p>
          </div>
        </aside>

        {/* CHAT SECTION */}
        <section className="relative flex min-w-0 flex-1 flex-col">
          {/* HEADER */}
          <header className="flex items-center justify-between gap-2 border-b border-white/60 bg-white/15 px-3 py-3 sm:px-7 sm:py-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-white/80 bg-white/45 text-[#733b4b] backdrop-blur-sm transition hover:bg-white/75 sm:size-10"
                aria-label="Alternar historial"
              >
                {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
              </button>

              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                className="avatar-edit relative size-9 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_2px_#fff,0_0_0_4px_rgba(240,202,213,.9)] sm:size-11"
                aria-label="Cambiar foto de perfil"
                title="Cambiar foto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="Mireya" className="h-full w-full object-cover" />
                <span aria-hidden="true" className="avatar-edit-overlay">
                  <Camera size={15} />
                </span>
              </button>

              <div>
                <h1 className="whitespace-nowrap font-display text-xl font-semibold leading-none text-[#421f2b] sm:text-2xl">
                  Mireya <span className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-[#be4d69]">AI</span>
                </h1>
                <p className="mt-0.5 whitespace-nowrap font-hand text-[15px] leading-none text-[#9e3b56] sm:text-lg">su biografía viva</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link
                href="/refugio"
                className="grid size-9 place-items-center rounded-full border border-white/80 bg-white/45 text-[#d9567a] backdrop-blur-sm transition hover:bg-white/75 sm:size-10"
                aria-label="Ir a El Refugio"
                title="El Refugio"
              >
                <TulipIcon size={19} />
              </Link>
              <button
                onClick={() => setMemoryOpen(true)}
                className="grid size-9 place-items-center rounded-full border border-white/80 bg-white/45 text-[#be4d69] backdrop-blur-sm transition hover:bg-white/75 sm:size-10"
                aria-label="Guardar recuerdo"
                title="Guardar recuerdo"
              >
                <BrainCircuit size={17} />
              </button>
            </div>
          </header>

          {/* MAIN MESSAGES AREA */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {isLoadingSession ? (
              <div className="grid h-full place-items-center text-sm text-[#9e6776]">
                <div className="flex items-center gap-3">
                  <div className="relative size-10 overflow-hidden rounded-2xl border border-[#f3d3dc] shadow-sm">
                    <Image src="/bibble_cargando.jpeg" alt="Bibble pensando" fill sizes="40px" className="object-cover animate-pulse" />
                  </div>
                  <span>Cargando conversación…</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center py-4 text-center sm:py-12">
                <p className="font-hand text-xl text-[#be4d69] sm:text-2xl">bienvenida al scrapbook de</p>
                <h2 className="font-display text-5xl font-medium italic leading-[.95] text-[#421f2b] sm:text-6xl">Mireya</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6e3a4a] sm:mt-4 sm:text-[15px]">
                  Pregúntale a su biógrafo por su música, sus proyectos o sus fijaciones favoritas.
                </p>

                <div className="mt-6 grid w-full gap-2.5 text-left sm:mt-9 sm:grid-cols-2 sm:gap-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => void sendMessage(suggestion.label)}
                      className="flex items-start gap-3 rounded-[1.25rem] border border-white/80 bg-white/50 p-3.5 text-left shadow-[0_8px_20px_-14px_rgba(122,44,67,.6)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/80 sm:p-4"
                    >
                      <suggestion.icon size={19} strokeWidth={1.7} className="mt-0.5 shrink-0 text-[#be4d69]" />
                      <span>
                        <span className="block text-[10px] font-semibold uppercase tracking-[.14em] text-[#9e3b56]">{suggestion.title}</span>
                        <span className="mt-1 block text-[13px] leading-snug text-[#4a2230] sm:text-sm">{suggestion.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-5 sm:gap-6">
                {messages.map((message, index) => (
                  <div
                    key={message.id ?? `${message.role}-${index}`}
                    className={`bubble-in flex items-start gap-2.5 sm:gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`relative mt-6 grid size-8 shrink-0 place-items-center overflow-hidden rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3.5px_rgba(240,202,213,.95)] sm:size-9 ${
                        message.role === "user" ? "bg-gradient-to-br from-[#e98aa5] to-[#be4d69] text-white" : ""
                      }`}
                    >
                      {message.role === "user" ? (
                        <User size={15} />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="Mireya" className="h-full w-full object-cover" />
                      )}
                    </div>

                    <div className={`flex min-w-0 max-w-[86%] flex-col sm:max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <span className="mb-1 px-2 font-hand text-[17px] leading-none text-[#9e3b56]">
                        {message.role === "user" ? "tú" : "el biógrafo"}
                      </span>

                      <div className={`msg-line flex max-w-full items-center gap-1.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`group relative min-w-0 ${message.role === "user" ? "bubble-user" : "bubble-note"}`}
                        // Doble toque para reaccionar, como en WhatsApp.
                        onDoubleClick={() => void toggleHeart(message)}
                      >
                        {message.hearted && (
                          <span
                            className={`reaction-badge ${message.role === "user" ? "reaction-left" : "reaction-right"} ${poppedHeart === message.id ? "is-popping" : ""}`}
                            role="img"
                            aria-label="Le encantó"
                          >
                            <Heart size={13} fill="currentColor" strokeWidth={0} />
                          </span>
                        )}
                        {message.role === "user" ? (
                          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed sm:text-[15px]">{message.content}</p>
                        ) : message.content ? (
                          <>
                            <div className="prose prose-sm max-w-none text-[13.5px] sm:text-[15px]
                              prose-headings:font-display prose-headings:font-semibold prose-headings:text-[#421f2b]
                              prose-p:font-serif prose-p:text-[#3f1f2a] prose-p:leading-[1.7] prose-p:my-0 prose-p:mb-3
                              prose-strong:font-semibold prose-strong:text-[#7a2c43]
                              prose-em:text-[#9e3b56]
                              prose-ul:my-2 prose-ul:list-disc prose-ul:font-serif prose-ul:marker:text-[#be4d69]
                              prose-ol:my-2 prose-ol:list-decimal prose-ol:font-serif prose-ol:marker:text-[#be4d69]
                              prose-li:my-1 prose-li:text-[#3f1f2a]
                            ">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MultimediaLink }}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(message.content);
                                setCopiedIndex(index);
                                setTimeout(() => setCopiedIndex(null), 1500);
                              }}
                              aria-label="Copiar respuesta"
                              className="absolute -bottom-3.5 right-4 flex items-center gap-1 rounded-full border border-white bg-[#fff5f8]/95 px-2.5 py-1 font-hand text-[15px] leading-none text-[#9e3b56] shadow-[0_6px_14px_-8px_rgba(122,44,67,.7)] transition hover:text-[#522b37] md:opacity-0 md:group-hover:opacity-100"
                            >
                              {copiedIndex === index ? <Check size={12} /> : <Copy size={12} />}
                              {copiedIndex === index ? "copiado" : "copiar"}
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-3 py-0.5">
                            <div className="relative size-9 overflow-hidden rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3.5px_rgba(240,202,213,.95)]">
                              <Image src="/bibble.png" alt="Bibble pensando" fill sizes="36px" className="object-cover" />
                            </div>
                            <span className="font-hand text-lg leading-tight text-[#9e3b56]">Bibble está buscando en sus recuerdos</span>
                            <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                          </div>
                        )}
                      </div>
                      {message.id && message.content && (
                        <button
                          type="button"
                          onClick={() => void toggleHeart(message)}
                          className={`react-btn ${message.hearted ? "is-on" : ""}`}
                          aria-label={message.hearted ? "Quitar corazón" : "Reaccionar con corazón"}
                          aria-pressed={Boolean(message.hearted)}
                        >
                          <Heart size={16} fill={message.hearted ? "currentColor" : "none"} strokeWidth={1.8} />
                        </button>
                      )}
                      </div>
                    </div>
                  </div>
                ))}
                {!isStreaming && !error && messages.at(-1)?.role === "user" && (
                  <div className="bubble-in ml-auto flex max-w-[86%] flex-wrap items-center justify-end gap-2 text-right sm:max-w-[80%]" role="note">
                    <p className="text-[11px] text-[#8f475a] sm:text-xs">Tu mensaje está guardado, pero el biógrafo no alcanzó a responderlo.</p>
                    <button
                      type="button"
                      onClick={() => void retryReply()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#522b37] px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#3d1d27]"
                    >
                      <RefreshCw size={12} /> Pedir respuesta
                    </button>
                  </div>
                )}
                {refugioHint && !isStreaming && (
                  <div className="refugio-hint bubble-in" role="note">
                    <span aria-hidden="true" className="washi washi-sm" />
                    <TulipIcon size={26} className="shrink-0 text-[#d9567a]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-hand text-[22px] leading-tight text-[#5c2338]">si hoy es un día gris, tu Refugio te está esperando</p>
                      <Link href="/refugio" className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#4a2230] px-4 text-[13px] font-medium text-[#fff3f6] transition hover:bg-[#3d1d27]">
                        Ir a mi Refugio
                      </Link>
                    </div>
                    <button type="button" onClick={() => setRefugioHint(false)} aria-label="Cerrar invitación al Refugio" className="self-start rounded-full p-1.5 text-[#b07d8d] hover:bg-white/70">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}

            {/* TARJETA DE ERROR CON BIBBLE */}
            {error && (
              <div className="mx-auto mt-4 sm:mt-6 max-w-lg overflow-hidden rounded-2xl sm:rounded-3xl border border-[#f5b8c7] bg-white/95 p-4 sm:p-5 shadow-lg animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3.5">
                  <div className="relative size-12 sm:size-14 shrink-0 overflow-hidden rounded-2xl border border-[#f3cad5] shadow-xs">
                    <Image src="/bibble_error.png" alt="Bibble en shock" fill sizes="56px" className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-serif text-sm sm:text-base font-semibold text-[#6e2236]">
                      ¡Bibble se quedó sin aliento!
                    </h2>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-[#8f475a] leading-relaxed">
                      {error.includes("503") || error.includes("429") || error.includes("demand")
                        ? "Hubo un pico de demanda en los servidores de IA. Dale un segundo a Bibble para respirar y volvemos."
                        : error}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => {
                      setError("");
                      // Si su mensaje ya está guardado, se pide solo la respuesta.
                      void (messages.at(-1)?.role === "user" ? retryReply() : sendMessage());
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#522b37] px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-[#3d1d27]"
                  >
                    <RefreshCw size={12} /> Reintentar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* INPUT BAR */}
          <footer className="border-t border-white/60 bg-white/15 p-3 sm:p-4">
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void sendMessage();
              }}
              className="mx-auto max-w-3xl"
            >
              <div className="flex items-end gap-2 rounded-[1.4rem] border border-white/90 bg-white/70 p-1.5 shadow-[0_10px_24px_-16px_rgba(122,44,67,.6)] backdrop-blur-md transition focus-within:bg-white/90 focus-within:ring-4 focus-within:ring-white/50 sm:p-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    event.currentTarget.style.height = "auto";
                    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={onKeyDown}
                  disabled={isStreaming || !currentSessionId}
                  rows={1}
                  maxLength={2000}
                  placeholder="Pregúntale al biógrafo sobre Mireya..."
                  className="max-h-36 min-h-[38px] sm:min-h-[42px] flex-1 resize-none bg-transparent px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-[#42222b] placeholder-[#b07d8d] outline-none font-sans"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming || !currentSessionId}
                  className="grid size-9 sm:size-10 place-items-center rounded-xl bg-[#522b37] text-[#fff0f3] transition hover:bg-[#3d1d27] disabled:bg-[#edd0d7] disabled:text-white"
                >
                  {isStreaming ? <Sparkles size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                </button>
              </div>
            </form>
          </footer>
        </section>
      </div>
      </div>

      {ideasOpen && <IdeasBox api={request} onClose={() => setIdeasOpen(false)} />}
      {avatarOpen && (
        <AvatarPicker api={request} current={avatarUrl} onChange={setAvatarUrl} onClose={() => setAvatarOpen(false)} />
      )}

      {/* MODAL NUEVO RECUERDO */}
      {memoryOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#381a24]/30 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-white/90 bg-[#fff8fa] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl text-[#421f2b]">Nuevo recuerdo</h2>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-[#733b4b]">Se guardará y estará disponible para futuras conversaciones.</p>
              </div>
              <button onClick={closeMemory} aria-label="Cerrar" className="rounded-full p-2 text-[#8f475a] hover:bg-[#fae6ec]">
                <X size={18} />
              </button>
            </div>

            <textarea
              value={memoryText}
              onChange={(event) => {
                setMemoryText(event.target.value);
                setMemoryStatus("idle");
              }}
              maxLength={10000}
              rows={6}
              placeholder="Escribe un recuerdo, una anécdota, un gusto, el link de tus canciones favoritas o un dato importante…"
              className="mt-4 sm:mt-5 w-full resize-none rounded-2xl border border-[#f0cad5] bg-white p-3.5 sm:p-4 text-xs sm:text-sm text-[#42222b] outline-none focus:border-[#a45d6f] focus:ring-4 focus:ring-[#fae6ec]"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className={`text-[11px] sm:text-xs ${memoryStatus === "error" ? "text-rose-600" : "text-[#9e6776]"}`}>
                {memoryStatus === "saving"
                  ? "Guardando en el mapa de recuerdos…"
                  : memoryStatus === "saved"
                  ? "¡Recuerdo guardado!"
                  : memoryStatus === "error"
                  ? "No se pudo guardar. Intenta de nuevo."
                  : `${memoryText.length}/10000`}
              </span>
              <button
                onClick={() => void saveMemory()}
                disabled={!memoryText.trim() || memoryStatus === "saving"}
                className="rounded-xl bg-[#522b37] px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-white transition hover:bg-[#3d1d27] disabled:bg-[#edd0d7]"
              >
                {memoryStatus === "saving" ? "Guardando…" : "Guardar recuerdo"}
              </button>
            </div>

            {(refugioAdded.length > 0 || refugioSuggestions.length > 0) && (
              <div className="bubble-in mt-5 rounded-3xl bg-gradient-to-br from-[#5c2a3c] to-[#4a2230] p-4 text-[#fff3f6] shadow-[0_16px_30px_-16px_rgba(74,34,48,.9)] sm:p-5">
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
                    <button onClick={() => void undoRefugio()} className="shrink-0 font-hand text-lg text-[#f7a8bf] underline-offset-4 hover:underline">
                      deshacer
                    </button>
                  </div>
                )}

                {refugioSuggestions.map((suggestion) => (
                  <div key={`${suggestion.kind}-${suggestion.title}`} className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3 first:mt-0 first:border-0 first:pt-0">
                    <p className="min-w-0 flex-1 text-[13px]">
                      ¿Guardo también <strong>{suggestion.title}</strong> <span className="text-[#ffdfe8]">({KIND_LABELS[suggestion.kind]})</span> en El Refugio?
                    </p>
                    <button onClick={() => void answerSuggestion(suggestion, true)} className="rounded-full bg-[#f7a8bf] px-3.5 py-1.5 text-xs font-medium text-[#4a2230] hover:bg-[#ffc2d3]">
                      Sí
                    </button>
                    <button onClick={() => void answerSuggestion(suggestion, false)} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-[#ffdfe8] hover:bg-white/10">
                      No
                    </button>
                  </div>
                ))}

                <div className="mt-4 flex justify-end">
                  <button onClick={closeMemory} className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium hover:bg-white/25">
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}