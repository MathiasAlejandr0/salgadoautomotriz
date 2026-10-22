export type Branch = "salgado" | "rg" | "unidades" | "pendiente";

/**
 * Sucursal física a partir de la columna UBICACION.
 * Cardonal es el patio de Salgado. RG Motors y Unidades Chile
 * se nombran aparte en la misma columna. Vacío queda pendiente:
 * no se adivina la sucursal.
 *
 * Esta etiqueta no saca el auto del sitio. Si la fila sigue en la
 * planilla de Salgado, la ficha se publica aquí aunque también
 * esté en otra planilla. La única salida confirmada es el Ranger
 * SHYL53, en lib/rg-pages.ts.
 */
export function branchOf(location: string | null | undefined): Branch {
  const value = (location ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  if (!value) return "pendiente";
  if (/\bRG\b|RG MOTORS|BANCO DE CHILE/.test(value)) return "rg";
  if (/UNIDAD|UNI CHILE|REGIMIENTO/.test(value)) return "unidades";
  if (/CARDONAL|SALGADO|PATIO|CLIENTE/.test(value)) return "salgado";
  return "pendiente";
}
