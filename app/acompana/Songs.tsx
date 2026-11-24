"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, MessageCircle, Play, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import TulipIcon from "../components/TulipIcon";
import type { Api, Companion, Mood, Pick, PickKind, Song } from "./types";
import { MOODS, dayMonth, json, monthKey, monthName, moodLabel, periodStart, timeOf } from "./types";
import { MoodDecor, SaveHint, ShareToggle, chatAbout, saveToRefugio, useAutosave, useDebounced } from "./shared";

type Found = { spotify_id: string; title: string; artist: string; album: string | null; cover_url: string | null; spotify_url: string | null };

const PICK_NAMES: Record<PickKind, string> = { day: "del día", week: "de la semana", month: "del mes" };

function Cover({ song, className = "" }: { song: { cover_url: string | null; title: string }; className?: string }) {
  return song.cover_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={song.cover_url} alt={`Portada de ${song.title}`} className={`acm-cover ${className}`} />
  ) : (
    <span className={`acm-cover acm-cover-empty ${className}`} aria-hidden="true" />
  );
}

export function currentPicks(data: Companion) {
  return (["day", "week", "month"] as PickKind[]).map((kind) => {
    const period = periodStart(kind, data.today);
    const pick = data.picks.find((p) => p.kind === kind && p.period === period);
    return { kind, period, song: pick ? data.songs.find((s) => s.id === pick.song_id) ?? null : null };
  });
}

