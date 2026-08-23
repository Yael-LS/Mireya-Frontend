import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const apiUrl =
    process.env.BACKEND_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:8000/v1/responses";
  const apiKey = process.env.SERVICE_API_KEY ?? process.env.API_KEY;

  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text();
      return Response.json(
        { detail: detail || "No se pudo contactar al agente." },
        { status: upstream.status || 502 }
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json(
      { detail: "No fue posible conectar con Mireya AI. Confirma que el agente esté encendido." },
      { status: 502 },
    );
  }
}