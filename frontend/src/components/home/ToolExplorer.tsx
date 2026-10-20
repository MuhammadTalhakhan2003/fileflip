"use client";

import clsx from "clsx";
import { Search, X } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import { ToolCard } from "@/components/tools/ToolCard";
import { CATEGORY_STYLE, FEATURED_IMAGE_TOOLS } from "@/lib/toolMeta";
import { CATEGORIES, TOOLS, searchTools, type CategoryId, type Tool } from "@/lib/tools";

type Filter = "all" | CategoryId;

const TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "organize", label: "Organize" },
  { id: "optimize", label: "Optimize" },
  { id: "convert-to-pdf", label: "To PDF" },
  { id: "convert-from-pdf", label: "From PDF" },
  { id: "edit", label: "Edit" },
  { id: "security", label: "Security" },
  { id: "intelligence", label: "AI" },
  { id: "image", label: "Images" },
];

function visible(tools: Tool[], showAllImages: boolean): Tool[] {
  return showAllImages ? tools : tools.filter((t) => t.category !== "image" || FEATURED_IMAGE_TOOLS.includes(t.slug));
}

export function ToolExplorer() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [allImages, setAllImages] = useState(false);

  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchTools(query) : []), [query, searching]);
  const hiddenImages = TOOLS.filter((t) => t.category === "image").length - FEATURED_IMAGE_TOOLS.length;

  const groups = CATEGORIES.filter((c) => filter === "all" || c.id === filter).map((c) => ({
    ...c,
    tools: visible(
      TOOLS.filter((t) => t.category === c.id),
      allImages || filter === "image",
    ),
  }));

  return (
    <section id="tools" className="container-page scroll-mt-20 py-6">
      <div className="sticky top-16 z-30 -mx-4 mb-8 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
            {TABS.map((tab) => {
              const active = filter === tab.id && !searching;
              const color = tab.id === "all" ? "var(--brand)" : CATEGORY_STYLE[tab.id].color;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFilter(tab.id);
                    setQuery("");
                  }}
                  style={{ "--c": color } as CSSProperties}
                  className={clsx(
                    "shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-all duration-200",
                    active ? "tint-bg text-white shadow-[0_8px_20px_-10px_var(--c)]" : "text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <label className="relative block lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tools"
              aria-label="Filter tools"
              className="h-10 w-full rounded-full border border-line bg-surface pr-9 pl-10 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear" className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle hover:text-ink">
                <X className="size-4" />
              </button>
            )}
          </label>
        </div>
      </div>

      {searching ? (
        results.length ? (
          <div className="grid animate-fade-in gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-muted">No tools match &ldquo;{query}&rdquo;.</p>
        )
      ) : (
        <div className="space-y-14">
          {groups.map((g) => {
            const style = CATEGORY_STYLE[g.id];
            return (
              <div key={g.id} className="animate-fade-in">
                <div className="mb-5 flex items-end justify-between gap-4" style={{ "--c": style.color } as CSSProperties}>
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-1.5 rounded-full tint-bg" />
                    <div>
                      <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">{g.label}</h2>
                      <p className="text-sm text-muted">{style.tagline}</p>
                    </div>
                  </div>
                  <span className="hidden text-sm text-subtle sm:block">{g.tools.length} tools</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {g.tools.map((t) => (
                    <ToolCard key={t.slug} tool={t} />
                  ))}
                </div>
                {g.id === "image" && !allImages && filter !== "image" && hiddenImages > 0 && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => setAllImages(true)}
                      className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink-2 shadow-soft transition hover:border-line-strong hover:text-ink"
                    >
                      Show {hiddenImages} more image converters
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
