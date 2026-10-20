import clsx from "clsx";
import type { CSSProperties } from "react";

import { formatChip, toolColor, toolIcon } from "@/lib/toolMeta";
import type { Tool } from "@/lib/tools";

const SIZES = {
  sm: { box: "size-9 rounded-xl", icon: "size-[18px]", chip: "text-[7px] px-1 -bottom-1 -right-1.5" },
  md: { box: "size-12 rounded-2xl", icon: "size-6", chip: "text-[8px] px-1.5 -bottom-1.5 -right-2" },
  lg: { box: "size-16 rounded-[20px]", icon: "size-8", chip: "text-[10px] px-1.5 py-px -bottom-1.5 -right-2.5" },
};

export function ToolIcon({ tool, size = "md", className }: { tool: Tool; size?: keyof typeof SIZES; className?: string }) {
  const Icon = toolIcon(tool);
  const chip = formatChip(tool);
  const s = SIZES[size];
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center", s.box, className)}
      style={
        {
          "--c": toolColor(tool),
          background:
            "linear-gradient(145deg, color-mix(in oklab, var(--c) 18%, transparent), color-mix(in oklab, var(--c) 7%, transparent))",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--c) 18%, transparent)",
        } as CSSProperties
      }
    >
      <Icon className={clsx(s.icon, "tint-text")} strokeWidth={1.9} />
      {chip && (
        <span
          className={clsx("absolute rounded-md font-extrabold tracking-wide text-white uppercase shadow-sm ring-2 ring-surface", s.chip)}
          style={{ background: chip.color }}
        >
          {chip.label}
        </span>
      )}
    </span>
  );
}
