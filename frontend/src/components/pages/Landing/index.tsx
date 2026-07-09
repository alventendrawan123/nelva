import { Capabilities } from "./components/Capabilities";
import { ClosingCta } from "./components/ClosingCta";
import { CollateralSafety } from "./components/CollateralSafety";
import { HowItWorks } from "./components/HowItWorks";
import { LandingFaq } from "./components/LandingFaq";
import { LandingFooter } from "./components/LandingFooter";
import { LandingHero } from "./components/LandingHero";
import { Reveal } from "./components/Reveal";
import { StatsBanner } from "./components/StatsBanner";
import { TierLadder } from "./components/TierLadder";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-lp-bg font-body text-lp-text">
      <LandingHero />
      <Reveal>
        <StatsBanner />
      </Reveal>
      <Reveal>
        <Capabilities />
      </Reveal>
      <Reveal>
        <HowItWorks />
      </Reveal>
      <Reveal>
        <TierLadder />
      </Reveal>
      <Reveal>
        <CollateralSafety />
      </Reveal>
      <Reveal>
        <LandingFaq />
      </Reveal>
      <Reveal>
        <ClosingCta />
      </Reveal>
      <Reveal>
        <LandingFooter />
      </Reveal>
    </div>
  );
}
