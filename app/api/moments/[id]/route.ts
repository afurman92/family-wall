import { NextResponse } from "next/server";
import { deleteMoment, ensureSchema, updateMoment } from "../../../../lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function guard(req: Request) {
  if (!req.headers.get("x-member")) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  return null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch: any = {};
  if (typeof body?.title === "string") patch.title = body.title.trim().slice(0, 120);
  if (typeof body?.kind === "string" && ["birthday", "anniversary", "other"].includes(body.kind)) {
    patch.kind = body.kind;
  }
  if ("month" in body) patch.month = body.month === null ? null : Number(body.month);
  if ("day" in body) patch.day = body.day === null ? null : Number(body.day);
  if ("year" in body) patch.year = body.year === null || body.year === "" ? null : Number(body.year);
  if ("note" in body) patch.note = body.note ? String(body.note).slice(0, 240) : null;
  if ("on_date" in body) patch.on_date = body.on_date || null;
  if (typeof body?.who === "string") patch.who = body.who.slice(0, 40);

  const moment = await updateMoment(id, patch);
  if (!moment) return NextResponse.json({ error: "not found or nothing to change" }, { status: 404 });
  return NextResponse.json({ moment });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });
  const ok = await deleteMoment(id, req.headers.get("x-member"));
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
