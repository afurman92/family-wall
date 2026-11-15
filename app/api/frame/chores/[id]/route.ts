import { NextResponse } from "next/server";
import { ensureSchema, listChores, setChoreDone } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// The wall may only tick a chore. The token reaches here as `x-frame`, set by
// middleware after it checked the token against the same path and method.
export async function POST(req: Request, ctx: Ctx) {
  if (req.headers.get("x-frame") !== "1") {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body?.done !== "boolean") {
    return NextResponse.json({ error: "done must be true or false" }, { status: 400 });
  }

  const ok = await setChoreDone(id, body.done);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });

  const chores = await listChores();
  const chore = chores.find((c) => Number(c.id) === id) ?? null;
  return NextResponse.json({ ok, chore }, { headers: { "Cache-Control": "no-store" } });
}
