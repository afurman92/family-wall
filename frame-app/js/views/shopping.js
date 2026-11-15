// Shopping: what is still to buy, grouped the way the aisles are.
// Read-only. The wall cannot save, and a checkbox that loses its tick on the
// next refresh is worse than no checkbox: the list is edited from the web.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null };

  function open() { return D.groceries.filter(function (g) { return !g.done; }); }
  function got() { return D.groceries.filter(function (g) { return g.done; }); }

  function row(g) {
    return '<div class="s-row">' +
      '<span class="s-dot"></span>' +
      '<span class="s-name"><b>' + App.esc(g.name) + '</b>' + (g.note ? '<small>' + App.esc(g.note) + '</small>' : '') + '</span>' +
      (g.qty > 1 ? '<span class="s-qty-n num">×' + g.qty + '</span>' : '') +
      '</div>';
  }

  function listHTML() {
    var items = open();
    if (!items.length) return '<div class="s-empty serif">All stocked up.<br><i>Nothing left to buy.</i></div>';
    var order = (D.catOrder.all || []).concat(['Other']);
    return order.map(function (cat) {
      var rows = items.filter(function (g) { return g.cat === cat; });
      if (!rows.length) return '';
      return '<div class="s-cat"><div class="s-cat-h"><span class="label">' + cat + '</span>' +
        '<span class="label">' + rows.length + '</span></div>' + rows.map(row).join('') + '</div>';
    }).join('');
  }

  function render() {
    var items = open(), gotCount = got().length;
    V.el.innerHTML = '<div class="shop">' +
      '<header class="s-head">' +
      '  <div><div class="label">Shared list</div><h1 class="serif">Groceries</h1></div>' +
      '  <div class="s-count"><span class="num">' + items.length + '</span> to get</div>' +
      '</header>' +
      '<div class="s-list">' + listHTML() + '</div>' +
      (gotCount ? '<div class="s-got-line"><b class="num">' + gotCount + '</b> ya comprados</div>' : '') +
      '</div>';
  }

  App.register('shopping', {
    show: function (el) { V.el = el; render(); },
    resume: function () { if (V.el) render(); }
  });

  App.on('data', function () { if (App.current === 'shopping' && V.el) render(); });
})();
