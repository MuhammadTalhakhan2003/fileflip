import { ArrowUpRight, Cookie, Heart, Lock, Timer, UserX } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/layout/Logo";
import { AUTHOR, SITE_NAME, SITE_SLOGAN } from "@/lib/site";
import { FEATURED_IMAGE_TOOLS } from "@/lib/toolMeta";
import { CATEGORIES, getTool, toolsIn, type CategoryId } from "@/lib/tools";

const COLUMNS: CategoryId[] = ["organize", "convert-to-pdf", "convert-from-pdf", "edit", "security", "image"];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-line bg-elevated">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_3fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 font-display text-lg font-bold text-ink">{SITE_SLOGAN}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Every PDF and image tool you need, in one place. Free for everyone - no accounts, no watermarks, no limits on
              how often you use it.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-2">
              <li className="flex items-center gap-2.5"><UserX className="size-4 text-brand" /> No sign-up, ever</li>
              <li className="flex items-center gap-2.5"><Lock className="size-4 text-brand" /> Encrypted HTTPS transfers</li>
              <li className="flex items-center gap-2.5"><Timer className="size-4 text-brand" /> Files auto-deleted in 1 hour</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {COLUMNS.map((id) => {
              const tools = id === "image" ? FEATURED_IMAGE_TOOLS.slice(0, 7).map((s) => getTool(s)!) : toolsIn(id).slice(0, 7);
              return (
                <div key={id}>
                  <h3 className="text-[11px] font-bold tracking-[0.08em] text-subtle uppercase">{CATEGORIES.find((c) => c.id === id)!.label}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {tools.map((t) => (
                      <li key={t.slug}>
                        <Link href={`/${t.slug}`} className="text-[13.5px] text-muted transition-colors hover:text-ink">
                          {t.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center gap-2 border-b border-line py-5 text-center text-[13px] text-muted">
          <p>
            <Cookie className="mr-1.5 inline size-4 -translate-y-px text-amber-500" />
            Designed &amp; built by{" "}
            <a
              href={AUTHOR.url}
              target="_blank"
              rel="noopener author"
              className="group/author inline-flex items-center gap-0.5 font-semibold text-ink underline decoration-brand/40 decoration-2 underline-offset-4 transition-colors hover:decoration-brand"
            >
              {AUTHOR.name}
              <ArrowUpRight className="size-3.5 transition-transform group-hover/author:-translate-y-0.5 group-hover/author:translate-x-0.5" />
            </a>
          </p>
          <p className="text-subtle italic">Powered by Cookies &amp; Brookies.</p>
        </div>
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-[13px] text-muted sm:flex-row">
          <p>© {year} {SITE_NAME}. Made with <Heart className="inline size-3.5 fill-coral text-coral" /> for everyone.</p>
          <nav className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/#faq" className="hover:text-ink">FAQ</Link>
            <Link href="/sitemap.xml" className="hover:text-ink">Sitemap</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
