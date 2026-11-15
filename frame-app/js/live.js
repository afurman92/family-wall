// Live data. Replaces the prototype's mock calendar + weather with real data from
// /api/frame, and renames the family slots if FAMILY_PEOPLE is configured.
// Everything else (chores, photos, rooms, agents) stays mock — the UI is untouched.

function tokenFromUrl() {
  var m = location.pathname.match(/\/frame\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  try {
    return new URLSearchParams(location.search).get('token');
  } catch (e) {
    return null;
  }
}

// Which dashboard lane an event belongs to. 'all' = everyone (renders as a family
// event in the demo's neutral colour); otherwise a list of person ids.
// Outlook is a partner's work calendar; Personal is the other adult's.
var LANE = { Family: 'all', Personal: ['alex'], Outlook: ['jordan'] };

function laneFor(calendarName, D) {
  var lane = LANE[calendarName];
  if (lane === 'all') return (D.people || []).map(function (p) { return p.id; });
  return lane || [(D.people && D.people[0] ? D.people[0].id : 'alex')];
}

// Rebuild DATA.people from FAMILY_PEOPLE, dropping any slot that isn't configured.
function applyPeople(incoming) {
  var D = window.DATA;
  var byId = {};
  (D.people || []).forEach(function (p) { byId[p.id] = p; });

  var next = [];
  incoming.forEach(function (spec) {
    var base = byId[spec.id];
    if (base) next.push(Object.assign({}, base, spec));
  });
  if (!next.length) return;

  D.people = next;
  var ids = next.map(function (p) { return p.id; });

  // Chores, stars and week are keyed to the demo's kid ids; prune anything orphaned
  // so App.person() never gets an id that no longer exists.
  D.chores = (D.chores || []).filter(function (c) { return ids.indexOf(c.who) > -1; });
  var s = {}, w = {};
  ids.forEach(function (id) {
    if (D.stars && D.stars[id] != null) s[id] = D.stars[id];
    if (D.week && D.week[id]) w[id] = D.week[id];
  });
  D.stars = s;
  D.week = w;
}

// Chores have no icon field in the database; the title decides.
var EMOJI = [
  [/vajilla|plato|dish/i, '🍽️'],
  [/lavarropas|ropa|laundry/i, '🧺'],
  [/basura|trash|garbage/i, '🗑️'],
  [/aspiradora|aspirar|vacuum|barrer/i, '🧹'],
  [/cama|sábanas|sheet/i, '🛏️'],
  [/toalla|towel/i, '🧺'],
  [/baño|bath|ducha/i, '🛁'],
  [/cocina|kitchen|mesada/i, '🧽'],
  [/planta|jardín|riego|plant/i, '🌱'],
  [/perro|gato|dog|cat/i, '🐾'],
  [/bebé|pañal|baby/i, '🧷'],
  [/compra|super|shop/i, '🛒'],
  [/auto|car|nafta/i, '🚗']
];
function emojiFor(t) {
  for (var i = 0; i < EMOJI.length; i++) if (EMOJI[i][0].test(t || '')) return EMOJI[i][1];
  return '🧹';
}

async function refresh() {
  var D = window.DATA;
  if (!D) return { ok: false, reason: 'no DATA' };

  var token = tokenFromUrl();
  if (!token) {
    console.warn('[live] no token in URL - keeping mock data');
    return { ok: false, reason: 'no token' };
  }

  var res;
  try {
    res = await fetch('/api/frame?token=' + encodeURIComponent(token), { cache: 'no-store' });
  } catch (e) {
    console.warn('[live] fetch failed', e);
    return { ok: false, reason: 'fetch' };
  }
  if (!res.ok) {
    console.warn('[live] api status ' + res.status);
    return { ok: false, reason: 'http ' + res.status };
  }

  var data = await res.json();

  // ---- people: rebuild the slots from config, keeping the demo's ids so that
  // chores, stars and photos keep resolving. Ids not in config are dropped, and
  // the kid-keyed maps (chores/stars/week) are pruned to match.
  if (Array.isArray(data.people) && data.people.length) {
    applyPeople(data.people);
  }

  // ---- calendar
  var cal = data.calendar || {};
  if (cal.configured && Array.isArray(cal.events) && cal.events.length) {
    D.events = cal.events.map(function (e, i) {
      var start = new Date(e.start);
      var end = e.end ? new Date(e.end) : new Date(start.getTime() + 3600000);
      return {
        id: 'live' + i,
        start: start,
        end: end,
        title: e.title,
        allDay: !!e.allDay,
        loc: e.location || undefined,
        people: laneFor(e.calendar, D),
        live: true
      };
    });
    D.busyExtras = [];
  }

  // ---- family list: real shopping items replace the demo's groceries.
  // Tasks/notes stay on the web door for now; chores are a different concept.
  try {
    var r2 = await fetch('/api/items?token=' + encodeURIComponent(token), { cache: 'no-store' });
    if (r2.ok) {
      var list = (await r2.json()).items || [];
      var shop = list.filter(function (i) { return i.kind === 'shop'; });
      if (list.length >= 0) {
        D.groceries = shop.map(function (i) {
          return {
            id: 'live' + i.id,
            name: i.title,
            cat: 'Pantry',
            qty: 1,
            store: 'grocer',
            done: !!i.done,
            note: i.detail || ''
          };
        });
      }
      // Real to-dos: the home card lists these instead of the demo's chores.
      D.todos = list.filter(function (i) { return i.kind === 'task'; });
      window.LIVE_ITEMS = list;
      // Events are not merged in from here: they live in the familia Google
      // Calendar and arrive through the ICS feed above.
    }
  } catch (e) {
    console.warn('[live] items fetch failed', e);
  }

  // ---- chores: real rows, one lane per person on the wall.
  if (data.chores && data.chores.length >= 0) {
    D.chores = data.chores.map(function (c) {
      return {
        id: 'ch' + c.id,
        title: c.title,
        who: c.who || 'any',
        r: c.routine || 'any',
        freq: c.freq || 'daily',
        emoji: emojiFor(c.title),
        done: !!c.done,
        overdue: false
      };
    });
  }

  // ---- documents nearing expiry: the wall shows these on the home screen.
  D.docAlerts = data.docAlerts || [];

  // ---- recipes: the list only. A single recipe body can be 145 blocks, so it is
  // fetched on demand when someone opens it, never on every poll.
  try {
    var r3 = await fetch('/api/recipes?token=' + encodeURIComponent(token), { cache: 'no-store' });
    if (r3.ok) window.RECIPES = (await r3.json()).recipes || [];
  } catch (e) {
    console.warn('[live] recipes fetch failed', e);
  }

  // ---- weather: same key names the demo uses (hi/lo/feels + 24 hourly arrays)
  var w = data.weather;
  if (w && w.ok) {
    var h = new Date().getHours();
    D.weather = {
      hi: Math.round(w.highC),
      lo: Math.round(w.lowC),
      feels: Math.round(w.feelsC),
      humidity: w.humidity != null ? Math.round(w.humidity) : 0,
      wind: w.wind != null ? Math.round(w.wind) : 0,
      t: w.t,
      c: w.c,
      p: w.p,
      temp: Math.round(w.tempC),
      cond: (w.c && w.c[h]) || 'cloud',
      sunrise: w.sunrise || null,
      sunset: w.sunset || null
    };
  }

  return {
    ok: true,
    events: D.events.length,
    calendars: cal.configured ? cal.events.length : 0,
    errors: cal.errors || []
  };
}

// Boot: block the first paint on live data.
window.LIVE_READY = refresh();

// Then poll quietly so the wall stays current without a reload. Skipped while
// the page is hidden, and a failed poll never disturbs what is on screen.
window.LIVE_POLL_MS = 60000;
setInterval(function () {
  if (document.hidden) return;
  refresh()
    .then(function () {
      if (window.App && window.App.rerender) window.App.rerender();
    })
    .catch(function (e) {
      console.warn('[live] poll failed', e);
    });
}, window.LIVE_POLL_MS);
