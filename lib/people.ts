// The household, in one place. Ids are what the database stores (`owner`, `who`);
// names are what screens show. The kitchen frame gets the same ids from its
// FAMILY_PEOPLE env var.
export type Person = { id: string; name: string; colour: string };

export const PEOPLE: Person[] = [
  { id: "alex", name: "Alejandro", colour: "#2D5BFF" },
  { id: "jordan", name: "Hellen", colour: "#E4007C" },
  { id: "maya", name: "Alan", colour: "#00A36C" },
];

export const ANY: Person = { id: "any", name: "Cualquiera", colour: "#7A756B" };

export const FAMILY: Person = { id: "family", name: "Family", colour: "#111111" };

// Which lane a calendar feed feeds. This mirrors LANE in frame-app/js/live.js:
// if the two disagree, the wall and the web paint the same event differently.
export const CALENDAR_LANES: Record<string, string> = {
  Family: "all",
  Personal: "alex",
  Outlook: "alex",
  Hellen: "jordan",
};

export function calendarMeta(feed: string): { label: string; colour: string } {
  const lane = CALENDAR_LANES[feed];
  if (lane === "all") return { label: FAMILY.name, colour: FAMILY.colour };
  if (lane) return { label: personName(lane), colour: personColour(lane) };
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
