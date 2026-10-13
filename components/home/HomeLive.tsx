"use client";

import HomeHero from "@/components/home/HomeHero";
import FeaturedStrip from "@/components/home/FeaturedStrip";
import HomeCatalog from "@/components/home/HomeCatalog";
import { buildSearchOptions } from "@/lib/search-options";
import { useLiveVehicles } from "@/lib/live";
import type { VehicleWithImages } from "@/types/database";

export function HomeTop({ initial }: { initial: VehicleWithImages[] }) {
  const catalog = useLiveVehicles(initial);
  const featured = catalog.filter((v) => v.featured && v.published).slice(0, 3);
  return (
    <>
      <div className="flex flex-col md:h-[100svh] md:overflow-hidden">
        <HomeHero options={buildSearchOptions(catalog)} />
        <FeaturedStrip vehicles={featured} />
      </div>
      <HomeCatalog
        vehicles={catalog.filter((v) => !featured.some((f) => f.id === v.id)).slice(0, 6)}
        total={catalog.length}
      />
    </>
  );
}