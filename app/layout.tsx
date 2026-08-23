import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mireya AI — Biografía & Mapa de Identidad",
  description: "Un biógrafo conversacional para descubrir el universo de Mireya.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
