# Family wall

A wall-mounted family display and the private web app that feeds it — built to replace Notion,
Google Keep and three paper lists with one screen in the kitchen.

Two pieces, one database:

```
┌──────────────────────────┐        ┌───────────────────────────┐
│  Android tablet on wall  │        │  Next.js dashboard         │
│  frame-app/ (vanilla JS) │        │  /  /calendar  /air-fryer │
│  read-only token         │        │  password protected        │
└────────────┬─────────────┘        └─────────────┬─────────────┘
             │  GET only                          │  read + write
             └───────────────┬────────────────────┘
                             ▼
                    ┌──────────────────┐
                    │  Postgres        │
                    │  items, recipes, │
                    │  air fryer, docs │
                    └──────────────────┘
```

## What it does

**On the wall (800×1280, touch):**
- Today: agenda, weather, to-dos, shopping count, plants that need water
- Calendar: month grid, swipeable
- Chores and To do, kept separate on purpose
- Shopping list with categories, tap to check
- Recipes that **scale** — tap 2 / 4 / 6 / 8 and every ingredient and step follows, including
  fractions, ranges (*"6 a 8 cucharadas"*) and unit conversion
- Air fryer cheat sheet: ingredient, mode, portion, time, temperature — one glance from the counter
- Screensaver that is a photo frame by day and **pure black with a dim clock and a literary
  quote after sunset**

**On the web:** the same data in a bigger layout, with urgency buckets (Overdue / Today /
Tomorrow / This week), a month calendar, document expiry search, and forms for everything.

## Design decisions worth stealing

- **The wall is read-only.** Its token lives in a URL that anyone standing there can read. So it
  can only `GET`, and the allowlist is in `middleware.ts`.
- **Cooking screens never time out.** Recipes and the air fryer are on a `KEEP` list: the display
  will not jump home while you have raw chicken hands. Everything else does.
- **Night follows the sun, not the clock.** Sunset comes from the weather payload; the screen goes
  black when it gets dark, not at a fixed hour.
- **One table for tasks, shopping and notes.** `items.kind` decides which view shows it. Three
  tables would have been three times the code.
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
  api/recipes        recipes + scaling source
  api/air-fryer      table with validated modes
  api/documents      metadata + authenticated file streaming
  api/frame          everything the wall needs, in one payload
  frame/[token]      the wall shell
components/          dashboard UI
lib/                 db schema, calendar/ICS, weather
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
