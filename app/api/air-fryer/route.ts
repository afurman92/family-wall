import { NextResponse } from "next/server";
import { AIR_FRYER_MODES, createAirFryer, ensureSchema, listAirFryer } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const rows = await listAirFryer();
  return NextResponse.json(
    { rows, count: rows.length },
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

  const ingredient = typeof body?.ingredient === "string" ? body.ingredient.trim() : "";
  if (!ingredient) return NextResponse.json({ error: "ingredient is required" }, { status: 400 });
  if (ingredient.length > 120) {
    return NextResponse.json({ error: "ingredient too long (max 120)" }, { status: 400 });
  }

  const int = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  const servings = int(body?.servings) ?? 2;
  const minutes = int(body?.minutes);
  const temp_f = int(body?.temp_f);
  const note = typeof body?.note === "string" && body.note.trim()
    ? body.note.trim().slice(0, 200)
    : null;

  const modeRaw = typeof body?.mode === "string" ? body.mode.trim() : "";
  const mode = modeRaw || null;
  if (mode && !(AIR_FRYER_MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  }

  if (servings < 1 || servings > 12) {
    return NextResponse.json({ error: "servings must be between 1 and 12" }, { status: 400 });
  }
  if (minutes !== null && (minutes < 0 || minutes > 600)) {
    return NextResponse.json({ error: "minutes must be between 0 and 600" }, { status: 400 });
  }
  if (temp_f !== null && (temp_f < 0 || temp_f > 600)) {
    return NextResponse.json({ error: "temp_f must be between 0 and 600" }, { status: 400 });
  }

  const row = await createAirFryer({ ingredient, servings, minutes, temp_f, mode, note });
  return NextResponse.json({ row }, { status: 201 });
}
