"use client";

import { useEffect, useState } from "react";

import VoiceBlob from "@/components/effects/VoiceBlob";
import { useIsDark } from "@/components/effects/useTheme";

/**
 * VoiceBlob in brand colors, matched to the current theme. Render it as a direct
 * child of the element that should react to the mouse (that element is the hover area).
 */
export function BrandBlob({
  className,
  size = "hero",
  color,
}: {
  className?: string;
  size?: "hero" | "small";
  /** Optional accent (e.g. a tool's category color) instead of the brand violet. */
  color?: string;
}) {
  const dark = useIsDark();
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(window.matchMedia("(max-width: 767px)").matches), []);

  const hero = size === "hero";
  return (
    <VoiceBlob
      key={dark ? "d" : "l"}
      className={className}
      color={color ?? (dark ? "#7b72ff" : "#4a3de8")}
      fadeColor={dark ? "#080b17" : "#f6f7fb"}
      glowColor={dark ? "#f0abfc" : "#e9488f"}
      pointCount={hero ? (mobile ? 12000 : 24000) : 5200}
      pointSize={hero ? 7 : 4.6}
      amplitude={hero ? 0.22 : 0.3}
      opacity={hero ? (dark ? 0.72 : 0.8) : 0.9}
    />
  );
}
