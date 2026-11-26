"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, History, MessageCircle, Pencil, Play, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import TulipIcon from "../components/TulipIcon";
import type { Api, Companion, Mood, Pick, PickKind, Song } from "./types";
import { MOODS, dayMonth, json, monthKey, monthName, moodLabel, periodStart, shortDate, timeOf } from "./types";
import { Art, Disc, SaveHint, ShareToggle, chatAbout, saveToRefugio, useAutosave, useDebounced } from "./shared";

type Found = { spotify_id: string; title: string; artist: string; album: string | null; cover_url: string | null; spotify_url: string | null };

export const PICK_NAMES: Record<PickKind, string> = { day: "del día", week: "de la semana", month: "del mes" };
const KINDS: PickKind[] = ["day", "week", "month"];
const TILT = [-1.2, 1, -0.6, 0.8, -1, 0.6, -0.8, 1.1, -0.4, 0.7];

const clip = (text: string, size = 80) => (text.length > size ? `${text.slice(0, size).trimEnd()}…` : text);
// Lo que se lee en la tarjeta: el pedacito de letra o, si no hay, el principio de lo que escribió.
const quoteOf = (song: Song) => {
  const line = (song.lyric || song.note || "").split("\n").find((l) => l.trim());
  return line ? `«${clip(line.trim())}»` : null;
};

export function currentPicks(data: Companion) {
  return KINDS.map((kind) => {
    const period = periodStart(kind, data.today);
    const pick = data.picks.find((p) => p.kind === kind && p.period === period);
    return { kind, period, song: pick ? (data.songs.find((s) => s.id === pick.song_id) ?? null) : null };
  });
}

// Las elegidas de semanas y meses que ya pasaron, de la más nueva a la más vieja.
function pastPicks(data: Companion) {
  return data.picks
    .filter((p) => p.kind !== "day" && p.period < periodStart(p.kind, data.today))
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((p) => ({ pick: p, song: data.songs.find((s) => s.id === p.song_id) }))
    .filter((x): x is { pick: Pick; song: Song } => Boolean(x.song))
    .slice(0, 8);
}

