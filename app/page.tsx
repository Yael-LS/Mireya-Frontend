"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, BookOpenText, BrainCircuit, Check, ChevronLeft, Copy, Menu, MessageCircle, Pencil, Plus, Trash2, User, X } from "lucide-react";
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
    const data = block.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryText, setMemoryText] = useState("");
  const [memoryStatus, setMemoryStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    try {
      const session = await request<Session>("sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, isStreaming]);

  const sendMessage = async (prompt?: string) => {
    const question = (prompt ?? input).trim();
    if (!question || isStreaming || !currentSessionId) return;
    if (/taylor|swift|bibble|fairytopia/i.test(question)) confetti({ particleCount: 35, spread: 70, colors: ["#D4AF37", "#E8AEB7", "#D8BBFF"] });
    setMessages((current) => [...current, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput(""); setError(""); setIsStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: currentSessionId, message: question, stream: true }) });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? "No se pudo iniciar la conversación.");
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      const appendDelta = (delta: string) => setMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, content: message.content + delta } : message));
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        events.forEach((event) => parseSse(event, appendDelta));
        if (done) break;
      }
      if (buffer.trim()) parseSse(buffer, appendDelta);
      void loadSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hubo un problema inesperado.");
      setMessages((current) => current.filter((message, index) => !(index === current.length - 1 && !message.content)));
    } finally { setIsStreaming(false); textareaRef.current?.focus(); }
  };

  const renameSession = async (session: Session) => {
    const title = window.prompt("Nuevo nombre de la conversación:", session.title)?.trim();
    if (!title) return;
    try {
      const updated = await request<Session>(`sessions/${session.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      setSessions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo renombrar."); }
  };

  const deleteSession = async (session: Session) => {
    if (!window.confirm(`¿Eliminar “${session.title}”? Esta acción no se puede deshacer.`)) return;
    try {
      await request<void>(`sessions/${session.id}`, { method: "DELETE" });
      const remaining = sessions.filter((item) => item.id !== session.id); setSessions(remaining);
      if (session.id === currentSessionId) {
        if (remaining[0]) await loadSession(remaining[0].id); else await createSession();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar."); }
  };

  const saveMemory = async () => {
    if (!memoryText.trim() || memoryStatus === "saving") return;
    setMemoryStatus("saving");
    try {
      await request("ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: memoryText }) });
      setMemoryText(""); setMemoryStatus("saved");
      setTimeout(() => { setMemoryStatus("idle"); setMemoryOpen(false); }, 1100);
    } catch { setMemoryStatus("error"); }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } };
  const grouped = sessions.reduce<Record<string, Session[]>>((acc, session) => { const label = groupLabel(session.updated_at ?? session.created_at); (acc[label] ??= []).push(session); return acc; }, {});

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#fbf7f2_0%,#f6eee5_50%,#ede3d8_100%)] p-2 sm:p-5">
      <div className="mx-auto flex h-[94dvh] max-w-7xl overflow-hidden rounded-[2rem] border border-white/70 bg-[#faf6f0]/75 shadow-[0_24px_60px_-15px_rgba(80,50,40,.15)] backdrop-blur-2xl">
        <aside className={`${sidebarOpen ? "w-72 p-4" : "w-0 p-0"} relative shrink-0 overflow-hidden border-r border-[#ebdcd0]/70 bg-white/45 transition-all duration-300`}>
          <div className="flex h-full w-64 flex-col">
            <button onClick={() => void createSession()} disabled={isStreaming} className="flex items-center justify-center gap-2 rounded-2xl bg-[#4a3935] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#342725] disabled:opacity-50"><Plus size={17} />Nueva conversación</button>
            <button onClick={() => setMemoryOpen(true)} className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[#dfc9bc] bg-[#fffaf6]/80 px-4 py-2.5 text-sm text-[#6e584f] transition hover:bg-white"><BrainCircuit size={16} className="text-[#9c7866]" />Guardar recuerdo</button>
            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label} className="mb-5">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#9c7866]">{label}</p>
                  {items.map((session) => (
                    <div key={session.id} className={`group mb-1 flex items-center gap-1 rounded-xl p-1 ${session.id === currentSessionId ? "bg-[#eadbd1]/80" : "hover:bg-white/65"}`}>
                      <button onClick={() => void loadSession(session.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs text-[#4d3c37]"><MessageCircle className="mr-2 inline size-3.5 text-[#9c7866]" />{session.title}</button>
                      <button onClick={() => void renameSession(session)} aria-label="Renombrar" className="hidden rounded p-1.5 text-[#8c7b74] hover:bg-white group-hover:block"><Pencil size={12} /></button>
                      <button onClick={() => void deleteSession(session)} aria-label="Eliminar" className="hidden rounded p-1.5 text-[#a75d58] hover:bg-white group-hover:block"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="px-2 text-[10px] leading-relaxed text-[#a4938d]">Las conversaciones se guardan de forma privada y el modelo solo usa el contexto reciente.</p>
          </div>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[#ebdcd0]/70 bg-white/35 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-2 text-[#7c6960] hover:bg-white" aria-label="Alternar historial">{sidebarOpen ? <ChevronLeft size={19} /> : <Menu size={19} />}</button>
              <div className="relative size-10 overflow-hidden rounded-full ring-2 ring-[#e8d5c8]"><Image src="/mireya.jpg" alt="Mireya" fill sizes="40px" className="object-cover" priority /></div>
              <div>
                <h1 className="font-serif text-xl tracking-wide text-[#342725]">Mireya <span className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-[#9c7866]">AI</span></h1>
                <p className="text-[10px] uppercase tracking-wider text-[#8c7b74]">Biografía viva & mapa de identidad</p>
              </div>
            </div>
            <button onClick={() => setMemoryOpen(true)} className="rounded-full border border-[#e5d3c5] bg-white/70 p-2 text-[#9c7866] hover:bg-white" title="Nuevo recuerdo"><BrainCircuit size={17} /></button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {isLoadingSession ? (
              <div className="grid h-full place-items-center text-sm text-[#8c7b74]">
                <div className="flex items-center gap-3">
                  <div className="relative size-10 overflow-hidden rounded-2xl border border-[#ebd8cc] shadow-sm">
                    <Image src="/bibble.png" alt="Bibble pensando" fill sizes="40px" className="object-cover animate-pulse" />
                  </div>
                  <span>Cargando conversación…</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center sm:py-16">
                <div className="mb-6 grid size-16 place-items-center rounded-2xl border border-[#ebd8cc] bg-white/80 text-[#9c7866]"><BookOpenText size={30} strokeWidth={1.4} /></div>
                <h2 className="font-serif text-3xl text-[#362725]">El mapa de sus ideas y matices.</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[#7c6960]">Explora proyectos, gustos y recuerdos de Mireya.</p>
                <div className="mt-9 grid w-full gap-3 text-left sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion.label} onClick={() => void sendMessage(suggestion.label)} className="rounded-2xl border border-[#ebd8cb] bg-white/60 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white">
                      <span className="mr-2">{suggestion.icon}</span><span className="text-xs font-semibold text-[#9c7866]">{suggestion.title}</span>
                      <p className="mt-1 text-sm text-[#463835]">{suggestion.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {messages.map((message, index) => (
                  <div key={message.id ?? `${message.role}-${index}`} className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`grid size-8 shrink-0 place-items-center overflow-hidden rounded-full ${message.role === "user" ? "bg-[#4a3935] text-white" : "ring-1 ring-[#e4d1c3]"}`}>
                      {message.role === "user" ? <User size={15} /> : <Image src="/mireya.jpg" alt="Mireya" width={32} height={32} className="object-cover" />}
                    </div>
                    <div className={`group relative max-w-[85%] rounded-[1.5rem] px-5 py-4 text-sm leading-relaxed ${message.role === "user" ? "rounded-tr-sm bg-[#4a3935] text-[#f7efe9]" : "rounded-tl-sm border border-[#ebd8cc] bg-white/80 text-[#3d2f2c]"}`}>
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : message.content ? (
                        <>
                          <div className="prose prose-sm prose-stone">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                          </div>
                          <button onClick={() => { void navigator.clipboard.writeText(message.content); setCopiedIndex(index); setTimeout(() => setCopiedIndex(null), 1500); }} className="absolute right-2 top-2 hidden rounded bg-white p-1 text-[#8c7b74] shadow group-hover:block">
                            {copiedIndex === index ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 py-1">
                          <div className="relative size-9 overflow-hidden rounded-xl border border-[#ebd8cc] shadow-sm">
                            <Image src="/bibble.png" alt="Bibble pensando" fill sizes="36px" className="object-cover animate-pulse" />
                          </div>
                          <span className="text-xs font-medium text-[#9c7866] animate-pulse">Bibble está consultando recuerdos…</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
            {error && <p role="alert" className="mx-auto mt-4 max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-xs text-rose-800">{error}</p>}
          </div>

          <footer className="border-t border-[#ebdcd0]/70 bg-white/35 p-4">
            <form onSubmit={(event: FormEvent) => { event.preventDefault(); void sendMessage(); }} className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-2xl border border-[#ebd8cb] bg-white/90 p-2 focus-within:ring-4 focus-within:ring-[#9c7866]/10">
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
                  className="max-h-36 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
                />
                <button type="submit" disabled={!input.trim() || isStreaming || !currentSessionId} className="grid size-10 place-items-center rounded-xl bg-[#4a3935] text-white disabled:bg-[#d6c7be]">
                  <ArrowUp size={18} />
                </button>
              </div>
            </form>
          </footer>
        </section>
      </div>

      {memoryOpen && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-[#342725]/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-[#fffaf6] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl text-[#342725]">Nuevo recuerdo</h2>
                <p className="mt-1 text-sm text-[#7c6960]">Se guardará y estará disponible para futuras conversaciones.</p>
              </div>
              <button onClick={() => setMemoryOpen(false)} className="rounded-full p-2 text-[#7c6960] hover:bg-[#f2e5dc]"><X size={18} /></button>
            </div>
            <textarea
              value={memoryText}
              onChange={(event) => { setMemoryText(event.target.value); setMemoryStatus("idle"); }}
              maxLength={10000}
              rows={7}
              placeholder="Escribe un recuerdo, una anécdota, un gusto o un dato importante…"
              className="mt-5 w-full resize-none rounded-2xl border border-[#dfc9bc] bg-white p-4 text-sm outline-none focus:border-[#9c7866]"
            />
            <div className="mt-4 flex items-center justify-between">
              <span className={`text-xs ${memoryStatus === "error" ? "text-rose-600" : "text-[#8c7b74]"}`}>
                {memoryStatus === "saving" ? "Guardando en el mapa de recuerdos…" : memoryStatus === "saved" ? "¡Recuerdo guardado!" : memoryStatus === "error" ? "No se pudo guardar. Intenta de nuevo." : `${memoryText.length}/10000`}
              </span>
              <button onClick={() => void saveMemory()} disabled={!memoryText.trim() || memoryStatus === "saving"} className="rounded-xl bg-[#4a3935] px-4 py-2.5 text-sm font-medium text-white disabled:bg-[#d6c7be]">
                {memoryStatus === "saving" ? "Guardando…" : "Guardar recuerdo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}