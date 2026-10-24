"use client";

import { useId, useState } from "react";

import { linear, useChartSize } from "@/components/charts/useChartSize";

export interface Bar {
  label: string;
  value: number;
  /** hatched bars mark a second group (explained in the chart's legend) */
  hatched?: boolean;
}

/** Horizontal bars: long labels stay readable on a phone. */
export function BarChart({
  bars,
  max,
  format,
  color = "var(--chart-1)",
  hatchColor = "var(--chart-2)",
  label,
}: {
  bars: Bar[];
  max: number;
  format: (v: number) => string;
  color?: string;
  hatchColor?: string;
  label: string;
}) {
  const { ref, width, seen } = useChartSize<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const labelW = Math.min(118, Math.max(92, width * 0.3));
  const valueW = 44;
  const rowH = 30;
  const gap = 10;
  const height = bars.length * (rowH + gap) - gap;
  const x = linear([0, max], [0, Math.max(0, width - labelW - valueW)]);

  return (
    <div ref={ref} className="w-full select-none">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <defs>
            <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={hatchColor} fillOpacity={0.14} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={hatchColor} strokeWidth="3" />
            </pattern>
          </defs>
          {bars.map((b, i) => {
            const top = i * (rowH + gap);
            const w = Math.max(4, x(b.value));
            const dim = hover !== null && hover !== i;
            return (
              <g
                key={b.label}
                transform={`translate(0,${top})`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                style={{ opacity: dim ? 0.45 : 1, transition: "opacity 200ms" }}
              >
                <text x={0} y={rowH / 2} dy="0.35em" className="fill-[var(--ink-2)] text-[12.5px] font-medium">
                  {b.label}
                </text>
                <rect x={labelW} y={4} width={Math.max(0, width - labelW - valueW)} height={rowH - 8} rx={6} fill="var(--chart-grid)" opacity={0.6} />
                <rect
                  x={labelW}
                  y={4}
                  height={rowH - 8}
                  rx={6}
                  width={seen ? w : 0}
                  fill={b.hatched ? `url(#${uid}-hatch)` : color}
                  stroke={b.hatched ? hatchColor : "none"}
                  strokeWidth={b.hatched ? 1 : 0}
                  style={{ transition: `width 900ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 70}ms` }}
                />
                <text
                  x={width}
                  y={rowH / 2}
                  dy="0.35em"
                  textAnchor="end"
                  className="fill-[var(--ink)] font-mono text-[12px] tabular-nums"
                >
                  {format(b.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
