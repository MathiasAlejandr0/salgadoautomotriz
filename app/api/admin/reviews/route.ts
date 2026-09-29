import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminListReviews, adminUpsertReview, AdminDataError } from "@/lib/admin-data";
import { readJsonLimited } from "@/lib/abuse";
import type { Review } from "@/types/database";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ reviews: await adminListReviews() });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/reviews]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJsonLimited(req, 32_000);
  if (!body.ok) return body.response;
  try {
    const review = await adminUpsertReview(body.body as Partial<Review>);
    return NextResponse.json({ review });
  } catch (err) {
    if (err instanceof AdminDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/reviews]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
