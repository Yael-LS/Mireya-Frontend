"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, Music, Tv } from "lucide-react";
import { SKIP_CURTAIN_KEY } from "../components/WelcomeCurtain";
import { Etapas } from "./Etapas";
import { AddSeries, SeriesHome, SeriesPage } from "./Series";
import { AddSong, SongPage, SongsHome } from "./Songs";
import type { Companion, Episode, MonthNote, Show, Song } from "./types";
import { json, nextEpisode } from "./types";

type Tab = "songs" | "series" | "etapas";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { cache: "no-store", ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "No se pudo completar la operación.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const TABS: { id: Tab; label: string; icon: typeof Music }[] = [
  { id: "songs", label: "Canciones", icon: Music },
  { id: "series", label: "Series", icon: Tv },
  { id: "etapas", label: "Por etapas", icon: CalendarDays },
];

export default function AcompanaPage() {
  const router = useRouter();
  const [data, setData] = useState<Companion | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("songs");
  const [songId, setSongId] = useState<string | null>(null);
  const [showId, setShowId] = useState<string | null>(null);
  const [adding, setAdding] = useState<"song" | "series" | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Companion>("acompana"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude abrir este espacio.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const { unlocked } = await fetch("/api/unlock", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ unlocked: false }));
      if (!unlocked) return router.replace("/");
      await load();
    })();
  }, [router, load]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab, songId, showId]);

  const update = (change: (current: Companion) => Companion) => setData((current) => (current ? change(current) : current));
  const putSong = (song: Song) => update((d) => ({ ...d, songs: d.songs.some((s) => s.id === song.id) ? d.songs.map((s) => (s.id === song.id ? song : s)) : [song, ...d.songs] }));
  const putShow = (show: Show) => update((d) => ({ ...d, series: d.series.some((s) => s.id === show.id) ? d.series.map((s) => (s.id === show.id ? show : s)) : [show, ...d.series] }));
  const putMonth = (note: MonthNote) => update((d) => ({ ...d, months: [note, ...d.months.filter((m) => m.month !== note.month)] }));

  const removeSong = async (song: Song) => {
    setSongId(null);
    update((d) => ({ ...d, songs: d.songs.filter((s) => s.id !== song.id), picks: d.picks.filter((p) => p.song_id !== song.id) }));
    await api(`acompana/songs/${song.id}`, { method: "DELETE" }).catch(() => load());
  };
  const removeShow = async (show: Show) => {
    setShowId(null);
    update((d) => ({ ...d, series: d.series.filter((s) => s.id !== show.id) }));
    await api(`acompana/series/${show.id}`, { method: "DELETE" }).catch(() => load());
  };
  const watchNext = async (show: Show) => {
    const next = nextEpisode(show);
    if (!next) return;
    try {
      const saved = await api<Episode>(`acompana/series/${show.id}/episodes`, { method: "POST", ...json(next) });
      putShow({ ...show, episodes: [...show.episodes, saved], started_at: show.started_at ?? saved.watched_at.slice(0, 10) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el capítulo.");
    }
  };

  const markSkipCurtain = () => {
    try {
      sessionStorage.setItem(SKIP_CURTAIN_KEY, "1");
    } catch {
      // Sin sessionStorage solo se repite el telón.
    }
  };

  const song = data?.songs.find((s) => s.id === songId) ?? null;
  const show = data?.series.find((s) => s.id === showId) ?? null;

  return (
    <main className="refugio-bg relative min-h-dvh overflow-x-hidden pb-14 text-[#42222b]">
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-6 sm:px-8 sm:pt-9">
        {!song && !show && (
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" onClick={markSkipCurtain} className="acm-back !text-[#9e3b56]">
                <ChevronLeft size={16} /> volver al chat
              </Link>
              <h1 className="font-hand text-[50px] font-semibold leading-[.9] text-[#9e3b56] sm:text-[62px]">playlist</h1>
              <p className="mt-2 text-sm text-[#7d4a5a]">las canciones y las historias de cada etapa, con lo que me hicieron sentir</p>
            </div>
            <nav aria-label="Secciones" className="flex flex-wrap gap-2">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`acm-tab ${tab === id ? "is-on" : ""}`}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </nav>
          </header>
        )}

        {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

        <div className={song || show ? "" : "mt-8"}>
          {!data ? (
            !error && <p className="animate-pulse py-16 text-center font-hand text-3xl text-[#b07d8d]">abriendo tu playlist…</p>
          ) : song ? (
            <SongPage key={song.id} api={api} song={song} data={data} onBack={() => setSongId(null)} onChange={putSong} onRemove={(s) => void removeSong(s)} onPicks={(picks) => update((d) => ({ ...d, picks }))} />
          ) : show ? (
            <SeriesPage key={show.id} api={api} show={show} onBack={() => setShowId(null)} onChange={putShow} onRemove={(s) => void removeShow(s)} />
          ) : tab === "songs" ? (
            <SongsHome data={data} onOpen={(s) => setSongId(s.id)} onAdd={() => setAdding("song")} />
          ) : tab === "series" ? (
            <SeriesHome data={data} onOpen={(s) => setShowId(s.id)} onAdd={() => setAdding("series")} onWatch={(s) => void watchNext(s)} />
          ) : (
            <Etapas api={api} data={data} onOpenSong={(s) => setSongId(s.id)} onOpenShow={(s) => setShowId(s.id)} onMonth={putMonth} onPicks={(picks) => update((d) => ({ ...d, picks }))} />
          )}
        </div>
      </div>

      {adding === "song" && (
        <AddSong
          api={api}
          onClose={() => setAdding(null)}
          onAdded={(s) => {
            putSong(s);
            setAdding(null);
            setSongId(s.id);
          }}
        />
      )}
      {adding === "series" && (
        <AddSeries
          api={api}
          onClose={() => setAdding(null)}
          onAdded={(s) => {
            putShow(s);
            setAdding(null);
            setShowId(s.id);
          }}
        />
      )}
    </main>
  );
}
