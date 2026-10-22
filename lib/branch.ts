export type Branch = "salgado" | "rg" | "unidades" | "pendiente";

/**
 * Sucursal física a partir de la columna UBICACION.
 * Cardonal es el patio de Salgado. RG Motors y Unidades Chile
 * se nombran aparte en la misma columna. Vacío queda pendiente:
 * no se adivina la sucursal.
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

/** Publicado en este dominio. Pendiente se queda hasta que Mathias confirme. */
export function publishedOnSalgado(branch: Branch): boolean {
  return branch === "salgado" || branch === "pendiente";
}
