// Air fryer cheat sheet: a plain lookup table, filled from the web door.
// Read-only here — the wall shows the numbers, the phone edits them.
(function () {
  'use strict';
  var V = { el: null, rows: null, loading: false, error: null };

  function token() {
    var m = location.pathname.match(/\/frame\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    try { return new URLSearchParams(location.search).get('token'); } catch (e) { return null; }
  }

  function head(n) {
    return '<header class="r-head">' +
      '<div><div class="label">Cocina</div><h1 class="serif">Air Fryer</h1></div>' +
      '<div class="r-count"><span class="num">' + n + '</span> datos</div>' +
      '</header>';
  }

  function body() {
    if (V.loading && !V.rows) return '<div class="r-empty serif">Cargando…</div>';
    if (V.error) return '<div class="r-empty serif">' + App.esc(V.error) + '</div>';
    if (!V.rows || !V.rows.length) {
      return '<div class="r-empty serif">Todavía no hay datos.<br><i>Agregalos desde la web.</i></div>';
    }
    return '<div class="af">' +
      '<div class="af-head">' +
        '<span>Ingrediente</span><span>Modo</span><span>Porción</span><span>Tiempo</span><span>Temp</span>' +
      '</div>' +
      V.rows.map(function (r) {
        return '<div class="af-row">' +
          '<span class="af-ing">' + App.esc(r.ingredient) +
            (r.note ? '<small class="af-note">' + App.esc(r.note) + '</small>' : '') + '</span>' +
          '<span class="af-mode">' + App.esc(r.mode || '—') + '</span>' +
          '<span class="af-num">' + r.servings + '</span>' +
          '<span class="af-num">' + (r.minutes != null ? r.minutes + '<small>min</small>' : '—') + '</span>' +
          '<span class="af-num">' + (r.temp_f != null ? r.temp_f + '<small>°F</small>' : '—') + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  function render() {
    if (!V.el) return;
    V.el.innerHTML = '<div class="af-view">' + head(V.rows ? V.rows.length : 0) + body() + '</div>';
  }

  function load() {
    V.loading = true;
    render();
    fetch('/api/air-fryer?token=' + encodeURIComponent(token()), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { V.rows = j.rows || []; V.loading = false; V.error = null; render(); })
      .catch(function (e) {
        V.loading = false;
        V.error = 'No se pudo cargar la hoja.';
        render();
        console.warn('[airfryer]', e);
      });
  }

  App.register('airfryer', {
    show: function (el) {
      V.el = el;
      if (App.resetIdle) App.resetIdle();
      load(); // re-read every time: the phone may have added rows since last look
    },
    // show() runs only on the first build; resume() runs on every re-entry,
    // which is when the phone may have added rows.
    resume: function () {
      if (App.resetIdle) App.resetIdle();
      load();
    },
    hide: function () { V.rows = null; }
  });
})();
