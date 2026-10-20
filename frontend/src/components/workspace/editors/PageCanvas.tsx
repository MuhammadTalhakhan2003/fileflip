"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, FileWarning, Lock, RotateCw, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { renderPage } from "@/lib/pdf";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageInfo {
  width: number;
  height: number;
  scale: number;
}

/**
 * Renders one PDF page to fit its container and exposes the scale, so overlays
 * can be positioned in PDF points (the unit the backend expects).
 */
export function PageCanvas({
  doc,
  page,
  maxWidth = 860,
  overlayProps,
  onInfo,
  children,
}: {
  doc: PDFDocumentProxy;
  page: number;
  maxWidth?: number;
  overlayProps?: HTMLAttributes<HTMLDivElement>;
  onInfo?: (info: PageInfo) => void;
  children?: (info: PageInfo) => ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!containerWidth || !canvasRef.current) return;
    let alive = true;
    let cancel = () => {};
    setRendered(false);
    doc.getPage(page).then((p) => {
      if (!alive || !canvasRef.current) return;
      const vp = p.getViewport({ scale: 1 });
      const width = Math.min(containerWidth, maxWidth);
      const next = { width: vp.width, height: vp.height, scale: width / vp.width };
      setInfo(next);
      onInfo?.(next);
      const job = renderPage(p, canvasRef.current, width);
      cancel = job.cancel;
      job.done.then(() => alive && setRendered(true)).catch(() => {});
    });
    return () => {
      alive = false;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, page, containerWidth, maxWidth]);

  const cssWidth = info ? info.width * info.scale : Math.min(containerWidth || 600, maxWidth);
  const cssHeight = info ? info.height * info.scale : cssWidth * 1.414;

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative mx-auto touch-none select-none shadow-float ring-1 ring-black/5" style={{ width: cssWidth, height: cssHeight }}>
        <canvas ref={canvasRef} className="absolute inset-0 block bg-white" />
        {!rendered && <div className="absolute inset-0 skeleton" />}
        {info && (
          <div {...overlayProps} className={clsx("absolute inset-0 overflow-hidden", overlayProps?.className)}>
            {children?.(info)}
          </div>
        )}
      </div>
    </div>
  );
}

export function PageNav({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-soft">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40">
        <ChevronLeft className="size-4" />
      </button>
      <select value={page} onChange={(e) => onChange(Number(e.target.value))} aria-label="Page" className="h-8 rounded-lg bg-transparent px-1 text-sm font-semibold text-ink outline-none">
        {Array.from({ length: pages }, (_, i) => (
          <option key={i} value={i + 1}>Page {i + 1} of {pages}</option>
        ))}
      </select>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

export function LockedNotice() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber-500/12 text-amber-600"><Lock className="size-7" /></span>
      <p className="font-semibold text-ink">This PDF is password protected</p>
      <p className="max-w-sm text-sm text-muted">Enter its password in the panel on the right (under &ldquo;Protected PDF?&rdquo;) to see the pages.</p>
    </div>
  );
}

export function PreviewError() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-danger/10 text-danger"><FileWarning className="size-7" /></span>
      <p className="font-semibold text-ink">We couldn&rsquo;t open this PDF</p>
      <p className="max-w-sm text-sm text-muted">The file may be damaged, or the page needs a refresh. Reload and add the file again.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm font-semibold text-ink hover:border-line-strong"
      >
        <RotateCw className="size-4" /> Reload page
      </button>
    </div>
  );
}

/** Convert a pointer event into page coordinates (points). */
export function toPoint(e: { clientX: number; clientY: number }, el: HTMLElement, scale: number) {
  const r = el.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

type Handle = "move" | "nw" | "ne" | "sw" | "se";

/** A box positioned in page points that can be moved and resized with mouse or touch. */
export function DraggableBox({
  box,
  scale,
  bounds,
  selected,
  onSelect,
  onChange,
  onDelete,
  keepAspect,
  minSize = 12,
  className,
  children,
  handles = true,
}: {
  box: Box;
  scale: number;
  bounds: { width: number; height: number };
  selected?: boolean;
  onSelect?: () => void;
  onChange: (b: Box) => void;
  onDelete?: () => void;
  keepAspect?: boolean;
  minSize?: number;
  className?: string;
  children?: ReactNode;
  handles?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // a newly placed item is selected right away; if it landed off screen, bring it into view
  useEffect(() => {
    const el = ref.current;
    if (!selected || !el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 20) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected]);

  function start(e: ReactPointerEvent, handle: Handle) {
    if ((e.target as HTMLElement).closest("textarea,input,[data-no-drag]") && handle === "move") return;
    e.stopPropagation();
    e.preventDefault();
    onSelect?.();
    const startX = e.clientX;
    const startY = e.clientY;
    const b0 = { ...box };
    const ratio = b0.width / b0.height;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      let { x, y, width, height } = b0;
      if (handle === "move") {
        x = Math.min(Math.max(0, b0.x + dx), bounds.width - b0.width);
        y = Math.min(Math.max(0, b0.y + dy), bounds.height - b0.height);
      } else {
        if (handle.includes("e")) width = b0.width + dx;
        if (handle.includes("s")) height = b0.height + dy;
        if (handle.includes("w")) {
          width = b0.width - dx;
          x = b0.x + dx;
        }
        if (handle.includes("n")) {
          height = b0.height - dy;
          y = b0.y + dy;
        }
        if (keepAspect) {
          height = width / ratio;
          if (handle.includes("n")) y = b0.y + b0.height - height;
        }
        width = Math.max(minSize, width);
        height = Math.max(minSize, height);
        x = Math.max(0, Math.min(x, bounds.width - minSize));
        y = Math.max(0, Math.min(y, bounds.height - minSize));
        width = Math.min(width, bounds.width - x);
        height = Math.min(height, bounds.height - y);
      }
      onChange({ x, y, width, height });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => start(e, "move")}
      className={clsx("group/box absolute cursor-move", selected && "z-10", className)}
      style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale }}
    >
      {children}
      <div className={clsx("pointer-events-none absolute -inset-px rounded-[3px] border-2 transition-colors", selected ? "border-[var(--c)]" : "border-transparent group-hover/box:border-[color-mix(in_oklab,var(--c)_50%,transparent)]")} />
      {selected && handles &&
        (["nw", "ne", "sw", "se"] as const).map((h) => (
          <span
            key={h}
            onPointerDown={(e) => start(e, h)}
            className={clsx(
              "absolute z-20 size-3.5 rounded-full border-2 border-white bg-[var(--c)] shadow",
              h === "nw" && "-top-2 -left-2 cursor-nwse-resize",
              h === "ne" && "-top-2 -right-2 cursor-nesw-resize",
              h === "sw" && "-bottom-2 -left-2 cursor-nesw-resize",
              h === "se" && "-right-2 -bottom-2 cursor-nwse-resize",
            )}
          />
        ))}
      {selected && onDelete && (
        <button
          type="button"
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          aria-label="Delete"
          className="absolute -top-9 left-1/2 z-20 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-danger text-white shadow-lg hover:brightness-110"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

let uid = 0;
export const newId = () => `i${Date.now().toString(36)}${(uid++).toString(36)}`;
