import {
  ArrowDownUp,
  Brain,
  Combine,
  Crop,
  Droplets,
  FileCode2,
  FileDown,
  FileImage,
  FileLock2,
  FileMinus2,
  FileOutput,
  FilePen,
  FileScan,
  FileSearch2,
  FileSpreadsheet,
  FileText,
  FileType2,
  GitCompareArrows,
  Hash,
  ImageDown,
  ImagePlus,
  Images,
  Languages,
  LayoutGrid,
  LockOpen,
  Minimize2,
  PenLine,
  Presentation,
  RotateCw,
  Scaling,
  ScanText,
  Scissors,
  ShieldCheck,
  Signature,
  Sparkles,
  SquareDashedMousePointer,
  Stamp,
  TextCursorInput,
  WandSparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { CategoryId, Tool } from "@/lib/tools";

export interface CategoryStyle {
  color: string;
  icon: LucideIcon;
  tagline: string;
}

/** One hue per category - used for icon tiles, page headers and buttons. */
export const CATEGORY_STYLE: Record<CategoryId, CategoryStyle> = {
  organize: { color: "#f04463", icon: LayoutGrid, tagline: "Merge, split and rearrange pages" },
  optimize: { color: "#22a45d", icon: WandSparkles, tagline: "Smaller, repaired, searchable files" },
  "convert-to-pdf": { color: "#f59e0b", icon: FileDown, tagline: "Turn any document into a PDF" },
  "convert-from-pdf": { color: "#2f7cf6", icon: FileOutput, tagline: "Get editable files out of PDFs" },
  edit: { color: "#8b5cf6", icon: FilePen, tagline: "Add text, numbers, stamps and more" },
  security: { color: "#0e9fb8", icon: ShieldCheck, tagline: "Protect, sign and redact safely" },
  intelligence: { color: "#d946ef", icon: Sparkles, tagline: "AI that reads your documents" },
  image: { color: "#f97316", icon: Images, tagline: "Convert, resize and compress images" },
};

/** Brand colors of common file formats (used on the little format chips). */
export const FORMAT_COLORS: Record<string, string> = {
  pdf: "#e5322d",
  docx: "#2b5fb4",
  word: "#2b5fb4",
  xlsx: "#1d7a46",
  excel: "#1d7a46",
  pptx: "#d24726",
  powerpoint: "#d24726",
  jpg: "#f2a20c",
  png: "#0ea5e9",
  webp: "#10b981",
  gif: "#8b5cf6",
  bmp: "#64748b",
  tiff: "#64748b",
  ico: "#6366f1",
  heic: "#ec4899",
  svg: "#f97316",
  ppm: "#64748b",
  html: "#e34f26",
  txt: "#64748b",
  md: "#334155",
  zip: "#7c6a46",
  image: "#f97316",
};

const ICONS: Record<string, LucideIcon> = {
  "merge-pdf": Combine,
  "split-pdf": Scissors,
  "remove-pages": FileMinus2,
  "extract-pages": FileOutput,
  "organize-pdf": LayoutGrid,
  "scan-to-pdf": FileScan,
  "compress-pdf": Minimize2,
  "repair-pdf": Wrench,
  "ocr-pdf": ScanText,
  "jpg-to-pdf": FileImage,
  "word-to-pdf": FileText,
  "powerpoint-to-pdf": Presentation,
  "excel-to-pdf": FileSpreadsheet,
  "html-to-pdf": FileCode2,
  "pdf-to-word": FileText,
  "pdf-to-jpg": FileImage,
  "pdf-to-png": FileImage,
  "pdf-to-powerpoint": Presentation,
  "pdf-to-excel": FileSpreadsheet,
  "pdf-to-text": FileType2,
  "pdf-to-pdfa": ShieldCheck,
  "rotate-pdf": RotateCw,
  "add-page-numbers": Hash,
  "add-watermark": Droplets,
  "crop-pdf": Crop,
  "edit-pdf": PenLine,
  "pdf-forms": TextCursorInput,
  "unlock-pdf": LockOpen,
  "protect-pdf": FileLock2,
  "sign-pdf": Signature,
  "redact-pdf": SquareDashedMousePointer,
  "compare-pdf": GitCompareArrows,
  "ai-summarizer": Brain,
  "translate-pdf": Languages,
  "pdf-to-markdown": FileSearch2,
  "image-converter": ArrowDownUp,
  "resize-image": Scaling,
  "compress-image": ImageDown,
};

export function toolIcon(tool: Tool): LucideIcon {
  return ICONS[tool.slug] ?? (tool.category === "image" ? ImagePlus : CATEGORY_STYLE[tool.category].icon);
}

export function toolColor(tool: Tool): string {
  return CATEGORY_STYLE[tool.category].color;
}

/** The format chip on a tool icon: what the tool produces. */
export function formatChip(tool: Tool): { label: string; color: string } | null {
  const m = tool.slug.match(/^([a-z]+)-to-([a-z]+)$/);
  if (m) {
    const target = m[2];
    const label = { word: "DOC", excel: "XLS", powerpoint: "PPT", pdfa: "PDF/A", text: "TXT", markdown: "MD" }[target] ?? target.toUpperCase();
    return { label, color: FORMAT_COLORS[target] ?? FORMAT_COLORS.pdf };
  }
  if (tool.category === "convert-to-pdf" || tool.slug === "scan-to-pdf") return { label: "PDF", color: FORMAT_COLORS.pdf };
  return null;
}

export const BADGES: Record<string, "Popular" | "AI" | "New"> = {
  "merge-pdf": "Popular",
  "compress-pdf": "Popular",
  "pdf-to-word": "Popular",
  "jpg-to-pdf": "Popular",
  "ai-summarizer": "AI",
  "translate-pdf": "AI",
  "pdf-to-markdown": "New",
  "compare-pdf": "New",
  "heic-to-jpg": "Popular",
};

/** Image pairs are many - only these appear on the home grid (all are searchable). */
export const FEATURED_IMAGE_TOOLS = [
  "image-converter",
  "jpg-to-png",
  "png-to-jpg",
  "heic-to-jpg",
  "svg-to-png",
  "webp-to-jpg",
  "jpg-to-webp",
  "png-to-webp",
  "png-to-ico",
  "resize-image",
  "compress-image",
];

export const POPULAR = ["merge-pdf", "compress-pdf", "pdf-to-word", "jpg-to-pdf", "split-pdf", "jpg-to-png", "sign-pdf", "word-to-pdf"];

/** Good next steps after a tool finishes ("Continue with..."). */
export function nextSteps(tool: Tool): string[] {
  const output = tool.output;
  if (output === "pdf") {
    const base = ["compress-pdf", "merge-pdf", "protect-pdf", "sign-pdf", "add-page-numbers", "pdf-to-word"];
    return base.filter((s) => s !== tool.slug).slice(0, 4);
  }
  if (["jpg", "png", "webp", "image", "ico", "gif"].includes(output)) {
    return ["compress-image", "resize-image", "jpg-to-pdf", "image-converter"].filter((s) => s !== tool.slug).slice(0, 3);
  }
  return [];
}

export function actionLabel(tool: Tool): string {
  const custom: Record<string, string> = {
    "image-converter": "Convert images",
    "resize-image": "Resize images",
    "compress-image": "Compress images",
    "ai-summarizer": "Summarize",
    "translate-pdf": "Translate PDF",
    "pdf-forms": "Fill form",
    "edit-pdf": "Save changes",
    "sign-pdf": "Sign PDF",
    "compare-pdf": "Compare",
  };
  if (custom[tool.slug]) return custom[tool.slug];
  if (/-to-/.test(tool.slug)) return "Convert";
  return tool.name;
}

/** SEO copy generated per tool. */
export function seoFor(tool: Tool) {
  const free = "Free online, no sign-up, files deleted automatically.";
  return {
    title: `${tool.name} - ${tool.description.replace(/\.$/, "")}`,
    description: `${tool.description} ${free}`,
    keywords: [
      tool.name.toLowerCase(),
      `${tool.name.toLowerCase()} online`,
      `${tool.name.toLowerCase()} free`,
      ...tool.aliases.map((a) => a.replace(/-/g, " ")),
      "no sign up",
      "free converter",
    ],
  };
}

export function howToSteps(tool: Tool): { title: string; text: string }[] {
  const what = tool.accepts.includes("pdf") ? (tool.max_files > 1 ? "your PDF files" : "your PDF") : "your files";
  return [
    { title: `Upload ${what}`, text: "Drag and drop, browse your device, or paste from the clipboard. Nothing to install." },
    { title: "Adjust if you like", text: "Sensible defaults are already chosen. Change pages, quality or layout in one click." },
    { title: "Download instantly", text: `Get your ${tool.output.toUpperCase()} in seconds. Files are deleted from our servers automatically.` },
  ];
}
