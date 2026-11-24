"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, MessageCircle, Plus, Search, Trash2, X } from "lucide-react";
import TulipIcon from "../components/TulipIcon";
import type { Api, Companion, Episode, Show, Status } from "./types";
import { KIND_LABELS, STATUSES, dayMonth, json, nextEpisode, shortDate, statusLabel } from "./types";
import { Hearts, SaveHint, ShareToggle, chatAbout, saveToRefugio, useAutosave, useDebounced } from "./shared";

type Found = { tmdb_id: number; title: string; original_title: string | null; year: string | null; poster_url: string | null; kind: string; overview: string };
type TmdbEpisode = { episode: number; title: string | null; air_date: string | null; still_url: string | null };

function Poster({ show, className = "" }: { show: { poster_url: string | null; title: string }; className?: string }) {
  return show.poster_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={show.poster_url} alt={`Póster de ${show.title}`} className={`acm-poster ${className}`} />
  ) : (
    <span className={`acm-poster acm-cover-empty ${className}`} aria-hidden="true" />
  );
}

const lastWatched = (show: Show) => [...show.episodes].sort((a, b) => b.watched_at.localeCompare(a.watched_at))[0] ?? null;

function seasonCount(show: Show, season: number) {
  return show.seasons.find((s) => s.n === season)?.count ?? 0;
}

