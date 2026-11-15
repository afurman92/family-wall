# AGENTS.md

Notes for an AI agent (or a human) working on this repo. Read before writing anything.

## What this is

Two artifacts sharing one Postgres database:

- **`frame-app/`** — a vanilla-JS wall display, built with Vite into `public/app` and served at
  `/frame/<FRAME_TOKEN>`. Runs full-screen in an Android WebView on a cheap tablet. Read-only:
  its token can only `GET` a handful of endpoints.
- **The Next.js app** — the dashboard at `/`, the private editing surface. Same data, bigger screen.

Postgres is the source of truth. Notion, Google Sheets and calendar feeds are inputs.

## The one rule that matters

**Events belong in the calendar. Everything else belongs in the items API.**

| The human asks for… | Where it goes | How |
|---|---|---|
| An event, appointment, change of time | the calendar feed | Google Calendar API / ICS — never the items API |
| A task, a chore, "remind me to…" | items API | `POST /api/items` with `kind: "task"` |
| Shopping ("we need…") | items API | `POST /api/items` with `kind: "shop"` |
| A note for the house | items API | `POST /api/items` with `kind: "note"` |

The frame reads both. An event written to the items API never reaches anyone's phone, so the
API rejects it:

```
POST /api/items {"kind":"event", ...}
→ 400 {"error":"events are not stored here", ...}
```

That rejection is deliberate — not a bug to work around.

## Writing to the items API

```
POST /api/items
Authorization: Basic <base64 of member:password>
x-member: <member name>
Content-Type: application/json

{"kind":"task","title":"Book the checkup","detail":"mornings","due_at":"2026-11-20T10:00:00-05:00"}
```

- `kind`: `task` | `shop` | `note` (required, nothing else accepted)
- `title`: required, max 200 chars
- `detail`: optional, max 2000
- `due_at`: optional ISO 8601 **with offset** — the server is not in your timezone
- `id` comes back as a **string** (bigint). Do not compare it to a number.

Members and passwords live in `.members.txt` locally and in the `MEMBERS` env var in
production (`scripts/members.sh` pushes them). Each person and agent gets their own — never
share or hardcode one.

## Other operations

```
GET    /api/items?includeDone=1      list (open items by default)
PATCH  /api/items/:id  {"done":true} mark complete
DELETE /api/items/:id                remove
```

All need the same Basic auth. Writes are attributed to whoever authenticated, so authenticate
as yourself, not as the person you are helping.

## Rules of conduct

1. **Never delete someone else's item** unless the human asked for that specific item to go.
2. **Don't invent data.** If the API is empty, say so — never fill the wall with plausible tasks.
3. **One item per thing.** Check `GET /api/items` before creating a duplicate.
4. **Confirm destructive intent.** "Clear the list" is destructive; "remove the milk" is not.
5. **Events: confirm the date and time before writing.** A wrong event on a shared calendar is
   worse than a missing one, because everyone trusts it.

## Deploy

```bash
cd frame-app && npm run build
cd .. && mv public/app public/app.bak.$(date +%H%M%S) && cp -R frame-app/dist public/app
npx next build
vercel deploy --prod --yes
```

Restart the Android app after a deploy (`adb shell am force-stop <pkg> && am start -n
<pkg>/.MainActivity`) — the WebView keeps the old bundle otherwise.

## Rules that are easy to get wrong

- **The frame token is read-only on purpose.** It travels in a URL. Never add write routes to
  its allowlist in `middleware.ts`.
- **`show()` runs once per view; every later visit calls `resume()`.** Put the fetch in a
  function and call it from both, or the wall shows a frozen snapshot forever.
- **`holdIdle` is not "stay on this screen".** It freezes the idle counter completely, including
  the night screensaver. To keep a view from jumping home while still letting the screen go dark,
  add it to `App.KEEP`.
- **Dark mode follows sunset, not the clock.** `App.isNight()` reads `sunrise`/`sunset` from the
  weather payload and falls back to 22:00–06:00.
- **Never `rm -rf public/app`.** Move the old build aside first; rollback takes a second.

## Adding a database column

`ensureSchema()` in `lib/db.ts` is the only migration path — add an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` next to the table's `CREATE`. Then check the places that re-map rows explicitly: **`app/api/frame/route.ts` builds its payload field by field**, so a new column silently never reaches the wall unless you add it there too.

## Agent keys

`AGENTS="muse:KEY,other:KEY"` in the environment lets an agent in without the HTTP Basic dialog,
which a cloud browser cannot fill. Two doors: `Authorization: Bearer <key>` (or `x-agent-key`)
for API calls, and `/agent-login?k=<key>` for a browser, which sets a 30-day HttpOnly cookie.
Writes land as `created_by: <agent>`. Rotate by changing the env var and redeploying.

## Calendar colours

`lib/people.ts` → `CALENDAR_FEEDS` gives each iCal feed its own label and shade, and `CALENDAR_LANES` derives the person id from it (`all` = the family colour). There is one feed per calendar (family, personal and work for each adult); work shades are deeper than personal ones so the difference is visible at a glance. It **mirrors `LANE` in `frame-app/js/live.js`**; change both or the wall and the web paint the same event differently. The web legend on `/calendar` is built from the feeds actually configured.
