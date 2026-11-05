import { NextRequest } from "next/server";
import { backendApiUrl, backendHeaders } from "../../lib/backend";
import { diaryCookie, isDiaryUnlocked, isUnlocked, lockedResponse } from "../../lib/unlock";

function backend(path: string, init?: RequestInit) {
  return fetch(backendApiUrl(`diario-lock${path}`), { ...init, headers: backendHeaders(), cache: "no-store" });
}

async function openDiary(body: unknown) {
  const response = Response.json(body);
  response.headers.append("Set-Cookie", await diaryCookie());
  return response;
}

// Estado del candado y la pista (nunca la clave).
export async function GET(request: NextRequest) {
  if (!(await isUnlocked(request))) return lockedResponse();
  try {
    const upstream = await backend("");
    // Si el backend falla, el diario NO se abre por error.
    if (!upstream.ok) throw new Error(`backend ${upstream.status}`);
    const { configured, hint } = await upstream.json();
    if (!configured) return openDiary({ unlocked: true, hint: null });
    return Response.json({ unlocked: await isDiaryUnlocked(request), hint });
  } catch {
    return Response.json({ detail: "No fue posible conectar con Mireya AI." }, { status: 502 });
  }
}

// Abrir el diario con su clave.
export async function POST(request: NextRequest) {
  if (!(await isUnlocked(request))) return lockedResponse();
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const upstream = await backend("/verify", { method: "POST", body: JSON.stringify({ pin }) }).catch(() => null);
  if (!upstream?.ok) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return Response.json({ unlocked: false }, { status: upstream?.status === 429 ? 429 : 401 });
  }
  return openDiary({ unlocked: true });
}
