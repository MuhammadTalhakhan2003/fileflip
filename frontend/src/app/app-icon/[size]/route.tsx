import { ImageResponse } from "next/og";

import { logoDataUri } from "@/lib/brand";

const SIZES = ["180", "192", "512"];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

/** PNG app icons for the install prompt and the iOS home screen. */
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = SIZES.includes(size) ? Number(size) : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri({ square: true })} width={px} height={px} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}
