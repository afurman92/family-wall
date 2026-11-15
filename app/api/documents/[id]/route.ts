import { NextResponse } from "next/server";
import { isKnownPerson } from "../../../../lib/people";
import { isoDay } from "../../../../lib/dates";
import { del } from "@vercel/blob";
import { deleteDocument, ensureSchema, getDocument, updateDocument } from "../../../../lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function idFrom(ctx: Ctx) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  const id = await idFrom(ctx);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const str = (v: unknown, max = 120) => {
    if (v === null || v === "") return null;
    return typeof v === "string" ? v.trim().slice(0, max) || null : undefined;
  };
  // undefined = the caller sent something that is not a date: answer 400
  // instead of quietly keeping the old value.
  const isoDate = (v: unknown) => isoDay(v);

  if ("issued_on" in (body || {}) && isoDate(body.issued_on) === undefined) {
    return NextResponse.json({ error: "issued_on must be a real date (YYYY-MM-DD)" }, { status: 400 });
  }
  if ("expires_on" in (body || {}) && isoDate(body.expires_on) === undefined) {
    return NextResponse.json({ error: "expires_on must be a real date (YYYY-MM-DD)" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  const put = (key: string, val: string | null | undefined) => {
    if (val !== undefined) patch[key] = val;
  };
  put("country", str(body?.country, 60));
  put("doc_type", str(body?.doc_type, 60));
  put("number", str(body?.number, 60));
  put("issued_on", isoDate(body?.issued_on));
  put("expires_on", isoDate(body?.expires_on));
  put("owner", str(body?.owner, 40));
  put("note", str(body?.note, 500));

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const document = await updateDocument(id, patch as never);
  if (!document) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ document });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const who = req.headers.get("x-member");
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  const id = await idFrom(ctx);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const gone = await deleteDocument(id, who);

  // The scan stays in Blob while the row is in the trash: deleting it here would
  // make "restore" a lie. It leaves when the row is purged for good.
  return NextResponse.json({ deleted: gone, id, trash: gone });
}
