import { NextResponse } from "next/server";
import { getWeather } from "../../../lib/weather";
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

  const [weather, cal] = await Promise.all([getWeather(), getEvents(8, 14)]);

  // Optional family slot overrides: FAMILY_PEOPLE=[{"id":"alex","name":"Alex",...}]
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
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
