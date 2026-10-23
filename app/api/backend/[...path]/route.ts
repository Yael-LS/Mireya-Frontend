import { NextRequest } from "next/server";
import { backendApiUrl, backendHeaders } from "../../../lib/backend";
import { isRefugioUnlocked, isUnlocked, lockedResponse, refugioLockedResponse } from "../../../lib/unlock";

// Lo del Refugio pide además su propia clave. Excepción: desde el chat, al
// guardar un recuerdo, se puede aceptar una sugerencia o deshacer lo agregado
// sin abrir el Refugio (ni leer nada de él).
function needsRefugioKey(path: string[], method: string) {
  if (path[0] !== "refugio") return false;
  const fromChat =
    (method === "POST" && path.length === 2 && path[1] === "items") ||
    (method === "DELETE" && path.length === 3 && path[1] === "items");
  return !fromChat;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!(await isUnlocked(request))) return lockedResponse();
  const { path } = await context.params;
  if (needsRefugioKey(path, request.method) && !(await isRefugioUnlocked(request))) return refugioLockedResponse();
  const hasBody = !["GET", "HEAD"].includes(request.method);
  try {
    const upstream = await fetch(backendApiUrl(path.join("/")), {
      method: request.method,
      headers: backendHeaders(),
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
    if (upstream.status === 204) return new Response(null, { status: 204 });
    const payload = await upstream.text();
    return new Response(payload, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch {
    return Response.json({ detail: "No fue posible conectar con Mireya AI." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
