import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ToolCard } from "@/components/tools/ToolCard";
import { POPULAR } from "@/lib/toolMeta";
import { getTool, type Tool } from "@/lib/tools";

export default function NotFound() {
  const popular = POPULAR.slice(0, 4).map((s) => getTool(s)).filter(Boolean) as Tool[];
  return (
    <div className="container-page py-20 text-center">
      <p className="font-display text-[7rem] leading-none font-extrabold tracking-tighter text-gradient">404</p>
      <h1 className="mt-4 font-display text-3xl font-extrabold text-ink">This page went missing</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">The link may be old or mistyped. Here are some tools people use most:</p>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
        {popular.map((t) => <ToolCard key={t.slug} tool={t} compact />)}
      </div>
      <Link href="/" className="mt-10 inline-flex items-center gap-2 font-semibold text-brand hover:gap-3 transition-all">
        <ArrowLeft className="size-4" /> Back to all tools
      </Link>
    </div>
  );
}
