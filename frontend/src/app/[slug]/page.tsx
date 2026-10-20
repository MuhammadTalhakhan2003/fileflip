import { Check, ChevronRight, Lock, Timer, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { CSSProperties } from "react";

import { ToolCard } from "@/components/tools/ToolCard";
import { ToolIcon } from "@/components/tools/ToolIcon";
import { Badge } from "@/components/ui";
import { ToolWorkspace } from "@/components/workspace/ToolWorkspace";
import { SITE_URL } from "@/lib/site";
import { BADGES, CATEGORY_STYLE, howToSteps, seoFor, toolColor } from "@/lib/toolMeta";
import { CATEGORIES, TOOLS, formatList, getTool } from "@/lib/tools";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const tool = getTool((await params).slug);
  if (!tool) return {};
  const seo = seoFor(tool);
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: `/${tool.slug}` },
    openGraph: { title: `${tool.name} - free, no sign-up`, description: seo.description, url: `${SITE_URL}/${tool.slug}` },
    twitter: { card: "summary_large_image", title: `${tool.name} - free, no sign-up`, description: seo.description },
  };
}

export default async function ToolPage({ params }: { params: Params }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  if (tool.slug !== slug) permanentRedirect(`/${tool.slug}`);

  const color = toolColor(tool);
  const category = CATEGORIES.find((c) => c.id === tool.category)!;
  const steps = howToSteps(tool);
  const related = TOOLS.filter((t) => t.category === tool.category && t.slug !== tool.slug).slice(0, 4);
  const badge = BADGES[tool.slug];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to use ${tool.name}`,
      description: tool.description,
      step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.text })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: tool.name, item: `${SITE_URL}/${tool.slug}` },
      ],
    },
  ];

  return (
    <div style={{ "--c": color } as CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* header */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[420px]" style={{ background: "radial-gradient(70% 100% at 50% 0%, color-mix(in oklab, var(--c) 16%, transparent), transparent 70%)" }} />
        <div aria-hidden className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_20%,transparent_80%)]" />
        <div className="container-page pt-8 pb-10 text-center sm:pt-10">
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center justify-center gap-1.5 text-[13px] text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="size-3.5 text-subtle" />
            <Link href={`/#tools`} className="hover:text-ink">{category.label}</Link>
            <ChevronRight className="size-3.5 text-subtle" />
            <span className="font-medium text-ink-2">{tool.name}</span>
          </nav>
          <div className="mx-auto w-fit animate-pop"><ToolIcon tool={tool} size="lg" /></div>
          <h1 className="mt-6 animate-fade-up font-display text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">
            {tool.name}
            {badge && <span className="ml-3 inline-block -translate-y-2 align-middle"><Badge tone={badge === "AI" ? "ai" : badge === "New" ? "new" : "brand"}>{badge}</Badge></span>}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl animate-fade-up text-lg text-muted [animation-delay:80ms]">{tool.description}</p>
          <ul className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink-2 [animation-delay:160ms]">
            <li className="flex items-center gap-1.5"><UserX className="size-4 tint-text" /> No sign-up</li>
            <li className="flex items-center gap-1.5"><Check className="size-4 tint-text" /> 100% free</li>
            <li className="flex items-center gap-1.5"><Lock className="size-4 tint-text" /> Encrypted</li>
            <li className="flex items-center gap-1.5"><Timer className="size-4 tint-text" /> Auto-deleted in 1 hour</li>
          </ul>
        </div>
      </section>

      <section className="container-page">
        <ToolWorkspace slug={tool.slug} />
      </section>

      {/* how to */}
      <section className="container-page mt-24">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-line bg-surface p-8 sm:p-12">
          <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">How to use {tool.name}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="grid size-11 place-items-center rounded-2xl tint-bg font-display text-lg font-bold text-white shadow-[0_10px_24px_-10px_var(--c)]">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap justify-center gap-2 border-t border-line pt-8 text-[13px] text-muted">
            <span className="rounded-full bg-surface-2 px-3 py-1">Accepts: <b className="text-ink-2">{formatList(tool.accepts, 8)}</b></span>
            <span className="rounded-full bg-surface-2 px-3 py-1">Output: <b className="text-ink-2">{tool.output.toUpperCase()}</b></span>
            <span className="rounded-full bg-surface-2 px-3 py-1">Up to <b className="text-ink-2">100 MB</b></span>
            {tool.max_files > 1 && <span className="rounded-full bg-surface-2 px-3 py-1">Up to <b className="text-ink-2">{Math.min(tool.max_files, 20)} files</b> at once</span>}
          </div>
        </div>
      </section>

      {/* related */}
      {related.length > 0 && (
        <section className="container-page mt-20">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-[13px] font-bold tracking-[0.12em] uppercase tint-text">{category.label}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">More tools like this</h2>
            </div>
            <Link href="/#tools" className="text-sm font-semibold text-muted hover:text-ink">All {TOOLS.length} tools →</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((t) => <ToolCard key={t.slug} tool={t} compact />)}
          </div>
          <p className="sr-only">{CATEGORY_STYLE[tool.category].tagline}</p>
        </section>
      )}
    </div>
  );
}
