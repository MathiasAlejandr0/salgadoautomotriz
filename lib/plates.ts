import { cleanPlate } from "@/lib/inventory/sheet";

/** Patente chilena de auto: LLNNNN (antigua) o LLLLNN (desde 2007). */
const PLATE_TOKEN = /^(?:[a-z]{4}\d{2}|[a-z]{2}\d{4})$/i;

export function normalizePlate(value: string): string {
  return cleanPlate(value);
}

export function isPlateToken(value: string): boolean {
  return PLATE_TOKEN.test(value.trim());
}

/** Quita el sufijo de patente de un slug. El resto del slug no se modifica. */
export function stripTrailingPlate(slug: string): { bare: string; plate: string } {
  const parts = slug.trim().toLowerCase().split("-").filter(Boolean);
  if (parts.length < 2) return { bare: parts.join("-"), plate: "" };
  const plate = normalizePlate(parts[parts.length - 1] ?? "");
  if (!plate) return { bare: parts.join("-"), plate: "" };
  return { bare: parts.slice(0, -1).join("-"), plate: plate.toLowerCase() };
}

/**
 * Saca menciones a patentes del texto público.
 * No toca años, cilindradas ni códigos de modelo.
 */
export function stripPlateMentions(value: string): string {
  const withoutLabel = value.replace(
    /\bpatente\b\s*[:#-]?\s*[A-Za-z0-9][A-Za-z0-9.\-\s]{3,12}/gi,
    " "
  );
  const withoutTokens = withoutLabel
    .split(/(\s+)/)
    .map((part) => {
      const compact = part.replace(/[^A-Za-z0-9]/g, "");
      return isPlateToken(compact) ? " " : part;
    })
    .join("");

  return withoutTokens
    .replace(/\s+([,.])/g, "$1")
    .replace(/^[.,\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}
