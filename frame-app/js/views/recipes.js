// Recipes: the family cookbook, ported from Notion.
// Grid of recipes -> tap one -> full-screen, two-column cooking view.
(function () {
  'use strict';
  var V = { el: null, cat: 'especial', open: null, loading: false, error: null, scale: 4, base: 4 };

  // ------------------------------------------------------------ scaling
  // Ingredients are free text ("2 pechugas ... (900 g – 1 kg)"). Two rules:
  //   - the leading quantity is always scaled;
  //   - a quantity in parentheses is scaled only when the line is counted
  //     (>= 2 units), because "(180–200 g)" on "1 cebolla" describes ONE onion,
  //     while "(900 g – 1 kg)" on "2 pechugas" is the total for both.
  // Lines with no number at all ("Sal", "al gusto") are left untouched.
  var FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  var NUM = '(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?|[¼½¾⅓⅔])';

  function parseNum(s) {
    s = String(s).trim();
    if (FRAC[s] !== undefined) return FRAC[s];
    s = s.replace(',', '.');
    var m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
    m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
    return parseFloat(s);
  }

  function fmt(n) {
    if (!isFinite(n)) return '';
    var r = Math.round(n * 100) / 100;
    var w = Math.floor(r);
    var f = r - w;
    var TABLE = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
    for (var i = 0; i < TABLE.length; i++) {
      if (Math.abs(f - TABLE[i][0]) < 0.02) return (w ? String(w) : '') + TABLE[i][1];
    }
    if (Math.abs(f) < 0.005) return String(w);
    return r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  // Formats one quantity, rounding grams/millilitres to whole numbers.
  function fmtQty(n, unit) {
    var u = (String(unit) || '').toLowerCase();
    if (u === 'g' || u === 'gr' || u === 'gramos' || u === 'ml' || u === 'mililitros') {
      return n >= 10 ? String(Math.round(n)) : fmt(n);
    }
    return fmt(n);
  }

  // "2", "5–6", "6 a 8 cucharadas", "900 g" -> scaled text.
  // The unit is written ONCE at the end, never after each end of the range,
  // and grams/millilitres flip to kg/l (or back) when the size justifies it.
  function scaleRange(text, f) {
    var m = new RegExp(
      '^\\s*(' + NUM + ')(?:\\s*([–—-]|a)\\s*(' + NUM + '))?(?:\\s*([a-zA-Záéíóúñ]+))?\\s*$'
    ).exec(text);
    if (!m) return text;

    var a = parseNum(m[1]) * f;
    var sep = m[2] || '–';
    var b = m[3] ? parseNum(m[3]) * f : null;
    var unit = m[4] || '';
    var u = unit.toLowerCase();
    var top = b === null ? a : Math.max(a, b);

    var conv = 1, out = unit;
    if ((u === 'g' || u === 'gr' || u === 'gramos') && top >= 1000) { conv = 1 / 1000; out = 'kg'; }
    else if ((u === 'kg' || u === 'kilos' || u === 'kilogramos') && top < 1) { conv = 1000; out = 'g'; }
    else if ((u === 'ml' || u === 'mililitros') && top >= 1000) { conv = 1 / 1000; out = 'l'; }
    else if ((u === 'l' || u === 'litro' || u === 'litros') && top < 0.1) { conv = 1000; out = 'ml'; }

    var fa = fmtQty(a * conv, out);
    var fb = b !== null ? fmtQty(b * conv, out) : null;
    var joiner = /[a-z]/i.test(sep) ? ' a ' : sep;
    var body = fb !== null ? fa + joiner + fb : fa;
    return body + (out ? ' ' + out : '');
  }

  // The noun phrase sits before the first "de/con/para" or punctuation:
  // "cebolla roja mediana (180–200 g)" -> "cebolla roja mediana".
  function phraseEnd(t) {
    var m = /\s+(?:de|del|con|para|en|al)\s|\(|,/i.exec(t);
    return m ? m.index : t.length;
  }

  // Measurement words never take a plural: "1800 g", not "1800 ges".
  var MEASURE = /^(g|gr|gramos?|kg|kilos?|kilogramos?|ml|mililitros?|l|litros?|cm|mm|m|min|minutos?|horas?|segundos?|grados?)$/i;

  // Spanish agreement on the noun phrase only: 1 dientes -> 1 diente,
  // 1 cebolla -> 2 cebollas. Skipped entirely when the phrase still contains a
  // second number (a range), so "900 g - 1 kg" is never touched.
  function agree(t, n) {
    var end = phraseEnd(t);
    var head = t.slice(0, end);
    var tail = t.slice(end);
    var afterNumber = head.replace(/^\s*[^\s]+/, '');
    if (/\d/.test(afterNumber)) return t;

    var words = head.split(/(\s+)/);
    var first = null;
    for (var i = 0; i < words.length; i++) {
      if (/^[a-záéíóúñü]+$/i.test(words[i])) { first = words[i]; break; }
    }
    if (!first) return t;
    var isMeasure = MEASURE.test(first);

    var out = words.map(function (w) {
      if (!/^[a-záéíóúñü]+$/i.test(w)) return w;
      if (isMeasure) {
        // "1 litros" -> "1 litro"; never "2 litross"
        return n <= 1 && /s$/i.test(w) && w.length > 3 ? w.replace(/s$/i, '') : w;
      }
      if (n <= 1) return /s$/i.test(w) && w.length > 3 ? w.replace(/s$/i, '') : w;
      if (/s$/i.test(w)) return w;
      if (/[aeiouáéíóú]$/i.test(w)) return w + 's';
      if (/z$/i.test(w)) return w.slice(0, -1) + 'ces';
      return w + 'es';
    });
    return out.join('') + tail;
  }

  function scaleText(text, f) {
    if (f === 1 || !text) return text;
    var t = String(text);

    // parentheses first, using the ORIGINAL lead to decide whether they scale
    var leadRe = new RegExp('^\\s*(' + NUM + ')(?:\\s*([–—-]|a)\\s*(' + NUM + '))?');
    var leadMatch = leadRe.exec(t);
    var leadVal = leadMatch ? parseNum(leadMatch[1]) : 0;

    t = t.replace(/\(([^)]*)\)/g, function (whole, inner) {
      if (!new RegExp(NUM).test(inner)) return whole;
      var shouldScale = leadMatch
        ? leadVal >= 2
        : /(?:g|kg|gr|gramos|ml|l|litros?|tazas?|cucharadas?|cucharaditas?)/i.test(inner);
      if (!shouldScale) return whole;
      var qty = new RegExp(
        '(' + NUM + '(?:\\s*[–—-]\\s*' + NUM + ')?(?:\\s*[a-zA-Záéíóúñ]+)?)',
        'g'
      );
      var scaled = inner.replace(qty, function (m) { return scaleRange(m, f); });
      var first = new RegExp('^\\s*(' + NUM + ')').exec(scaled);
      if (first && parseNum(first[1]) <= 1) scaled = agree(scaled, parseNum(first[1]));
      return '(' + scaled + ')';
    });

    // then the leading quantity, keeping whatever follows it
    if (leadMatch) {
      var replacement = scaleRange(leadMatch[0].trim(), f);
      var rest = t.slice(leadMatch[0].length).replace(/^\s+/, '');
      t = replacement + (rest ? ' ' + rest : '');
      var scaledLead = Math.round(leadVal * f * 100) / 100;
      t = agree(t, scaledLead);
    } else {
      // no leading number: scale quantities that appear mid-line
      // ("Salsa de soja: 6-8 cucharadas"), skipping parentheses already handled.
      t = t.replace(/\([^)]*\)|[^()]+/g, function (seg) {
        return seg.charAt(0) === '(' ? seg : scaleInline(seg, f);
      });
    }
    return t;
  }

  // Quantities repeated inside step text ("3/4 taza de caldo", "6 galletas").
  // Only food units are touched, so timings ("35-40 minutos") never change.
  var FOOD_UNIT = /^(tazas?|cucharadas?|cucharaditas?|g|gr|gramos?|kg|kilos?|ml|mililitros?|l|litros?|galletas?|dientes?|ramitas?|pechugas?|unidades?|latas?|sobres?|tiras?|hojas?|rebanadas?|rodajas?|porciones?|trozos?|cdtas?|cdas?|limones?|limas?)$/i;

  function scaleInline(text, f) {
    if (f === 1 || !text) return text;
    var re = new RegExp('(' + NUM + '(?:\\s*[–—-]\\s*' + NUM + ')?\\s+[a-zA-Záéíóúñ]+)', 'g');
    return String(text).replace(re, function (m) {
      var unit = m.replace(/^[\d\s.,/–—-]+/, '').trim();
      if (!FOOD_UNIT.test(unit)) return m;
      return scaleRange(m, f);
    });
  }

  function detectBase(blocks) {
    for (var i = 0; i < (blocks || []).length; i++) {
      if (blocks[i].t !== 'p') continue;
      var m = /para\s+(\d+)\s*personas/i.exec(blocks[i].text || '');
      if (m) return parseInt(m[1], 10);
    }
    return 4;
  }

  function token() {
    var m = location.pathname.match(/\/frame\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    try { return new URLSearchParams(location.search).get('token'); } catch (e) { return null; }
  }

  function all() {
    return (window.RECIPES || []).filter(function (r) { return r.category === V.cat; });
  }

  function tag(cat) { return cat === 'especial' ? 'Especial' : 'Diaria'; }

  function card(r) {
    return '<button class="r-card" data-id="' + r.id + '">' +
      '<span class="r-tag">' + tag(r.category) + '</span>' +
      '<b>' + App.esc(r.title) + '</b>' +
      '<small class="num">' + (r.ingredient_count || 0) + ' ing · ' + (r.step_count || 0) + ' pasos</small>' +
      '</button>';
  }

  // Group consecutive list items so they render as real lists.
  // `f` is the scaling factor; it only applies to ingredient bullets.
  function flow(blocks, f) {
    var out = [], run = null, kind = null;
    var hasIng = (blocks || []).some(function (b) {
      return b.t === 'h2' && /lista de compras|ingrediente/i.test(b.text || '');
    });
    var inIng = !hasIng; // no heading: treat bullets before the first numbered step as ingredients
    function flush() {
      if (!run) return;
      out.push('<' + kind + '>' + run.join('') + '</' + kind + '>');
      run = null; kind = null;
    }
    (blocks || []).forEach(function (b) {
      var t = b.t;
      if (t === 'h2') {
        inIng = hasIng ? /lista de compras|ingrediente/i.test(b.text || '') : false;
      }
      if (t === 'num' && !hasIng) inIng = false;
      var raw = b.text || '';
      var scaled = raw;
      if (t === 'li') scaled = scaleText(raw, f);
      else if (hasIng && (t === 'p' || t === 'quote' || t === 'num')) scaled = scaleInline(raw, f);
      var s = App.esc(scaled);
      if (t === 'li' || t === 'num') {
        var k = t === 'li' ? 'ul' : 'ol';
        if (kind !== k) { flush(); kind = k; run = []; }
        run.push('<li>' + s + '</li>');
        return;
      }
      flush();
      if (t === 'h1') out.push('<h2 class="r-h1 serif">' + s + '</h2>');
      else if (t === 'h2') out.push('<h3 class="r-h2">' + s + '</h3>');
      else if (t === 'h3') out.push('<h4 class="r-h3">' + s + '</h4>');
      else if (t === 'p') out.push('<p>' + s + '</p>');
      else if (t === 'quote') out.push('<blockquote>' + s + '</blockquote>');
      else if (t === 'hr') out.push('<hr>');
      else if (t === 'img' && b.url) out.push('<img class="r-img" src="' + App.esc(b.url) + '" alt="' + s + '">');
    });
    flush();
    return out.join('');
  }

  function head() {
    return '<header class="r-head">' +
      '<div><div class="label">Cocina</div><h1 class="serif">Recetas</h1></div>' +
      '<div class="seg r-cats">' +
        '<button data-cat="especial" class="' + (V.cat === 'especial' ? 'is-on' : '') + '">Especiales</button>' +
        '<button data-cat="diaria" class="' + (V.cat === 'diaria' ? 'is-on' : '') + '">Diarias</button>' +
      '</div>' +
      '<div class="r-count"><span class="num">' + all().length + '</span> recetas</div>' +
      '</header>';
  }

  function grid() {
    var list = all();
    if (!list.length) {
      return '<div class="r-empty serif">No recipes yet.<br><i>The cookbook is empty.</i></div>';
    }
    return '<div class="r-grid">' + list.map(card).join('') + '</div>';
  }

  function scaleBar() {
    var base = V.base || 4;
    var f = (V.scale || 4) / base;
    var note = base !== 4 ? ' <i>(escrita para ' + base + ')</i>' : '';
    var hint = Math.abs(f - 1) < 1e-9 ? 'como está escrita' : '×' + fmt(f);
    return '<div class="r-scale">' +
      '<span class="r-scale-label">Porciones' + note + '</span>' +
      '<div class="seg r-scale-btns">' +
        [2, 4, 6, 8].map(function (n) {
          return '<button data-scale="' + n + '" class="' + (V.scale === n ? 'is-on' : '') + '">' + n + '</button>';
        }).join('') +
      '</div>' +
      '<span class="r-scale-hint">' + hint + '</span>' +
      '</div>';
  }

  function detail() {
    if (V.loading) return '<div class="r-empty serif">Opening…</div>';
    if (V.error) return '<div class="r-empty serif">' + App.esc(V.error) + '</div>';
    var r = V.open;
    if (!r) return '';
    var f = (V.scale || 4) / (V.base || 4);
    return '<div class="r-detail">' +
      '<div class="r-dhead">' +
        '<button class="r-back" data-back>← Recetas</button>' +
        '<h1 class="serif">' + App.esc(r.title) + '</h1>' +
        '<span class="r-tag">' + tag(r.category) + '</span>' +
      '</div>' +
      scaleBar() +
      '<div class="r-flow">' + flow(r.body, f) + '</div>' +
      '</div>';
  }

  function render() {
    if (!V.el) return;
    // Never disturb an open recipe: live.js re-renders every 60s and that would
    // throw someone out of the page they are cooking from.
    if (V.open && V.el.querySelector(".r-detail")) return;
    V.el.innerHTML = V.open || V.loading || V.error
      ? detail()
      : '<div class="recipes">' + head() + grid() + '</div>';
  }

  function open(id) {
    V.loading = true; V.error = null; V.open = null;
    if (App.resetIdle) App.resetIdle();
    render();
    fetch('/api/recipes/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(token()), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { V.open = j.recipe; V.base = detectBase(j.recipe.body); V.loading = false; render(); })
      .catch(function (e) { V.loading = false; V.error = 'Could not open that recipe.'; render(); console.warn('[recipes]', e); });
  }

  function close() {
    V.open = null; V.error = null;
    if (App.resetIdle) App.resetIdle();
    render();
  }

  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-scale]'))) {
      V.scale = parseInt(t.dataset.scale, 10);
      if (App.resetIdle) App.resetIdle();
      if (V.el) V.el.innerHTML = detail();
      return;
    }
    if ((t = e.target.closest('[data-cat]'))) { V.cat = t.dataset.cat; return close(); }
    if ((t = e.target.closest('[data-back]'))) { return close(); }
    if ((t = e.target.closest('[data-id]'))) { return open(t.dataset.id); }
  }

  App.register('recipes', {
    show: function (el) {
      if (!V.el) { V.el = el; el.addEventListener('click', onClick); }
      if (V.loading) return;
      render();
    },
    // leaving the view releases the screen
    hide: function () {
      V.open = null; V.loading = false; V.error = null;
    }
  });

  // Exposed so the scaling rules can be tested outside the frame.
  (typeof window !== 'undefined' ? window : globalThis).RecipesScale = {
    scaleText: scaleText, scaleInline: scaleInline, fmt: fmt, detectBase: detectBase, parseNum: parseNum
  };
})();
