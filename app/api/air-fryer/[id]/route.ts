import { NextResponse } from "next/server";
import { AIR_FRYER_MODES, deleteAirFryer, ensureSchema, updateAirFryer } from "../../../../lib/db";

export const dynamic = "force-dynamic";

async function guard(req: Request) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });
  return null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const bad = await guard(req);
  if (bad) return bad;

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("ingredient" in body) {
    const v = typeof body.ingredient === "string" ? body.ingredient.trim().slice(0, 120) : "";
    if (!v) return NextResponse.json({ error: "ingredient cannot be empty" }, { status: 400 });
    patch.ingredient = v;
  }
  const int = (v: unknown) => {
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : undefined;
  };
  if ("servings" in body) {
    const n = int(body.servings);
    if (n === undefined || n === null || n < 1 || n > 12) {
      return NextResponse.json({ error: "servings must be between 1 and 12" }, { status: 400 });
    }
    patch.servings = n;
  }
  if ("minutes" in body) {
    const n = int(body.minutes);
    if (n === undefined) return NextResponse.json({ error: "invalid minutes" }, { status: 400 });
    patch.minutes = n;
  }
  if ("temp_f" in body) {
    const n = int(body.temp_f);
    if (n === undefined) return NextResponse.json({ error: "invalid temp_f" }, { status: 400 });
    patch.temp_f = n;
  }
  if ("mode" in body) {
    const v = typeof body.mode === "string" ? body.mode.trim() : "";
    if (v && !(AIR_FRYER_MODES as readonly string[]).includes(v)) {
      return NextResponse.json({ error: "unknown mode" }, { status: 400 });
    }
    patch.mode = v || null;
  }
  if ("note" in body) {
    patch.note = typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 200)
      : null;
  }

  const row = await updateAirFryer(id, patch as any);
  if (!row) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  return NextResponse.json({ row });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const bad = await guard(req);
  if (bad) return bad;

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const ok = await deleteAirFryer(id, req.headers.get("x-member"));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
