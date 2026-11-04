"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { FLOWER_CLIP, HEART_CLIP, buildCollage } from "./scrapbook";
import type { Collage, PlacedLyric, PlacedSticker } from "./scrapbook";

const SHAPE_STYLE: Record<string, CSSProperties> = {
  heart: { clipPath: HEART_CLIP, aspectRatio: "1.1 / 1" },
  flower: { clipPath: FLOWER_CLIP, aspectRatio: "1 / 1" },
  circle: { borderRadius: "999px", aspectRatio: "1 / 1" },
  arch: { borderRadius: "999px 999px 14px 14px", aspectRatio: "1 / 1.24" },
};

// La forma blanca del borde (.sticker-outline::before) copia el recorte de la foto.
function outlineVars(shape: string) {
  const { clipPath, borderRadius } = SHAPE_STYLE[shape];
  return { "--sticker-clip": clipPath, "--sticker-radius": borderRadius } as CSSProperties;
}

function Photo({ sticker, sizes }: { sticker: PlacedSticker; sizes: string }) {
  return (
    <Image
      src={sticker.src}
      alt=""
      fill
      loading="eager"
      sizes={sizes}
      className="object-cover"
      style={{ objectPosition: sticker.focus ?? "center" }}
    />
  );
}

function Sticker({ sticker, sizes }: { sticker: PlacedSticker; sizes: string }) {
  return (
    <div
      className={`sticker-slot sticker-${sticker.layer}`}
      style={{ left: sticker.left, top: sticker.top, width: sticker.width }}
    >
      <div className={sticker.floats ? "sticker-floats" : undefined} style={sticker.floats ? { animationDelay: `${sticker.floatDelay}s` } : undefined}>
        <div style={{ transform: `rotate(${sticker.rotate}deg)` }}>
          {sticker.shape === "polaroid" ? (
            <div className="sticker-polaroid">
              <span className="washi" />
              <div className="sticker-photo aspect-square">
                <Photo sticker={sticker} sizes={sizes} />
              </div>
              <p className="sticker-caption">{sticker.caption}</p>
            </div>
          ) : sticker.shape === "stamp" ? (
            <div className="sticker-stamp">
              <div className="sticker-photo h-full">
                <Photo sticker={sticker} sizes={sizes} />
              </div>
            </div>
          ) : (
            <div className="sticker-outline" style={outlineVars(sticker.shape)}>
              <div className="sticker-photo" style={SHAPE_STYLE[sticker.shape]}>
                <Photo sticker={sticker} sizes={sizes} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LyricSlip({ lyric }: { lyric: PlacedLyric }) {
  return (
    <div className="lyric-slot" style={{ left: lyric.left, right: lyric.right, top: lyric.top }}>
      <div className="relative" style={{ transform: `rotate(${lyric.rotate}deg)` }}>
        <span className="washi washi-sm" />
        <div className="lyric-slip">
          <p className="lyric-text">{lyric.text}</p>
          <p className="lyric-source">{lyric.source}</p>
        </div>
      </div>
    </div>
  );
}

type Props = { settled: boolean; onReady: () => void };

function ScrapbookBackground({ settled, onReady }: Props) {
  const [collage, setCollage] = useState<Collage | null>(null);
  // Solo se monta el collage que se ve, para no cargar también las fotos del otro.
  const [isDesktop, setIsDesktop] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(query.matches);
    update();
    setCollage(buildCollage());
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Avisa cuando las fotos están listas para pintarse, para abrir el telón sin tirones.
  useEffect(() => {
    if (!collage || !rootRef.current) return;
    const images = Array.from(rootRef.current.querySelectorAll("img"));
    void Promise.allSettled(images.map((image) => image.decode())).then(onReady);
  }, [collage, isDesktop, onReady]);

  return (
    <div ref={rootRef} aria-hidden="true" className={`scrapbook ${settled ? "is-settled" : ""}`}>
      {collage &&
        (isDesktop ? (
          <div className="scrapbook-desktop">
            {collage.desktop.map((sticker, index) => (
              <Sticker key={index} sticker={sticker} sizes="(min-width: 1440px) 200px, 14vw" />
            ))}
            {collage.desktopLyrics.map((lyric) => (
              <LyricSlip key={lyric.text} lyric={lyric} />
            ))}
            <div className="scrapbook-veil" />
          </div>
        ) : (
          <div className="scrapbook-mobile">
            {collage.mobile.map((sticker, index) => (
              <Sticker key={index} sticker={sticker} sizes="25vw" />
            ))}
            {collage.mobileLyrics.map((lyric) => (
              <LyricSlip key={lyric.text} lyric={lyric} />
            ))}
          </div>
        ))}
    </div>
  );
}

// Home se vuelve a renderizar con cada tecla y cada fragmento de respuesta.
export default memo(ScrapbookBackground);
