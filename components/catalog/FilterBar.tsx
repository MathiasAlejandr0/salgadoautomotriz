"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  brands: string[];
  categories: string[];
  years: number[];
  currentFilters: {
    brand?: string;
    category?: string;
    search?: string;
    priceMax?: string;
    yearMin?: string;
    yearMax?: string;
    sort?: string;
  };
}

export default function FilterBar({
  brands,
  categories,
  years,
  currentFilters,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(currentFilters.search ?? "");

  const update = (patch: Record<string, string | undefined>) => {
    const next = { ...currentFilters, ...patch };
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const activeCat = currentFilters.category ?? "Todas";
  const pills = ["Todas", ...categories];
  const selectCls =
    "appearance-none bg-brand-bg border border-brand-border focus:border-brand-accent text-brand-text text-sm rounded-xl px-4 py-2.5 pr-9 outline-none w-full";

  const yearValue = currentFilters.yearMin ?? "";

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && update({ search: search || undefined })
          }
          placeholder="Buscar por marca, modelo o palabra clave…"
          className="w-full rounded-xl border border-brand-border bg-brand-surface py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-brand-muted focus:border-brand-accent"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() =>
              update({ category: cat === "Todas" ? undefined : cat })
            }
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
              activeCat === cat
                ? "border-brand-accent bg-brand-accent text-[#041018] shadow-[0_0_20px_rgba(0,188,254,0.35)]"
                : "border-brand-border bg-transparent text-brand-muted hover:border-brand-accent/40 hover:text-white"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="relative">
          <select
            value={currentFilters.brand ?? ""}
            onChange={(e) => update({ brand: e.target.value || undefined })}
            className={selectCls}
            aria-label="Marca"
          >
            <option value="">Marca</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
          />
        </div>

        <div className="relative">
          <select
            value={currentFilters.priceMax ?? ""}
            onChange={(e) => update({ priceMax: e.target.value || undefined })}
            className={selectCls}
            aria-label="Precio"
          >
            <option value="">Precio</option>
            <option value="15000000">Hasta $15M</option>
            <option value="20000000">Hasta $20M</option>
            <option value="30000000">Hasta $30M</option>
            <option value="50000000">Hasta $50M</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
          />
        </div>

        <div className="relative">
          <select
            value={yearValue}
            onChange={(e) => {
              const y = e.target.value || undefined;
              update({ yearMin: y, yearMax: y });
            }}
            className={selectCls}
            aria-label="Año"
          >
            <option value="">Año</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
          />
        </div>

        <div className="relative">
          <select
            value={currentFilters.sort ?? ""}
            onChange={(e) => update({ sort: e.target.value || undefined })}
            className={selectCls}
            aria-label="Ordenar"
          >
            <option value="">Ordenar</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
            <option value="year-desc">Más nuevos</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
          />
        </div>
      </div>
    </div>
  );
}
