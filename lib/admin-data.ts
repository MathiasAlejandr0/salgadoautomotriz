import { revalidatePath } from "next/cache";
import type { Database, Review, Vehicle, VehicleImage, VehicleWithImages } from "@/types/database";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveVehicleImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import {
  deleteAdminVehicle,
  ensureAdminVehicles,
  listAdminLeads,
  listAdminReviews,
  listAdminVehicles,
  markLeadRead,
  patchAdminVehicle,
  upsertAdminVehicle,
  upsertReview,
  type AdminLead,
  type AdminVehicle,
  type StockStatus,
} from "@/lib/admin-store";

const STATUSES: StockStatus[] = ["Disponible", "En reserva", "Vendido", "Borrador"];

export class AdminDataError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeFuel(value: unknown): string | null {
  const key = fold(String(value ?? ""));
  const map: Record<string, string> = {
    bencina: "Bencina",
    gasolina: "Bencina",
    diesel: "Diésel",
    hibrido: "Híbrido",
    electrico: "Eléctrico",
  };
  return map[key] ?? null;
}

function normalizeTransmission(value: unknown): string | null {
  const key = fold(String(value ?? ""));
  if (!key) return null;
  if (key.startsWith("aut")) return "Automática";
  if (key.startsWith("man") || key.startsWith("mec")) return "Manual";
  return null;
}

function normalizeStatus(value: unknown): StockStatus {
  return STATUSES.includes(value as StockStatus) ? (value as StockStatus) : "Disponible";
}

function publishFlags(status: StockStatus, featured: boolean) {
  return {
    status,
    published: status === "Disponible" || status === "En reserva",
    featured: featured && status !== "Borrador" && status !== "Vendido",
  };
}

function asAdmin(row: Vehicle & { vehicle_images?: VehicleImage[] | null }): AdminVehicle {
  const vehicle: VehicleWithImages = {
    ...row,
    vehicle_images: [...(row.vehicle_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
  return { ...vehicle, image: resolveVehicleImage(vehicle) };
}

function dbError(error: { message: string }, fallback: string): never {
  console.error("[admin]", error.message);
  if (/duplicate key|unique/i.test(error.message)) {
    throw new AdminDataError(409, "Ya existe un vehículo con esa patente, stock o slug");
  }
  const missing = /relation|schema cache|does not exist|column/i.test(error.message);
  throw new AdminDataError(
    missing ? 503 : 500,
    missing ? "Falta aplicar las migraciones de Supabase" : fallback
  );
}

function refreshCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/financiamiento");
  if (slug) revalidatePath(`/catalogo/detalle/${slug}`);
}

type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];

function toInsert(input: Partial<AdminVehicle>, slug: string): VehicleInsert {
  const brand = String(input.brand ?? "").trim();
  const model = String(input.model ?? "").trim();
  const year = Number(input.year);
  const price = Number(input.price);
  if (!brand || !model) throw new AdminDataError(400, "Marca y modelo son requeridos");
  if (!Number.isInteger(year) || year < 1980 || year > 2100) {
    throw new AdminDataError(400, "Año fuera de rango");
  }
  if (!Number.isFinite(price) || price <= 0 || price > 2_000_000_000) {
    throw new AdminDataError(400, "Precio inválido");
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new AdminDataError(400, "El slug no es válido");
  }

  const mileage =
    input.mileage == null || (typeof input.mileage === "string" && input.mileage === "")
      ? null
      : Number(input.mileage);
  if (mileage != null && (!Number.isFinite(mileage) || mileage < 0)) {
    throw new AdminDataError(400, "Kilometraje inválido");
  }

  const doors = input.doors == null ? null : Number(input.doors);
  if (doors != null && (!Number.isInteger(doors) || doors < 1 || doors > 7)) {
    throw new AdminDataError(400, "Cantidad de puertas inválida");
  }

  const flags = publishFlags(normalizeStatus(input.status), Boolean(input.featured));
  return {
    slug,
    brand,
    model,
    year,
    version: input.version?.trim() || null,
    category: input.category?.trim() || "SUV",
    fuel: normalizeFuel(input.fuel),
    transmission: normalizeTransmission(input.transmission),
    mileage: mileage == null ? null : Math.round(mileage),
    color: input.color?.trim() || null,
    doors,
    engine: input.engine?.trim() || null,
    price: Math.round(price),
    description: input.description?.trim() || null,
    plate: input.plate?.trim() || null,
    stock_id: input.stock_id?.trim() || null,
    location: input.location?.trim() || null,
    origin: input.origin?.trim() || null,
    ...flags,
  };
}

async function replaceImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
  images: VehicleImage[] | undefined
) {
  if (!images) return;
  const { error: deleted } = await supabase.from("vehicle_images").delete().eq("vehicle_id", vehicleId);
  if (deleted) dbError(deleted, "No se pudieron actualizar las fotos");
  const rows = images
    .map((img, index) => ({
      vehicle_id: vehicleId,
      storage_path: img.storage_path?.trim() ?? "",
      sort_order: index,
    }))
    .filter((img) => img.storage_path.length > 0)
    .slice(0, 12);
  if (!rows.length) return;
  const { error } = await supabase.from("vehicle_images").insert(rows);
  if (error) dbError(error, "No se pudieron guardar las fotos");
}

