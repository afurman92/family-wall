import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { PEOPLE } from "../../../lib/people";
import {
  ensureSchema,
  isTrashTable,
  listTrash,
  purgeExpired,
  purgeRow,
  restoreRow,
  TRASH_DAYS,
} from "../../../lib/db";

export const dynamic = "force-dynamic";

// What a delete leaves behind. Anyone with a member key can look and restore;
// emptying it for good is for the two humans — an agent key cannot purge.
const HUMANS = new Set(PEOPLE.map((p) => p.id));

export async function GET(req: Request) {
  if (!req.headers.get("x-member")) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });
  const swept = await purgeExpired();
  const rows = await listTrash();
  return NextResponse.json(
    { rows, count: rows.length, days: TRASH_DAYS, swept },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const member = req.headers.get("x-member");
  if (!member) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const table = String(body?.table || "");
  const id = Number(body?.id);
  const action = String(body?.action || "");
  if (!isTrashTable(table) || !Number.isInteger(id)) {
    return NextResponse.json({ error: "table and id are required" }, { status: 400 });
  }

  if (action === "restore") {
    const ok = await restoreRow(table, id);
    return ok ? NextResponse.json({ restored: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (action === "purge") {
    if (!HUMANS.has(member)) {
      return NextResponse.json(
        { error: "only a person can empty the trash; agents may restore, not destroy" },
        { status: 403 }
      );
    }
    let file: string | null = null;
    if (table === "documents") {
      const { db } = await import("../../../lib/db");
      const p = db();
      const r = await p!.query(`SELECT file_url FROM documents WHERE id = $1`, [id]);
      file = r.rows[0]?.file_url ?? null;
    }
    const ok = await purgeRow(table, id);
    if (ok && file) {
      try {
        await del(file);
      } catch (e) {
        console.warn("[trash] blob kept", e instanceof Error ? e.message : e);
      }
    }
    return ok ? NextResponse.json({ purged: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ error: 'action must be "restore" or "purge"' }, { status: 400 });
}
