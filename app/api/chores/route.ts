import { NextResponse } from "next/server";
import { createChore, ensureSchema, listChores } from "../../../lib/db";
import { ANY, PEOPLE } from "../../../lib/people";

export const dynamic = "force-dynamic";

const WHO = [...PEOPLE.map((p) => p.id), ANY.id];
const ROUTINES = ["morning", "after", "evening", "any"];
const FREQS = ["daily", "weekly", "biweekly", "monthly"];

export async function GET() {
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });
  const chores = await listChores();
  return NextResponse.json(
    { chores, count: chores.length, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  if (body?.who != null && !WHO.includes(body.who)) {
    return NextResponse.json({ error: "unknown person" }, { status: 400 });
  }
  if (body?.routine != null && !ROUTINES.includes(body.routine)) {
    return NextResponse.json({ error: "unknown routine" }, { status: 400 });
  }
  if (body?.freq != null && !FREQS.includes(body.freq)) {
    return NextResponse.json({ error: "unknown frequency" }, { status: 400 });
  }

  const chore = await createChore({
    title,
    who: body?.who ?? null,
    routine: body?.routine ?? null,
    freq: body?.freq ?? null,
    emoji: typeof body?.emoji === "string" ? body.emoji.slice(0, 4) : null,
    created_by: who,
  });

  return NextResponse.json({ chore }, { status: 201 });
}
