// tournament.js — GolazoX Tournament Engine v2.0
// Handles Wizard UI + bulk simulation + Dashboard (4 tabs)
'use strict';

const TRN = (() => {
  // ── State ───────────────────────────────────────────────
  let _fmt        = null;   // 'copa' | 'liga' | 'champions'
  let _numTeams   = 16;
  let _rules      = { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: false, extraTime: true };
  let _teams      = [];     // [{ slug, era, name }]
  let _draw       = [];     // Copa: [{ a, b }] first-round pairings
  let _groupsDraw = [];     // Champions: [[t1,t2,t3,t4], ...] pre-drawn groups
  let _data       = null;   // computed tournament result
  let _tab        = 'summary';
  let _matchCache = [];     // flat list for modal lookup
  let _badgeCache  = {};     // slug → badge URL

  const VALID_COUNTS = {
    copa:      [4, 8, 16, 32],
    liga:      [4, 6, 8, 10, 12, 14, 16, 18, 20],
    champions: [8, 12, 16, 20, 24, 32],
  };

  // ── DOM helpers ─────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');
  const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // _lang is defined in app.js as a top-level let (shared global scope)
  const _getLang = () => { try { return _lang || 'es'; } catch(_) { return 'es'; } };
  const _badge    = (slug) => _badgeCache[slug] || '';
  const _badgeImg = (slug, cls) => {
    const b = _badge(slug);
    return `<img class="${cls || 'trn-badge'}" src="${b || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">`;
  };

  // ── Main tab switching (⚽ Partido / 🏆 Torneo) ─────────
  function switchMainTab(tab) {
    $('main-match-wrap').classList.toggle('hidden', tab !== 'match');
    $('main-trn-wrap').classList.toggle('hidden', tab !== 'trn');
    document.querySelectorAll('.main-tab-btn').forEach(b =>
      b.classList.toggle('main-tab-active', b.dataset.tab === tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'trn' && !_fmt && !_data) showStep(1);
  }

  // ── Wizard step navigation ───────────────────────────────
  function showStep(n) {
    for (let i = 1; i <= 3; i++) {
      const el = $(`trn-step-${i}`);
      if (el) el.classList.toggle('hidden', i !== n);
    }
    // Update stepbar items
    document.querySelectorAll('.trn-stepbar-item').forEach(d => {
      const s = +d.dataset.step;
      d.classList.toggle('trn-stepbar-active', s === n);
      d.classList.toggle('trn-stepbar-done', s < n);
    });
    // Update connecting lines
    const l12 = $('trn-line-1-2');
    const l23 = $('trn-line-2-3');
    if (l12) l12.classList.toggle('trn-stepbar-line-done', n > 1);
    if (l23) l23.classList.toggle('trn-stepbar-line-done', n > 2);
    show($('trn-wizard'));
    hide($('trn-dashboard'));
  }

  function selectFormat(fmt) {
    _fmt = fmt;
    _teams = [];
    document.querySelectorAll('.trn-fmt-card').forEach(c =>
      c.classList.toggle('trn-fmt-selected', c.dataset.fmt === fmt));
    _buildNumTeamsPicker();
  }

  function _buildNumTeamsPicker() {
    const sel = $('trn-num-teams');
    if (!sel || !_fmt) return;
    const counts = VALID_COUNTS[_fmt] || [8, 16];
    sel.innerHTML = counts.map(n => `<option value="${n}">${n} equipos</option>`).join('');
    _numTeams = counts.includes(_numTeams) ? _numTeams : counts[Math.floor(counts.length / 2)];
    sel.value = _numTeams;
  }

  function goStep2() {
    if (!_fmt) { alert('Selecciona un formato.'); return; }
    _numTeams = +($('trn-num-teams')?.value || 16);
    const container = $('trn-rules-list');
    if (container) {
      let html = '';
      if (_fmt === 'copa') {
        html = `
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Formato de partido</span>
              <span class="trn-rule-hint">Partido único (estilo FA Cup) · Activo = Ida y Vuelta (estilo Copa del Rey)</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-idavuelta" class="trn-toggle-input" />
              <div class="trn-toggle"></div>
            </div>
          </label>
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Desempate</span>
              <span class="trn-rule-hint">Inactivo = Penaltis directos al 90' · Activo = Prórroga + Penaltis</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-extratime" class="trn-toggle-input" checked />
              <div class="trn-toggle"></div>
            </div>
          </label>`;
      } else if (_fmt === 'liga') {
        html = `
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Vueltas</span>
              <span class="trn-rule-hint">Inactivo = Solo Ida (torneo rápido) · Activo = Ida y Vuelta (temporada completa)</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-idavuelta" class="trn-toggle-input" />
              <div class="trn-toggle"></div>
            </div>
          </label>`;
      } else if (_fmt === 'champions') {
        html = `
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Fase de grupos</span>
              <span class="trn-rule-hint">Partido único (estilo Mundial) · Activo = Ida y Vuelta (estilo Champions)</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-grupos-idavuelta" class="trn-toggle-input" />
              <div class="trn-toggle"></div>
            </div>
          </label>
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Fase eliminatoria</span>
              <span class="trn-rule-hint">Activo = Ida y Vuelta en rondas KO · La final siempre a partido único</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-ko-idavuelta" class="trn-toggle-input" checked />
              <div class="trn-toggle"></div>
            </div>
          </label>`;
      }
      container.innerHTML = html;
    }
    showStep(2);
  }

  function goStep3() {
    if (_fmt === 'copa') {
      _rules.idaVuelta = !!$('trn-rule-idavuelta')?.checked;
      _rules.extraTime = !!$('trn-rule-extratime')?.checked;
    } else if (_fmt === 'liga') {
      _rules.idaVuelta = !!$('trn-rule-idavuelta')?.checked;
    } else if (_fmt === 'champions') {
      _rules.grupasIdaVuelta = !!$('trn-rule-grupos-idavuelta')?.checked;
      _rules.koIdaVuelta     = !!$('trn-rule-ko-idavuelta')?.checked;
    }
    _numTeams = +($('trn-num-teams')?.value || _numTeams);
    _teams = [];
    _draw = [];
    _groupsDraw = [];
    _renderTeamSlots();
    showStep(3);
  }

  function goBack(step) { showStep(step); }

  // ── Step 3: Team management ──────────────────────────────
  function _renderTeamSlots() {
    const container = $('trn-teams-list');
    if (!container) return;
    container.innerHTML = _teams.map((t, i) =>
      `<div class="trn-team-slot">
        ${_badgeImg(t.slug, 'trn-slot-badge')}
        <span class="trn-slot-name">${_esc(t.name)}</span>
        <button class="trn-slot-remove" onclick="TRN.removeTeam(${i})" title="Quitar">✕</button>
      </div>`
    ).join('') || '<p class="trn-teams-empty">Ningún equipo añadido todavía.<br><span style="font-size:.75rem;opacity:.6">Busca por nombre, país o usa ⚡ Aleatorio</span></p>';

    // Update count display
    const countEl = $('trn-teams-count');
    if (countEl) countEl.textContent = _teams.length;
    const totalEl = $('trn-teams-total');
    if (totalEl) totalEl.textContent = _numTeams;
    // Update progress bar fill
    const fill = $('trn-count-fill');
    if (fill) fill.style.width = `${Math.round(_teams.length / _numTeams * 100)}%`;

    const simBtn = $('trn-btn-simulate');
    if (simBtn) simBtn.disabled = (_teams.length !== _numTeams);
    const randomBtn = $('trn-btn-random');
    if (randomBtn) randomBtn.style.display = _teams.length < _numTeams ? '' : 'none';
    _updatePreDraw();
  }

  // ── Pre-draw: Copa bracket & Champions group draw ─────────
  function _generateDraw() {
    const shuffled = [..._teams].sort(() => Math.random() - 0.5);
    _draw = [];
    for (let i = 0; i < shuffled.length; i += 2)
      _draw.push({ a: shuffled[i], b: shuffled[i + 1] });
  }

  function _generateGroupsDraw() {
    const shuffled = [..._teams].sort(() => Math.random() - 0.5);
    const GRP_SIZE = 4;
    const n = Math.ceil(shuffled.length / GRP_SIZE);
    _groupsDraw = Array.from({ length: n }, (_, g) => shuffled.slice(g * GRP_SIZE, (g + 1) * GRP_SIZE));
  }

  function reshuffleDraw() {
    if (_teams.length !== _numTeams) return;
    _generateDraw();
    _renderPreDraw();
  }

  function reshuffleGroupsDraw() {
    if (_teams.length !== _numTeams) return;
    _generateGroupsDraw();
    _renderPreDraw();
  }

  function _updatePreDraw() {
    const el = $('trn-pre-draw');
    if (!el) return;
    if (_teams.length < _numTeams || _fmt === 'liga') { el.classList.add('hidden'); return; }
    if (_fmt === 'copa'      && _draw.length !== _numTeams / 2) _generateDraw();
    if (_fmt === 'champions' && _groupsDraw.length === 0)        _generateGroupsDraw();
    _renderPreDraw();
  }

  function _renderPreDraw() {
    const el = $('trn-pre-draw');
    if (!el) return;
    el.classList.remove('hidden');
    if (_fmt === 'copa') {
      const ROUND_NAMES = {
        4: 'Semifinales', 8: 'Cuartos de final',
        16: 'Octavos de final', 32: 'Dieciseisavos', 64: 'Treinta y dos avos',
      };
      const roundName = ROUND_NAMES[_numTeams] || `Primera ronda (${_numTeams / 2} eliminatorias)`;
      let html = `<div class="trn-draw-header">
        <span class="trn-label">🎲 ${_esc(roundName)}</span>
        <button class="trn-draw-reshuffle" onclick="TRN.reshuffleDraw()">🔀 Nuevo sorteo</button>
      </div><div class="trn-copa-draw-grid">`;
      _draw.forEach((m, i) => {
        html += `<div class="trn-copa-draw-match">
          <span class="trn-draw-num">${i + 1}</span>
          <div class="trn-copa-draw-side">${_badgeImg(m.a.slug,'trn-draw-badge')}<span class="trn-copa-draw-team">${_esc(m.a.name)}</span></div>
          <span class="trn-copa-draw-vs">vs</span>
          <div class="trn-copa-draw-side trn-copa-draw-side-b">${_badgeImg(m.b.slug,'trn-draw-badge')}<span class="trn-copa-draw-team">${_esc(m.b.name)}</span></div>
        </div>`;
      });
      html += `</div>`;
      el.innerHTML = html;
    } else if (_fmt === 'champions') {
      let html = `<div class="trn-draw-header">
        <span class="trn-label">🎲 Sorteo de grupos</span>
        <button class="trn-draw-reshuffle" onclick="TRN.reshuffleGroupsDraw()">🔀 Nuevo sorteo</button>
      </div><div class="trn-groups-draw-grid">`;
      _groupsDraw.forEach((grp, g) => {
        html += `<div class="trn-group-draw-card">
          <div class="trn-group-draw-label">Grupo ${String.fromCharCode(65 + g)}</div>
          ${grp.map(t => `<div class="trn-group-draw-team">${_badgeImg(t.slug,'trn-draw-badge')} <span>${_esc(t.name)}</span></div>`).join('')}
        </div>`;
      });
      html += `</div>`;
      el.innerHTML = html;
    } else {
      el.innerHTML = '';
      el.classList.add('hidden');
    }
  }

  // Team search (debounced)
  let _searchTimer = null;
  function onTeamSearch(val) {
    clearTimeout(_searchTimer);
    const q = val.trim();
    const res = $('trn-search-results');
    const clr = $('trn-search-clear');
    if (clr) clr.classList.toggle('hidden', !val.length);
    if (!res) return;
    if (q.length < 2) { res.innerHTML = ''; res.classList.add('hidden'); return; }
    _searchTimer = setTimeout(() => _doSearch(q), 200);
  }

  async function _doSearch(q) {
    const res = $('trn-search-results');
    if (!res) return;
    try {
      const r = await fetch(`/suggest?q=${encodeURIComponent(q)}&limit=8`);
      if (!r.ok) return;
      const data = await r.json();
      if (!data.length) {
        res.innerHTML = '<div class="trn-search-empty">Sin resultados</div>';
        res.classList.remove('hidden');
        return;
      }
      res.innerHTML = data.map(t => {
        const name  = _esc(t.nameEs || t.name || t.nameEn || t.slug || '');
        const slug  = _esc(t.slug  || name);
        const badge = _esc(t.badge || '');
        const meta  = t.era ? _esc(t.era) : '';
        return `<div class="trn-search-item" onclick="TRN.addTeam('${slug}','${name}','','${badge}')">
          <img class="trn-si-badge" src="${badge || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <span class="trn-search-item-name">${name}</span>
          ${meta ? `<span class="trn-search-item-meta">${meta}</span>` : ''}
        </div>`;
      }).join('');
      res.classList.remove('hidden');
    } catch (_) { /* ignore network errors */ }
  }

  function addTeam(slug, name, era = '', badge = '') {
    if (_teams.length >= _numTeams) return;
    if (_teams.some(t => t.slug === slug)) return;
    if (badge) _badgeCache[slug] = badge;
    _teams.push({ slug, name, era });
    clearSearch();
    _renderTeamSlots();
  }

  function clearSearch() {
    const inp = $('trn-search-input');
    if (inp) inp.value = '';
    const res = $('trn-search-results');
    if (res) { res.innerHTML = ''; res.classList.add('hidden'); }
    const clr = $('trn-search-clear');
    if (clr) clr.classList.add('hidden');
  }

  function removeTeam(idx) {
    _teams.splice(idx, 1);
    _renderTeamSlots();
  }

  async function fillRandom() {
    const needed = _numTeams - _teams.length;
    if (needed <= 0) return;
    try {
      const r = await fetch('/catalog');
      if (!r.ok) return;
      const catalog = await r.json();
      const existing = new Set(_teams.map(t => t.slug));
      const pool = catalog.filter(t => !existing.has(t.slug));
      const picks = pool.sort(() => Math.random() - 0.5).slice(0, needed);
      picks.forEach(t => {
        if (t.badge) _badgeCache[t.slug] = t.badge;
        _teams.push({ slug: t.slug, name: t.nameEs || t.nameEn || t.slug, era: '' });
      });
      _renderTeamSlots();
    } catch (_) { /* ignore */ }
  }

  // ── Bulk simulation call ─────────────────────────────────
  async function _bulkSim(matchSpecs) {
    // Split into batches of 50 if needed
    const BATCH = 50;
    const all = [];
    for (let i = 0; i < matchSpecs.length; i += BATCH) {
      const batch = matchSpecs.slice(i, i + BATCH);
      const r = await fetch('/simulate-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: batch, lang: _getLang() }),
      });
      if (!r.ok) throw new Error(`simulate-bulk ${r.status}`);
      const results = await r.json();
      all.push(...results);
    }
    return all;
  }

  // ── Run simulation entry point ───────────────────────────
  async function runSimulation() {
    if (_teams.length !== _numTeams) return;
    show($('trn-progress'));
    hide($('trn-step-3-actions'));
    $('trn-progress-text').textContent = 'Iniciando simulación…';

    try {
      let data;
      if (_fmt === 'copa')        data = await _simulateCopa();
      else if (_fmt === 'liga')   data = await _simulateLiga();
      else                        data = await _simulateChampions();

      _data = data;
      _computeTournamentStats(_data);
      _buildMatchCache(_data);
      hide($('trn-step-3'));
      await _showChampionReveal(_data);
      _renderDashboard();
      show($('trn-dashboard'));
    } catch (err) {
      console.error('[TRN]', err);
      $('trn-progress-text').textContent = '⚠ Error en la simulación. Inténtalo de nuevo.';
      show($('trn-step-3-actions'));
    }
  }

  function _setProgress(txt) {
    const el = $('trn-progress-text');
    if (el) el.textContent = txt;
  }

  // ── Match cache (built once after simulation, used by bracket + calendar) ─
  function _buildMatchCache(data) {
    _matchCache = [];
    _getAllMatches(data).forEach(m => {
      m._cacheIdx = _matchCache.length;
      _matchCache.push({ m, nameA: m.a?.name || '?', nameB: m.b?.name || '?' });
    });
  }

  // ── Champion reveal ──────────────────────────────────────
  function _confetti() {
    const el = $('trn-confetti');
    if (!el) return;
    const colors = ['#f5c518','#00d4ff','#7b2ff7','#ff4d6d','#4cffb4','#fff'];
    el.innerHTML = '';
    for (let i = 0; i < 65; i++) {
      const p = document.createElement('div');
      p.className = 'trn-confetti-p';
      const size = 4 + Math.random() * 7;
      p.style.left = Math.random() * 100 + '%';
      p.style.width  = size + 'px';
      p.style.height = (Math.random() > 0.4 ? size : size * 2.5) + 'px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      p.style.animationDelay    = Math.random() * 2 + 's';
      p.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
      p.style.opacity = '1';
      el.appendChild(p);
    }
  }

  async function _showChampionReveal(data) {
    const el = $('trn-champion-reveal');
    if (!el) return;
    const badge = _badge(data.champion?.slug);
    const imgEl = $('trn-reveal-badge');
    if (imgEl) { imgEl.src = badge || '/img/badges/_placeholder.svg'; }
    const nameEl = $('trn-reveal-name');
    if (nameEl) nameEl.textContent = data.champion?.name || '—';
    const fmtEl = $('trn-reveal-format');
    if (fmtEl) fmtEl.textContent =
      data.format === 'copa' ? '🏆 Copa · Campeón' :
      data.format === 'liga' ? '📊 Liga · Campeón' : '⭐ Champions · Campeón';
    el.classList.remove('hidden');
    _confetti();
    await new Promise(res => {
      const t = setTimeout(() => { el.classList.add('hidden'); res(); }, 4200);
      el.addEventListener('click', () => { clearTimeout(t); el.classList.add('hidden'); res(); }, { once: true });
    });
  }

  // ── Visual bracket (KO tree) ─────────────────────────────
  function _computeBracketPositions(rounds) {
    const MATCH_H = 84, PAIR_GAP = 8, INTER_PAIR = 16;
    const positions = [];
    for (let ri = 0; ri < rounds.length; ri++) {
      const n = rounds[ri].matches.length;
      const rowPos = [];
      if (ri === 0) {
        for (let mi = 0; mi < n; mi++) {
          const pi = Math.floor(mi / 2), ii = mi % 2;
          const pairTop = pi * (2 * MATCH_H + PAIR_GAP + INTER_PAIR);
          rowPos.push({ top: pairTop + ii * (MATCH_H + PAIR_GAP) });
        }
      } else {
        const prev = positions[ri - 1];
        for (let mi = 0; mi < n; mi++) {
          const c1 = prev[mi * 2].top + MATCH_H / 2;
          const c2 = (prev[mi * 2 + 1] || prev[mi * 2]).top + MATCH_H / 2;
          rowPos.push({ top: Math.round((c1 + c2) / 2 - MATCH_H / 2) });
        }
      }
      positions.push(rowPos);
    }
    return positions;
  }

  function _renderBktMatchCard(m, topPx) {
    const isWinA = m.winner?.slug === m.a?.slug;
    const isWinB = m.winner?.slug === m.b?.slug;
    const bA = _badge(m.a?.slug) || '/img/badges/_placeholder.svg';
    const bB = _badge(m.b?.slug) || '/img/badges/_placeholder.svg';
    const score = m.legs === 2
      ? `${m.aggA}\u2013${m.aggB}${m.penA !== null ? ` (${m.penA}\u2013${m.penB}p)` : ''}`
      : `${m.scoreA ?? '?'}\u2013${m.scoreB ?? '?'}${m.penA !== null ? ` (${m.penA}\u2013${m.penB}p)` : ''}`;
    const idx = m._cacheIdx ?? 0;
    return `<div class="trn-bkt-match" style="top:${topPx}px" onclick="TRN.openMatchModal(${idx})">
      <div class="trn-bkt-team ${isWinA ? 'trn-bkt-winner' : 'trn-bkt-loser'}">
        <img class="trn-bkt-badge" src="${_esc(bA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
        <span class="trn-bkt-tname">${_esc(m.a?.name || '\u2014')}</span>
        ${isWinA ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
      </div>
      <div class="trn-bkt-score-mid">${_esc(score)}</div>
      <div class="trn-bkt-team ${isWinB ? 'trn-bkt-winner' : 'trn-bkt-loser'}">
        <img class="trn-bkt-badge" src="${_esc(bB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
        <span class="trn-bkt-tname">${_esc(m.b?.name || '\u2014')}</span>
        ${isWinB ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
      </div>
    </div>`;
  }

  function _renderVisualBracket(rounds) {
    if (!rounds || !rounds.length) return '<p style="color:var(--grey);padding:1rem">Sin datos</p>';
    const MATCH_H = 84, HEADER_H = 26, COL_W = 182, SW = 36;
    const pos = _computeBracketPositions(rounds);
    const maxBottom = Math.max(...pos.map(p => p.length ? p[p.length - 1].top + MATCH_H : 0));
    const totalH = maxBottom + HEADER_H + 8;
    let html = `<div class="trn-bkt-tree" style="height:${totalH}px">`;
    for (let ri = 0; ri < rounds.length; ri++) {
      const round  = rounds[ri];
      const isLast = ri === rounds.length - 1;
      html += `<div class="trn-bkt-col" style="height:${totalH}px">`;
      html += `<div class="trn-bkt-col-label">${_esc(round.label)}</div>`;
      pos[ri].forEach(({ top }, mi) => { html += _renderBktMatchCard(round.matches[mi], top + HEADER_H); });
      html += '</div>';
      if (!isLast) {
        html += `<div class="trn-bkt-spacer" style="height:${totalH}px">`;
        const nextPos = pos[ri + 1];
        for (let pi = 0; pi < nextPos.length; pi++) {
          const m0 = pos[ri][pi * 2];
          const m1 = pos[ri][pi * 2 + 1];
          if (!m0) continue;
          const f1y = HEADER_H + m0.top + MATCH_H / 2;
          const f2y = m1 ? HEADER_H + m1.top + MATCH_H / 2 : f1y;
          const ny  = HEADER_H + nextPos[pi].top + MATCH_H / 2;
          html += `<div class="trn-bkt-line" style="top:${f1y - .5}px;left:0;width:${SW / 2}px"></div>`;
          if (m1) {
            html += `<div class="trn-bkt-line" style="top:${f2y - .5}px;left:0;width:${SW / 2}px"></div>`;
            html += `<div class="trn-bkt-line" style="top:${Math.min(f1y,f2y)}px;left:${SW/2-.5}px;height:${Math.abs(f2y-f1y)+1}px;width:1px"></div>`;
          }
          html += `<div class="trn-bkt-line" style="top:${ny - .5}px;left:${SW/2}px;width:${SW/2}px"></div>`;
        }
        html += '</div>';
      }
    }
    const champ = rounds[rounds.length - 1].matches[0]?.winner;
    if (champ) {
      const champY = HEADER_H + pos[rounds.length-1][0].top + MATCH_H/2;
      html += `<div class="trn-bkt-spacer" style="height:${totalH}px">`;
      html += `<div class="trn-bkt-line" style="top:${champY-.5}px;left:0;width:${SW}px"></div>`;
      html += '</div>';
      const badgeUrl = _badge(champ.slug) || '/img/badges/_placeholder.svg';
      html += `<div class="trn-bkt-col trn-bkt-champ-col" style="height:${totalH}px">`;
      html += `<div class="trn-bkt-col-label">\uD83C\uDFC6</div>`;
      html += `<div class="trn-bkt-champion-card" style="top:${Math.max(8,champY-50)}px">`;
      html += `<img class="trn-bkt-champ-badge" src="${_esc(badgeUrl)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">`;
      html += `<div class="trn-bkt-champ-name">${_esc(champ.name)}</div>`;
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  // ── COPA ─────────────────────────────────────────────────
  async function _simulateCopa() {
    const ROUND_LABELS = { 2: 'Final', 4: 'Semifinales', 8: 'Cuartos de final',
      16: 'Octavos de final', 32: 'Dieciseisavos de final', 64: 'Treinta y dos avos' };

    // Use pre-generated draw if available, otherwise shuffle now
    let bracket = (_draw.length === _numTeams / 2)
      ? _draw.flatMap(m => [m.a, m.b])
      : [..._teams].sort(() => Math.random() - 0.5);
    const rounds = [];

    while (bracket.length > 1) {
      const n = bracket.length;
      const label = ROUND_LABELS[n] || `Ronda (${n})`;
      _setProgress(`Simulando ${label}…`);
      const isFinal = n === 2;
      const specs = [];

      for (let i = 0; i < n; i += 2) {
        const a = bracket[i], b = bracket[i + 1];
        if (_rules.idaVuelta && !isFinal) {
          // Two legs
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era, eraB: b.era, salt: n * 100 + i,       penalties: false });
          specs.push({ teamA: b.slug, teamB: a.slug, eraA: b.era, eraB: a.era, salt: n * 100 + i + 50, penalties: false });
        } else {
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era, eraB: b.era, salt: n * 100 + i, penalties: _rules.penalties, isFinal });
        }
      }

      const results = await _bulkSim(specs);
      const winners = [];
      const matches = [];
      let ri = 0;

      for (let i = 0; i < n; i += 2) {
        const a = bracket[i], b = bracket[i + 1];
        if (_rules.idaVuelta && !isFinal) {
          const r1 = results[ri++];
          const r2 = results[ri++];
          const aggA = r1.scoreA + r2.scoreB;
          const aggB = r1.scoreB + r2.scoreA;
          let winner, penA = null, penB = null;
          if (aggA > aggB) winner = a;
          else if (aggB > aggA) winner = b;
          else {
            // Tie on agg — simulate penalties inline via another spec
            const penSpecs = [{ teamA: a.slug, teamB: b.slug, eraA: a.era, eraB: b.era, salt: n * 200 + i, penalties: true }];
            const penRes = await _bulkSim(penSpecs);
            penA = penRes[0].penA; penB = penRes[0].penB;
            winner = (penA !== null && penA > penB) ? a : b;
          }
          matches.push({ a, b, r1, r2, aggA, aggB, penA, penB, winner, legs: 2 });
          winners.push(winner);
        } else {
          const r = results[ri++];
          let winner;
          if (r.penA !== null) winner = r.penA > r.penB ? a : b;
          else if (r.scoreA !== r.scoreB) winner = r.scoreA > r.scoreB ? a : b;
          else winner = Math.random() < 0.5 ? a : b;  // shouldn't happen (penalties on)
          matches.push({ a, b, scoreA: r.scoreA, scoreB: r.scoreB, penA: r.penA, penB: r.penB,
            scorersA: r.scorersA || [], scorersB: r.scorersB || [],
            mom: r.mom || null, stats: r.stats || null, winner, legs: 1 });
          winners.push(winner);
        }
      }

      rounds.push({ label, matches });
      bracket = winners;
    }

    return { format: 'copa', champion: bracket[0], rounds, teams: _teams };
  }

  // ── LIGA ─────────────────────────────────────────────────
  async function _simulateLiga() {
    const teams = [..._teams];
    const table = teams.map(t => ({ ...t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
    const idx = {};
    table.forEach((r, i) => { idx[r.slug] = i; });

    const fixtures = [];
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++) {
        fixtures.push({ a: teams[i], b: teams[j] });
        if (_rules.idaVuelta) fixtures.push({ a: teams[j], b: teams[i] });
      }
    fixtures.sort(() => Math.random() - 0.5);

    const BATCH = 50;
    for (let b = 0; b < fixtures.length; b += BATCH) {
      const chunk = fixtures.slice(b, b + BATCH);
      _setProgress(`Simulando jornadas… (${Math.min(b + BATCH, fixtures.length)} / ${fixtures.length} partidos)`);
      const specs = chunk.map((f, i) => ({
        teamA: f.a.slug, teamB: f.b.slug, eraA: f.a.era, eraB: f.b.era, salt: b + i + 9000, penalties: false,
      }));
      const res = await _bulkSim(specs);
      chunk.forEach((f, i) => {
        const r = res[i];
        f.scoreA = r.scoreA; f.scoreB = r.scoreB;
        f.scorersA = r.scorersA || []; f.scorersB = r.scorersB || [];
        f.mom = r.mom || null; f.stats = r.stats || null;
        const rA = table[idx[f.a.slug]];
        const rB = table[idx[f.b.slug]];
        rA.p++; rB.p++;
        rA.gf += r.scoreA; rA.ga += r.scoreB;
        rB.gf += r.scoreB; rB.ga += r.scoreA;
        if (r.scoreA > r.scoreB) { rA.w++; rA.pts += 3; rB.l++; }
        else if (r.scoreA < r.scoreB) { rB.w++; rB.pts += 3; rA.l++; }
        else { rA.d++; rB.d++; rA.pts++; rB.pts++; }
      });
    }

    table.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    return { format: 'liga', champion: table[0], table, matches: fixtures, teams: _teams };
  }

  // ── CHAMPIONS ────────────────────────────────────────────
  async function _simulateChampions() {
    const GRP_SIZE = 4;
    const groups = _groupsDraw.length > 0 ? _groupsDraw : (() => {
      const s = [..._teams].sort(() => Math.random() - 0.5);
      return Array.from({ length: Math.ceil(s.length / GRP_SIZE) }, (_, g) => s.slice(g * GRP_SIZE, (g + 1) * GRP_SIZE));
    })();

    // Group stage
    _setProgress('Simulando fase de grupos…');
    const groupData = [];
    for (let g = 0; g < groups.length; g++) {
      const grp = groups[g];
      const table = grp.map(t => ({ ...t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
      const idxG = {};
      table.forEach((r, i) => { idxG[r.slug] = i; });
      const grpFixtures = [];
      for (let i = 0; i < grp.length; i++)
        for (let j = i + 1; j < grp.length; j++) {
          grpFixtures.push({ a: grp[i], b: grp[j] });
          if (_rules.grupasIdaVuelta) grpFixtures.push({ a: grp[j], b: grp[i] });
        }

      const specs = grpFixtures.map((f, i) => ({
        teamA: f.a.slug, teamB: f.b.slug, eraA: f.a.era || '', eraB: f.b.era || '', salt: (g + 1) * 300 + i, penalties: false,
      }));
      const res = await _bulkSim(specs);
      grpFixtures.forEach((f, i) => {
        const r = res[i];
        f.scoreA = r.scoreA; f.scoreB = r.scoreB;
        f.scorersA = r.scorersA || []; f.scorersB = r.scorersB || [];
        f.mom = r.mom || null; f.stats = r.stats || null;
        const rA = table[idxG[f.a.slug]];
        const rB = table[idxG[f.b.slug]];
        rA.p++; rB.p++;
        rA.gf += r.scoreA; rA.ga += r.scoreB;
        rB.gf += r.scoreB; rB.ga += r.scoreA;
        if (r.scoreA > r.scoreB) { rA.w++; rA.pts += 3; rB.l++; }
        else if (r.scoreA < r.scoreB) { rB.w++; rB.pts += 3; rA.l++; }
        else { rA.d++; rB.d++; rA.pts++; rB.pts++; }
      });
      table.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      groupData.push({ label: `Grupo ${String.fromCharCode(65 + g)}`, table, matches: grpFixtures });
    }

    // Build KO bracket: top 2 of each group
    const qualifiers = groupData.flatMap(g => g.table.slice(0, 2));
    qualifiers.sort(() => Math.random() - 0.5);

    // Reuse copa logic for KO rounds
    const koData = await _simulateCopa_internal(qualifiers, { idaVuelta: _rules.koIdaVuelta });

    return { format: 'champions', champion: koData.champion, groups: groupData, koRounds: koData.rounds, teams: _teams };
  }

  // Internal copa simulation (reused for Champions KO rounds) — supports ida y vuelta
  async function _simulateCopa_internal(teamList, rules = {}) {
    const { idaVuelta = false } = rules;
    const ROUND_LABELS = { 2: 'Final', 4: 'Semifinales', 8: 'Cuartos de final', 16: 'Octavos de final', 32: 'Dieciseisavos de final' };
    let bracket = [...teamList].sort(() => Math.random() - 0.5);
    const rounds = [];

    while (bracket.length > 1) {
      const n = bracket.length;
      const label = ROUND_LABELS[n] || `Ronda ${n}`;
      const isFinal = n === 2;
      _setProgress(`Eliminatoria — ${label}…`);
      const specs = [];

      for (let i = 0; i < n; i += 2) {
        const a = bracket[i], b = bracket[i + 1];
        if (idaVuelta && !isFinal) {
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era||'', eraB: b.era||'', salt: n*100+i,    penalties: false });
          specs.push({ teamA: b.slug, teamB: a.slug, eraA: b.era||'', eraB: a.era||'', salt: n*100+i+50, penalties: false });
        } else {
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era||'', eraB: b.era||'', salt: n*500+i, penalties: true, isFinal });
        }
      }

      const results = await _bulkSim(specs);
      const winners = [];
      const matches = [];
      let ri = 0;

      for (let i = 0; i < n; i += 2) {
        const a = bracket[i], b = bracket[i + 1];
        if (idaVuelta && !isFinal) {
          const r1 = results[ri++];
          const r2 = results[ri++];
          const aggA = r1.scoreA + r2.scoreB;
          const aggB = r1.scoreB + r2.scoreA;
          let winner, penA = null, penB = null;
          if (aggA > aggB) winner = a;
          else if (aggB > aggA) winner = b;
          else {
            const penRes = await _bulkSim([{ teamA: a.slug, teamB: b.slug, eraA: a.era||'', eraB: b.era||'', salt: n*200+i, penalties: true }]);
            penA = penRes[0].penA; penB = penRes[0].penB;
            winner = (penA !== null && penA > penB) ? a : b;
          }
          matches.push({ a, b, r1, r2, aggA, aggB, penA, penB, winner, legs: 2 });
          winners.push(winner);
        } else {
          const r = results[ri++];
          let winner;
          if (r.penA !== null) winner = r.penA > r.penB ? a : b;
          else if (r.scoreA !== r.scoreB) winner = r.scoreA > r.scoreB ? a : b;
          else winner = Math.random() < 0.5 ? a : b;
          matches.push({ a, b, scoreA: r.scoreA, scoreB: r.scoreB, penA: r.penA, penB: r.penB,
            scorersA: r.scorersA||[], scorersB: r.scorersB||[],
            mom: r.mom||null, stats: r.stats||null, winner, legs: 1 });
          winners.push(winner);
        }
      }

      rounds.push({ label, matches });
      bracket = winners;
    }

    return { champion: bracket[0], rounds };
  }

  // ── Compute tournament-wide stats ─────────────────────
  function _computeTournamentStats(data) {
    const allMatches = _getAllMatches(data);
    const scorers = {};
    const moms    = {};

    function _processLeg(leg, teamA, teamB) {
      (leg.scorersA || []).forEach(s => {
        const key = s.name + '|' + (teamA?.slug || '');
        if (!scorers[key]) scorers[key] = { name: s.name, team: teamA?.name || '', goals: 0 };
        scorers[key].goals++;
      });
      (leg.scorersB || []).forEach(s => {
        const key = s.name + '|' + (teamB?.slug || '');
        if (!scorers[key]) scorers[key] = { name: s.name, team: teamB?.name || '', goals: 0 };
        scorers[key].goals++;
      });
      if (leg.mom) {
        const momTeam = leg.mom.team === 'A' ? teamA : teamB;
        const key = leg.mom.name + '|' + (momTeam?.slug || '');
        if (!moms[key]) moms[key] = { name: leg.mom.name, team: momTeam?.name || '', count: 0 };
        moms[key].count++;
      }
    }

    allMatches.forEach(m => {
      if (m.legs === 2) {
        // Leg 1: a vs b (r1.scorersA = a's goals, r1.scorersB = b's goals)
        if (m.r1) _processLeg(m.r1, m.a, m.b);
        // Leg 2: b vs a (r2.scorersA = b's goals, r2.scorersB = a's goals)
        if (m.r2) _processLeg(m.r2, m.b, m.a);
      } else {
        _processLeg(m, m.a, m.b);
      }
    });

    data.pichichi = Object.values(scorers).sort((a, b) => b.goals - a.goals).slice(0, 10);
    data.mvp = Object.values(moms).sort((a, b) => b.count - a.count).slice(0, 5);
  }

  function _renderStatCards() {
    const d = _data;
    const pichichi = d.pichichi?.[0];
    const mvp      = d.mvp?.[0];
    return `
      <div class="trn-stat-cards">
        <div class="trn-stat-card trn-stat-card-champ">
          <div class="trn-stat-card-icon">🏆</div>
          <div class="trn-stat-card-label">Campeón</div>
          <div class="trn-stat-card-value">${_esc(d.champion?.name || '—')}</div>
        </div>
        <div class="trn-stat-card trn-stat-card-pich">
          <div class="trn-stat-card-icon">⚽</div>
          <div class="trn-stat-card-label">Pichichi</div>
          <div class="trn-stat-card-value">${pichichi ? _esc(pichichi.name) : '—'}</div>
          ${pichichi ? `<div class="trn-stat-card-sub">${pichichi.goals} goles · ${_esc(pichichi.team)}</div>` : ''}
        </div>
        <div class="trn-stat-card trn-stat-card-mvp">
          <div class="trn-stat-card-icon">⭐</div>
          <div class="trn-stat-card-label">MVP</div>
          <div class="trn-stat-card-value">${mvp ? _esc(mvp.name) : '—'}</div>
          ${mvp ? `<div class="trn-stat-card-sub">${mvp.count}× MOM · ${_esc(mvp.team)}</div>` : ''}
        </div>
      </div>`;
  }

  // ── Dashboard rendering ──────────────────────────────────
  function _renderDashboard() {
    if (!_data) return;

    // Hide wizard, show dashboard
    const wizard = $('trn-wizard');
    if (wizard) hide(wizard);
    show($('trn-dashboard'));

    // Champion poster
    const champ = _data.champion;
    const champBadge = _badge(champ?.slug);
    const champBadgeEl = $('trn-champ-badge-img');
    if (champBadgeEl) champBadgeEl.src = champBadge || '/img/badges/_placeholder.svg';
    $('trn-champ-name').textContent = champ?.name || '—';
    $('trn-champ-format').textContent =
      _data.format === 'copa' ? '🏆 Copa' :
      _data.format === 'liga' ? '📊 Liga' : '⭐ Champions';

    switchDashTab(_tab);
  }

  function switchDashTab(tab) {
    _tab = tab;
    document.querySelectorAll('.trn-dash-tab').forEach(b =>
      b.classList.toggle('trn-dash-tab-active', b.dataset.tab === tab));
    $('trn-tab-summary').classList.toggle('hidden', tab !== 'summary');
    $('trn-tab-bracket').classList.toggle('hidden', tab !== 'bracket');
    $('trn-tab-calendar').classList.toggle('hidden', tab !== 'calendar');
    $('trn-tab-stats').classList.toggle('hidden', tab !== 'stats');

    if (tab === 'summary')  _renderSummary();
    if (tab === 'bracket')  _renderBracket();
    if (tab === 'calendar') _renderCalendar();
    if (tab === 'stats')    _renderStats();
  }

  // ── Summary tab ──────────────────────────────────────────
  function _renderSummary() {
    const el = $('trn-tab-summary');
    if (!el || !_data) return;
    const d = _data;

    if (d.format === 'liga') {
      const top5 = d.table.slice(0, 5);
      el.innerHTML = _renderStatCards() + `
        <h3 class="trn-section-h">🥇 TOP 5</h3>
        <div class="trn-mini-table">
          ${top5.map((r, i) => `
            <div class="trn-mini-row ${i === 0 ? 'trn-mini-row-top' : ''}">
              <span class="trn-mini-pos">${i + 1}</span>
              <span class="trn-mini-team">${_esc(r.name)}</span>
              <span class="trn-mini-pts">${r.pts} pts</span>
              <span class="trn-mini-gd">${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</span>
            </div>`).join('')}
        </div>`;
    } else if (d.format === 'copa') {
      el.innerHTML = _renderStatCards() + `
        <h3 class="trn-section-h">📋 Resumen Copa</h3>
        <p class="trn-summary-text">
          ${d.rounds.length} rondas simuladas · ${d.teams.length} equipos participantes
        </p>
        <div class="trn-summary-rounds">
          ${d.rounds.map(r => `
            <div class="trn-summary-rnd">
              <span class="trn-rnd-label">${_esc(r.label)}</span>
              <span class="trn-rnd-count">${r.matches.length} ${r.matches[0]?.legs === 2 ? 'cruces' : 'partidos'}</span>
            </div>`).join('')}
        </div>`;
    } else {
      // champions
      const numGroups = d.groups?.length || 0;
      const numKO = d.koRounds?.length || 0;
      el.innerHTML = _renderStatCards() + `
        <h3 class="trn-section-h">📋 Resumen Champions</h3>
        <p class="trn-summary-text">
          ${numGroups} grupos · ${numKO} rondas KO · ${d.teams.length} equipos
        </p>
        <div class="trn-groups-mini">
          ${(d.groups || []).map(g => `
            <div class="trn-group-mini-card">
              <div class="trn-group-mini-label">${_esc(g.label)}</div>
              ${g.table.slice(0, 2).map((r, i) => `
                <div class="trn-group-mini-row trn-q">
                  <span class="trn-mini-pos">${i + 1}</span>
                  <span class="trn-mini-team">${_esc(r.name)}</span>
                  <span class="trn-mini-pts">${r.pts}</span>
                </div>`).join('')}
              ${g.table.slice(2).map((r, i) => `
                <div class="trn-group-mini-row">
                  <span class="trn-mini-pos">${i + 3}</span>
                  <span class="trn-mini-team">${_esc(r.name)}</span>
                  <span class="trn-mini-pts">${r.pts}</span>
                </div>`).join('')}
            </div>`).join('')}
        </div>`;
    }
  }

  // ── Bracket / Table tab ──────────────────────────────────
  function _renderBracket() {
    const el = $('trn-tab-bracket');
    if (!el || !_data) return;
    const d = _data;

    if (d.format === 'liga') {
      el.innerHTML = `
        <h3 class="trn-section-h">\uD83D\uDCCA Clasificación</h3>
        <div class="trn-table-wrap">
          <table class="trn-table">
            <thead><tr>
              <th>#</th><th class="trn-th-team">Equipo</th>
              <th title="Partidos jugados">PJ</th><th title="Ganados">G</th>
              <th title="Empatados">E</th><th title="Perdidos">P</th>
              <th title="Goles a favor">GF</th><th title="Goles en contra">GC</th>
              <th title="Diferencia">DG</th><th class="trn-th-pts">Pts</th>
            </tr></thead>
            <tbody>
              ${d.table.map((r, i) => `
                <tr class="${i < 4 ? 'trn-tr-qual' : i >= d.table.length - 3 ? 'trn-tr-rel' : ''}">
                  <td>${i + 1}</td>
                  <td class="trn-td-team trn-td-badge-team">
                    <img class="trn-table-badge" src="${_badge(r.slug) || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
                    ${_esc(r.name)}
                  </td>
                  <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
                  <td>${r.gf}</td><td>${r.ga}</td>
                  <td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
                  <td class="trn-td-pts">${r.pts}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } else if (d.format === 'copa') {
      el.innerHTML = `<h3 class="trn-section-h">\uD83C\uDFC6 Cuadro</h3>
        <div class="trn-bkt-scroll">${_renderVisualBracket(d.rounds)}</div>`;
    } else {
      // Champions: groups + KO bracket
      let html = `<h3 class="trn-section-h">\u2B50 Grupos</h3><div class="trn-groups-grid">`;
      (d.groups || []).forEach(g => {
        html += `<div class="trn-group-card"><div class="trn-group-label">${_esc(g.label)}</div>
          <table class="trn-table trn-table-sm">
            <thead><tr><th class="trn-th-team">Equipo</th><th>Pts</th><th>DG</th></tr></thead>
            <tbody>${g.table.map((r, i) => `
              <tr class="${i < 2 ? 'trn-tr-qual' : ''}">
                <td class="trn-td-team trn-td-badge-team">
                  <img class="trn-table-badge" src="${_badge(r.slug) || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
                  ${_esc(r.name)}
                </td>
                <td>${r.pts}</td><td>${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td>
              </tr>`).join('')}
            </tbody></table></div>`;
      });
      html += `</div><h3 class="trn-section-h trn-section-h-mt">\uD83C\uDFC6 Eliminatorias</h3>
        <div class="trn-bkt-scroll">${_renderVisualBracket(d.koRounds || [])}</div>`;
      el.innerHTML = html;
    }
  }

  // ── Calendar tab ─────────────────────────────────────────
  function _fmtScorers(scorersA, scorersB, nameA, nameB) {
    // Returns an HTML scorer block below the match row
    const fmt = (list) => {
      if (!list || !list.length) return '';
      const grp = {};
      list.forEach(s => { if (!grp[s.name]) grp[s.name] = []; grp[s.name].push(s.minute); });
      return Object.entries(grp).map(([n, mins]) =>
        `${_esc(n)} ${mins.map(m => `${m}'`).join(' ')}`).join(', ');
    };
    const sA = fmt(scorersA), sB = fmt(scorersB);
    if (!sA && !sB) return '';
    return `<div class="trn-cal-scorers">
      <span class="trn-cal-scorer-a">${sA}</span>
      <span class="trn-cal-scorer-sep"></span>
      <span class="trn-cal-scorer-b">${sB}</span>
    </div>`;
  }

  function _renderCalendar() {
    const el = $('trn-tab-calendar');
    if (!el || !_data) return;
    const d = _data;

    function _matchCard(m, nameA, nameB, scoreStr) {
      const idx = m._cacheIdx ?? 0;
      const scorerHtml = (m.legs === 2)
        ? _fmtScorers(
            [...(m.r1?.scorersA || []), ...(m.r2?.scorersB || [])],
            [...(m.r1?.scorersB || []), ...(m.r2?.scorersA || [])],
            nameA, nameB)
        : _fmtScorers(m.scorersA, m.scorersB, nameA, nameB);
      return `<div class="trn-cal-match" onclick="TRN.openMatchModal(${idx})">
        <span class="trn-cal-team-a">${_esc(nameA)}</span>
        <span class="trn-cal-score">${scoreStr}</span>
        <span class="trn-cal-team-b">${_esc(nameB)}</span>
        ${scorerHtml}
      </div>`;
    }

    let html = '';
    if (d.format === 'liga') {
      html = `<h3 class="trn-section-h">📅 Todos los partidos</h3>`;
      const chunk = Math.floor(d.teams.length / 2);
      const total = d.matches.length;
      let j = 0, i = 0;
      while (i < total) {
        j++;
        html += `<div class="trn-cal-jornada"><div class="trn-cal-jornada-label">Jornada ${j}</div>`;
        const end = Math.min(i + chunk, total);
        for (let k = i; k < end; k++) {
          const m = d.matches[k];
          html += _matchCard(m, m.a.name, m.b.name, `${m.scoreA ?? '?'} – ${m.scoreB ?? '?'}`);
        }
        html += `</div>`;
        i = end;
      }
    } else if (d.format === 'copa') {
      html = `<h3 class="trn-section-h">📅 Resultados por ronda</h3>`;
      [...d.rounds].reverse().forEach(r => {
        html += `<div class="trn-cal-jornada"><div class="trn-cal-jornada-label">${_esc(r.label)}</div>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          if (m.legs === 2) {
            html += _matchCard(m, m.a.name, m.b.name,
              `${m.aggA} – ${m.aggB} <small>(agg)</small>${penStr}`);
          } else {
            html += _matchCard(m, m.a.name, m.b.name,
              `${m.scoreA} – ${m.scoreB}${penStr}`);
          }
        });
        html += `</div>`;
      });
    } else {
      // champions: groups matches + KO
      html = `<h3 class="trn-section-h">📅 Fase de Grupos</h3>`;
      (d.groups || []).forEach(g => {
        html += `<div class="trn-cal-jornada"><div class="trn-cal-jornada-label">${_esc(g.label)}</div>`;
        g.matches.forEach(m => {
          html += _matchCard(m, m.a.name, m.b.name, `${m.scoreA} – ${m.scoreB}`);
        });
        html += `</div>`;
      });
      html += `<h3 class="trn-section-h trn-section-h-mt">📅 Eliminatorias</h3>`;
      [...(d.koRounds || [])].reverse().forEach(r => {
        html += `<div class="trn-cal-jornada"><div class="trn-cal-jornada-label">${_esc(r.label)}</div>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          html += _matchCard(m, m.a.name, m.b.name,
            `${m.scoreA} – ${m.scoreB}${penStr}`);
        });
        html += `</div>`;
      });
    }

    el.innerHTML = html;
  }

  // ── Stats tab ────────────────────────────────────────────
  function _renderStats() {
    const el = $('trn-tab-stats');
    if (!el || !_data) return;
    const d = _data;

    // Aggregate all matches
    const allMatches = _getAllMatches(d);
    const totals = {};
    _teams.forEach(t => { totals[t.slug] = { name: t.name, gf: 0, ga: 0, mp: 0, w: 0 }; });

    allMatches.forEach(m => {
      const sa = m.scoreA ?? 0, sb = m.scoreB ?? 0;
      const slugA = m.a?.slug, slugB = m.b?.slug;
      if (totals[slugA]) { totals[slugA].gf += sa; totals[slugA].ga += sb; totals[slugA].mp++; if (sa > sb) totals[slugA].w++; }
      if (totals[slugB]) { totals[slugB].gf += sb; totals[slugB].ga += sa; totals[slugB].mp++; if (sb > sa) totals[slugB].w++; }
    });

    const sorted = Object.values(totals).sort((a, b) => b.gf - a.gf);
    const top = sorted.slice(0, 10);

    el.innerHTML = `
      <h3 class="trn-section-h">⚽ Pichichi</h3>
      <div class="trn-stats-list">
        ${(d.pichichi || []).slice(0, 10).map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-gf" title="Goles">${r.goals} goles</span>
            <span class="trn-stats-mp trn-stats-club">${_esc(r.team)}</span>
          </div>`).join('')}
      </div>
      ${(d.mvp || []).length ? `
      <h3 class="trn-section-h trn-section-h-mt">⭐ Mejor Jugador (MOM)</h3>
      <div class="trn-stats-list">
        ${(d.mvp || []).slice(0, 5).map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-gf">${r.count}× MOM</span>
            <span class="trn-stats-mp trn-stats-club">${_esc(r.team)}</span>
          </div>`).join('')}
      </div>` : ''}
      <h3 class="trn-section-h trn-section-h-mt">⚽ Equipos más goleadores</h3>
      <div class="trn-stats-list">
        ${top.map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-gf" title="Goles">${r.gf} goles</span>
            <span class="trn-stats-mp" title="Partidos">${r.mp} partidos</span>
          </div>`).join('')}
      </div>
      <h3 class="trn-section-h trn-section-h-mt">🛡 Defensas más sólidas</h3>
      <div class="trn-stats-list">
        ${Object.values(totals).filter(r => r.mp > 0).sort((a, b) => a.ga - b.ga).slice(0, 5).map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-gf" title="Goles en contra">${r.ga} GC</span>
            <span class="trn-stats-mp">${r.mp} partidos</span>
          </div>`).join('')}
      </div>`;
  }

  function _getAllMatches(d) {
    if (d.format === 'liga') return d.matches;
    if (d.format === 'copa') return d.rounds.flatMap(r => r.matches);
    // champions
    const grpMatches = (d.groups || []).flatMap(g => g.matches);
    const koMatches  = (d.koRounds || []).flatMap(r => r.matches);
    return [...grpMatches, ...koMatches];
  }

  // ── Start over ───────────────────────────────────────────
  function startOver() {
    _fmt = null; _teams = []; _draw = []; _groupsDraw = []; _data = null; _tab = 'summary'; _matchCache = []; _badgeCache = {};
    hide($('trn-dashboard'));
    const wizard = $('trn-wizard');
    if (wizard) show(wizard);
    document.querySelectorAll('.trn-fmt-card').forEach(c => c.classList.remove('trn-fmt-selected'));
    showStep(1);
  }

  // ── Match modal ──────────────────────────────────────────
  function openMatchModal(idx) {
    const entry = _matchCache[idx];
    if (!entry) return;
    const { m, nameA, nameB } = entry;

    const modal  = $('trn-match-modal');
    const header = $('trn-modal-header');
    const body   = $('trn-modal-body');
    if (!modal || !header || !body) return;

    // Resolve scores (could be legs=2)
    let scoreStr, scorersA, scorersB;
    if (m.legs === 2) {
      const pen  = m.penA !== null ? ` <span class="trn-modal-pen">(${m.penA}–${m.penB} p)</span>` : '';
      scoreStr   = `${m.aggA} – ${m.aggB}${pen}`;
      scorersA   = [...(m.r1?.scorersA || []), ...(m.r2?.scorersB || [])];
      scorersB   = [...(m.r1?.scorersB || []), ...(m.r2?.scorersA || [])];
    } else {
      const pen  = m.penA !== null ? ` <span class="trn-modal-pen">(${m.penA}–${m.penB} p)</span>` : '';
      scoreStr   = `${m.scoreA} – ${m.scoreB}${pen}`;
      scorersA   = m.scorersA || [];
      scorersB   = m.scorersB || [];
    }

    const mBadgeA = _badge(m.a?.slug) || '/img/badges/_placeholder.svg';
    const mBadgeB = _badge(m.b?.slug) || '/img/badges/_placeholder.svg';
    header.innerHTML = `
      <div class="trn-modal-teams">
        <div class="trn-modal-team trn-modal-team-a">
          <img class="trn-modal-badge" src="${_esc(mBadgeA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <span>${_esc(nameA)}</span>
        </div>
        <span class="trn-modal-score-big">${scoreStr}</span>
        <div class="trn-modal-team trn-modal-team-b">
          <span>${_esc(nameB)}</span>
          <img class="trn-modal-badge" src="${_esc(mBadgeB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
        </div>
      </div>`;

    const grpScorers = (list) => {
      if (!list.length) return '<span class="trn-modal-no-goals">—</span>';
      const g = {};
      list.forEach(s => { if (!g[s.name]) g[s.name] = []; g[s.name].push(s.minute); });
      return Object.entries(g).map(([n, mins]) =>
        `<div class="trn-modal-scorer">${_esc(n)} <span class="trn-modal-mins">${mins.map(x => x + `'`).join(' ')}</span></div>`
      ).join('');
    };

    // Pick stats — for legs=2 use r1 stats as representative
    const statsObj   = m.legs === 2 ? m.r1 : m;
    const possA      = statsObj?.stats?.possession?.teamA ?? 50;
    const possB      = statsObj?.stats?.possession?.teamB ?? 50;
    const shotsA     = statsObj?.stats?.shots?.teamA ?? 0;
    const shotsB     = statsObj?.stats?.shots?.teamB ?? 0;
    const mom        = m.legs === 2 ? (m.r1?.mom || m.r2?.mom || null) : (m.mom || null);
    const momTeamName = mom ? (mom.team === 'A' ? nameA : nameB) : null;

    body.innerHTML = `
      <div class="trn-modal-scorers-row">
        <div class="trn-modal-scorers-col">${grpScorers(scorersA)}</div>
        <div class="trn-modal-scorers-sep"></div>
        <div class="trn-modal-scorers-col trn-modal-scorers-col-b">${grpScorers(scorersB)}</div>
      </div>
      ${mom ? `<div class="trn-modal-mom">⭐ MOM: <strong>${_esc(mom.name)}</strong> <span class="trn-modal-mom-team">(${_esc(momTeamName)})</span></div>` : ''}
      <div class="trn-modal-stats">
        <div class="trn-modal-stat-row">
          <span class="trn-modal-stat-val">${possA}%</span>
          <span class="trn-modal-stat-label">Posesión</span>
          <span class="trn-modal-stat-val">${possB}%</span>
        </div>
        <div class="trn-modal-poss-bar">
          <div class="trn-modal-poss-a" style="width:${possA}%"></div>
          <div class="trn-modal-poss-b" style="width:${possB}%"></div>
        </div>
        <div class="trn-modal-stat-row">
          <span class="trn-modal-stat-val">${shotsA}</span>
          <span class="trn-modal-stat-label">Tiros</span>
          <span class="trn-modal-stat-val">${shotsB}</span>
        </div>
      </div>`;

    modal.classList.remove('hidden');
  }

  function closeMatchModal() {
    const modal = $('trn-match-modal');
    if (modal) modal.classList.add('hidden');
  }

  // ── Public API ───────────────────────────────────────────
  return {
    switchMainTab,
    selectFormat,
    goStep2,
    goStep3,
    goBack,
    onTeamSearch,
    clearSearch,
    addTeam,
    removeTeam,
    fillRandom,
    runSimulation,
    switchDashTab,
    startOver,
    openMatchModal,
    closeMatchModal,
    reshuffleDraw,
    reshuffleGroupsDraw,
  };
})();
