"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { FilePlus2, Plus, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui";
import { fileId } from "@/components/workspace/FileGrid";
import { LockedNotice, PreviewError } from "@/components/workspace/editors/PageCanvas";
import { PdfPage } from "@/components/workspace/Preview";
import type { WorkspaceApi } from "@/components/workspace/types";
import { PdfPasswordError, openPdf } from "@/lib/pdf";

interface PageItem {
  id: string;
  fileKey: string;
  page: number;
  rotate: number;
  blank?: boolean;
}

const FILE_COLORS = ["#5145f0", "#f04463", "#22a45d", "#f59e0b", "#0e9fb8", "#d946ef"];

function useDocs(files: File[], password: string) {
  const [docs, setDocs] = useState<Map<string, PDFDocumentProxy>>(new Map());
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all(files.map(async (f) => [fileId(f), await openPdf(f, password)] as const))
      .then((entries) => {
        if (!alive) return;
        setLocked(false);
        setFailed(false);
        setDocs(new Map(entries));
      })
      .catch((e) => {
        if (!alive) return;
        setLocked(e instanceof PdfPasswordError);
        setFailed(!(e instanceof PdfPasswordError));
      });
    return () => {
      alive = false;
    };
  }, [files, password]);
  return { docs, locked, failed };
}

