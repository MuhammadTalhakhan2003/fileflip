import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "FileFlip - free PDF and image tools, no sign-up";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ title: "Every tool you need for PDFs & images", subtitle: "Merge, split, compress, convert, edit and sign - 60+ free tools that just work." });
}