async function listFromDb(): Promise<AdminVehicle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*)")
    .order("updated_at", { ascending: false });
  if (error) dbError(error, "No se pudo leer el inventario");
  return (data ?? []).map((row) => asAdmin(row));
}

export async function adminListVehicles(): Promise<AdminVehicle[]> {
  if (!isSupabaseConfigured()) {
    await ensureAdminVehicles();
    return listAdminVehicles();
  }
  return listFromDb();
}

export async function adminCreateVehicle(input: Partial<AdminVehicle>): Promise<AdminVehicle> {
  const brand = String(input.brand ?? "").trim();
  const model = String(input.model ?? "").trim();
  const year = Number(input.year);
  const price = Number(input.price);
  if (!brand || !model || !year || !price) {
    throw new AdminDataError(400, "Marca, modelo, año y precio son requeridos");
  }

  if (!isSupabaseConfigured()) {
    await ensureAdminVehicles();
    const status = normalizeStatus(input.status);
    const slug =
      input.slug?.trim() ||
      slugify(`${brand}-${model}-${year}-${Date.now().toString().slice(-4)}`).replace(/-+/g, "-");
    const now = new Date().toISOString();
    return upsertAdminVehicle({
      id: input.id || `veh-${Date.now()}`,
      slug,
      brand,
      model,
      year,
      version: input.version ?? null,
      category: input.category || "SUV",
      fuel: input.fuel ?? "Bencina",
      transmission: input.transmission ?? "Automática",
      mileage: input.mileage ?? null,
      color: input.color ?? null,
      doors: input.doors ?? 4,
      engine: input.engine ?? null,
      price,
      description: input.description ?? null,
      plate: input.plate ?? null,
      stock_id: input.stock_id ?? null,
      location: input.location ?? null,
      origin: input.origin ?? null,
      published: status === "Disponible" || status === "En reserva",
      featured: Boolean(input.featured),
      created_at: input.created_at || now,
      updated_at: now,
      vehicle_images: input.vehicle_images ?? [],
      status,
      image: input.image || "",
    });
  }

  const slug = (
    input.slug?.trim() || slugify(`${brand} ${model} ${year} ${Date.now().toString().slice(-4)}`)
  )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const row = toInsert(input, slug);
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicles").insert(row).select("*, vehicle_images(*)").single();
  if (error || !data) dbError(error ?? { message: "insert vacío" }, "No se pudo publicar el vehículo");
  if (input.vehicle_images?.length) {
    await replaceImages(supabase, data.id, input.vehicle_images);
  }
  refreshCatalog(data.slug);
  const fresh = await supabase.from("vehicles").select("*, vehicle_images(*)").eq("id", data.id).single();
  if (fresh.error || !fresh.data) return asAdmin(data);
  return asAdmin(fresh.data);
}

export async function adminUpdateVehicle(slug: string, patch: Partial<AdminVehicle>): Promise<AdminVehicle | null> {
  if (!isSupabaseConfigured()) {
    await ensureAdminVehicles();
    return patchAdminVehicle(slug, patch);
  }

  const supabase = await createClient();
  const current = await supabase.from("vehicles").select("*, vehicle_images(*)").eq("slug", slug).maybeSingle();
  if (current.error) dbError(current.error, "No se pudo leer el vehículo");
  if (!current.data) return null;

  const merged: Partial<AdminVehicle> = { ...asAdmin(current.data), ...patch, slug, id: current.data.id };
  const row = toInsert(merged, slug);
  const { error } = await supabase.from("vehicles").update(row).eq("id", current.data.id);
  if (error) dbError(error, "No se pudo actualizar el vehículo");
  if (patch.vehicle_images) await replaceImages(supabase, current.data.id, patch.vehicle_images);
  refreshCatalog(slug);
  const fresh = await supabase.from("vehicles").select("*, vehicle_images(*)").eq("id", current.data.id).single();
  if (fresh.error || !fresh.data) dbError(fresh.error ?? { message: "vacío" }, "No se pudo leer el vehículo");
  return asAdmin(fresh.data);
}

