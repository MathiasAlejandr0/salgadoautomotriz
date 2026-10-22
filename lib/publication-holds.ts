import { normalizePlate } from "@/lib/plates";

/**
 * Mathias todavía no confirma la sucursal.
 * Siguen publicados en este dominio, sin 301 a RG Motors ni a Unidades Chile.
 * Tucson GHTD24, Spark GT HLXB59 y Tracker RZKV76.
 */
const AWAITING_BRANCH = new Set(["GHTD24", "HLXB59", "RZKV76"]);

export function awaitingBranchConfirmation(plate: string | null | undefined): boolean {
  const normalized = normalizePlate(plate ?? "");
  return Boolean(normalized) && AWAITING_BRANCH.has(normalized);
}
