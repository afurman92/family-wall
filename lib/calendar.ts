// Read-only calendar via iCal feeds (Google "secret address in iCal format",
// Outlook "publish calendar" links). No OAuth, no keys on the frame.
//
// v1 limitation: RRULE (recurring) events are shown once, at their DTSTART.
// Expansion comes later, when it actually matters.

export type CalEvent = {
  title: string;
  start: string;      // ISO
  end: string | null; // ISO
  allDay: boolean;
  location: string | null;
  calendar: string;   // which feed it came from
  recurring: boolean;
};

const TZ = process.env.HOME_TZ || "America/Toronto";

function unfold(text: string): string[] {
  // iCal folds long lines with CRLF + space/tab
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function offsetMinutes(d: Date): number {
  // Toronto offset at that instant, via Intl (no deps)
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
    const asUTC = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour === "24" ? "00" : parts.hour), Number(parts.minute), Number(parts.second)
    );
    return (asUTC - d.getTime()) / 60000;
  } catch {
    return 0;
  }
}

function parseDate(raw: string, params: string): { date: Date | null; allDay: boolean } {
  const v = raw.trim();
  if (/^\d{8}$/.test(v)) {
    const d = new Date(
      Number(v.slice(0, 4)), Number(v.slice(4, 6)) - 1, Number(v.slice(6, 8))
    );
    return { date: d, allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { date: null, allDay: false };
  const [, Y, M, D, h, mi, s, z] = m;
  const asIfUTC = Date.UTC(+Y, +M - 1, +D, +h, +mi, +s);
  if (z) return { date: new Date(asIfUTC), allDay: false };
  // No Z: the time is wall-clock in TZID (or the feed's default). Convert to a real instant.
  const guess = new Date(asIfUTC);
  const off = offsetMinutes(guess);
  return { date: new Date(asIfUTC - off * 60000), allDay: false };
}

function getProp(line: string): { name: string; params: string; value: string } | null {
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const semi = left.indexOf(";");
  const name = (semi < 0 ? left : left.slice(0, semi)).toUpperCase();
  const params = semi < 0 ? "" : left.slice(semi + 1);
  return { name, params, value };
}

function decode(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

export function parseICS(text: string, calendar: string): CalEvent[] {
  const out: CalEvent[] = [];
  let cur: any = null;

  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      cur = { title: "", start: null, end: null, allDay: false, location: null, recurring: false };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur && cur.start) {
        out.push({
          title: cur.title || "(untitled)",
          start: cur.start.toISOString(),
          end: cur.end ? cur.end.toISOString() : null,
          allDay: cur.allDay,
          location: cur.location,
          calendar,
          recurring: cur.recurring,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const p = getProp(line);
    if (!p) continue;
    switch (p.name) {
      case "SUMMARY":
        cur.title = decode(p.value);
        break;
      case "LOCATION":
        cur.location = decode(p.value) || null;
        break;
      case "RRULE":
        cur.recurring = true;
        break;
      case "DTSTART": {
        const r = parseDate(p.value, p.params);
        cur.start = r.date;
        cur.allDay = r.allDay;
        break;
      }
      case "DTEND": {
        const r = parseDate(p.value, p.params);
        cur.end = r.date;
        break;
      }
    }
  }
  return out;
}

function feeds(): { url: string; name: string }[] {
  const specs = [
    { env: "GOOGLE_ICAL_URL", name: "Familia" },
    { env: "GOOGLE_ICAL_URL_2", name: "Alex personal" },
    { env: "GOOGLE_ICAL_URL_3", name: "Jordan personal" },
    { env: "OUTLOOK_ICAL_URL", name: "Alex laboral" },
    { env: "OUTLOOK_ICAL_URL_2", name: "Jordan laboral" },
  ];
  const out: { url: string; name: string }[] = [];
  for (const s of specs) {
    const v = process.env[s.env];
    if (!v) continue;
    for (const url of v.split(",").map((x) => x.trim()).filter(Boolean)) {
      out.push({ url, name: s.name });
    }
  }
  return out;
}

export async function getEvents(limit = 8, days = 14, backDays = 0): Promise<{
  events: CalEvent[];
  configured: boolean;
  feeds: string[];
  errors: { calendar: string; error: string }[];
}> {
  const list = feeds();
  const errors: { calendar: string; error: string }[] = [];
  const names = list.map((f) => f.name);
  if (list.length === 0) return { events: [], configured: false, feeds: [], errors };

  const now = Date.now();
  const horizon = now + days * 864e5;
  const all: CalEvent[] = [];

  await Promise.all(
    list.map(async (f) => {
      try {
        const url = f.url.replace(/^webcal:\/\//i, "https://");
        const res = await fetch(url, { next: { revalidate: 300 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        all.push(...parseICS(text, f.name));
      } catch (e: any) {
        errors.push({ calendar: f.name, error: String(e?.message || e).slice(0, 120) });
      }
    })
  );

  const events = all
    .filter((e) => {
      const t = Date.parse(e.start);
      return t >= now - Math.max(12 * 36e5, backDays * 864e5) && t <= horizon;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, limit);

  return { events, configured: true, feeds: names, errors };
}
