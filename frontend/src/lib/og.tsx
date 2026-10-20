import { ImageResponse } from "next/og";

import { logoDataUri } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/** Social preview card (WhatsApp, X, Facebook, LinkedIn, Slack...). */
export function ogCard({ title, subtitle, color = "#5145f0", chip }: { title: string; subtitle: string; color?: string; chip?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#0b0f24",
          backgroundImage: `radial-gradient(circle at 85% 15%, ${color}55, transparent 55%), radial-gradient(circle at 10% 95%, #e9488f33, transparent 50%)`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDataUri()} width={64} height={64} alt="" />
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</span>
          {chip && (
            <span style={{ marginLeft: 12, padding: "6px 16px", borderRadius: 999, background: color, fontSize: 22, fontWeight: 700 }}>{chip}</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.72)", maxWidth: 950, lineHeight: 1.35 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "rgba(255,255,255,0.85)" }}>
          {["100% free", "No sign-up", "Files auto-deleted"].map((t) => (
            <span key={t} style={{ padding: "10px 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
