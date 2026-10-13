"use client";

import FinancingCalculator from "@/components/financiamiento/FinancingCalculator";
import { useLiveVehicles } from "@/lib/live";
import type { VehicleWithImages } from "@/types/database";

export default function FinancingLive({ initial }: { initial: VehicleWithImages[] }) {
  const vehicles = useLiveVehicles(initial);
  return <FinancingCalculator vehicles={vehicles} />;
}