"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, BookOpenText, RefreshCw, Sparkles, User } from "lucide-react";
import Image from "next/image";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  { icon: "🎵", title: "Música & Melancolía", label: "¿Cuál es su relación con Taylor Swift y Radiohead?" },
  { icon: "🧠", title: "Psicología & Negocios", label: "Cuéntame sobre sus proyectos en Psicología y ALTHEA." },
  { icon: "🌸", title: "Cultura Pop & K-dramas", label: "¿Qué opina sobre Bibble y los K-dramas?" },
  { icon: "✨", title: "Estética & Cuidado", label: "¿Cuáles son sus fijaciones estéticas y de skincare?" },
];

function parseSse(chunk: string, onDelta: (delta: string) => void) {
  for (const eventBlock of chunk.split("\n\n")) {
    const data = eventBlock
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (!data) continue;
    try {
      const event = JSON.parse(data);
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        onDelta(event.delta);
      }
      if (event.type === "error") throw new Error(event.message ?? "El agente no pudo responder.");
    } catch (error) {
      if (error instanceof Error && error.message !== "Unexpected end of JSON input") throw error;
    }
  }
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  // Auto-resize dinámico para el textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const sendMessage = async (prompt?: string) => {
    const question = (prompt ?? input).trim();
    if (!question || isStreaming) return;

    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setError("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mireya-ai",
          input: nextMessages.map((msg) => ({ role: msg.role, content: msg.content })),
          stream: true,
          store: false,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "No se pudo iniciar la conversación.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const appendDelta = (delta: string) => {
        setMessages((current) =>
          current.map((msg, index) =>
            index === current.length - 1 ? { ...msg, content: msg.content + delta } : msg,
          ),
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        events.forEach((event) => parseSse(event, appendDelta));
        if (done) break;
      }
      if (buffer.trim()) parseSse(buffer, appendDelta);
    } catch (streamError) {
      const message = streamError instanceof Error ? streamError.message : "Hubo un problema inesperado.";
      setError(message);
      setMessages((current) =>
        current.filter((msg, index) => !(index === current.length - 1 && !msg.content)),
      );
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const resetChat = () => {
    if (isStreaming) return;
    setMessages([]);
    setError("");
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center p-2 sm:p-5 lg:p-7 selection:bg-[#d8c2b5]/50">
      {/* Luces de ambiente etéreas */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[550px] w-[550px] rounded-full bg-[#f2e6dc]/80 blur-[120px]" />
        <div className="absolute top-[35%] -right-[15%] h-[500px] w-[500px] rounded-full bg-[#ebdcd6]/70 blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[20%] h-[600px] w-[600px] rounded-full bg-[#faefe8]/90 blur-[130px]" />
      </div>

      {/* Contenedor Principal */}
      <section className="relative flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-white/70 bg-[#faf6f0]/75 shadow-[0_24px_60px_-15px_rgba(80,50,40,0.12)] backdrop-blur-2xl transition-all duration-300">
        
        {/* Header Glassmorphic */}
        <header className="z-10 flex items-center justify-between border-b border-[#ebdcd0]/70 bg-white/40 px-6 py-4 backdrop-blur-md sm:px-9">
          <div className="flex items-center gap-4">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-full ring-2 ring-[#e8d5c8] shadow-inner transition-transform duration-300 hover:scale-105">
              <Image
                src="/mireya.jpg"
                alt="Retrato de Mireya"
                fill
                sizes="48px"
                className="object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="font-serif text-xl font-normal tracking-wide text-[#342725] sm:text-2xl">
                Mireya <span className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-[#9c7866] ml-1">AI</span>
              </h1>
              <p className="text-[11px] font-medium tracking-wider uppercase text-[#8c7b74]">
                Biografía viva & Mapa de identidad
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#e5d3c5] bg-white/70 px-3.5 py-1.5 text-xs font-medium text-[#6e584f] shadow-sm backdrop-blur-sm">
              <span className="size-2 animate-pulse rounded-full bg-[#9c7866]" />
              Conexión activa
            </div>
            {messages.length > 0 && (
              <button
                onClick={resetChat}
                title="Reiniciar conversación"
                className="grid size-9 place-items-center rounded-full border border-[#ebdcd0] bg-white/60 text-[#7c6960] transition hover:bg-white hover:text-[#342725] hover:shadow-sm"
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </header>

        {/* Zona de Chat */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-6 text-center sm:py-12 animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-6 grid size-16 place-items-center rounded-2xl border border-[#ebd8cc] bg-gradient-to-b from-white/90 to-[#fcf8f5]/80 text-[#9c7866] shadow-[0_8px_20px_-6px_rgba(156,120,102,0.25)]">
                <BookOpenText size={30} strokeWidth={1.4} />
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#362725] tracking-tight">
                El mapa de sus ideas y matices.
              </h2>
              <p className="mt-3.5 max-w-md text-sm leading-relaxed text-[#7c6960]">
                Un espacio interactivo para explorar sus proyectos profesionales, gustos estéticos y la perspectiva única con la que construye su mundo.
              </p>

              {/* Tarjetas de Sugerencias */}
              <div className="mt-9 grid w-full gap-3 text-left sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    onClick={() => void sendMessage(suggestion.label)}
                    className="group relative overflow-hidden rounded-2xl border border-[#ebd8cb]/80 bg-white/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#cbb3a3] hover:bg-white/90 hover:shadow-[0_10px_25px_-8px_rgba(140,110,95,0.18)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0 p-1.5 rounded-xl bg-[#faefe8] group-hover:scale-110 transition-transform duration-300">
                        {suggestion.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-wider uppercase text-[#9c7866]">
                          {suggestion.title}
                        </p>
                        <p className="mt-0.5 text-xs sm:text-sm font-medium text-[#463835] leading-snug">
                          {suggestion.label}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} animate-in fade-in duration-300`}
                  >
                    {/* Avatar de la burbuja */}
                    {isUser ? (
                      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#4a3935] text-white text-xs shadow-sm">
                        <User size={15} />
                      </div>
                    ) : (
                      <div className="relative size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-[#e4d1c3] shadow-sm">
                        <Image
                          src="/mireya.jpg"
                          alt="Mireya"
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      </div>
                    )}

                    {/* Contenido de la burbuja */}
                    <div
                      className={`relative max-w-[85%] rounded-[1.6rem] px-5 py-4 text-sm leading-relaxed transition-all ${
                        isUser
                          ? "rounded-tr-xs bg-[#4a3935] text-[#f7efe9] shadow-md"
                          : "rounded-tl-xs border border-[#ebd8cc]/70 bg-white/80 text-[#3d2f2c] shadow-sm backdrop-blur-md"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : message.content ? (
                        <div className="prose prose-sm prose-stone max-w-none prose-p:leading-7 prose-li:my-1 prose-headings:font-serif prose-headings:font-normal prose-headings:text-[#362725] prose-strong:font-semibold prose-strong:text-[#422e2b]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                          {isStreaming && index === messages.length - 1 && (
                            <span className="inline-block size-2 animate-ping rounded-full bg-[#9c7866] ml-1.5 align-middle" />
                          )}
                        </div>
                      ) : (
                        /* Typing indicator animado */
                        <div className="flex items-center gap-1.5 py-1 px-1">
                          <span className="size-2 rounded-full bg-[#9c7866]/60 animate-bounce [animation-delay:-0.3s]" />
                          <span className="size-2 rounded-full bg-[#9c7866]/60 animate-bounce [animation-delay:-0.15s]" />
                          <span className="size-2 rounded-full bg-[#9c7866]/60 animate-bounce" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mx-auto mt-4 max-w-2xl rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-center text-xs font-medium text-rose-800 backdrop-blur-sm"
            >
              {error}
            </div>
          )}
        </div>

        {/* Input Bar Flotante */}
        <footer className="border-t border-[#ebdcd0]/70 bg-white/40 p-4 sm:p-5 backdrop-blur-lg">
          <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
            <div className="relative flex items-end gap-2 rounded-2xl border border-[#ebd8cb] bg-white/90 p-2 shadow-[0_6px_20px_-6px_rgba(140,110,95,0.08)] transition-all focus-within:border-[#9c7866] focus-within:ring-4 focus-within:ring-[#9c7866]/10">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={onKeyDown}
                disabled={isStreaming}
                rows={1}
                maxLength={2000}
                placeholder="Pregúntale al biógrafo sobre Mireya..."
                className="max-h-36 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-5 text-[#3d2f2c] placeholder:text-[#ab9c96] outline-none disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                aria-label="Enviar mensaje"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#4a3935] text-white shadow-sm transition-all hover:bg-[#342725] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-[#d6c7be] disabled:hover:scale-100"
              >
                {isStreaming ? (
                  <Sparkles size={17} className="animate-spin text-[#e8d5c8]" />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.2} />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] tracking-wide uppercase text-[#a4938d]">
              Presiona <kbd className="rounded bg-white/70 px-1 py-0.5 font-sans shadow-xs">Enter</kbd> para enviar · <kbd className="rounded bg-white/70 px-1 py-0.5 font-sans shadow-xs">Shift + Enter</kbd> para salto de línea
            </p>
          </form>
        </footer>
      </section>
    </main>
  );
}