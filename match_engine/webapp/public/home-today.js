/* home-today.js — "Hoy en el fútbol": muestra lo más importante del hub en la
   portada del simulador, consumiendo la API pública. CSP-safe (sin inline).
   Se carga en diferido y solo revela la sección si hay datos, para no romper
   el layout del simulador si la API falla o está fría. */
(function () {
  'use strict';
  var sec = document.getElementById('home-today');
  var grid = document.getElementById('home-today-grid');
  if (!sec || !grid) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function card(href, tag, title, sub) {
    return '<a class="ht-card" href="' + href + '">' +
      '<span class="ht-tag">' + esc(tag) + '</span>' +
      '<span class="ht-title">' + esc(title) + '</span>' +
      (sub ? '<span class="ht-sub">' + esc(sub) + '</span>' : '') +
      '</a>';
  }

  function flow(t) {
    var from = (t.from && t.from.name) || '';
    var to = (t.to && t.to.name) || '';
    return from + ' → ' + to;
  }

  function load() {
    var cards = [];
    var pending = 3;
    var done = function () {
      pending--;
      if (pending > 0) return;
      if (!cards.length) return; // nada que mostrar
      grid.innerHTML = cards.join('');
      sec.hidden = false;
    };

    // 1) Fichaje destacado (el más caro del día)
    fetch('/api/transfers').then(function (r) { return r.json(); }).then(function (d) {
      var t = (d.list || [])[0];
      if (t && t.player) {
        cards.push(card('/fichajes', '💸 Fichaje destacado', t.player,
          flow(t) + (t.fee && t.fee.label ? ' · ' + t.fee.label : '')));
      }
    }).catch(function () {}).then(done);

    // 2) Rumor más caliente
    fetch('/api/rumors').then(function (r) { return r.json(); }).then(function (d) {
      var list = (d.list || []).filter(function (x) { return typeof x.prob === 'number'; });
      list.sort(function (a, b) { return b.prob - a.prob; });
      var r0 = list[0];
      if (r0 && r0.player) {
        cards.push(card('/fichajes', '🔥 Rumor caliente', r0.player,
          flow(r0) + ' · ' + r0.prob + '%'));
      }
    }).catch(function () {}).then(done);

    // 3) Máximo goleador
    fetch('/api/stats').then(function (r) { return r.json(); }).then(function (d) {
      var s = (d.scorers || [])[0];
      if (s && s.player) {
        cards.push(card('/estadisticas', '⚽ Pichichi', s.player,
          ((s.club && s.club.name) || '') + ' · ' + s.goals + ' goles'));
      }
    }).catch(function () {}).then(done);
  }

  // Carga diferida: no competir con el arranque del simulador.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout: 4000 });
  } else {
    setTimeout(load, 2500);
  }
})();
