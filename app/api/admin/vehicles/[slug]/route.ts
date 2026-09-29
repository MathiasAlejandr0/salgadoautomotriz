import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminDeleteVehicle, adminUpdateVehicle, AdminDataError } from "@/lib/admin-data";
import { readJsonLimited } from "@/lib/abuse";
import type { AdminVehicle } from "@/lib/admin-store";

type Ctx = { params: Promise<{ slug: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJsonLimited(req, 1_000_000);
  if (!body.ok) return body.response;
  const { slug } = await ctx.params;
  try {
    const vehicle = await adminUpdateVehicle(slug, body.body as Partial<AdminVehicle>);
    if (!vehicle) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ vehicle });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/vehicles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { slug } = await ctx.params;
  try {
    if (!(await adminDeleteVehicle(slug))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/vehicles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
