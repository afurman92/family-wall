import { NextResponse } from "next/server";
import { createPlant, ensureSchema, listPlants, updatePlant } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const plants = await listPlants();
  return NextResponse.json(
    { plants, count: plants.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const plant = await createPlant({
    name,
    location: str(body?.location, 120),
    care: str(body?.care, 4000),
    image_url: str(body?.image_url, 600),
  });
  return NextResponse.json({ plant }, { status: 201 });
}

export async function PATCH(req: Request) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" ? (v.trim() ? v.trim().slice(0, max) : null) : undefined;

  const patch: { name?: string | null; location?: string | null; care?: string | null; image_url?: string | null } = {};
  if ("name" in body) {
    const n = str(body.name, 120);
    if (n === null) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    patch.name = n;
  }
  if ("location" in body) patch.location = str(body.location, 120) ?? null;
  if ("care" in body) patch.care = str(body.care, 4000) ?? null;
  if ("image_url" in body) patch.image_url = str(body.image_url, 600) ?? null;

  const plant = await updatePlant(id, patch);
  if (!plant) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  return NextResponse.json({ plant });
}
