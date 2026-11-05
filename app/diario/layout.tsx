import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Courier_Prime, Dancing_Script, Indie_Flower, Kalam, Patrick_Hand, Shadows_Into_Light } from "next/font/google";
import "./diario.css";

// Las letras que ella puede elegir para cada hoja.
const dancing = Dancing_Script({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-dancing" });
const indie = Indie_Flower({ subsets: ["latin"], weight: "400", variable: "--font-indie" });
const patrick = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-patrick" });
const shadows = Shadows_Into_Light({ subsets: ["latin"], weight: "400", variable: "--font-shadows" });
const kalam = Kalam({ subsets: ["latin"], weight: "400", variable: "--font-kalam" });
const courier = Courier_Prime({ subsets: ["latin"], weight: "400", variable: "--font-courier" });

export const metadata: Metadata = { title: "El diario de Mireya" };

export default function DiarioLayout({ children }: { children: ReactNode }) {
  return <div className={[dancing, indie, patrick, shadows, kalam, courier].map((f) => f.variable).join(" ")}>{children}</div>;
}
