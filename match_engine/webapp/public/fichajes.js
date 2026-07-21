/* Fichajes y noticias — navegación por pestañas (CSP-safe, servido como 'self'). */
(function () {
  var tabs = document.querySelectorAll('.tab[data-tab]');
  var panels = document.querySelectorAll('.panel');
  var sideLinks = document.querySelectorAll('.side-link');

  function syncSideNav(name) {
    // Resalta en el menú izquierdo el enlace acorde a la pestaña activa.
    var wantNews = name === 'noticias';
    sideLinks.forEach(function (l) {
      var href = l.getAttribute('href') || '';
      var isNews = /#noticias/.test(href);
      var isTransfers = /\/fichajes$/.test(href);
      if (isNews) l.classList.toggle('side-link-active', wantNews);
      else if (isTransfers) l.classList.toggle('side-link-active', !wantNews);
    });
  }

  function show(name) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    panels.forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    syncSideNav(name);
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      show(t.dataset.tab);
      history.replaceState(null, '', '#' + t.dataset.tab);
    });
  });
  function showFromHash() {
    var name = (location.hash || '').replace('#', '');
    if (name === 'noticias' || name === 'fichajes') show(name);
  }
  showFromHash();
  // Al pulsar un enlace del menú (/fichajes#noticias) estando ya en la página,
  // el navegador solo cambia el hash sin recargar → escuchar hashchange.
  window.addEventListener('hashchange', showFromHash);

  var subtabs = document.querySelectorAll('.subtab');
  var subpanels = document.querySelectorAll('.subpanel');
  subtabs.forEach(function (s) {
    s.addEventListener('click', function () {
      subtabs.forEach(function (x) { x.classList.toggle('active', x === s); });
      subpanels.forEach(function (p) { p.classList.toggle('active', p.id === 'sub-' + s.dataset.sub); });
    });
  });

  // Imágenes de noticias que fallan: ocultar el contenedor y colapsar el hueco.
  function handleBrokenImage(img) {
    var wrap = img.closest('.news-thumb, .news-hero-img');
    if (wrap) wrap.remove();
    var card = img.closest('.news-item, .news-hero');
    if (card) card.classList.remove('has-img');
  }
  document.querySelectorAll('.news-thumb img, .news-hero-img img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) { handleBrokenImage(img); return; }
    img.addEventListener('error', function () { handleBrokenImage(img); });
  });

  // ── Contadores animados (stats bar) ──
  function formatMoney(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',') + ' M €';
    if (v >= 1e3) return Math.round(v / 1e3) + ' K €';
    return String(v);
  }
  function animateCount(el) {
    var target = parseFloat(el.dataset.count) || 0;
    var money = el.classList.contains('is-money');
    if (target <= 0) { el.textContent = money ? '0 €' : '0'; return; }
    var start = performance.now(), dur = 1100;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      var val = target * eased;
      el.textContent = money ? formatMoney(val) : Math.round(val).toLocaleString('es-ES');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('.stat-val[data-count]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { animateCount(e.target); io.unobserve(e.target); }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (c) { io.observe(c); });
    } else {
      counters.forEach(animateCount);
    }
  }

  // ── Buscador de fichajes ──
  var search = document.getElementById('tsearch');
  var searchClear = document.getElementById('tsearchClear');
  var searchEmpty = document.getElementById('searchEmpty');
  function runSearch() {
    var q = (search.value || '').trim().toLowerCase();
    searchClear.hidden = !q;
    var active = document.querySelector('.subpanel.active');
    if (!active) return;
    var cards = active.querySelectorAll('.tcard');
    var visible = 0;
    cards.forEach(function (c) {
      var hit = !q || (c.dataset.search || '').indexOf(q) !== -1;
      c.classList.toggle('hide', !hit);
      if (hit) visible++;
    });
    // Al buscar, oculta el ranking y el título para centrarse en resultados.
    active.querySelectorAll('.chart-box, h2').forEach(function (el) {
      el.style.display = q ? 'none' : '';
    });
    if (searchEmpty) searchEmpty.hidden = !(q && visible === 0);
  }
  if (search) {
    search.addEventListener('input', runSearch);
    searchClear.addEventListener('click', function () { search.value = ''; runSearch(); search.focus(); });
    subtabs.forEach(function (s) { s.addEventListener('click', runSearch); });
  }

  // ── Filtro por medio (noticias) ──
  var nfilters = document.querySelectorAll('.nfilter');
  nfilters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      nfilters.forEach(function (b) { b.classList.toggle('active', b === btn); });
      var src = btn.dataset.src;
      document.querySelectorAll('#tab-noticias .news-item, #tab-noticias .news-hero').forEach(function (el) {
        el.classList.toggle('hide', src && el.dataset.source !== src);
      });
      // Oculta grupos que se quedan sin resultados visibles.
      document.querySelectorAll('.news-group').forEach(function (g) {
        var any = g.querySelector('.news-hero:not(.hide), .news-item:not(.hide)');
        g.classList.toggle('hide', !any);
      });
    });
  });

  // ── Auto-refresh en vivo ──
  var ago = document.querySelector('.ago');
  var pill = document.getElementById('refreshPill');
  function relative(ms) {
    var s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return 'hace un momento';
    var m = Math.floor(s / 60);
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : 'hace ' + d + ' días';
  }
  if (ago && ago.dataset.updated) {
    var updated = parseInt(ago.dataset.updated, 10);
    setInterval(function () { ago.textContent = 'actualizado ' + relative(updated); }, 60000);
    // Sondea el servidor cada 3 min; si hay datos más nuevos, muestra la píldora.
    setInterval(function () {
      fetch('/fichajes/ping').then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.updated && d.updated > updated + 1000) { if (pill) pill.hidden = false; }
      }).catch(function () {});
    }, 180000);
  }
  if (pill) pill.addEventListener('click', function () { location.reload(); });
})();

