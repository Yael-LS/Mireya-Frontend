"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

// Fechas como "2026-05-10": el día que ella vivió, sin horas ni zonas.
export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const YEARS_BACK = 30;

export type Month = { y: number; m: number }; // m: 0 = enero
export const pad = (n: number) => String(n).padStart(2, "0");
export const monthOf = (key: string): Month => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1 });
export const monthIndex = ({ y, m }: Month) => y * 12 + m;
export const fromIndex = (index: number): Month => ({ y: Math.floor(index / 12), m: index % 12 });
export const dayLabel = (key: string, withYear = false) =>
  `${Number(key.slice(8, 10))} de ${MONTHS[Number(key.slice(5, 7)) - 1]}${withYear ? ` de ${key.slice(0, 4)}` : ""}`;

const keyOf = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const shiftDay = (key: string, days: number) => {
  const { y, m } = monthOf(key);
  return keyOf(new Date(Date.UTC(y, m, Number(key.slice(8, 10)) + days)));
};

export type Cell = { key: string; day: number; inMonth: boolean };

// Semanas de lunes a domingo, con los días vecinos para cerrar la cuadrícula.
export function monthCells({ y, m }: Month): Cell[] {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const date = new Date(Date.UTC(y, m, 1 - lead + i));
    return { key: keyOf(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === m };
  });
}

type Props = {
  value: string | null;
  today: string;
  onPick: (key: string) => void;
  onClose: () => void;
  hint: string;
};

// Hoja de "¿cuándo pasó?": nunca deja elegir un día que todavía no llega.
export default function MemoryDatePicker({ value, today, onPick, onClose, hint }: Props) {
  const [pick, setPick] = useState(value ?? today);
  const [cursor, setCursor] = useState<Month>(monthOf(value ?? today));
  const [mode, setMode] = useState<"days" | "months">("days");

  const yesterday = shiftDay(today, -1);
  const last = monthOf(today);
  const choose = (key: string) => {
    setPick(key);
    setCursor(monthOf(key));
    setMode("days");
  };
  const canNext = mode === "days" ? monthIndex(cursor) < monthIndex(last) : cursor.y < last.y;
  const move = (step: number) => {
    if (mode === "days") setCursor(fromIndex(monthIndex(cursor) + step));
    else {
      const y = cursor.y + step;
      setCursor({ y, m: y === last.y ? Math.min(cursor.m, last.m) : cursor.m });
    }
  };
  const isToday = pick === today;
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => last.y - i);

  return (
    <div className="mem-sheet-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Cuándo pasó" className="mem-sheet" onClick={(event) => event.stopPropagation()}>
        <span aria-hidden="true" className="mem-grabber mb-3" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-hand text-[32px] font-semibold leading-none text-[#9e3b56]">¿cuándo pasó?</h3>
            <p className="mt-1 text-[12.5px] text-[#7d4a5a]">en el calendario aparecerá el día que elijas</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-3 text-[#8f475a] hover:bg-[#fae6ec]">
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" aria-pressed={isToday} onClick={() => choose(today)} className="mem-quick">
            hoy
          </button>
          <button type="button" aria-pressed={pick === yesterday} onClick={() => choose(yesterday)} className="mem-quick">
            ayer
          </button>
          <button type="button" aria-pressed={!isToday && pick !== yesterday} onClick={() => setMode("months")} className="mem-quick">
            otro día
          </button>
        </div>

        <div className="mem-pick">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => move(-1)} aria-label={mode === "days" ? "Mes anterior" : "Año anterior"} className="mem-cal-nav">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setMode(mode === "days" ? "months" : "days")} aria-label="Elegir mes y año" className="mem-pick-head">
              {mode === "days" ? MONTHS[cursor.m] : "elige el mes"} <span className="text-[#9e3b56]">{cursor.y}</span>
              <ChevronDown size={14} className={`text-[#9e3b56] ${mode === "months" ? "rotate-180" : ""}`} />
            </button>
            <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label={mode === "days" ? "Mes siguiente" : "Año siguiente"} className="mem-cal-nav">
              <ChevronRight size={18} />
            </button>
          </div>

          {mode === "days" ? (
            <>
              <div aria-hidden="true" className="mem-week mt-1.5">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells(cursor).map((cell) =>
                  cell.inMonth ? (
                    <button
                      key={cell.key}
                      type="button"
                      disabled={cell.key > today}
                      aria-pressed={cell.key === pick}
                      aria-label={dayLabel(cell.key, true)}
                      onClick={() => setPick(cell.key)}
                      className={`mem-pd ${cell.key === today ? "is-today" : ""}`}
                    >
                      {cell.day}
                    </button>
                  ) : (
                    <span key={cell.key} aria-hidden="true" />
                  ),
                )}
              </div>
            </>
          ) : (
            <div className="mt-1.5 border-t-[1.5px] border-dashed border-[#f0c3d0] pt-2.5">
              <div className="mem-years">
                {years.map((year) => (
                  <button key={year} type="button" aria-pressed={year === cursor.y} onClick={() => setCursor({ y: year, m: year === last.y ? Math.min(cursor.m, last.m) : cursor.m })}>
                    {year}
                  </button>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {MONTHS.map((name, m) => (
                  <button
                    key={name}
                    type="button"
                    disabled={cursor.y === last.y && m > last.m}
                    aria-pressed={m === cursor.m}
                    onClick={() => {
                      setCursor({ y: cursor.y, m });
                      setMode("days");
                    }}
                    className="mem-pm"
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mx-0.5 mt-3 text-xs leading-snug text-[#85505f]">{isToday ? hint : `en tu calendario vivirá el ${dayLabel(pick, pick.slice(0, 4) !== today.slice(0, 4))}`}</p>
        <button type="button" onClick={() => onPick(pick)} className="mem-primary mt-3 w-full">
          {isToday ? "listo, fue hoy" : `listo, fue el ${dayLabel(pick, pick.slice(0, 4) !== today.slice(0, 4))}`}
        </button>
      </div>
    </div>
  );
}
