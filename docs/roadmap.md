# Roadmap

Honest state of the project: what actually works, what is still a shell, and what would come next.

## Working

- **Items** — one table, three kinds (`task`, `shop`, `note`), with due dates, person colours and
  urgency buckets on the dashboard (Overdue / Today / Tomorrow / This week / Later / No date).
- **Recipes** — list + detail on the wall; scaling to 2 / 4 / 6 / 8 that handles fractions,
  ranges, parenthetical quantities and unit conversion. Measured coverage on a real recipe box:
  462 of 484 ingredient lines (95.5%); the rest are step references and non-quantities.
- **Air fryer** — ingredient, mode, portion, minutes, °F, note. Modes are validated server-side
  against `AIR_FRYER_MODES` (Air Fry, Air Broil, Roast, Bake, Reheat, Dehydrate).
- **Plants** — list with care notes and photos.
- **Documents** — country / type / number / expiry, searchable, sorted by what expires first;
  scans stream through an authenticated route, never from `public/`.
- **Calendar** — month grid on the web, week strip on the dashboard, agenda on mobile.
- **Weather** — current + hourly, plus sunrise/sunset (which drives the night screen).
- **Screensaver** — photo frame by day; after sunset a black screen with a dim clock and a quote
  from a local list (70 lines, Spanish and English, rotating every 20 minutes).
- **Idle behaviour** — recipes and the air fryer never jump home; everything else returns to
  Today after 60 s and dims after 120 s.
- **Auth** — HTTP Basic for the app, per-person member names for attribution, read-only frame token.

## Half-built

- **Chores** — the five-lane view exists and is styled, but the data is empty: it was demo
  content and was cleared rather than left half-true. Either wire it to `items` with a `routine`
  field or remove the view.
- **Usuals** (suggested items in the shopping view) — still the demo list. The plan is to derive
  it from grocery order emails (Voilà / Instacart / whatever you use) instead of inventing it.
- **Photos** — the slideshow runs on demo images; it needs a real source (folder, S3, Immich).

## Next, in order

1. **Usuals from email** — parse order confirmations, count frequency over the last N orders,
   store the result; never show a suggestion that did not come from real history.
2. **Tick items off from the wall** — one narrow endpoint (`PATCH` done only), rate-limited, with
   undo. The token is read-only today by design; this is the one exception worth making.
3. **Store split for shopping** — only if there is more than one store in real use: a `store`
   column and a filter, otherwise one list is the honest answer.
4. **Notifications** — "the milk was added", "the frame is offline". Needs a push channel; the
   display is a pull surface today.
5. **Export** — one button that dumps everything to JSON, so leaving this project is as easy as
   joining it.

## Not doing

- Multi-household / multi-tenant. This is one kitchen.
- Writing to the wall's token. It travels in a URL.
- A mobile app. The web app is responsive; the wall is the wall.
