import type { MetadataRoute } from "next";

import { ICON_VERSION } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - PDF & Image Tools`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#5145f0",
    categories: ["productivity", "utilities"],
    icons: [
      { src: `/app-icon/192?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/app-icon/512?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/app-icon/512?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Merge PDF", url: "/merge-pdf" },
      { name: "Compress PDF", url: "/compress-pdf" },
      { name: "PDF to Word", url: "/pdf-to-word" },
      { name: "JPG to PNG", url: "/jpg-to-png" },
    ],
  };
}
