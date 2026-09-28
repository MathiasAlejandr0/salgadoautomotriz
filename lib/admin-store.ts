import { MOCK_REVIEWS, MOCK_VEHICLES } from "@/lib/mock-data";
import type { Review, VehicleWithImages } from "@/types/database";
import { resolveVehicleImage } from "@/lib/images";

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

let vehicles: AdminVehicle[] | null = null;
let reviews: Review[] | null = null;
let leads: AdminLead[] | null = null;

function seedVehicles(): AdminVehicle[] {
  return MOCK_VEHICLES.map((v) => ({
    ...v,
    status: v.published ? "Disponible" : "Borrador",
    image: resolveVehicleImage(v),
  }));
}

function seedLeads(): AdminLead[] {
  const first = MOCK_VEHICLES[0];
  return [
    {
      id: "lead-1",
      type: "contacto",
      nombre: "Pedro González",
      email: "pedro@email.com",
      telefono: "+56 9 8765 4321",
      mensaje: "Me interesa agendar una visita esta semana.",
      vehicle_slug: first?.slug ?? null,
      created_at: new Date().toISOString(),
      read: false,
      score: "caliente",
    },
    {
      id: "lead-2",
      type: "financiamiento",
      nombre: "Ana López",
      email: "ana@email.com",
      telefono: "+56 9 1111 2222",
      mensaje: first
        ? `Preaprobación ${first.brand} ${first.model} · pie 20% · 48 meses`
        : "Quiero simular un crédito",
      vehicle_slug: first?.slug ?? null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      read: true,
      score: "tibio",
    },
  ];
}

function asAdmin(list: VehicleWithImages[]): AdminVehicle[] {
  return list.map((v) => ({
    ...v,
    status: v.published ? "Disponible" : "Borrador",
    image: resolveVehicleImage(v),
  }));
}

/** Carga el stock de la pestaña Salgado antes de leer o editar. */
export async function ensureAdminVehicles(): Promise<AdminVehicle[]> {
  if (vehicles) return vehicles;
  const { loadSalgadoCatalog } = await import("@/lib/inventory/catalog");
  const sheet = await loadSalgadoCatalog();
  vehicles = asAdmin(sheet.length ? sheet : seedVehicles());
  return vehicles;
}

export function listAdminVehicles(): AdminVehicle[] {
  if (!vehicles) vehicles = seedVehicles();
  return vehicles;
}

export function listAdminReviews(): Review[] {
  if (!reviews) reviews = MOCK_REVIEWS.map((r) => ({ ...r }));
  return reviews;
}

export function listAdminLeads(): AdminLead[] {
  if (!leads) leads = seedLeads();
  return leads;
}

export function upsertAdminVehicle(input: AdminVehicle): AdminVehicle {
  const list = listAdminVehicles();
  const i = list.findIndex((v) => v.slug === input.slug || v.id === input.id);
  const next = {
    ...input,
    image: input.image || resolveVehicleImage(input),
    updated_at: new Date().toISOString(),
    published: input.status === "Disponible" || input.status === "En reserva",
    featured: input.featured && input.status !== "Borrador" && input.status !== "Vendido",
  };
  if (i >= 0) list[i] = next;
  else list.unshift(next);
  return next;
}

export function patchAdminVehicle(
  slug: string,
  patch: Partial<AdminVehicle>
): AdminVehicle | null {
  const list = listAdminVehicles();
  const current = list.find((v) => v.slug === slug);
  if (!current) return null;
  return upsertAdminVehicle({ ...current, ...patch, slug: current.slug, id: current.id });
}

export function deleteAdminVehicle(slug: string): boolean {
  const list = listAdminVehicles();
  const i = list.findIndex((v) => v.slug === slug);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

export function markLeadRead(id: string): void {
  const list = listAdminLeads();
  const lead = list.find((l) => l.id === id);
  if (lead) lead.read = true;
}

export function upsertReview(review: Review): Review {
  const list = listAdminReviews();
  const i = list.findIndex((r) => r.id === review.id);
  if (i >= 0) list[i] = review;
  else list.unshift(review);
  return review;
}
