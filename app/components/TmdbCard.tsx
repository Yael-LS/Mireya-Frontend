"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, Star } from "lucide-react";

type Card = {
  media: "tv" | "movie";
  title: string;
  original_title: string | null;
  year: string | null;
  kind: string;
  genres: string[];
  rating: number | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  seasons: number | null;
  episodes: number | null;
  runtime: number | null;
  url: string;
  playlist: string | null;
  episode: { season: number; episode: number; title: string | null; still_url: string | null; air_date: string | null; runtime: number | null; overview: string | null } | null;
};

export type TmdbRef = { media: "tv" | "movie"; id: number; season?: number; episode?: number };

// "https://www.themoviedb.org/tv/228547-cuando-vuelo/season/1/episode/7" → la obra y su capítulo.
export function tmdbRef(url: URL): TmdbRef | null {
  if (!url.hostname.replace(/^www\./, "").endsWith("themoviedb.org")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const media = parts[0];
  const id = Number.parseInt(parts[1] ?? "", 10);
  if ((media !== "tv" && media !== "movie") || !Number.isFinite(id)) return null;
  const season = parts[2] === "season" ? Number.parseInt(parts[3] ?? "", 10) : NaN;
  const episode = parts[4] === "episode" ? Number.parseInt(parts[5] ?? "", 10) : NaN;
  return media === "tv" && Number.isFinite(season) && Number.isFinite(episode) ? { media, id, season, episode } : { media, id };
}

// Una tarjeta se pide una sola vez aunque el mensaje se vuelva a pintar mientras llega.
const cache = new Map<string, Promise<Card | null>>();
function loadCard(ref: TmdbRef) {
  const query = new URLSearchParams({ media: ref.media, id: String(ref.id), ...(ref.episode ? { season: String(ref.season), episode: String(ref.episode) } : {}) });
  const key = query.toString();
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`/api/backend/acompana/tmdb/card?${key}`)
        .then((r) => (r.ok ? (r.json() as Promise<Card>) : null))
        .catch(() => null)
        .then((card) => {
          if (!card) cache.delete(key);
          return card;
        }),
    );
  }
  return cache.get(key)!;
}

const shortDate = (iso: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)).replace(".", "");

function Footer({ card }: { card: Card }) {
  return (
    <span className="tmdb-foot">
      {card.playlist ? <span className="tmdb-mine">en su playlist · {card.playlist}</span> : <span />}
      <span className="tmdb-go">
        <b aria-hidden="true">TMDB</b> verla en TMDB <ExternalLink size={12} />
      </span>
    </span>
  );
}

export default function TmdbCard({ href, tmdb, children }: { href: string; tmdb: TmdbRef; children: ReactNode }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadCard(tmdb).then((found) => alive && setCard(found));
    return () => {
      alive = false;
    };
  }, [tmdb.media, tmdb.id, tmdb.season, tmdb.episode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si TMDB no respondió, queda el enlace de siempre.
  if (card === null)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[#a45d6f] underline decoration-[#e4b5c0] underline-offset-2">
        {children}
      </a>
    );

  if (card === undefined)
    return (
      <span className={`tmdb not-prose ${tmdb.episode ? "is-episode" : ""}`} aria-busy="true" aria-label="Cargando la tarjeta de TMDB">
        {tmdb.episode && <span className="tmdb-still tmdb-skel" />}
        <span className="tmdb-row">
          <span className="tmdb-poster tmdb-skel" />
          <span className="tmdb-body">
            <i className="tmdb-skel-line" style={{ width: "40%" }} />
            <i className="tmdb-skel-line" style={{ width: "75%", height: 16 }} />
            <i className="tmdb-skel-line" style={{ width: "90%" }} />
            <i className="tmdb-skel-line" style={{ width: "60%" }} />
          </span>
        </span>
      </span>
    );

  const ep = card.episode;
  const meta = [card.kind, card.year, card.media === "tv" && card.episodes ? `${card.episodes} episodios` : null, card.media === "movie" && card.runtime ? `${card.runtime} min` : null].filter(Boolean).join(" · ");

  if (ep)
    return (
      <a href={card.url} target="_blank" rel="noopener noreferrer" className="tmdb is-episode not-prose" aria-label={`${card.title}, temporada ${ep.season}, episodio ${ep.episode}${ep.title ? `: ${ep.title}` : ""}. Ver en TMDB`}>
        <span className="tmdb-still">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {(ep.still_url || card.backdrop_url) && <img src={ep.still_url ?? card.backdrop_url ?? ""} alt="" loading="lazy" />}
          <span className="tmdb-ep-badge">
            T{ep.season} · E{ep.episode}
            {ep.runtime ? <small>{ep.runtime} min</small> : null}
          </span>
        </span>
        <span className="tmdb-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {card.poster_url ? <img src={card.poster_url} alt="" loading="lazy" className="tmdb-poster is-small" /> : <span className="tmdb-poster is-small" />}
          <span className="tmdb-body">
            <span className="tmdb-kicker">{card.title}</span>
            <span className="tmdb-title">{ep.title ?? `Episodio ${ep.episode}`}</span>
            {ep.air_date && <span className="tmdb-sub">se estrenó el {shortDate(ep.air_date)}</span>}
          </span>
        </span>
        {(ep.overview || card.overview) && <span className="tmdb-overview">{ep.overview || card.overview}</span>}
        <Footer card={card} />
      </a>
    );

  return (
    <a href={card.url} target="_blank" rel="noopener noreferrer" className="tmdb not-prose" aria-label={`${card.title}${card.year ? ` (${card.year})` : ""}. Ver en TMDB`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {card.backdrop_url && <img src={card.backdrop_url} alt="" loading="lazy" className="tmdb-bd" />}
      <span className="tmdb-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {card.poster_url ? <img src={card.poster_url} alt="" loading="lazy" className="tmdb-poster" /> : <span className="tmdb-poster" />}
        <span className="tmdb-body">
          <span className="tmdb-kicker">{meta}</span>
          <span className="tmdb-title">{card.title}</span>
          {card.original_title && card.original_title !== card.title && <span className="tmdb-sub">{card.original_title}</span>}
          <span className="tmdb-facts">
            {card.rating ? (
              <span className="tmdb-rating">
                <Star size={12} fill="currentColor" /> {card.rating.toFixed(1)}
              </span>
            ) : null}
            {card.genres.map((g) => (
              <span key={g} className="tmdb-genre">
                {g}
              </span>
            ))}
          </span>
        </span>
      </span>
      {card.overview && <span className="tmdb-overview">{card.overview}</span>}
      <Footer card={card} />
    </a>
  );
}
