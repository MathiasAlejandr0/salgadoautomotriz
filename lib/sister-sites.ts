import { rgConfirmedPageFor } from "@/lib/rg-pages";
import type { StockUnit } from "@/lib/vehicle-public";

/**
 * 301 entre sitios. Solo el Ranger 4x4 2023 (SHYL53), confirmado por Mathias.
 *
 * Un auto que está en esta planilla y también en la de RG o Unidades Chile
 * se queda, con canónico propio. No se consulta el sitemap de otro dominio:
 * eso movía fichas que siguen en la planilla de Salgado.
 */
export function sisterUrlFor(
  unit: Pick<StockUnit, "plate" | "brand" | "model" | "year">
): string | null {
  return rgConfirmedPageFor(unit);
}

/** Patente que ya no está en esta planilla. Hoy solo SHYL53 tiene destino. */
export function sisterUrlByPlate(plate: string): string | null {
  return rgConfirmedPageFor({ plate, brand: "", model: "", year: 0 });
}
