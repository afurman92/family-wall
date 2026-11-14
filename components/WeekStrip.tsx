import Link from "next/link";
import type { CalEvent } from "../lib/calendar";

const TZ = process.env.HOME_TZ || "America/Toronto";

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

// A week at a glance: today plus the six days after it, with a dot per event
// so a busy day is visible without reading anything.
export default function WeekStrip({ events }: { events: CalEvent[] }) {
  const now = new Date();
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }

  const counts = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(new Date(e.start));
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  return (
    <div className="week">
      {days.map((d, i) => {
        const n = counts.get(dayKey(d)) || 0;
        return (
          <Link
            key={i}
            href="/calendar"
            className={"week-day" + (i === 0 ? " is-today" : "")}
            title={n ? `${n} event${n > 1 ? "s" : ""}` : "No events"}
          >
            <span className="wd-dow">{d.toLocaleDateString("en-CA", { timeZone: TZ, weekday: "short" }).slice(0, 3)}</span>
            <span className="wd-num">{d.getDate()}</span>
            <span className="wd-dots">
              {Array.from({ length: Math.min(n, 3) }).map((_, j) => (
                <span className="wd-dot" key={j} />
              ))}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
