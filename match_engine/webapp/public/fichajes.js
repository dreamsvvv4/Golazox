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
      var isNews = /#noticias/.test(href) || /\/noticias$/.test(href);
      var isTransfers = /\/fichajes$/.test(href);
      if (isNews) l.classList.toggle('side-link-active', wantNews);
      else if (isTransfers) l.classList.toggle('side-link-active', !wantNews);
    });
  }

  function show(name) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    panels.forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    var hero = document.getElementById('heroTitle');
    if (hero) {
      var t = hero.getAttribute('data-title-' + name);
      if (t) hero.textContent = t;
    }
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
    if (name && document.querySelector('.tab[data-tab="' + name + '"]')) show(name);
  }
  showFromHash();
  // Al pulsar un enlace del menú (/fichajes#noticias) estando ya en la página,
  // el navegador solo cambia el hash sin recargar → escuchar hashchange.
  window.addEventListener('hashchange', showFromHash);

  // Sub-pestañas: se gestionan por panel para que cada grupo mantenga su propio
  // estado activo (Fichajes, Cracks y Estadísticas tienen grupos independientes).
  document.querySelectorAll('.panel').forEach(function (panel) {
    var st = panel.querySelectorAll('.subtab');
    var sp = panel.querySelectorAll('.subpanel');
    st.forEach(function (s) {
      s.addEventListener('click', function () {
        st.forEach(function (x) { x.classList.toggle('active', x === s); });
        sp.forEach(function (p) { p.classList.toggle('active', p.id === 'sub-' + s.dataset.sub); });
        if (typeof runSearch === 'function') runSearch();
      });
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
    if (!search) return;
    var q = (search.value || '').trim().toLowerCase();
    if (searchClear) searchClear.hidden = !q;
    // El buscador solo aplica al panel de Fichajes (tarjetas de traspaso).
    var active = document.querySelector('#tab-fichajes .subpanel.active');
    if (!active) return;
    var cards = active.querySelectorAll('.tcard');
    if (!cards.length) { if (searchEmpty) searchEmpty.hidden = true; return; }
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

  // ── Favoritos (seguir fichajes) + Compartir ──
  var FAV_KEY = 'gx_fav_transfers';
  function loadFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveFavs(arr) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  var favs = loadFavs();

  function paintFav(card) {
    var btn = card.querySelector('[data-fav-btn]');
    if (!btn) return;
    var key = card.dataset.fav;
    var on = favs.indexOf(key) !== -1;
    btn.classList.toggle('is-fav', on);
    btn.textContent = on ? '★' : '☆';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  // Estado inicial de todas las tarjetas.
  document.querySelectorAll('.tcard[data-fav]').forEach(paintFav);

  // Delegación: un solo listener para favoritos y compartir (tarjetas dinámicas).
  document.addEventListener('click', function (ev) {
    var favBtn = ev.target.closest && ev.target.closest('[data-fav-btn]');
    if (favBtn) {
      var card = favBtn.closest('.tcard[data-fav]');
      if (!card) return;
      var key = card.dataset.fav;
      var i = favs.indexOf(key);
      if (i === -1) favs.push(key); else favs.splice(i, 1);
      saveFavs(favs);
      document.querySelectorAll('.tcard[data-fav="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]').forEach(paintFav);
      paintFav(card);
      updateFavToggle();
      applyFavFilter();
      return;
    }
    var shareBtn = ev.target.closest && ev.target.closest('[data-share]');
    if (shareBtn) {
      var text = shareBtn.getAttribute('data-share') || '';
      var url = location.origin + '/fichajes';
      if (navigator.share) {
        navigator.share({ title: 'GolazoX · Fichajes', text: text, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text + ' — ' + url).then(function () {
          shareBtn.classList.add('copied');
          shareBtn.textContent = '✓';
          setTimeout(function () { shareBtn.classList.remove('copied'); shareBtn.textContent = '↗'; }, 1500);
        }).catch(function () {});
      }
    }
  });

  // Botón "Solo favoritos" en la barra de subtabs de fichajes.
  var favToggle = null;
  (function initFavToggle() {
    var subtabs = document.querySelector('#tab-fichajes .subtabs');
    if (!subtabs) return;
    favToggle = document.createElement('button');
    favToggle.className = 'subtab subtab-fav';
    favToggle.type = 'button';
    favToggle.innerHTML = '★ Favoritos<span class="count">0</span>';
    favToggle.addEventListener('click', function () {
      favToggle.classList.toggle('fav-active');
      applyFavFilter();
    });
    subtabs.appendChild(favToggle);
    updateFavToggle();
  })();

  function updateFavToggle() {
    if (!favToggle) return;
    var c = favToggle.querySelector('.count');
    if (c) c.textContent = favs.length;
    favToggle.hidden = favs.length === 0;
    if (favs.length === 0) { favToggle.classList.remove('fav-active'); applyFavFilter(); }
  }
  function applyFavFilter() {
    var onlyFav = favToggle && favToggle.classList.contains('fav-active');
    var active = document.querySelector('#tab-fichajes .subpanel.active');
    if (!active) return;
    active.querySelectorAll('.tcard[data-fav]').forEach(function (card) {
      var isFav = favs.indexOf(card.dataset.fav) !== -1;
      card.classList.toggle('fav-hide', onlyFav && !isFav);
    });
  }

  // ---- Buscador global (cross-tab) ----
  (function initGlobalSearch() {
    var box = document.querySelector('[data-gsearch]');
    if (!box) return;
    var input = box.querySelector('#gsearch-input');
    var out = box.querySelector('[data-gsearch-out]');
    var clearBtn = box.querySelector('[data-gsearch-clear]');
    if (!input || !out) return;

    var TAB_LABEL = { fichajes: 'Fichajes', noticias: 'Noticias', agenda: 'Agenda', valores: 'Cracks', estadisticas: 'Estadísticas' };

    // Construye el índice desde el DOM ya renderizado.
    function buildIndex() {
      var items = [];
      // Tarjetas de fichajes
      document.querySelectorAll('#tab-fichajes .tcard[data-fav]').forEach(function (el) {
        var name = (el.querySelector('.tplayer') || {}).textContent || '';
        var sub = (el.querySelector('.tflow') || {}).textContent || '';
        if (name.trim()) items.push({ el: el, tab: 'fichajes', name: name.trim(), sub: sub.replace(/\s+/g, ' ').trim() });
      });
      // Filas de rankings (valores + estadísticas)
      [['#tab-valores', 'valores'], ['#tab-estadisticas', 'estadisticas']].forEach(function (pair) {
        document.querySelectorAll(pair[0] + ' .rrow').forEach(function (el) {
          var name = (el.querySelector('.rname') || {}).textContent || '';
          var sub = (el.querySelector('.rsub') || {}).textContent || '';
          if (name.trim()) items.push({ el: el, tab: pair[1], name: name.trim(), sub: sub.replace(/\s+/g, ' ').trim() });
        });
      });
      return items;
    }
    var index = null;

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
    function norm(s) {
      return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    var activeIdx = -1, current = [];

    function search(q) {
      if (index === null) index = buildIndex();
      var nq = norm(q);
      var seen = {}, res = [];
      for (var i = 0; i < index.length && res.length < 12; i++) {
        var it = index[i];
        if (norm(it.name).indexOf(nq) === -1 && norm(it.sub).indexOf(nq) === -1) continue;
        var key = it.tab + '|' + it.name;
        if (seen[key]) continue;
        seen[key] = 1;
        res.push(it);
      }
      return res;
    }

    function renderResults(res) {
      current = res; activeIdx = -1;
      if (!res.length) {
        out.innerHTML = '<div class="gs-empty">Sin coincidencias.</div>';
        out.hidden = false; input.setAttribute('aria-expanded', 'true');
        return;
      }
      out.innerHTML = res.map(function (it, i) {
        return '<div class="gs-item" role="option" data-gi="' + i + '">' +
          '<div class="gs-txt"><div class="gs-name">' + esc(it.name) + '</div>' +
          (it.sub ? '<div class="gs-sub">' + esc(it.sub) + '</div>' : '') + '</div>' +
          '<span class="gs-tag">' + esc(TAB_LABEL[it.tab] || it.tab) + '</span></div>';
      }).join('');
      out.hidden = false; input.setAttribute('aria-expanded', 'true');
    }

    function close() {
      out.hidden = true; input.setAttribute('aria-expanded', 'false'); activeIdx = -1;
    }

    function go(it) {
      if (!it) return;
      var tabBtn = document.querySelector('.tabs .tab[data-tab="' + it.tab + '"]');
      if (tabBtn) tabBtn.click();
      // Si el elemento está en un subpanel no activo, activa su subtab.
      var subpanel = it.el.closest('.subpanel');
      if (subpanel && !subpanel.classList.contains('active')) {
        var sub = subpanel.id.replace('sub-', '');
        var subBtn = document.querySelector('#tab-' + it.tab + ' .subtab[data-sub="' + sub + '"]');
        if (subBtn) subBtn.click();
      }
      close();
      input.value = '';
      if (clearBtn) clearBtn.hidden = true;
      setTimeout(function () {
        it.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        it.el.classList.add('gs-flash');
        setTimeout(function () { it.el.classList.remove('gs-flash'); }, 1400);
      }, 120);
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (clearBtn) clearBtn.hidden = !q;
      if (q.length < 2) { close(); return; }
      renderResults(search(q));
    });
    input.addEventListener('keydown', function (e) {
      if (out.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx += (e.key === 'ArrowDown' ? 1 : -1);
        if (activeIdx < 0) activeIdx = current.length - 1;
        if (activeIdx >= current.length) activeIdx = 0;
        out.querySelectorAll('.gs-item').forEach(function (el, i) {
          el.classList.toggle('active', i === activeIdx);
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        go(current[activeIdx >= 0 ? activeIdx : 0]);
      } else if (e.key === 'Escape') {
        close();
      }
    });
    out.addEventListener('click', function (e) {
      var item = e.target.closest('.gs-item');
      if (item) go(current[+item.dataset.gi]);
    });
    if (clearBtn) clearBtn.addEventListener('click', function () {
      input.value = ''; clearBtn.hidden = true; close(); input.focus();
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target)) close();
    });
  })();
})();


