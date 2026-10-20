"use client";

import clsx from "clsx";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { AppsMenu } from "@/components/layout/AppsMenu";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ToolIcon } from "@/components/tools/ToolIcon";
import { Kbd } from "@/components/ui";
import { CATEGORY_STYLE, FEATURED_IMAGE_TOOLS } from "@/lib/toolMeta";
import { CATEGORIES, getTool, toolsIn, type CategoryId, type Tool } from "@/lib/tools";

function menuTools(id: CategoryId): Tool[] {
  if (id === "image") return FEATURED_IMAGE_TOOLS.map((s) => getTool(s)!).filter(Boolean);
  return toolsIn(id);
}

const QUICK_LINKS = [
  { href: "/merge-pdf", label: "Merge PDF" },
  { href: "/split-pdf", label: "Split PDF" },
  { href: "/compress-pdf", label: "Compress PDF" },
];

type MenuId = "convert" | "all" | null;

export function Navbar() {
  const pathname = usePathname();
  const [menu, setMenu] = useState<MenuId>(null);
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setMenu(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === "Escape") setMenu(null);
    };
    const onOpen = () => setPalette(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  const hover = (id: MenuId) => ({
    onMouseEnter: () => {
      clearTimeout(closeTimer.current);
      setMenu(id);
    },
    onMouseLeave: () => {
      closeTimer.current = setTimeout(() => setMenu(null), 160);
    },
  });

  return (
    <>
      <header
        className={clsx(
          "sticky top-0 z-50 transition-all duration-300",
          scrolled || menu ? "border-b border-line bg-elevated/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
        )}
      >
        <nav className="container-page flex h-16 items-center gap-6">
          <Logo />

          <div className="hidden items-center gap-1 lg:flex">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors",
                  pathname === l.href ? "text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            ))}
            {(["convert", "all"] as const).map((id) => (
              <div key={id} {...hover(id)}>
                <button
                  type="button"
                  aria-expanded={menu === id}
                  onClick={() => setMenu(menu === id ? null : id)}
                  className={clsx(
                    "flex items-center gap-1 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors",
                    menu === id ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {id === "convert" ? "Convert PDF" : "All tools"}
                  <ChevronDown className={clsx("size-4 transition-transform duration-200", menu === id && "rotate-180")} />
                </button>
              </div>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="hidden h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-subtle shadow-soft transition-colors hover:border-line-strong hover:text-muted md:flex"
            >
              <Search className="size-4" />
              <span className="pr-6">Search tools</span>
              <Kbd>Ctrl K</Kbd>
            </button>
            <button
              type="button"
              onClick={() => setPalette(true)}
              aria-label="Search tools"
              className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink md:hidden"
            >
              <Search className="size-[18px]" />
            </button>
            <ThemeToggle />
            <AppsMenu />
            <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 xl:flex dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Free · No sign-up
            </span>
            <button
              type="button"
              onClick={() => setMobile((m) => !m)}
              aria-label="Menu"
              aria-expanded={mobile}
              className="grid size-10 place-items-center rounded-xl text-ink hover:bg-surface-2 lg:hidden"
            >
              {mobile ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>

        {/* desktop dropdowns */}
        {menu && (
          <div className="absolute inset-x-0 top-full hidden lg:block" {...hover(menu)}>
            <div className="container-page">
              <div className="scrollbar-thin mt-2 max-h-[calc(100dvh-5.5rem)] animate-scale-in overflow-y-auto rounded-3xl border border-line bg-elevated p-8 shadow-float">
                {menu === "convert" ? <ConvertMenu /> : <AllToolsMenu />}
              </div>
            </div>
          </div>
        )}

        {/* mobile drawer */}
        {mobile && (
          <div className="scrollbar-thin max-h-[calc(100dvh-4rem)] animate-fade-in overflow-y-auto border-t border-line bg-elevated lg:hidden">
            <div className="container-page space-y-6 py-6">
              {CATEGORIES.map((c) => (
                <div key={c.id}>
                  <CategoryHeading id={c.id} label={c.label} />
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {menuTools(c.id).map((t) => (
                      <Link key={t.slug} href={`/${t.slug}`} className="truncate rounded-lg px-2 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2">
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </>
  );
}

function CategoryHeading({ id, label }: { id: CategoryId; label: string }) {
  const style = CATEGORY_STYLE[id];
  const Icon = style.icon;
  return (
    <div className="flex items-center gap-2" style={{ "--c": style.color } as CSSProperties}>
      <span className="grid size-6 place-items-center rounded-md tint-soft">
        <Icon className="size-3.5 tint-text" />
      </span>
      <span className="text-[11px] font-bold tracking-[0.08em] text-subtle uppercase">{label}</span>
    </div>
  );
}

function MenuLink({ tool }: { tool: Tool }) {
  return (
    <Link href={`/${tool.slug}`} className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-2">
      <ToolIcon tool={tool} size="sm" className="scale-90" />
      <span className="truncate text-[13.5px] font-medium text-ink-2 group-hover:text-ink">{tool.name}</span>
    </Link>
  );
}

function AllToolsMenu() {
  return (
    <div className="grid grid-cols-4 gap-x-6 gap-y-8">
      {CATEGORIES.map((c) => (
        <div key={c.id}>
          <CategoryHeading id={c.id} label={c.label} />
          <div className="mt-3 space-y-0.5">
            {menuTools(c.id)
              .slice(0, 7)
              .map((t) => (
                <MenuLink key={t.slug} tool={t} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConvertMenu() {
  return (
    <div className="grid grid-cols-3 gap-8">
      {(["convert-to-pdf", "convert-from-pdf"] as const).map((id) => (
        <div key={id}>
          <CategoryHeading id={id} label={CATEGORIES.find((c) => c.id === id)!.label} />
          <div className="mt-3 space-y-0.5">
            {toolsIn(id).map((t) => (
              <MenuLink key={t.slug} tool={t} />
            ))}
          </div>
        </div>
      ))}
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white">
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-6 size-40 rounded-full bg-white/10" />
        <p className="relative text-xs font-bold tracking-widest text-white/70 uppercase">Images too</p>
        <p className="relative mt-2 font-display text-xl font-bold">JPG, PNG, WEBP, HEIC</p>
        <p className="relative mt-2 text-sm text-white/80">Convert any image format in one click - even iPhone photos.</p>
        <Link href="/image-converter" className="relative mt-5 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand shadow-lg hover:bg-white/90">
          Image converter →
        </Link>
      </div>
    </div>
  );
}
