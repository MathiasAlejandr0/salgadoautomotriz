"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, CalendarDays, ChevronDown, Search } from "lucide-react";
import type { SearchOptions } from "@/lib/search-options";
import { cn } from "@/lib/utils";

interface Props {
  options: SearchOptions;
}

/** Buscador del hero — única implementación. */
export default function HeroSearchForm({ options }: Props) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");

  const models = useMemo(() => {
    if (brand && options.modelsByBrand[brand]) return options.modelsByBrand[brand];
    return options.allModels;
  }, [brand, options]);

  const runSearch = () => {
    const p = new URLSearchParams();
    if (brand) p.set("brand", brand);
    if (model) p.set("search", model);
    if (year) {
      p.set("yearMin", year);
      p.set("yearMax", year);
    }
    router.push(`/catalogo?${p.toString()}`);
  };

  const field =
    "flex min-w-0 flex-1 items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:border-b-0 sm:border-r sm:border-white/10 sm:py-0";

  return (
    <div
      className={cn(
        "search-glass mx-auto flex w-full max-w-[700px] flex-col overflow-hidden rounded-xl",
        "sm:flex-row sm:items-stretch sm:min-h-11",
        "shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      )}
    >
      <label className={cn(field, "sm:min-h-11")}>
        <Car size={14} className="hidden shrink-0 text-brand-accent sm:block" strokeWidth={1.75} />
        <select
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setModel("");
          }}
          className="w-full cursor-pointer appearance-none bg-transparent text-[0.8125rem] font-semibold text-white outline-none"
          aria-label="Marca"
        >
          <option value="" className="bg-[#0a1524]">
            Marca
          </option>
          {options.brands.map((b) => (
            <option key={b} value={b} className="bg-[#0a1524]">
              {b}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="shrink-0 text-white/40" />
      </label>

      <label className={cn(field, "sm:min-h-11")}>
        <Car size={14} className="hidden shrink-0 text-brand-accent sm:block" strokeWidth={1.75} />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full cursor-pointer appearance-none bg-transparent text-[0.8125rem] font-semibold text-white outline-none"
          aria-label="Modelo"
        >
          <option value="" className="bg-[#0a1524]">
            Modelo
          </option>
          {models.map((m) => (
            <option key={m} value={m} className="bg-[#0a1524]">
              {m}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="shrink-0 text-white/40" />
      </label>

      <label className={cn(field, "sm:min-h-11")}>
        <CalendarDays
          size={14}
          className="hidden shrink-0 text-brand-accent sm:block"
          strokeWidth={1.75}
        />
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="w-full cursor-pointer appearance-none bg-transparent text-[0.8125rem] font-semibold text-white outline-none"
          aria-label="Año"
        >
          <option value="" className="bg-[#0a1524]">
            Año
          </option>
          {options.years.map((y) => (
            <option key={y} value={String(y)} className="bg-[#0a1524]">
              {y}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="shrink-0 text-white/40" />
      </label>

      <div className="flex items-center p-1.5 sm:min-w-[6.75rem]">
        <button
          type="button"
          onClick={runSearch}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg",
            "bg-brand-accent text-[0.8125rem] font-bold text-[#041018]",
            "shadow-[0_0_14px_rgba(0,188,254,0.35)] transition hover:bg-brand-accent2"
          )}
        >
          <Search size={13} strokeWidth={2.5} />
          Buscar
        </button>
      </div>
    </div>
  );
}
