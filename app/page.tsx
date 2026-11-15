import Link from "next/link";
import { getWeather } from "../lib/weather";
import { getEvents } from "../lib/calendar";
import { ensureSchema, listDocuments } from "../lib/db";
import ItemsPanel from "../components/ItemsPanel";
import DocumentsPanel from "../components/DocumentsPanel";
import Shell from "../components/Shell";
import WeekStrip from "../components/WeekStrip";
import { calendarMeta } from "../lib/people";

export const dynamic = "force-dynamic";

const TZ = process.env.HOME_TZ || "America/Toronto";

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function timeOf(d: Date, allDay: boolean): string {
  if (allDay) return "All day";
  return d.toLocaleTimeString("en-CA", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function Home() {
  const [weather, cal] = await Promise.all([getWeather(), getEvents(80, 14)]);
  await ensureSchema();
  const docs = await listDocuments();

  const now = new Date();
  const todayKey = dayKey(now);
  const todays = cal.events.filter((e) => dayKey(new Date(e.start)) === todayKey);

  const upcoming = cal.events.filter((e) => dayKey(new Date(e.start)) !== todayKey);

  // Group by day so a day with five entries reads as one day.
  const upGroups: { label: string; events: typeof upcoming }[] = [];
  for (const e of upcoming) {
    const label = new Date(e.start).toLocaleDateString("en-CA", {
      timeZone: TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const last = upGroups[upGroups.length - 1];
    if (last && last.label === label) last.events.push(e);
    else upGroups.push({ label, events: [e] });
  }

  // The sidebar is for the family's life, not for anonymous work blocks: keep
  // days that have at least one named event, and mention the busy ones inline.
  const named = upGroups
    .map((g) => ({
      label: g.label,
      real: g.events.filter((e) => e.title.trim().toLowerCase() !== "busy"),
      busy: g.events.filter((e) => e.title.trim().toLowerCase() === "busy").length,
    }))
    .filter((g) => g.real.length > 0)
    .slice(0, 5);

  const busyTotal = cal.events.filter((e) => e.title.trim().toLowerCase() === "busy").length;

  const dateLine = now.toLocaleDateString("en-CA", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="shell">
      <Shell active="today" dateLine={dateLine} />

      <section className="hero">
        <div className="hero-date">
          <span className="dnum">{now.toLocaleDateString("en-CA", { timeZone: TZ, day: "numeric" })}</span>
          <span className="stack">
            <span className="dow">{now.toLocaleDateString("en-CA", { timeZone: TZ, weekday: "long" })}</span>
            <span className="mon">
              {now.toLocaleDateString("en-CA", { timeZone: TZ, month: "long", year: "numeric" })}
            </span>
          </span>
        </div>

        <div className="hero-weather">
          <div className="temp">{weather.tempC != null ? `${Math.round(weather.tempC)}°` : "—"}</div>
          <div>
            <div className="cond">
              {weather.emoji} {weather.label}
            </div>
            {weather.highC != null && (
              <div className="hi">
                H {Math.round(weather.highC)}° · L {Math.round(weather.lowC ?? 0)}°
                {weather.precipChance != null ? ` · ${weather.precipChance}% rain` : ""}
              </div>
            )}
          </div>
        </div>

        <div className="hero-agenda">
          {todays.length > 0 ? (
            todays.map((e, i) => (
              <div className="agenda-row" key={i}>
                <span className="t">{timeOf(new Date(e.start), !!e.allDay)}</span>
                <span className="evt">
                  {e.title}
                  {e.location ? <span className="muted"> · {e.location}</span> : null}
                </span>
              </div>
            ))
          ) : (
            <div className="agenda-empty">
              {cal.configured ? "Nothing scheduled today." : "No calendars connected yet."}
            </div>
          )}
        </div>
      </section>

      <div className="cols">
        <div className="col">
          <div className="block" style={{ padding: "14px 16px 10px", marginBottom: 24 }}>
            <div className="sechead">
              <h2>This week</h2>
              <Link className="action" href="/calendar">
                Open calendar
              </Link>
            </div>
            <WeekStrip events={cal.events} />
          </div>

          <ItemsPanel kinds={["task"]} />
        </div>

        <aside className="side">
          {(named.length > 0 || busyTotal > 0) && (
            <section className="block">
              <div className="sechead">
                <h2>Coming up</h2>
                <Link className="action" href="/calendar">
                  All
                </Link>
              </div>
              {named.length === 0 && (
                <p className="empty" style={{ padding: "2px 0 6px" }}>
                  Nothing on the family calendar.
                </p>
              )}
              {named.map((g) => (
                <div key={g.label} style={{ marginBottom: 12 }}>
                  <div className="meta" style={{ marginBottom: 2 }}>
                    {g.label}
                  </div>
                  {g.real.map((e, i) => (
                    <div className="agenda-row" key={i} style={{ padding: "5px 0" }}>
                      <span className="t" style={{ flexBasis: 68 }}>
                        {timeOf(new Date(e.start), !!e.allDay)}
                      </span>
                      <span className="evt" style={{ fontSize: 14.5 }}>
                        <i className="lg-dot" style={{ background: calendarMeta(e.calendar).colour }} />
                        {e.title}
                      </span>
                    </div>
                  ))}
                  {g.busy > 0 && (
                    <div className="meta" style={{ marginTop: 3 }}>
                      + {g.busy} work block{g.busy > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              ))}
              {named.length === 0 && busyTotal > 0 && (
                <div className="meta">{busyTotal} work blocks in the next two weeks</div>
              )}
            </section>
          )}

          <section className="block">
            <ItemsPanel kinds={["shop", "note"]} />
          </section>

          {docs.length > 0 && <DocumentsPanel docs={docs} />}


          {cal.errors.map((e, i) => (
            <div className="err" key={i}>
              {e.calendar}: {e.error}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
