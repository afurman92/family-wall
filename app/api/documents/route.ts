import { NextResponse } from "next/server";
import { isoDay } from "../../../lib/dates";
import { isKnownPerson } from "../../../lib/people";
import { createDocument, ensureSchema, listDocuments, updateDocument } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const documents = await listDocuments();
  return NextResponse.json(
    { documents, count: documents.length },
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

  const str = (v: unknown, max = 120) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  // undefined means "I could not read that", which is an error, not an empty field.
  const isoDate = (v: unknown) => isoDay(v);

  if (isoDate(body?.issued_on) === undefined) {
    return NextResponse.json({ error: "issued_on must be a real date (YYYY-MM-DD)" }, { status: 400 });
  }
  if (isoDate(body?.expires_on) === undefined) {
    return NextResponse.json({ error: "expires_on must be a real date (YYYY-MM-DD)" }, { status: 400 });
  }

  if (!str(body?.country) && !str(body?.doc_type)) {
    return NextResponse.json(
      { error: "at least a country or a doc_type is required" },
      { status: 400 }
    );
  }

  const doc = await createDocument({
    country: str(body?.country, 60),
    doc_type: str(body?.doc_type, 60),
    number: str(body?.number, 60),
    issued_on: isoDate(body?.issued_on),
    expires_on: isoDate(body?.expires_on),
    owner: (() => {
      const o = str(body?.owner, 40) || who;
      return isKnownPerson(o) ? o : who;
    })(),
    file_url: str(body?.file_url, 500),
    note: str(body?.note, 500),
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}

export async function PATCH(req: Request) {
  const who = req.headers.get("x-member") || req.headers.get("x-member-name");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" ? (v.trim() ? v.trim().slice(0, max) : null) : undefined;
  const isoDate = (v: unknown) => {
    if (v === null) return null;
    if (typeof v !== "string" || !v.trim()) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  };

  const patch: Record<string, unknown> = {};
  if ("country" in body) patch.country = str(body.country, 60) ?? null;
  if ("doc_type" in body) patch.doc_type = str(body.doc_type, 60) ?? null;
  if ("number" in body) patch.number = str(body.number, 60) ?? null;
  if ("owner" in body) patch.owner = str(body.owner, 40) ?? null;
  if ("file_url" in body) patch.file_url = str(body.file_url, 500) ?? null;
  if ("note" in body) patch.note = str(body.note, 500) ?? null;
  if ("issued_on" in body) {
    const d = isoDate(body.issued_on);
    if (d !== undefined) patch.issued_on = d;
  }
  if ("expires_on" in body) {
    const d = isoDate(body.expires_on);
    if (d !== undefined) patch.expires_on = d;
  }

  const doc = await updateDocument(id, patch as any);
  if (!doc) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  return NextResponse.json({ document: doc });
}
