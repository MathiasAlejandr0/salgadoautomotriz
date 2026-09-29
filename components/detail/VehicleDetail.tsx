"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Gauge,
  Fuel,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileCheck,
  DollarSign,
  Maximize2,
  MessageCircle,
} from "lucide-react";
import { formatCLP } from "@/lib/utils";
import { resolveVehicleGallery } from "@/lib/images";
import type { VehicleWithImages } from "@/types/database";
import { waUrl } from "@/lib/site";
import { calcCuota, pieMinimo } from "@/lib/financing";

interface Props {
  vehicle: VehicleWithImages;
  waMessage: string;
}

export default function VehicleDetail({ vehicle, waMessage }: Props) {
  const gallery = resolveVehicleGallery(vehicle);
  const [current, setCurrent] = useState(0);
  const [plazo, setPlazo] = useState(60);

  const pieMin = pieMinimo(vehicle.price);
  const monto = vehicle.price - pieMin;
  const cuota = calcCuota(monto, plazo);

  const SPECS = [
    {
      icon: Gauge,
      label: "Kilometraje",
      value:
        vehicle.mileage != null
          ? `${vehicle.mileage.toLocaleString("es-CL")} km`
          : "—",
    },
    { icon: Settings2, label: "Transmisión", value: vehicle.transmission ?? "—" },
    { icon: Fuel, label: "Combustible", value: vehicle.fuel ?? "—" },
    { icon: Calendar, label: "Año", value: String(vehicle.year) },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-[#8ba0b8] mb-7">
        <Link href="/" className="hover:text-white transition-colors">
          Inicio
        </Link>
        <ChevronRight size={12} />
        <Link href="/catalogo" className="hover:text-white transition-colors">
          Catálogo
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#00BCFE]">{vehicle.category}</span>
        <ChevronRight size={12} />
        <span className="text-white truncate">
          {vehicle.brand} {vehicle.model} {vehicle.version} {vehicle.year}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-7">
        <div className="lg:col-span-3 space-y-3">
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden neon-border bg-[#0a1a2e]">
            <Image
              src={gallery[current]}
              alt={`${vehicle.brand} ${vehicle.model}`}
              fill
              className="object-cover"
              preload
              sizes="(max-width: 1024px) 100vw, 60vw"
              quality={90}
            />
            <button
              onClick={() => setCurrent((c) => (c === 0 ? gallery.length - 1 : c - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#050d18]/70 hover:bg-[#0a1a2e] rounded-full flex items-center justify-center text-white backdrop-blur-md border border-white/10"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrent((c) => (c === gallery.length - 1 ? 0 : c + 1))}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#050d18]/70 hover:bg-[#0a1a2e] rounded-full flex items-center justify-center text-white backdrop-blur-md border border-white/10"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-[#050d18]/75 backdrop-blur-md text-xs text-white px-3 py-1.5 rounded-lg border border-white/10">
              <Maximize2 size={12} />
              {current + 1} / {gallery.length}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {gallery.map((src, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`relative shrink-0 w-[88px] h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === current ? "border-[#00BCFE] shadow-[0_0_12px_rgba(0,188,254,0.4)]" : "border-[#16324f]"
                }`}
              >
                <Image src={src} alt="" fill className="object-cover" sizes="88px" />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 neon-border bg-[#0a1a2e]/80 rounded-2xl p-4">
            {SPECS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-[#050d18] rounded-lg flex items-center justify-center shrink-0 border border-[#16324f]">
                  <Icon size={15} className="text-[#00BCFE]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#00BCFE] uppercase tracking-wide font-semibold">
                    {label}
                  </p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="neon-border bg-[#0a1a2e]/90 rounded-2xl p-6 sticky top-24 space-y-5">
            <div>
              <p className="text-[#00BCFE] text-[11px] font-bold uppercase tracking-[0.2em] mb-2">
                Disponible en sala
              </p>
              <h1 className="text-2xl font-black text-white leading-tight">
                {vehicle.brand} {vehicle.model} {vehicle.version} {vehicle.year}
              </h1>
              <p className="text-sm text-[#8ba0b8] mt-2 leading-relaxed">
                {[
                  vehicle.category,
                  vehicle.doors ? `${vehicle.doors} Puertas` : null,
                  vehicle.engine ? `Motor ${vehicle.engine}` : null,
                  vehicle.color,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <div>
              <p className="text-4xl font-black text-white tracking-tight">
                {formatCLP(vehicle.price)}
              </p>
              <p className="text-sm text-[#00BCFE] mt-1 font-semibold">
                Pie mínimo: {formatCLP(pieMin)}
              </p>
            </div>

            <div className="bg-[#050d18] rounded-xl p-4 border border-[#16324f]">
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-xs text-[#8ba0b8]">Cuota estimada</p>
                <p className="text-2xl font-black text-[#00BCFE]">
                  {formatCLP(Math.round(cuota))}
                  <span className="text-sm font-semibold text-[#8ba0b8]">/mes</span>
                </p>
              </div>
              <label className="text-xs text-[#8ba0b8] block mb-2">
                Plazo del financiamiento:{" "}
                <span className="text-white font-semibold">{plazo} meses</span>
              </label>
              <input
                type="range"
                min={12}
                max={72}
                step={12}
                value={plazo}
                onChange={(e) => setPlazo(Number(e.target.value))}
                className="range-premium"
                style={{ ["--pct" as string]: `${((plazo - 12) / 60) * 100}%` }}
              />
            </div>

            <div className="space-y-3">
              <a
                href={waUrl(waMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa w-full flex items-center justify-center gap-2 text-sm px-6 py-3.5 rounded-xl"
              >
                <MessageCircle size={18} />
                Escribir por WhatsApp
              </a>
              <a
                href={waUrl(
                  `Hola, quiero agendar una visita para ver el ${vehicle.brand} ${vehicle.model} ${vehicle.year}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 border border-[#00BCFE]/45 hover:bg-[#00BCFE]/10 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-colors"
              >
                <Calendar size={16} className="text-[#00BCFE]" />
                Agendar visita
              </a>
            </div>
          </div>
        </div>
      </div>

      {vehicle.description && (
        <div className="mt-8 neon-border bg-[#0a1a2e]/80 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-3">Descripción</h2>
          <p className="text-[#8ba0b8] leading-relaxed whitespace-pre-line">
            {vehicle.description}
          </p>
        </div>
      )}

      <div className="mt-8 neon-border bg-[#0a1a2e]/70 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            icon: Shield,
            title: "Garantía",
            desc: "Vehículos verificados con garantía de hasta 1 año.",
          },
          {
            icon: FileCheck,
            title: "Transferencia segura",
            desc: "Nos encargamos de todo el trámite por ti.",
          },
          {
            icon: DollarSign,
            title: "Financiamiento",
            desc: "Planes a tu medida con las mejores tasas del mercado.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-3">
            <div className="w-10 h-10 bg-[#050d18] rounded-lg flex items-center justify-center shrink-0 border border-[#16324f]">
              <Icon size={18} className="text-[#00BCFE]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#00BCFE]">{title}</p>
              <p className="text-xs text-[#8ba0b8] leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
