import { NextRequest } from "next/server";

export const runtime = "edge";

function backendUrl(path: string[]) {
  const base = process.env.BACKEND_URL ?? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  return `${base.replace(/\/$/, "").replace(/\/v1\/responses$/, "")}/api/${path.join("/")}`;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const apiKey = process.env.SERVICE_API_KEY ?? process.env.API_KEY;
  const hasBody = !["GET", "HEAD"].includes(request.method);
  try {
    const upstream = await fetch(backendUrl(path), {
      method: request.method,
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
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
