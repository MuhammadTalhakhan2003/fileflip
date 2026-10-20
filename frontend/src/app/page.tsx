import { Hero } from "@/components/home/Hero";
import { CTA, FAQ, Features, HowItWorks, PrivacyBand } from "@/components/home/Sections";
import { ToolExplorer } from "@/components/home/ToolExplorer";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ToolExplorer />
      <HowItWorks />
      <Features />
      <PrivacyBand />
      <FAQ />
      <CTA />
    </>
  );
}
