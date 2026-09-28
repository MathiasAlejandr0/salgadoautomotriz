import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminLeads, markLeadRead } from "@/lib/admin-store";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ leads: listAdminLeads() });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  markLeadRead(body.id);
  return NextResponse.json({ ok: true });
}
