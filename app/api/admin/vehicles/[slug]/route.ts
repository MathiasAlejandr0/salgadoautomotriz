import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteAdminVehicle, ensureAdminVehicles, patchAdminVehicle, type StockStatus } from "@/lib/admin-store";

type Ctx = { params: Promise<{ slug: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  await ensureAdminVehicles();
  const { slug } = await ctx.params;
  const body = (await req.json()) as { status?: StockStatus } & Record<string, unknown>;
  const vehicle = patchAdminVehicle(slug, body);
  if (!vehicle) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ vehicle });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  await ensureAdminVehicles();
  const { slug } = await ctx.params;
  if (!deleteAdminVehicle(slug)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
