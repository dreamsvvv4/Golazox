/* clasificaciones.js — interacción de la página de clasificaciones (CSP-safe). */
(function () {
  'use strict';

  var tabs   = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel[role="tabpanel"]'));

  function show(code) {
    var found = false;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === code;
      t.classList.toggle('active', on);
      if (on) found = true;
    });
    panels.forEach(function (p) {
      p.classList.toggle('active', p.id === 'lg-' + code);
    });
    if (found) {
      try { history.replaceState(null, '', '#' + code); } catch (e) {}
      runSearch(); // re-aplica el filtro al cambiar de liga
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { show(t.getAttribute('data-tab')); });
  });

  // Abrir liga desde el hash (#ES1, #GB1, …).
  var initial = (location.hash || '').replace('#', '');
  if (initial && document.getElementById('lg-' + initial)) show(initial);

  // ── Buscador de equipos (filtra la tabla de la liga activa) ──
  var input = document.getElementById('lsearch');
  var clear = document.getElementById('lsearchClear');

  function runSearch() {
    if (!input) return;
    var q = input.value.trim().toLowerCase();
    if (clear) clear.hidden = !q;
    var active = document.querySelector('.panel.active');
    if (!active) return;
    // Restaura todas las tablas ocultas de paneles inactivos.
    Array.prototype.forEach.call(document.querySelectorAll('.ltable tr.hide'), function (tr) {
      if (!active.contains(tr)) tr.classList.remove('hide');
    });
    var rows = active.querySelectorAll('.ltable tbody tr');
    Array.prototype.forEach.call(rows, function (tr) {
      var hay = (tr.getAttribute('data-search') || '');
      tr.classList.toggle('hide', q && hay.indexOf(q) === -1);
    });
  }

  if (input) {
    input.addEventListener('input', runSearch);
  }
  if (clear) {
    clear.addEventListener('click', function () {
      input.value = '';
      runSearch();
      input.focus();
    });
  }

  // ── Sub-toggle Clasificación / Calendario (por liga) ──
  Array.prototype.forEach.call(document.querySelectorAll('.lgviews'), function (group) {
    var btns = Array.prototype.slice.call(group.querySelectorAll('.lgview'));
    var panel = group.parentNode; // .panel de la liga
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        btns.forEach(function (b) { b.classList.toggle('active', b === btn); });
        Array.prototype.forEach.call(panel.querySelectorAll('.lgview-panel'), function (p) {
          p.classList.toggle('active', p.classList.contains('view-' + view));
        });
      });
    });
  });
})();
