export type Category = "bibble" | "bungo" | "dino" | "hortensia" | "taylor" | "book";
export type Shape = "heart" | "flower" | "arch" | "circle" | "stamp" | "polaroid";
export type Layer = "far" | "mid" | "near";

type Photo = { src: string; caption: string; focus?: string };

type Slot = {
  category: Category;
  shape: Shape;
  layer: Layer;
  left: string;
  top: string;
  width: string;
  rotate: number;
};

// Las frases se anclan al borde más cercano para no quedar bajo el panel.
type LyricSlot = { left?: string; right?: string; top: string; rotate: number };

export type Lyric = { text: string; source: string };

export type PlacedSticker = Slot & Photo & { delay: number; floatDelay: number };
export type PlacedLyric = LyricSlot & Lyric & { delay: number };

export type Collage = {
  desktop: PlacedSticker[];
  mobile: PlacedSticker[];
  desktopLyrics: PlacedLyric[];
  mobileLyrics: PlacedLyric[];
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// Fotos de /public agrupadas por personaje. Las categorías con pocas fotos
// (hortensias, Bungo) se repiten en varios lugares del collage.
const PHOTOS: Record<Category, Photo[]> = {
  bibble: range(11).map((i) => ({ src: `/bibble${i}.png`, caption: "Bibble" })),
  bungo: range(6).map((i) => ({ src: `/bungo${i}.png`, caption: "Bungo Stray Dogs", focus: "center 25%" })),
  dino: range(11).map((i) => ({ src: `/dino${i}.png`, caption: "dino" })),
  hortensia: range(2).map((i) => ({ src: `/hortensia${i}.png`, caption: "hortensias" })),
  taylor: [
    { src: "/taylor1.png", caption: "Lover" },
    { src: "/taylor2.png", caption: "Midnights" },
    { src: "/taylor3.png", caption: "1989 (TV)" },
    { src: "/taylor4.png", caption: "TTPD" },
    { src: "/taylor5.png", caption: "Red (TV)" },
    { src: "/taylor6.png", caption: "the eras" },
  ],
  book: [{ src: "/boulevard.png", caption: "Boulevard" }],
};

// Su top de canciones de Taylor Swift.
export const LYRICS: Lyric[] = [
  { text: "you should've said no", source: "Should've Said No · Taylor Swift" },
  { text: "just another picture to burn", source: "Picture To Burn · Taylor Swift" },
  { text: "a place in this world", source: "A Place in This World · Taylor Swift" },
  { text: "that's the way I loved you", source: "The Way I Loved You (Taylor's Version)" },
  { text: "you're not sorry", source: "You're Not Sorry (Taylor's Version)" },
];

const pct = (value: number) => `${value.toFixed(2)}%`;

// Escritorio: coordenadas diseñadas sobre 1440×900, convertidas a % del
// viewport; el ancho escala con vw dentro de un rango para pantallas extremas.
const desk = (category: Category, shape: Shape, x: number, y: number, w: number, rotate: number, layer: Layer): Slot => ({
  category,
  shape,
  layer,
  rotate,
  left: pct((x / 1440) * 100),
  top: pct((y / 900) * 100),
  width: `clamp(${Math.round(w * 0.6)}px, ${((w / 1440) * 100).toFixed(2)}vw, ${Math.round(w * 1.35)}px)`,
});

// Celular: banda superior en px (sobre 390 de ancho) y asomos laterales en %.
const mob = (category: Category, shape: Shape, x: number, top: string, w: number, rotate: number, layer: Layer): Slot => ({
  category,
  shape,
  layer,
  rotate,
  left: pct((x / 390) * 100),
  top,
  width: `${((w / 390) * 100).toFixed(2)}vw`,
});

const DESKTOP_SLOTS: Slot[] = [
  desk("bibble", "heart", 28, 36, 150, -6, "near"),
  desk("taylor", "stamp", 190, 26, 112, 7, "mid"),
  desk("dino", "polaroid", 22, 214, 160, -5, "near"),
  desk("hortensia", "flower", 196, 196, 116, 0, "mid"),
  desk("bungo", "arch", 44, 430, 124, 4, "near"),
  desk("taylor", "stamp", 184, 400, 118, 8, "near"),
  desk("bibble", "circle", 14, 604, 112, 0, "mid"),
  desk("hortensia", "polaroid", 146, 584, 150, 5, "near"),
  desk("dino", "heart", 30, 760, 128, -8, "mid"),
  desk("bibble", "arch", 206, 778, 96, 0, "far"),
  desk("dino", "circle", 120, 150, 70, 0, "far"),
  desk("hortensia", "heart", 250, 330, 74, 0, "far"),
  desk("hortensia", "flower", -20, 520, 80, 0, "far"),
  desk("taylor", "polaroid", 1146, 30, 142, 6, "near"),
  desk("bibble", "heart", 1296, 66, 124, -5, "near"),
  desk("hortensia", "arch", 1292, 238, 126, -3, "near"),
  desk("bungo", "circle", 1140, 226, 124, 0, "mid"),
  desk("taylor", "stamp", 1150, 412, 120, -7, "near"),
  desk("dino", "flower", 1302, 444, 120, 0, "mid"),
  desk("bungo", "polaroid", 1270, 604, 150, -4, "near"),
  desk("hortensia", "heart", 1130, 612, 118, 9, "mid"),
  desk("bibble", "arch", 1160, 772, 110, 3, "near"),
  desk("book", "stamp", 1322, 786, 100, -6, "mid"),
  desk("bibble", "circle", 1380, 190, 74, 0, "far"),
  desk("bungo", "heart", 1250, 360, 70, 0, "far"),
  desk("hortensia", "flower", 1400, 560, 84, 0, "far"),
  desk("hortensia", "flower", 380, -34, 104, 0, "far"),
  desk("bibble", "heart", 612, -44, 92, 0, "far"),
  desk("book", "stamp", 880, -30, 96, 4, "far"),
  desk("dino", "circle", 1040, -20, 84, 0, "far"),
  desk("dino", "heart", 450, 822, 108, 0, "far"),
  desk("hortensia", "circle", 724, 838, 96, 0, "far"),
  desk("bungo", "arch", 962, 812, 100, 0, "far"),
  desk("bibble", "heart", 300, 850, 80, 0, "far"),
];

// El chat queda al centro con franjas de 56px arriba y abajo: arriba se asoman
// los stickers, abajo la frase, y el resto se ve a través del panel de vidrio.
const MOBILE_SLOTS: Slot[] = [
  mob("bibble", "heart", 4, "-14px", 70, -6, "near"),
  mob("taylor", "stamp", 86, "-22px", 54, 6, "near"),
  mob("dino", "polaroid", 160, "-38px", 74, 5, "near"),
  mob("hortensia", "flower", 306, "-14px", 70, 0, "near"),
  mob("bungo", "circle", 250, "22px", 50, 0, "mid"),
  mob("bibble", "arch", 58, "34px", 44, -4, "mid"),
  mob("taylor", "stamp", -10, "44px", 48, -8, "mid"),
  mob("hortensia", "heart", -34, "36%", 80, 0, "far"),
  mob("dino", "circle", 344, "40%", 76, 0, "far"),
  mob("hortensia", "flower", -30, "60%", 84, 0, "far"),
  mob("book", "stamp", 340, "64%", 70, 0, "far"),
  mob("bungo", "heart", -16, "calc(100% - 64px)", 70, -8, "near"),
  mob("bibble", "arch", 330, "calc(100% - 70px)", 62, 6, "near"),
];

const DESKTOP_LYRIC_SLOTS: LyricSlot[] = [
  { left: "18px", top: "40%", rotate: -4 },
  { right: "18px", top: "38%", rotate: 3 },
  { left: "26px", top: "78%", rotate: 5 },
  { right: "24px", top: "60%", rotate: -3 },
];

const MOBILE_LYRIC_SLOTS: LyricSlot[] = [{ left: pct((70 / 390) * 100), top: "calc(100% - 52px)", rotate: -2 }];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function placeStickers(slots: Slot[]): PlacedSticker[] {
  const decks = new Map<Category, Photo[]>();
  return slots.map((slot, index) => {
    let deck = decks.get(slot.category);
    if (!deck?.length) {
      deck = shuffle(PHOTOS[slot.category]);
      decks.set(slot.category, deck);
    }
    const photo = deck.pop()!;
    return {
      ...slot,
      ...photo,
      delay: 0.7 + (index % 13) * 0.07 + (slot.layer === "far" ? 0.35 : 0),
      floatDelay: 1.8 + (index % 7) * 0.6,
    };
  });
}

function placeLyrics(slots: LyricSlot[], lyrics: Lyric[]): PlacedLyric[] {
  return slots.map((slot, index) => ({ ...slot, ...lyrics[index], delay: 1.3 + index * 0.18 }));
}

// Se arma en el cliente después de montar: cada visita trae otra combinación
// de fotos y frases.
export function buildCollage(): Collage {
  const lyrics = shuffle(LYRICS);
  return {
    desktop: placeStickers(DESKTOP_SLOTS),
    mobile: placeStickers(MOBILE_SLOTS),
    desktopLyrics: placeLyrics(DESKTOP_LYRIC_SLOTS, lyrics),
    mobileLyrics: placeLyrics(MOBILE_LYRIC_SLOTS, lyrics),
  };
}

function toPolygon(points: [number, number][]): string {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const coords = points.map(
    ([x, y]) => `${(((x - minX) / (maxX - minX)) * 100).toFixed(1)}% ${(((y - minY) / (maxY - minY)) * 100).toFixed(1)}%`
  );
  return `polygon(${coords.join(", ")})`;
}

// Curva clásica del corazón y una flor de 9 pétalos (por las hortensias).
export const HEART_CLIP = toPolygon(
  range(56).map((i) => {
    const t = (i / 56) * Math.PI * 2;
    return [
      16 * Math.sin(t) ** 3,
      -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ];
  })
);

export const FLOWER_CLIP = toPolygon(
  range(90).map((i) => {
    const a = (i / 90) * Math.PI * 2;
    const r = 0.86 + 0.14 * Math.cos(9 * a);
    return [r * Math.cos(a), r * Math.sin(a)];
  })
);
