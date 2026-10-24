import { Hero } from "@/components/home/Hero";
import { CTA, FAQ, Features, HowItWorks, PrivacyBand } from "@/components/home/Sections";
import { Stats } from "@/components/home/Stats";
import { ToolExplorer } from "@/components/home/ToolExplorer";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ToolExplorer />
      <HowItWorks />
      <Stats />
      <Features />
      <PrivacyBand />
      <FAQ />
      <CTA />
    </>
  );
}
