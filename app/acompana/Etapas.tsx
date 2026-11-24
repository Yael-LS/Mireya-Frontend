"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Plus, Sparkles, X } from "lucide-react";
import type { Api, Companion, MonthNote, Pick, PickKind, Show, Song } from "./types";
import { KIND_LABELS, MOODS, json, monthKey, monthName, moodLabel, periodStart, shortDate } from "./types";
import { chatAbout } from "./shared";

function Cover({ song, className = "" }: { song: Song; className?: string }) {
  return song.cover_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={song.cover_url} alt={`Portada de ${song.title}`} className={`acm-cover ${className}`} />
  ) : (
    <span className={`acm-cover acm-cover-empty ${className}`} aria-hidden="true" />
  );
}

function weeksOf(key: string, todayIso: string) {
  const current = periodStart("week", todayIso);
  const day = new Date(`${key}-01T12:00:00Z`);
  while (day.getUTCDay() !== 1) day.setUTCDate(day.getUTCDate() + 1);
  const weeks: string[] = [];
  while (day.toISOString().slice(0, 7) === key && day.toISOString().slice(0, 10) <= current) {
    weeks.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 7);
  }
  return weeks;
}

type Slot = { kind: PickKind; period: string; label: string; current: string | null };

function PickSong({ api, data, slot, monthOf, onClose, onPicks }: { api: Api; data: Companion; slot: Slot; monthOf: string; onClose: () => void; onPicks: (picks: Pick[]) => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Primero las que agregó ese mes; luego las demás.
  const songs = [...data.songs].sort((a, b) => Number(monthKey(b.created_at) === monthOf) - Number(monthKey(a.created_at) === monthOf));
  const choose = async (song: Song) => {
    setSaving(song.id);
    setError("");
    try {
      const result = await api<{ kind: PickKind; period: string; song_id: string | null }>("acompana/picks", { method: "POST", ...json({ kind: slot.kind, song_id: song.id, period: slot.period }) });
      const others = data.picks.filter((p) => !(p.kind === result.kind && p.period === result.period));
      onPicks(result.song_id ? [{ kind: result.kind, period: result.period, song_id: result.song_id }, ...others] : others);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
      setSaving(null);
    }
  };
  return (
    <div className="acm-overlay" onClick={onClose}>
      <section aria-label={slot.label} className="acm-sheet bubble-in" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 className="font-hand text-[34px] font-semibold leading-none text-[#9e3b56]">{slot.label}</h2>
            <p className="mt-1 text-[13px] text-[#7d4a5a]">{slot.current ? "toca otra para cambiarla, o la misma para quitarla" : "elige entre las canciones de tu playlist"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2.5 text-[#8f475a] hover:bg-[#fae6ec]">
            <X size={18} />
          </button>
        </header>
        <div className="acm-scroll mt-3 px-4 pb-5">
          {error && <p className="py-2 text-center text-sm text-rose-700">{error}</p>}
          <ul className="space-y-1.5">
            {songs.map((song) => (
              <li key={song.id}>
                <button type="button" disabled={Boolean(saving)} onClick={() => void choose(song)} aria-pressed={slot.current === song.id} className={`acm-result ${slot.current === song.id ? "bg-[#fde9ee]" : ""}`}>
                  <Cover song={song} className="size-14 shrink-0" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-medium text-[#421f2b]">{song.title}</span>
                    <span className="block truncate text-xs text-[#7d4a5a]">
                      {song.artist} · agregada el {shortDate(song.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 font-hand text-lg text-[#9e3b56]">{saving === song.id ? "guardando…" : slot.current === song.id ? "quitar" : "elegir"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// El mes `back` meses antes del actual, como "2026-10". Hacia atrás no hay límite.
function monthBefore(todayIso: string, back: number) {
  const [year, month] = todayIso.slice(0, 7).split("-").map(Number);
  const total = year * 12 + (month - 1) - back;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function Etapas({ api, data, onOpenSong, onOpenShow, onMonth, onPicks }: { api: Api; data: Companion; onOpenSong: (song: Song) => void; onOpenShow: (show: Show) => void; onMonth: (note: MonthNote) => void; onPicks: (picks: Pick[]) => void }) {
  // 0 = el mes actual; cada «mes anterior» suma uno.
  const [back, setBack] = useState(0);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const key = monthBefore(data.today, back);
  const songOf = (id: string) => data.songs.find((s) => s.id === id);

  const monthPick = data.picks.find((p) => p.kind === "month" && p.period.startsWith(key));
  const monthSong = monthPick ? songOf(monthPick.song_id) : undefined;
  const weeks = data.picks.filter((p) => p.kind === "week" && p.period.startsWith(key)).sort((a, b) => a.period.localeCompare(b.period));
  const songs = data.songs.filter((s) => monthKey(s.created_at) === key);
  const moods = MOODS.map((m) => ({ ...m, n: songs.filter((s) => s.mood === m.id).length })).filter((m) => m.n);
  const shows = data.series
    .map((show) => ({ show, seen: show.episodes.filter((e) => monthKey(e.watched_at) === key).length, finished: show.finished_at?.startsWith(key) ?? false }))
    .filter((x) => x.seen || x.finished);
  const note = data.months.find((m) => m.month.startsWith(key));

  const summaryOf = () => {
    const lines = [];
    if (monthSong) lines.push(`Canción del mes: «${monthSong.title}» de ${monthSong.artist}${moodLabel(monthSong) ? ` (${moodLabel(monthSong)})` : ""}.`);
    weeks.forEach((w, i) => {
      const song = songOf(w.song_id);
      if (song) lines.push(`Semana ${i + 1}: «${song.title}» de ${song.artist}${moodLabel(song) ? ` (${moodLabel(song)})` : ""}.`);
    });
    songs.forEach((s) => lines.push(`Agregó «${s.title}» de ${s.artist}${moodLabel(s) ? `: ${moodLabel(s)}` : ""}${s.share && s.note ? `. Escribió: ${s.note.slice(0, 200)}` : ""}.`));
    shows.forEach(({ show, seen, finished }) => lines.push(`${show.title} (${KIND_LABELS[show.kind] ?? "serie"}): vio ${seen} episodios${finished ? `, la terminó${show.rating ? ` y le dio ${show.rating} de 5 corazones` : ""}` : ""}.`));
    return lines.join("\n");
  };

  const askSummary = async () => {
    const text = summaryOf();
    if (!text) return;
    setWriting(true);
    setError("");
    try {
      onMonth(await api<MonthNote>(`acompana/months/${key}-01`, { method: "POST", ...json({ summary_of: text }) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo escribir el resumen.");
    } finally {
      setWriting(false);
    }
  };

  const monthWord = monthName(key).split(" ")[0];
  const weekSlots = weeksOf(key, data.today);
  // Sin ninguna canción en la playlist no hay nada que elegir: ese sí es un mes en blanco.
  const empty = !data.songs.length && !shows.length;

  return (
    <div>
      <div className="flex items-center justify-center gap-3 sm:justify-start">
        <button type="button" aria-label="Mes anterior" onClick={() => setBack(back + 1)} className="acm-round">
          <ChevronLeft size={17} />
        </button>
        <h2 className="min-w-0 text-center font-hand text-[44px] font-semibold leading-none text-[#9e3b56] sm:text-[56px]">{monthName(key)}</h2>
        <button type="button" aria-label="Mes siguiente" disabled={back === 0} onClick={() => setBack(back - 1)} className="acm-round">
          <ChevronRight size={17} />
        </button>
      </div>

      {empty ? (
        <div className="acm-empty mt-8">
          <p className="font-hand text-3xl text-[#9e3b56]">este mes todavía está en blanco</p>
          <p className="mt-1 text-sm text-[#7d4a5a]">las canciones que agregues y los capítulos que veas aparecen aquí</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-7 lg:grid-cols-[1.25fr_1fr]">
          <section aria-label="La música del mes" className="acm-card -rotate-[.3deg] p-5 sm:p-6">
            {monthSong ? (
              <button type="button" onClick={() => onOpenSong(monthSong)} className="flex w-full flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                <span className="acm-polaroid !p-2 !pb-6">
                  <Cover song={monthSong} className="size-32" />
                </span>
                <span>
                  <span className="block font-hand text-xl text-[#3a6ea5]">la canción de {monthName(key).split(" ")[0]}</span>
                  <span className="acm-ttl block text-[36px]">{monthSong.title}</span>
                  <span className="block text-[13px] text-[#7d4a5a]">
                    {monthSong.artist}
                    {moodLabel(monthSong) ? ` · ${moodLabel(monthSong)}` : ""}
                  </span>
                </span>
              </button>
            ) : (
              <button type="button" onClick={() => setSlot({ kind: "month", period: `${key}-01`, label: `la canción de ${monthWord}`, current: null })} className="acm-slot w-full !min-h-28">
                <Plus size={18} />
                <span className="font-hand text-2xl">elige la canción de {monthWord}</span>
              </button>
            )}
            {monthSong && (
              <button type="button" onClick={() => setSlot({ kind: "month", period: `${key}-01`, label: `la canción de ${monthWord}`, current: monthSong.id })} className="acm-change mt-2">
                <Pencil size={13} /> cambiar la canción de {monthWord}
              </button>
            )}
            {weekSlots.length > 0 && (
              <>
                <h3 className="acm-h3 mt-6">las de cada semana</h3>
                <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {weekSlots.map((monday) => {
                    const pick = weeks.find((w) => w.period === monday);
                    const song = pick ? songOf(pick.song_id) : undefined;
                    const label = `la canción de la semana del ${shortDate(monday)}`;
                    return song ? (
                      <div key={monday} className="acm-week">
                        <button type="button" onClick={() => onOpenSong(song)} className="flex flex-col gap-1 text-left">
                          <span className="font-hand text-[17px] text-[#9e3b56]">semana del {shortDate(monday)}</span>
                          <b>{song.title}</b>
                          <small>{moodLabel(song) ?? song.artist}</small>
                        </button>
                        <button type="button" onClick={() => setSlot({ kind: "week", period: monday, label, current: song.id })} className="acm-change" aria-label={`Cambiar ${label}`}>
                          <Pencil size={12} /> cambiar
                        </button>
                      </div>
                    ) : (
                      <button key={monday} type="button" onClick={() => setSlot({ kind: "week", period: monday, label, current: null })} className="acm-slot">
                        <span className="font-hand text-[17px]">semana del {shortDate(monday)}</span>
                        <span className="inline-flex items-center gap-1 text-[12px]">
                          <Plus size={13} /> elegir
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {songs.length > 0 && (
              <p className="mt-5 text-[12.5px] text-[#7d4a5a]">
                {songs.length} {songs.length === 1 ? "canción" : "canciones"} este mes{moods.length ? " · " + moods.map((m) => `«${m.label}» ${m.n}`).join(", ") : ""}
              </p>
            )}
          </section>

          <section aria-label="Lo que veía" className="acm-card rotate-[.3deg] p-5 sm:p-6">
            <h3 className="font-hand text-[26px] font-semibold text-[#9e3b56]">lo que veía</h3>
            {shows.length ? (
              <ul>
                {shows.map(({ show, seen, finished }) => (
                  <li key={show.id}>
                    <button type="button" onClick={() => onOpenShow(show)} className="acm-row">
                      {show.poster_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={show.poster_url} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="acm-cover-empty h-14 w-10 shrink-0 rounded" />
                      )}
                      <span className="min-w-0 text-left">
                        <b className="block truncate">{show.title}</b>
                        <small>
                          {finished ? `la terminó el ${shortDate(show.finished_at!)}${show.rating ? ` · ${"♥".repeat(show.rating)}` : ""}` : "viendo"}
                          {seen ? ` · ${seen} ${seen === 1 ? "episodio" : "episodios"} este mes` : ""}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#7d4a5a]">este mes no registraste series</p>
            )}

            <div className="acm-biographer mt-5">
              <p className="font-hand text-[19px] text-[#f7a8bf]">el biógrafo lo recuerda así</p>
              {note ? (
                <p className="mt-1 text-[13.5px] leading-relaxed">{note.summary}</p>
              ) : (
                <p className="mt-1 text-[13px] text-[#ffdfe8]">todavía no escribe nada de este mes.</p>
              )}
              {error && <p className="mt-1 text-[12px] text-[#ffc2d3]">{error}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={writing} onClick={() => void askSummary()} className="acm-bio-btn">
                  <Sparkles size={14} /> {writing ? "escribiendo…" : note ? "que lo vuelva a contar" : "pídele que lo cuente"}
                </button>
                <button type="button" onClick={() => chatAbout({ title: monthName(key), prompt: `¿Qué me acompañó en ${monthName(key)}? Platiquemos de las canciones y series de ese mes.`, mode: "normal" })} className="acm-bio-btn">
                  <MessageCircle size={14} /> platicar de este mes en el chat
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {slot && <PickSong api={api} data={data} slot={slot} monthOf={key} onClose={() => setSlot(null)} onPicks={onPicks} />}
    </div>
  );
}
