import { NextRequest, NextResponse } from "next/server";
import { backendApiUrl, backendHeaders } from "../../lib/backend";
import { REFUGIO_COOKIE, isRefugioUnlocked, isUnlocked, lockedResponse, refugioToken } from "../../lib/unlock";

async function backend(path: string, init?: RequestInit) {
  return fetch(backendApiUrl(`refugio/lock${path}`), { ...init, headers: backendHeaders(), cache: "no-store" });
}

async function withRefugioCookie(body: unknown) {
  const response = NextResponse.json(body);
  // Sin maxAge: se borra al cerrar el navegador; el token además caduca a las 2 h.
  response.cookies.set(REFUGIO_COOKIE, await refugioToken(Math.floor(Date.now() / 1000)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

// Estado del candado y la pista (nunca la clave).
export async function GET(request: NextRequest) {
  if (!(await isUnlocked(request))) return lockedResponse();
  try {
    const upstream = await backend("");
    // Si el backend falla, el Refugio NO se abre por error.
    if (!upstream.ok) throw new Error(`backend ${upstream.status}`);
    const { configured, hint } = await upstream.json();
    // Si aún no hay clave configurada, el Refugio se abre como antes.
    if (!configured) return withRefugioCookie({ unlocked: true, configured: false, hint: null });
    return Response.json({ unlocked: await isRefugioUnlocked(request), configured: true, hint });
  } catch {
    return Response.json({ detail: "No fue posible conectar con Mireya AI." }, { status: 502 });
  }
}

// Abrir el Refugio con su clave.
export async function POST(request: NextRequest) {
  if (!(await isUnlocked(request))) return lockedResponse();
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const upstream = await backend("/verify", { method: "POST", body: JSON.stringify({ pin }) }).catch(() => null);
  if (!upstream?.ok) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return Response.json({ unlocked: false }, { status: upstream?.status === 429 ? 429 : 401 });
  }
  return withRefugioCookie({ unlocked: true });
}

// Cambiar la clave y la pista (pide la clave actual).
export async function PATCH(request: NextRequest) {
  if (!(await isUnlocked(request))) return lockedResponse();
  const upstream = await backend("/change", { method: "POST", body: await request.text() }).catch(() => null);
  if (!upstream) return Response.json({ detail: "No fue posible conectar con Mireya AI." }, { status: 502 });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return Response.json(payload, { status: upstream.status });
  return withRefugioCookie({ ok: true });
}
