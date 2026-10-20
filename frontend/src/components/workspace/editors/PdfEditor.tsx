"use client";

import clsx from "clsx";
import { Circle, Eraser, Highlighter, ImagePlus, MousePointer2, Pencil, Square, Trash2, Type, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { DraggableBox, LockedNotice, PageCanvas, PreviewError, PageNav, newId, toPoint, type Box } from "@/components/workspace/editors/PageCanvas";
import { usePdf } from "@/components/workspace/Preview";
import type { WorkspaceApi } from "@/components/workspace/types";

type ToolKind = "select" | "text" | "rect" | "ellipse" | "highlight" | "whiteout" | "ink" | "image";

interface Item extends Box {
  id: string;
  page: number;
  type: Exclude<ToolKind, "select">;
  color: string;
  stroke: number;
  size?: number;
  text?: string;
  bold?: boolean;
  points?: [number, number][];
  image?: number;
}

const TOOLS: { id: ToolKind; label: string; icon: typeof Type; key: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, key: "v" },
  { id: "text", label: "Text", icon: Type, key: "t" },
  { id: "rect", label: "Rectangle", icon: Square, key: "r" },
  { id: "ellipse", label: "Ellipse", icon: Circle, key: "o" },
  { id: "highlight", label: "Highlight", icon: Highlighter, key: "h" },
  { id: "whiteout", label: "Whiteout", icon: Eraser, key: "w" },
  { id: "ink", label: "Draw", icon: Pencil, key: "d" },
  { id: "image", label: "Image", icon: ImagePlus, key: "i" },
];
const SWATCHES = ["#111827", "#e5322d", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#ffffff"];

function toOperation(it: Item) {
  const base = { page: it.page };
  switch (it.type) {
    case "text":
      return { ...base, type: "text", x: it.x, y: it.y, width: it.width, height: it.height, text: it.text ?? "", size: it.size ?? 14, color: it.color, bold: Boolean(it.bold) };
    case "rect":
    case "ellipse":
      return { ...base, type: it.type, x: it.x, y: it.y, width: it.width, height: it.height, stroke: it.color, stroke_width: it.stroke };
    case "highlight":
      return { ...base, type: "highlight", x: it.x, y: it.y, width: it.width, height: it.height, color: it.color === "#111827" ? "#ffeb3b" : it.color, opacity: 0.4 };
    case "whiteout":
      return { ...base, type: "whiteout", x: it.x, y: it.y, width: it.width, height: it.height };
    case "ink":
      return { ...base, type: "ink", points: it.points, color: it.color, stroke_width: it.stroke };
    case "image":
      return { ...base, type: "image", x: it.x, y: it.y, width: it.width, height: it.height, image: it.image ?? 0 };
  }
}

export function PdfEditor(api: WorkspaceApi) {
  const { files, values, setValue, extras, setExtra, color } = api;
  const { doc, state, pages } = usePdf(files[0], String(values.password ?? ""));
  const [page, setPage] = useState(1);
  const [tool, setTool] = useState<ToolKind>("text");
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<Item[][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ink, setInk] = useState("#111827");
  const [stroke, setStroke] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [draft, setDraft] = useState<Item | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const images = useMemo(() => extras.images ?? [], [extras.images]);
  const imageUrls = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => imageUrls.forEach((u) => URL.revokeObjectURL(u)), [imageUrls]);

  useEffect(() => {
    setValue("operations", items.length ? items.map(toOperation) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const commit = (next: Item[]) => {
    setHistory((h) => [...h.slice(-50), items]);
    setItems(next);
  };
  const patch = (id: string, change: Partial<Item>, record = false) => {
    const next = items.map((it) => (it.id === id ? { ...it, ...change } : it));
    if (record) commit(next);
    else setItems(next);
  };
  const undo = () => {
    if (!history.length) return;
    setItems(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected && !typing) {
        commit(items.filter((it) => it.id !== selected));
        setSelected(null);
      } else if (!typing && !e.ctrlKey && !e.metaKey) {
        const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
        if (t) t.id === "image" ? fileInput.current?.click() : setTool(t.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sel = items.find((it) => it.id === selected);

  if (state === "locked") return <LockedNotice />;
  if (state === "error") return <PreviewError />;
  if (state !== "ready" || !doc) return <div className="mx-auto aspect-[1/1.414] max-w-xl rounded-lg skeleton" />;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, scale: number, size: { width: number; height: number }) {
    if (e.target !== e.currentTarget) return;
    setSelected(null);
    if (tool === "select" || tool === "image") return;
    const el = e.currentTarget;
    const start = toPoint(e, el, scale);
    if (tool === "text") {
      e.preventDefault(); // keep the browser from moving focus away from the new text box
      const item: Item = { id: newId(), page, type: "text", x: start.x, y: Math.max(0, start.y - fontSize * 0.7), width: Math.min(220, size.width - start.x), height: fontSize * 1.5, text: "", size: fontSize, color: ink, stroke };
      commit([...items, item]);
      setSelected(item.id);
      setTool("select");
      return;
    }
    const base: Item = { id: newId(), page, type: tool, x: start.x, y: start.y, width: 0, height: 0, color: ink, stroke, points: tool === "ink" ? [[start.x, start.y]] : undefined };
    setDraft(base);
    el.setPointerCapture(e.pointerId);
    let current = base;
    const move = (ev: PointerEvent) => {
      const p = toPoint(ev, el, scale);
      const px = Math.max(0, Math.min(size.width, p.x));
      const py = Math.max(0, Math.min(size.height, p.y));
      current =
        tool === "ink"
          ? { ...current, points: [...(current.points ?? []), [px, py]] }
          : { ...current, x: Math.min(start.x, px), y: Math.min(start.y, py), width: Math.abs(px - start.x), height: Math.abs(py - start.y) };
      setDraft(current);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setDraft(null);
      if (tool === "ink") {
        if ((current.points?.length ?? 0) > 1) commit([...items, current]);
        return;
      }
      if (current.width < 4 || current.height < 4) {
        const w = tool === "highlight" ? 140 : 120;
        const h = tool === "highlight" ? 18 : 70;
        current = { ...current, width: Math.min(w, size.width - current.x), height: Math.min(h, size.height - current.y) };
      }
      commit([...items, current]);
      setSelected(current.id);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  function addImage(file: File) {
    const index = images.length;
    setExtra("images", [...images, file]);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth || 1;
      const item: Item = { id: newId(), page, type: "image", x: 60, y: 80, width: 180, height: 180 * ratio, color: ink, stroke, image: index };
      commit([...items, item]);
      setSelected(item.id);
      setTool("select");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const showFont = tool === "text" || sel?.type === "text";
  const showStroke = ["rect", "ellipse", "ink"].includes(tool) || ["rect", "ellipse", "ink"].includes(sel?.type ?? "");

  return (
    <div style={{ "--c": color } as CSSProperties}>
      {/* toolbar */}
      <div className="sticky top-[4.5rem] z-20 mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-elevated/95 p-2 shadow-card backdrop-blur select-none">
        <div className="flex flex-wrap gap-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={`${t.label} (${t.key.toUpperCase()})`}
              aria-label={t.label}
              aria-pressed={tool === t.id}
              onClick={() => (t.id === "image" ? fileInput.current?.click() : setTool(t.id))}
              className={clsx(
                "grid size-10 place-items-center rounded-xl transition-all",
                tool === t.id && t.id !== "image" ? "tint-bg text-white shadow-[0_8px_18px_-8px_var(--c)]" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <t.icon className="size-[18px]" />
            </button>
          ))}
        </div>
        <span className="mx-1 hidden h-7 w-px bg-line sm:block" />
        <div className="flex items-center gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => {
                setInk(c);
                if (sel) patch(sel.id, { color: c }, true);
              }}
              className={clsx("size-6 rounded-full ring-1 ring-black/10 transition", (sel?.color ?? ink) === c ? "scale-110 ring-2 ring-[var(--c)] ring-offset-2 ring-offset-elevated" : "hover:scale-110")}
              style={{ background: c }}
            />
          ))}
        </div>
        {showFont && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Size
            <select
              value={sel?.type === "text" ? sel.size : fontSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFontSize(v);
                if (sel?.type === "text") patch(sel.id, { size: v, height: Math.max(sel.height, v * 1.5) }, true);
              }}
              className="h-8 rounded-lg border border-line bg-surface px-1.5 text-sm text-ink"
            >
              {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        {sel?.type === "text" && (
          <button type="button" onClick={() => patch(sel.id, { bold: !sel.bold }, true)} className={clsx("grid size-8 place-items-center rounded-lg text-sm font-bold", sel.bold ? "bg-surface-3 text-ink" : "text-muted hover:bg-surface-2")}>
            B
          </button>
        )}
        {showStroke && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Line
            <input type="range" min={1} max={10} value={sel ? sel.stroke : stroke} onChange={(e) => {
              const v = Number(e.target.value);
              setStroke(v);
              if (sel) patch(sel.id, { stroke: v });
            }} className="w-20 accent-[var(--c)]" />
          </label>
        )}
        <div className="ml-auto flex items-center gap-1">
          {sel && (
            <button type="button" onClick={() => { commit(items.filter((i) => i.id !== sel.id)); setSelected(null); }} aria-label="Delete selected" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-danger/10 hover:text-danger">
              <Trash2 className="size-[18px]" />
            </button>
          )}
          <button type="button" onClick={undo} disabled={!history.length} aria-label="Undo" title="Undo (Ctrl Z)" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40">
            <Undo2 className="size-[18px]" />
          </button>
          <PageNav page={page} pages={pages} onChange={(p) => { setPage(p); setSelected(null); }} />
        </div>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addImage(f);
          e.target.value = "";
        }} />
      </div>

      <div className="rounded-2xl bg-surface-2 p-3 sm:p-6">
        <PageCanvas doc={doc} page={page} maxWidth={820}>
          {(info) => (
            <div
              className={clsx("absolute inset-0", tool === "select" ? "cursor-default" : tool === "text" ? "cursor-text" : "cursor-crosshair")}
              onPointerDown={(e) => onPointerDown(e, info.scale, info)}
            >
              {/* ink strokes */}
              <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${info.width} ${info.height}`} preserveAspectRatio="none">
                {[...items.filter((it) => it.page === page && it.type === "ink"), ...(draft?.type === "ink" ? [draft] : [])].map((it) => (
                  <polyline
                    key={it.id}
                    points={(it.points ?? []).map((p) => p.join(",")).join(" ")}
                    fill="none"
                    stroke={it.color}
                    strokeWidth={it.stroke}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={clsx("pointer-events-auto", selected === it.id && "drop-shadow-[0_0_3px_var(--c)]")}
                    onPointerDown={(e) => { e.stopPropagation(); setSelected(it.id); }}
                  />
                ))}
              </svg>

              {items
                .filter((it) => it.page === page && it.type !== "ink")
                .map((it) => (
                  <DraggableBox
                    key={it.id}
                    box={it}
                    scale={info.scale}
                    bounds={info}
                    selected={selected === it.id}
                    keepAspect={it.type === "image"}
                    onSelect={() => setSelected(it.id)}
                    onChange={(b) => patch(it.id, b)}
                    onDelete={() => commit(items.filter((x) => x.id !== it.id))}
                  >
                    <ItemView item={it} scale={info.scale} imageUrl={it.image !== undefined ? imageUrls[it.image] : undefined} editing={selected === it.id} onText={(t) => patch(it.id, { text: t })} />
                  </DraggableBox>
                ))}

              {draft && draft.type !== "ink" && (
                <div
                  className="pointer-events-none absolute"
                  style={{ left: draft.x * info.scale, top: draft.y * info.scale, width: draft.width * info.scale, height: draft.height * info.scale }}
                >
                  <ItemView item={draft} scale={info.scale} />
                </div>
              )}
            </div>
          )}
        </PageCanvas>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        {items.length ? `${items.length} edit${items.length > 1 ? "s" : ""} · select an item to move, resize or delete it` : "Pick a tool above, then click or drag on the page."}
      </p>
    </div>
  );
}

function TextEditor({ item, scale, onText }: { item: Item; scale: number; onText: (t: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <textarea
      ref={ref}
      value={item.text}
      onChange={(e) => onText(e.target.value)}
      placeholder="Type here"
      className="size-full resize-none overflow-hidden bg-transparent p-0 leading-[1.2] outline-none placeholder:text-slate-400"
      style={{ fontSize: (item.size ?? 14) * scale, color: item.color, fontWeight: item.bold ? 700 : 400 }}
    />
  );
}

function ItemView({ item, scale, imageUrl, editing, onText }: { item: Item; scale: number; imageUrl?: string; editing?: boolean; onText?: (t: string) => void }) {
  switch (item.type) {
    case "text":
      return editing && onText ? (
        <TextEditor item={item} scale={scale} onText={onText} />
      ) : (
        <div className="size-full overflow-hidden leading-[1.2] whitespace-pre-wrap" style={{ fontSize: (item.size ?? 14) * scale, color: item.color, fontWeight: item.bold ? 700 : 400 }}>
          {item.text || <span className="text-slate-400">Type here</span>}
        </div>
      );
    case "rect":
      return <div className="size-full" style={{ border: `${item.stroke * scale}px solid ${item.color}` }} />;
    case "ellipse":
      return <div className="size-full rounded-[50%]" style={{ border: `${item.stroke * scale}px solid ${item.color}` }} />;
    case "highlight":
      return <div className="size-full mix-blend-multiply" style={{ background: item.color === "#111827" ? "#ffeb3b" : item.color, opacity: 0.4 }} />;
    case "whiteout":
      return <div className="size-full bg-white ring-1 ring-slate-200" />;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return imageUrl ? <img src={imageUrl} alt="" draggable={false} className="pointer-events-none size-full object-contain" /> : null;
    default:
      return null;
  }
}

export function validateEdit(api: WorkspaceApi): string | null {
  const ops = api.values.operations;
  return Array.isArray(ops) && ops.length ? null : "Add at least one edit to the document.";
}
