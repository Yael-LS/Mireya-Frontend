import { NextRequest, NextResponse } from "next/server";
import { UNLOCK_COOKIE, UNLOCK_MAX_AGE, configuredPin, isUnlocked, unlockToken } from "../../lib/unlock";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  return Response.json({ unlocked: await isUnlocked(request) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const expected = configuredPin();

  if (!expected || pin !== expected) {
    // Pausa breve para que adivinar a fuerza bruta sea lento.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return Response.json({ unlocked: false }, { status: 401 });
  }

  const response = NextResponse.json({ unlocked: true });
  response.cookies.set(UNLOCK_COOKIE, (await unlockToken())!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UNLOCK_MAX_AGE,
    path: "/",
  });
  return response;
}
