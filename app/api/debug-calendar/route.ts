import { NextResponse } from "next/server";
import { parseICS } from "../../../lib/calendar";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic: reports why the calendar feed yields no events,
// without ever echoing the feed URL or the token. Token-gated.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.FRAME_TOKEN;
  if (!expected || url.searchParams.get("token") !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const feeds = [
    { env: "GOOGLE_ICAL_URL", name: "Familia" },
    { env: "GOOGLE_ICAL_URL_2", name: "Alex personal" },
    { env: "GOOGLE_ICAL_URL_3", name: "Jordan personal" },
    { env: "OUTLOOK_ICAL_URL", name: "Alex laboral" },
    { env: "OUTLOOK_ICAL_URL_2", name: "Jordan laboral" },
  ];

  const out: any[] = [];

  for (const f of feeds) {
    const raw = process.env[f.env];
    if (!raw) {
      out.push({ feed: f.name, env: f.env, present: false });
      continue;
    }
    const target = raw.replace(/^webcal:\/\//i, "https://");
    const entry: any = {
      feed: f.name,
      env: f.env,
      present: true,
      host: (() => {
        try { return new URL(target).host; } catch { return "invalid"; }
      })(),
      count: (raw.match(/,/g) || []).length + 1,
    };

    try {
      const res = await fetch(target, { next: { revalidate: 0 } });
      entry.status = res.status;
      entry.contentType = res.headers.get("content-type");
      const text = await res.text();
      entry.bytes = text.length;
      entry.vevents = (text.match(/BEGIN:VEVENT/g) || []).length;

      const parsed = parseICS(text, f.name);
      entry.parsed = parsed.length;

      const dates = parsed
        .map((e) => Date.parse(e.start))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);

      if (dates.length) {
        entry.first = new Date(dates[0]).toISOString();
        entry.last = new Date(dates[dates.length - 1]).toISOString();
      }
      entry.invalidDates = parsed.length - dates.length;

      const now = Date.now();
      entry.within14d = dates.filter((t) => t >= now - 12 * 36e5 && t <= now + 14 * 864e5).length;
      entry.sample = parsed.slice(0, 3).map((e) => ({ start: e.start, title: e.title.slice(0, 40) }));
      entry.rawHead = text.slice(0, 120).replace(/\r?\n/g, " | ");
    } catch (e: any) {
      entry.error = String(e?.message || e).slice(0, 160);
    }
    out.push(entry);
  }

  return NextResponse.json({ now: new Date().toISOString(), feeds: out }, {
    headers: { "Cache-Control": "no-store" },
  });
}
