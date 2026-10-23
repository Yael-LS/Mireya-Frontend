import type { NextRequest } from "next/server";

export const UNLOCK_COOKIE = "mireya_unlocked";
export const UNLOCK_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

// La cookie guarda un HMAC derivado del PIN: no revela el PIN y, si el PIN
// cambia, todas las sesiones abiertas quedan cerradas solas.
async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function configuredPin(): string | undefined {
  return process.env.APP_PIN?.trim() || undefined;
}

export async function unlockToken(): Promise<string | null> {
  const pin = configuredPin();
  if (!pin) return null;
  return hmac(`${pin}:${process.env.PIN_SECRET ?? ""}`, "mireya-refugio-v1");
}

export async function isUnlocked(request: NextRequest): Promise<boolean> {
  const expected = await unlockToken();
  // Sin APP_PIN configurado el sitio queda abierto (útil en desarrollo).
  if (!expected) return true;
  return request.cookies.get(UNLOCK_COOKIE)?.value === expected;
}

export function lockedResponse() {
  return Response.json({ detail: "Escribe tu clave para entrar." }, { status: 401 });
}

// ---------- Clave del Refugio ----------
// Cookie de sesión (se borra al cerrar el navegador) que además caduca a las 2 h.
export const REFUGIO_COOKIE = "mireya_refugio";
export const REFUGIO_TTL_SECONDS = 2 * 60 * 60;

export async function refugioToken(issuedAt: number): Promise<string> {
  const secret = `${configuredPin() ?? ""}:${process.env.PIN_SECRET ?? ""}:refugio`;
  return `${issuedAt}.${await hmac(secret, `refugio:${issuedAt}`)}`;
}

export async function isRefugioUnlocked(request: NextRequest): Promise<boolean> {
  const value = request.cookies.get(REFUGIO_COOKIE)?.value;
  const issuedAt = Number(value?.split(".")[0]);
  if (!value || !issuedAt || Date.now() / 1000 - issuedAt > REFUGIO_TTL_SECONDS) return false;
  return value === (await refugioToken(issuedAt));
}

export function refugioLockedResponse() {
  return Response.json({ detail: "El Refugio está cerrado: escribe su clave." }, { status: 401 });
}
