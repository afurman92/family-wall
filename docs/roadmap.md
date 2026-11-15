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
- **Plants** — list with care notes and photos.
- **Documents** — country / type / number / expiry / owner, searchable, sorted by what expires
  first; scans stream through an authenticated route, never from `public/`. Anything expired or
  expiring within 120 days surfaces on the wall's home screen.
- **Calendar** — month grid on the web, week strip on the dashboard, agenda on mobile. Each feed
  maps to a colour (family vs. person) with a legend built from the configured feeds; the wall
  uses the same mapping.
- **Weather** — current + hourly, plus sunrise/sunset (which drives the night screen).
- **Screensaver** — photo frame by day; after sunset a black screen with a dim clock and a quote
  from a local list (71 lines, Spanish and English, rotating every 20 minutes).
- **Idle behaviour** — recipes and the air fryer never jump home; everything else returns to
  Today after 60 s and dims after 120 s.
- **Auth** — HTTP Basic for the app, per-person member names for attribution, read-only frame token.

## Half-built

- **Usuals** (suggested items in the shopping view) — still the demo list. The plan is to derive
  it from grocery order emails (Voilà / Instacart / whatever you use) instead of inventing it.
- **Photos** — the slideshow runs on demo images; it needs a real source (folder, S3, Immich).
- **Home status card** — lights, locks and inside temperature are demo values; there is no home
  automation integration behind them.
- **A partner's work calendar** — the Outlook feed is already mapped to their colour; it needs the
  iCal link (work accounts often block publishing).

## Next, in order

1. **Tick chores from the wall** — the one write worth allowing. Tapping a chore opens "who are
   you?", the tap marks it done and credits the person who tapped (no rules beyond that). Needs a
   write-scoped token and `PATCH /api/chores/:id`. The sheet for it already exists in the kiosk.
2. **Usuals from email** — parse order confirmations, count frequency over the last N orders,
   store the result; never show a suggestion that did not come from real history.
3. **Notifications** — "the milk was added", "the frame is offline". Needs a push channel; the
   display is a pull surface today.
4. **Export** — one button that dumps everything to JSON, so leaving this project is as easy as
   joining it.

## Not doing

- Multi-household / multi-tenant. This is one kitchen.
- Writing anything else from the wall. The token travels in a URL; chores are the exception
  because the screen is where the chore happens.
- A mobile app. The web app is responsive; the wall is the wall.
