import type { Metadata } from "next";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/shared/WhatsAppCTA";
import VehicleCard from "@/components/catalog/VehicleCard";
import FilterBar from "@/components/catalog/FilterBar";
import { getCatalogPage, type VehicleFilters } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Catálogo",
  description: `Catálogo de autos usados certificados en ${SITE.address}.`,
  path: "/catalogo",
});

interface PageProps {
  searchParams: Promise<{
    brand?: string;
    category?: string;
    search?: string;
    priceMax?: string;
    yearMin?: string;
    yearMax?: string;
    sort?: string;
  }>;
}

function parseSort(sort?: string): VehicleFilters["sort"] {
  if (sort === "price-asc" || sort === "price-desc" || sort === "year-desc") {
    return sort;
  }
  return undefined;
}

export default async function CatalogoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { vehicles, brands, categories, years } = await getCatalogPage({
    brand: params.brand,
    category: params.category,
    search: params.search,
    priceMax: params.priceMax ? Number(params.priceMax) : undefined,
    yearMin: params.yearMin ? Number(params.yearMin) : undefined,
    yearMax: params.yearMax ? Number(params.yearMax) : undefined,
    sort: parseSort(params.sort),
  });

  return (
    <>
      <Header />
      <main className="flex-1 pt-[76px]">
        <section className="relative overflow-hidden border-b border-brand-border/60">
          <div className="pointer-events-none absolute right-[-40px] top-[-20px] select-none opacity-[0.07]">
            <Image
              src="/logo-salgado.png"
              alt=""
              width={320}
              height={240}
              className="object-contain"
            />
          </div>
          <div className="relative mx-auto max-w-[1280px] px-5 py-12 lg:px-8 md:py-14">
            <h1 className="mb-3 text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
              Catálogo
            </h1>
            <p className="text-base text-brand-muted md:text-lg">
              <span className="font-bold text-brand-accent">{vehicles.length}</span>{" "}
              vehículos publicados en{" "}
              <span className="font-semibold text-brand-accent">
                {SITE.address.split(",")[0]}
              </span>
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8">
          <FilterBar
            brands={brands}
            categories={categories}
            years={years}
            currentFilters={{
              brand: params.brand,
              category: params.category,
              search: params.search,
              priceMax: params.priceMax,
              yearMin: params.yearMin,
              yearMax: params.yearMax,
              sort: params.sort,
            }}
          />

          {vehicles.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
              {vehicles.map((veh, i) => (
                <VehicleCard key={veh.id} vehicle={veh} glow={i === 1} />
              ))}
            </div>
          ) : (
            <div className="card-premium mt-8 rounded-2xl py-20 text-center">
              <p className="mb-2 text-lg font-semibold text-white">
                No se encontraron vehículos
              </p>
              <a href="/catalogo" className="text-sm text-brand-accent hover:underline">
                Ver todos
              </a>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
