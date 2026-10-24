"use client";

import { useChartSize } from "@/components/charts/useChartSize";

/** A ring of rounded ticks (one per unit), lit up to `value`, like bklit's radial gauge. */
export function Gauge({
  value,
  max,
  center,
  caption,
  color = "var(--chart-1)",
  label,
}: {
  value: number;
  max: number;
  center: string;
  caption: string;
  color?: string;
  label: string;
}) {
  const { ref, width, seen } = useChartSize<HTMLDivElement>();
  const size = Math.min(width, 230);
  const r = size / 2;
  const sweep = 270; // degrees, open at the bottom
  const start = 135;
  const ticks = Array.from({ length: max }, (_, i) => i);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[230px]" style={{ height: size || 230 }}>
      {width > 0 && (
        <svg width={size} height={size} role="img" aria-label={label} className="mx-auto block">
          <g transform={`translate(${r},${r})`}>
            {ticks.map((i) => {
              const angle = ((start + (sweep * i) / (max - 1)) * Math.PI) / 180;
              const outer = r - 6;
              const inner = r - 22;
              const lit = i < value;
              return (
                <line
                  key={i}
                  x1={Math.cos(angle) * inner}
                  y1={Math.sin(angle) * inner}
                  x2={Math.cos(angle) * outer}
                  y2={Math.sin(angle) * outer}
                  stroke={lit && seen ? color : "var(--chart-grid)"}
                  strokeWidth={max > 40 ? 3.2 : 5}
                  strokeLinecap="round"
                  style={{ transition: `stroke 300ms ease ${i * 18}ms` }}
                />
              );
            })}
          </g>
        </svg>
      )}
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-extrabold tracking-tight text-ink">{center}</p>
          <p className="mt-0.5 text-xs text-muted">{caption}</p>
        </div>
      </div>
    </div>
  );
}
