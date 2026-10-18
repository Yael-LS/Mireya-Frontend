"use client";

import { FormEvent, useState } from "react";
import { Camera, X } from "lucide-react";
import { KIND_LABELS } from "../components/refugio-types";
import type { RefugioItem, RefugioKind } from "../components/refugio-types";

const ITEM_KINDS: RefugioKind[] = ["song", "series", "kdrama", "anime", "movie", "book", "quote", "other"];

// Las fotos del celular pesan varios MB: se reducen a 1600 px antes de subir.
export async function resizePhoto(file: File, maxSide = 1600): Promise<{ photo_base64: string; photo_type: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { photo_base64: canvas.toDataURL("image/jpeg", 0.85), photo_type: "image/jpeg" };
}

type Props = {
  onClose: () => void;
  onAdded: (item: RefugioItem) => void;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};

export default function AddToRefugio({ onClose, onAdded, api }: Props) {
  const [tab, setTab] = useState<"moment" | "item">("moment");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [note, setNote] = useState("");
  const [momentDate, setMomentDate] = useState("");
  const [kind, setKind] = useState<RefugioKind>("song");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || status === "saving") return;
    setStatus("saving");
    setError("");
    try {
      const created =
        tab === "moment"
          ? await api<RefugioItem>("refugio/moments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                note: note || null,
                moment_date: momentDate || null,
                ...(photo ? await resizePhoto(photo) : {}),
              }),
            })
          : await api<RefugioItem>("refugio/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, title, creator: creator || null, note: note || null }),
            });
      onAdded(created);
      onClose();
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    }
  };

  const field = "w-full rounded-2xl border border-[#f0cad5] bg-white px-3.5 py-2.5 text-sm text-[#3f1f2a] outline-none focus:border-[#d9567a] focus:ring-4 focus:ring-[#fae6ec]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#381a24]/30 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="bubble-in w-full max-w-md rounded-[2rem] border border-white bg-[#fff8fa] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-hand text-xl leading-none text-[#d9567a]">para los días grises</p>
            <h2 className="font-display text-3xl font-semibold text-[#421f2b]">Agregar al Refugio</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 text-[#8f475a] hover:bg-[#fae6ec]">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-[#fbe1e9] p-1 text-sm">
          {(["moment", "item"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-full py-2 transition ${tab === value ? "bg-white font-medium text-[#4a2230] shadow-sm" : "text-[#7a2c43]"}`}
            >
              {value === "moment" ? "Un momento feliz" : "Algo que me gusta"}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {tab === "moment" ? (
            <>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-[#e3a6b8] bg-white/60 text-[#b8456a]" style={{ minHeight: 150 }}>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Foto elegida" className="h-44 w-full object-cover" />
                ) : (
                  <>
                    <Camera size={28} strokeWidth={1.6} />
                    <span className="font-hand text-xl">elige una foto</span>
                  </>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => pickPhoto(event.target.files?.[0])} />
              </label>
              <label className="block text-xs font-medium text-[#7a2c43]">
                Una frase para recordarlo
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required placeholder="el día de mi graduación" className={`${field} mt-1`} />
              </label>
              <label className="block text-xs font-medium text-[#7a2c43]">
                Fecha (opcional)
                <input type="date" value={momentDate} onChange={(event) => setMomentDate(event.target.value)} className={`${field} mt-1`} />
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs font-medium text-[#7a2c43]">
                ¿Qué es?
                <select value={kind} onChange={(event) => setKind(event.target.value as RefugioKind)} className={`${field} mt-1`}>
                  {ITEM_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {KIND_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[#7a2c43]">
                {kind === "quote" ? "La frase" : "Título"}
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required className={`${field} mt-1`} />
              </label>
              {kind !== "quote" && (
                <label className="block text-xs font-medium text-[#7a2c43]">
                  {kind === "song" ? "Artista" : "De quién es (opcional)"}
                  <input value={creator} onChange={(event) => setCreator(event.target.value)} maxLength={120} className={`${field} mt-1`} />
                </label>
              )}
            </>
          )}
          <label className="block text-xs font-medium text-[#7a2c43]">
            ¿Por qué te hace bien? (opcional)
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} className={`${field} mt-1`} />
          </label>
        </div>

        {status === "error" && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={!title.trim() || status === "saving"}
          className="mt-5 w-full rounded-full bg-[#4a2230] py-3 text-sm font-medium text-[#fff3f6] transition hover:bg-[#3d1d27] disabled:bg-[#edd0d7]"
        >
          {status === "saving" ? "Guardando…" : "Guardar en mi Refugio"}
        </button>
      </form>
    </div>
  );
}
