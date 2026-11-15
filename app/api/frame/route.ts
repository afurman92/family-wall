import { NextResponse } from "next/server";
import { getWeather } from "../../../lib/weather";
import { expiringDocuments, listChores } from "../../../lib/db";
import { getEvents } from "../../../lib/calendar";

export const dynamic = "force-dynamic";

// Read-only JSON for the frame. Same auth model as the frame page:
// the caller must know FRAME_TOKEN. No writes, no keys, no PII beyond the display data.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expected = process.env.FRAME_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [weather, cal, chores, docAlerts] = await Promise.all([
    getWeather(),
    getEvents(8, 14),
    listChores(),
    expiringDocuments(120),
  ]);

  // Optional family slot overrides: FAMILY_PEOPLE=[{"id":"alex","name":"Alejandro",...}]
  let people: unknown = null;
  if (process.env.FAMILY_PEOPLE) {
    try {
      const parsed = JSON.parse(process.env.FAMILY_PEOPLE);
      if (Array.isArray(parsed)) people = parsed;
    } catch {
      /* ignore malformed config */
    }
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      people,
      weather,
      calendar: cal,
      docAlerts,
      chores: chores.map((c) => ({
        id: c.id,
        title: c.title,
        who: c.who,
        routine: c.routine,
        freq: c.freq,
        done: c.done,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
