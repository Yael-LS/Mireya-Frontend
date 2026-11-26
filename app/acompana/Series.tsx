"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, MessageCircle, Plus, Trash2, X } from "lucide-react";
import TulipIcon from "../components/TulipIcon";
import type { Api, Companion, Episode, Show, Status } from "./types";
import { KIND_LABELS, STATUSES, dayMonth, json, nextEpisode, shortDate, statusLabel } from "./types";
import { Art, Hearts, SaveHint, ShareToggle, chatAbout, saveToRefugio, useAutosave, useDebounced } from "./shared";
import { Pane, SearchBox, SearchResults } from "./Songs";

type Found = { tmdb_id: number; title: string; original_title: string | null; year: string | null; poster_url: string | null; kind: string; overview: string };
type TmdbEpisode = { episode: number; title: string | null; air_date: string | null; still_url: string | null; runtime: number | null };

const TILT = [-1, 0.8, -0.4];
const lastWatched = (show: Show) => [...show.episodes].sort((a, b) => b.watched_at.localeCompare(a.watched_at))[0] ?? null;
const seasonCount = (show: Show, season: number) => show.seasons.find((s) => s.n === season)?.count ?? 0;
const kindLabel = (show: { kind: string }) => KIND_LABELS[show.kind] ?? "serie";
const progressOf = (show: Show) => (show.total_episodes ? Math.min(100, Math.round((show.episodes.length / show.total_episodes) * 100)) : 0);

// Los capítulos de cada temporada se piden una vez y se comparten entre pantallas.
const seasonCache = new Map<string, Promise<TmdbEpisode[]>>();
function useSeason(api: Api, tmdbId: number | null, season: number | null) {
  const key = tmdbId && season !== null ? `${tmdbId}-${season}` : null;
  const [episodes, setEpisodes] = useState<TmdbEpisode[] | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    if (!seasonCache.has(key)) seasonCache.set(key, api<TmdbEpisode[]>(`acompana/tmdb/${tmdbId}/season/${season}`).catch(() => (seasonCache.delete(key), [])));
    void seasonCache.get(key)!.then((found) => !cancelled && setEpisodes(found));
    return () => {
      cancelled = true;
    };
    // `api` cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return key ? episodes : [];
}

