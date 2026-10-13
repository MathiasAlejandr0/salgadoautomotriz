import type { VehicleWithImages } from "@/types/database";

export type StockStatus = "Disponible" | "En reserva" | "Vendido" | "Borrador";

export type AdminVehicle = VehicleWithImages & {
  status: StockStatus;
  image: string;
};

export type AdminLead = {
  id: string;
  type: "contacto" | "financiamiento";
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
  vehicle_slug: string | null;
  created_at: string;
  read: boolean;
  score: "caliente" | "tibio" | "frio";
};