export function SongsHome({ data, onOpen, onAdd }: { data: Companion; onOpen: (song: Song) => void; onAdd: () => void }) {
  const picks = currentPicks(data);
  const groups = useMemo(() => {
    const result: { key: string; songs: Song[] }[] = [];
    for (const song of data.songs) {
      const key = monthKey(song.created_at);
      const last = result[result.length - 1];
      if (last?.key === key) last.songs.push(song);
      else result.push({ key, songs: [song] });
    }
    return result;
  }, [data.songs]);

  return (
    <div className="space-y-9">
      <section aria-label="Mis canciones elegidas">
        <h2 className="acm-h2">mis elegidas</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {picks.map(({ kind, song }) =>
            song ? (
              <button key={kind} type="button" onClick={() => onOpen(song)} className={`acm-pick is-${kind}`}>
                <span className="acm-pick-stamp">{PICK_NAMES[kind]}</span>
                <Cover song={song} className="size-20 shrink-0" />
                <span className="min-w-0 text-left">
                  <span className="acm-ttl block truncate">{song.title}</span>
                  <span className="block truncate text-xs text-[#7d4a5a]">{song.artist}</span>
                  {moodLabel(song) && <span className="mt-1 block truncate font-hand text-lg text-[#9e3b56]">{moodLabel(song)}</span>}
                </span>
              </button>
            ) : (
              <div key={kind} className="acm-pick is-empty">
                <span className="acm-pick-stamp">{PICK_NAMES[kind]}</span>
                <p className="font-hand text-xl leading-tight text-[#9e3b56]">¿cuál es tu canción {PICK_NAMES[kind]}?</p>
                <p className="text-xs text-[#85505f]">ábrela y tócale «{PICK_NAMES[kind]}»</p>
              </div>
            ),
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="acm-h2 !mb-0">mi playlist visual</h2>
        <i className="hidden flex-1 border-t-[1.5px] border-dashed border-[#ecbccb] sm:block" />
        <button type="button" onClick={onAdd} className="acm-primary">
          <Plus size={16} /> agregar una canción
        </button>
      </div>

      {!data.songs.length && (
        <div className="acm-empty">
          <p className="font-hand text-3xl text-[#9e3b56]">tu playlist visual empieza aquí</p>
          <p className="mt-1 text-sm text-[#7d4a5a]">busca la canción que no te sale de la cabeza y escribe lo que te hace sentir</p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} aria-label={monthName(group.key)}>
          <p className="acm-month">
            {monthName(group.key)} · {group.songs.length} {group.songs.length === 1 ? "canción" : "canciones"}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {group.songs.map((song, index) => (
              <button key={song.id} type="button" onClick={() => onOpen(song)} className={`acm-page mood-${song.mood ?? "none"}`} style={{ rotate: `${[-1, 0.8, -0.5, 1][index % 4]}deg` }}>
                <MoodDecor mood={song.mood} />
                <Cover song={song} className="relative aspect-square w-full" />
                <span className="relative mt-2.5 block text-left">
                  <span className="acm-ttl block truncate">{song.title}</span>
                  <span className="block truncate text-[12px] opacity-80">{song.artist}</span>
                </span>
                {song.lyric && <span className="relative mt-1.5 line-clamp-2 block text-left font-hand text-[19px] leading-[1.05] opacity-90">«{song.lyric.split("\n")[0]}»</span>}
                {moodLabel(song) && <span className="acm-mood-tag relative mt-auto">{moodLabel(song)}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AddSong({ api, onClose, onAdded }: { api: Api; onClose: () => void; onAdded: (song: Song) => void }) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 400);
  const [results, setResults] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!debounced) return setResults([]);
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Found[]>(`acompana/spotify?q=${encodeURIComponent(debounced)}`)
      .then((found) => !cancelled && setResults(found))
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : "Spotify no respondió."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `api` cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const choose = async (found: Found) => {
    setSaving(found.spotify_id);
    try {
      onAdded(await api<Song>("acompana/songs", { method: "POST", ...json(found) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar.");
      setSaving(null);
    }
  };

  return (
    <div className="acm-overlay" onClick={onClose}>
      <section aria-label="Agregar una canción" className="acm-sheet bubble-in" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 className="font-hand text-[38px] font-semibold leading-none text-[#9e3b56]">agregar una canción</h2>
            <p className="mt-1 text-[13px] text-[#7d4a5a]">búscala como la buscarías en Spotify</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2.5 text-[#8f475a] hover:bg-[#fae6ec]">
            <X size={18} />
          </button>
        </header>
        <label className="acm-search mx-6 mt-4">
          <Search size={16} className="shrink-0 text-[#9e3b56]" />
          <span className="sr-only">Buscar canción</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="nombre de la canción o artista…" />
        </label>
        <div className="acm-scroll mt-3 px-4 pb-5">
          {loading && <p className="animate-pulse py-6 text-center font-hand text-2xl text-[#b07d8d]">buscando…</p>}
          {error && <p className="py-4 text-center text-sm text-rose-700">{error}</p>}
          {!loading && debounced && !results.length && !error && <p className="py-6 text-center font-hand text-2xl text-[#9e3b56]">no encontré esa canción</p>}
          <ul className="space-y-1.5">
            {results.map((found) => (
              <li key={found.spotify_id}>
                <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found)} className="acm-result">
                  <Cover song={found} className="size-14 shrink-0" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-medium text-[#421f2b]">{found.title}</span>
                    <span className="block truncate text-xs text-[#7d4a5a]">
                      {found.artist}
                      {found.album ? ` · ${found.album}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-hand text-lg text-[#9e3b56]">{saving === found.spotify_id ? "agregando…" : "elegir"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export function SongPage({ api, song, data, onBack, onChange, onRemove, onPicks }: { api: Api; song: Song; data: Companion; onBack: () => void; onChange: (song: Song) => void; onRemove: (song: Song) => void; onPicks: (picks: Pick[]) => void }) {
  const [lyric, setLyric] = useState(song.lyric ?? "");
  const [note, setNote] = useState(song.note ?? "");
  const [guess, setGuess] = useState<{ mood: Mood; label: string } | null>(null);
  const [guessing, setGuessing] = useState(false);
  const [guessedFor, setGuessedFor] = useState(song.note ?? "");
  const [custom, setCustom] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const patch = async (body: Partial<Song>) => {
    const updated = await api<Song>(`acompana/songs/${song.id}`, { method: "PATCH", ...json(body) });
    onChange(updated);
    return updated;
  };
  const lyricState = useAutosave(lyric, (value) => patch({ lyric: value }));
  const noteState = useAutosave(note, (value) => patch({ note: value }));

  // Lee su intención: al dejar de escribir, propone el sentimiento de lo que escribió.
  const readIntention = async () => {
    const text = note.trim();
    if (text.length < 25 || text === guessedFor.trim() || guessing) return;
    setGuessing(true);
    setGuessedFor(text);
    try {
      const found = await api<{ mood: Mood; label: string }>("acompana/mood", { method: "POST", ...json({ text, title: song.title, artist: song.artist }) });
      if (!song.mood) await patch({ mood: found.mood, mood_label: found.label });
      else if (found.mood !== song.mood || found.label !== song.mood_label) setGuess(found);
    } catch {
      // Si no pudo, ella elige el sentimiento a mano.
    } finally {
      setGuessing(false);
    }
  };

  const pickedKinds = (["day", "week", "month"] as PickKind[]).filter((kind) => data.picks.some((p) => p.kind === kind && p.period === periodStart(kind, data.today) && p.song_id === song.id));

  const togglePick = async (kind: PickKind) => {
    const result = await api<{ kind: PickKind; period: string; song_id: string | null }>("acompana/picks", { method: "POST", ...json({ kind, song_id: song.id }) });
    const others = data.picks.filter((p) => !(p.kind === result.kind && p.period === result.period));
    onPicks(result.song_id ? [{ kind: result.kind, period: result.period, song_id: result.song_id }, ...others] : others);
  };

  const label = moodLabel(song);

  return (
    <article aria-label={`${song.title}, de ${song.artist}`} className={`acm-songpage mood-${song.mood ?? "none"}`}>
      <MoodDecor mood={song.mood} big />
      <header className="relative flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="acm-back">
          <ChevronLeft size={16} /> mis canciones
        </button>
        <span className="font-hand text-lg opacity-80">
          agregada el {dayMonth(song.created_at)} · {timeOf(song.created_at)}
        </span>
      </header>

      <div className="relative mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="acm-polaroid">
          <Cover song={song} className="size-44 sm:size-48" />
        </div>
        <div className="min-w-0 text-center sm:pt-3 sm:text-left">
          <h1 className="font-display text-[42px] font-semibold leading-[.95] sm:text-[48px]">{song.title}</h1>
          <p className="mt-1.5 text-sm opacity-80">
            {song.artist}
            {song.album ? ` · ${song.album}` : ""}
          </p>
          {song.spotify_url && (
            <a href={song.spotify_url} target="_blank" rel="noreferrer" className="acm-spotify">
              <Play size={13} fill="currentColor" /> escuchar en Spotify
            </a>
          )}
        </div>
      </div>

      <section className="relative mt-6">
        <div className="flex items-center justify-between">
          <label htmlFor="acm-lyric" className="font-hand text-[21px] opacity-80">
            un pedacito de la letra
          </label>
          <SaveHint state={lyricState} />
        </div>
        <textarea id="acm-lyric" value={lyric} onChange={(event) => setLyric(event.target.value)} placeholder="pega aquí la parte que te llega…" rows={3} className="acm-lyric" />
      </section>

      <section className="relative mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="acm-note" className="font-hand text-[21px] opacity-80">
            lo que me hace sentir
          </label>
          <SaveHint state={noteState} />
        </div>
        <textarea id="acm-note" value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => void readIntention()} placeholder="por qué la elegiste, qué te recuerda, una historia… o nada, si no quieres" rows={6} className="acm-lined" />
      </section>

      <section className="acm-moodbar relative mt-3" aria-label="Sentimiento">
        {guessing ? (
          <p className="flex items-center gap-2 text-[13px]">
            <Sparkles size={15} className="animate-pulse" /> leyendo lo que escribiste…
          </p>
        ) : guess ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Sparkles size={15} />
            <span>
              por lo que escribiste, se siente como <strong>«{guess.label}»</strong>
            </span>
            <button type="button" onClick={() => void patch({ mood: guess.mood, mood_label: guess.label }).then(() => setGuess(null))} className="acm-chip is-on">
              usarlo
            </button>
            <button type="button" onClick={() => setGuess(null)} className="acm-chip">
              no
            </button>
          </div>
        ) : label ? (
          <p className="flex items-center gap-2 text-[13px]">
            <Sparkles size={15} /> se siente como <strong>«{label}»</strong>
          </p>
        ) : (
          <p className="text-[13px]">escribe lo que te hace sentir y la página se viste sola, o elige tú:</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <button key={mood.id} type="button" onClick={() => void patch({ mood: mood.id, mood_label: null })} aria-pressed={song.mood === mood.id && !song.mood_label} className={`acm-chip ${song.mood === mood.id && !song.mood_label ? "is-on" : ""}`}>
              {mood.label}
            </button>
          ))}
          {custom === null ? (
            <button type="button" onClick={() => setCustom(song.mood_label ?? "")} className={`acm-chip ${song.mood_label ? "is-on" : ""}`}>
              {song.mood_label ? `«${song.mood_label}»` : "otro…"}
            </button>
          ) : (
            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void patch({ mood_label: custom.trim() || null, mood: song.mood ?? "nostalgia" }).then(() => setCustom(null));
              }}
            >
              <label htmlFor="acm-custom" className="sr-only">
                Tu sentimiento
              </label>
              <input id="acm-custom" autoFocus value={custom} maxLength={60} onChange={(event) => setCustom(event.target.value)} placeholder="me da calma…" className="acm-chip-input" />
              <button type="submit" className="acm-chip is-on">
                listo
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="acm-songfoot relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-hand text-[19px] opacity-80">es mi canción</span>
          {(["day", "week", "month"] as PickKind[]).map((kind) => (
            <button key={kind} type="button" onClick={() => void togglePick(kind)} aria-pressed={pickedKinds.includes(kind)} className={`acm-pin ${pickedKinds.includes(kind) ? "is-on" : ""}`}>
              {PICK_NAMES[kind]}
            </button>
          ))}
          <span className="flex-1" />
          <ShareToggle value={song.share} onChange={(share) => void patch({ share })} />
        </div>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              chatAbout({
                title: `«${song.title}»`,
                prompt: `Quiero platicar de «${song.title}» de ${song.artist}${label ? `, que ${label}` : ""}.`,
                mode: "normal",
              })
            }
            className="acm-primary flex-1"
          >
            <MessageCircle size={16} /> platicarla en el chat
          </button>
          <button type="button" onClick={() => void saveToRefugio(api, { kind: "song", title: song.title, creator: song.artist, url: song.spotify_url, note: label }).then(setMessage)} className="acm-ghost">
            <TulipIcon size={16} /> guardar en El Refugio
          </button>
          {confirmRemove ? (
            <span className="flex items-center gap-2 text-[13px]">
              ¿quitarla?
              <button type="button" onClick={() => onRemove(song)} className="acm-chip is-on">
                sí
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="acm-chip">
                no
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} aria-label="Quitar esta canción" className="acm-icon-btn">
              <Trash2 size={16} />
            </button>
          )}
        </div>
        {message && <p className="mt-2 text-[13px]">{message}</p>}
      </footer>
    </article>
  );
}
