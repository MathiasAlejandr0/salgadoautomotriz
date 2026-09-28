"use client";

import { useState } from "react";
import Image from "next/image";
import { Shield, Building2, Clock, MessageCircle } from "lucide-react";
import { formatCLP } from "@/lib/utils";
import { resolveVehicleImage } from "@/lib/images";
import { calcCuota } from "@/lib/financing";
import { waUrl } from "@/lib/site";
import type { VehicleWithImages } from "@/types/database";

interface Props {
  vehicles: VehicleWithImages[];
}

export default function FinancingCalculator({ vehicles }: Props) {
  const list = vehicles.length > 0 ? vehicles : [];
  const [vehicleId, setVehicleId] = useState(list[0]?.id ?? "");
  const [piePct, setPiePct] = useState(20);
  const [plazo, setPlazo] = useState(48);

  const vehicle = list.find((x) => x.id === vehicleId) ?? list[0];
  if (!vehicle) {
    return (
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <p className="text-sm text-brand-muted">
          No hay vehículos disponibles para simular.
        </p>
      </div>
    );
  }

  const pie = Math.round(vehicle.price * (piePct / 100));
  const monto = vehicle.price - pie;
  const cuota = calcCuota(monto, plazo);
  const img = resolveVehicleImage(vehicle);

  const waMsg = `Hola, quiero pedir preaprobación de financiamiento:
• ${vehicle.brand} ${vehicle.model} ${vehicle.year}
• Precio: ${formatCLP(vehicle.price)}
• Pie: ${formatCLP(pie)} (${piePct}%)
• Plazo: ${plazo} meses
• Cuota estimada: ${formatCLP(Math.round(cuota))}/mes`;

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8">
      <h2 className="mb-7 text-xl font-black text-white">Simula tu financiamiento</h2>

      <div className="mb-7">
        <label className="mb-2 block text-xs font-medium text-brand-muted">
          1. Elige el vehículo
        </label>
        <div className="relative">
          <div className="absolute left-2.5 top-1/2 h-8 w-11 -translate-y-1/2 overflow-hidden rounded-md border border-white/10">
            <Image src={img} alt="" fill className="object-cover" sizes="44px" />
          </div>
          <select
            value={vehicle.id}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-brand-border bg-brand-bg py-3.5 pl-16 pr-4 text-sm text-white outline-none focus:border-brand-accent"
          >
            {list.map((x) => (
              <option key={x.id} value={x.id}>
                {x.brand} {x.model} {x.year} · {x.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-7">
        <div className="mb-3 flex justify-between">
          <label className="text-xs font-medium text-brand-muted">2. Pie / enganche</label>
          <span className="text-sm font-bold text-brand-accent">{formatCLP(pie)}</span>
        </div>
        <input
          type="range"
          min={10}
          max={50}
          step={5}
          value={piePct}
          onChange={(e) => setPiePct(Number(e.target.value))}
          className="range-premium"
          style={{ ["--pct" as string]: `${((piePct - 10) / 40) * 100}%` }}
        />
        <div className="mt-2 flex justify-between text-[10px] text-brand-muted">
          <span>10%</span>
          <span className="font-semibold text-white">{piePct}%</span>
          <span>50%</span>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex justify-between">
          <label className="text-xs font-medium text-brand-muted">3. Plazo</label>
          <span className="text-sm font-bold text-brand-accent">{plazo} meses</span>
        </div>
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
        <div className="mt-2 flex justify-between text-[10px] text-brand-muted">
          <span>12</span>
          <span>72</span>
        </div>
      </div>

      <div className="mb-7 border-y border-white/8 py-5 text-center">
        <p className="mb-1.5 text-xs text-brand-muted">Cuota estimada</p>
        <p className="text-4xl font-black tracking-tight md:text-5xl">
          <span className="text-white">{formatCLP(Math.round(cuota))}</span>
          <span className="text-lg font-bold text-brand-accent">/mes</span>
        </p>
        <p className="mt-2 text-[10px] text-brand-muted">
          * Tasa referencial. Sujeto a evaluación crediticia.
        </p>
      </div>

      <a
        href={waUrl(waMsg)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-wa flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm"
      >
        <MessageCircle size={18} />
        Pedir preaprobación por WhatsApp
      </a>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-brand-muted">
        <Shield size={12} className="text-brand-accent" />
        Sin compromiso · Respuesta rápida y segura
      </p>
    </div>
  );
}

export function FinancingTrustCards() {
  const items = [
    {
      icon: Building2,
      title: "Bancos",
      desc: "Trabajamos con los mejores bancos para darte las mejores condiciones.",
    },
    {
      icon: Shield,
      title: "Transferencia segura",
      desc: "Protegemos tus datos y tu dinero en cada paso del proceso.",
    },
    {
      icon: Clock,
      title: "Respuesta el mismo día",
      desc: "Un asesor te confirma tu simulación y siguientes pasos por WhatsApp.",
    },
  ];
  return (
    <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map(({ icon: Icon, title, desc }) => (
        <div key={title} className="neon-border rounded-2xl bg-brand-surface/70 p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border bg-brand-bg">
            <Icon size={18} className="text-brand-accent" />
          </div>
          <h3 className="mb-1.5 font-bold text-white">{title}</h3>
          <p className="text-sm leading-relaxed text-brand-muted">{desc}</p>
        </div>
      ))}
    </div>
  );
}