export function SeriesHome({ data, onOpen, onAdd, onWatch }: { data: Companion; onOpen: (show: Show) => void; onAdd: () => void; onWatch: (show: Show) => void }) {
  const [filter, setFilter] = useState<Status | null>(null);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.id, data.series.filter((show) => show.status === s.id).length])), [data.series]);
  const watching = data.series.filter((show) => show.status === "watching");
  const rest = filter ? data.series.filter((show) => show.status === filter) : data.series.filter((show) => show.status !== "watching");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button key={s.id} type="button" onClick={() => setFilter(filter === s.id ? null : s.id)} aria-pressed={filter === s.id} className={`acm-state ${filter === s.id ? "is-on" : ""}`}>
            <b>{counts[s.id]}</b> {s.plural}
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={onAdd} className="acm-primary">
          <Plus size={16} /> agregar una serie
        </button>
      </div>

      {!data.series.length && (
        <div className="acm-empty">
          <p className="font-hand text-3xl text-[#9e3b56]">tus series, k-dramas y animes</p>
          <p className="mt-1 text-sm text-[#7d4a5a]">búscala y la app trae su póster, temporadas y capítulos</p>
        </div>
      )}

      {!filter && watching.length > 0 && (
        <section aria-label="Viendo ahora">
          <h2 className="acm-h2">viendo ahora</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {watching.map((show, index) => {
              const last = lastWatched(show);
              const next = nextEpisode(show);
              const progress = show.total_episodes ? Math.round((show.episodes.length / show.total_episodes) * 100) : 0;
              return (
                <article key={show.id} className="acm-now" style={{ rotate: `${index % 2 ? 0.4 : -0.4}deg` }}>
                  <button type="button" onClick={() => onOpen(show)} className="shrink-0" aria-label={`Abrir ${show.title}`}>
                    <Poster show={show} className="w-28 sm:w-36" />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="acm-kind">{KIND_LABELS[show.kind] ?? "serie"}</span>
                      {show.started_at && <span className="text-xs text-[#85505f]">empezada el {dayMonth(show.started_at)}</span>}
                    </div>
                    <button type="button" onClick={() => onOpen(show)} className="text-left">
                      <span className="acm-ttl block text-[26px] sm:text-[30px]">{show.title}</span>
                      {show.alt_title && <span className="block truncate text-xs text-[#85505f]">{show.alt_title}</span>}
                    </button>
                    <div>
                      <div className="mb-1.5 flex flex-wrap justify-between gap-x-3 text-[12.5px] text-[#7d4a5a]">
                        <span>{last ? `Temporada ${last.season} · Episodio ${last.episode} de ${seasonCount(show, last.season)}` : "aún no ves ningún capítulo"}</span>
                        {last && <span>visto el {shortDate(last.watched_at)}</span>}
                      </div>
                      <div className="acm-bar">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    {(last?.note || show.note) && <p className="line-clamp-2 font-hand text-xl leading-tight text-[#9e3b56]">«{last?.note || show.note}»</p>}
                    <div className="mt-auto flex flex-wrap gap-2">
                      {next ? (
                        <button type="button" onClick={() => onWatch(show)} className="acm-primary !min-h-11 !px-4 !text-[13px]">
                          <Plus size={14} /> vi el {next.season !== (last?.season ?? next.season) || show.seasons.length > 1 ? `T${next.season} · ` : ""}episodio {next.episode}
                        </button>
                      ) : (
                        <span className="font-hand text-lg text-[#9e3b56]">¡ya viste todos los capítulos!</span>
                      )}
                      <button type="button" onClick={() => onOpen(show)} className="acm-ghost !min-h-11 !text-[13px]">
                        mi diario de la serie
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-label={filter ? STATUSES.find((s) => s.id === filter)?.plural : "El resto de mi lista"}>
          <h2 className="acm-h2">{filter ? STATUSES.find((s) => s.id === filter)?.plural : "el resto de mi lista"}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {rest.map((show) => {
              const last = lastWatched(show);
              return (
                <button key={show.id} type="button" onClick={() => onOpen(show)} className={`acm-mini ${show.status === "dropped" ? "opacity-75" : ""}`}>
                  <Poster show={show} className="w-full" />
                  <span className="acm-ttl mt-2 block text-left text-[19px] leading-tight">{show.title}</span>
                  <span className={`acm-tag is-${show.status}`}>
                    {statusLabel(show.status)}
                    {show.status === "finished" && show.rating ? ` · ${"♥".repeat(show.rating)}` : ""}
                    {(show.status === "paused" || show.status === "dropped") && last ? ` · T${last.season} E${last.episode}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <p className="text-center text-[11px] text-[#85505f]">Datos de series de TMDB. Esta app usa la API de TMDB, pero TMDB no la respalda ni la certifica.</p>
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
    if (!debounced) return setResults([]);
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

  return (
    <div className="acm-overlay" onClick={onClose}>
      <section aria-label="Agregar una serie" className="acm-sheet bubble-in" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 className="font-hand text-[38px] font-semibold leading-none text-[#9e3b56]">agregar una serie</h2>
            <p className="mt-1 text-[13px] text-[#7d4a5a]">series, k-dramas, c-dramas y animes; en español o con su nombre original</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2.5 text-[#8f475a] hover:bg-[#fae6ec]">
            <X size={18} />
          </button>
        </header>
        <label className="acm-search mx-6 mt-4">
          <Search size={16} className="shrink-0 text-[#9e3b56]" />
          <span className="sr-only">Buscar serie</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="when i fly towards you, jujutsu kaisen…" />
        </label>
        <div className="acm-scroll mt-3 px-4 pb-5">
          {loading && <p className="animate-pulse py-6 text-center font-hand text-2xl text-[#b07d8d]">buscando…</p>}
          {error && <p className="py-4 text-center text-sm text-rose-700">{error}</p>}
          {!loading && debounced && !results.length && !error && <p className="py-6 text-center font-hand text-2xl text-[#9e3b56]">no encontré esa serie</p>}
          <ul className="space-y-2">
            {results.map((found) => (
              <li key={found.tmdb_id} className="acm-result !items-start">
                <Poster show={found} className="w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium leading-tight text-[#421f2b]">{found.title}</p>
                  <p className="mt-0.5 text-xs text-[#7d4a5a]">
                    {[KIND_LABELS[found.kind], found.year, found.original_title !== found.title ? found.original_title : null].filter(Boolean).join(" · ")}
                  </p>
                  {found.overview && <p className="mt-1 line-clamp-2 text-xs text-[#85505f]">{found.overview}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found, "watching")} className="acm-chip is-on">
                      {saving === found.tmdb_id ? "agregando…" : "la estoy viendo"}
                    </button>
                    <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found, "pending")} className="acm-chip">
                      pendiente
                    </button>
                    <button type="button" disabled={Boolean(saving)} onClick={() => void choose(found, "finished")} className="acm-chip">
                      ya la terminé
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-[11px] text-[#85505f]">Datos de TMDB</p>
        </div>
      </section>
    </div>
  );
}

function EpisodeRow({ show, number, info, watched, onToggle, onNote }: { show: Show; number: number; info: TmdbEpisode | undefined; watched: Episode | undefined; onToggle: () => void; onNote: (note: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(watched?.note ?? "");
  // Solo un capítulo ya visto tiene nota: uno sin ver nunca se guarda desde aquí.
  const state = useAutosave(note, (value) => (watched ? onNote(value) : Promise.resolve()));
  return (
    <li className={`acm-ep ${watched ? "is-seen" : ""}`}>
      <button type="button" onClick={onToggle} aria-pressed={Boolean(watched)} aria-label={watched ? `Quitar visto del episodio ${number}` : `Marcar visto el episodio ${number}`} className="acm-ep-check">
        {watched && <Check size={15} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug text-[#421f2b]">
          <b className="font-display text-[18px]">E{number}</b> {info?.title ?? ""}
        </p>
        <p className="text-[11px] text-[#85505f]">
          {watched ? `visto el ${shortDate(watched.watched_at)}` : info?.air_date ? `se estrenó el ${shortDate(info.air_date)}` : ""}
        </p>
        {watched && (open || watched.note) ? (
          <div className="mt-1">
            <label htmlFor={`ep-${show.id}-${watched.season}-${number}`} className="sr-only">
              Nota del episodio {number}
            </label>
            <textarea id={`ep-${show.id}-${watched.season}-${number}`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="¿qué te dejó este capítulo?" className="acm-ep-note" />
            <SaveHint state={state} />
          </div>
        ) : watched ? (
          <button type="button" onClick={() => setOpen(true)} className="font-hand text-[17px] text-[#9e3b56]">
            + una nota
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function SeriesPage({ api, show, onBack, onChange, onRemove }: { api: Api; show: Show; onBack: () => void; onChange: (show: Show) => void; onRemove: (show: Show) => void }) {
  const seasons = [...show.seasons].sort((a, b) => a.n - b.n);
  const last = lastWatched(show);
  const [season, setSeason] = useState(last?.season ?? seasons[0]?.n ?? 1);
  const [tmdb, setTmdb] = useState<Record<number, TmdbEpisode[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [note, setNote] = useState(show.note ?? "");
  const [opinion, setOpinion] = useState(show.final_opinion ?? "");
  const [character, setCharacter] = useState("");
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    const updated = await api<Show>(`acompana/series/${show.id}`, { method: "PATCH", ...json(body) });
    onChange(updated);
    return updated;
  };
  const noteState = useAutosave(note, (value) => patch({ note: value }));
  const opinionState = useAutosave(opinion, (value) => patch({ final_opinion: value }));

  useEffect(() => {
    if (!show.tmdb_id || tmdb[season]) return;
    setLoadingEpisodes(true);
    api<TmdbEpisode[]>(`acompana/tmdb/${show.tmdb_id}/season/${season}`)
      .then((episodes) => setTmdb((current) => ({ ...current, [season]: episodes })))
      .catch(() => setTmdb((current) => ({ ...current, [season]: [] })))
      .finally(() => setLoadingEpisodes(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, show.tmdb_id]);

  const watchedMap = new Map(show.episodes.map((e) => [`${e.season}-${e.episode}`, e]));
  const count = seasons.find((s) => s.n === season)?.count ?? tmdb[season]?.length ?? 0;
  const numbers = Array.from({ length: count }, (_, i) => i + 1);
  const next = nextEpisode(show);

  const watch = async (s: number, e: number, title?: string | null) => {
    const saved = await api<Episode>(`acompana/series/${show.id}/episodes`, { method: "POST", ...json({ season: s, episode: e, title: title ?? undefined }) });
    const episodes = [...show.episodes.filter((x) => !(x.season === s && x.episode === e)), saved];
    onChange({ ...show, episodes, status: show.status === "pending" || show.status === "paused" ? "watching" : show.status, started_at: show.started_at ?? saved.watched_at.slice(0, 10) });
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

  return (
    <article aria-label={show.title} className="acm-seriespage">
      <span aria-hidden="true" className="panel-tape -top-3 left-1/2 -translate-x-1/2 rotate-[-3deg]" />
      <header className="flex flex-col gap-5 sm:flex-row">
        <Poster show={show} className="w-32 shrink-0 -rotate-2 self-center sm:w-36 sm:self-start" />
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="acm-back !text-[#9e3b56]">
            <ChevronLeft size={16} /> mis series
          </button>
          <h1 className="font-display text-[34px] font-semibold leading-none text-[#421f2b] sm:text-[40px]">{show.title}</h1>
          <p className="mt-1.5 text-[12.5px] text-[#7d4a5a]">
            {[show.alt_title, KIND_LABELS[show.kind] ?? "serie", show.year, `${show.total_episodes} episodios`, show.started_at ? `empezada el ${dayMonth(show.started_at)}` : null].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button key={s.id} type="button" onClick={() => void patch({ status: s.id })} aria-pressed={show.status === s.id} className={`acm-st ${show.status === s.id ? "is-on" : ""}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {allSeen && show.status !== "finished" && (
        <div className="acm-finish mt-5">
          <p className="font-hand text-xl">¡ya viste todos los capítulos! ¿la marcamos como terminada?</p>
          <button type="button" onClick={() => void patch({ status: "finished" })} className="acm-chip is-on">
            sí, la terminé
          </button>
        </div>
      )}

      <section aria-label="Episodios" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="acm-h3">episodios que voy viendo</h2>
          {next && (
            <button type="button" onClick={() => void watch(next.season, next.episode, tmdb[next.season]?.find((e) => e.episode === next.episode)?.title).then(() => setSeason(next.season))} className="acm-primary !min-h-10 !px-4 !text-[12.5px]">
              <Plus size={14} /> vi el {seasons.length > 1 ? `T${next.season} · ` : ""}episodio {next.episode}
            </button>
          )}
        </div>
        {seasons.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Temporadas">
            {seasons.map((s) => (
              <button key={s.n} type="button" role="tab" aria-selected={season === s.n} onClick={() => setSeason(s.n)} className={`acm-st ${season === s.n ? "is-on" : ""}`}>
                temporada {s.n}
              </button>
            ))}
          </div>
        )}
        {loadingEpisodes && !tmdb[season] ? (
          <p className="animate-pulse py-4 font-hand text-xl text-[#b07d8d]">trayendo los capítulos…</p>
        ) : (
          <ul className="acm-eplist mt-2">
            {numbers.map((n) => {
              const watched = watchedMap.get(`${season}-${n}`);
              const info = tmdb[season]?.find((e) => e.episode === n);
              return <EpisodeRow key={`${season}-${n}-${watched?.id ?? "x"}`} show={show} number={n} info={info} watched={watched} onToggle={() => void (watched ? unwatch(watched) : watch(season, n, info?.title))} onNote={noteFor(season, n)} />;
            })}
          </ul>
        )}
      </section>

      <section aria-label="Personajes que me gustan" className="mt-6">
        <h2 className="acm-h3">personajes que me gustan</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {show.characters.map((name) => (
            <span key={name} className="acm-char">
              {name}
              <button type="button" onClick={() => void patch({ characters: show.characters.filter((c) => c !== name) })} aria-label={`Quitar a ${name}`} className="ml-1 opacity-60 hover:opacity-100">
                <X size={12} />
              </button>
            </span>
          ))}
          <form onSubmit={addCharacter} className="flex">
            <label htmlFor="acm-character" className="sr-only">
              Agregar personaje
            </label>
            <input id="acm-character" value={character} maxLength={60} onChange={(event) => setCharacter(event.target.value)} placeholder="+ agregar" className="acm-char-input" />
          </form>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <label htmlFor="acm-series-note" className="acm-h3">
            lo que me está pareciendo
          </label>
          <SaveHint state={noteState} />
        </div>
        <textarea id="acm-series-note" value={note} onChange={(event) => setNote(event.target.value)} rows={5} placeholder="cómo te hace sentir, escenas que te llamaron la atención, lo que quieras conservar…" className="acm-lined acm-lined-rose" />
      </section>

      <section aria-label="Mi opinión final" className={`mt-5 ${show.status === "finished" ? "acm-final" : "acm-final is-later"}`}>
        {show.status === "finished" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="acm-opinion" className="acm-h3">
                mi opinión final
              </label>
              <Hearts value={show.rating} onChange={(rating) => void patch({ rating })} />
            </div>
            <textarea id="acm-opinion" value={opinion} onChange={(event) => setOpinion(event.target.value)} rows={4} placeholder="¿qué te dejó esta historia?" className="acm-lined acm-lined-rose" />
            <SaveHint state={opinionState} />
          </>
        ) : (
          <p className="font-hand text-xl text-[#9e3b56]">cuando la termines: tu opinión final y cuántos corazones le das</p>
        )}
      </section>

      <footer className="mt-6 border-t border-[#f3d3dc] pt-4">
        <div className="mb-3 flex justify-end text-[#5c2338]">
          <ShareToggle value={show.share} onChange={(share) => void patch({ share })} />
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              chatAbout({
                title: show.title,
                prompt: `Quiero platicar de ${show.title}${last ? `, voy en el episodio ${last.episode}` : ""}.`,
                mode: "normal",
              })
            }
            className="acm-primary flex-1"
          >
            <MessageCircle size={16} /> platicarla en el chat
          </button>
          <button
            type="button"
            onClick={() => void saveToRefugio(api, { kind: show.kind === "anime" ? "anime" : show.kind === "series" ? "series" : "kdrama", title: show.title, note: show.final_opinion || show.note }).then(setMessage)}
            className="acm-ghost"
          >
            <TulipIcon size={16} /> guardar en El Refugio
          </button>
          {confirmRemove ? (
            <span className="flex items-center gap-2 text-[13px] text-[#7a2c43]">
              ¿quitarla de tu lista?
              <button type="button" onClick={() => onRemove(show)} className="acm-chip is-on">
                sí
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="acm-chip">
                no
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} aria-label="Quitar esta serie" className="acm-icon-btn">
              <Trash2 size={16} />
            </button>
          )}
        </div>
        {message && <p className="mt-2 text-[13px] text-[#7a2c43]">{message}</p>}
        <p className="mt-4 text-center text-[11px] text-[#85505f]">Datos de TMDB</p>
      </footer>
    </article>
  );
}
