export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function hexFromRgb(value: unknown, fallback = "#000000"): string {
  if (Array.isArray(value) && value.length === 3) {
    return (
      "#" +
      value
        .map((v) => Math.round(Math.max(0, Math.min(1, Number(v))) * 255).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  return typeof value === "string" && value.startsWith("#") ? value : fallback;
}

/** "1-3,5" -> Set{1,2,3,5} (1-based). Invalid parts are ignored. */
export function parsePages(spec: string, pageCount: number): Set<number> {
  const out = new Set<number>();
  const s = spec.trim().toLowerCase();
  if (!s || s === "all") return out;
  for (const part of s.split(",")) {
    const p = part.trim();
    const m = p.match(/^(\d*)\s*-\s*(\d*)$/);
    if (m) {
      const a = m[1] ? Number(m[1]) : 1;
      const b = m[2] ? Number(m[2]) : pageCount;
      for (let i = Math.max(1, a); i <= Math.min(b, pageCount); i++) out.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = Number(p);
      if (n >= 1 && n <= pageCount) out.add(n);
    }
  }
  return out;
}

/** Set{1,2,3,5} -> "1-3,5" */
export function formatPages(pages: Iterable<number>): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(",");
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
