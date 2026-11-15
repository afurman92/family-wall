import { NextResponse } from "next/server";
import { db, ensureSchema } from "../../../lib/db";

export const dynamic = "force-dynamic";

// Full JSON dump of the household data. Two uses, one endpoint: the nightly
// backup, and the "leave whenever you want" button.
//
// Scans are NOT included — the documents table carries the blob path, but the
// bytes stay in the private Blob store. A backup of this file plus the blob
// store is a complete backup.
const TABLES = ["items", "chores", "documents", "moments", "recipes", "air_fryer"] as const;

export async function GET() {
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const p = db();
  if (!p) return NextResponse.json({ error: "no database" }, { status: 503 });

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  // SELECT * on purpose: a column added later must not silently drop out of the
  // backup because someone forgot to update a list here.
  for (const table of TABLES) {
    try {
      const { rows } = await p.query(`SELECT * FROM ${table} ORDER BY id`);
      data[table] = rows;
      counts[table] = rows.length;
    } catch {
      // A table that does not exist yet (fresh install) is not a failure.
      data[table] = [];
      counts[table] = 0;
    }
  }

  const stamp = new Date().toISOString();
  const day = stamp.slice(0, 10);

  return NextResponse.json(
    {
      app: "family-wall",
      version: 1,
      exported_at: stamp,
      counts,
      data,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="family-wall-${day}.json"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
