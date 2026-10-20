"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { BrandBlob } from "@/components/effects/BrandBlob";
import { Button } from "@/components/ui";
import type { ServerProgress } from "@/lib/api";

const TIPS = [
  "Your file travels over an encrypted connection.",
  "Tip: press Ctrl K anywhere to jump to any tool.",
  "Files are deleted from our servers automatically.",
  "Tip: you can paste images straight from the clipboard.",
  "No sign-up, no watermark - it's all free.",
];

/** Share of the ring used by the upload; the conversion fills the rest. */
const UPLOAD_SHARE = 0.15;
/** Never show more than this until the result has actually arrived. */
const CAP = 0.97;

/** Rough seconds a conversion takes, used to keep the ring moving between real updates. */
function expectedSeconds(slug: string, bytes: number): number {
  const mb = bytes / 1_000_000;
  if (/^(word|excel|powerpoint|html)-to-pdf$/.test(slug)) return 15 + mb * 4;
  if (slug.startsWith("ai-") || slug === "translate-pdf") return 25 + mb * 2;
  if (slug === "ocr-pdf") return 10 + mb * 6;
  if (slug === "pdf-to-word" || slug === "pdf-to-pdfa" || slug === "pdf-to-excel") return 6 + mb * 3;
  return 3 + mb;
}

/**
 * Turns the upload fraction plus the server's (stepwise) progress into one smooth
 * percentage. Between real updates the ring keeps creeping forward, slowing down as
 * it gets closer to the next likely step, so it never sits still and never lies by
 * jumping to 100 early.
 */
function useSmoothProgress(phase: "uploading" | "processing", upload: number, server: ServerProgress, expected: number) {
  const [shown, setShown] = useState(0);
  const lastReal = useRef({ value: -1, at: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      let target: number;
      if (server.percent === 100) {
        target = 1; // finished: sweep to the end before the result screen appears
      } else if (phase === "uploading") {
        target = upload * UPLOAD_SHARE;
      } else {
        const real = server.percent === null ? 0 : server.percent / 100;
        if (real !== lastReal.current.value) lastReal.current = { value: real, at: now };
        const base = UPLOAD_SHARE + (1 - UPLOAD_SHARE) * real;
        // room to creep before the next real update: a good chunk of what's left
        const room = (CAP - base) * (server.percent === null ? 0.85 : 0.6);
        const seconds = (now - lastReal.current.at) / 1000;
        target = base + room * (1 - Math.exp(-seconds / Math.max(expected * 0.6, 2)));
      }
      const cap = server.percent === 100 ? 1 : CAP;
      setShown((s) => Math.min(cap, Math.max(s, s + (target - s) * (server.percent === 100 ? 0.6 : 0.25))));
    }, 120);
    return () => clearInterval(id);
  }, [phase, upload, server.percent, expected]);

  return shown;
}

export function ProgressView({
  phase,
  progress,
  server,
  slug,
  bytes,
  color,
  label,
  onCancel,
}: {
  phase: "uploading" | "processing";
  progress: number;
  server: ServerProgress;
  slug: string;
  bytes: number;
  color: string;
  label: string;
  onCancel: () => void;
}) {
  const [tip, setTip] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const processingSince = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (phase !== "processing") return;
    processingSince.current ??= Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - processingSince.current!) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  const shown = useSmoothProgress(phase, progress, server, expectedSeconds(slug, bytes));
  const pct = Math.floor(shown * 100);

  // the free server sleeps when idle; until it answers, say so instead of looking stuck
  const waking = phase === "processing" && server.percent === null && seconds >= 6;
  const heading =
    server.percent === 100
      ? "Done!"
      : phase === "uploading"
        ? "Uploading your file..."
        : waking
          ? "Waking up the server..."
          : server.stage
            ? `${server.stage}...`
            : label;
  const sub = waking
    ? "It naps when nobody's around. The first file after a quiet spell can take up to a minute - hang tight."
    : TIPS[tip];

  const r = 54;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex animate-fade-in flex-col items-center px-6 py-16 text-center sm:py-20" style={{ "--c": color } as CSSProperties}>
      <div
        className="relative size-48"
        role="progressbar"
        aria-label={heading}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="absolute inset-6 rounded-full blur-2xl" style={{ background: "color-mix(in oklab, var(--c) 28%, transparent)" }} />
        {phase === "processing" && (
          <div className="pointer-events-none absolute inset-3 opacity-45">
            <BrandBlob size="small" color={color} />
          </div>
        )}
        <svg viewBox="0 0 128 128" className="relative size-48 -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="var(--c)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - shown)}
            className="transition-[stroke-dashoffset] duration-200 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <span className="block font-display text-4xl font-extrabold tabular-nums text-ink">{pct}%</span>
            {phase === "processing" && <span className="mt-0.5 block text-xs font-medium tabular-nums text-muted">{seconds}s</span>}
          </div>
        </div>
      </div>

      <h2 aria-live="polite" className="mt-8 max-w-lg font-display text-2xl font-bold text-ink">
        {heading}
      </h2>
      <p key={waking ? "waking" : tip} className="mt-3 min-h-6 max-w-md animate-fade-in text-[15px] text-muted">
        {sub}
      </p>
      <Button variant="ghost" size="sm" className="mt-8" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
