"use client";

import { useEffect, useState } from "react";

export default function Clock({ tz }: { tz: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <div style={{ fontSize: 96, height: 108 }} />;

  const time = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(now);

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, weekday: "long", month: "long", day: "numeric",
  }).format(now);

  return (
    <div>
      <div style={{ fontSize: 96, lineHeight: 1, fontWeight: 300, letterSpacing: "-2px" }}>
        {time}
      </div>
      <div style={{ fontSize: 22, color: "#a49886", marginTop: 8 }}>{date}</div>
    </div>
  );
}
