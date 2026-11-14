import { getWeather } from "../../../lib/weather";
import { getEvents } from "../../../lib/calendar";
import Clock from "../../../components/Clock";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Frame({ params }: { params: { token: string } }) {
  const expected = process.env.FRAME_TOKEN;

  // Not configured, or wrong secret -> real 404. Don't confirm the path shape.
  if (!expected || params.token !== expected) notFound();

  const tz = process.env.HOME_TZ || "America/Toronto";
  const [weather, cal] = await Promise.all([getWeather(), getEvents(6, 14)]);

  const fmt = (iso: string, allDay: boolean) => {
    const d = new Date(iso);
    if (allDay) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, weekday: "short", month: "short", day: "numeric",
      }).format(d);
    }
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true,
    }).format(d);
  };

  return (
    <div className="wrap" style={{ width: 1280, minHeight: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Clock tz={tz} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 46 }}>{weather.emoji}</div>
          <div className="temp">{weather.tempC != null ? `${Math.round(weather.tempC)}°` : "—"}</div>
          <div className="label muted">{weather.label}</div>
          {weather.highC != null && (
            <div className="muted" style={{ fontSize: 15, marginTop: 6 }}>
              H {Math.round(weather.highC)}° · L {Math.round(weather.lowC ?? 0)}°
              {weather.precipChance != null ? ` · ${weather.precipChance}%` : ""}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 44 }} className="card">
        <div className="h2">Next up</div>
        {!cal.configured ? (
          <div className="muted">
            No calendars connected yet. Set <code>GOOGLE_ICAL_URL</code> or{" "}
            <code>OUTLOOK_ICAL_URL</code> in the project environment.
          </div>
        ) : cal.events.length === 0 ? (
          <div className="muted">Nothing on the calendar for the next two weeks.</div>
        ) : (
          <ul className="list">
            {cal.events.map((e, i) => (
              <li key={i}>
                <span className="when">{fmt(e.start, e.allDay)}</span>
                {e.title}
                {e.location ? <span className="muted"> · {e.location}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {cal.errors.map((e, i) => (
          <div className="err" key={i}>
            {e.calendar}: {e.error}
          </div>
        ))}
      </div>
    </div>
  );
}
