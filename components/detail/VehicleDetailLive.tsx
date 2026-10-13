"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VehicleDetail from "@/components/detail/VehicleDetail";
import type { VehicleWithImages } from "@/types/database";

function waMessageFor(v: VehicleWithImages) {
  return `Hola, me interesa el ${v.brand} ${v.model} ${v.year} (${v.slug}). ¿Está disponible?`;
}

/**
 * Ficha viva. `initial` viene del build; si es null (auto nuevo que llegó por
 * la planilla o el admin después del build) se carga por /api/vehicles/<slug>.
 */
export default function VehicleDetailLive({ initial }: { initial: VehicleWithImages | null }) {
  const [vehicle, setVehicle] = useState<VehicleWithImages | null>(initial);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const slug = initial?.slug ?? window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setMissing(true);
      return;
    }
    let cancelled = false;
    fetch(`/api/vehicles/${slug}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data?.vehicle) {
          setVehicle(data.vehicle);
          setMissing(false);
          document.title = `${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.year} | Salgado Automotriz`;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial?.slug]);

  if (missing && !vehicle) {
    return (
      <div className="mx-auto max-w-[1280px] px-5 py-24 text-center lg:px-8">
        <h1 className="mb-3 text-3xl font-black text-white">Vehículo no encontrado</h1>
        <p className="mb-6 text-brand-muted">Puede que ya se haya vendido.</p>
        <Link href="/catalogo" className="text-brand-accent hover:underline">
          Ver catálogo
        </Link>
      </div>
    );
  }
  if (missing && vehicle) {
    return (
      <div className="mx-auto max-w-[1280px] px-5 py-24 text-center lg:px-8">
        <h1 className="mb-3 text-3xl font-black text-white">Este vehículo ya no está disponible</h1>
        <Link href="/catalogo" className="text-brand-accent hover:underline">
          Ver catálogo
        </Link>
      </div>
    );
  }
  if (!vehicle) {
    return <div className="min-h-[60vh]" aria-busy="true" />;
  }
  return <VehicleDetail vehicle={vehicle} waMessage={waMessageFor(vehicle)} />;
}