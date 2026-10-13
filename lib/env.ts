/**
 * Fronteras de entorno.
 * En producción (next build) no hay datos ficticios. En `next dev` el mock
 * local sigue disponible si la planilla no responde.
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Datos mock solo en desarrollo local. */
export function canUseMockFallback(): boolean {
  return !isProduction();
}