"use client";

import clsx from "clsx";
import { ClipboardPaste, CloudUpload, Lock, Plus, Timer } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { formatList, type Tool } from "@/lib/tools";

export function fileNoun(tool: Tool): string {
  const a = tool.accepts;
  if (a.length === 1 && a[0] === "pdf") return "PDF";
  if (a.includes("docx")) return "Word file";
  if (a.includes("xlsx")) return "spreadsheet";
  if (a.includes("pptx")) return "presentation";
  if (a.includes("html")) return "HTML file";
  if (a.includes("png") || a.includes("jpg") || a.includes("webp") || a.includes("heic")) return "image";
  return "file";
}

export function Dropzone({ tool, color, onFiles, onBrowse }: { tool: Tool; color: string; onFiles: (f: File[]) => void; onBrowse: () => void }) {
  const [over, setOver] = useState(false);
  const noun = fileNoun(tool);
  const many = tool.max_files > 1;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      style={{ "--c": color } as CSSProperties}
      className={clsx(
        "relative overflow-hidden rounded-[28px] border-2 border-dashed px-6 py-14 text-center transition-all duration-300 sm:py-20",
        over ? "scale-[1.01] border-[var(--c)] tint-soft" : "border-line-strong bg-surface hover:border-[color-mix(in_oklab,var(--c)_50%,transparent)]",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--c) 10%, transparent), transparent)" }} />
      <div className="relative">
        <div className="relative mx-auto mb-7 grid size-20 place-items-center">
          <span className="absolute inset-0 rounded-full tint-soft" />
          <span className={clsx("absolute inset-2 rounded-full border-2 border-dashed border-[color-mix(in_oklab,var(--c)_35%,transparent)]", over && "animate-spin-slow")} />
          <CloudUpload className={clsx("relative size-9 tint-text", over && "animate-bounce")} strokeWidth={1.7} />
        </div>
        <button
          type="button"
          onClick={onBrowse}
          className="inline-flex h-14 items-center gap-2.5 rounded-2xl tint-bg px-8 text-base font-semibold text-white shadow-[0_14px_30px_-12px_var(--c)] transition-all hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
        >
          <Plus className="size-5" strokeWidth={2.5} />
          Select {many ? `${noun}s` : noun}
        </button>
        <p className="mt-4 text-[15px] text-muted">
          or <span className="font-semibold text-ink-2">drop {many ? "them" : "it"} here</span>
          <span className="hidden sm:inline">
            {" "}· paste with <kbd className="rounded border border-line bg-surface-2 px-1.5 text-xs">Ctrl V</kbd>
          </span>
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-subtle">
          <span className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-muted">{formatList(tool.accepts, 6)}</span>
          {many && <span>Up to {Math.min(tool.max_files, 20)} files</span>}
          <span>Max 100 MB</span>
          <span className="flex items-center gap-1"><Lock className="size-3.5" /> Encrypted</span>
          <span className="flex items-center gap-1"><Timer className="size-3.5" /> Auto-deleted</span>
          <span className="hidden items-center gap-1 sm:flex"><ClipboardPaste className="size-3.5" /> Paste supported</span>
        </div>
      </div>
    </div>
  );
}
