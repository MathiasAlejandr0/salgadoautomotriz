"use client";

import { useSearchParams } from "next/navigation";
import VehicleCard from "@/components/catalog/VehicleCard";
import FilterBar from "@/components/catalog/FilterBar";
import { applyFilters, catalogFacets, parseSort } from "@/lib/filters";
import { useLiveVehicles } from "@/lib/live";
import type { VehicleWithImages } from "@/types/database";

function num(v: string | null): number | undefined {
  return v ? Number(v) : undefined;
}

export function CatalogCount({ initial }: { initial: VehicleWithImages[] }) {
  const params = useSearchParams();
  const all = useLiveVehicles(initial);
  const vehicles = applyFilters(all, filtersFrom(params));
  return <span className="font-bold text-brand-accent">{vehicles.length}</span>;
}

function filtersFrom(params: URLSearchParams) {
  return {
    brand: params.get("brand") || undefined,
    category: params.get("category") || undefined,
    search: params.get("search") || undefined,
    priceMax: num(params.get("priceMax")),
    yearMin: num(params.get("yearMin")),
    yearMax: num(params.get("yearMax")),
    sort: parseSort(params.get("sort")),
  };
}

export default function CatalogLive({ initial }: { initial: VehicleWithImages[] }) {
  const params = useSearchParams();
  const all = useLiveVehicles(initial);
  const vehicles = applyFilters(all, filtersFrom(params));
  const { brands, categories, years } = catalogFacets(all);

  return (
    <>
      <FilterBar
        brands={brands}
        categories={categories}
        years={years}
        currentFilters={{
          brand: params.get("brand") || undefined,
          category: params.get("category") || undefined,
          search: params.get("search") || undefined,
          priceMax: params.get("priceMax") || undefined,
          yearMin: params.get("yearMin") || undefined,
          yearMax: params.get("yearMax") || undefined,
          sort: params.get("sort") || undefined,
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
          <p className="mb-2 text-lg font-semibold text-white">No se encontraron vehículos</p>
          <a href="/catalogo" className="text-sm text-brand-accent hover:underline">
            Ver todos
          </a>
        </div>
      )}
    </>
  );
}