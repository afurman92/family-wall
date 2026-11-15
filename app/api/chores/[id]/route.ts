import { NextResponse } from "next/server";
import { deleteChore, ensureSchema, updateChore } from "../../../../lib/db";
import { ANY, PEOPLE } from "../../../../lib/people";

export const dynamic = "force-dynamic";

const WHO = [...PEOPLE.map((p) => p.id), ANY.id];
const ROUTINES = ["morning", "after", "evening", "any"];
const FREQS = ["daily", "weekly", "biweekly", "monthly"];

type Ctx = { params: Promise<{ id: string }> };

async function idFrom(ctx: Ctx) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const member = req.headers.get("x-member");
  if (!member) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  const id = await idFrom(ctx);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch: { title?: string; who?: string; routine?: string; freq?: string; done?: boolean } = {};
  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (typeof body?.done === "boolean") patch.done = body.done;
  if (typeof body?.who === "string") {
    if (!WHO.includes(body.who)) return NextResponse.json({ error: "unknown person" }, { status: 400 });
    patch.who = body.who;
  }
  if (typeof body?.routine === "string") {
    if (!ROUTINES.includes(body.routine)) return NextResponse.json({ error: "unknown routine" }, { status: 400 });
    patch.routine = body.routine;
  }
  if (typeof body?.freq === "string") {
    if (!FREQS.includes(body.freq)) return NextResponse.json({ error: "unknown frequency" }, { status: 400 });
    patch.freq = body.freq;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const chore = await updateChore(id, patch);
  if (!chore) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ chore });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const member = req.headers.get("x-member");
  if (!member) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  const id = await idFrom(ctx);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const gone = await deleteChore(id, member);
  return NextResponse.json({ deleted: gone, id });
}
