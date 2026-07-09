import { FaqSection } from "@/components/shared/FaqSection";
import { ExploreHero } from "./components/ExploreHero";
import { FeaturedMarkets } from "./components/FeaturedMarkets";
import { MarketsTable } from "./components/MarketsTable";

export function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <ExploreHero />
      <FeaturedMarkets />
      <MarketsTable />
      <FaqSection />
    </div>
  );
}
