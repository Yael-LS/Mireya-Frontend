"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Plus, Sparkles } from "lucide-react";
import type { Api, Companion, MonthNote, Pick, Show, Song } from "./types";
import { KIND_LABELS, MOODS, json, monthKey, monthName, moodLabel, periodStart, shortDate } from "./types";
import { Art, Disc, chatAbout } from "./shared";
import { ChooseSong } from "./Songs";
import { WEEKDAYS, monthCells, monthOf } from "../components/MemoryDatePicker";
import type { PickSlot } from "./Songs";

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

// El mes `back` meses antes del actual, como "2026-10". Hacia atrás no hay límite.
function monthBefore(todayIso: string, back: number) {
  const [year, month] = todayIso.slice(0, 7).split("-").map(Number);
  const total = year * 12 + (month - 1) - back;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const dayName = (iso: string) => DAY_NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// La canción de cada día del mes: un disquito por día, y al tocarlo su tarjeta abajo.
function DayCalendar({ data, monthKey: key, onOpenSong, onChoose }: { data: Companion; monthKey: string; onOpenSong: (song: Song) => void; onChoose: (day: string) => void }) {
  const picks = new Map(data.picks.filter((p) => p.kind === "day" && p.period.startsWith(key)).map((p) => [p.period, p.song_id]));
  const songOf = (id: string | undefined) => (id ? data.songs.find((s) => s.id === id) : undefined);
  const pickedDays = [...picks.keys()].filter((day) => songOf(picks.get(day))).sort();
  // Al abrir: hoy si es este mes; si no, el último día que tiene canción.
  const fallback = data.today.startsWith(key) ? data.today : (pickedDays[pickedDays.length - 1] ?? null);
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen?.startsWith(key) ? chosen : fallback;
  const song = selected ? songOf(picks.get(selected)) : undefined;

  // La que más se repitió, solo si se repitió.
  const counts = new Map<string, number>();
  pickedDays.forEach((day) => counts.set(picks.get(day)!, (counts.get(picks.get(day)!) ?? 0) + 1));
  const [topId, topN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
  const top = topN > 1 ? songOf(topId) : undefined;
  const label = (day: string) => `${day === data.today ? "hoy, " : ""}${dayName(day)} ${Number(day.slice(8, 10))}`;

  return (
    <section aria-label="La canción de cada día">
      <div className="sec">
        <h2>cada día</h2>
        <i />
      </div>
      <p className="-mt-1 mb-3 text-[12.5px] text-[var(--cream-soft)]">
        {pickedDays.length ? `${pickedDays.length} ${pickedDays.length === 1 ? "día" : "días"} con canción` : "todavía no eliges ninguna canción del día este mes"}
        {top ? ` · la que más se repitió: «${top.title}» (${topN} días)` : ""}
      </p>
      <div className="cal-box">
        <div className="cal mb-1" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day} className="cal-wd">
              {day}
            </span>
          ))}
        </div>
        <div className="cal">
          {monthCells(monthOf(`${key}-01`)).map((cell) => {
            const daySong = cell.inMonth ? songOf(picks.get(cell.key)) : undefined;
            return (
              <button
                key={cell.key}
                type="button"
                disabled={!cell.inMonth || cell.key > data.today}
                onClick={() => setChosen(cell.key)}
                aria-pressed={cell.inMonth && cell.key === selected}
                aria-label={`${cell.day}${daySong ? `: ${daySong.title}` : ", sin canción"}`}
                className={`cd ${cell.inMonth ? "" : "is-out"} ${cell.key === data.today ? "is-today" : ""}`}
              >
                {daySong ? <Disc src={daySong.cover_url} /> : <span className="cd-dot" />}
                <span>{cell.day}</span>
              </button>
            );
          })}
        </div>
      </div>
      {selected &&
        (song ? (
          <div className="day-card">
            <Disc src={song.cover_url} spin />
            <div className="min-w-0">
              <p className="hand text-lg text-[var(--amber)]">{label(selected)}</p>
              <p className="disp truncate text-[22px] leading-tight">{song.title}</p>
              <p className="text-[11.5px] text-[var(--cream-dim)]">{song.artist}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onOpenSong(song)} className="btn btn-cream btn-sm">
                  abrir su página
                </button>
                <button type="button" onClick={() => onChoose(selected)} className="btn btn-ghost btn-sm">
                  <Pencil size={12} /> cambiar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="day-card is-empty">
            <span className="disc is-empty">
              <Plus size={22} />
            </span>
            <div className="min-w-0">
              <p className="hand text-lg text-[var(--amber)]">{label(selected)}</p>
              <p className="text-[13px] text-[var(--cream-soft)]">{selected === data.today ? "todavía no eliges la de hoy" : "ese día no elegiste canción"}</p>
              <button type="button" onClick={() => onChoose(selected)} className="btn btn-rose btn-sm mt-2">
                elegir la {selected === data.today ? "de hoy" : "de ese día"}
              </button>
            </div>
          </div>
        ))}
    </section>
  );
}

