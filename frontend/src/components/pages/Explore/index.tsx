import { ExploreHero } from "./components/ExploreHero";
import { FeaturedPools } from "./components/FeaturedPools";
import { PoolFilters } from "./components/PoolFilters";
import { PoolTable } from "./components/PoolTable";

export function ExplorePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <ExploreHero />
      <FeaturedPools />
      <PoolFilters />
      <PoolTable />
    </div>
  );
}
