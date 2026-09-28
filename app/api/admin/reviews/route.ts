import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminReviews, upsertReview } from "@/lib/admin-store";
import type { Review } from "@/types/database";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ reviews: listAdminReviews() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json()) as Partial<Review>;
  if (!body.nombre || !body.texto) {
    return NextResponse.json({ error: "Nombre y texto son requeridos" }, { status: 400 });
  }
  const review = upsertReview({
    id: body.id || `rev-${Date.now()}`,
    nombre: body.nombre,
    ciudad: body.ciudad ?? null,
    rating: Number(body.rating) || 5,
    texto: body.texto,
    published: body.published !== false,
    created_at: body.created_at || new Date().toISOString(),
  });
  return NextResponse.json({ review });
}
