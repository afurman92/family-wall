// To do: the family list (real items). Chores is a separate, demo screen. (lane card, emoji badges,
// progress ring) but fed by real items from /api/items.
// The frame token is read-only, so the rows show and do not tick.
(function () {
  'use strict';
  var V = { el: null };

  // Decoration only: the badge is chosen from the words in the title. Unknown
  // titles get a neutral pin, never an invented meaning.
  var ICONS = [
    [/maternity|embaraz|pregnan/i, '🤰'],
    [/crib|cuna/i, '🛏️'],
    [/cochecito|stroller|carrito/i, '🚼'],
    [/silla de auto|car seat|autosilla/i, '🚗'],
    [/silla de lactancia|mecedora|glider/i, '🪑'],
    [/silla|chair/i, '🪑'],
    [/ropa|canguro|polos/i, '👕'],
    [/pa[;:ñn]al|pa;an|diaper/i, '🧷'],
    [/mesite|cambio|changing/i, '🧴'],
    [/ba[nñ]erita|ba[nñ]era|bath/i, '🛁'],
    [/moco|nasal/i, '👃'],
    [/succ\w*onador|sacaleche|pump|extractor/i, '🍼'],
    [/term\w*tro|thermometer/i, '🌡️'],
    [/lactancia/i, '🤱'],
    [/guarder|jard[ií]n|daycare|jcc/i, '🏫'],
    [/email|correo|mail/i, '✉️'],
    [/excel|planilla|spreadsheet|patiens/i, '📊'],
    [/plan familiar|plan/i, '📝'],
    [/hablar|llamar|call/i, '💬'],
    [/bolso|bag|mochila/i, '👜'],
    [/casa|home|ordenar/i, '🏠'],
    [/roller|carrito/i, '🛒'],
    [/car\b|auto/i, '🚗']
  ];

  function icon(title) {
    for (var i = 0; i < ICONS.length; i++) if (ICONS[i][0].test(title)) return ICONS[i][1];
    return '📌';
  }

  function dueLabel(t) {
    if (!t.due_at) return '';
    var d = new Date(t.due_at);
    if (isNaN(d.getTime())) return '';
    var now = App.now();
    var days = Math.round(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
        new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000
    );
    var txt = days < 0 ? 'Late' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    return '<small class="' + (days < 0 ? 'ch-late' : '') + '">' + txt + '</small>';
  }

  function row(t) {
    return '<div class="ch' + (t.done ? ' is-done' : '') + '">' +
      '<span class="ch-emoji">' + icon(t.title) +
        '<span class="ch-check"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>' +
      '</span>' +
      '<span class="ch-text"><b>' + App.esc(t.title) + '</b>' + dueLabel(t) + '</span>' +
      '</div>';
  }

  function render() {
    if (!V.el) return;
    var all = (window.LIVE_ITEMS || []).filter(function (i) { return i.kind === 'task'; });
    var open = all.filter(function (t) { return !t.done; });
    var done = all.length - open.length;
    var list = open.concat(all.filter(function (t) { return t.done; }));

    V.el.innerHTML = '<div class="tasks">' +
      '<header class="t-head">' +
        '<div class="t-title"><div class="label">Casa</div><h1 class="serif">To do</h1></div>' +
        '<div class="t-progress">' +
          '<span class="num">' + done + '<small>/' + all.length + '</small></span>' +
          '<div class="t-bar"><i style="width:' + (all.length ? done / all.length * 100 : 0) + '%"></i></div>' +
          '<span class="label">done</span>' +
        '</div>' +
      '</header>' +
      '<div class="ch-lanes ch-lanes--one">' +
        '<section class="ch-lane" style="--c:#22201C;--c-ink:#FBF9F4;--c-rgb:34 32 28">' +
          '<header class="ch-head">' +
            '<span class="ch-emoji ch-emoji--head">🧺</span>' +
            '<div><b>Pendientes</b><span class="ch-sub">' + open.length + ' en la lista' + (done ? ' · ' + done + ' hechas' : '') + '</span></div>' +
            '<div class="ch-ring">' + App.ring(done, all.length || 1, 46) +
              '<span class="num">' + (all.length ? done + '/' + all.length : '–') + '</span></div>' +
          '</header>' +
          '<div class="ch-list ch-list--cols">' +
            (list.length ? list.map(row).join('')
              : '<div class="ch-none serif"><i>La lista está vacía</i></div>') +
          '</div>' +
        '</section>' +
      '</div>' +
      '</div>';
  }

  App.register('todos', {
    show: function (el) { V.el = el; render(); },
    // every re-entry: the list may have changed on the phone
    resume: function () { render(); }
  });

  App.on('data', function () { if (App.current === 'todos') render(); });
})();
