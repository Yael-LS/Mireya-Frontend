import type { Metadata } from "next";
import { Caveat, Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

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
    <html lang="es" className={`${figtree.variable} ${caveat.variable} ${cormorant.variable}`}>
      <body className="antialiased selection:bg-[#f2c4ce] selection:text-[#4a2e35]">
        {children}
      </body>
    </html>
  );
}