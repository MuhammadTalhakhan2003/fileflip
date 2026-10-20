"use client";

import { ArrowRight, Lock, MousePointer2, Search, Sparkles, Timer, UserX, Zap } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { BrandBlob } from "@/components/effects/BrandBlob";
import { Kbd } from "@/components/ui";
import { FORMAT_COLORS } from "@/lib/toolMeta";
import { TOOLS } from "@/lib/tools";

const CHIPS = [
  { href: "/merge-pdf", label: "Merge PDF" },
  { href: "/compress-pdf", label: "Compress PDF" },
  { href: "/pdf-to-word", label: "PDF to Word" },
  { href: "/jpg-to-png", label: "JPG to PNG" },
  { href: "/heic-to-jpg", label: "HEIC to JPG" },
  { href: "/sign-pdf", label: "Sign PDF" },
];

/** File cards that float around the sphere. Positions are % of the blob stage. */
const ORBIT = [
  { label: "PDF", color: FORMAT_COLORS.pdf, x: 8, y: 22, r: -12, delay: "0s" },
  { label: "DOC", color: FORMAT_COLORS.docx, x: 84, y: 14, r: 10, delay: "1.2s" },
  { label: "JPG", color: FORMAT_COLORS.jpg, x: 4, y: 70, r: 8, delay: "2.1s" },
  { label: "XLS", color: FORMAT_COLORS.xlsx, x: 88, y: 66, r: -8, delay: "0.6s" },
  { label: "PNG", color: FORMAT_COLORS.png, x: 30, y: 2, r: 4, delay: "1.8s" },
  { label: "PPT", color: FORMAT_COLORS.pptx, x: 66, y: 88, r: -5, delay: "2.6s" },
];

function FileCard({ label, color }: { label: string; color: string }) {
  return (
    <div className="relative h-[68px] w-[54px] rounded-xl border border-line bg-surface/90 shadow-card backdrop-blur">
      <div className="absolute top-0 right-0 size-4 rounded-tr-xl rounded-bl-lg bg-surface-3" />
      <div className="mx-2.5 mt-6 space-y-1.5">
        <div className="h-1 rounded bg-surface-3" />
        <div className="h-1 w-3/4 rounded bg-surface-3" />
      </div>
      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow" style={{ background: color }}>
        {label}
      </span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* backdrop */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-grid [mask-image:radial-gradient(ellipse_80%_70%_at_60%_35%,#000_30%,transparent_100%)]" />
      <div aria-hidden className="absolute -top-24 -left-40 -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(81,69,240,0.16),transparent)] blur-2xl" />
      <div aria-hidden className="absolute top-32 -right-40 -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(233,72,143,0.14),transparent)] blur-2xl" />

      <div className="container-page grid grid-cols-1 items-center gap-6 pt-12 pb-16 sm:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-4 lg:pt-14 lg:pb-20">
        {/* copy */}
        <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
          <Link
            href="/ai-summarizer"
            className="group mb-7 inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pr-3 pl-1 text-[13px] font-medium text-ink-2 shadow-soft backdrop-blur transition hover:border-line-strong"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
              <Sparkles className="size-3" /> NEW
            </span>
            AI Summarizer & PDF Translator
            <ArrowRight className="size-3.5 text-subtle transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="animate-fade-up font-display text-[2.6rem] leading-[1.04] font-extrabold tracking-[-0.035em] text-ink [animation-delay:80ms] sm:text-6xl xl:text-[4.4rem]">
            Every tool you need for <span className="text-gradient">PDFs & images</span>
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-[17px] leading-relaxed text-muted [animation-delay:160ms] sm:text-lg">
            Merge, split, compress, convert, edit and sign - {TOOLS.length} tools that just work.{" "}
            <span className="font-semibold text-ink-2">100% free, no sign-up</span>, and your files are deleted automatically.
          </p>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="group mt-9 flex h-[60px] w-full max-w-xl animate-fade-up items-center gap-3 rounded-2xl border border-line bg-surface pr-3 pl-5 text-left shadow-float transition-all [animation-delay:240ms] hover:border-brand/40 hover:shadow-[0_24px_60px_-20px_rgba(81,69,240,0.35)]"
          >
            <Search className="size-5 text-brand" />
            <span className="flex-1 truncate text-[15px] text-subtle">What do you want to do? Try &ldquo;pdf to word&rdquo;</span>
            <span className="hidden sm:inline-flex"><Kbd>Ctrl K</Kbd></span>
          </button>

          <div className="mt-5 flex max-w-xl animate-fade-up flex-wrap items-center justify-center gap-2 [animation-delay:320ms] lg:justify-start">
            <span className="mr-1 text-[13px] text-subtle">Popular:</span>
            {CHIPS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-2 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand hover:shadow-soft"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        {/* interactive sphere - the stage itself is the hover area */}
        <div aria-hidden className="relative mx-auto hidden aspect-square w-full max-w-[560px] animate-fade-in [animation-delay:200ms] lg:block">
          <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(closest-side,rgba(123,77,255,0.22),transparent)] blur-2xl" />
          <BrandBlob />
          {ORBIT.map((f) => (
            <div key={f.label} className="pointer-events-none absolute" style={{ left: `${f.x}%`, top: `${f.y}%` } as CSSProperties}>
              <div className="animate-float" style={{ animationDelay: f.delay, rotate: `${f.r}deg` }}>
                <FileCard label={f.label} color={f.color} />
              </div>
            </div>
          ))}
          <span className="pointer-events-none absolute bottom-[6%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
            <MousePointer2 className="size-3.5" /> Move your mouse here
          </span>
        </div>
      </div>

      <div className="container-page pb-14">
        <ul className="mx-auto grid max-w-4xl animate-fade-up grid-cols-2 gap-3 text-left [animation-delay:400ms] sm:grid-cols-4">
          {[
            { icon: UserX, title: "No sign-up", text: "Open and use" },
            { icon: Zap, title: "Fast", text: "Done in seconds" },
            { icon: Lock, title: "Private", text: "Encrypted transfer" },
            { icon: Timer, title: "Auto-delete", text: "Gone after 1 hour" },
          ].map((f) => (
            <li key={f.title} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-3 backdrop-blur">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <f.icon className="size-[18px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{f.title}</span>
                <span className="block text-xs text-muted">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
