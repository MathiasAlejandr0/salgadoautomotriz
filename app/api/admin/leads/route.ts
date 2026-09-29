import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminListLeads, adminMarkLeadRead, AdminDataError } from "@/lib/admin-data";
import { readJsonLimited } from "@/lib/abuse";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ leads: await adminListLeads() });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/leads]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJsonLimited(req, 8_000);
  if (!body.ok) return body.response;
  const id = typeof body.body === "object" && body.body && "id" in body.body ? String((body.body as { id?: unknown }).id ?? "") : "";
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await adminMarkLeadRead(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/leads]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
