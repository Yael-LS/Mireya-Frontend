"use client";

import { useEffect, useState } from "react";

// 4 s inhalar · 4 s sostener · 6 s exhalar, en bucle mientras esté activo.
const STEPS = [
  { label: "inhala…", seconds: 4, scale: 1.25 },
  { label: "sostén…", seconds: 4, scale: 1.25 },
  { label: "exhala…", seconds: 6, scale: 0.85 },
];

export default function BreatheBox() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setStep((current) => (current + 1) % STEPS.length), STEPS[step].seconds * 1000);
    return () => clearTimeout(timer);
  }, [running, step]);

  const current = STEPS[step];

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className="breathe-orb"
        style={{
          transform: `scale(${running ? current.scale : 1})`,
          transitionDuration: `${running ? current.seconds : 0.6}s`,
        }}
      >
        <span className="font-hand text-2xl text-[#5c2338]">{running ? current.label : "cuando quieras"}</span>
      </div>
      <p className="text-xs text-[#7d4a5a]">inhala 4 · sostén 4 · exhala 6</p>
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setRunning((value) => !value);
        }}
        className="min-h-11 rounded-full border border-[#f0cad5] bg-white/75 px-5 text-sm text-[#7a2c43] transition hover:bg-white"
      >
        {running ? "Terminar" : "Empezar"}
      </button>
    </div>
  );
}
