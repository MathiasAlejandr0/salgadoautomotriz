import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { ensureAdminVehicles, listAdminVehicles, upsertAdminVehicle, type AdminVehicle, type StockStatus } from "@/lib/admin-store";
import { slugify } from "@/lib/utils";

const STATUSES: StockStatus[] = ["Disponible", "En reserva", "Vendido", "Borrador"];

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  await ensureAdminVehicles();
  return NextResponse.json({ vehicles: listAdminVehicles() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  await ensureAdminVehicles();

  const body = (await req.json()) as Partial<AdminVehicle>;
  const brand = String(body.brand ?? "").trim();
  const model = String(body.model ?? "").trim();
  const year = Number(body.year);
  const price = Number(body.price);
  if (!brand || !model || !year || !price) {
    return NextResponse.json({ error: "Marca, modelo, año y precio son requeridos" }, { status: 400 });
  }

  const status = STATUSES.includes(body.status as StockStatus)
    ? (body.status as StockStatus)
    : "Disponible";
  const slug = body.slug?.trim() || slugify(`${brand}-${model}-${year}-${Date.now().toString().slice(-4)}`);
  const now = new Date().toISOString();

  const vehicle = upsertAdminVehicle({
    id: body.id || `veh-${Date.now()}`,
    slug,
    brand,
    model,
    year,
    version: body.version ?? null,
    category: body.category || "SUV",
    fuel: body.fuel ?? "Bencina",
    transmission: body.transmission ?? "Automática",
    mileage: body.mileage ?? null,
    color: body.color ?? null,
    doors: body.doors ?? 4,
    engine: body.engine ?? null,
    price,
    description: body.description ?? null,
    plate: body.plate ?? null,
    stock_id: body.stock_id ?? null,
    location: body.location ?? null,
    origin: body.origin ?? null,
    published: status === "Disponible" || status === "En reserva",
    featured: Boolean(body.featured),
    created_at: body.created_at || now,
    updated_at: now,
    vehicle_images: body.vehicle_images ?? [],
    status,
    image: body.image || "",
  });

  return NextResponse.json({ vehicle });
}
