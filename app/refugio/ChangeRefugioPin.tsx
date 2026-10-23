"use client";

import { FormEvent, useState } from "react";
import { KeyRound, X } from "lucide-react";

type Props = {
  currentHint: string | null;
  onClose: () => void;
  onChanged: (hint: string | null) => void;
};

const SIX_DIGITS = /^\d{6}$/;

export default function ChangeRefugioPin({ currentHint, onClose, onChanged }: Props) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [repeatPin, setRepeatPin] = useState("");
  const [hint, setHint] = useState(currentHint ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!SIX_DIGITS.test(newPin)) return setError("La clave nueva debe tener 6 números.");
    if (newPin !== repeatPin) return setError("Las claves nuevas no coinciden.");
    if (!hint.trim()) return setError("Escribe una pista para que no se te olvide.");
    setStatus("saving");
    const response = await fetch("/api/refugio-lock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_pin: currentPin, new_pin: newPin, hint: hint.trim() }),
    }).catch(() => null);
    if (!response?.ok) {
      setStatus("idle");
      const payload = await response?.json().catch(() => null);
      return setError(
        response?.status === 429 ? "Demasiados intentos; espera un minuto." : payload?.detail ?? "No se pudo cambiar la clave."
      );
    }
    setStatus("saved");
    onChanged(hint.trim());
    setTimeout(onClose, 1200);
  };

  const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 6);
  const field =
    "mt-1 w-full rounded-2xl border border-[#f0cad5] bg-white px-3.5 py-2.5 text-center text-lg tracking-[.5em] text-[#3f1f2a] outline-none focus:border-[#d9567a] focus:ring-4 focus:ring-[#fae6ec]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#381a24]/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="bubble-in relative w-full max-w-sm rounded-[2rem] border border-white bg-[#fff8fa] p-6 shadow-2xl">
        <span aria-hidden="true" className="panel-tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" />
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 rounded-full p-2 text-[#8f475a] hover:bg-[#fae6ec]">
          <X size={18} />
        </button>
        <p className="flex items-center gap-2 font-hand text-2xl text-[#d9567a]">
          <KeyRound size={18} /> la llave de tu Refugio
        </p>
        <h2 className="font-display text-3xl font-semibold text-[#421f2b]">Cambiar clave</h2>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-[#7a2c43]">
            Clave actual
            <input type="password" inputMode="numeric" autoComplete="current-password" value={currentPin} onChange={(event) => setCurrentPin(digitsOnly(event.target.value))} required className={field} />
          </label>
          <label className="block text-xs font-medium text-[#7a2c43]">
            Clave nueva (6 números)
            <input type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(digitsOnly(event.target.value))} required className={field} />
          </label>
          <label className="block text-xs font-medium text-[#7a2c43]">
            Repite la clave nueva
            <input type="password" inputMode="numeric" autoComplete="new-password" value={repeatPin} onChange={(event) => setRepeatPin(digitsOnly(event.target.value))} required className={field} />
          </label>
          <label className="block text-xs font-medium text-[#7a2c43]">
            Pista (para que no se te olvide)
            <input value={hint} onChange={(event) => setHint(event.target.value)} maxLength={200} className="mt-1 w-full rounded-2xl border border-[#f0cad5] bg-white px-3.5 py-2.5 text-sm text-[#3f1f2a] outline-none focus:border-[#d9567a] focus:ring-4 focus:ring-[#fae6ec]" />
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={status !== "idle" || currentPin.length !== 6}
          className="mt-5 w-full rounded-full bg-[#4a2230] py-3 text-sm font-medium text-[#fff3f6] transition hover:bg-[#3d1d27] disabled:bg-[#edd0d7]"
        >
          {status === "saving" ? "Guardando…" : status === "saved" ? "¡Listo! Clave cambiada" : "Guardar nueva clave"}
        </button>
      </form>
    </div>
  );
}
