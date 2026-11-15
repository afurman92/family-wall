import { NextResponse } from "next/server";
import { isKnownPerson } from "../../../lib/people";
import { createItem, ensureSchema, isKind, listItems } from "../../../lib/db";

export const dynamic = "force-dynamic";

function noDb() {
  return NextResponse.json(
    { error: "no database", hint: "set POSTGRES_URL or DATABASE_URL" },
    { status: 503 }
  );
}

function member(req: Request): string | null {
  return req.headers.get("x-member");
}

export async function GET(req: Request) {
  if (!(await ensureSchema())) return noDb();
  const url = new URL(req.url);
  const includeDone = url.searchParams.get("includeDone") === "1";
  const items = await listItems({ includeDone });
  return NextResponse.json(
    { items, count: items.length, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const who = member(req);
  if (!who) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  if (!(await ensureSchema())) return noDb();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const kind = body?.kind ?? "task";
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (kind === "event") {
    return NextResponse.json(
      {
        error: "events are not stored here",
        hint:
          "Add events to the 'Familia' Google Calendar, which is the source of truth and what the kitchen frame reads. This endpoint stores tasks, shopping and notes only.",
      },
      { status: 400 }
    );
  }

  if (!isKind(kind)) {
    return NextResponse.json({ error: "kind must be task, note or shop" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "title too long (max 200)" }, { status: 400 });
  }

  let due: string | null = null;
  if (body?.due_at) {
    const d = new Date(body.due_at);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "due_at is not a valid date" }, { status: 400 });
    }
    due = d.toISOString();
  }

  const ownerId = typeof body?.who === "string" && body.who.trim() ? body.who.trim() : null;
  if (!isKnownPerson(ownerId)) {
    return NextResponse.json(
      { error: `unknown person: ${ownerId}`, hint: "use alex, jordan, maya or any" },
      { status: 400 }
    );
  }

  const item = await createItem({
    kind,
    title,
    detail: typeof body?.detail === "string" ? body.detail.slice(0, 2000) : null,
    who: ownerId,
    due_at: due,
    created_by: who,
  });

  return NextResponse.json({ item }, { status: 201 });
}
