"use client";

import clsx from "clsx";
import { Check, Scissors, Trash2 } from "lucide-react";
import { useMemo, type CSSProperties } from "react";

import { LockedNotice, PreviewError } from "@/components/workspace/editors/PageCanvas";
import { PdfPage, usePdf } from "@/components/workspace/Preview";
import type { WorkspaceApi } from "@/components/workspace/types";
import { formatPages, parsePages, plural } from "@/lib/format";

const GROUP_COLORS = ["#5145f0", "#f04463", "#22a45d", "#f59e0b", "#0e9fb8", "#d946ef", "#f97316", "#2f7cf6"];

function splitGroups(mode: string, ranges: string, every: number, pages: number): number[][] {
  if (mode === "all") return Array.from({ length: pages }, (_, i) => [i + 1]);
  if (mode === "every") {
    const n = Math.max(1, every || 1);
    const groups: number[][] = [];
    for (let i = 1; i <= pages; i += n) groups.push(Array.from({ length: Math.min(n, pages - i + 1) }, (_, k) => i + k));
    return groups;
  }
  return ranges
    .split(",")
    .map((r) => [...parsePages(r, pages)].sort((a, b) => a - b))
    .filter((g) => g.length);
}

export function PagePicker(api: WorkspaceApi) {
  const { tool, files, values, setValue, color } = api;
  const { doc, state, pages } = usePdf(files[0], String(values.password ?? ""));
  const mode = tool.slug === "split-pdf" ? "split" : tool.slug === "remove-pages" ? "remove" : "select";
  const selected = useMemo(() => parsePages(String(values.pages ?? ""), pages), [values.pages, pages]);

  const splitMode = String(values.mode ?? "ranges");
  const groups = useMemo(
    () => (mode === "split" ? splitGroups(splitMode, String(values.ranges ?? ""), Number(values.every ?? 1), pages) : []),
    [mode, splitMode, values.ranges, values.every, pages],
  );
  const groupOf = useMemo(() => {
    const m = new Map<number, number>();
    groups.forEach((g, i) => g.forEach((p) => !m.has(p) && m.set(p, i)));
    return m;
  }, [groups]);
  // in range mode, a cut sits after the last page of every group but the final one
  const cuts = useMemo(() => new Set(groups.slice(0, -1).map((g) => g[g.length - 1])), [groups]);

  if (state === "locked") return <LockedNotice />;
  if (state === "error") return <PreviewError />;
  if (state !== "ready" || !doc) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-5">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[1/1.414] rounded-lg skeleton" />)}
      </div>
    );
  }

  function toggle(p: number) {
    const next = new Set(selected);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setValue("pages", next.size ? formatPages(next) : mode === "select" ? "all" : "");
  }

  function toggleCut(p: number) {
    if (p >= pages) return;
    if (splitMode !== "ranges") setValue("mode", "ranges");
    const next = splitMode === "ranges" ? new Set(cuts) : new Set<number>();
    if (next.has(p)) next.delete(p);
    else next.add(p);
    const bounds = [...next].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = 1;
    for (const b of [...bounds, pages]) {
      ranges.push(start === b ? `${start}` : `${start}-${b}`);
      start = b + 1;
    }
    setValue("ranges", bounds.length ? ranges.join(",") : "");
  }

  const allSelected = selected.size === pages;
  const summary =
    mode === "split"
      ? groups.length > 1
        ? `${plural(groups.length, "file")} will be created`
        : "Click the scissors between pages to choose where to split"
      : mode === "remove"
        ? selected.size
          ? `${plural(selected.size, "page")} will be removed · ${pages - selected.size} left`
          : "Click the pages you want to remove"
        : selected.size
          ? `${plural(selected.size, "page")} selected`
          : `All ${pages} pages · click pages to pick specific ones`;

  return (
    <div style={{ "--c": color } as CSSProperties}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">{summary}</p>
        {mode !== "split" && (
          <div className="flex gap-1">
            <button type="button" onClick={() => setValue("pages", allSelected ? (mode === "select" ? "all" : "") : `1-${pages}`)} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink">
              {allSelected ? "Clear" : "Select all"}
            </button>
            {pages > 1 && (
              <button
                type="button"
                onClick={() => {
                  const inv = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => !selected.has(p));
                  setValue("pages", inv.length ? formatPages(inv) : mode === "select" ? "all" : "");
                }}
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
              >
                Invert
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {Array.from({ length: Math.min(pages, 400) }, (_, i) => {
          const p = i + 1;
          const isSel = selected.has(p);
          const g = groupOf.get(p);
          const gColor = g !== undefined ? GROUP_COLORS[g % GROUP_COLORS.length] : undefined;
          return (
            <div key={p} className="relative">
              <button
                type="button"
                onClick={() => (mode === "split" ? undefined : toggle(p))}
                className={clsx(
                  "group relative block w-full overflow-hidden rounded-lg bg-white shadow-card ring-2 transition-all duration-200",
                  mode === "split" ? "cursor-default" : "hover:-translate-y-0.5",
                  mode === "remove" && isSel ? "ring-danger" : isSel ? "ring-[var(--c)]" : "ring-transparent hover:ring-line-strong",
                )}
                style={mode === "split" && gColor ? { boxShadow: `0 0 0 2px ${gColor}` } : undefined}
              >
                <PdfPage doc={doc} page={p} width={160} className={clsx("transition-opacity", mode === "remove" && isSel && "opacity-35")} />
                {mode === "remove" && isSel && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid size-10 place-items-center rounded-full bg-danger text-white shadow-lg"><Trash2 className="size-5" /></span>
                  </span>
                )}
                {mode === "select" && isSel && (
                  <span className="absolute top-2 right-2 grid size-6 animate-pop place-items-center rounded-full tint-bg text-white shadow"><Check className="size-4" strokeWidth={3} /></span>
                )}
                {mode === "split" && gColor && (
                  <span className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow" style={{ background: gColor }}>
                    File {g! + 1}
                  </span>
                )}
              </button>
              <p className="mt-2 text-center text-xs font-medium text-muted">{p}</p>

              {mode === "split" && p < pages && (
                <button
                  type="button"
                  onClick={() => toggleCut(p)}
                  title={cuts.has(p) && splitMode === "ranges" ? "Remove split" : "Split here"}
                  className={clsx(
                    "absolute top-1/2 -right-[19px] z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full border shadow-md transition-all",
                    cuts.has(p) && splitMode === "ranges"
                      ? "scale-110 border-transparent tint-bg text-white"
                      : "border-line bg-surface text-subtle opacity-60 hover:scale-110 hover:text-ink hover:opacity-100",
                  )}
                >
                  <Scissors className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {pages > 400 && <p className="mt-6 text-center text-sm text-muted">Showing the first 400 pages. Type page numbers in the panel for the rest.</p>}
    </div>
  );
}
