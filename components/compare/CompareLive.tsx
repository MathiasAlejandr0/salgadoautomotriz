"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveVehicles } from "@/lib/live";
import { resolveVehicleThumb } from "@/lib/images";
import { formatCLP } from "@/lib/utils";
import type { VehicleWithImages } from "@/types/database";

const MAX = 3;
const DASH = "Consultar";

const ROWS: { label: string; get: (v: VehicleWithImages) => string }[] = [
  { label: "Precio", get: (v) => formatCLP(v.price) },
  { label: "Año", get: (v) => String(v.year) },
  { label: "Categoría", get: (v) => v.category || DASH },
  { label: "Motor", get: (v) => v.engine || DASH },
  { label: "Potencia", get: (v) => v.power || DASH },
  { label: "Transmisión", get: (v) => v.transmission || DASH },
  { label: "Tracción", get: (v) => v.traction || DASH },
  { label: "Combustible", get: (v) => v.fuel || DASH },
  { label: "Puertas", get: (v) => (v.doors != null ? String(v.doors) : DASH) },
  { label: "Color", get: (v) => v.color || DASH },
];

/** Comparador como el de RG: hasta 3 autos, selección en la URL (?v=slug1,slug2). */
export default function CompareLive({ initial }: { initial: VehicleWithImages[] }) {
  const all = useLiveVehicles(initial);
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>(() =>
    (params.get("v") ?? "")
      .split(",")
      .filter((s) => /^[a-z0-9-]+$/.test(s))
      .slice(0, MAX)
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected.length) url.searchParams.set("v", selected.join(","));
    else url.searchParams.delete("v");
    window.history.replaceState(null, "", url.toString());
  }, [selected]);

  const cars = useMemo(
    () => selected.map((s) => all.find((v) => v.slug === s)).filter(Boolean) as VehicleWithImages[],
    [selected, all]
  );
  const available = all.filter((v) => !selected.includes(v.slug));
  const add = (slug: string) => slug && selected.length < MAX && setSelected([...selected, slug]);
  const remove = (slug: string) => setSelected(selected.filter((s) => s !== slug));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-40 p-4 text-left align-bottom text-xs font-semibold uppercase tracking-wider text-white/40">
                Especificaciones
              </th>
              {cars.map((v) => (
                <th key={v.slug} className="min-w-[220px] p-3 align-top">
                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1828] p-4 text-left">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#08111e]">
                      <Image src={resolveVehicleThumb(v)} alt="" aria-hidden fill className="scale-110 object-cover opacity-35 blur-lg" sizes="120px" />
                      <Image src={resolveVehicleThumb(v)} alt={`${v.brand} ${v.model}`} fill className="object-contain object-center" sizes="260px" />
                    </div>
                    <p className="mt-3 text-sm font-black uppercase text-white">
                      {v.brand} {v.model}
                    </p>
                    <p className="text-xs text-white/50">{v.year}</p>
                    <p className="mt-1.5 text-base font-black text-brand-accent">{formatCLP(v.price)}</p>
                    <button
                      type="button"
                      onClick={() => remove(v.slug)}
                      className="mt-3 text-[11px] font-semibold text-rose-400 transition-colors hover:text-rose-300"
                    >
                      ✕ Quitar de la comparación
                    </button>
                  </div>
                </th>
              ))}
              {selected.length < MAX && (
                <th className="min-w-[220px] p-3 align-top">
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-6">
                    <span className="mb-2 text-2xl text-white/30">+</span>
                    <label htmlFor="compare-add" className="mb-3 text-xs font-semibold text-white/60">
                      Agregar vehículo
                    </label>
                    <select
                      id="compare-add"
                      onChange={(e) => add(e.target.value)}
                      value=""
                      className="w-full cursor-pointer rounded-xl border border-white/15 bg-[#050a14] px-3 py-2 text-xs font-medium text-white outline-none focus:border-brand-accent"
                    >
                      <option value="">Seleccionar…</option>
                      {available.map((v) => (
                        <option key={v.slug} value={v.slug}>
                          {v.brand} {v.model} {v.year}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={row.label} className={ri % 2 ? "bg-white/[0.02]" : ""}>
                <td className="border-b border-white/[0.06] p-4 text-xs font-semibold text-white/70">{row.label}</td>
                {cars.map((v) => (
                  <td key={v.slug} className="border-b border-white/[0.06] p-4 text-xs font-medium text-white/90">
                    {row.get(v)}
                  </td>
                ))}
                {selected.length < MAX && <td className="border-b border-white/[0.06]" />}
              </tr>
            ))}
            <tr>
              <td className="p-4" />
              {cars.map((v) => (
                <td key={v.slug} className="p-4">
                  <Link
                    href={`/catalogo/detalle/${v.slug}`}
                    className="btn-hero-cyan block rounded-full py-2.5 text-center text-xs font-bold"
                  >
                    Ver ficha completa
                  </Link>
                </td>
              ))}
              {selected.length < MAX && <td />}
            </tr>
          </tbody>
        </table>
      </div>
      {cars.length === 0 && (
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0c1828] p-12 text-center text-sm text-white/50">
          Agrega vehículos para compararlos lado a lado.
        </div>
      )}
    </div>
  );
}
