import Link from "next/link";

import { LOGO_COLORS, LOGO_PATHS } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";

/** The FileFlip mark. On hover (inside a `group`) the back sheet fans out and the corner flips further. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  const c = LOGO_COLORS;
  const s = LOGO_PATHS.backSheet;
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="ff-bg" x1="4" y1="2" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor={c.bg[0]} />
          <stop offset="0.5" stopColor={c.bg[1]} />
          <stop offset="1" stopColor={c.bg[2]} />
        </linearGradient>
        <linearGradient id="ff-flap" x1="22" y1="33" x2="30" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor={c.flap[0]} />
          <stop offset="0.6" stopColor={c.flap[1]} />
          <stop offset="1" stopColor={c.flap[2]} />
        </linearGradient>
        <linearGradient id="ff-ink" x1="17" y1="12" x2="27" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor={c.ink[0]} />
          <stop offset="1" stopColor={c.ink[1]} />
        </linearGradient>
        <radialGradient id="ff-shine" cx="9" cy="3" r="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="ff-clip">
          <path d={LOGO_PATHS.page} />
        </clipPath>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#ff-bg)" />
      <rect width="40" height="40" rx="11" fill="url(#ff-shine)" />
      <g className="origin-[16px_32px] transition-transform duration-500 ease-out [transform-box:view-box] group-hover:-rotate-[9deg]">
        <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} fill="#fff" fillOpacity="0.3" transform={s.transform} />
      </g>
      <path d={LOGO_PATHS.page} fill="#fff" />
      <g className="origin-[30.4px_32.8px] transition-transform duration-500 ease-out [transform-box:view-box] group-hover:scale-[1.12]">
        <path d={LOGO_PATHS.flap} fill="#1E1B4B" fillOpacity="0.18" transform="translate(-1.2 -.3)" clipPath="url(#ff-clip)" />
        <path d={LOGO_PATHS.flap} fill="url(#ff-flap)" />
      </g>
      <path d={LOGO_PATHS.letter} fill="none" stroke="url(#ff-ink)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={`${SITE_NAME} home`}>
      <LogoMark className="size-9 drop-shadow-[0_6px_14px_rgba(124,77,255,0.35)] transition-transform duration-300 group-hover:-translate-y-0.5" />
      <span className="font-display text-[20px] font-extrabold tracking-[-0.03em] text-ink">
        File<span className="text-gradient">Flip</span>
      </span>
    </Link>
  );
}
