"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, BookOpenText, Check, Copy, RefreshCw, Sparkles, User } from "lucide-react";
import Image from "next/image";
import confetti from "canvas-confetti";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  { icon: "🎵", title: "Música & Melancolía", label: "¿Cuál es su relación con Taylor Swift y Radiohead?" },
  { icon: "🧠", title: "Psicología & Negocios", label: "Cuéntame sobre sus proyectos en Psicología y ALTHEA." },
  { icon: "🌸", title: "Cultura Pop & K-dramas", label: "¿Qué opina sobre Bibble y los K-dramas?" },
  { icon: "✨", title: "Estética & Cuidado", label: "¿Cuáles son sus fijaciones estéticas y de skincare?" },
];

function triggerEasterEgg(fullAccumulatedText: string, triggeredSet: Set<string>) {
  const t = fullAccumulatedText.toLowerCase();

  if ((t.includes("taylor") || t.includes("swift") || t.includes("swifty") || t.includes("swiftie")) && !triggeredSet.has("taylor")) {
    triggeredSet.add("taylor");
    confetti({
      particleCount: 50,
      spread: 75,
      startVelocity: 35,
      origin: { y: 0.8 },
      colors: ["#D4AF37", "#F3E5AB", "#FAF0E6", "#C5A059"],
      shapes: ["circle", "square"],
      scalar: 0.9,
    });
  }

  if ((t.includes("bibble") || t.includes("bible") || t.includes("fairytopia") || t.includes("barbie")) && !triggeredSet.has("bibble")) {
    triggeredSet.add("bibble");
    confetti({
      particleCount: 55,
      spread: 85,
      startVelocity: 38,
      origin: { y: 0.8 },
      colors: ["#E8AEB7", "#B8E1FF", "#D8BBFF", "#E7C6FF"],
      shapes: ["circle"],
      scalar: 1.1,
    });
  }

  if ((t.includes("skincare") || t.includes("piel") || t.includes("estétic") || t.includes("estetic")) && !triggeredSet.has("skincare")) {
    triggeredSet.add("skincare");
    confetti({
      particleCount: 35,
      spread: 55,
      startVelocity: 30,
      origin: { y: 0.8 },
      colors: ["#FFD6BA", "#FFE5D9", "#FFF1E6"],
      scalar: 0.85,
    });
  }

  if (t.includes("althea") && !triggeredSet.has("althea")) {
    triggeredSet.add("althea");
    confetti({
      particleCount: 35,
      spread: 60,
      startVelocity: 32,
      origin: { y: 0.8 },
      colors: ["#9C7866", "#CBB3A3", "#FAF6F0"],
      scalar: 0.85,
    });
  }
}

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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggeredEasterEggs = useRef<Set<string>>(new Set());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  };

  const sendMessage = async (prompt?: string) => {
    const question = (prompt ?? input).trim();
    if (!question || isStreaming) return;

    triggerEasterEgg(question, triggeredEasterEggs.current);

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
      let accumulatedResponse = "";

      const appendDelta = (delta: string) => {
        accumulatedResponse += delta;
        triggerEasterEgg(accumulatedResponse, triggeredEasterEggs.current);

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
    triggeredEasterEggs.current.clear();
  };

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center p-2 sm:p-5 lg:p-7 selection:bg-[#d8c2b5]/50 transition-all duration-700"
      style={{
        background: isStreaming
          ? "radial-gradient(ellipse at top, #fae6d8 0%, #f3dfd5 50%, #eae0d5 100%)"
          : "radial-gradient(ellipse at top, #fbf7f2 0%, #f6eee5 50%, #ede3d8 100%)",
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -top-[15%] -left-[10%] h-[550px] w-[550px] rounded-full blur-[100px] transition-all duration-700 ${
            isStreaming ? "scale-150 bg-[#ffcbb3]/90 opacity-100" : "scale-100 bg-[#f3e5d8]/70 opacity-60"
          }`}
        />
        <div
          className={`absolute top-[30%] -right-[15%] h-[520px] w-[520px] rounded-full blur-[110px] transition-all duration-700 ${
            isStreaming ? "scale-150 bg-[#e3b8ff]/80 opacity-100" : "scale-100 bg-[#ebdcd6]/60 opacity-60"
          }`}
        />
      </div>

      <section
        className={`relative flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border backdrop-blur-2xl transition-all duration-500 ${
          isStreaming
            ? "border-[#d8a88a] bg-white/85 shadow-[0_0_40px_rgba(216,168,138,0.35)]"
            : "border-white/70 bg-[#faf6f0]/75 shadow-[0_24px_60px_-15px_rgba(80,50,40,0.12)]"
        }`}
      >
        <header className="z-10 flex items-center justify-between border-b border-[#ebdcd0]/70 bg-white/40 px-6 py-4 backdrop-blur-md sm:px-9 hover:border-[#cbb3a3] transition-colors">
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
            <div
              className={`hidden sm:flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300 ${
                isStreaming
                  ? "border-[#c49275] bg-[#fff5ee] text-[#844c27] shadow-sm"
                  : "border-[#e5d3c5] bg-white/70 text-[#6e584f]"
              }`}
            >
              <span className={`size-2 rounded-full ${isStreaming ? "animate-ping bg-[#c49275]" : "animate-pulse bg-[#9c7866]"}`} />
              {isStreaming ? "Analizando y escribiendo..." : "Conexión activa"}
            </div>
            {messages.length > 0 && (
              <button
                onClick={resetChat}
                title="Reiniciar conversación"
                className="grid size-9 place-items-center rounded-full border border-[#ebdcd0] bg-white/60 text-[#7c6960] transition hover:bg-white hover:text-[#342725] hover:shadow-sm hover:border-[#cbb3a3]"
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-6 text-center sm:py-12 animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-6 grid size-16 place-items-center rounded-2xl border border-[#ebd8cc] bg-gradient-to-b from-white/90 to-[#fcf8f5]/80 text-[#9c7866] shadow-[0_8px_20px_-6px_rgba(156,120,102,0.25)]">
                <BookOpenText size={30} strokeWidth={1.4} />
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#362725] tracking-tight">
                El mapa de sus ideas y matices.
              </h2>
              <p className="mt-3.5 max-w-md text-sm leading-relaxed text-[#7c6960] font-light">
                Un espacio interactivo para explorar sus proyectos profesionales, gustos estéticos y la perspectiva única con la que construye su mundo.
              </p>

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
                    className={`group/msg relative flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} animate-in fade-in duration-300`}
                  >
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

                    <div
                      className={`relative max-w-[85%] rounded-[1.6rem] px-5 py-4 text-sm leading-relaxed transition-all ${
                        isUser
                          ? "rounded-tr-xs bg-[#4a3935] text-[#f7efe9] shadow-md font-sans"
                          : "rounded-tl-xs border border-[#ebd8cc]/70 bg-white/80 text-[#3d2f2c] shadow-sm backdrop-blur-md"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : message.content ? (
                        <>
                          <div className="prose prose-sm prose-stone max-w-none 
                            prose-headings:font-serif prose-headings:font-medium prose-headings:text-[#1c1917] prose-headings:tracking-tight
                            prose-p:font-serif prose-p:font-light prose-p:text-[#44403c] prose-p:leading-relaxed prose-p:mb-4
                            prose-strong:font-semibold prose-strong:text-[#1c1917]
                            prose-ul:list-disc prose-ul:marker:text-[#c49275] prose-ul:font-serif prose-ul:font-light
                            prose-ol:list-decimal prose-ol:marker:text-[#c49275] prose-ol:font-serif prose-ol:font-light
                            prose-li:my-1
                          ">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                            {isStreaming && index === messages.length - 1 && (
                              <span className="inline-block size-2 animate-ping rounded-full bg-[#c49275] ml-1.5 align-middle" />
                            )}
                          </div>

                          <button
                            onClick={() => copyToClipboard(message.content, index)}
                            title="Copiar texto"
                            className="absolute right-3 top-3 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 rounded-lg border border-[#ebd8cc] bg-white/80 p-1.5 text-[#8c7b74] hover:bg-white hover:text-[#342725] hover:border-[#cbb3a3] shadow-xs"
                          >
                            {copiedIndex === index ? (
                              <Check size={13} className="text-emerald-600 animate-in zoom-in-50 duration-150" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </>
                      ) : (
                        /* Estado de Carga con Bibble Integrado */
                        <div className="flex items-center gap-3 py-1 pr-2 animate-in fade-in zoom-in-95 duration-300">
                          <div className="relative size-11 shrink-0 overflow-hidden rounded-2xl border border-[#e8d2c2] shadow-sm ring-2 ring-white/80">
                            <Image
                              src="/bibble.png"
                              alt="Bibble pensando"
                              fill
                              sizes="44px"
                              className="object-cover animate-pulse"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9c7866]">
                                Consultando archivos...
                              </span>
                              <Sparkles size={12} className="animate-spin text-[#c49275]" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-[#c49275] animate-bounce [animation-delay:-0.3s]" />
                              <span className="size-1.5 rounded-full bg-[#c49275] animate-bounce [animation-delay:-0.15s]" />
                              <span className="size-1.5 rounded-full bg-[#c49275] animate-bounce" />
                            </div>
                          </div>
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

        <footer className="border-t border-[#ebdcd0]/70 bg-white/40 p-4 sm:p-5 backdrop-blur-lg hover:border-[#cbb3a3] transition-colors">
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
                className="max-h-36 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-5 text-[#3d2f2c] placeholder:text-[#ab9c96] outline-none disabled:cursor-not-allowed font-sans"
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