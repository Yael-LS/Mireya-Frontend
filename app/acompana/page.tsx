"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, Music, Plus, Tv } from "lucide-react";
import { Etapas } from "./Etapas";
import { AddSeries, SeriesHome, SeriesPage } from "./Series";
import { AddSong, ChooseSong, SongPage, SongsHome } from "./Songs";
import type { PickSlot } from "./Songs";
import { Dock, markSkipCurtain } from "./shared";
import type { Tab } from "./shared";
import type { Companion, Episode, MonthNote, Show, Song } from "./types";
import { json, nextEpisode, periodStart } from "./types";

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
  { id: "songs", label: "canciones", icon: Music },
  { id: "series", label: "series", icon: Tv },
  { id: "etapas", label: "por etapas", icon: CalendarDays },
];

const TITLES: Record<Tab, { title: string; sub: string }> = {
  songs: { title: "playlist", sub: "las canciones y las historias que me acompañan, con lo que me hacen sentir" },
  series: { title: "lo que estoy viendo", sub: "series, k-dramas y animes, con lo que me van dejando" },
  etapas: { title: "por etapas", sub: "qué me acompañó cada mes: la canción, las semanas y las historias" },
};

// El disco del encabezado, con su brazo, para el celular.
function HeadDisc() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="head-disc">
      <circle cx="50" cy="50" r="46" fill="#070608" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,.07)" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,.07)" />
      <circle cx="50" cy="50" r="15" fill="#f7a8bf" />
      <circle cx="50" cy="50" r="3" fill="#121114" />
      <path d="M92 8 L64 38" stroke="#f3cf8e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="92" cy="8" r="5" fill="#f3cf8e" />
    </svg>
  );
}

export default function AcompanaPage() {
  const router = useRouter();
  const [data, setData] = useState<Companion | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("songs");
  const [songId, setSongId] = useState<string | null>(null);
  const [showId, setShowId] = useState<string | null>(null);
  const [adding, setAdding] = useState<"song" | "series" | null>(null);
  const [choosing, setChoosing] = useState<PickSlot | null>(null);

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
  const putPicks = (picks: Companion["picks"]) => update((d) => ({ ...d, picks }));

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

  const song = data?.songs.find((s) => s.id === songId) ?? null;
  const show = data?.series.find((s) => s.id === showId) ?? null;
  const openTab = (next: Tab) => {
    setSongId(null);
    setShowId(null);
    setTab(next);
  };
  // El + del celular agrega lo que corresponde a donde está.
  const addKind: "song" | "series" = show || (tab === "series" && !song) ? "series" : "song";
  const add = () => setAdding(addKind);

  return (
    <main className="pl">
      {song && data ? (
        <SongPage key={song.id} api={api} song={song} data={data} onBack={() => setSongId(null)} onChange={putSong} onRemove={(s) => void removeSong(s)} onPicks={putPicks} />
      ) : show ? (
        <SeriesPage key={show.id} api={api} show={show} onBack={() => setShowId(null)} onChange={putShow} onRemove={(s) => void removeShow(s)} />
      ) : (
        <div className="wrap">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" onClick={markSkipCurtain} className="back">
              <ChevronLeft size={16} /> <span className="lg:hidden">al chat</span>
              <span className="hidden lg:inline">volver al chat</span>
            </Link>
            {data && (
              <span className="hand text-[19px] text-[var(--cream-dim)] lg:hidden">
                {data.songs.length} {data.songs.length === 1 ? "canción" : "canciones"} · {data.series.length} series
              </span>
            )}
          </div>
          <header className="head relative mt-1.5">
            <div className="min-w-0 pr-24 lg:pr-0">
              <h1 className="brand">{TITLES[tab].title}</h1>
              <p className="brand-sub">{TITLES[tab].sub}</p>
            </div>
            <div className="head-tools">
              <nav className="tabs" aria-label="Secciones de la playlist">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => openTab(id)} aria-pressed={tab === id}>
                    <Icon size={17} /> {label}
                  </button>
                ))}
              </nav>
              {tab !== "etapas" && (
                <button type="button" onClick={add} className="btn btn-rose !min-h-[50px] !px-[22px]">
                  <Plus size={18} strokeWidth={2.4} /> {tab === "series" ? "agregar una serie" : "agregar una canción"}
                </button>
              )}
            </div>
            {tab === "songs" && <HeadDisc />}
          </header>

          {error && <p className="err mt-4">{error}</p>}

          <div className="mt-7 lg:mt-9">
            {!data ? (
              !error && <p className="hand animate-pulse py-16 text-center text-3xl text-[var(--cream-dim)]">poniendo el disco…</p>
            ) : tab === "songs" ? (
              <SongsHome data={data} onOpen={(s) => setSongId(s.id)} onChoose={(kind) => setChoosing({ kind, period: periodStart(kind, data.today) })} onHistory={() => openTab("etapas")} />
            ) : tab === "series" ? (
              <SeriesHome api={api} data={data} onOpen={(s) => setShowId(s.id)} onAdd={() => setAdding("series")} onWatch={(s) => void watchNext(s)} />
            ) : (
              <Etapas api={api} data={data} onOpenSong={(s) => setSongId(s.id)} onOpenShow={(s) => setShowId(s.id)} onMonth={putMonth} onPicks={putPicks} onAdded={putSong} />
            )}
          </div>
        </div>
      )}

      <Dock tab={song || show ? null : tab} onTab={openTab} onAdd={add} addLabel={addKind === "series" ? "Agregar una serie" : "Agregar una canción"} />

      {adding === "song" && (
        <AddSong
          api={api}
          onClose={() => setAdding(null)}
          onAdded={(s) => {
            putSong(s);
            setAdding(null);
            setShowId(null);
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
            setSongId(null);
            setShowId(s.id);
          }}
        />
      )}
      {choosing && data && <ChooseSong api={api} data={data} slot={choosing} onClose={() => setChoosing(null)} onPicks={putPicks} onAdded={putSong} />}
    </main>
  );
}
