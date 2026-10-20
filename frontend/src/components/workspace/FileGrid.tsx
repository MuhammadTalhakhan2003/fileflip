"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { ArrowDownAZ, GripVertical, Plus, X } from "lucide-react";
import { useMemo, type CSSProperties } from "react";

import { FileThumb } from "@/components/workspace/Preview";
import type { WorkspaceApi } from "@/components/workspace/types";
import { formatBytes } from "@/lib/format";

const ids = new WeakMap<File, string>();
let counter = 0;
export function fileId(f: File): string {
  let id = ids.get(f);
  if (!id) {
    id = `f${++counter}`;
    ids.set(f, id);
  }
  return id;
}

export function FileGrid(api: WorkspaceApi) {
  const { files, setFiles, removeFile, browse, tool, color } = api;
  const sortable = tool.max_files > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const items = useMemo(() => files.map(fileId), [files]);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setFiles(arrayMove(files, items.indexOf(String(e.active.id)), items.indexOf(String(e.over.id))));
  }

  return (
    <div style={{ "--c": color } as CSSProperties}>
      {sortable && files.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            <GripVertical className="mr-1 inline size-4 text-subtle" />
            Drag to change the order
          </p>
          <button
            type="button"
            onClick={() => setFiles([...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ArrowDownAZ className="size-4" /> Sort by name
          </button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {files.map((f, i) => (
              <FileCard key={fileId(f)} id={fileId(f)} file={f} index={i} showIndex={sortable && files.length > 1} onRemove={() => removeFile(i)} />
            ))}
            {files.length < tool.max_files && (
              <button
                type="button"
                onClick={browse}
                className="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong text-muted transition-all hover:border-[var(--c)] hover:tint-soft"
              >
                <span className="grid size-12 place-items-center rounded-full tint-bg text-white shadow-lg transition-transform group-hover:scale-110">
                  <Plus className="size-6" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-semibold">Add {sortable ? "more files" : "file"}</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function FileCard({ id, file, index, showIndex, onRemove }: { id: string; file: File; index: number; showIndex: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        "group relative flex animate-scale-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft transition-shadow",
        isDragging ? "z-10 scale-[1.03] shadow-float ring-2 ring-[var(--c)]" : "hover:shadow-card",
        showIndex && "cursor-grab active:cursor-grabbing",
      )}
      {...(showIndex ? { ...attributes, ...listeners } : {})}
    >
      <FileThumb file={file} className="aspect-[4/4.2] w-full" />
      <div className="border-t border-line px-3 py-2.5">
        <p className="truncate text-[13px] font-semibold text-ink" title={file.name}>{file.name}</p>
        <p className="text-xs text-subtle">{formatBytes(file.size)}</p>
      </div>
      {showIndex && (
        <span className="absolute top-2.5 left-2.5 grid size-6 place-items-center rounded-full tint-bg text-[11px] font-bold text-white shadow">{index + 1}</span>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-surface/95 text-muted opacity-100 shadow-md ring-1 ring-line transition-all hover:bg-danger hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