export function SongsHome({ data, onOpen, onChoose, onHistory }: { data: Companion; onOpen: (song: Song) => void; onChoose: (kind: PickKind) => void; onHistory: () => void }) {
  const [mood, setMood] = useState<Mood | null>(null);
  const picks = currentPicks(data);
  const past = pastPicks(data);
  const visible = mood ? data.songs.filter((s) => s.mood === mood) : data.songs;
  const groups = useMemo(() => {
    const result: { key: string; songs: Song[] }[] = [];
    for (const song of visible) {
      const key = monthKey(song.created_at);
      const last = result[result.length - 1];
      if (last?.key === key) last.songs.push(song);
      else result.push({ key, songs: [song] });
    }
    return result;
  }, [visible]);

  return (
    <div className="space-y-9">
      <section aria-label="Sonando en mi vida">
        <div className="sec">
          <h2>sonando en mi vida</h2>
          <i />
          <button type="button" onClick={onHistory} className="hist">
            <History size={14} /> historial
          </button>
        </div>
        <div className="picks">
          {picks.map(({ kind, song }) =>
            song ? (
              <div key={kind} className="pick">
                <button type="button" onClick={() => onOpen(song)} className="pick-main" aria-label={`Canción ${PICK_NAMES[kind]}: ${song.title}, de ${song.artist}. Abrir su página`}>
                  <span className="pick-label">{PICK_NAMES[kind]}</span>
                  <Disc src={song.cover_url} spin={kind === "day"} />
                  <span className="min-w-0">
                    <span className="pick-ttl">{song.title}</span>
                    <span className="pick-art">{song.artist}</span>
                    {moodLabel(song) && <span className="pick-mood">{moodLabel(song)}</span>}
                  </span>
                </button>
                <button type="button" onClick={() => onChoose(kind)} className="pick-act" aria-label={`Cambiar la canción ${PICK_NAMES[kind]}`}>
                  <Pencil size={12} /> cambiar
                </button>
              </div>
            ) : (
              <button key={kind} type="button" onClick={() => onChoose(kind)} className="pick is-empty" aria-label={`Elegir la canción ${PICK_NAMES[kind]}`}>
                <span className="pick-main">
                  <span className="pick-label">{PICK_NAMES[kind]}</span>
                  <span className="disc is-empty">
                    <Plus size={26} />
                  </span>
                  <span className="min-w-0">
                    <span className="pick-ttl text-[var(--rose)]">¿cuál será?</span>
                    <span className="pick-art">{kind === "month" ? monthName(monthKey(data.today)).split(" ")[0] : kind === "week" ? "esta semana" : "hoy"}</span>
                  </span>
                </span>
                <span className="pick-act">elegir</span>
              </button>
            ),
          )}
        </div>

        {past.length > 0 && (
          <div className="mt-5 lg:flex lg:items-center lg:gap-4">
            <p className="hand shrink-0 text-[19px] text-[var(--cream-soft)] lg:text-xl">las de antes</p>
            <div className="scroller bleed mt-2 gap-2.5 pb-1 lg:mt-0">
              {past.map(({ pick, song }) => (
                <button key={`${pick.kind}-${pick.period}`} type="button" onClick={() => onOpen(song)} className="past" aria-label={`${pick.kind === "month" ? monthName(pick.period.slice(0, 7)) : `Semana del ${shortDate(pick.period)}`}: ${song.title}`}>
                  <Disc src={song.cover_url} />
                  <small>{pick.kind === "month" ? `${monthName(pick.period.slice(0, 7)).split(" ")[0]} ★` : shortDate(pick.period)}</small>
                  <b>{song.title}</b>
                </button>
              ))}
              <button type="button" onClick={onHistory} className="past" aria-label="Ver todo el historial">
                <span className="past-all">
                  <ChevronRight size={18} />
                </span>
                <small>ver todo</small>
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Mi playlist visual">
        <div className="lg:flex lg:items-center lg:gap-4">
          <div className="sec lg:mb-0 lg:flex-1">
            <h2>mi playlist visual</h2>
            <i />
          </div>
          {data.songs.length > 0 && (
            <div role="group" aria-label="Filtrar por sentimiento" className="scroller bleed mb-4 lg:mb-0">
              <button type="button" className="chip" aria-pressed={mood === null} onClick={() => setMood(null)}>
                todas <b>{data.songs.length}</b>
              </button>
              {MOODS.map((m) => {
                const n = data.songs.filter((s) => s.mood === m.id).length;
                return n ? (
                  <button key={m.id} type="button" className="chip" aria-pressed={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>
                    {m.label} <b>{n}</b>
                  </button>
                ) : null;
              })}
            </div>
          )}
        </div>

        {!data.songs.length && (
          <div className="empty">
            <p className="hand text-3xl text-[var(--rose)]">tu playlist visual empieza aquí</p>
            <p className="mt-1 text-sm text-[var(--cream-soft)]">toca el + y busca la canción que no te sale de la cabeza</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.key} className="mt-5 first:mt-0 lg:mt-7">
            <p className="hand mb-3 text-[21px] text-[var(--cream-soft)]">
              {monthName(group.key)} · {group.songs.length} {group.songs.length === 1 ? "canción" : "canciones"}
            </p>
            <div className="pages">
              {group.songs.map((song, index) => (
                <button key={song.id} type="button" onClick={() => onOpen(song)} className={`lp m-${song.mood ?? "none"}`} style={{ ["--r" as string]: `${TILT[index % TILT.length]}deg` }} aria-label={`Abrir ${song.title}, de ${song.artist}`}>
                  <Art src={song.cover_url} alt="" className="sq" />
                  <span className="lp-ttl">{song.title}</span>
                  <span className="lp-by">{song.artist}</span>
                  {quoteOf(song) && <span className="lp-quote">{quoteOf(song)}</span>}
                  {moodLabel(song) && <span className="lp-tag">{moodLabel(song)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------- Buscar en Spotify (con alto fijo para que nada brinque) ----------

function useSpotify(api: Api, query: string) {
  const debounced = useDebounced(query.trim(), 400);
  const [results, setResults] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
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
  return { results, loading: loading || (query.trim() !== debounced && Boolean(query.trim())), error, searched: Boolean(debounced) };
}

function SearchBox({ value, onChange, placeholder, autoFocus = false }: { value: string; onChange: (value: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <label className="dsearch">
      <Search size={18} className="shrink-0 text-[var(--rose)]" />
      <span className="sr-only">Buscar</span>
      <input autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} enterKeyHint="search" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Borrar la búsqueda" className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--cream-dim)]">
          <X size={15} />
        </button>
      )}
    </label>
  );
}

function SearchResults({ loading, error, searched, empty, children }: { loading: boolean; error: string; searched: boolean; empty: boolean; children: ReactNode }) {
  return (
    <ul className="results" aria-busy={loading}>
      {loading
        ? [0, 1, 2, 3].map((n) => (
            <li key={n} className="dskel" aria-hidden="true">
              <i />
              <i style={{ width: "70%" }} />
              <i style={{ width: "45%" }} />
            </li>
          ))
        : children}
      {!loading && error && <li className="pane-msg text-[#ffb4c4]">{error}</li>}
      {!loading && !error && searched && empty && <li className="pane-msg">no encontré nada con eso</li>}
    </ul>
  );
}

function Pane({ label, kicker, title, onClose, children, footer }: { label: string; kicker?: string; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Detrás no se mueve nada mientras está abierta.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="pane-bg" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={label} className="pane" onClick={(event) => event.stopPropagation()}>
        <header className="pane-head">
          <div className="min-w-0">
            {kicker && <p className="hand text-[19px] text-[var(--amber)]">{kicker}</p>}
            <h2 className="brand !text-[36px] sm:!text-[40px]">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="close" aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        {children}
        {footer && <footer className="pane-foot">{footer}</footer>}
      </section>
    </div>
  );
}
export { Pane, SearchBox, SearchResults };

export function AddSong({ api, onClose, onAdded }: { api: Api; onClose: () => void; onAdded: (song: Song) => void }) {
  const [query, setQuery] = useState("");
  const { results, loading, error, searched } = useSpotify(api, query);
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState("");

  const choose = async (found: Found) => {
    setSaving(found.spotify_id);
    setFailed("");
    try {
      onAdded(await api<Song>("acompana/songs", { method: "POST", ...json(found) }));
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : "No se pudo agregar.");
      setSaving(null);
    }
  };

  return (
    <Pane label="Agregar una canción" kicker="a tu playlist visual" title="agregar una canción" onClose={onClose}>
      <div className="pane-body">
        <SearchBox value={query} onChange={setQuery} placeholder="canción o artista, como en Spotify…" autoFocus />
        {failed && <p className="err mt-2">{failed}</p>}
        <SearchResults loading={loading} error={error} searched={searched} empty={!results.length}>
          {!searched && <li className="pane-msg">escribe y aparecen aquí</li>}
          {results.map((found) => (
            <li key={found.spotify_id} className="dres">
              <Art src={found.cover_url} alt="" className="sq" />
              <span className="min-w-0">
                <span className="dres-t">{found.title}</span>
                <span className="dres-s">
                  {found.artist}
                  {found.album ? ` · ${found.album}` : ""}
                </span>
              </span>
              <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found)} className="dadd">
                {saving === found.spotify_id ? "agregando…" : (
                  <>
                    <Plus size={14} /> agregar
                  </>
                )}
              </button>
            </li>
          ))}
        </SearchResults>
      </div>
    </Pane>
  );
}

// ---------- Elegir la canción del día, la semana o el mes ----------

export type PickSlot = { kind: PickKind; period: string; label?: string };

export function ChooseSong({ api, data, slot, lockKind = false, onClose, onPicks, onAdded }: { api: Api; data: Companion; slot: PickSlot; lockKind?: boolean; onClose: () => void; onPicks: (picks: Pick[]) => void; onAdded: (song: Song) => void }) {
  const [kind, setKind] = useState<PickKind>(slot.kind);
  const period = lockKind ? slot.period : periodStart(kind, data.today);
  const [query, setQuery] = useState("");
  const { results, loading, error, searched } = useSpotify(api, query);
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState("");

  const current = data.picks.find((p) => p.kind === kind && p.period === period);
  const chosen = current ? data.songs.find((s) => s.id === current.song_id) : undefined;
  const monthOfPeriod = period.slice(0, 7);
  // Primero las que agregó en ese mes; luego las demás.
  const mine = [...data.songs].sort((a, b) => Number(monthKey(b.created_at) === monthOfPeriod) - Number(monthKey(a.created_at) === monthOfPeriod));

  const label = slot.label ?? `tu canción ${PICK_NAMES[kind]}`;
  const kicker = kind === "day" ? (period === data.today ? "hoy" : dayMonth(period)) : kind === "week" ? `semana del ${dayMonth(period)}` : monthName(monthOfPeriod);

  const pick = async (songId: string) => {
    const result = await api<{ kind: PickKind; period: string; song_id: string | null }>("acompana/picks", { method: "POST", ...json({ kind, song_id: songId, period }) });
    const others = data.picks.filter((p) => !(p.kind === result.kind && p.period === result.period));
    onPicks(result.song_id ? [{ kind: result.kind, period: result.period, song_id: result.song_id }, ...others] : others);
  };

  const chooseMine = async (song: Song) => {
    setSaving(song.id);
    setFailed("");
    try {
      await pick(song.id);
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setSaving(null);
    }
  };

  // Una de Spotify: entra a su playlist y queda elegida, en un solo toque.
  const chooseFound = async (found: Found) => {
    setSaving(found.spotify_id);
    setFailed("");
    try {
      const existing = data.songs.find((s) => s.spotify_id === found.spotify_id);
      const song = existing ?? (await api<Song>("acompana/songs", { method: "POST", ...json(found) }));
      if (!existing) onAdded(song);
      if (current?.song_id !== song.id) await pick(song.id);
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : "No se pudo elegir.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Pane
      label={label}
      kicker={kicker}
      title={label}
      onClose={onClose}
      footer={
        <>
          <span className="min-w-0 flex-1 text-xs leading-snug text-[var(--cream-dim)]">{chosen ? "toca la misma para quitarla, u otra para cambiarla" : "elige una de tu playlist o búscala"}</span>
          <button type="button" onClick={onClose} className="btn btn-rose">
            listo
          </button>
        </>
      }
    >
      {!lockKind && (
        <div className="px-[18px] pt-3.5">
          <div className="dseg" role="group" aria-label="Qué canción eliges">
            {KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {PICK_NAMES[k]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="pane-body">
        <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-4 rounded-[22px] border border-white/10 bg-white/[.06] p-3.5">
          {chosen ? <Disc src={chosen.cover_url} spin /> : (
            <span className="disc is-empty">
              <Plus size={24} />
            </span>
          )}
          <div className="min-w-0">
            <p className="hand text-[17px] text-[var(--cream-soft)]">sonará {PICK_NAMES[kind]}</p>
            <p className="disp truncate text-[26px] leading-none">{chosen?.title ?? "todavía ninguna"}</p>
            {chosen && <p className="mt-1 truncate text-xs text-[var(--cream-dim)]">{chosen.artist}</p>}
          </div>
        </div>
        {failed && <p className="err mt-2">{failed}</p>}

        {mine.length > 0 && (
          <>
            <div className="sec mt-6">
              <h2 className="!text-[23px]">de tu playlist</h2>
              <i />
            </div>
            <div className="scroller bleed gap-3 pb-1.5 pt-0.5">
              {mine.map((song) => {
                const on = current?.song_id === song.id;
                return (
                  <button key={song.id} type="button" disabled={Boolean(saving)} onClick={() => void chooseMine(song)} aria-pressed={on} aria-label={on ? `Quitar ${song.title}` : `Elegir ${song.title}`} className="past !w-20">
                    <Disc src={song.cover_url} style={{ width: 72, boxShadow: on ? "0 0 0 3px var(--rose), 0 10px 20px -10px rgba(0,0,0,.9)" : undefined }} />
                    <b className="mt-0.5">{saving === song.id ? "…" : song.title}</b>
                    <small className="!text-sm">{song.artist}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="sec mt-6">
          <h2 className="!text-[23px]">{mine.length ? "o búscala en Spotify" : "búscala en Spotify"}</h2>
          <i />
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="canción o artista…" />
        <SearchResults loading={loading} error={error} searched={searched} empty={!results.length}>
          {results.map((found) => {
            const on = Boolean(chosen && chosen.spotify_id === found.spotify_id);
            return (
              <li key={found.spotify_id} className="dres">
                <Art src={found.cover_url} alt="" className="sq" />
                <span className="min-w-0">
                  <span className="dres-t">{found.title}</span>
                  <span className="dres-s">
                    {found.artist}
                    {found.album ? ` · ${found.album}` : ""}
                  </span>
                </span>
                <button type="button" disabled={Boolean(saving) || on} onClick={() => void chooseFound(found)} className={`dadd ${on ? "is-on" : ""}`}>
                  {saving === found.spotify_id ? "eligiendo…" : on ? "¡elegida!" : "elegir"}
                </button>
              </li>
            );
          })}
        </SearchResults>
      </div>
    </Pane>
  );
}

// ---------- La página de una canción ----------

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

  const pickedKinds = KINDS.filter((kind) => data.picks.some((p) => p.kind === kind && p.period === periodStart(kind, data.today) && p.song_id === song.id));

  const togglePick = async (kind: PickKind) => {
    const result = await api<{ kind: PickKind; period: string; song_id: string | null }>("acompana/picks", { method: "POST", ...json({ kind, song_id: song.id }) });
    const others = data.picks.filter((p) => !(p.kind === result.kind && p.period === result.period));
    onPicks(result.song_id ? [{ kind: result.kind, period: result.period, song_id: result.song_id }, ...others] : others);
  };

  const label = moodLabel(song);
  const stampSub: Record<PickKind, string> = { day: "hoy", week: "esta semana", month: monthName(monthKey(data.today)).split(" ")[0] };

  return (
    <article aria-label={`${song.title}, de ${song.artist}`} className={`sp m-${song.mood ?? "none"}`}>
      <span aria-hidden="true" className="sp-deco" />
      <div className="sp-in">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onBack} className="back">
            <ChevronLeft size={16} /> mi playlist
          </button>
          <span className="hand text-[17px] opacity-75">
            agregada el {dayMonth(song.created_at)} · {timeOf(song.created_at)}
          </span>
        </header>

        <div className="mt-3 flex flex-col items-center text-center">
          <div className="sp-pol">
            <span className="tape" style={{ left: "50%", top: -10, transform: "translateX(-50%) rotate(3deg)" }} />
            <Art src={song.cover_url} alt={`Portada de ${song.title}`} className="sq" />
            {label && <span className="hand absolute inset-x-2 bottom-1.5 truncate text-[21px] text-[#4a2e22]">{label}</span>}
          </div>
          <h1 className="disp mt-6 text-[44px] leading-[.95] sm:text-[52px]">{song.title}</h1>
          <p className="mt-1.5 text-[13.5px] opacity-80">
            {song.artist}
            {song.album ? ` · ${song.album}` : ""}
          </p>
          {song.spotify_url && (
            <a href={song.spotify_url} target="_blank" rel="noreferrer" className="btn btn-sm mt-3 !bg-[#1db954] !text-[#08210f]">
              <Play size={13} fill="currentColor" /> escuchar en Spotify
            </a>
          )}
        </div>

        <section aria-label="Es mi canción" className="mt-7 text-center">
          <p className="sp-label">es mi canción…</p>
          <div className="mt-2 flex justify-center gap-2.5">
            {KINDS.map((kind) => (
              <button key={kind} type="button" onClick={() => void togglePick(kind)} aria-pressed={pickedKinds.includes(kind)} className="sp-stamp">
                {PICK_NAMES[kind]}
                <small>{stampSub[kind]}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <div className="flex items-baseline justify-between">
            <label htmlFor="sp-lyric" className="sp-label">
              un pedacito de la letra
            </label>
            <SaveHint state={lyricState} />
          </div>
          <div className="paper mt-2 rotate-[.6deg] px-5 pb-4 pt-5">
            <span className="tape tape-amber" style={{ left: 18, top: -9, width: 60, transform: "rotate(-6deg)" }} />
            <textarea id="sp-lyric" value={lyric} onChange={(event) => setLyric(event.target.value)} placeholder="pega aquí la parte que te llega…" rows={3} className="lyric text-[#4a2e22]" />
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <label htmlFor="sp-note" className="sp-label">
              lo que me hace sentir
            </label>
            <SaveHint state={noteState} />
          </div>
          <textarea id="sp-note" value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => void readIntention()} placeholder="por qué la elegiste, qué te recuerda, una historia… o nada, si no quieres" rows={6} className="lined mt-2 -rotate-[.4deg]" />
        </section>

        <section aria-label="Sentimiento" className="sp-mood mt-5">
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
              <button type="button" onClick={() => void patch({ mood: guess.mood, mood_label: guess.label }).then(() => setGuess(null))} className="sp-chip" aria-pressed="true">
                usarlo
              </button>
              <button type="button" onClick={() => setGuess(null)} className="sp-chip">
                no
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[13px]">
              <Sparkles size={15} />
              {label ? (
                <span>
                  se siente como <strong>«{label}»</strong> · la página se viste sola
                </span>
              ) : (
                <span>escribe lo que te hace sentir y la página se viste sola, o elige tú:</span>
              )}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {MOODS.map((mood) => (
              <button key={mood.id} type="button" onClick={() => void patch({ mood: mood.id, mood_label: null })} aria-pressed={song.mood === mood.id && !song.mood_label} className="sp-chip">
                {mood.label}
              </button>
            ))}
            {custom === null ? (
              <button type="button" onClick={() => setCustom(song.mood_label ?? "")} aria-pressed={Boolean(song.mood_label)} className="sp-chip">
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
                <label htmlFor="sp-custom" className="sr-only">
                  Tu sentimiento
                </label>
                <input id="sp-custom" autoFocus value={custom} maxLength={60} onChange={(event) => setCustom(event.target.value)} placeholder="me da calma…" className="sp-chip-input" />
                <button type="submit" className="sp-chip" aria-pressed="true">
                  listo
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => chatAbout({ title: `«${song.title}»`, prompt: `Quiero platicar de «${song.title}» de ${song.artist}${label ? `, que ${label}` : ""}.`, mode: "normal" })}
            className="sp-btn is-solid w-full !min-h-[52px]"
          >
            <MessageCircle size={17} /> platicarla en el chat
          </button>
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <button type="button" onClick={() => void saveToRefugio(api, { kind: "song", title: song.title, creator: song.artist, url: song.spotify_url, note: label }).then(setMessage)} className="sp-btn">
              <TulipIcon size={16} /> guardar en El Refugio
            </button>
            {confirmRemove ? (
              <span className="flex items-center gap-2 text-[13px]">
                ¿quitarla?
                <button type="button" onClick={() => onRemove(song)} className="sp-chip" aria-pressed="true">
                  sí
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="sp-chip">
                  no
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(true)} aria-label="Quitar esta canción" className="sp-btn !w-12 !px-0">
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {message && <p className="text-[13px]">{message}</p>}
          <ShareToggle value={song.share} onChange={(share) => void patch({ share })} />
        </section>
      </div>
    </article>
  );
}
