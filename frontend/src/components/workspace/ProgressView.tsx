"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { BrandBlob } from "@/components/effects/BrandBlob";
import { Button } from "@/components/ui";

const TIPS = [
  "Your file travels over an encrypted connection.",
  "Tip: press Ctrl K anywhere to jump to any tool.",
  "Files are deleted from our servers automatically.",
  "Tip: you can paste images straight from the clipboard.",
  "No sign-up, no watermark - it's all free.",
];

export function ProgressView({
  phase,
  progress,
  color,
  label,
  onCancel,
}: {
  phase: "uploading" | "processing";
  progress: number;
  color: string;
  label: string;
  onCancel: () => void;
}) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = phase === "uploading" ? Math.round(progress * 100) : 100;

  return (
    <div className="flex animate-fade-in flex-col items-center px-6 py-16 text-center sm:py-24" style={{ "--c": color } as CSSProperties} role="status" aria-live="polite">
      {phase === "processing" ? (
        <div className="relative size-52 animate-scale-in">
          <div className="absolute inset-10 rounded-full blur-3xl" style={{ background: "color-mix(in oklab, var(--c) 30%, transparent)" }} />
          <BrandBlob size="small" color={color} />
        </div>
      ) : (
      <div className="relative size-40">
        <div className="absolute inset-4 rounded-full blur-2xl" style={{ background: "color-mix(in oklab, var(--c) 25%, transparent)" }} />
        <svg viewBox="0 0 128 128" className="relative size-40 -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="var(--c)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-3xl font-extrabold tabular-nums text-ink">{pct}%</span>
        </div>
      </div>
      )}
      <h2 className="mt-8 font-display text-2xl font-bold text-ink">{phase === "uploading" ? "Uploading your file..." : label}</h2>
      <p key={tip} className="mt-3 h-6 animate-fade-in text-[15px] text-muted">{TIPS[tip]}</p>
      <Button variant="ghost" size="sm" className="mt-8" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
