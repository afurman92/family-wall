// Dates arrive from forms, agents and curl. "2027-02-31" is not a date: the
// browser's parser rolls it to March 3 and the row looks fine until the wall
// celebrates a birthday on the wrong day. Validate the calendar itself.

export function realDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

// A month + day that repeats yearly: allow Feb 29 by checking a leap year.
export function realMonthDay(m: number, d: number): boolean {
  return realDate(2024, m, d);
}

// null = explicitly cleared, undefined = the caller sent something that is not
// a date (the route answers 400), a string = a valid YYYY-MM-DD.
export function isoDay(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return undefined;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(v.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return realDate(y, mo, d) ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}
