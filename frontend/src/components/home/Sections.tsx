import {
  ArrowRight,
  BadgeCheck,
  CloudUpload,
  Download,
  Fingerprint,
  Globe,
  Infinity as InfinityIcon,
  Layers,
  Lock,
  MonitorSmartphone,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trash2,
  UserX,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { TOOLS } from "@/lib/tools";

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="label-mono">// {eyebrow}</p>
      <h2 className="mt-3 font-display text-[1.85rem] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-ink sm:text-[2.6rem] sm:leading-[1.08]">{title}</h2>
      {text && <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted sm:text-[17px]">{text}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ how it works */

export function HowItWorks() {
  const steps = [
    { icon: CloudUpload, title: "Drop your file", text: "Drag it in, browse, or paste from the clipboard. PDFs, Office files and every common image format." },
    { icon: SlidersHorizontal, title: "Tweak if you want", text: "Smart defaults are already set. Pick pages, quality or layout with a click - or just hit go." },
    { icon: Download, title: "Download & done", text: "Your file is ready in seconds. Continue with another tool or delete it right away." },
  ];
  return (
    <section className="section-rule">
      <div className="container-page py-20 sm:py-24">
        <SectionTitle eyebrow="How it works" title="Three steps. Zero learning curve." text="Designed so anyone, from students to accountants, gets it right the first time." />
        <ol className="mt-10 grid gap-4 sm:mt-14 md:grid-cols-3 md:gap-5">
          {steps.map((s, i) => (
            <li key={s.title} className="panel flex gap-4 p-5 md:block md:p-7">
              <div className="relative grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 md:size-14">
                <s.icon className="size-6 text-brand md:size-7" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <p className="label-mono md:mt-6">Step {i + 1}</p>
                <h3 className="mt-1 font-display text-[17px] font-bold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted sm:text-[15px]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ features (bento) */

export function Features() {
  return (
    <section id="features" className="section-rule scroll-mt-20">
      <div className="container-page py-20 sm:py-24">
      <SectionTitle
        eyebrow="Why FileFlip"
        title={<>Professional results, <span className="text-gradient">without the price tag</span></>}
        text="Everything you'd expect from paid software, without the accounts, watermarks or daily limits."
      />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 md:grid-cols-6">
        <Bento className="col-span-2 md:col-span-4" icon={Layers} title={`${TOOLS.length} tools in one place`} color="#5145f0">
          Convert between PDF, Word, Excel, PowerPoint, HTML and every popular image format. Organize, compress, sign,
          redact, OCR, compare: one site instead of ten bookmarks.
          <div className="mt-5 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
            {["PDF", "DOCX", "XLSX", "PPTX", "JPG", "PNG", "WEBP", "HEIC", "SVG", "HTML", "TXT", "MD", "ICO", "TIFF"].map((f) => (
              <span key={f} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2 sm:px-2.5 sm:py-1 sm:text-xs">{f}</span>
            ))}
          </div>
        </Bento>
        <Bento className="md:col-span-2" icon={UserX} title="No account. Ever." color="#f04463">
          No email, no password, no &ldquo;sign up to download&rdquo;. Open a tool and use it.
        </Bento>
        <Bento className="md:col-span-2" icon={InfinityIcon} title="Free, unlimited" color="#22a45d">
          No watermarks on your files and no paywall after three uses.
        </Bento>
        <Bento className="md:col-span-2" icon={Zap} title="Seriously fast" color="#f59e0b">
          Files are processed on our servers in seconds, even from an old phone.
        </Bento>
        <Bento className="md:col-span-2" icon={MonitorSmartphone} title="Any device" color="#2f7cf6">
          Works in every modern browser on Windows, Mac, Linux, iPhone and Android.
        </Bento>
        <Bento className="col-span-2 md:col-span-3" icon={Sparkles} title="AI that reads for you" color="#d946ef">
          Summarize a 50-page report into key points, or translate a PDF into another language while keeping its layout.
        </Bento>
        <Bento className="col-span-2 md:col-span-3" icon={Globe} title="Made for every language" color="#0e9fb8">
          OCR for scanned documents, Unicode text in edits and signatures, and translation into dozens of languages.
        </Bento>
      </div>
      </div>
    </section>
  );
}

function Bento({
  icon: Icon,
  title,
  color,
  children,
  className,
}: {
  icon: typeof Zap;
  title: string;
  color: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-[20px] border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card sm:rounded-3xl sm:p-7 ${className}`}
      style={{ "--c": color } as React.CSSProperties}
    >
      <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100" style={{ background: "color-mix(in oklab, var(--c) 14%, transparent)" }} />
      <span className="relative grid size-10 place-items-center rounded-xl tint-soft sm:size-12 sm:rounded-2xl">
        <Icon className="size-5 tint-text sm:size-6" />
      </span>
      <h3 className="relative mt-3.5 font-display text-[15px] leading-snug font-bold text-ink sm:mt-5 sm:text-lg">{title}</h3>
      <div className="relative mt-1.5 text-[13px] leading-relaxed text-muted sm:mt-2 sm:text-[15px]">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ privacy band */

export function PrivacyBand() {
  const points = [
    { icon: Lock, title: "Encrypted in transit", text: "Uploads and downloads travel over HTTPS." },
    { icon: Timer, title: "Deleted automatically", text: "Inputs right after processing, results within an hour." },
    { icon: Trash2, title: "Delete on demand", text: "One click removes your file from our servers instantly." },
    { icon: Fingerprint, title: "Private links", text: "Each result has a random, unguessable address." },
  ];
  return (
    <section className="section-rule">
      <div className="container-page py-20 sm:py-24">
      <div className="relative overflow-hidden rounded-[28px] bg-[#0f0f13] px-5 py-12 text-white ring-1 ring-white/10 sm:rounded-[2rem] sm:px-12 lg:px-16 lg:py-20">
        <div aria-hidden className="absolute -top-32 -right-24 size-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(123,77,255,0.45),transparent)]" />
        <div aria-hidden className="absolute -bottom-40 -left-24 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(233,72,143,0.3),transparent)]" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 ring-1 ring-white/15">
              <ShieldCheck className="size-3.5" /> Privacy by design
            </span>
            <h2 className="mt-5 font-display text-[1.85rem] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
              Your files are yours.
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200 bg-clip-text text-transparent">We just borrow them for a minute.</span>
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
              We never read, share or keep your documents. No account means there&apos;s nothing tying a file to you.
            </p>
            <Link href="/privacy" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white hover:gap-3 transition-all">
              Read how we handle files <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {points.map((p) => (
              <div key={p.title} className="min-w-0 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 sm:p-5">
                <p.icon className="size-5 text-violet-300 sm:size-6" />
                <h3 className="mt-3 text-[14px] leading-snug font-semibold sm:mt-4 sm:text-base">{p.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/60 sm:mt-1.5 sm:text-sm">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */

export const FAQS = [
  { q: "Is FileFlip really free?", a: "Yes. Every tool is free to use as often as you like. There are no premium tiers, no watermarks and no download limits." },
  { q: "Do I need to create an account?", a: "No. There is no sign-up and no login. Open a tool, add your file and download the result." },
  { q: "Are my files safe?", a: "Files are sent over an encrypted HTTPS connection. Your uploads are deleted as soon as the conversion finishes and results are deleted automatically within one hour - or immediately when you click Delete." },
  { q: "What is the maximum file size?", a: "You can upload up to 100 MB per conversion, and PDFs with up to 1,000 pages." },
  { q: "Can I edit a PDF after converting it to Word?", a: "Yes. PDF to Word produces a regular .docx file that you can edit in Microsoft Word, Google Docs or LibreOffice. For scanned PDFs, run OCR PDF first so the text becomes editable." },
  { q: "Can I convert iPhone photos (HEIC)?", a: "Yes. Use HEIC to JPG or HEIC to PNG - or the Image Converter, which also handles WEBP, PNG, GIF, BMP, TIFF and ICO." },
  { q: "Does it work on my phone?", a: "Yes. FileFlip works in any modern mobile browser and you can install it to your home screen like an app." },
  { q: "Is my signature legally valid?", a: "Sign PDF places your handwritten, drawn or typed signature visually on the document - accepted for most everyday agreements. It is not a certificate-based digital signature." },
];

export function FAQ() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <section id="faq" className="section-rule scroll-mt-20">
      <div className="container-page grid gap-10 py-20 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SectionTitle eyebrow="FAQ" title="Questions? Answered." text="Still stuck? Every tool page also has a short how-to." />
      <div className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
        {FAQS.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-ink transition-colors hover:bg-surface-2/60 sm:gap-6 sm:px-6 sm:py-5 sm:text-base [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition-transform duration-300 group-open:rotate-45">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
              </span>
            </summary>
            <p className="-mt-1 px-5 pb-5 text-[14.5px] leading-relaxed text-muted sm:px-6 sm:pb-6 sm:text-[15px]">{f.a}</p>
          </details>
        ))}
      </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ CTA */

export function CTA() {
  return (
    <section className="section-rule">
      <div className="container-page pt-16 sm:pt-20">
      <div className="relative overflow-hidden rounded-[28px] bg-brand-gradient px-5 py-12 text-center text-white sm:rounded-[2rem] sm:px-12 sm:py-16">
        <div aria-hidden className="absolute -top-24 -left-24 size-72 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -right-20 -bottom-28 size-80 rounded-full bg-white/10" />
        <BadgeCheck className="relative mx-auto size-10 text-white/90" />
        <h2 className="relative mx-auto mt-5 max-w-2xl font-display text-[2rem] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">
          Ready when you are.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-[17px] text-white/80">
          Pick a tool and get your file done in seconds. No account, no cost, no catch.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/#tools" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-brand shadow-xl transition hover:-translate-y-0.5">
            Explore all tools <ArrowRight className="size-4" />
          </Link>
          <Link href="/pdf-to-word" className="inline-flex h-12 items-center justify-center rounded-xl bg-white/15 px-6 font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20">
            Try PDF to Word
          </Link>
        </div>
      </div>
      </div>
    </section>
  );
}
