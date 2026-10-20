import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_20%,transparent_80%)]" />
      <div aria-hidden className="absolute -top-32 left-1/2 -z-10 h-80 w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(81,69,240,0.18),transparent)] blur-2xl" />
      <div className="container-page py-16 text-center sm:py-20">
        <p className="text-[13px] font-bold tracking-[0.12em] text-brand uppercase">{eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">{title}</h1>
        {text && <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">{text}</p>}
      </div>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="container-page">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-line bg-surface p-7 text-[15.5px] leading-[1.75] text-ink-2 sm:p-12 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2:first-child]:mt-0 [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-subtle">
        {children}
      </article>
    </div>
  );
}
