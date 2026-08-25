import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mireya AI — Biografía Viva & Mapa de Identidad",
  description: "Explora proyectos, gustos musicales, anécdotas y el mapa de identidad de Mireya en una experiencia interactiva.",
  openGraph: {
    title: "Mireya AI — Biografía Viva & Mapa de Identidad",
    description: "Explora proyectos, gustos musicales, anécdotas y recuerdos de Mireya.",
    images: [
      {
        url: "/mireya.jpg",
        width: 800,
        height: 800,
        alt: "Mireya AI",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mireya AI — Biografía Viva",
    description: "Explora proyectos, gustos y recuerdos de Mireya con IA.",
    images: ["/mireya.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-[#f2c4ce] selection:text-[#4a2e35]">
        {children}
      </body>
    </html>
  );
}