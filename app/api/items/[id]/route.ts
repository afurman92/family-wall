import { NextResponse } from "next/server";
import { isKnownPerson } from "../../../../lib/people";
import { deleteItem, ensureSchema, updateItem, isKind } from "../../../../lib/db";

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

  const allowed = new Set(["done", "title", "detail", "who", "kind", "due_at"]);
  const unknown = Object.keys(body || {}).filter((k) => !allowed.has(k));
  if (unknown.length) {
    return NextResponse.json(
      { error: `unknown fields: ${unknown.join(", ")}`, hint: `allowed: ${[...allowed].join(", ")}` },
      { status: 400 }
    );
  }

  const patch: Parameters<typeof updateItem>[1] = {
    done: typeof body?.done === "boolean" ? body.done : undefined,
    title: typeof body?.title === "string" ? body.title.trim().slice(0, 200) : undefined,
    detail: typeof body?.detail === "string" ? body.detail.slice(0, 2000) : undefined,
  };

  if ("who" in (body || {})) {
    const w = typeof body.who === "string" && body.who.trim() ? body.who.trim() : null;
    if (!isKnownPerson(w)) {
      return NextResponse.json(
        { error: `unknown person: ${w}`, hint: "use alex, jordan, maya or any" },
        { status: 400 }
      );
    }
    patch.who = w;
  }
  if ("kind" in (body || {})) {
    if (!isKind(body.kind)) {
      return NextResponse.json({ error: "kind must be task, note, event or shop" }, { status: 400 });
    }
    patch.kind = body.kind;
  }
  if ("due_at" in (body || {})) {
    if (body.due_at === null || body.due_at === "") {
      patch.due_at = null;
    } else {
      const d = new Date(body.due_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "due_at is not a valid date" }, { status: 400 });
      }
      patch.due_at = d.toISOString();
    }
  }

  const item = await updateItem(id, patch);

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
