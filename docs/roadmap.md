# Roadmap

Honest state of the project: what actually works, what is still a shell, and what would come next.

## Working

- **Items** — one table, three kinds (`task`, `shop`, `note`), with due dates, person colours and
  urgency buckets on the dashboard (Overdue / Today / Tomorrow / This week / Later / No date).
  Both a task and a shopping item can be added from the web.
- **Chores** — their own table: person, part of the day (morning / afternoon / evening / any) and
  frequency (daily / weekly / monthly). "Done" lasts the whole period, so a weekly chore stays
  checked until Monday. Lanes and progress rings on the wall; create, edit and tick on the web.
  The wall is read-only.
- **Recipes** — list + detail on the wall; scaling to 2 / 4 / 6 / 8 that handles fractions,
  ranges, parenthetical quantities and unit conversion. Measured coverage on a real recipe box:
  462 of 484 ingredient lines (95.5%); the rest are step references and non-quantities.
- **Air fryer** — ingredient, mode, portion, minutes, °F, note. Modes are validated server-side
  against `AIR_FRYER_MODES` (Air Fry, Air Broil, Roast, Bake, Reheat, Dehydrate).
- **Documents** — country / type / number / expiry / owner, searchable, sorted by what expires
  first; scans stream through an authenticated route, never from `public/`. Anything expired or
  expiring within 120 days shows as a strip on the wall's home screen — and only then.
- **Calendar** — month grid on the web, week strip on the dashboard, agenda on mobile. Each feed
  maps to a colour (family vs. person) with a legend built from the configured feeds; the wall
  uses the same mapping.
- **Weather** — current + hourly, plus sunrise/sunset (which drives the night screen).
- **Screensaver** — photo frame by day; after sunset a black screen with a dim clock and a quote
  from a local list (71 lines, Spanish and English, rotating every 20 minutes).
- **Idle behaviour** — recipes and the air fryer never jump home; everything else returns to
  Today after 60 s and dims after 120 s.
- **Backup / export** — `/api/export` returns every table as one JSON file; a nightly job writes it
  into a synced folder and keeps a 45-day window. Scans stay in the private blob store, so a full
  backup is this file plus that store.
- **Auth** — HTTP Basic for the app, per-person member names for attribution, read-only frame token.

## Half-built

- **Usuals** (suggested items) — not built. If they ever exist they must come from real order history
  (grocery emails), never from a demo list.
- **A partner's work calendar** — the Outlook feed is already mapped to their colour; it needs the
  iCal link (work accounts often block publishing).

## Dates

Birthdays, anniversaries and one-off dates live in their own table (`/dates`), because the
family calendar already carries birthdays and a second copy would show up twice. Yearly dates
store month + day only. Anything inside the next 7 days takes the strip at the top of the wall,
next to expiring documents.

## Trash

Deletes mark the row (`deleted_at`) instead of destroying it. `/trash` lists items, chores, documents
and moments for 30 days, with a Restaurar button; `GET /api/trash` also sweeps anything older than the
window. Agents can restore, humans can purge.

## The wall writes one thing

Ticking a chore from the frame (`POST /api/frame/chores/{id}`), optimistic, with roll-back and undo
on a second tap. Deliberately narrow: the token cannot create, delete or touch documents.

## Next, in order

1. **Tick chores from the wall** — the one write worth allowing. Tapping a chore opens "who are
   you?", the tap marks it done and credits the person who tapped (no rules beyond that). Needs a
   write-scoped token and `PATCH /api/chores/:id`. The sheet for it already exists in the kiosk.
2. **Usuals from email** — parse order confirmations, count frequency over the last N orders,
   store the result; never show a suggestion that did not come from real history.
3. **Notifications** — "the milk was added", "the frame is offline". Needs a push channel; the
   display is a pull surface today.
4. **Restore** — the backup exists; a one-command restore into a fresh database does not.

## Not doing

- Multi-household / multi-tenant. This is one kitchen.
- Writing anything else from the wall. The token travels in a URL; chores are the exception
  because the screen is where the chore happens.
- A mobile app. The web app is responsive; the wall is the wall.
