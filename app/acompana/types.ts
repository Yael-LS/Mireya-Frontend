// Lo que me acompaña: tipos y utilidades compartidas entre Canciones, Series y Por etapas.

export type Mood = "heartbreak" | "strength" | "nostalgia" | "dance";
export type Status = "pending" | "watching" | "finished" | "paused" | "dropped";
export type PickKind = "day" | "week" | "month";

export type Song = {
  id: string;
  spotify_id: string | null;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  spotify_url: string | null;
  lyric: string | null;
  note: string | null;
  mood: Mood | null;
  mood_label: string | null;
  share: boolean;
  created_at: string;
  updated_at: string;
};

export type Pick = { kind: PickKind; period: string; song_id: string };

export type Episode = { id: string; series_id: string; season: number; episode: number; title: string | null; note: string | null; watched_at: string };

export type Season = { n: number; count: number; name: string | null };

export type Show = {
  id: string;
  tmdb_id: number | null;
  title: string;
  alt_title: string | null;
  original_title: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  kind: string;
  year: string | null;
  seasons: Season[];
  total_episodes: number;
  status: Status;
  note: string | null;
  characters: string[];
  final_opinion: string | null;
  rating: number | null;
  share: boolean;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  episodes: Episode[];
};

export type MonthNote = { month: string; summary: string; updated_at: string };

export type Companion = { today: string; songs: Song[]; picks: Pick[]; series: Show[]; months: MonthNote[] };

export type Api = <T>(path: string, options?: RequestInit) => Promise<T>;

export const json = (body: unknown): RequestInit => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const MOODS: { id: Mood; label: string; decor: string }[] = [
  { id: "heartbreak", label: "me rompe el corazón", decor: "sombras de persiana, café y hojas secas" },
  { id: "strength", label: "me da fuerzas", decor: "luz de mañana, flores y un dorado tibio" },
  { id: "nostalgia", label: "me pone nostálgica", decor: "lluvia en la ventana y azul niebla" },
  { id: "dance", label: "me hace bailar", decor: "confeti, estrellitas y rosa brillante" },
];
export const moodLabel = (song: { mood: Mood | null; mood_label?: string | null }) => song.mood_label || MOODS.find((m) => m.id === song.mood)?.label || null;

export const STATUSES: { id: Status; label: string; plural: string }[] = [
  { id: "watching", label: "viendo", plural: "viendo" },
  { id: "pending", label: "pendiente", plural: "pendientes" },
  { id: "finished", label: "terminada", plural: "terminadas" },
  { id: "paused", label: "en pausa", plural: "en pausa" },
  { id: "dropped", label: "abandonada", plural: "abandonadas" },
];
export const statusLabel = (status: Status) => STATUSES.find((s) => s.id === status)?.label ?? status;

export const KIND_LABELS: Record<string, string> = { anime: "anime", kdrama: "k-drama", cdrama: "c-drama", jdrama: "j-drama", asian: "drama asiático", series: "serie" };

// ---------- Fechas en hora del centro de México ----------
const ZONE = "America/Mexico_City";
const fmt = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-MX", { timeZone: ZONE, ...options }).format(new Date(iso));
// Una fecha sola ("2026-11-23") se lee a mediodía para que la zona horaria no la mueva de día.
const asDate = (value: string) => (value.length === 10 ? `${value}T12:00:00-06:00` : value);

export const dayMonth = (value: string) => fmt(asDate(value), { day: "numeric", month: "long" });
export const shortDate = (value: string) => fmt(asDate(value), { day: "numeric", month: "short" }).replace(".", "");
export const timeOf = (value: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-MX", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute} ${(parts.dayPeriod ?? "").replace(/[\s.]/g, "").toLowerCase()}`.trim();
};
export const monthKey = (value: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit" }).formatToParts(new Date(asDate(value))).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
};
export const monthName = (key: string) => fmt(`${key}-15T12:00:00-06:00`, { month: "long", year: "numeric" }).replace(" de ", " ");

export function periodStart(kind: PickKind, todayIso: string) {
  const day = new Date(`${todayIso}T12:00:00Z`);
  if (kind === "week") day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  if (kind === "month") day.setUTCDate(1);
  return day.toISOString().slice(0, 10);
}

// El siguiente capítulo por ver: después del último que marcó, en orden de temporadas.
export function nextEpisode(show: Show): { season: number; episode: number } | null {
  const seasons = [...show.seasons].sort((a, b) => a.n - b.n);
  if (!seasons.length) return null;
  const watched = new Set(show.episodes.map((e) => `${e.season}-${e.episode}`));
  const last = [...show.episodes].sort((a, b) => a.season - b.season || a.episode - b.episode).pop();
  const start = last ? { season: last.season, episode: last.episode } : { season: seasons[0].n, episode: 0 };
  for (const season of seasons) {
    if (season.n < start.season) continue;
    for (let ep = season.n === start.season ? start.episode + 1 : 1; ep <= season.count; ep++) {
      if (!watched.has(`${season.n}-${ep}`)) return { season: season.n, episode: ep };
    }
  }
  return null;
}
