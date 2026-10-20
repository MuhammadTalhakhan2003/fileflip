/**
 * The FileFlip mark: a page whose corner is flipping over to show its colourful
 * back, with the text lines forming an "F". One source for every place it is drawn.
 */

/** Bump when the logo changes so browsers drop their cached favicon and app icons. */
export const ICON_VERSION = "2";

export const LOGO_PATHS = {
  backSheet: { x: 7.6, y: 9.4, width: 17.4, height: 22.6, rx: 3.2, transform: "rotate(-13 16.3 20.7)" },
  page: "M15 7.2H27.8a2.6 2.6 0 0 1 2.6 2.6V23.4L21.6 32.8H15a2.6 2.6 0 0 1-2.6-2.6V9.8A2.6 2.6 0 0 1 15 7.2Z",
  flap: "M30.4 23.4Q25.6 23.6 23.7 26.1 21.9 28.6 21.6 32.8Z",
  letter: "M17.3 25.2V12.3H26M17.3 18.5H23.2",
} as const;

export const LOGO_COLORS = {
  bg: ["#4F46E5", "#7C4DFF", "#EC4899"],
  flap: ["#FF7A45", "#FFA552", "#FFD27A"],
  ink: ["#4F46E5", "#9B3FE6"],
} as const;

/** Standalone SVG for favicons, app icons and social cards. `square` drops the rounded corners (app icons get masked by the OS). */
export function logoSvg({ square = false } = {}): string {
  const r = square ? 0 : 11;
  const s = LOGO_PATHS.backSheet;
  const c = LOGO_COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="bg" x1="4" y1="2" x2="38" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="${c.bg[0]}"/><stop offset=".5" stop-color="${c.bg[1]}"/><stop offset="1" stop-color="${c.bg[2]}"/></linearGradient><linearGradient id="flap" x1="22" y1="33" x2="30" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="${c.flap[0]}"/><stop offset=".6" stop-color="${c.flap[1]}"/><stop offset="1" stop-color="${c.flap[2]}"/></linearGradient><linearGradient id="ink" x1="17" y1="12" x2="27" y2="26" gradientUnits="userSpaceOnUse"><stop stop-color="${c.ink[0]}"/><stop offset="1" stop-color="${c.ink[1]}"/></linearGradient><radialGradient id="shine" cx="9" cy="3" r="30" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><clipPath id="clip"><path d="${LOGO_PATHS.page}"/></clipPath></defs><rect width="40" height="40" rx="${r}" fill="url(#bg)"/><rect width="40" height="40" rx="${r}" fill="url(#shine)"/><rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx}" fill="#fff" fill-opacity=".3" transform="${s.transform}"/><path d="${LOGO_PATHS.page}" fill="#fff"/><path d="${LOGO_PATHS.flap}" fill="#1E1B4B" fill-opacity=".18" transform="translate(-1.2 -.3)" clip-path="url(#clip)"/><path d="${LOGO_PATHS.flap}" fill="url(#flap)"/><path d="${LOGO_PATHS.letter}" fill="none" stroke="url(#ink)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function logoDataUri(opts?: { square?: boolean }): string {
  return `data:image/svg+xml;base64,${Buffer.from(logoSvg(opts)).toString("base64")}`;
}
