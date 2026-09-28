import HomeHero from "@/components/home/HomeHero";
import FeaturedStrip from "@/components/home/FeaturedStrip";
import HomeCatalog from "@/components/home/HomeCatalog";
import HomeProcess from "@/components/home/HomeProcess";
import ShowroomMap from "@/components/home/ShowroomMap";
import HomeTrust from "@/components/home/HomeTrust";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import { getFeaturedVehicles, getVehicles } from "@/lib/queries";
import { getSearchOptions } from "@/lib/search-options";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Salgado Automotriz – Tu próximo auto empieza aquí",
  description:
    "Vehículos verificados, financiamiento claro y entrega inmediata. Automotora certificada en Puerto Montt.",
  path: "/",
});

export default async function HomePage() {
  const [searchOptions, featured, catalog] = await Promise.all([
    getSearchOptions(),
    getFeaturedVehicles(3),
    getVehicles(),
  ]);

  return (
    <>
      <main className="min-w-0 flex-1 overflow-x-hidden bg-brand-bg">
        <div className="flex flex-col md:h-[100svh] md:overflow-hidden">
          <HomeHero options={searchOptions} />
          <FeaturedStrip vehicles={featured} />
        </div>

        <HomeCatalog
          vehicles={catalog.filter((v) => !featured.some((f) => f.id === v.id)).slice(0, 6)}
          total={catalog.length}
        />
        <HomeProcess />
        <ShowroomMap />
        <HomeTrust />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
