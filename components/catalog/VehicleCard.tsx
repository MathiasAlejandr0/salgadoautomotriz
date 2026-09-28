import Link from "next/link";
import Image from "next/image";
import { formatCLP, cn } from "@/lib/utils";
import type { VehicleWithImages } from "@/types/database";
import { resolveVehicleImage } from "@/lib/images";
import { calcCuota, pieMinimo } from "@/lib/financing";
import { Fuel, Gauge, Calendar, Settings2 } from "lucide-react";

interface VehicleCardProps {
  vehicle: VehicleWithImages;
  glow?: boolean;
}

export default function VehicleCard({ vehicle, glow = false }: VehicleCardProps) {
  const imgSrc = resolveVehicleImage(vehicle);
  const pieMin = pieMinimo(vehicle.price);
  const cuota = Math.round(calcCuota(vehicle.price - pieMin, 48));

  return (
    <Link
      href={`/catalogo/detalle/${vehicle.slug}`}
      className={cn(
        "group block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1828] transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/50",
        glow && "border-brand-accent/60 shadow-[0_0_32px_rgba(0,188,254,0.2)]"
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={imgSrc}
          alt={`${vehicle.brand} ${vehicle.model}`}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          sizes="(max-width: 640px) 100vw, 33vw"
        />
        <span className="absolute left-3 top-3 rounded-md bg-brand-accent px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#041018]">
          Pie mínimo
        </span>
      </div>
      <div className="p-5">
        <h3 className="text-[15px] font-black uppercase tracking-wide text-white">
          {vehicle.brand} {vehicle.model}
        </h3>
        <p className="mb-4 mt-1 text-xs text-white/50">{vehicle.version}</p>
        <div className="mb-5 grid grid-cols-4 gap-1">
          {[
            { icon: Calendar, text: String(vehicle.year) },
            {
              icon: Gauge,
              text: vehicle.mileage != null ? `${Math.round(vehicle.mileage / 1000)}k` : "—",
            },
            { icon: Fuel, text: vehicle.fuel?.slice(0, 3) ?? "—" },
            {
              icon: Settings2,
              text:
                vehicle.transmission === "Automática"
                  ? "AT"
                  : vehicle.transmission === "Manual"
                    ? "MT"
                    : "—",
            },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Icon size={14} className="text-brand-accent" />
              <span className="text-[10px] text-white/70">{text}</span>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between border-t border-white/5 pt-3">
          <p className="text-xl font-black text-white">{formatCLP(vehicle.price)}</p>
          <div className="text-right">
            <p className="text-[10px] text-brand-accent">cuota desde</p>
            <p className="text-sm font-bold text-brand-accent">{formatCLP(cuota)}/mes</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
