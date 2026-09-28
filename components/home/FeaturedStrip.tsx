import Image from "next/image";
import Link from "next/link";
import { formatCLP } from "@/lib/utils";
import { resolveVehicleImage } from "@/lib/images";
import type { VehicleWithImages } from "@/types/database";

interface FeaturedStripProps {
  vehicles: VehicleWithImages[];
}

/**
 * Destacados pegados al borde inferior del viewport (altura natural).
 * No crecen hacia arriba: el hero ocupa el resto.
 */
export default function FeaturedStrip({ vehicles }: FeaturedStripProps) {
  if (!vehicles.length) return null;

  return (
    <section className="relative w-full shrink-0 bg-brand-bg px-5 pb-2.5 pt-0 sm:px-6 sm:pb-3 sm:pt-0.5 lg:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-1.5 text-[1.15rem] font-black tracking-tight text-white sm:mb-2 sm:text-[1.25rem]">
          Destacados
        </h2>

        <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 snap-x snap-mandatory scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0">
          {vehicles.slice(0, 3).map((v) => (
            <Link
              key={v.id}
              href={`/catalogo/detalle/${v.slug}`}
              className="group flex h-[5.25rem] w-[min(82vw,17.5rem)] shrink-0 snap-center overflow-hidden rounded-xl border border-white/[0.09] bg-[#0c1626] transition hover:border-brand-accent/35 sm:h-[5.5rem] sm:w-auto sm:shrink sm:snap-none"
            >
              <div className="relative w-[40%] min-w-[5.5rem] overflow-hidden">
                <Image
                  src={resolveVehicleImage(v)}
                  alt={`${v.brand} ${v.model}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 40vw, 150px"
                />
              </div>
              <div className="flex flex-1 flex-col justify-center px-2.5 py-1.5">
                <h3 className="text-[0.6875rem] font-bold uppercase leading-snug tracking-wide text-white sm:text-[0.75rem]">
                  {v.brand} {v.model}
                </h3>
                <p className="mt-0.5 text-[0.625rem] text-white/45">{v.year}</p>
                <p className="mt-1 text-[0.875rem] font-black tracking-tight text-brand-accent sm:text-[0.9375rem]">
                  {formatCLP(v.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
