"use client";

import clsx from "clsx";
import { Eraser, ImageUp, PenLine, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Button, Input, Segmented } from "@/components/ui";

const INKS = [
  { value: "#111827", label: "Black" },
  { value: "#1e3a8a", label: "Blue" },
  { value: "#b91c1c", label: "Red" },
];
const FONTS = [
  { cls: "font-signature-1", cssVar: "--font-sig-1" },
  { cls: "font-signature-2", cssVar: "--font-sig-2" },
  { cls: "font-signature-3", cssVar: "--font-sig-3" },
];

type Tab = "draw" | "type" | "upload";

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(new File([b], name, { type: "image/png" })) : reject(new Error("empty"))), "image/png"),
  );
}

/** Crop a canvas to its non-transparent pixels. */
function trimmed(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext("2d")!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  if (x1 <= x0 || y1 <= y0) return src;
  const pad = 8;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + pad * 2;
  out.height = y1 - y0 + pad * 2;
  out.getContext("2d")!.drawImage(src, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export function SignatureModal({ open, color, onClose, onDone }: { open: boolean; color: string; onClose: () => void; onDone: (file: File) => void }) {
  const [tab, setTab] = useState<Tab>("draw");
  const [ink, setInk] = useState(INKS[0].value);
  const [name, setName] = useState("");
  const [font, setFont] = useState(0);
  const [hasInk, setHasInk] = useState(false);
  const [upload, setUpload] = useState<File | null>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const uploadUrl = useMemo(() => (upload ? URL.createObjectURL(upload) : null), [upload]);
  useEffect(() => () => {
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
  }, [uploadUrl]);

  // drawing pad
  useEffect(() => {
    if (!open || tab !== "draw") return;
    const canvas = padRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
    let drawing = false;
    let last: { x: number; y: number; t: number } | null = null;
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    };
    const down = (e: PointerEvent) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      last = pos(e);
    };
    const move = (e: PointerEvent) => {
      if (!drawing || !last) return;
      const p = pos(e);
      const speed = Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, p.t - last.t);
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.4, 3.4 - speed * 1.2); // faster strokes are thinner, like a real pen
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      setHasInk(true);
    };
    const up = () => {
      drawing = false;
      last = null;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [open, tab, ink]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function save() {
    if (tab === "draw" && padRef.current) {
      onDone(await canvasToFile(trimmed(padRef.current), "signature.png"));
    } else if (tab === "type" && name.trim()) {
      const family = getComputedStyle(document.documentElement).getPropertyValue(FONTS[font].cssVar).trim() || "cursive";
      await document.fonts.load(`96px ${family}`).catch(() => {});
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      ctx.font = `96px ${family}`;
      const w = Math.ceil(ctx.measureText(name).width) + 60;
      c.width = w;
      c.height = 170;
      const ctx2 = c.getContext("2d")!;
      ctx2.font = `96px ${family}`;
      ctx2.fillStyle = ink;
      ctx2.textBaseline = "middle";
      ctx2.fillText(name.trim(), 30, 90);
      onDone(await canvasToFile(trimmed(c), "signature.png"));
    } else if (tab === "upload" && upload) {
      onDone(upload);
    }
  }

  const canSave = (tab === "draw" && hasInk) || (tab === "type" && name.trim()) || (tab === "upload" && upload);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Create your signature">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl animate-scale-in rounded-t-3xl border border-line bg-elevated shadow-float sm:rounded-3xl" style={{ "--c": color } as CSSProperties}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">Create your signature</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="space-y-5 p-6">
          <Segmented
            value={tab}
            onChange={setTab}
            color={color}
            options={[
              { value: "draw", label: <span className="inline-flex items-center gap-1.5"><PenLine className="size-4" /> Draw</span> },
              { value: "type", label: <span className="inline-flex items-center gap-1.5"><Type className="size-4" /> Type</span> },
              { value: "upload", label: <span className="inline-flex items-center gap-1.5"><ImageUp className="size-4" /> Upload</span> },
            ]}
          />

          {tab !== "upload" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Ink</span>
              {INKS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.label}
                  onClick={() => setInk(c.value)}
                  className={clsx("size-7 rounded-full ring-offset-2 ring-offset-elevated transition", ink === c.value ? "ring-2 ring-[var(--c)]" : "hover:scale-110")}
                  style={{ background: c.value }}
                />
              ))}
            </div>
          )}

          {tab === "draw" && (
            <div className="relative">
              <canvas ref={padRef} className="h-52 w-full cursor-crosshair touch-none rounded-2xl border-2 border-dashed border-line-strong bg-white" />
              {!hasInk && <p className="pointer-events-none absolute inset-0 grid place-items-center text-slate-400">Sign here with your mouse or finger</p>}
              <div className="pointer-events-none absolute inset-x-8 bottom-12 border-b border-slate-300" />
            </div>
          )}

          {tab === "type" && (
            <div className="space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name" autoFocus maxLength={60} />
              <div className="grid gap-2 sm:grid-cols-3">
                {FONTS.map((f, i) => (
                  <button
                    key={f.cls}
                    type="button"
                    onClick={() => setFont(i)}
                    className={clsx(
                      "h-20 truncate rounded-2xl border bg-white px-3 text-3xl transition",
                      f.cls,
                      font === i ? "border-transparent ring-2 ring-[var(--c)]" : "border-line hover:border-line-strong",
                    )}
                    style={{ color: ink }}
                  >
                    {name || "Your Name"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "upload" && (
            <label className="flex h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 text-center transition hover:border-[var(--c)]">
              {uploadUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploadUrl} alt="Signature" className="max-h-36 max-w-[80%] object-contain" />
              ) : (
                <>
                  <ImageUp className="size-8 text-subtle" />
                  <span className="text-sm font-medium text-ink-2">Upload a photo or scan of your signature</span>
                  <span className="text-xs text-muted">White paper backgrounds are removed automatically</span>
                </>
              )}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setUpload(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <p className="hidden text-xs text-muted sm:block">Your signature is only used to sign this document.</p>
          <div className="flex gap-2">
            {tab === "draw" && (
              <Button variant="ghost" leftIcon={<Eraser className="size-4" />} onClick={() => {
                const c = padRef.current!;
                c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
                setHasInk(false);
              }}>
                Clear
              </Button>
            )}
            <Button variant="tint" color={color} disabled={!canSave} onClick={save}>
              Use this signature
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
