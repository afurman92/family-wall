import { NextResponse } from "next/server";
import { isKnownPerson } from "../../../lib/people";
import { isoDay, realMonthDay } from "../../../lib/dates";
import { createMoment, ensureSchema, listMoments, upcomingMoments } from "../../../lib/db";

export const dynamic = "force-dynamic";

const KINDS = ["birthday", "anniversary", "other"];

function int(v: any, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export async function GET(req: Request) {
  if (!(await ensureSchema())) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const url = new URL(req.url);
  const within = url.searchParams.get("within");
  if (within) {
    const days = int(within, 1, 365);
    if (days === null) return NextResponse.json({ error: "within must be 1-365" }, { status: 400 });
    const moments = await upcomingMoments(days);
    return NextResponse.json(
      { moments, count: moments.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  const moments = await listMoments();
  return NextResponse.json({ moments, count: moments.length }, { headers: { "Cache-Control": "no-store" } });
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

  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const kindRaw = body?.kind === undefined ? "birthday" : body.kind;
  if (typeof kindRaw !== "string" || !KINDS.includes(kindRaw)) {
    return NextResponse.json(
      { error: `kind must be one of ${KINDS.join(", ")}` },
      { status: 400 }
    );
  }
  const kind = kindRaw;

  // Yearly dates (birthday, anniversary) take month + day; a one-off date takes
  // a full date. Sending both is a mistake worth reporting, not guessing past.
  const month = body?.month !== undefined && body?.month !== null ? int(body.month, 1, 12) : null;
  const day = body?.day !== undefined && body?.day !== null ? int(body.day, 1, 31) : null;
  const onDate = typeof body?.on_date === "string" && body.on_date ? body.on_date.slice(0, 10) : null;
  // Optional year of birth / of the first anniversary. Only meaningful for
  // dates that repeat; it is what lets the wall say "turns 35".
  const nowYear = new Date().getFullYear();
  const year =
    body?.year !== undefined && body?.year !== null && body?.year !== ""
      ? int(body.year, 1900, nowYear)
      : null;
  if (body?.year !== undefined && body?.year !== null && body?.year !== "" && year === null) {
    return NextResponse.json({ error: `year must be 1900-${nowYear}` }, { status: 400 });
  }
  if (year !== null && onDate) {
    return NextResponse.json({ error: "a year only makes sense for a date that repeats" }, { status: 400 });
  }

  if (onDate && (month !== null || day !== null)) {
    return NextResponse.json(
      { error: "send either month/day (repeats yearly) or on_date (one-off), not both" },
      { status: 400 }
    );
  }
  if (!onDate && (month === null || day === null)) {
    return NextResponse.json(
      { error: "month and day are required for a date that repeats yearly" },
      { status: 400 }
    );
  }
  if (onDate && isoDay(onDate) === undefined) {
    return NextResponse.json({ error: "on_date must be a real date (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!onDate && month !== null && day !== null && !realMonthDay(month, day)) {
    return NextResponse.json(
      { error: `${day}/${month} does not exist; check the month and the day` },
      { status: 400 }
    );
  }

  const moment = await createMoment({
    title,
    kind,
    month,
    day,
    on_date: onDate,
    year,
    note: typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 240) : null,
    who: (() => {
      const w = typeof body?.who === "string" ? body.who.slice(0, 40) : "any";
      return isKnownPerson(w) ? w : "any";
    })(),
    created_by: who,
  });
  return NextResponse.json({ moment }, { status: 201 });
}
