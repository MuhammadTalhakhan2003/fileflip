"use client";

import clsx from "clsx";
import {
  BookOpen,
  Code2,
  Download,
  Grip,
  HelpCircle,
  Images,
  Info,
  LayoutGrid,
  MonitorDown,
  MonitorSmartphone,
  Share,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { API_URL } from "@/lib/api";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

declare global {
  interface Window {
    __installPrompt?: InstallPrompt | null;
  }
}

type Platform = "ios" | "android" | "desktop" | "unsupported";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua) || (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua))) return "unsupported";
  return "desktop";
}

/** The browser's "install this site as an app" prompt (Chrome, Edge, Android), plus a fallback guide. */
function useInstallPrompt() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  useEffect(() => {
    const sync = () => setPrompt(window.__installPrompt ?? null);
    const onInstalled = () => {
      window.__installPrompt = null;
      setPrompt(null);
      setInstalled(true);
    };
    sync();
    setPlatform(detectPlatform());
    window.addEventListener("install-available", sync);
    window.addEventListener("appinstalled", onInstalled);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    return () => {
      window.removeEventListener("install-available", sync);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const clear = () => {
    window.__installPrompt = null;
    setPrompt(null);
  };
  return { prompt, installed, platform, clear };
}

const INSTALL_STEPS: Record<Platform, ReactNode> = {
  ios: <>In Safari, tap <b>Share</b> <Share className="inline size-3.5 -translate-y-px" /> then <b>Add to Home Screen</b>.</>,
  android: <>Open the browser menu <b>⋮</b> and tap <b>Install app</b> (or <b>Add to Home screen</b>).</>,
  desktop: <>Click the <b>install icon</b> <MonitorDown className="inline size-3.5 -translate-y-px" /> at the right end of the address bar, or open the browser menu → <b>Apps</b> → <b>Install FileFlip</b>.</>,
  unsupported: <>This browser can&rsquo;t install web apps. Open FileFlip in <b>Chrome</b> or <b>Edge</b> on a computer, or Safari on iPhone.</>,
};

const PRODUCTS = [
  { href: "/#tools", icon: LayoutGrid, color: "#f04463", title: "PDF Tools", text: "Merge, split, compress, convert, edit" },
  { href: "/image-converter", icon: Images, color: "#f97316", title: "Image Tools", text: "JPG, PNG, WEBP, HEIC - convert & resize" },
  { href: "/ai-summarizer", icon: Sparkles, color: "#d946ef", title: "AI Tools", text: "Summarize and translate documents" },
];

const LINKS = [
  { href: "/about#features", icon: Star, label: "Features" },
  { href: "/privacy", icon: ShieldCheck, label: "Security" },
  { href: "/about", icon: Info, label: "About us" },
];

export function AppsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const install = useInstallPrompt();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const [showSteps, setShowSteps] = useState(false);

  async function installApp() {
    // no native prompt (iPhone, Firefox, or the browser already offered it) - show how instead
    if (!install.prompt) return setShowSteps(true);
    await install.prompt.prompt();
    await install.prompt.userChoice;
    install.clear();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More from FileFlip"
        aria-expanded={open}
        className={clsx(
          "grid size-10 place-items-center rounded-xl transition-colors",
          open ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
        )}
      >
        <Grip className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.25rem] z-50 animate-scale-in sm:absolute sm:inset-x-auto sm:top-[calc(100%+10px)] sm:right-0 sm:w-[min(92vw,820px)]">
          <div className="grid overflow-hidden rounded-3xl border border-line bg-elevated shadow-float md:grid-cols-[1.15fr_1.15fr_0.8fr]">
            {/* products */}
            <section className="p-6">
              <Heading>Our tools</Heading>
              <div className="mt-4 space-y-1">
                {PRODUCTS.map((p) => (
                  <Link key={p.title} href={p.href} className="group flex items-center gap-3.5 rounded-2xl p-2.5 transition-colors hover:bg-surface-2">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl tint-soft" style={{ "--c": p.color } as CSSProperties}>
                      <p.icon className="size-5 tint-text" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{p.title}</span>
                      <span className="block truncate text-[13px] text-muted">{p.text}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <a
                href={`${API_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center gap-3 rounded-2xl border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                <Code2 className="size-5 text-brand" />
                <span>
                  <span className="block text-sm font-semibold text-ink">Developer API</span>
                  <span className="block text-[13px] text-muted">Automate every tool over HTTP</span>
                </span>
              </a>
            </section>

            {/* app */}
            <section className="border-t border-line p-6 md:border-t-0 md:border-l">
              <Heading>Get the app</Heading>
              <div className="mt-4 overflow-hidden rounded-2xl bg-brand-gradient p-5 text-white">
                <MonitorSmartphone className="size-8 opacity-90" />
                <p className="mt-3 font-display text-lg font-bold">Install FileFlip</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/80">
                  Add it to your home screen or desktop. Opens instantly, works like a native app - still free.
                </p>
                {install.installed ? (
                  <p className="mt-4 inline-flex rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold">Installed ✓</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={installApp}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-lg transition hover:bg-white/90"
                    >
                      <Download className="size-4" /> Install app
                    </button>
                    {showSteps && !install.prompt && (
                      <p className="mt-3 animate-fade-in rounded-xl bg-black/15 p-3 text-[12.5px] leading-relaxed text-white/90">
                        {INSTALL_STEPS[install.platform]}
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* links */}
            <section className="flex flex-col border-t border-line p-6 md:border-t-0 md:border-l">
              <nav className="space-y-0.5">
                {LINKS.map((l) => (
                  <Link key={l.label} href={l.href} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
                    <l.icon className="size-[18px] text-muted" /> {l.label}
                  </Link>
                ))}
              </nav>
              <div className="my-4 h-px bg-line md:mt-auto" />
              <nav className="space-y-0.5">
                <Link href="/#faq" className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <HelpCircle className="size-[18px] text-muted" /> Help & FAQ
                </Link>
                <Link href="/terms" className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <BookOpen className="size-[18px] text-muted" /> Terms
                </Link>
              </nav>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-[11px] font-bold tracking-[0.08em] text-subtle uppercase">{children}</h2>;
}
