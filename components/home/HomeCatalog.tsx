import Link from "next/link";
import VehicleCard from "@/components/catalog/VehicleCard";
import type { VehicleWithImages } from "@/types/database";

export default function HomeCatalog({
  vehicles,
  total,
}: {
  vehicles: VehicleWithImages[];
  total: number;
}) {
  return (
    <section id="catalogo" className="relative mx-auto max-w-[1200px] scroll-mt-24 px-5 pb-16 pt-12 sm:px-6 sm:pb-20 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#00BCFE]">
            Catálogo
          </p>
          <h2 className="mt-2 text-[1.45rem] font-black tracking-tight text-white sm:text-3xl">
            Vehículos del stock
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Unidades con ficha clara, fotos reales y precio publicado.
          </p>
        </div>
        <Link href="/catalogo" className="text-sm font-semibold text-[#00BCFE] hover:text-white">
          Ver catálogo completo →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {vehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} />
        ))}
      </div>

      <div className="mt-8 text-center sm:mt-10">
        <Link
          href="/catalogo"
          className="inline-flex min-h-12 w-full max-w-sm items-center justify-center rounded-full border border-[#00BCFE]/40 px-8 py-3 text-sm font-semibold text-white hover:bg-[#00BCFE]/10 sm:w-auto"
        >
          Ver todos los {total} vehículos →
        </Link>
      </div>
    </section>
  );
}
