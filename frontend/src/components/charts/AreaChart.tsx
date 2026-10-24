"use client";

import { area as d3area, curveMonotoneX, curveStepAfter, line as d3line } from "d3-shape";
import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

import { linear, useChartSize } from "@/components/charts/useChartSize";

export interface AreaSeries {
  key: string;
  label: string;
  color: string;
  /** "step" jumps between points (good for "nothing, then everything") */
  curve?: "smooth" | "step";
  dashed?: boolean;
}

interface Props {
  data: Record<string, number>[];
  xKey: string;
  series: AreaSeries[];
  yDomain: [number, number];
  xTicks: number[];
  yTicks: number[];
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  height?: number;
  label: string;
}

const M = { top: 14, right: 14, bottom: 28, left: 40 };

/** Gradient area chart with a crosshair tooltip, in the spirit of bklit's area chart. */
export function AreaChart({ data, xKey, series, yDomain, xTicks, yTicks, formatX, formatY, height = 260, label }: Props) {
  const { ref, width, seen } = useChartSize<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const xs = data.map((d) => d[xKey]);
  const x = useMemo(() => linear([Math.min(...xs), Math.max(...xs)], [0, innerW]), [xs, innerW]);
  const y = useMemo(() => linear(yDomain, [innerH, 0]), [yDomain, innerH]);

  const paths = series.map((s) => {
    const curve = s.curve === "step" ? curveStepAfter : curveMonotoneX;
    const a = d3area<Record<string, number>>()
      .x((d) => x(d[xKey]))
      .y0(innerH)
      .y1((d) => y(d[s.key]))
      .curve(curve)(data);
    const l = d3line<Record<string, number>>()
      .x((d) => x(d[xKey]))
      .y((d) => y(d[s.key]))
      .curve(curve)(data);
    return { s, area: a ?? "", line: l ?? "" };
  });

  function onMove(e: ReactPointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(x(d[xKey]) - px) < Math.abs(x(data[best][xKey]) - px)) best = i;
    });
    setHover(best);
  }

  const point = hover === null ? null : data[hover];
  const tipLeft = point ? M.left + x(point[xKey]) : 0;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
            <clipPath id={`${uid}-reveal`}>
              <rect
                x={0}
                y={-M.top}
                height={height}
                width={seen ? innerW + 2 : 0}
                style={{ transition: "width 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            </clipPath>
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeDasharray="3 4" />
                <text x={-10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--subtle)] text-[11px] tabular-nums">
                  {formatY(t)}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={innerH + 20} textAnchor="middle" className="fill-[var(--subtle)] text-[11px] tabular-nums">
                {formatX(t)}
              </text>
            ))}
            <g clipPath={`url(#${uid}-reveal)`}>
              {paths.map(({ s, area: a, line: l }) => (
                <g key={s.key}>
                  <path d={a} fill={`url(#${uid}-${s.key})`} />
                  <path d={l} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 5" : undefined} strokeLinejoin="round" />
                </g>
              ))}
            </g>
            {point && (
              <g pointerEvents="none">
                <line x1={x(point[xKey])} x2={x(point[xKey])} y1={0} y2={innerH} stroke="var(--chart-crosshair)" strokeDasharray="3 3" />
                {series.map((s) => (
                  <circle key={s.key} cx={x(point[xKey])} cy={y(point[s.key])} r={4.5} fill="var(--surface)" stroke={s.color} strokeWidth={2.5} />
                ))}
              </g>
            )}
            <rect
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
              style={{ touchAction: "pan-y" }}
            />
          </g>
        </svg>
      )}
      {point && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl px-3 py-2 text-xs shadow-float"
          style={{
            left: Math.min(Math.max(tipLeft, 80), width - 80),
            background: "var(--chart-tooltip)",
            color: "var(--chart-tooltip-ink)",
          }}
        >
          <p className="font-mono text-[10.5px] tracking-wide opacity-70">{formatX(point[xKey])}</p>
          {series.map((s) => (
            <p key={s.key} className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <b className="tabular-nums">{formatY(point[s.key])}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
