import type { Metadata } from "next";

import { Features, HowItWorks, PrivacyBand, CTA } from "@/components/home/Sections";
import { PageHeader } from "@/components/layout/Prose";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "About",
  description: "FileFlip is a free collection of PDF and image tools for everyone - no sign-up, no watermarks, no limits.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About FileFlip"
        title={<>File tools should be <span className="text-gradient">free for everyone</span></>}
        text={`Students, shop owners, teachers, office workers - everyone needs to merge a PDF or convert a photo now and then. FileFlip puts ${TOOLS.length} of those tools in one place, with no account and no paywall.`}
      />
      <Features />
      <HowItWorks />
      <PrivacyBand />
      <CTA />
    </>
  );
}
