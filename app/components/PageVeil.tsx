"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Color de cada lugar: el velo se funde hacia el color del lugar al que va.
const COLORS: Record<string, string> = { "/": "#f8dbe3", "/refugio": "#f9e4ea", "/diario": "#cfe3f5" };
const NAVIGATE_EVENT = "mireya:navigate";
const FADE_IN_MS = 260;
// Si la página tarda de más, el velo se quita de todos modos.
const MAX_VEIL_MS = 8000;

type Veil = { color: string; phase: "in" | "out" };

/** Cambia de lugar con el velo, para los casos en que no hay un enlace de por medio. */
export function softNavigate(href: string) {
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: href }));
}

// Funde el cambio entre el chat, el Refugio y el diario en lugar de saltar de golpe.
export default function PageVeil() {
  const router = useRouter();
  const pathname = usePathname();
  const [veil, setVeil] = useState<Veil | null>(null);
  const firstRender = useRef(true);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback(
    (href: string) => {
      if (href === pathname) return;
      setVeil({ color: COLORS[href], phase: "in" });
      setTimeout(() => router.push(href), FADE_IN_MS);
      failsafe.current = setTimeout(() => setVeil((current) => current && { ...current, phase: "out" }), MAX_VEIL_MS);
    },
    [pathname, router]
  );

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.target || link.origin !== location.origin || !(link.pathname in COLORS)) return;
      event.preventDefault();
      go(link.pathname);
    };
    const onNavigate = (event: Event) => go((event as CustomEvent<string>).detail);
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
    };
  }, [go]);

  // Ya llegó: también cubre el botón de atrás del celular, que no pasa por `go`.
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (failsafe.current) clearTimeout(failsafe.current);
    setVeil({ color: COLORS[pathname] ?? "#f8dbe3", phase: "out" });
  }, [pathname]);

  if (!veil) return null;
  return (
    <div
      aria-hidden="true"
      className={`page-veil is-${veil.phase}`}
      style={{ background: veil.color }}
      onAnimationEnd={() => setVeil((current) => (current?.phase === "out" ? null : current))}
    />
  );
}
