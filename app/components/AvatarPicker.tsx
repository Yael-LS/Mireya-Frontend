"use client";

import { useState } from "react";
import { Camera, RotateCcw, X } from "lucide-react";

export const DEFAULT_AVATAR = "/mireya.jpg";
const AVATAR_SIZE = 512;

// Recorta al centro en cuadrado y la reduce: el avatar siempre se ve redondo.
async function squarePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(AVATAR_SIZE, side);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

type Props = {
  current: string;
  onChange: (url: string) => void;
  onClose: () => void;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};

export default function AvatarPicker({ current, onChange, onClose, api }: Props) {
  const [preview, setPreview] = useState(current);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const save = async (file: File | undefined) => {
    if (!file) return;
    setStatus("saving");
    try {
      const photo = await squarePhoto(file);
      setPreview(photo);
      const { url } = await api<{ url: string | null }>("profile/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_base64: photo, photo_type: "image/jpeg" }),
      });
      onChange(url ?? photo);
      setStatus("idle");
    } catch {
      setPreview(current);
      setStatus("error");
    }
  };

  const reset = async () => {
    setStatus("saving");
    try {
      await api("profile/photo", { method: "DELETE" });
      setPreview(DEFAULT_AVATAR);
      onChange(DEFAULT_AVATAR);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#381a24]/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bubble-in relative w-full max-w-sm rounded-[2rem] border border-white bg-[#fff8fa] px-6 pb-6 pt-8 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <span aria-hidden="true" className="panel-tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" />
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 rounded-full p-2 text-[#8f475a] hover:bg-[#fae6ec]">
          <X size={18} />
        </button>

        <p className="font-hand text-2xl leading-none text-[#d9567a]">tu foto</p>
        <div className={`mx-auto mt-4 size-40 overflow-hidden rounded-full shadow-[0_0_0_5px_#fff,0_0_0_8px_rgba(240,202,213,.95),0_18px_30px_-12px_rgba(122,44,67,.6)] ${status === "saving" ? "animate-pulse" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Foto de perfil de Mireya" className="h-full w-full object-cover" />
        </div>

        <label className="mt-6 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#4a2230] px-5 text-sm font-medium text-[#fff3f6] transition hover:bg-[#3d1d27]">
          <Camera size={16} />
          {status === "saving" ? "Guardando…" : "Elegir otra foto"}
          <input type="file" accept="image/*" className="sr-only" disabled={status === "saving"} onChange={(event) => void save(event.target.files?.[0])} />
        </label>
        {preview !== DEFAULT_AVATAR && (
          <button type="button" onClick={() => void reset()} disabled={status === "saving"} className="mt-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm text-[#7a2c43] hover:bg-[#fae6ec]">
            <RotateCcw size={14} /> Volver a la original
          </button>
        )}
        {status === "error" && <p className="mt-2 text-xs text-rose-600">No se pudo cambiar la foto. Intenta con otra.</p>}
      </div>
    </div>
  );
}
