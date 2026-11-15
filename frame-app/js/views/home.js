// Home / Today: the glanceable overview. Never scrolls.
(function () {
  'use strict';
  var D = window.DATA, V = {};

  function clock() {
    var n = App.now();
    return '<div class="h-time num">' + App.fmt.time(n, false) + '<span class="h-ampm">' + App.fmt.ampm(n) + '</span></div>' +
      '<div class="h-date"><b>' + App.fmt.day(n) + '</b> ' + App.fmt.month(n) + ' ' + n.getDate() + '</div>';
  }

  function weather() {
    var w = App.weatherNow();
    var hours = App.hourly(7);
    var tmin = Math.min.apply(null, hours.map(function (h) { return h.t; }));
    var tmax = Math.max.apply(null, hours.map(function (h) { return h.t; }));
    return '<div class="h-wx-top">' +
      '<span class="h-wx-icon">' + App.icon(w.cond, 60) + '</span>' +
      '<span class="h-wx-temp num">' + w.temp + '°</span>' +
      '<span class="h-wx-meta"><b>' + w.label + '</b><span>H ' + w.hi + '°  L ' + w.lo + '°</span></span>' +
      '</div>' +
      '<div class="h-wx-say"><b>' + w.summary + '.</b> ' + w.advice + '.</div>' +
      '<div class="h-wx-hours">' + hours.map(function (h) {
        var lift = tmax === tmin ? 0 : Math.round((h.t - tmin) / (tmax - tmin) * 8);
        return '<div class="h-hr' + (h.p >= 50 ? ' is-wet' : '') + '"><span class="h-hr-l">' + h.label + '</span>' +
          '<span class="h-hr-i" style="transform:translateY(' + -lift + 'px)">' + App.icon(h.c, 22) + '</span><b>' + h.t + '°</b></div>';
      }).join('') + '</div>';
  }

  function hero() {
    var e = App.nextEvent(), now = App.now();
    if (!e) {
      var tomorrow = App.timedOn(App.addDays(now, 1))[0];
      return '<div class="h-hero h-hero--empty" data-go="calendar">' +
        '<div class="label label--light">Rest of today</div>' +
        '<div class="h-hero-title serif">Nothing else scheduled.<br><i>Enjoy the quiet.</i></div>' +
        (tomorrow ? '<div class="h-hero-meta">Tomorrow starts with <b>' + App.esc(tomorrow.title) + '</b> at ' + App.fmt.time(tomorrow.start) + '</div>' : '') +
        '</div>';
    }
    var p = App.evColor(e);
    var mins = (e.start - now) / 60000;
    var leave = (App.leaveBy(e) - now) / 60000;
    var who = e.people.map(function (id) { return App.person(id).name; });
    var whoText = App.isFamily(e) ? 'Everyone' : who.join(' + ');
    var big = mins < 100
      ? '<div class="h-hero-count num">' + Math.round(mins) + '<small>min</small></div>'
      : '<div class="h-hero-count num">' + App.fmt.time(e.start, false) + '<small>' + App.fmt.ampm(e.start) + '</small></div>';
    var leavePill = '';
    if (e.travel) {
      leavePill = leave <= 0
        ? '<span class="pill pill--alert"><i class="pulse"></i>Leave now</span>'
        : '<span class="pill' + (leave <= 15 ? ' pill--soon' : '') + '">' + App.icon('car', 20) + 'Leave in ' + App.fmt.mins(leave) + '</span>';
    }
    return '<button class="h-hero" style="' + App.pstyle(p) + '" data-ev="' + e.id + '">' +
      '<div class="h-hero-main">' +
      '  <div class="label label--on">Next up · ' + App.esc(whoText) + '</div>' +
      '  <div class="h-hero-title serif">' + App.esc(e.title) + '</div>' +
      '  <div class="h-hero-meta">' + App.fmt.range(e.start, e.end) + (e.loc ? ' · ' + App.esc(e.loc) : '') + '</div>' +
      '  <div class="h-hero-foot">' + (e.people.length > 1 ? App.dots(e.people, 22) : '') + leavePill + '</div>' +
      '</div>' + big + '</button>';
  }

  function lanes() {
    var now = App.now();
    return D.people.map(function (p) {
      var list = App.timedOn(now, p.id).filter(function (e) { return e.end > now; });
      var shown = list.slice(0, 3), more = list.length - shown.length;
      return '<div class="h-lane" style="' + App.pstyle(p) + '">' +
        '<div class="h-lane-head">' + App.avatar(p, 30) + '<b>' + p.name + '</b></div>' +
        (list.length ? shown.map(function (e) {
          var cur = e.start <= now;
          return '<button class="h-ev' + (cur ? ' is-now' : '') + '" data-ev="' + e.id + '">' +
            '<span class="h-ev-t">' + (cur ? 'Now' : App.fmt.time(e.start, false)) + '</span>' +
            '<span class="h-ev-n">' + App.esc(e.title) + '</span></button>';
        }).join('') : '<div class="h-free serif"><i>Free</i> the rest of the day</div>') +
        (more > 0 ? '<button class="h-more" data-go="calendar">+' + more + ' more</button>' : '') +
        '</div>';
    }).join('');
  }

  function ring(done, total, size) {
    var r = size / 2 - 5, c = 2 * Math.PI * r, f = total ? done / total : 0;
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * f) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }
  App.ring = ring;

  // Real to-dos (from the family list), not the demo's chores. Read-only here:
  // the wall shows what is pending, the web door is where things get added.
  function todos() {
    var list = (D.todos || []).filter(function (t) { return !t.done; });
    var shown = list.slice(0, 4);
    if (!list.length) {
      return '<div class="label">To do</div>' +
        '<div class="h-todo-empty serif"><i>Nothing pending</i></div>';
    }
    return '<div class="label">To do · ' + list.length + ' open</div>' +
      '<ul class="h-recent h-todos">' + shown.map(function (t) {
        return '<li><i></i>' + App.esc(t.title) + '</li>';
      }).join('') + '</ul>';
  }

  function shopping() {
    var open = D.groceries.filter(function (g) { return !g.done; });
    var recent = open.slice(-3).reverse();
    return '<div class="label">Shopping</div>' +
      '<div class="h-stat"><span class="num">' + open.length + '</span><small>items to get</small></div>' +
      '<ul class="h-recent">' + recent.map(function (g) {
        return '<li><i></i>' + App.esc(g.name) + '</li>';
      }).join('') + '</ul>';
  }

  // Documents that are expired or about to expire. The photo is the one thing
  // on this screen that can step aside for them.
  function whoName(id) {
    var p = App.person(id);
    return p && p.name ? p.name : (id || '');
  }

  function alerts() {
    var list = (D.docAlerts || []).slice().sort(function (a, b) { return a.days_left - b.days_left; });
    if (!list.length) return '';
    var expired = list.filter(function (d) { return d.days_left < 0; }).length;
    var shown = list.slice(0, 4);
    var more = list.length - shown.length;
    var sub = expired
      ? expired + ' vencido' + (expired === 1 ? '' : 's') + (list.length > expired ? ' · ' + (list.length - expired) + ' por vencer' : '')
      : list.length + ' por vencer';
    return '<div class="al-head">' +
        '<div class="al-label">Vencimientos</div>' +
        '<div class="al-sub">' + sub + '</div>' +
      '</div>' +
      '<div class="al-list">' + shown.map(function (d) {
        var late = d.days_left < 0;
        var days = Math.abs(d.days_left);
        var when = late ? 'venció hace ' + days + ' d' : (days === 0 ? 'vence hoy' : 'vence en ' + days + ' d');
        return '<div class="al-row' + (late ? ' is-late' : '') + '">' +
          '<div class="al-main"><b>' + App.esc(d.country) + ' · ' + App.esc(d.doc_type) + '</b>' +
          '<small>' + App.esc(whoName(d.owner)) + '</small></div>' +
          '<div class="al-when"><b class="num">' + (days === 0 ? 'hoy' : days + ' d') + '</b>' +
          '<small>' + when + '</small></div>' +
        '</div>';
      }).join('') + '</div>' +
      (more > 0 ? '<div class="al-more">+' + more + ' más</div>' : '');
  }

  // Chores due in the routine that is running now — real rows, same set the
  // chores view shows.
  function choresNow() {
    var r = App.currentRoutine();
    var list = (D.chores || []).filter(function (c) { return c.r === r.id || c.r === 'any'; });
    var done = list.filter(function (c) { return c.done; }).length;
    var left = list.filter(function (c) { return !c.done; }).slice(0, 2);
    if (!list.length) {
      return '<div class="label">Chores</div><div class="h-todo-empty serif"><i>Nothing today</i></div>';
    }
    return '<div class="label">Chores · ' + r.name + '</div>' +
      '<div class="h-stat"><span class="num">' + done + '</span><small>of ' + list.length + ' done</small></div>' +
      '<ul class="h-recent">' + left.map(function (c) {
        return '<li><i></i>' + App.esc(c.title) + '</li>';
      }).join('') + '</ul>';
  }

  // Documents past or near expiry. Rare by design, so it is a strip that only
  // exists when it has news — never a card holding the best space hostage.
  function alertBar() {
    var list = (D.docAlerts || []).slice().sort(function (a, b) { return a.days_left - b.days_left; });
    if (!list.length) return '';
    var shown = list.slice(0, 2), more = list.length - shown.length;
    return '<div class="ab-label">Vence</div>' + shown.map(function (d) {
      var late = d.days_left < 0, days = Math.abs(d.days_left);
      return '<div class="ab-row' + (late ? ' is-late' : '') + '">' +
        '<b>' + App.esc(d.country) + ' · ' + App.esc(d.doc_type) + '</b>' +
        '<span>' + App.esc(whoName(d.owner)) + '</span>' +
        '<span class="num">' + (late ? 'venció hace ' + days + ' d' : (days === 0 ? 'vence hoy' : 'en ' + days + ' d')) + '</span>' +
        '</div>';
    }).join('') + (more > 0 ? '<div class="ab-more">+' + more + ' más</div>' : '');
  }

  function paint() {
    var el = V.el;
    el.querySelector('.h-clock').innerHTML = clock();
    el.querySelector('.h-weather').innerHTML = weather();
    el.querySelector('.h-hero-slot').innerHTML = hero();
    el.querySelector('.h-lanes').innerHTML = lanes();
    el.querySelector('.h-todos-card').innerHTML = todos();
    el.querySelector('.h-shop').innerHTML = shopping();
    el.querySelector('.h-chores').innerHTML = choresNow();
    var bar = alertBar();
    el.querySelector('.h-alertbar').innerHTML = bar;
    el.querySelector('.home').classList.toggle('has-alerts', !!bar);
  }

  App.register('home', {
    show: function (el) {
      V.el = el;
      if (!el.firstChild) {
        el.innerHTML = '<div class="home">' +
          '<div class="h-clock" data-go="calendar"></div>' +
          '<div class="h-weather"></div>' +
          '<div class="h-alertbar"></div>' +
          '<div class="h-main"><div class="h-hero-slot"></div><div class="h-lanes" style="grid-template-columns:repeat(' + D.people.length + ',1fr)"></div></div>' +
          '<div class="h-side">' +
          '  <button class="h-todos-card card" data-go="todos"></button>' +
          '  <button class="h-chores card" data-go="chores"></button>' +
          '  <button class="h-shop card" data-go="shopping"></button>' +
          '</div></div>';
        el.addEventListener('click', function (e) {
          var ev = e.target.closest('[data-ev]');
          if (ev) { App.eventSheet(App.findEvent(ev.dataset.ev)); return; }
          var g = e.target.closest('[data-go]');
          if (g) App.go(g.dataset.go);
        });
      }
      paint();
    }
  });
  // Every minute: just the clock and next-up countdown (cheap, even while hidden). Weather on the hour.
  App.on('minute', function (n) {
    if (!V.el || !V.el.firstChild) return;
    V.el.querySelector('.h-clock').innerHTML = clock();
    V.el.querySelector('.h-hero-slot').innerHTML = hero();
    if (n.getMinutes() === 0) { V.el.querySelector('.h-weather').innerHTML = weather(); V.el.querySelector('.h-lanes').innerHTML = lanes(); }
  });
  App.on('data', function () { if (App.current === 'home') paint(); });
})();
