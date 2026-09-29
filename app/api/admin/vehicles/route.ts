import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminCreateVehicle, adminListVehicles, AdminDataError } from "@/lib/admin-data";
import { readJsonLimited } from "@/lib/abuse";
import type { AdminVehicle } from "@/lib/admin-store";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ vehicles: await adminListVehicles() });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/vehicles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJsonLimited(req, 1_000_000);
  if (!body.ok) return body.response;
  try {
    const vehicle = await adminCreateVehicle(body.body as Partial<AdminVehicle>);
    return NextResponse.json({ vehicle });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/vehicles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
