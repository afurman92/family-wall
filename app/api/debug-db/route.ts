import { NextResponse } from "next/server";
import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic: which database is this deployment actually using,
// and does the table hold anything? Never echoes the connection string.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.FRAME_TOKEN;
  if (!expected || url.searchParams.get("token") !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Which env var did lib/db.ts pick?
  const candidates = Object.keys(process.env).filter(
    (k) =>
      /_(POSTGRES_URL|DATABASE_URL|POSTGRES_PRISMA_URL)$/.test(k) &&
      !/UNPOOLED|NON_POOLING|NO_SSL/.test(k)
  );
  const chosen =
    candidates.find((k) => k.endsWith("_POSTGRES_URL")) ??
    candidates.find((k) => k.endsWith("_DATABASE_URL")) ??
    candidates[0] ??
    null;

  const p = db();
  if (!p) return NextResponse.json({ error: "no database configured", candidates });

  const out: any = { chosen, candidates };

  try {
    const who = await p.query(
      `SELECT current_database() AS db,
              current_user AS usr,
              inet_server_addr()::text AS host,
              version() AS v`
    );
    out.db = who.rows[0].db;
    out.user = who.rows[0].usr;
    out.host = who.rows[0].host;
    out.version = String(who.rows[0].v).slice(0, 40);

    const tables = await p.query(
      `SELECT table_schema, table_name
         FROM information_schema.tables
        WHERE table_name IN ('items')
        ORDER BY table_schema`
    );
    out.items_tables = tables.rows;

    try {
      const c = await p.query(`SELECT count(*)::int AS n FROM items`);
      out.item_count = c.rows[0].n;
      const recent = await p.query(
        `SELECT id, kind, title, created_by, created_at FROM items ORDER BY id DESC LIMIT 5`
      );
      out.recent = recent.rows;
    } catch (e: any) {
      out.items_query_error = String(e?.message || e).slice(0, 160);
    }
  } catch (e: any) {
    out.error = String(e?.message || e).slice(0, 200);
  }

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
