import { NextResponse } from "next/server";
import { isKnownPerson } from "../../../../lib/people";
import { isoDay, realMonthDay } from "../../../../lib/dates";
import { deleteMoment, ensureSchema, updateMoment, getMoment } from "../../../../lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function guard(req: Request) {
  if (!req.headers.get("x-member")) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  return null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const KINDS = ["birthday", "anniversary", "other"];
  const num = (v: unknown, lo: number, hi: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  };

  const patch: any = {};

  if ("title" in (body || {})) {
    const t = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    patch.title = t;
  }
  if ("kind" in (body || {})) {
    if (!KINDS.includes(body.kind)) {
      return NextResponse.json({ error: `kind must be one of ${KINDS.join(", ")}` }, { status: 400 });
    }
    patch.kind = body.kind;
  }
  if ("month" in (body || {})) {
    if (body.month === null) patch.month = null;
    else {
      const m = num(body.month, 1, 12);
      if (m === null) return NextResponse.json({ error: "month must be 1-12" }, { status: 400 });
      patch.month = m;
    }
  }
  if ("day" in (body || {})) {
    if (body.day === null) patch.day = null;
    else {
      const d = num(body.day, 1, 31);
      if (d === null) return NextResponse.json({ error: "day must be 1-31" }, { status: 400 });
      patch.day = d;
    }
  }
  if ("year" in (body || {})) {
    if (body.year === null || body.year === "") patch.year = null;
    else {
      const y = num(body.year, 1900, new Date().getFullYear());
      if (y === null) {
        return NextResponse.json({ error: `year must be 1900-${new Date().getFullYear()}` }, { status: 400 });
      }
      patch.year = y;
    }
  }
  if ("on_date" in (body || {})) {
    if (body.on_date === null || body.on_date === "") patch.on_date = null;
    else {
      const d = isoDay(body.on_date);
      if (d === undefined) {
        return NextResponse.json({ error: "on_date must be a real date (YYYY-MM-DD)" }, { status: 400 });
      }
      patch.on_date = d;
    }
  }
  if ("note" in (body || {})) patch.note = body.note ? String(body.note).slice(0, 240) : null;
  if (typeof body?.who === "string") {
    const w = body.who.slice(0, 40);
    if (!isKnownPerson(w)) {
      return NextResponse.json({ error: `unknown person: ${w}`, hint: "use alex, jordan, maya or any" }, { status: 400 });
    }
    patch.who = w;
  }

  // The row as it will be after this patch has to be a coherent shape: either a
  // yearly date (month + day, never Feb 31) or a single real date.
  const current = await getMoment(id);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  const fMonth = "month" in patch ? patch.month : current.month;
  const fDay = "day" in patch ? patch.day : current.day;
  const fDate = "on_date" in patch ? patch.on_date : current.on_date;
  if (fDate != null && (fMonth != null || fDay != null)) {
    return NextResponse.json(
      { error: "send either month/day (repeats yearly) or on_date (one-off), not both" },
      { status: 400 }
    );
  }
  if (fDate == null && (fMonth == null || fDay == null)) {
    return NextResponse.json({ error: "a yearly date needs both month and day" }, { status: 400 });
  }
  if (fDate == null && !realMonthDay(fMonth, fDay)) {
    return NextResponse.json({ error: `${fDay}/${fMonth} does not exist; check the month and the day` }, { status: 400 });
  }

  const moment = await updateMoment(id, patch);
  if (!moment) return NextResponse.json({ error: "not found or nothing to change" }, { status: 404 });
  return NextResponse.json({ moment });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!(await ensureSchema())) return NextResponse.json({ error: "no database" }, { status: 503 });
  const ok = await deleteMoment(id, req.headers.get("x-member"));
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