function NowCard({ api, show, onOpen, onWatch }: { api: Api; show: Show; onOpen: () => void; onWatch: () => void }) {
  const last = lastWatched(show);
  const next = nextEpisode(show);
  const episodes = useSeason(api, show.tmdb_id, next?.season ?? null);
  const info = next ? episodes?.find((e) => e.episode === next.episode) : undefined;
  const multi = show.seasons.length > 1;
  return (
    <article className="now">
      <button type="button" onClick={onOpen} className="now-bd block w-full" aria-label={`Abrir ${show.title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {(show.backdrop_url || show.poster_url) && <img src={show.backdrop_url ?? show.poster_url ?? ""} alt="" />}
      </button>
      <div className="now-top">
        <button type="button" onClick={onOpen} aria-label={`Abrir ${show.title}`} className="block">
          <Art src={show.poster_url} alt={`Póster de ${show.title}`} className="poster" />
        </button>
        <div className="min-w-0 pt-[30px]">
          <span className="kind">{kindLabel(show)}</span>
          <button type="button" onClick={onOpen} className="block text-left">
            <h3 className="disp mt-1.5 text-[25px] leading-none text-[var(--cream)]">{show.title}</h3>
          </button>
        </div>
      </div>
      <div className="relative z-[2] p-3.5">
        <div className="flex justify-between gap-3 text-xs text-[var(--cream-soft)]">
          <span>{last ? `${multi ? `T${last.season} · ` : ""}episodio ${last.episode} de ${seasonCount(show, last.season)}` : "aún no ves ningún capítulo"}</span>
          {last && <span>visto el {shortDate(last.watched_at)}</span>}
        </div>
        <span className="bar mt-1.5">
          <i style={{ width: `${progressOf(show)}%` }} />
        </span>
        {(last?.note || show.note) && <p className="hand mt-2.5 line-clamp-2 text-xl leading-tight text-[var(--rose)]">«{last?.note || show.note}»</p>}
        {next ? (
          <div className="nextep mt-3">
            <Art src={info?.still_url} alt="" className="still" />
            <div className="min-w-0">
              <p className="ep-n">
                sigue · {multi ? `T${next.season} · ` : ""}episodio {next.episode}
              </p>
              {info?.title && <p className="disp mt-0.5 line-clamp-2 text-base leading-tight">{info.title}</p>}
              <button type="button" onClick={onWatch} className="btn btn-rose btn-sm mt-2">
                <Check size={14} strokeWidth={2.6} /> ya lo vi
              </button>
            </div>
          </div>
        ) : (
          <p className="hand mt-3 text-xl text-[var(--amber)]">¡ya viste todos los capítulos!</p>
        )}
      </div>
    </article>
  );
}

export function SeriesHome({ api, data, onOpen, onAdd, onWatch }: { api: Api; data: Companion; onOpen: (show: Show) => void; onAdd: () => void; onWatch: (show: Show) => void }) {
  const [filter, setFilter] = useState<Status | null>(null);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.id, data.series.filter((show) => show.status === s.id).length])), [data.series]);
  const watching = data.series.filter((show) => show.status === "watching");
  const rest = filter ? data.series.filter((show) => show.status === filter) : data.series.filter((show) => show.status !== "watching");
  const showNow = (!filter || filter === "watching") && watching.length > 0;

  return (
    <div className="space-y-8">
      {data.series.length > 0 && (
        <div role="group" aria-label="Filtrar por estado" className="scroller bleed">
          <button type="button" className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            todas <b>{data.series.length}</b>
          </button>
          {STATUSES.filter((s) => counts[s.id]).map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={filter === s.id} onClick={() => setFilter(filter === s.id ? null : s.id)}>
              {s.plural} <b>{counts[s.id]}</b>
            </button>
          ))}
        </div>
      )}

      {!data.series.length && (
        <div className="empty">
          <p className="hand text-3xl text-[var(--rose)]">tus series, k-dramas y animes</p>
          <p className="mt-1 text-sm text-[var(--cream-soft)]">toca el + y la app trae su póster, temporadas y capítulos</p>
          <button type="button" onClick={onAdd} className="btn btn-rose mt-4">
            <Plus size={16} /> agregar una serie
          </button>
        </div>
      )}

      {showNow && (
        <section aria-label="Viendo ahora">
          <div className="sec">
            <h2>viendo ahora</h2>
            <i />
          </div>
          <div className="now-grid">
            {watching.map((show) => (
              <NowCard key={show.id} api={api} show={show} onOpen={() => onOpen(show)} onWatch={() => onWatch(show)} />
            ))}
          </div>
        </section>
      )}

      {filter !== "watching" && rest.length > 0 && (
        <section aria-label={filter ? STATUSES.find((s) => s.id === filter)?.plural : "El resto de mi lista"}>
          <div className="sec">
            <h2>{filter ? STATUSES.find((s) => s.id === filter)?.plural : "el resto de mi lista"}</h2>
            <i />
          </div>
          <div className="shows">
            {rest.map((show, index) => {
              const last = lastWatched(show);
              const sub =
                show.status === "finished" && show.rating
                  ? "♥".repeat(show.rating)
                  : (show.status === "paused" || show.status === "dropped") && last
                    ? `en T${last.season} · E${last.episode}`
                    : [kindLabel(show), show.year].filter(Boolean).join(" · ");
              return (
                <button key={show.id} type="button" onClick={() => onOpen(show)} className="show" aria-label={`Abrir ${show.title}`}>
                  <span className="relative block" style={{ transform: `rotate(${TILT[index % 3]}deg)`, opacity: show.status === "dropped" ? 0.7 : 1 }}>
                    <Art src={show.poster_url} alt="" className="poster" />
                    <span className="st-tag">{statusLabel(show.status)}</span>
                  </span>
                  <span className="disp mt-1.5 block text-[15px] leading-tight">{show.title}</span>
                  <span className={`mt-0.5 block text-[11px] ${show.status === "finished" && show.rating ? "hearts" : "text-[var(--cream-dim)]"}`}>{sub}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <p className="note-small">Datos de series de TMDB. Esta app usa la API de TMDB, pero TMDB no la respalda ni la certifica.</p>
    </div>
  );
}

export function AddSeries({ api, onClose, onAdded }: { api: Api; onClose: () => void; onAdded: (show: Show) => void }) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 450);
  const [results, setResults] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Found[]>(`acompana/tmdb/search?q=${encodeURIComponent(debounced)}`)
      .then((found) => !cancelled && setResults(found))
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : "TMDB no respondió."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const choose = async (found: Found, status: Status) => {
    setSaving(found.tmdb_id);
    setError("");
    try {
      onAdded(await api<Show>("acompana/series", { method: "POST", ...json({ tmdb_id: found.tmdb_id, status }) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar.");
      setSaving(null);
    }
  };

  const busy = loading || (query.trim() !== debounced && Boolean(query.trim()));
  return (
    <Pane label="Agregar una serie" kicker="series, k-dramas, c-dramas y animes" title="agregar una serie" onClose={onClose}>
      <div className="pane-body">
        <SearchBox value={query} onChange={setQuery} placeholder="when i fly towards you, jujutsu kaisen…" autoFocus />
        <SearchResults loading={busy} error={error} searched={Boolean(debounced)} empty={!results.length}>
          {!debounced && <li className="pane-msg">en español o con su nombre original</li>}
          {results.map((found) => (
            <li key={found.tmdb_id} className="dres is-show">
              <Art src={found.poster_url} alt="" className="poster" />
              <div className="min-w-0">
                <p className="dres-t !whitespace-normal">{found.title}</p>
                <p className="dres-s">{[KIND_LABELS[found.kind], found.year, found.original_title !== found.title ? found.original_title : null].filter(Boolean).join(" · ")}</p>
                {found.overview && <p className="mt-1 line-clamp-2 text-xs text-[var(--cream-dim)]">{found.overview}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found, "watching")} className="dadd is-on">
                    {saving === found.tmdb_id ? "agregando…" : "la estoy viendo"}
                  </button>
                  <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found, "pending")} className="dadd">
                    pendiente
                  </button>
                  <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found, "finished")} className="dadd">
                    ya la terminé
                  </button>
                </div>
              </div>
            </li>
          ))}
        </SearchResults>
        <p className="note-small mt-4">Datos de TMDB</p>
      </div>
    </Pane>
  );
}

function EpisodeCard({ show, number, info, watched, isNext, onWatch, onUnwatch, onNote }: { show: Show; number: number; info: TmdbEpisode | undefined; watched: Episode | undefined; isNext: boolean; onWatch: () => void; onUnwatch: () => void; onNote: (note: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(watched?.note ?? "");
  // Solo un capítulo ya visto tiene nota: uno sin ver nunca se guarda desde aquí.
  const state = useAutosave(note, (value) => (watched ? onNote(value) : Promise.resolve()));
  const meta = [watched ? `lo viste el ${shortDate(watched.watched_at)}` : info?.air_date ? `se estrenó el ${shortDate(info.air_date)}` : null, info?.runtime ? `${info.runtime} min` : null].filter(Boolean).join(" · ");
  const fieldId = `ep-${show.id}-${watched?.season ?? "x"}-${number}`;
  return (
    <article className={`ep ${watched ? "is-seen" : "is-unseen"} ${isNext ? "is-next" : ""}`}>
      <span className="ep-img">
        <Art src={info?.still_url} alt="" className="still" />
        {watched && (
          <button type="button" onClick={onUnwatch} className="seen-mark" aria-label={`Quitar visto del episodio ${number}`} title="quitar visto">
            <Check size={14} strokeWidth={3} />
          </button>
        )}
      </span>
      <div className="min-w-0">
        <p className="ep-n">
          episodio {number}
          {isNext ? " · el que sigue" : ""}
        </p>
        {info?.title && <p className="ep-t">{info.title}</p>}
        {meta && <p className="ep-m">{meta}</p>}
        {!watched ? (
          <button type="button" onClick={onWatch} className="ep-btn">
            <Check size={13} strokeWidth={2.6} /> ya lo vi
          </button>
        ) : (
          !open &&
          !watched.note && (
            <button type="button" onClick={() => setOpen(true)} className="ep-btn">
              + una nota
            </button>
          )
        )}
      </div>
      {watched && (open || watched.note) && (
        <div className="col-span-full">
          <label htmlFor={fieldId} className="sr-only">
            Nota del episodio {number}
          </label>
          <textarea id={fieldId} autoFocus={open && !watched.note} value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="¿qué te dejó este capítulo?" className="ep-note" />
          <SaveHint state={state} />
        </div>
      )}
    </article>
  );
}

export function SeriesPage({ api, show, onBack, onChange, onRemove }: { api: Api; show: Show; onBack: () => void; onChange: (show: Show) => void; onRemove: (show: Show) => void }) {
  const seasons = [...show.seasons].sort((a, b) => a.n - b.n);
  const last = lastWatched(show);
  const next = nextEpisode(show);
  const [season, setSeason] = useState(next?.season ?? last?.season ?? seasons[0]?.n ?? 1);
  const [all, setAll] = useState(false);
  const [note, setNote] = useState(show.note ?? "");
  const [opinion, setOpinion] = useState(show.final_opinion ?? "");
  const [character, setCharacter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const tmdb = useSeason(api, show.tmdb_id, season);

  const patch = async (body: Record<string, unknown>) => {
    const updated = await api<Show>(`acompana/series/${show.id}`, { method: "PATCH", ...json(body) });
    onChange(updated);
    return updated;
  };
  const noteState = useAutosave(note, (value) => patch({ note: value }));
  const opinionState = useAutosave(opinion, (value) => patch({ final_opinion: value }));

  const watchedMap = new Map(show.episodes.map((e) => [`${e.season}-${e.episode}`, e]));
  const count = seasons.find((s) => s.n === season)?.count || tmdb?.length || 0;
  const numbers = Array.from({ length: count }, (_, i) => i + 1);
  // Al abrir se ven los últimos que vio y los que siguen; «ver todos» abre la temporada entera.
  const focus = next?.season === season ? next.episode : (last?.season === season ? last.episode : 1);
  const shown = all || count <= 8 ? numbers : numbers.filter((n) => n >= focus - 3 && n <= focus + 2);

  const watch = async (s: number, e: number, title?: string | null) => {
    setError("");
    try {
      const saved = await api<Episode>(`acompana/series/${show.id}/episodes`, { method: "POST", ...json({ season: s, episode: e, title: title ?? undefined }) });
      const episodes = [...show.episodes.filter((x) => !(x.season === s && x.episode === e)), saved];
      onChange({ ...show, episodes, status: show.status === "pending" || show.status === "paused" ? "watching" : show.status, started_at: show.started_at ?? saved.watched_at.slice(0, 10) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el capítulo.");
    }
  };
  const unwatch = async (episode: Episode) => {
    await api(`acompana/series/${show.id}/episodes/${episode.id}`, { method: "DELETE" });
    onChange({ ...show, episodes: show.episodes.filter((x) => x.id !== episode.id) });
  };
  const noteFor = (s: number, e: number) => async (value: string) => {
    const saved = await api<Episode>(`acompana/series/${show.id}/episodes`, { method: "POST", ...json({ season: s, episode: e, note: value }) });
    onChange({ ...show, episodes: show.episodes.map((x) => (x.id === saved.id ? saved : x)) });
  };

  const addCharacter = (event: FormEvent) => {
    event.preventDefault();
    const name = character.trim();
    if (!name || show.characters.includes(name)) return;
    setCharacter("");
    void patch({ characters: [...show.characters, name] });
  };

  const allSeen = show.total_episodes > 0 && show.episodes.length >= show.total_episodes;
  const chat = () => chatAbout({ title: show.title, prompt: `Quiero platicar de ${show.title}${last ? `, voy en el episodio ${last.episode}` : ""}.`, mode: "normal" });

  return (
    <article aria-label={show.title}>
      <div className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {(show.backdrop_url || show.poster_url) && <img src={show.backdrop_url ?? show.poster_url ?? ""} alt="" />}
        <button type="button" onClick={onBack} className="back">
          <ChevronLeft size={16} /> mis series
        </button>
      </div>
      <div className="hero-id">
        <Art src={show.poster_url} alt={`Póster de ${show.title}`} className="poster" />
        <div className="hero-title">
          <span className="kind">{[kindLabel(show), show.year, show.total_episodes ? `${show.total_episodes} episodios` : null].filter(Boolean).join(" · ")}</span>
          <h1>{show.title}</h1>
          <p className="mt-1 text-xs text-[var(--cream-soft)] lg:text-sm">{[show.alt_title, show.started_at ? `empezada el ${dayMonth(show.started_at)}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="hero-chat">
          <button type="button" onClick={chat} className="btn btn-rose !min-h-[50px]">
            <MessageCircle size={17} /> platicarla en el chat
          </button>
        </div>
      </div>

      <div className="serie-body">
        <div className="min-w-0 space-y-6">
          <div className="space-y-3.5">
            <div className="stseg" role="group" aria-label="Estado">
              {STATUSES.map((s) => (
                <button key={s.id} type="button" onClick={() => void patch({ status: s.id })} aria-pressed={show.status === s.id}>
                  {s.label}
                </button>
              ))}
            </div>
            {show.total_episodes > 0 && (
              <div className="progress">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="disp text-2xl">
                    {show.episodes.length} <span className="text-[15px] text-[var(--cream-soft)]">de {show.total_episodes} episodios</span>
                  </span>
                  <span className="hand text-lg text-[var(--amber)]">{progressOf(show)}%</span>
                </div>
                <span className="bar mt-2">
                  <i style={{ width: `${progressOf(show)}%` }} />
                </span>
              </div>
            )}
            {allSeen && show.status !== "finished" && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(243,207,142,.4)] p-3.5">
                <p className="hand flex-1 text-xl text-[var(--amber)]">¡ya viste todos los capítulos! ¿la marcamos como terminada?</p>
                <button type="button" onClick={() => void patch({ status: "finished" })} className="btn btn-rose btn-sm">
                  sí, la terminé
                </button>
              </div>
            )}
          </div>

          <section aria-label="Mis capítulos">
            <div className="sec">
              <h2>mis capítulos</h2>
              <i />
            </div>
            {seasons.length > 1 && (
              <div className="stseg mb-3" role="tablist" aria-label="Temporadas">
                {seasons.map((s) => (
                  <button
                    key={s.n}
                    type="button"
                    role="tab"
                    aria-selected={season === s.n}
                    onClick={() => {
                      setSeason(s.n);
                      setAll(false);
                    }}
                  >
                    temporada {s.n}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="err mb-2">{error}</p>}
            {tmdb === null && !count ? (
              <p className="hand animate-pulse py-4 text-xl text-[var(--cream-dim)]">trayendo los capítulos…</p>
            ) : !count ? (
              <p className="text-sm text-[var(--cream-soft)]">TMDB no tiene los capítulos de esta temporada.</p>
            ) : (
              <div className="eps">
                {shown.map((n) => {
                  const watched = watchedMap.get(`${season}-${n}`);
                  const info = tmdb?.find((e) => e.episode === n);
                  return (
                    <EpisodeCard
                      key={`${season}-${n}-${watched?.id ?? "x"}`}
                      show={show}
                      number={n}
                      info={info}
                      watched={watched}
                      isNext={next?.season === season && next.episode === n}
                      onWatch={() => void watch(season, n, info?.title)}
                      onUnwatch={() => watched && void unwatch(watched)}
                      onNote={noteFor(season, n)}
                    />
                  );
                })}
              </div>
            )}
            {count > shown.length && (
              <button type="button" onClick={() => setAll(true)} className="btn btn-ghost mt-3 w-full lg:w-auto">
                ver los {count} capítulos
              </button>
            )}
            {all && count > 8 && (
              <button type="button" onClick={() => setAll(false)} className="btn btn-ghost mt-3 w-full lg:w-auto">
                ver solo los de ahora
              </button>
            )}
          </section>
        </div>

        <aside aria-label="Mi diario de la serie" className="serie-side">
          <section aria-label="Personajes que me gustan">
            <div className="sec">
              <h2>personajes que me gustan</h2>
              <i />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {show.characters.map((name) => (
                <span key={name} className="char">
                  {name}
                  <button type="button" onClick={() => void patch({ characters: show.characters.filter((c) => c !== name) })} aria-label={`Quitar a ${name}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <form onSubmit={addCharacter} className="flex">
                <label htmlFor="pl-character" className="sr-only">
                  Agregar personaje
                </label>
                <input id="pl-character" value={character} maxLength={60} onChange={(event) => setCharacter(event.target.value)} placeholder="+ agregar" enterKeyHint="done" className="char-input" />
              </form>
            </div>
          </section>

          <section>
            <div className="sec">
              <label htmlFor="pl-series-note" className="hand text-[27px] font-semibold leading-none text-[var(--rose)] lg:text-[32px]">
                lo que me está pareciendo
              </label>
              <i />
              <SaveHint state={noteState} />
            </div>
            <textarea id="pl-series-note" value={note} onChange={(event) => setNote(event.target.value)} rows={7} placeholder="cómo te hace sentir, escenas que te llamaron la atención, lo que quieras conservar…" className="lined -rotate-[.5deg]" />
          </section>

          {show.status === "finished" ? (
            <section aria-label="Mi opinión final">
              <div className="sec">
                <label htmlFor="pl-opinion" className="hand text-[27px] font-semibold leading-none text-[var(--rose)]">
                  mi opinión final
                </label>
                <i />
                <Hearts value={show.rating} onChange={(rating) => void patch({ rating })} />
              </div>
              <textarea id="pl-opinion" value={opinion} onChange={(event) => setOpinion(event.target.value)} rows={5} placeholder="¿qué te dejó esta historia?" className="lined rotate-[.4deg]" />
              <SaveHint state={opinionState} />
            </section>
          ) : (
            <section className="later">
              <p className="hand text-[22px] text-[var(--amber)]">cuando la termines</p>
              <p className="mt-0.5 text-[12.5px] text-[var(--cream-soft)]">aquí escribes tu opinión final y le das sus corazones</p>
              <p className="hearts mt-1.5 text-[22px] opacity-35" aria-hidden="true">
                ♥♥♥♥♥
              </p>
            </section>
          )}

          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={chat} className="btn btn-rose w-full !min-h-[52px] lg:hidden">
              <MessageCircle size={17} /> platicarla en el chat
            </button>
            <div className="grid grid-cols-[1fr_auto] gap-2.5">
              <button
                type="button"
                onClick={() => void saveToRefugio(api, { kind: show.kind === "anime" ? "anime" : show.kind === "series" ? "series" : "kdrama", title: show.title, note: show.final_opinion || show.note }).then(setMessage)}
                className="btn btn-ghost"
              >
                <TulipIcon size={16} /> guardar en El Refugio
              </button>
              {confirmRemove ? (
                <span className="flex items-center gap-2 text-[13px]">
                  ¿quitarla?
                  <button type="button" onClick={() => onRemove(show)} className="chip" aria-pressed="true">
                    sí
                  </button>
                  <button type="button" onClick={() => setConfirmRemove(false)} className="chip">
                    no
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmRemove(true)} aria-label="Quitar esta serie" className="btn btn-ghost btn-icon">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {message && <p className="msg">{message}</p>}
            <ShareToggle value={show.share} onChange={(share) => void patch({ share })} />
            <p className="note-small mt-2">Datos de TMDB</p>
          </div>
        </aside>
      </div>
    </article>
  );
}