// El brazo del tocadiscos, apoyado en el disco del mes.
function Tonearm() {
  return (
    <svg aria-hidden="true" width="90" height="120" viewBox="0 0 90 120" className="absolute -right-8 -top-3.5">
      <circle cx="70" cy="16" r="12" fill="#2a262d" stroke="#f3cf8e" strokeWidth="2" />
      <path d="M70 16 L40 96" stroke="#f3cf8e" strokeWidth="4" strokeLinecap="round" />
      <rect x="30" y="92" width="18" height="12" rx="3" fill="#f3cf8e" transform="rotate(20 39 98)" />
    </svg>
  );
}

export function Etapas({ api, data, onOpenSong, onOpenShow, onMonth, onPicks, onAdded }: { api: Api; data: Companion; onOpenSong: (song: Song) => void; onOpenShow: (show: Show) => void; onMonth: (note: MonthNote) => void; onPicks: (picks: Pick[]) => void; onAdded: (song: Song) => void }) {
  // 0 = el mes actual; cada «mes anterior» suma uno.
  const [back, setBack] = useState(0);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const [slot, setSlot] = useState<PickSlot | null>(null);
  const key = monthBefore(data.today, back);
  const songOf = (id: string) => data.songs.find((s) => s.id === id);

  const monthPick = data.picks.find((p) => p.kind === "month" && p.period.startsWith(key));
  const monthSong = monthPick ? songOf(monthPick.song_id) : undefined;
  const weeks = data.picks.filter((p) => p.kind === "week" && p.period.startsWith(key));
  const songs = data.songs.filter((s) => monthKey(s.created_at) === key);
  const moods = MOODS.map((m) => ({ ...m, n: songs.filter((s) => s.mood === m.id).length }));
  const topMood = Math.max(1, ...moods.map((m) => m.n));
  const shows = data.series
    .map((show) => ({ show, seen: show.episodes.filter((e) => monthKey(e.watched_at) === key).length, finished: show.finished_at?.startsWith(key) ?? false }))
    .filter((x) => x.seen || x.finished);
  const note = data.months.find((m) => m.month.startsWith(key));
  const monthWord = monthName(key).split(" ")[0];
  const weekSlots = weeksOf(key, data.today);
  const currentWeek = periodStart("week", data.today);

  const summaryOf = () => {
    const lines = [];
    if (monthSong) lines.push(`Canción del mes: «${monthSong.title}» de ${monthSong.artist}${moodLabel(monthSong) ? ` (${moodLabel(monthSong)})` : ""}.`);
    [...weeks]
      .sort((a, b) => a.period.localeCompare(b.period))
      .forEach((w, i) => {
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

  const chooseMonth = () => setSlot({ kind: "month", period: `${key}-01`, label: `la canción de ${monthWord}` });

  return (
    <div>
      <div className="flex items-center justify-between gap-2 lg:justify-start lg:gap-5">
        <button type="button" aria-label="Mes anterior" onClick={() => setBack(back + 1)} className="round">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center lg:min-w-[300px]">
          <h2 className="brand !text-[50px] lg:!text-[60px]">{monthWord}</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--cream-soft)]">{key.slice(0, 4)}{back === 0 ? " · el mes que va" : ""}</p>
        </div>
        <button type="button" aria-label="Mes siguiente" disabled={back === 0} onClick={() => setBack(back - 1)} className="round">
          <ChevronRight size={18} />
        </button>
      </div>

      {!data.songs.length && !shows.length ? (
        <div className="empty mt-8">
          <p className="hand text-3xl text-[var(--rose)]">este mes todavía está en blanco</p>
          <p className="mt-1 text-sm text-[var(--cream-soft)]">las canciones que agregues y los capítulos que veas aparecen aquí</p>
        </div>
      ) : (
        <div className="etapas mt-6">
          <div className="min-w-0 space-y-7">
            <section aria-label={`La canción de ${monthWord}`} className="month-song">
              <p className="hand text-[22px] text-[var(--amber)]">la canción de {monthWord}</p>
              {monthSong ? (
                <>
                  <button type="button" onClick={() => onOpenSong(monthSong)} className="month-disc block" aria-label={`Abrir ${monthSong.title}`}>
                    <Disc src={monthSong.cover_url} spin />
                    <Tonearm />
                  </button>
                  <div className="min-w-0">
                    <h3 className="disp mt-4 text-[34px] leading-none">{monthSong.title}</h3>
                    <p className="mt-1 text-[13px] text-[var(--cream-soft)]">
                      {monthSong.artist}
                      {moodLabel(monthSong) ? ` · ${moodLabel(monthSong)}` : ""}
                    </p>
                    <div className="actions">
                      <button type="button" onClick={() => onOpenSong(monthSong)} className="btn btn-cream btn-sm">
                        abrir su página
                      </button>
                      <button type="button" onClick={chooseMonth} className="btn btn-ghost btn-sm">
                        <Pencil size={12} /> cambiar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" onClick={chooseMonth} className="month-disc block" aria-label={`Elegir la canción de ${monthWord}`}>
                    <span className="disc is-empty">
                      <Plus size={40} />
                    </span>
                  </button>
                  <div className="min-w-0">
                    <div className="actions">
                      <button type="button" onClick={chooseMonth} className="btn btn-rose">
                        elegir la canción de {monthWord}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
            <DayCalendar data={data} monthKey={key} onOpenSong={onOpenSong} onChoose={(day) => setSlot({ kind: "day", period: day, label: `la canción del ${dayName(day)} ${Number(day.slice(8, 10))}` })} />
          </div>

          <div className="min-w-0 space-y-7">
            {weekSlots.length > 0 && (
              <section aria-label="Las de cada semana">
                <div className="sec">
                  <h2>las de cada semana</h2>
                  <i />
                </div>
                <div className="scroller bleed gap-2.5 pb-1.5">
                  {weekSlots.map((monday) => {
                    const pick = weeks.find((w) => w.period === monday);
                    const song = pick ? songOf(pick.song_id) : undefined;
                    const label = monday === currentWeek ? "esta semana" : `semana del ${shortDate(monday)}`;
                    const open = () => setSlot({ kind: "week", period: monday, label: `la canción de la ${label}` });
                    return song ? (
                      <div key={monday} className={`wk ${monday === currentWeek ? "is-now" : ""}`}>
                        <button type="button" onClick={() => onOpenSong(song)} className="flex flex-col gap-1.5 text-left" aria-label={`${label}: ${song.title}`}>
                          <span className="hand text-[17px] text-[var(--amber)]">{label}</span>
                          <Art src={song.cover_url} alt="" className="sq rounded-md" />
                          <span className="disp truncate text-base leading-tight">{song.title}</span>
                          <span className="truncate text-[11px] text-[var(--cream-dim)]">{moodLabel(song) ?? song.artist}</span>
                        </button>
                        <button type="button" onClick={open} className="inline-flex min-h-8 items-center gap-1 text-[11.5px] text-[var(--cream-soft)]" aria-label={`Cambiar la canción de la ${label}`}>
                          <Pencil size={11} /> cambiar
                        </button>
                      </div>
                    ) : (
                      <button key={monday} type="button" onClick={open} className="wk is-empty" aria-label={`Elegir la canción de la ${label}`}>
                        <span className="hand text-[17px]">{label}</span>
                        <Plus size={26} />
                        <span className="text-xs font-medium">elegir</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {songs.length > 0 && (
              <section aria-label="Cómo se sintió el mes">
                <div className="sec">
                  <h2>cómo se sintió</h2>
                  <i />
                  <span className="hand text-lg text-[var(--amber)]">
                    {songs.length} {songs.length === 1 ? "canción" : "canciones"}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {moods.map((m) => (
                    <div key={m.id} className="grid grid-cols-[150px_1fr_22px] items-center gap-2.5 text-[12.5px]">
                      <span className="hand text-lg text-[var(--cream-soft)]">{m.label}</span>
                      <span className="bar">
                        <i style={{ width: `${Math.round((m.n / topMood) * 100)}%` }} />
                      </span>
                      <span className="text-right text-[var(--cream-dim)]">{m.n}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-label="Lo que veía">
              <div className="sec">
                <h2>lo que veía</h2>
                <i />
              </div>
              {shows.length ? (
                <ul className="flex flex-col gap-2.5">
                  {shows.map(({ show, seen, finished }) => (
                    <li key={show.id}>
                      <button type="button" onClick={() => onOpenShow(show)} className="row">
                        <Art src={show.poster_url} alt="" className="poster !rounded" />
                        <span className="min-w-0">
                          <span className="disp block truncate text-[17px]">{show.title}</span>
                          <span className="text-[11.5px] text-[var(--cream-dim)]">
                            {finished ? `la terminó el ${shortDate(show.finished_at!)}` : "viendo"}
                            {finished && show.rating ? <span className="hearts"> · {"♥".repeat(show.rating)}</span> : null}
                            {seen ? ` · ${seen} ${seen === 1 ? "episodio" : "episodios"} este mes` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--cream-soft)]">este mes no registraste series</p>
              )}
            </section>

            <section className="bio" aria-label="El biógrafo lo recuerda así">
              <span className="tape" style={{ right: 24, top: -9, width: 60, transform: "rotate(5deg)" }} />
              <p className="hand text-[21px] text-[var(--rose)]">el biógrafo lo recuerda así</p>
              {note ? <p className="mt-1.5 text-[13.5px] leading-relaxed">{note.summary}</p> : <p className="mt-1.5 text-[13px] text-[#ffdfe8]">todavía no escribe nada de este mes.</p>}
              {error && <p className="mt-1 text-xs text-[#ffc2d3]">{error}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={writing} onClick={() => void askSummary()} className="btn btn-sm !bg-white/[.14] !text-[#fff3f6]">
                  <Sparkles size={14} /> {writing ? "escribiendo…" : note ? "que lo vuelva a contar" : "pídele que lo cuente"}
                </button>
                <button type="button" onClick={() => chatAbout({ title: monthName(key), prompt: `¿Qué me acompañó en ${monthName(key)}? Platiquemos de las canciones y series de ese mes.`, mode: "normal" })} className="btn btn-sm !bg-[#fff3f6] !text-[var(--wine)]">
                  <MessageCircle size={14} /> platicar de este mes
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
      {slot && <ChooseSong api={api} data={data} slot={slot} lockKind onClose={() => setSlot(null)} onPicks={onPicks} onAdded={onAdded} />}
    </div>
  );
}
