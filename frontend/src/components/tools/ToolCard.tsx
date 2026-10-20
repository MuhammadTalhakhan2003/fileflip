import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Badge } from "@/components/ui";
import { ToolIcon } from "@/components/tools/ToolIcon";
import { BADGES, toolColor } from "@/lib/toolMeta";
import type { Tool } from "@/lib/tools";

export function ToolCard({ tool, compact = false }: { tool: Tool; compact?: boolean }) {
  const badge = BADGES[tool.slug];
  return (
    <Link
      href={`/${tool.slug}`}
      style={{ "--c": toolColor(tool) } as CSSProperties}
      className={clsx(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300",
        "hover:-translate-y-1 hover:border-transparent hover:tint-ring",
        compact ? "gap-3 p-4" : "gap-4 p-5 sm:p-6",
      )}
    >
      {/* soft color wash that fades in on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--c) 9%, transparent), transparent 60%)" }}
      />
      <div className="relative flex items-start justify-between">
        <ToolIcon tool={tool} size={compact ? "sm" : "md"} />
        <span className="flex items-center gap-2">
          {badge && <Badge tone={badge === "AI" ? "ai" : badge === "New" ? "new" : "brand"}>{badge}</Badge>}
          <ArrowUpRight className="size-4 -translate-x-1 translate-y-1 text-subtle opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 group-hover:tint-text" />
        </span>
      </div>
      <div className="relative">
        <h3 className={clsx("font-display font-bold tracking-tight text-ink", compact ? "text-[15px]" : "text-[17px]")}>{tool.name}</h3>
        <p className={clsx("mt-1.5 line-clamp-2 leading-relaxed text-muted", compact ? "text-[13px]" : "text-sm")}>{tool.description}</p>
      </div>
    </Link>
  );
}
