"use client";

import { Crop, SquareDashedMousePointer } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { Segmented } from "@/components/ui";
import { DraggableBox, LockedNotice, PageCanvas, PreviewError, PageNav, newId, toPoint, type Box } from "@/components/workspace/editors/PageCanvas";
import { usePdf } from "@/components/workspace/Preview";
import type { WorkspaceApi } from "@/components/workspace/types";

/* ------------------------------------------------------------------ redact */

interface Area extends Box {
  id: string;
  page: number;
}

export function RedactEditor(api: WorkspaceApi) {
  const { files, values, setValue, color } = api;
  const { doc, state, pages } = usePdf(files[0], String(values.password ?? ""));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const areas = useMemo(() => (Array.isArray(values.areas) ? (values.areas as Area[]) : []), [values.areas]);
  const update = (next: Area[]) => setValue("areas", next.length ? next : null);
  const fill = String(values.fill ?? "#000000");

  if (state === "locked") return <LockedNotice />;
  if (state === "error") return <PreviewError />;
  if (state !== "ready" || !doc) return <div className="mx-auto aspect-[1/1.414] max-w-xl rounded-lg skeleton" />;

  function draw(e: ReactPointerEvent<HTMLDivElement>, scale: number, size: { width: number; height: number }) {
    if (e.target !== e.currentTarget) return;
    setSelected(null);
    const el = e.currentTarget;
    const start = toPoint(e, el, scale);
    el.setPointerCapture(e.pointerId);
    let box: Box = { x: start.x, y: start.y, width: 0, height: 0 };
    const move = (ev: PointerEvent) => {
      const p = toPoint(ev, el, scale);
      const px = Math.max(0, Math.min(size.width, p.x));
      const py = Math.max(0, Math.min(size.height, p.y));
      box = { x: Math.min(start.x, px), y: Math.min(start.y, py), width: Math.abs(px - start.x), height: Math.abs(py - start.y) };
      setDraft(box);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setDraft(null);
      if (box.width > 4 && box.height > 4) {
        const item = { id: newId(), page, ...box };
        update([...areas, item]);
        setSelected(item.id);
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  return (
    <div style={{ "--c": color } as CSSProperties}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <SquareDashedMousePointer className="size-4 text-subtle" />
          Drag over anything you want to black out - or list words in the panel.
        </p>
        <PageNav page={page} pages={pages} onChange={(p) => { setPage(p); setSelected(null); }} />
      </div>
      <div className="rounded-2xl bg-surface-2 p-3 sm:p-6">
        <PageCanvas doc={doc} page={page} maxWidth={780}>
          {(info) => (
            <div className="absolute inset-0 cursor-crosshair" onPointerDown={(e) => draw(e, info.scale, info)}>
              {areas
                .filter((a) => a.page === page)
                .map((a) => (
                  <DraggableBox
                    key={a.id}
                    box={a}
                    scale={info.scale}
                    bounds={info}
                    selected={selected === a.id}
                    onSelect={() => setSelected(a.id)}
                    onChange={(b) => update(areas.map((x) => (x.id === a.id ? { ...x, ...b } : x)))}
                    onDelete={() => update(areas.filter((x) => x.id !== a.id))}
                  >
                    <div className="size-full opacity-90" style={{ background: fill }} />
                  </DraggableBox>
                ))}
              {draft && (
                <div className="pointer-events-none absolute opacity-70" style={{ left: draft.x * info.scale, top: draft.y * info.scale, width: draft.width * info.scale, height: draft.height * info.scale, background: fill }} />
              )}
            </div>
          )}
        </PageCanvas>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        {areas.length ? `${areas.length} area${areas.length > 1 ? "s" : ""} marked. Redaction permanently deletes the content underneath.` : "Redacted content is removed from the file - not just covered."}
      </p>
    </div>
  );
}

export function validateRedact(api: WorkspaceApi): string | null {
  const v = api.values;
  const hasTerms = Array.isArray(v.terms) && v.terms.length > 0;
  const hasPatterns = String(v.patterns ?? "").trim().length > 0;
  const hasAreas = Array.isArray(v.areas) && v.areas.length > 0;
  return hasTerms || hasPatterns || hasAreas ? null : "Mark an area on the page, or add words or patterns to redact.";
}

/* ------------------------------------------------------------------ crop */

export function CropEditor(api: WorkspaceApi) {
  const { files, values, setValue, color } = api;
  const { doc, state, pages } = usePdf(files[0], String(values.password ?? ""));
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const scope = values.pages === "all" || !values.pages ? "all" : "this";

  const frac = (values.box as { x: number; y: number; width: number; height: number } | null) ?? { x: 0.06, y: 0.06, width: 0.88, height: 0.88 };
  useEffect(() => {
    if (!values.box) setValue("box", frac);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "locked") return <LockedNotice />;
  if (state === "error") return <PreviewError />;
  if (state !== "ready" || !doc) return <div className="mx-auto aspect-[1/1.414] max-w-xl rounded-lg skeleton" />;

  return (
    <div style={{ "--c": color } as CSSProperties}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="w-64">
          <Segmented
            value={scope}
            color={color}
            size="sm"
            onChange={(v) => setValue("pages", v === "all" ? "all" : String(page))}
            options={[
              { value: "all", label: "All pages" },
              { value: "this", label: "This page only" },
            ]}
          />
        </div>
        <PageNav page={page} pages={pages} onChange={(p) => { setPage(p); if (scope === "this") setValue("pages", String(p)); }} />
      </div>
      <div className="rounded-2xl bg-surface-2 p-3 sm:p-6">
        <PageCanvas doc={doc} page={page} maxWidth={720} onInfo={(i) => setSize({ width: i.width, height: i.height })}>
          {(info) => {
            const box = { x: frac.x * info.width, y: frac.y * info.height, width: frac.width * info.width, height: frac.height * info.height };
            return (
              <DraggableBox
                box={box}
                scale={info.scale}
                bounds={info}
                selected
                minSize={20}
                onChange={(b) => setValue("box", { x: b.x / info.width, y: b.y / info.height, width: b.width / info.width, height: b.height / info.height })}
                className="shadow-[0_0_0_9999px_rgba(8,11,23,0.55)]"
              >
                <div className="pointer-events-none grid size-full grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/40" />)}
                </div>
              </DraggableBox>
            );
          }}
        </PageCanvas>
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
        <Crop className="size-4" />
        {size
          ? `Visible area: ${Math.round(frac.width * size.width)} × ${Math.round(frac.height * size.height)} pt. Drag the corners to adjust.`
          : "Drag the corners to choose the area to keep."}
      </p>
    </div>
  );
}
