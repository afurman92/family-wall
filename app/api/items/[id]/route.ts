import { NextResponse } from "next/server";
import { deleteItem, ensureSchema, updateItem } from "../../../../lib/db";

export const dynamic = "force-dynamic";

function member(req: Request): string | null {
  return req.headers.get("x-member");
}

function idFrom(params: { id: string }): number | null {
  const n = Number(params.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function guard(req: Request) {
  const who = member(req);
  if (!who) return NextResponse.json({ error: "authentication required" }, { status: 401 });
  return null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = guard(req);
  if (denied) return denied;
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const item = await updateItem(id, {
    done: typeof body?.done === "boolean" ? body.done : undefined,
    title: typeof body?.title === "string" ? body.title.trim().slice(0, 200) : undefined,
    detail: typeof body?.detail === "string" ? body.detail.slice(0, 2000) : undefined,
  });

  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const denied = guard(req);
  if (denied) return denied;
  const id = idFrom(params);
  if (!id) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const ok = await deleteItem(id, req.headers.get("x-member"));
  return ok
    ? NextResponse.json({ deleted: id })
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
