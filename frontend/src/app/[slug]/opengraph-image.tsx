import { OG_SIZE, ogCard } from "@/lib/og";
import { formatChip, toolColor } from "@/lib/toolMeta";
import { TOOLS, getTool } from "@/lib/tools";

export const alt = "Free online tool - no sign-up";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getTool((await params).slug) ?? TOOLS[0];
  return ogCard({ title: tool.name, subtitle: tool.description, color: toolColor(tool), chip: formatChip(tool)?.label });
}
