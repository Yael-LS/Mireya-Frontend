"use client";

import { FormEvent, useEffect, useState } from "react";
import { Heart, Plus, Trash2, X } from "lucide-react";

type Idea = { id: string; text: string; done: boolean; done_at: string | null; created_at: string };

type Props = {
  onClose: () => void;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};

// Pendientes primero; dentro de cada grupo, las más recientes arriba.
const sortIdeas = (ideas: Idea[]) =>
  [...ideas].sort((a, b) => Number(a.done) - Number(b.done) || b.created_at.localeCompare(a.created_at));

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export default function IdeasBox({ onClose, api }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [justDone, setJustDone] = useState<string | null>(null);

  useEffect(() => {
    api<Idea[]>("ideas")
      .then((data) => setIdeas(sortIdeas(data)))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No pude abrir la caja de ideas."))
      .finally(() => setLoading(false));
    // Solo al abrir la caja: `api` cambia de identidad en cada render del chat.
  }, []);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const created = await api<Idea>("ideas", { method: "POST", ...json({ text }) });
      setIdeas((current) => sortIdeas([created, ...current]));
    } catch (cause) {
      setDraft(text);
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la idea.");
    }
  };

  const toggle = async (idea: Idea) => {
    const done = !idea.done;
    if (done) setJustDone(idea.id);
    setIdeas((current) => sortIdeas(current.map((item) => (item.id === idea.id ? { ...item, done } : item))));
    try {
      await api(`ideas/${idea.id}`, { method: "PATCH", ...json({ done }) });
    } catch {
      setIdeas((current) => sortIdeas(current.map((item) => (item.id === idea.id ? idea : item))));
    }
  };

  const remove = async (idea: Idea) => {
    setIdeas((current) => current.filter((item) => item.id !== idea.id));
    try {
      await api(`ideas/${idea.id}`, { method: "DELETE" });
    } catch {
      setIdeas((current) => sortIdeas([...current, idea]));
    }
  };

  const pending = ideas.filter((idea) => !idea.done).length;
  const done = ideas.length - pending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#381a24]/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ideas-notebook bubble-in" onClick={(event) => event.stopPropagation()}>
        <span aria-hidden="true" className="ideas-spiral" />
        <span aria-hidden="true" className="panel-tape -right-5 top-6 rotate-[38deg]" />

        <header className="flex items-start justify-between gap-3 px-6 pb-2 pt-9 sm:px-8">
          <div>
            <h2 className="font-hand text-[40px] font-semibold leading-none text-[#9e3b56]">caja de ideas</h2>
            <p className="mt-1 text-[13px] text-[#7d4a5a]">lo que te gustaría que tu scrapbook tenga después</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar caja de ideas" className="rounded-full p-2 text-[#8f475a] hover:bg-[#fae6ec]">
            <X size={18} />
          </button>
        </header>

        {ideas.length > 0 && (
          <div className="flex items-center gap-3 px-6 pb-3 sm:px-8">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f6dbe3]">
              <div className="h-full rounded-full bg-[#e98aa5] transition-all duration-500" style={{ width: `${(done / ideas.length) * 100}%` }} />
            </div>
            <span className="shrink-0 font-hand text-lg text-[#9e3b56]">
              {pending} por hacer · {done} {done === 1 ? "hecha" : "hechas"}
            </span>
          </div>
        )}

        <ul className="ideas-paper">
          {loading ? (
            <li className="idea-row animate-pulse text-[#b07d8d]">abriendo tu libreta…</li>
          ) : ideas.length === 0 ? (
            <li className="idea-row text-[#b07d8d]">aún no hay ideas… ¿qué te gustaría ver aquí?</li>
          ) : (
            ideas.map((idea) => (
              <li key={idea.id} className={`idea-row group ${idea.done ? "is-done" : ""}`}>
                <button
                  type="button"
                  onClick={() => void toggle(idea)}
                  className={`idea-check ${justDone === idea.id && idea.done ? "is-popping" : ""}`}
                  aria-label={idea.done ? `Marcar «${idea.text}» como pendiente` : `Marcar «${idea.text}» como hecha`}
                  aria-pressed={idea.done}
                >
                  <Heart size={20} strokeWidth={1.8} fill={idea.done ? "currentColor" : "none"} />
                </button>
                <span className="idea-text">{idea.text}</span>
                {idea.done && <span className="idea-stamp">¡hecho!</span>}
                <button type="button" onClick={() => void remove(idea)} className="idea-delete" aria-label={`Borrar «${idea.text}»`}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={add} className="flex items-center gap-2 border-t border-[#f3d3dc] px-5 py-4 sm:px-7">
          <label htmlFor="new-idea" className="sr-only">
            Nueva idea
          </label>
          <input
            id="new-idea"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
            maxLength={300}
            placeholder="anota una idea…"
            className="min-w-0 flex-1 bg-transparent font-hand text-[22px] text-[#4a2230] placeholder-[#c98a9b] outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Guardar idea"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#4a2230] text-[#fff3f6] transition hover:bg-[#3d1d27] disabled:bg-[#edd0d7]"
          >
            <Plus size={18} />
          </button>
        </form>
        {error && <p className="px-6 pb-4 text-xs text-rose-600 sm:px-8">{error}</p>}
      </div>
    </div>
  );
}
