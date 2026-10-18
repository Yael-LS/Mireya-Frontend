"use client";

import { useEffect, useState } from "react";
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

function Photo({ sticker, sizes }: { sticker: PlacedSticker; sizes: string }) {
  return (
    <Image
      src={sticker.src}
      alt=""
      fill
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
      <div className="sticker-pop" style={{ animationDelay: `${sticker.delay}s, ${sticker.floatDelay}s` }}>
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
            <div className="sticker-outline">
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
      <div className="sticker-pop" style={{ animationDelay: `${lyric.delay}s, ${lyric.delay + 2}s` }}>
        <div className="relative" style={{ transform: `rotate(${lyric.rotate}deg)` }}>
          <span className="washi washi-sm" />
          <div className="lyric-slip">
            <p className="lyric-text">{lyric.text}</p>
            <p className="lyric-source">{lyric.source}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScrapbookBackground({ revealed }: { revealed: boolean }) {
  const [collage, setCollage] = useState<Collage | null>(null);

  useEffect(() => {
    setCollage(buildCollage());
  }, []);

  return (
    <div aria-hidden="true" className={`scrapbook ${revealed ? "is-revealed" : ""}`}>
      {collage && (
        <>
          <div className="scrapbook-desktop">
            {collage.desktop.map((sticker, index) => (
              <Sticker key={index} sticker={sticker} sizes="(min-width: 1440px) 200px, 14vw" />
            ))}
            {collage.desktopLyrics.map((lyric) => (
              <LyricSlip key={lyric.text} lyric={lyric} />
            ))}
            <div className="scrapbook-veil" />
          </div>
          <div className="scrapbook-mobile">
            {collage.mobile.map((sticker, index) => (
              <Sticker key={index} sticker={sticker} sizes="25vw" />
            ))}
            {collage.mobileLyrics.map((lyric) => (
              <LyricSlip key={lyric.text} lyric={lyric} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
