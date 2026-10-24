"use client";

import { arc as d3arc, pie as d3pie } from "d3-shape";
import { useState } from "react";

import { useChartSize } from "@/components/charts/useChartSize";

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Donut with gaps between slices; the center shows the hovered slice (or the total). */
export function DonutChart({ slices, totalLabel, label }: { slices: Slice[]; totalLabel: string; label: string }) {
  const { ref, width, seen } = useChartSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const size = Math.min(width, 240);
  const r = size / 2;
  const arcs = d3pie<Slice>().value((s) => s.value).sort(null).padAngle(0.035)(slices);
  const shape = d3arc<{ startAngle: number; endAngle: number; padAngle: number }>()
    .innerRadius(r * 0.64)
    .outerRadius(r - 4)
    .cornerRadius(4);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const active = hover === null ? null : slices[hover];

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:flex-col">
      <div ref={ref} className="relative w-full max-w-60" style={{ height: size || 240 }}>
        {width > 0 && (
          <svg width={size} height={size} role="img" aria-label={label} className="mx-auto block">
            <g transform={`translate(${r},${r})`} style={{ transform: `translate(${r}px,${r}px) scale(${seen ? 1 : 0.85})`, opacity: seen ? 1 : 0, transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
              {arcs.map((a, i) => (
                <path
                  key={slices[i].label}
                  d={shape(a) ?? ""}
                  fill={slices[i].color}
                  opacity={hover === null || hover === i ? 1 : 0.3}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  style={{ transition: "opacity 200ms", cursor: "default" }}
                />
              ))}
            </g>
          </svg>
        )}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-3xl font-extrabold tracking-tight text-ink tabular-nums">{active ? active.value : total}</p>
            <p className="mt-0.5 max-w-28 text-xs text-muted">{active ? active.label : totalLabel}</p>
          </div>
        </div>
      </div>
      <ul className="grid w-full max-w-72 grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
        {slices.map((s, i) => (
          <li
            key={s.label}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className="flex items-center justify-between gap-2 text-muted"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-mono tabular-nums text-ink-2">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
