import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./playlist.css";

export const metadata: Metadata = { title: "Playlist de Mireya" };
// La barra del navegador del celular toma el negro del cuarto.
export const viewport: Viewport = { themeColor: "#121114" };

export default function PlaylistLayout({ children }: { children: ReactNode }) {
  return children;
}
