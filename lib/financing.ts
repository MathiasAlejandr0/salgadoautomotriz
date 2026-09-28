/** Tasa mensual referencial (simulador). No es oferta vinculante. */
export const MONTHLY_RATE = 0.012;

export function calcCuota(monto: number, meses: number, tasa = MONTHLY_RATE): number {
  if (meses <= 0) return 0;
  if (tasa === 0) return monto / meses;
  const factor = Math.pow(1 + tasa, meses);
  return (monto * tasa * factor) / (factor - 1);
}

export function pieMinimo(price: number, pct = 0.2): number {
  return Math.round(price * pct);
}