export async function adminDeleteVehicle(slug: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    await ensureAdminVehicles();
    return deleteAdminVehicle(slug);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicles").delete().eq("slug", slug).select("slug");
  if (error) dbError(error, "No se pudo eliminar el vehículo");
  if (!data?.length) return false;
  refreshCatalog(slug);
  return true;
}

function leadScore(type: AdminLead["type"], read: boolean, vehicleSlug: string | null): AdminLead["score"] {
  if (type === "financiamiento") return read ? "tibio" : "caliente";
  if (!read && vehicleSlug) return "caliente";
  if (!read) return "tibio";
  return "frio";
}

export async function adminListLeads(): Promise<AdminLead[]> {
  if (!isSupabaseConfigured()) return listAdminLeads();
  const supabase = await createClient();
  const [contacts, financing] = await Promise.all([
    supabase.from("contact_leads").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("financing_leads").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  if (contacts.error) dbError(contacts.error, "No se pudieron leer los leads");
  if (financing.error) dbError(financing.error, "No se pudieron leer los leads");

  const leads: AdminLead[] = [
    ...(contacts.data ?? []).map((row) => ({
      id: `contact:${row.id}`,
      type: "contacto" as const,
      nombre: row.nombre,
      email: row.email ?? "—",
      telefono: row.telefono ?? "",
      mensaje: row.mensaje ?? "",
      vehicle_slug: row.vehicle_slug,
      created_at: row.created_at,
      read: row.read,
      score: leadScore("contacto", row.read, row.vehicle_slug),
    })),
    ...(financing.data ?? []).map((row) => ({
      id: `financing:${row.id}`,
      type: "financiamiento" as const,
      nombre: row.nombre,
      email: row.email,
      telefono: row.telefono,
      mensaje: row.mensaje ?? "",
      vehicle_slug: row.vehicle_slug,
      created_at: row.created_at,
      read: row.read,
      score: leadScore("financiamiento", row.read, row.vehicle_slug),
    })),
  ];
  return leads.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function adminMarkLeadRead(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    markLeadRead(id);
    return;
  }
  const [kind, rawId] = id.split(":");
  if ((kind !== "contact" && kind !== "financing") || !rawId) {
    throw new AdminDataError(400, "id requerido");
  }
  const table = kind === "contact" ? "contact_leads" : "financing_leads";
  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ read: true }).eq("id", rawId);
  if (error) dbError(error, "No se pudo marcar el lead");
}

export async function adminListReviews(): Promise<Review[]> {
  if (!isSupabaseConfigured()) return listAdminReviews();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) dbError(error, "No se pudieron leer las reseñas");
  return data ?? [];
}

export async function adminUpsertReview(input: Partial<Review>): Promise<Review> {
  const nombre = input.nombre?.trim() ?? "";
  const texto = input.texto?.trim() ?? "";
  if (nombre.length < 2 || texto.length < 4) {
    throw new AdminDataError(400, "Nombre y texto son requeridos");
  }
  const rating = Number(input.rating) || 5;
  if (rating < 1 || rating > 5) throw new AdminDataError(400, "La nota debe estar entre 1 y 5");

  if (!isSupabaseConfigured()) {
    return upsertReview({
      id: input.id || `rev-${Date.now()}`,
      nombre,
      ciudad: input.ciudad ?? null,
      rating,
      texto,
      published: input.published !== false,
      created_at: input.created_at || new Date().toISOString(),
    });
  }

  const supabase = await createClient();
  const row = {
    nombre: nombre.slice(0, 80),
    ciudad: input.ciudad?.trim() || null,
    rating,
    texto: texto.slice(0, 2000),
    published: input.published !== false,
  };
  const { data, error } = await supabase.from("reviews").insert(row).select("*").single();
  if (error || !data) dbError(error ?? { message: "insert vacío" }, "No se pudo publicar la reseña");
  revalidatePath("/");
  return data;
}