/** Shared page grid. `organize` allows reordering, deleting and blank pages; otherwise rotation only. */
export function PageOrganizer(api: WorkspaceApi & { rotateOnly?: boolean }) {
  const { files, values, setValue, color, rotateOnly, browse, tool } = api;
  const { docs, locked, failed } = useDocs(files, String(values.password ?? ""));
  const [items, setItems] = useState<PageItem[]>([]);
  const [history, setHistory] = useState<PageItem[][]>([]);

  // (re)build the page list when files change, keeping edits for files that are still there
  useEffect(() => {
    if (!docs.size) return;
    setItems((prev) => {
      const keys = files.map(fileId);
      const kept = prev.filter((it) => it.blank || keys.includes(it.fileKey));
      const known = new Set(kept.map((it) => it.fileKey));
      const added: PageItem[] = [];
      for (const key of keys) {
        const doc = docs.get(key);
        if (!doc || known.has(key)) continue;
        for (let p = 1; p <= doc.numPages; p++) added.push({ id: `${key}-${p}`, fileKey: key, page: p, rotate: 0 });
      }
      return [...kept, ...added];
    });
  }, [docs, files]);

  // publish to the form
  useEffect(() => {
    const keys = files.map(fileId);
    if (rotateOnly) {
      const rotations: Record<string, number> = {};
      for (const it of items) if (it.rotate % 360) rotations[String(it.page)] = ((it.rotate % 360) + 360) % 360;
      setValue("rotations", Object.keys(rotations).length ? rotations : null);
    } else {
      setValue(
        "order",
        items.length
          ? items.map((it) => (it.blank ? { blank: true } : { file: keys.indexOf(it.fileKey), page: it.page, rotate: ((it.rotate % 360) + 360) % 360 }))
          : null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rotateOnly]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  const commit = (next: PageItem[]) => {
    setHistory((h) => [...h.slice(-30), items]);
    setItems(next);
  };
  const rotate = (id: string, by: number) => commit(items.map((it) => (it.id === id ? { ...it, rotate: it.rotate + by } : it)));
  const rotateAll = (by: number) => commit(items.map((it) => ({ ...it, rotate: it.rotate + by })));

  if (locked) return <LockedNotice />;
  if (failed) return <PreviewError />;
  if (!items.length) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-5">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[1/1.414] rounded-lg skeleton" />)}
      </div>
    );
  }

  return (
    <div style={{ "--c": color } as CSSProperties}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" leftIcon={<RotateCcw className="size-4" />} onClick={() => rotateAll(-90)}>
          Rotate all left
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<RotateCw className="size-4" />} onClick={() => rotateAll(90)}>
          Rotate all right
        </Button>
        {!rotateOnly && files.length < tool.max_files && (
          <Button variant="secondary" size="sm" leftIcon={<FilePlus2 className="size-4" />} onClick={browse}>
            Add PDF
          </Button>
        )}
        <Button variant="ghost" size="sm" leftIcon={<Undo2 className="size-4" />} disabled={!history.length} onClick={() => {
          setItems(history[history.length - 1]);
          setHistory((h) => h.slice(0, -1));
        }}>
          Undo
        </Button>
        <span className="ml-auto text-sm text-muted">{items.length} pages{!rotateOnly && " · drag to reorder"}</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e: DragEndEvent) => {
          if (!e.over || e.active.id === e.over.id) return;
          commit(arrayMove(items, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
        }}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy} disabled={rotateOnly}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]">
            {items.map((it, i) => (
              <PageCard
                key={it.id}
                item={it}
                index={i}
                doc={docs.get(it.fileKey)}
                fileColor={files.length > 1 ? FILE_COLORS[files.map(fileId).indexOf(it.fileKey) % FILE_COLORS.length] : undefined}
                rotateOnly={rotateOnly}
                onRotate={(by) => rotate(it.id, by)}
                onDelete={items.length > 1 ? () => commit(items.filter((x) => x.id !== it.id)) : undefined}
                onBlank={() => {
                  const next = [...items];
                  next.splice(i + 1, 0, { id: `blank-${Date.now()}`, fileKey: "", page: 0, rotate: 0, blank: true });
                  commit(next);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function PageCard({
  item,
  index,
  doc,
  fileColor,
  rotateOnly,
  onRotate,
  onDelete,
  onBlank,
}: {
  item: PageItem;
  index: number;
  doc?: PDFDocumentProxy;
  fileColor?: string;
  rotateOnly?: boolean;
  onRotate: (by: number) => void;
  onDelete?: () => void;
  onBlank: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: rotateOnly });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={clsx("group relative", isDragging && "z-20")}>
      <div
        {...attributes}
        {...listeners}
        className={clsx(
          "relative grid aspect-[1/1.2] place-items-center rounded-xl bg-surface-2 p-2.5 ring-1 ring-line transition-all",
          !rotateOnly && "cursor-grab active:cursor-grabbing",
          isDragging ? "scale-105 shadow-float ring-2 ring-[var(--c)]" : "hover:ring-line-strong",
        )}
      >
        {item.blank ? (
          <div className="grid aspect-[1/1.414] w-[80%] place-items-center bg-white text-[11px] font-medium text-slate-400 shadow-card">Blank</div>
        ) : doc ? (
          <div className="w-full shadow-card">
            <PdfPage doc={doc} page={item.page} width={150} rotation={item.rotate} />
          </div>
        ) : (
          <div className="aspect-[1/1.414] w-[80%] skeleton" />
        )}
        {fileColor && !item.blank && <span className="absolute top-2 left-2 size-2.5 rounded-full ring-2 ring-surface" style={{ background: fileColor }} />}
      </div>

      {/* hover actions */}
      <div className="absolute inset-x-0 top-2 flex justify-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <IconAction label="Rotate left" onClick={() => onRotate(-90)}><RotateCcw className="size-3.5" /></IconAction>
        <IconAction label="Rotate right" onClick={() => onRotate(90)}><RotateCw className="size-3.5" /></IconAction>
        {!rotateOnly && onDelete && <IconAction label="Delete page" danger onClick={onDelete}><Trash2 className="size-3.5" /></IconAction>}
      </div>
      {!rotateOnly && (
        <button
          type="button"
          onClick={onBlank}
          title="Insert blank page after"
          className="absolute top-1/2 -right-[17px] z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-subtle opacity-0 shadow transition-all group-hover:opacity-100 hover:tint-bg hover:text-white"
        >
          <Plus className="size-3.5" />
        </button>
      )}
      <p className="mt-2 text-center text-xs font-medium text-muted">
        {item.blank ? "Blank" : index + 1}
        {item.rotate % 360 !== 0 && <span className="ml-1 tint-text">↻ {((item.rotate % 360) + 360) % 360}°</span>}
      </p>
    </div>
  );
}

function IconAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={clsx(
        "grid size-7 place-items-center rounded-lg bg-surface/95 text-ink-2 shadow-md ring-1 ring-line backdrop-blur transition-colors",
        danger ? "hover:bg-danger hover:text-white" : "hover:tint-bg hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export function RotateView(api: WorkspaceApi) {
  return <PageOrganizer {...api} rotateOnly />;
}
