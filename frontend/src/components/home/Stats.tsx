"use client";

import type { ReactNode } from "react";

import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { Gauge } from "@/components/charts/Gauge";
import { CATEGORY_STYLE } from "@/lib/toolMeta";
import { CATEGORIES, TOOLS } from "@/lib/tools";

/* Every number here was measured, not invented. */

// A 12-page scanned PDF through OCR, sampled every 2 s while testing the live progress feature.
const OCR_RUN = [
  [0, 0], [2, 2], [4, 2], [6, 12.1], [8, 19.2], [10, 33.3], [12, 40.4], [14, 54.6], [16, 68.8], [18, 75.8], [20, 92], [21, 100],
].map(([t, live]) => ({ t, live, before: t < 21 ? 0 : 100 }));

// One small file per tool, timed end to end against the live server (seconds).
const SPEEDS = [
  { label: "Compress PDF", value: 0.37 },
  { label: "JPG to PNG", value: 0.43 },
  { label: "Merge PDF", value: 0.44 },
  { label: "PDF to Word", value: 2.52 },
  { label: "Excel to PDF", value: 3.21, hatched: true },
  { label: "Word to PDF", value: 4.04, hatched: true },
  { label: "OCR, 1 page", value: 7.51 },
];

const SHORT: Record<string, string> = {
  organize: "Organize",
  optimize: "Optimize",
  "convert-to-pdf": "To PDF",
  "convert-from-pdf": "From PDF",
  edit: "Edit",
  security: "Security",
  intelligence: "AI",
  image: "Images",
};

export function Stats() {
  const slices = CATEGORIES.map((c) => ({
    label: SHORT[c.id] ?? c.label,
    value: TOOLS.filter((t) => t.category === c.id).length,
    color: CATEGORY_STYLE[c.id].color,
  }));

  return (
    <section id="numbers" className="section-rule scroll-mt-20">
      <div className="container-page py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="label-mono">// Measured, not marketed</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.03em] text-balance text-ink sm:text-[2.6rem] sm:leading-[1.08]">
            Numbers, not promises.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted sm:text-[17px]">
            Real timings from our own server and a real job tracked second by second. Hover or tap a chart to read the values.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <ChartCard
            className="md:col-span-2"
            title="Live progress, page by page"
            meta="12-page scan · OCR"
            legend={[
              { color: "var(--chart-1)", label: "FileFlip" },
              { color: "var(--chart-4)", label: "A frozen progress bar", dashed: true },
            ]}
          >
            <AreaChart
              data={OCR_RUN}
              xKey="t"
              series={[
                { key: "before", label: "Frozen bar", color: "var(--chart-4)", curve: "step", dashed: true },
                { key: "live", label: "FileFlip", color: "var(--chart-1)" },
              ]}
              yDomain={[0, 100]}
              yTicks={[0, 25, 50, 75, 100]}
              xTicks={[0, 5, 10, 15, 20]}
              formatX={(v) => `${Math.round(v * 10) / 10}s`}
              formatY={(v) => `${Math.round(v)}%`}
              label="Progress of a 12-page OCR job over 21 seconds: FileFlip rises steadily from 0 to 100 percent, while a frozen bar stays at 0 until the very end."
            />
          </ChartCard>

          <ChartCard title="Tools by category" meta={`${TOOLS.length} tools`}>
            <DonutChart slices={slices} totalLabel="free tools" label={`${TOOLS.length} tools across ${slices.length} categories`} />
          </ChartCard>

          <ChartCard title="Your file's lifetime" meta="Auto-delete">
            <Gauge value={60} max={60} center="60 min" caption="then it's deleted for good" label="Files are kept for 60 minutes, then deleted automatically" />
            <p className="mt-4 text-center text-[13px] text-muted">Or straight away, with Delete now.</p>
          </ChartCard>

          <ChartCard
            className="md:col-span-2"
            title="Time to result"
            meta="Live server · one small file"
            legend={[
              { color: "var(--chart-1)", label: "Built-in engine" },
              { color: "var(--chart-2)", label: "Office suite", hatched: true },
            ]}
          >
            <BarChart bars={SPEEDS} max={8} format={(v) => `${v.toFixed(1)}s`} label="Seconds from upload to result per tool, from 0.4 seconds for Compress PDF to 7.5 seconds for one page of OCR" />
          </ChartCard>
        </div>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  meta,
  legend,
  className = "",
  children,
}: {
  title: string;
  meta: string;
  legend?: { color: string; label: string; dashed?: boolean; hatched?: boolean }[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={`panel m-0 flex min-w-0 flex-col p-5 sm:p-6 ${className}`}>
      <figcaption className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="label-mono">{meta}</p>
          <h3 className="mt-1 font-display text-[17px] font-bold tracking-tight text-ink">{title}</h3>
        </div>
        {legend && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-3.5 rounded-sm"
                  style={
                    l.hatched
                      ? { background: `repeating-linear-gradient(45deg, ${l.color} 0 2px, transparent 2px 4px)`, outline: `1px solid ${l.color}` }
                      : l.dashed
                        ? { background: `repeating-linear-gradient(90deg, ${l.color} 0 4px, transparent 4px 7px)`, height: 2 }
                        : { background: l.color }
                  }
                />
                {l.label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </figure>
  );
}
