// The household, in one place. Ids are what the database stores (`owner`, `who`);
// names are what screens show. The kitchen frame gets the same ids from its
// FAMILY_PEOPLE env var.
export type Person = { id: string; name: string; colour: string };

export const PEOPLE: Person[] = [
  { id: "alex", name: "Alex", colour: "#2D5BFF" },
  { id: "jordan", name: "Jordan", colour: "#E4007C" },
  { id: "maya", name: "Maya", colour: "#00A36C" },
];

// A `who` that is not one of these turns into a grey row nobody owns: reject it
// at the door instead of storing a typo. `any` and null are legitimate.
export function isKnownPerson(id: unknown): boolean {
  return id === null || id === undefined || id === "" || id === "any" ||
    PEOPLE.some((p) => p.id === id);
}

// Faces live in the private Blob store, never in /public: the wall is in the
// kitchen, the internet is not. The route streams them; this is the only map.
export const PHOTOS: Record<string, string> = {
  // Demo leaves these out on purpose: the household's faces belong in the
  // private Blob store, not in a public repo. Add "alex": "avatars/alex.jpg".
};

export function photoFor(id: string | null | undefined): string | null {
  if (!id) return null;
  return PHOTOS[id] || null;
}

export const ANY: Person = { id: "any", name: "Cualquiera", colour: "#7A756B" };

export const FAMILY: Person = { id: "family", name: "Family", colour: "#111111" };

// Which lane a calendar feed feeds. This mirrors LANE in frame-app/js/live.js:
// if the two disagree, the wall and the web paint the same event differently.
// Five calendars, two per adult plus the family one. Each feed has its own
// shade so a glance tells work from personal: deep = work, light = personal.
export const CALENDAR_FEEDS: Record<string, { label: string; colour: string; person: string }> = {
  Familia: { label: "Familia", colour: "#111111", person: "all" },
  "AF personal": { label: "AF personal", colour: "#7C9BFF", person: "alex" },
  "AF laboral": { label: "AF laboral", colour: "#1F3BC7", person: "alex" },
  "HK personal": { label: "HK personal", colour: "#FF8FC7", person: "jordan" },
  "HK laboral": { label: "HK laboral", colour: "#C4006A", person: "jordan" },
};

// Which lane a feed feeds. This mirrors LANE in frame-app/js/live.js: if the two
// disagree, the wall and the web paint the same event differently.
export const CALENDAR_LANES: Record<string, string> = Object.fromEntries(
  Object.entries(CALENDAR_FEEDS).map(([k, v]) => [k, v.person])
);

export function calendarMeta(feed: string): { label: string; colour: string } {
  const f = CALENDAR_FEEDS[feed];
  if (f) return { label: f.label, colour: f.colour };
  return { label: feed, colour: "#7A756B" };
}

export function personName(id: string | null | undefined): string {
  if (!id) return "—";
  const p = [...PEOPLE, ANY].find((x) => x.id === id);
  return p ? p.name : id;
}

export function personColour(id: string | null | undefined): string {
  const p = [...PEOPLE, ANY].find((x) => x.id === id);
  return p ? p.colour : "#7A756B";
}
