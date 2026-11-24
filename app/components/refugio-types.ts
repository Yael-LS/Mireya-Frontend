export type RefugioKind = "song" | "series" | "kdrama" | "anime" | "movie" | "book" | "quote" | "moment" | "other";

export type RefugioItem = {
  id: string;
  kind: RefugioKind;
  title: string;
  creator: string | null;
  note: string | null;
  url: string | null;
  photo_path: string | null;
  photo_url?: string | null;
  moment_date: string | null;
  source: "profile" | "memory" | "manual";
  created_at: string;
};

// Lo que el clasificador propone con dudas: aún no existe en la base.
export type RefugioSuggestion = Pick<RefugioItem, "kind" | "title" | "creator" | "note" | "url">;

export const KIND_LABELS: Record<RefugioKind, string> = {
  song: "canción",
  series: "serie",
  kdrama: "drama asiático",
  anime: "anime",
  movie: "película",
  book: "libro",
  quote: "frase",
  moment: "momento feliz",
  other: "cosita bonita",
};

// Puente entre el Refugio y el chat: el momento que ella quiere recordar.
export const RECALL_KEY = "mireya:recordar";
// `prompt` y `mode` los usa «Lo que me acompaña»: abre una charla normal con su propio mensaje.
export type RecallMoment = { title: string; prompt?: string; mode?: "normal" | "nostalgia" };
