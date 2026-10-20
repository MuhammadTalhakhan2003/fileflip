import catalog from "@/data/tools.json";

export type OptionType = "str" | "int" | "float" | "bool" | "choice" | "json" | "color";

export interface ToolOption {
  name: string;
  type: OptionType;
  label: string;
  default: unknown;
  required: boolean;
  help?: string;
  choices?: string[];
  min?: number;
  max?: number;
  secret?: boolean;
}

export interface ExtraInput {
  name: string;
  label: string;
  accepts: string[];
  required: boolean;
  multiple: boolean;
}

export interface Tool {
  slug: string;
  name: string;
  category: CategoryId;
  description: string;
  accepts: string[];
  output: string;
  min_files: number;
  max_files: number;
  options: ToolOption[];
  extra_inputs: ExtraInput[];
  requires: string[];
  aliases: string[];
}

export type CategoryId =
  | "organize"
  | "optimize"
  | "convert-to-pdf"
  | "convert-from-pdf"
  | "edit"
  | "security"
  | "intelligence"
  | "image";

export interface Category {
  id: CategoryId;
  label: string;
}

export const CATEGORIES = catalog.categories as Category[];
export const TOOLS = catalog.tools as Tool[];

const BY_SLUG = new Map<string, Tool>();
for (const t of TOOLS) {
  BY_SLUG.set(t.slug, t);
  for (const a of t.aliases) BY_SLUG.set(a, t);
}

export function getTool(slug: string): Tool | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export function toolsIn(category: CategoryId): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function acceptsPdf(tool: Tool): boolean {
  return tool.accepts.includes("pdf");
}

export function isImageTool(tool: Tool): boolean {
  return !acceptsPdf(tool) && tool.accepts.some((a) => ["jpg", "png", "webp"].includes(a));
}

/** Value for the <input accept> attribute. */
export function acceptAttr(exts: string[]): string {
  return exts.map((e) => `.${e}`).join(",");
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Short human list of accepted formats: "PDF", "JPG, PNG, WEBP +6". */
export function formatList(exts: string[], max = 4): string {
  const seen: string[] = [];
  for (const e of exts) {
    const label = e === "jpeg" ? "JPG" : e === "tif" ? "TIFF" : e === "htm" ? "HTML" : e.toUpperCase();
    if (!seen.includes(label)) seen.push(label);
  }
  return seen.length > max ? `${seen.slice(0, max).join(", ")} +${seen.length - max}` : seen.join(", ");
}

export function searchTools(query: string, pool: Tool[] = TOOLS): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  const words = q.split(/\s+/);
  return pool
    .map((t) => {
      const hay = `${t.name} ${t.slug.replace(/-/g, " ")} ${t.aliases.join(" ").replace(/-/g, " ")} ${t.description}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      const score = (t.name.toLowerCase().startsWith(q) ? 3 : 0) + (t.name.toLowerCase().includes(q) ? 2 : 0);
      return { t, score };
    })
    .filter((x): x is { t: Tool; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}
