/* home-hub.js — Portada de GolazoX: alimenta el hub de la home con lo más
   importante del fútbol (noticias, mercado, clasificación, cracks) desde la
   API pública same-origin. CSP-safe: sin inline handlers, imágenes externas
   servidas por los proxies /newsimg y /tmbadge. Carga diferida y tolerante a
   fallos: si una fuente cae, su tarjeta muestra un aviso discreto pero el
   resto de la portada funciona. */
(function () {
  'use strict';

  var hub = document.getElementById('gx-hub');
  if (!hub) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function getJSON(url) {
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  // El API ya puede devolver la imagen como ruta proxy (/newsimg?u=...) o como
  // URL externa cruda. Solo envolvemos las externas; las ya proxiadas se usan
  // tal cual (envolver dos veces produce 400).
  function newsImg(u) {
    if (!u) return '';
    if (u.charAt(0) === '/') return u;
    return '/newsimg?u=' + encodeURIComponent(u);
  }
  function crest(club) {
    var b = club && club.badge;
    return b ? '<img src="' + esc(b) + '" alt="" loading="lazy">' : '';
  }
  // Flujo de traspaso con escudos: [escudo] Origen → [escudo] Destino
  function flow(x) {
    var from = (x.from && x.from.name) || '?';
    var to = (x.to && x.to.name) || '?';
    return crest(x.from) + '<b>' + esc(from) + '</b>' +
      '<span class="arrow">→</span>' + crest(x.to) + '<b>' + esc(to) + '</b>';
  }
  // Línea de meta de jugador: Posición · Edad · Nacionalidad (los que existan)
  function playerMeta(x) {
    var parts = [];
    if (x.position) parts.push(esc(x.position));
    if (x.age) parts.push(esc(x.age) + ' años');
    if (x.nat) parts.push(esc(x.nat));
    return parts.length ? '<span class="hub-block-meta">' + parts.join(' · ') + '</span>' : '';
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    return 'hace ' + Math.floor(h / 24) + ' d';
  }
  // "220,00 mill. €" → "220 M€" · "1.200,00 mill. €" → "1200 M€"
  function compactVal(s) {
    s = String(s == null ? '' : s);
    var m = s.match(/([\d.,]+)\s*mill/i);
    if (m) {
      var n = Math.round(parseFloat(m[1].replace(/\./g, '').replace(',', '.')));
      if (!isNaN(n)) return n + ' M€';
    }
    return s;
  }
  function fail(el, msg) {
    if (el) el.innerHTML = '<p style="color:var(--grey);font-size:.82rem;padding:.6rem 0">' + esc(msg) + '</p>';
  }
  // CSP no permite onerror inline: ocultamos imágenes rotas asignando el
  // handler por JS sobre las <img> ya insertadas en el contenedor.
  function hideBrokenImgs(container, mode) {
    if (!container) return;
    var imgs = container.querySelectorAll('img');
    Array.prototype.forEach.call(imgs, function (img) {
      img.onerror = function () {
        if (mode === 'hidden') this.style.visibility = 'hidden';
        else this.style.display = 'none';
      };
    });
  }

  /* ── 1) NOTICIAS ── */
  function renderNews(data) {
    var lead = $('hub-lead');
    var list = $('hub-news-list');
    var apply = function (d) {
      var g = d.general || [];
      if (!g.length) { fail(list, 'Sin noticias por ahora.'); if (lead) lead.style.display = 'none'; return; }
      var top = g[0];
      var img = top.image ? '<img class="hub-lead-img" src="' + esc(newsImg(top.image)) + '" alt="" loading="lazy">' : '';
      lead.href = top.link || '/noticias';
      lead.target = '_blank'; lead.rel = 'noopener';
      lead.innerHTML = img +
        '<span class="hub-lead-body">' +
          '<span class="hub-lead-src">' + esc(top.source || 'Noticia') + ' · ' + esc(timeAgo(top.ts)) + '</span>' +
          '<span class="hub-lead-title">' + esc(top.title) + '</span>' +
        '</span>';
      hideBrokenImgs(lead, 'display');
      list.innerHTML = g.slice(1, 6).map(function (n) {
        var thumb = n.image ? '<img class="hl-thumb" src="' + esc(newsImg(n.image)) + '" alt="" loading="lazy">' : '';
        return '<li><a href="' + esc(n.link || '/noticias') + '" target="_blank" rel="noopener">' + thumb +
          '<span class="hl-body">' +
          '<span class="hl-meta"><span class="hl-src">' + esc(n.source || 'Noticia') + '</span>' +
          (n.ts ? '<span class="hl-time">' + esc(timeAgo(n.ts)) + '</span>' : '') + '</span>' +
          '<span class="hl-title">' + esc(n.title) + '</span></span></a></li>';
      }).join('');
      hideBrokenImgs(list, 'hidden');
    };
    if (data) { try { apply(data); } catch (e) {} return; }
    getJSON('/api/news').then(apply).catch(function () { fail(list, 'No se pudieron cargar las noticias.'); if (lead) lead.style.display = 'none'; });
  }

  /* ── 2) MERCADO — fichajes confirmados + rumores del día (juntos) ── */
  function renderMarket(transfers, rumors, news) {
    var body = $('hub-market-body');
    if (!body) return;
    // Objetivo: mantener la columna (alta) llena en cualquier escenario. Si no
    // hay confirmados (típico en dev), rellenamos con más rumores; si los hay,
    // equilibramos ambos bloques hasta ~7 fichas en total.
    var TARGET = 7;
    var apply = function (tData, rData, nData) {
      var tList = (tData && tData.list) || [];
      var rList = ((rData && rData.list) || []).filter(function (x) { return typeof x.prob === 'number'; });
      rList.sort(function (a, b) { return b.prob - a.prob; });
      var confirmed = tList.filter(function (t) { return t && t.player; });
      var rums = rList.filter(function (r) { return r && r.player; });
      var fich = (nData && nData.fichajes) || [];
      var html = '';
      if (confirmed.length) {
        // Datos frescos de Transfermarkt → fichajes confirmados reales.
        var nConf = Math.min(confirmed.length, 4);
        var nRum = Math.min(rums.length, Math.max(3, TARGET - nConf));
        confirmed = confirmed.slice(0, nConf);
        html += '<div class="hub-sub-head hub-sub-fee">✅ Fichajes confirmados</div>';
        html += confirmed.map(function (t) {
          return '<a class="hub-block" href="/fichajes">' +
            '<span class="hub-block-name">' + esc(t.player) + '</span>' +
            '<span class="hub-block-flow">' + flow(t) + (t.fee && t.fee.label ? ' <b>· ' + esc(t.fee.label) + '</b>' : '') + '</span>' +
            playerMeta(t) + '</a>';
        }).join('');
        rums = rums.slice(0, nRum);
      } else if (fich.length) {
        // Sin confirmados frescos (p. ej. Transfermarkt caído): mostramos la
        // última hora del mercado de ESTE AÑO desde las noticias de fichajes, en
        // vez de repetir un snapshot antiguo. Esto es lo genuinamente actual.
        var nNews = Math.min(fich.length, 4);
        html += '<div class="hub-sub-head hub-sub-news">📰 Última hora del mercado</div>';
        html += fich.slice(0, nNews).map(function (n) {
          var thumb = n.image ? '<img class="hub-mkt-thumb" src="' + esc(newsImg(n.image)) + '" alt="" loading="lazy">' : '';
          return '<a class="hub-mkt-news" href="' + esc(n.link || '/noticias') + '" target="_blank" rel="noopener">' + thumb +
            '<span class="hub-mkt-news-body">' +
            '<span class="hub-mkt-news-src">' + esc(n.source || 'Mercado') + (n.ts ? ' · ' + esc(timeAgo(n.ts)) : '') + '</span>' +
            '<span class="hub-mkt-news-title">' + esc(n.title) + '</span>' +
            '</span></a>';
        }).join('');
        rums = rums.slice(0, Math.min(rums.length, Math.max(3, TARGET - nNews)));
      } else {
        rums = rums.slice(0, Math.min(rums.length, TARGET));
      }
      if (rums.length) {
        html += '<div class="hub-sub-head hub-sub-hot">🔥 Rumores del día</div>';
        html += rums.map(function (r) {
          var p = Math.max(0, Math.min(100, r.prob));
          return '<a class="hub-block" href="/fichajes">' +
            '<span class="hub-block-name">' + esc(r.player) + '</span>' +
            '<span class="hub-block-flow">' + flow(r) + '</span>' +
            '<span class="hub-prob"><span class="hub-prob-bar"><span class="hub-prob-fill" style="width:' + esc(p) + '%"></span></span>' +
            '<span class="hub-prob-val">' + esc(r.prob) + '%</span></span></a>';
        }).join('');
      }
      body.innerHTML = html || '<p style="color:var(--grey);font-size:.82rem;padding:.6rem 0">Mercado sin novedades.</p>';
      hideBrokenImgs(body, 'hidden');
    };
    if (transfers || rumors || news) { try { apply(transfers, rumors, news); } catch (e) {} return; }
    var td = null, rd = null, nd = null, pending = 3;
    var done = function () { pending--; if (pending > 0) return; apply(td, rd, nd); };
    getJSON('/api/transfers').then(function (d) { td = d; }).catch(function () {}).then(done);
    getJSON('/api/rumors').then(function (d) { rd = d; }).catch(function () {}).then(done);
    getJSON('/api/news').then(function (d) { nd = d; }).catch(function () {}).then(done);
  }

  /* ── 3) CLASIFICACIÓN (con pestañas de liga + rotación automática) ── */
  var _stTimer = null;
  function renderStandings(data) {
    var tabs = $('hub-league-tabs');
    var body = $('hub-standings-list');
    if (_stTimer) { clearInterval(_stTimer); _stTimer = null; }
    var apply = function (d) {
      var leagues = (d.leagues || []).filter(function (l) { return l.top && l.top.length; });
      if (!leagues.length) { tabs.innerHTML = ''; fail(body, 'Clasificación no disponible.'); return; }

      var cur = 0;
      var paused = false;
      var userStopped = false;

      function paint(idx) {
        cur = idx;
        var l = leagues[idx];
        Array.prototype.forEach.call(tabs.children, function (b, i) {
          b.classList.toggle('is-active', i === idx);
          b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
        });
        body.innerHTML = l.top.map(function (t) {
          var badge = t.badge ? '<img class="hub-badge" src="' + esc(t.badge) + '" alt="" loading="lazy">' : '<span class="hub-badge"></span>';
          return '<a class="hub-tr" href="/clasificaciones">' +
            '<span class="hub-pos">' + esc(t.pos) + '</span>' + badge +
            '<span class="hub-club">' + esc(t.club) + '</span>' +
            '<span class="hub-pts">' + esc(t.points) + '<small>PTS</small></span></a>';
        }).join('');
        hideBrokenImgs(body, 'hidden');
      }

      function stopAuto() {
        userStopped = true;
        if (_stTimer) { clearInterval(_stTimer); _stTimer = null; }
      }
      function startAuto() {
        if (_stTimer || leagues.length < 2) return;
        _stTimer = setInterval(function () {
          if (paused || userStopped) return;
          paint((cur + 1) % leagues.length);
        }, 4500);
      }

      tabs.innerHTML = leagues.map(function (l, i) {
        return '<button class="hub-lg-tab" type="button" role="tab" aria-selected="false" data-idx="' + i + '">' +
          esc(l.flag || '') + ' ' + esc(l.short || l.name) + '</button>';
      }).join('');
      Array.prototype.forEach.call(tabs.children, function (b) {
        b.addEventListener('click', function () { stopAuto(); paint(parseInt(b.getAttribute('data-idx'), 10)); });
      });
      // Pausa la rotación mientras el usuario mira (hover), sin detenerla del todo.
      var card = tabs.closest ? tabs.closest('.hub-card') : null;
      if (card) {
        card.addEventListener('mouseenter', function () { paused = true; });
        card.addEventListener('mouseleave', function () { paused = false; });
      }
      paint(0);
      startAuto();
    };
    if (data) { try { apply(data); } catch (e) {} return; }
    getJSON('/api/standings-summary').then(apply).catch(function () { if (tabs) tabs.innerHTML = ''; fail(body, 'Clasificación no disponible.'); });
  }

  /* ── 4) AGENDA DEL DÍA — partidos de hoy + próximas fechas clave ── */
  var _MES_AG = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function renderAgenda(data) {
    var body = $('hub-agenda-body');
    if (!body) return;
    var apply = function (d) {
      var evs = (d && d.events) || [];
      if (!evs.length) { fail(body, 'Sin fechas próximas.'); return; }
      body.innerHTML = evs.slice(0, 6).map(function (e) {
        // Partido de hoy → tarjeta de encuentro (local vs visitante).
        if (e.type === 'match') {
          var parts = splitTeams(e.title);
          var home = e.home || parts[0] || 'Por confirmar';
          var away = e.away || parts[1] || '';
          return '<a class="hub-ag-match" href="/agenda">' +
            '<span class="hub-agm-time">' + esc(e.time || 'HOY') + '<small>hoy</small></span>' +
            '<span class="hub-agm-body">' +
            (e.comp ? '<span class="hub-agm-comp">' + (e.icon ? esc(e.icon) + ' ' : '') + esc(e.comp) + '</span>' : '') +
            '<span class="hub-agm-teams"><b>' + esc(home) + '</b>' +
            (away ? '<i>vs</i><b>' + esc(away) + '</b>' : '') + '</span>' +
            '</span></a>';
        }
        // Hito de calendario (arranque de liga, sorteo, gala…).
        var dt = e.date ? new Date(e.date) : null;
        var day = dt && !isNaN(dt) ? dt.getDate() : '';
        var mon = dt && !isNaN(dt) ? _MES_AG[dt.getMonth()] : '';
        var sub = [];
        if (e.comp) sub.push('<b>' + esc(e.comp) + '</b>');
        if (e.time) sub.push(esc(e.time));
        return '<a class="hub-agenda-item" href="/agenda">' +
          '<span class="hub-ag-date"><b>' + esc(day) + '</b><small>' + esc(mon) + '</small></span>' +
          '<span class="hub-ag-info">' +
          '<span class="hub-ag-title">' + (e.icon ? esc(e.icon) + ' ' : '') + esc(e.title) + '</span>' +
          (sub.length ? '<span class="hub-ag-sub">' + sub.join(' · ') + '</span>' : '') +
          '</span></a>';
      }).join('');
    };
    if (data) { try { apply(data); } catch (e) {} return; }
    getJSON('/api/agenda').then(apply).catch(function () { fail(body, 'Agenda no disponible.'); });
  }

  /* ── 5) PARTIDOS DE HOY EN TV ── */
  // Separa "Boca - Estudiantes" / "Boca vs Estudiantes" en [local, visitante].
  function splitTeams(s) {
    s = String(s == null ? '' : s).trim();
    var m = s.split(/\s+(?:-|vs\.?|·)\s+/i);
    if (m.length >= 2) return [m[0], m.slice(1).join(' ')];
    return [s, ''];
  }
  function renderTv(data, agenda) {
    var wrap = $('hub-tv');
    var scroll = $('hub-tv-scroll');
    var dateEl = $('hub-tv-date');
    if (!wrap || !scroll) return;
    var moreChip = '<a class="hub-tv-more" href="/agenda"><span>📅</span><b>Ver agenda<br>completa</b></a>';
    // Chip a partir de un evento de la parrilla TV.
    function chipFromTv(e) {
      var t = splitTeams(e.teams);
      var match = t[1]
        ? '<span class="hub-tv-match"><span class="hub-tv-team">' + esc(t[0]) + '</span>' +
          '<span class="hub-tv-vs">VS</span>' +
          '<span class="hub-tv-team">' + esc(t[1]) + '</span></span>'
        : '<span class="hub-tv-match"><span class="hub-tv-team">' + esc(t[0] || 'Por confirmar') + '</span></span>';
      return '<a class="hub-tv-chip' + (e.big ? ' is-big' : '') + '" href="/agenda">' +
        '<span class="hub-tv-top">' +
        '<span class="hub-tv-comp">' + esc(e.competition || 'Fútbol') + '</span>' +
        '<span class="hub-tv-time">' + esc(e.time || '') + '</span></span>' +
        match +
        (e.channel ? '<span class="hub-tv-chan">' + esc(e.channel) + '</span>' : '') + '</a>';
    }
    // Chip a partir de un partido de la agenda (ESPN) — fallback si no hay parrilla TV.
    function chipFromAgenda(e) {
      var parts = splitTeams(e.title);
      var home = e.home || parts[0] || 'Por confirmar';
      var away = e.away || parts[1] || '';
      var match = away
        ? '<span class="hub-tv-match"><span class="hub-tv-team">' + esc(home) + '</span>' +
          '<span class="hub-tv-vs">VS</span>' +
          '<span class="hub-tv-team">' + esc(away) + '</span></span>'
        : '<span class="hub-tv-match"><span class="hub-tv-team">' + esc(home) + '</span></span>';
      return '<a class="hub-tv-chip is-big" href="/agenda">' +
        '<span class="hub-tv-top">' +
        '<span class="hub-tv-comp">' + esc((e.icon ? e.icon + ' ' : '') + (e.comp || 'Fútbol')) + '</span>' +
        '<span class="hub-tv-time">' + esc(e.time || 'HOY') + '</span></span>' +
        match + '</a>';
    }
    var apply = function (d) {
      var day = d && d.today;
      var evs = (day && day.events) || [];
      if (evs.length) {
        if (dateEl) dateEl.textContent = (day.label || 'Hoy') + (day.dateStr ? ' · ' + day.dateStr : '');
        var chips = evs.map(chipFromTv);
        chips.push(moreChip);
        scroll.innerHTML = chips.join('');
        wrap.hidden = false;
        return;
      }
      // Fallback: partidos de hoy desde la agenda (fuente ESPN).
      var matches = ((agenda && agenda.events) || []).filter(function (e) { return e && e.type === 'match'; });
      if (matches.length) {
        if (dateEl) dateEl.textContent = 'Hoy';
        var chips2 = matches.map(chipFromAgenda);
        chips2.push(moreChip);
        scroll.innerHTML = chips2.join('');
        wrap.hidden = false;
        return;
      }
      wrap.hidden = true;
    };
    if (data) { try { apply(data); } catch (e) { wrap.hidden = true; } return; }
    wrap.hidden = true;
  }

  function load() {
    // Un solo fetch agregado para portada rápida; si falla, endpoints sueltos.
    getJSON('/api/home').then(function (d) {
      renderNews(d.news || {});
      renderMarket(d.transfers || {}, d.rumors || {}, d.news || {});
      renderStandings(d.standings || {});
      renderAgenda(d.agenda || {});
      renderTv(d.tv || {}, d.agenda || {});
    }).catch(function () {
      renderNews();
      renderMarket();
      renderStandings();
      renderAgenda();
    });
  }

  /* ── Enrutador de vistas: Portada (#main-hub-wrap) vs Simulador/otros ──
     Mantiene Portada y Simulador como vistas separadas sin tocar los bundles
     minificados: parchea TRN.switchMainTab para mostrar/ocultar la portada y
     escucha los enlaces con [data-view] (hero, sim-back, side-nav). */
  function initViewRouter() {
    var hubWrap = document.getElementById('main-hub-wrap');
    if (!hubWrap) return;

    function setNavActive(view) {
      var links = document.querySelectorAll('.side-nav .side-link[data-view]');
      Array.prototype.forEach.call(links, function (a) {
        var on = a.getAttribute('data-view') === view;
        a.classList.toggle('side-link-active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    }
    function showHub(isHub) {
      hubWrap.classList.toggle('hidden', !isHub);
      setNavActive(isHub ? 'hub' : 'match');
    }

    // Parche: cualquier cambio de tab (por click o programático) sincroniza la portada.
    // OJO: TRN se declara con `const` en tournament.js → es un binding léxico global,
    // accesible por nombre desnudo pero NO como `window.TRN` (siempre undefined).
    if (typeof TRN !== 'undefined' && typeof TRN.switchMainTab === 'function' && !TRN.__hubPatched) {
      var orig = TRN.switchMainTab;
      TRN.switchMainTab = function (t) {
        var r = orig.apply(this, arguments);
        showHub(t === 'hub');
        return r;
      };
      TRN.__hubPatched = true;
    }

    function go(view) {
      if (typeof TRN !== 'undefined' && typeof TRN.switchMainTab === 'function') { TRN.switchMainTab(view); return; }
      // Fallback si el bundle del simulador no cargó.
      ['main-match-wrap', 'main-pen-wrap', 'main-trn-wrap', 'main-profile-wrap'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.classList.toggle('hidden', !(id === 'main-' + view + '-wrap'));
      });
      var bar = document.querySelector('.main-tabs-bar');
      if (bar) Array.prototype.forEach.call(bar.querySelectorAll('.main-tab-btn'), function (b) {
        b.classList.toggle('main-tab-active', b.getAttribute('data-tab') === view);
      });
      showHub(view === 'hub');
      window.scrollTo(0, 0);
    }

    // Enlaces con data-view (hero CTA, "← Portada", side-nav) → cambio de vista sin recarga.
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('a[data-view]');
      if (!el) return;
      var view = el.getAttribute('data-view');
      if (!view) return;
      e.preventDefault();
      go(view);
    });

    // Estado inicial: si el enlace profundo abre el simulador, oculta la portada.
    var p = new URLSearchParams(location.search);
    var tab = p.get('tab');
    var hasMatch = !!(p.get('a') && p.get('b'));
    if (hasMatch) { go('match'); }
    else if (tab && ['match', 'pen', 'trn'].indexOf(tab) !== -1) { showHub(false); }
    else { showHub(true); }
  }
  initViewRouter();

  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout: 2500 });
  } else {
    setTimeout(load, 400);
  }

  /* ── Auto-refresco de la portada ──
     Re-carga los datos agregados (/api/home) cada 3 min mientras la pestaña está
     visible, para que noticias/mercado/clasificación/agenda/partidos se
     actualicen solos sin recargar la página. Se pausa en segundo plano y
     refresca al instante al volver si los datos ya llevan rato. */
  var AUTO_MS = 3 * 60 * 1000;
  var _lastLoad = Date.now();
  function autoLoad() {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - _lastLoad < AUTO_MS) return;
    _lastLoad = Date.now();
    load();
  }
  setInterval(autoLoad, 60 * 1000);
  document.addEventListener('visibilitychange', autoLoad);
})();
