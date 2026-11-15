import Link from "next/link";
import { getEvents, type CalEvent } from "../../lib/calendar";
import { calendarMeta } from "../../lib/people";
import Shell from "../../components/Shell";

export const dynamic = "force-dynamic";

const TZ = process.env.HOME_TZ || "America/Toronto";

function key(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  const m = typeof searchParams.m === "string" ? searchParams.m : "";
  if (/^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12) {
      year = y;
      month = mo - 1;
    }
  }

  const cal = await getEvents(600, 75, 60);

  const byDay = new Map<string, CalEvent[]>();
  for (const e of cal.events) {
    const k = key(new Date(e.start));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }

  // Six weeks, starting on the Monday on or before the 1st. Cells are built at
  // noon so a UTC server never lands them on the previous day in Toronto.
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 + i - offset, 12);
    cells.push({ date: d, outside: d.getMonth() !== month });
  }

  const prev = new Date(year, month - 1, 1, 12);
  const next = new Date(year, month + 1, 1, 12);
  const todayK = key(now);

  const title = first.toLocaleDateString("en-CA", { month: "long", year: "numeric" });

  // One legend row: which feed is whose. Deduped, because two of the feeds can
  // point at the same person.
  const legend: { label: string; colour: string }[] = [];
  for (const f of cal.feeds) {
    const m = calendarMeta(f);
    if (!legend.some((l) => l.label === m.label)) legend.push(m);
  }

  return (
    <div className="shell">
      <Shell active="calendar" />

      <div className="cal-head">
        <h1>{title}</h1>
        <div className="monthnav">
          <Link href={`/calendar?m=${ym(now)}`}>Today</Link>
          <Link href={`/calendar?m=${ym(prev)}`}>←</Link>
          <Link href={`/calendar?m=${ym(next)}`}>→</Link>
        </div>
      </div>

      {legend.length > 0 && (
        <div className="cal-legend">
          {legend.map((l) => (
            <span key={l.label}>
              <i className="lg-dot" style={{ background: l.colour }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      <div className="cal">
        <div className="cal-dows">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map(({ date, outside }, i) => {
            const k = key(date);
            const evs = byDay.get(k) || [];
            const shown = evs.slice(0, 3);
            const extra = evs.length - shown.length;
            return (
              <div
                key={i}
                className={
                  "cal-cell" +
                  (outside ? " is-out" : "") +
                  (k === todayK ? " is-today" : "")
                }
              >
                <span className="cal-num">{date.getDate()}</span>
                {shown.map((e, j) => {
                  const busy = e.title.trim().toLowerCase() === "busy";
                  return (
                    <span
                      className={"cal-ev" + (busy ? " is-busy" : "")}
                      key={j}
                      title={e.title}
                      style={{ borderLeftColor: calendarMeta(e.calendar).colour }}
                    >
                      {e.allDay ? "" : new Date(e.start).toLocaleTimeString("en-CA", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) + " "}
                      {e.title}
                    </span>
                  );
                })}
                {extra > 0 && <span className="cal-more">+{extra} more</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cal-agenda">
        {cells
          .filter((c) => !c.outside && (byDay.get(key(c.date)) || []).length > 0)
          .map(({ date }) => {
            const k = key(date);
            const evs = byDay.get(k) || [];
            return (
              <div className="ag-day" key={k}>
                <div className="ag-date">
                  <b>{date.getDate()}</b>
                  <span>{date.toLocaleDateString("en-CA", { timeZone: TZ, weekday: "short" })}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {evs.map((e, i) => (
                    <div className="ag-ev" key={i}>
                      <time>
                        {e.allDay
                          ? "All day"
                          : new Date(e.start).toLocaleTimeString("en-CA", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}
                      </time>
                      <span className={e.title.trim().toLowerCase() === "busy" ? "muted" : ""}>
                        <i className="lg-dot" style={{ background: calendarMeta(e.calendar).colour }} />
                        {e.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {!cal.configured && (
        <p className="empty">No calendars connected yet. Add your iCal links to the deployment.</p>
      )}
      {cal.errors.map((e, i) => (
        <div className="err" key={i}>
          {e.calendar}: {e.error}
        </div>
      ))}
    </div>
  );
}
