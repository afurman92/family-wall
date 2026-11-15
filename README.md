# Family wall

A wall-mounted family display and the private web app that feeds it — built to replace Notion,
Google Keep and three paper lists with one screen in the kitchen.

Two pieces, one database:

```
┌──────────────────────────┐        ┌────────────────────────────────────┐
│  Android tablet on wall  │        │  Next.js dashboard                  │
│  frame-app/ (vanilla JS) │        │  /  /calendar  /chores  /air-fryer  │
│  read-only token         │        │  /documents   password protected    │
└────────────┬─────────────┘        └───────────────┬────────────────────┘
             │  GET only                            │  read + write
             └──────────────────┬───────────────────┘
                                ▼
                     ┌────────────────────┐
                     │  Postgres          │
                     │  items, chores,    │
                     │  recipes, air fryer│
                     │  documents, plants │
                     └────────────────────┘
```

## What it does

**On the wall (800×1280, touch):**
- Today: agenda, weather, to-dos, shopping count, and — when a document is expired or about to
  expire — an **expiry panel that takes the photo's place**
- Calendar: month grid, swipeable
- Chores: one lane per person, scoped to morning / afternoon / evening, with a ring per lane.
  Read-only — the wall shows, the web edits
- To do, kept separate from chores on purpose
- Shopping list, tap to check
- Recipes that **scale** — tap 2 / 4 / 6 / 8 and every ingredient and step follows, including
  fractions, ranges (*"6 a 8 cucharadas"*) and unit conversion
- Air fryer cheat sheet: ingredient, mode, portion, time, temperature — one glance from the counter
- Screensaver that is a photo frame by day and **pure black with a dim clock and a literary
  quote after sunset**

**On the web:** the same data in a bigger layout — a composer for tasks and another for shopping,
chores with frequency, documents with an owner and an upload for the scan, a month calendar with a
**colour legend** (family vs. each person), and urgency buckets (Overdue / Today / Tomorrow / This
week).

## Design decisions worth stealing

- **The wall is read-only.** Its token lives in a URL that anyone standing there can read. So it
  can only `GET`, and the allowlist is in `middleware.ts`. Chores are a reading on the wall for the
  same reason: a checkbox that cannot save is worse than no checkbox.
- **"Done" lasts the period, not the day.** A daily chore is done until tomorrow, a weekly one
  until Monday, a monthly one until the 1st. That is the whole difference between a chore and a
  task, and it lives in one `CASE` in `listChores()`.
- **Cooking screens never time out.** Recipes and the air fryer are on a `KEEP` list: the display
  will not jump home while you have raw chicken hands. Everything else does.
- **Night follows the sun, not the clock.** Sunset comes from the weather payload; the screen goes
  black when it gets dark, not at a fixed hour.
- **One table for tasks, shopping and notes.** `items.kind` decides which view shows it. Chores got
  their own table because they repeat and belong to a part of the day — three columns of exceptions
  in `items` would have been worse.
- **The backup is the export button.** `/api/export` dumps every table with `SELECT *`, and a nightly
  job writes it to a synced folder. A column added later cannot go missing from the backup because
  nobody remembered to update a list.
- **Colours mean one thing.** A feed maps to a person in `CALENDAR_LANES` (`lib/people.ts`) and in
  `LANE` (`frame-app/js/live.js`); the legend on `/calendar` is built from the feeds actually
  configured. Change one, change the other.
- **The frame is a separate build** (Vite → `public/app`) so redeploying it never touches the
  dashboard, and the old build is kept as `public/app.bak.HHMMSS` for one-second rollback.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in DATABASE_URL, FRAME_TOKEN, BASIC_AUTH_*
npm run dev                       # http://localhost:3000

# the wall
cd frame-app && npm install && npm run build
cd .. && mkdir -p public/app && cp -R frame-app/dist/* public/app/
```

The schema creates itself on the first request (`ensureSchema()` in `lib/db.ts`), including
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for later columns.

Deploy to Vercel, then point the tablet at `https://your-app.vercel.app/frame/<FRAME_TOKEN>`.
Use Fully Kiosk Browser (or any WebView shell) with screen pinning, and keep the device on a
charger with the screen always on.

## Layout

```
app/                 Next.js routes (pages + API)
  api/items          to-dos, shopping, notes
  api/chores         repeating chores: person, routine, frequency
  api/recipes        recipes + scaling source
  api/air-fryer      table with validated modes
  api/documents      metadata, owner, authenticated file streaming
  api/export         every table as one JSON file (the backup)
  api/frame          everything the wall needs, in one payload
  frame/[token]      the wall shell
components/          dashboard UI (ItemsPanel, ChoresEditor, DocumentsEditor, …)
lib/                 db schema, calendar/ICS, weather, people/colours
frame-app/           the kiosk (vanilla JS + Vite)
scripts/             db-tool.js, members.sh (push logins to Vercel)
AGENTS.md            contract for AI agents working on this repo
docs/roadmap.md      what is done, what is next
```

## Credits

The kiosk UI started as a copy of the **Home HQ** demo by [Wes Bos](https://github.com/wesbos) —
typography, rail, sheets and the demo data in `frame-app/js/data.js` come from there. Everything
on the data side (schema, API, dashboard, scaling, screensaver logic) was built on top.

MIT licensed; see `LICENSE` for the note about the original work.
