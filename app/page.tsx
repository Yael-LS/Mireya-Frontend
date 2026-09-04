"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  BookOpenText,
  BrainCircuit,
  Check,
  ChevronLeft,
  Copy,
  Menu,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import confetti from "canvas-confetti";

type Message = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };
type Session = { id: string; title: string; created_at: string; updated_at: string };

const suggestions = [
  { icon: "🎵", title: "Música & Melancolía", label: "¿Cuál es su relación con Taylor Swift y Radiohead?" },
  { icon: "🧠", title: "Psicología & Negocios", label: "Cuéntame sobre sus proyectos en Psicología y ALTHEA." },
  { icon: "🌸", title: "Cultura Pop & K-dramas", label: "¿Qué opina sobre Bibble y los K-dramas?" },
  { icon: "✨", title: "Estética & Cuidado", label: "¿Cuáles son sus fijaciones estéticas y de skincare?" },
];

function parseSse(chunk: string, onDelta: (delta: string) => void) {
  for (const block of chunk.split("\n\n")) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (!data) continue;
    try {
      const event = JSON.parse(data);
      if (event.type === "response.output_text.delta") onDelta(event.delta);
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
      setCurrentSessionId(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la conversación.");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const createSession = async () => {
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
        body: JSON.stringify({}),
      });
      setSessions((current) => [session, ...current]);
      setMessages([]);
      setCurrentSessionId(session.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la conversación.");
    } finally {
      setIsLoadingSession(false);
      textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const data = await loadSessions();
        if (data[0]) await loadSession(data[0].id);
        else await createSession();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo conectar con el historial.");
        setIsLoadingSession(false);
      }
    })();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

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
    setError("");
    setIsStreaming(true);

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: currentSessionId, message: question, stream: true }),
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

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        events.forEach((event) => parseSse(event, appendDelta));
        if (done) break;
      }

      if (buffer.trim()) parseSse(buffer, appendDelta);
      void loadSessions();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Ocurrió un pequeño imprevisto con la memoria.";
      setError(msg);
      setMessages((current) => current.filter((message, index) => !(index === current.length - 1 && !message.content)));
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const renameSession = async (session: Session) => {
    const title = window.prompt("Nuevo nombre de la conversación:", session.title)?.trim();
    if (!title) return;
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
    if (!window.confirm(`¿Eliminar “${session.title}”? Esta acción no se puede deshacer.`)) return;
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
      await request("ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: memoryText }),
      });
      setMemoryText("");
      setMemoryStatus("saved");
      setTimeout(() => {
        setMemoryStatus("idle");
        setMemoryOpen(false);
      }, 1100);
    } catch {
      setMemoryStatus("error");
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
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#fff0f3_0%,#fae8eb_45%,#f5dbe2_100%)] p-2 sm:p-5 transition-colors duration-500">
      <div className="relative mx-auto flex h-[94dvh] max-w-7xl overflow-hidden rounded-[2rem] border border-white/80 bg-[#fff5f7]/80 shadow-[0_24px_60px_-15px_rgba(180,90,120,.15)] backdrop-blur-2xl">
        
        {/* BACKDROP OSCURO EN MÓVIL AL ABRIR SIDEBAR */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-[#381a24]/30 backdrop-blur-xs md:hidden"
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-[#fff8fa] p-4 shadow-2xl transition-transform duration-300 ease-in-out md:static md:z-auto md:h-full md:shadow-none md:transition-all ${
            sidebarOpen ? "translate-x-0 md:w-72 md:p-4" : "-translate-x-full md:w-0 md:p-0 md:translate-x-0"
          } shrink-0 overflow-hidden border-r border-[#f3d3dc]/80 md:bg-white/50`}
        >
          <div className="flex h-full w-64 flex-col">
            <div className="flex items-center justify-between pb-2 md:hidden">
              <span className="font-serif text-sm font-semibold text-[#522b37]">Menú & Conversaciones</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-full p-1.5 text-[#8f475a] hover:bg-[#fae6ec]"
              >
                <X size={18} />
              </button>
            </div>

            <button
              onClick={() => void createSession()}
              disabled={isStreaming}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#522b37] px-4 py-3 text-sm font-medium text-[#fff0f3] shadow-sm transition hover:bg-[#3d1d27] disabled:opacity-50"
            >
              <Plus size={17} />
              Nueva conversación
            </button>

            <button
              onClick={() => {
                setMemoryOpen(true);
                if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
              }}
              className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[#f0cad5] bg-[#fffafb]/90 px-4 py-2.5 text-sm text-[#733b4b] shadow-xs transition hover:bg-white"
            >
              <BrainCircuit size={16} className="text-[#a45d6f]" />
              Guardar recuerdo
            </button>

            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label} className="mb-5">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#a45d6f]">{label}</p>
                  {items.map((session) => (
                    <div
                      key={session.id}
                      className={`group mb-1 flex items-center gap-1 rounded-xl p-1 transition ${
                        session.id === currentSessionId ? "bg-[#f5dbe2]/90 shadow-xs" : "hover:bg-white/70"
                      }`}
                    >
                      <button
                        onClick={() => void loadSession(session.id)}
                        className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs text-[#522b37]"
                      >
                        <MessageCircle className="mr-2 inline size-3.5 text-[#a45d6f]" />
                        {session.title}
                      </button>
                      <button
                        onClick={() => void renameSession(session)}
                        aria-label="Renombrar"
                        className="rounded p-1.5 text-[#9e6776] hover:bg-white md:hidden md:group-hover:block"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => void deleteSession(session)}
                        aria-label="Eliminar"
                        className="rounded p-1.5 text-[#be4d69] hover:bg-white md:hidden md:group-hover:block"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <p className="px-2 text-[10px] leading-relaxed text-[#b07d8d]">
              Las conversaciones son privadas y el biógrafo solo consulta el contexto relevante.
            </p>
          </div>
        </aside>

        {/* CHAT SECTION */}
        <section className="relative flex min-w-0 flex-1 flex-col">
          {/* HEADER */}
          <header className="flex items-center justify-between border-b border-[#f3d3dc]/80 bg-white/40 px-4 py-3 sm:px-7 sm:py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg p-2 text-[#733b4b] hover:bg-white/80"
                aria-label="Alternar historial"
              >
                {sidebarOpen ? <ChevronLeft size={19} /> : <Menu size={19} />}
              </button>

              <div className="relative size-9 sm:size-10 overflow-hidden rounded-full ring-2 ring-[#f0cad5] shadow-xs">
                <Image src="/mireya.jpg" alt="Mireya" fill sizes="40px" className="object-cover" priority />
              </div>

              <div>
                <h1 className="font-serif text-lg sm:text-xl tracking-wide text-[#421f2b]">
                  Mireya <span className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-[#a45d6f]">AI</span>
                </h1>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#9e6776]">Biografía viva & mapa de identidad</p>
              </div>
            </div>

            <button
              onClick={() => setMemoryOpen(true)}
              className="rounded-full border border-[#f0cad5] bg-white/80 p-2 text-[#a45d6f] shadow-xs hover:bg-white"
              title="Nuevo recuerdo"
            >
              <BrainCircuit size={17} />
            </button>
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
              <div className="mx-auto flex max-w-2xl flex-col items-center py-6 text-center sm:py-16">
                <div className="mb-4 sm:mb-6 grid size-14 sm:size-16 place-items-center rounded-2xl border border-[#f3d3dc] bg-white/80 text-[#a45d6f] shadow-sm">
                  <BookOpenText size={26} strokeWidth={1.4} />
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl text-[#421f2b]">Un universo por conocer.</h2>
                <p className="mt-2 sm:mt-3 max-w-md text-xs sm:text-sm leading-relaxed text-[#733b4b] font-light">
                  Explora proyectos, gustos, anécdotas y recuerdos de Mireya.
                </p>

                <div className="mt-6 sm:mt-9 grid w-full gap-2.5 text-left sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => void sendMessage(suggestion.label)}
                      className="rounded-2xl border border-[#f3d3dc] bg-white/70 p-3.5 sm:p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:bg-white hover:border-[#e9b5c2]"
                    >
                      <span className="mr-2">{suggestion.icon}</span>
                      <span className="text-xs font-semibold text-[#a45d6f]">{suggestion.title}</span>
                      <p className="mt-1 text-xs sm:text-sm text-[#4a2e35]">{suggestion.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-5 sm:gap-6">
                {messages.map((message, index) => (
                  <div
                    key={message.id ?? `${message.role}-${index}`}
                    className={`flex items-start gap-2.5 sm:gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`grid size-7 sm:size-8 shrink-0 place-items-center overflow-hidden rounded-full ${
                        message.role === "user" ? "bg-[#522b37] text-white" : "ring-1 ring-[#f0cad5]"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User size={13} />
                      ) : (
                        <Image src="/mireya.jpg" alt="Mireya" width={32} height={32} className="object-cover" />
                      )}
                    </div>

                    <div
                      className={`group relative max-w-[88%] sm:max-w-[85%] rounded-[1.3rem] sm:rounded-[1.5rem] px-4 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm leading-relaxed ${
                        message.role === "user"
                          ? "rounded-tr-xs bg-[#522b37] text-[#fff0f3] shadow-xs font-sans"
                          : "rounded-tl-xs border border-[#f3d3dc] bg-white/85 text-[#42222b] shadow-xs"
                      }`}
                    >
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : message.content ? (
                        <>
                          <div className="prose prose-sm prose-pink max-w-none 
                            prose-headings:font-serif prose-headings:font-medium prose-headings:text-[#421f2b] prose-headings:tracking-tight
                            prose-p:font-serif prose-p:font-light prose-p:text-[#42222b] prose-p:leading-relaxed prose-p:mb-4
                            prose-strong:font-semibold prose-strong:text-[#421f2b]
                            prose-ul:list-disc prose-ul:marker:text-[#c47185] prose-ul:font-serif prose-ul:font-light
                            prose-ol:list-decimal prose-ol:marker:text-[#c47185] prose-ol:font-serif prose-ol:font-light
                            prose-li:my-1
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
                            className="absolute right-2 top-2 hidden rounded bg-white p-1 text-[#9e6776] shadow-sm hover:text-[#522b37] group-hover:block"
                          >
                            {copiedIndex === index ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2.5 py-0.5 sm:py-1">
                          <div className="relative size-8 sm:size-9 overflow-hidden rounded-xl border border-[#f3d3dc] shadow-sm">
                            <Image src="/bibble.png" alt="Bibble pensando" fill sizes="36px" className="object-cover animate-pulse" />
                          </div>
                          <span className="text-[11px] sm:text-xs font-medium text-[#a45d6f] animate-pulse font-serif">
                            Bibble está consultando recuerdos…
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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
                      void sendMessage();
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
          <footer className="border-t border-[#f3d3dc]/80 bg-white/40 p-3 sm:p-4">
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void sendMessage();
              }}
              className="mx-auto max-w-3xl"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-[#f3d3dc] bg-white/95 p-1.5 sm:p-2 shadow-xs focus-within:border-[#e5aab8] focus-within:ring-4 focus-within:ring-[#f5dbe2]/60 transition">
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

      {/* MODAL NUEVO RECUERDO */}
      {memoryOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#381a24]/30 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-white/90 bg-[#fff8fa] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl text-[#421f2b]">Nuevo recuerdo</h2>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-[#733b4b]">Se guardará y estará disponible para futuras conversaciones.</p>
              </div>
              <button onClick={() => setMemoryOpen(false)} className="rounded-full p-2 text-[#8f475a] hover:bg-[#fae6ec]">
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
          </div>
        </div>
      )}
    </main>
  );
}