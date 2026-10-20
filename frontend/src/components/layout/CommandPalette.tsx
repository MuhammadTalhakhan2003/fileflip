"use client";

import clsx from "clsx";
import { CornerDownLeft, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ToolIcon } from "@/components/tools/ToolIcon";
import { Kbd } from "@/components/ui";
import { POPULAR } from "@/lib/toolMeta";
import { CATEGORIES, TOOLS, getTool, searchTools, type Tool } from "@/lib/tools";

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const POPULAR_TOOLS = POPULAR.map((s) => getTool(s)).filter(Boolean) as Tool[];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => (query.trim() ? searchTools(query).slice(0, 30) : POPULAR_TOOLS), [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function go(tool: Tool) {
    onClose();
    router.push(`/${tool.slug}`);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search tools">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-line bg-elevated shadow-float">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder={`Search ${TOOLS.length} tools... e.g. compress, jpg to png, sign`}
            className="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
          />
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-subtle hover:bg-surface-2 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <ul ref={listRef} className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
          {!query.trim() && <li className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">Popular</li>}
          {results.map((tool, i) => (
            <li key={tool.slug}>
              <button
                data-index={i}
                onMouseMove={() => setActive(i)}
                onClick={() => go(tool)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  i === active ? "bg-surface-2" : "",
                )}
              >
                <ToolIcon tool={tool} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{tool.name}</span>
                  <span className="block truncate text-xs text-muted">{CATEGORY_LABEL[tool.category]}</span>
                </span>
                {i === active && <CornerDownLeft className="size-4 text-subtle" />}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-muted">No tool matches &ldquo;{query}&rdquo;. Try &ldquo;pdf&rdquo; or &ldquo;image&rdquo;.</li>
          )}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-subtle">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd> open</span>
          <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </div>
  );
}
