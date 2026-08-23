"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, BookOpenText, Feather, LoaderCircle, Sparkles } from "lucide-react";
import Image from "next/image";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  { icon: "🎵", label: "¿Cuál es su relación con Taylor Swift y Radiohead?" },
  { icon: "🧠", label: "Cuéntame sobre sus proyectos en Psicología y ALTHEA." },
  { icon: "🌸", label: "¿Qué opina sobre Bibble y los K-dramas?" },
  { icon: "🎒", label: "¿Cuáles son sus fijaciones estéticas y de skincare?" },
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
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") onDelta(event.delta);
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

  const sendMessage = async (prompt?: string) => {
    const question = (prompt ?? input).trim();
    if (!question || isStreaming) return;

    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setError("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mireya-ai",
          input: nextMessages.map((message) => ({ role: message.role, content: message.content })),
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
        setMessages((current) => current.map((message, index) =>
          index === current.length - 1 ? { ...message, content: message.content + delta } : message,
        ));
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
      setMessages((current) => current.filter((message, index) => !(index === current.length - 1 && !message.content)));
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

  return (
    <main className="min-h-dvh px-4 py-4 text-ink sm:px-6 sm:py-6">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="relative mx-auto flex min-h-[calc(100dvh-2rem)] max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/65 bg-[#f9f4ed]/65 shadow-paper backdrop-blur-xl sm:min-h-[calc(100dvh-3rem)]">
        <header className="flex items-center justify-between gap-3 border-b border-[#9c7955]/15 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-[#bda6c5]/50 shadow-sm ring-2 ring-[#f4ede4]">
  <Image
    src="/mireya.jpg"
    alt="Foto de Mireya"
    fill
    sizes="48px"
    className="object-cover"
    priority
  />
</div>
            <div className="min-w-0">
              <p className="font-display text-xl leading-none sm:text-2xl">Mireya AI</p>
              <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-[#76696e] sm:text-xs">Biografía & mapa de identidad</p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[#9582a0]/25 bg-white/55 px-3 py-1.5 text-xs text-[#5d4b65] sm:flex">
            <span className="size-1.5 animate-pulse rounded-full bg-[#8b6895]" />
            En línea <span className="text-[#8b7e81]">• Analizando patrones</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-10 sm:py-9">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center py-8 text-center sm:py-14">
              <div className="mb-5 grid size-14 place-items-center rounded-full border border-[#b49571]/25 bg-[#fbf7f1]/90 text-[#b47d2e] shadow-sm"><BookOpenText size={27} strokeWidth={1.5} /></div>
              <p className="font-display text-3xl text-[#40373e] sm:text-4xl">Un universo por descubrir.</p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#72676d]">Pregunta por sus proyectos, sus obsesiones culturales o las ideas que sostienen su forma de mirar el mundo.</p>
              <div className="mt-8 grid w-full gap-2 text-left sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button key={suggestion.label} onClick={() => void sendMessage(suggestion.label)} className="group rounded-2xl border border-[#a99075]/20 bg-white/50 px-4 py-3 text-left text-sm leading-5 text-[#594e53] transition hover:-translate-y-0.5 hover:border-[#a07765]/40 hover:bg-[#fffaf2]/80 hover:shadow-sm">
                    <span className="mr-2">{suggestion.icon}</span>{suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={message.role === "user" ? "ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#c89347] px-4 py-3 text-sm leading-6 text-[#302214] shadow-sm" : "max-w-[94%] rounded-2xl rounded-tl-sm border border-[#bb9874]/20 bg-white/70 px-5 py-4 text-[#403940] shadow-sm backdrop-blur-md"}>
                  {message.role === "assistant" ? (
                    message.content ? <div className="prose prose-sm prose-zinc max-w-none prose-headings:font-display prose-headings:font-normal prose-p:leading-7 prose-li:my-1 prose-strong:text-[#4e3c4f]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>{isStreaming && index === messages.length - 1 && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#826189] align-middle" />}</div> : <LoaderCircle className="animate-spin text-[#8d718f]" size={19} />
                  ) : message.content}
                </article>
              ))}
              <div ref={endRef} />
            </div>
          )}
          {error && <p role="alert" className="mx-auto mt-5 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        </div>

        <form onSubmit={onSubmit} className="border-t border-[#9c7955]/15 bg-[#faf5ef]/45 px-4 py-4 backdrop-blur-lg sm:px-8 sm:py-5">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[#a67a5d]/25 bg-white/70 p-2 shadow-sm focus-within:border-[#81618d]/45 focus-within:ring-4 focus-within:ring-[#bda6c5]/10">
            <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} disabled={isStreaming} rows={1} maxLength={2000} placeholder="Pregúntale al biógrafo sobre Mireya..." className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-[#998d8d] disabled:cursor-not-allowed" />
            <button type="submit" disabled={!input.trim() || isStreaming} aria-label="Enviar mensaje" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#40343f] text-white transition hover:bg-[#765873] disabled:cursor-not-allowed disabled:bg-[#cfc5c1]">
              {isStreaming ? <Sparkles size={18} className="animate-pulse" /> : <ArrowUp size={19} />}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-[#998d8d]">Enter para enviar · Shift + Enter para una nueva línea</p>
        </form>
      </section>
    </main>
  );
}
