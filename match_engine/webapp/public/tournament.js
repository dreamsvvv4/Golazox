// tournament.js — GolazoX Tournament Engine v2.0
// Handles Wizard UI + bulk simulation + Dashboard (4 tabs)
'use strict';

const TRN = (() => {
  // ── State ───────────────────────────────────────────────
  let _fmt        = null;   // 'copa' | 'liga' | 'champions'
  let _numTeams   = 16;
  let _rules      = { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: false, extraTime: true, tercerPuesto: false, copaMode: 'ko' };
  let _teams      = [];     // [{ slug, era, name }]
  let _draw       = [];     // Copa: [{ a, b }] first-round pairings
  let _groupsDraw = [];     // Champions: [[t1,t2,t3,t4], ...] pre-drawn groups
  let _data       = null;   // computed tournament result
  let _tab        = 'summary';
  let _matchCache = [];     // flat list for modal lookup
  let _badgeCache  = {};     // slug → badge URL
  let _seasonCache = {};     // slug → seasons[] from suggest results
  let _modalIdx   = -1;     // current match in modal for prev/next nav
  let _trnCatalog  = null;   // cached catalog for league loader

  const VALID_COUNTS = {
    copa:        [4, 8, 16, 32],
    copa_groups: [8, 12, 16, 20, 24, 32],
    liga:        [4, 6, 8, 10, 12, 14, 16, 18, 20],
    champions:   [8, 12, 16, 20, 24, 32],  // kept for backward compat
  };

  // ── DOM helpers ─────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');
  const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // _lang is defined in app.js as a top-level let (shared global scope)
  const _getLang = () => { try { return _lang || 'es'; } catch(_) { return 'es'; } };

  // ── Locked legendary teams (unlock: 5 sims or Twitter share) ──────────────
  const _LOCKED_TEAMS = {
    'brasilien':         { label: 'Brasil \'70' },
    'ajax-amsterdam':    { label: 'Ajax Amsterdam \'72' },
    'america-historica': { label: 'América Histórica' },
    'europa-historica':  { label: 'Europa Histórica' },
  };
  function _isUnlocked() {
    try { return localStorage.getItem('gx_unlocked') === '1'; } catch(_) { return false; }
  }

  const _badge    = (slug) => _badgeCache[slug] || '';
  const _badgeImg = (slug, cls) => {
    const b = _badge(slug);
    return `<img class="${cls || 'trn-badge'}" src="${b || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">`;
  };
  // Returns display label "Team Name '09" (or just "Team Name" if no era)
  const _tLabel = (t) => {
    if (!t) return '?';
    const yr = t.era ? String(t.era).match(/\d{4}/)?.[0] : null;
    return yr ? `${t.name} '${yr.slice(2)}` : (t.name || '?');
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
    if (fmt === 'copa') _rules.copaMode = 'ko';
    try { _gx('trn_format_select', { format: fmt }); } catch(_) {}
    document.querySelectorAll('.trn-fmt-card').forEach(c =>
      c.classList.toggle('trn-fmt-selected', c.dataset.fmt === fmt));
    _buildNumTeamsPicker();
  }

  function _rebuildCopaDetailRules() {
    const detailEl = $('trn-copa-detail-rules');
    if (!detailEl) return;
    if (_rules.copaMode === 'groups') {
      detailEl.innerHTML = `
        <label class="trn-rule-row">
          <div class="trn-rule-body">
            <span class="trn-rule-name">Fase de grupos</span>
            <span class="trn-rule-hint">Partido único por jornada · o activa ida y vuelta en grupos</span>
          </div>
          <div class="trn-toggle-wrap">
            <input type="checkbox" id="trn-rule-grupos-idavuelta" class="trn-toggle-input" />
            <div class="trn-toggle"></div>
          </div>
        </label>
        <label class="trn-rule-row">
          <div class="trn-rule-body">
            <span class="trn-rule-name">Fase eliminatoria</span>
            <span class="trn-rule-hint">Ida y vuelta en rondas KO · la final siempre a partido único</span>
          </div>
          <div class="trn-toggle-wrap">
            <input type="checkbox" id="trn-rule-ko-idavuelta" class="trn-toggle-input" checked />
            <div class="trn-toggle"></div>
          </div>
        </label>`;
    } else {
      detailEl.innerHTML = `
        <label class="trn-rule-row">
          <div class="trn-rule-body">
            <span class="trn-rule-name">Formato de partido</span>
            <span class="trn-rule-hint">Partido único · o activa ida y vuelta por ronda</span>
          </div>
          <div class="trn-toggle-wrap">
            <input type="checkbox" id="trn-rule-idavuelta" class="trn-toggle-input" />
            <div class="trn-toggle"></div>
          </div>
        </label>
        <label class="trn-rule-row">
          <div class="trn-rule-body">
            <span class="trn-rule-name">Desempate</span>
            <span class="trn-rule-hint">Empate: penaltis directos · o activa prórroga primero</span>
          </div>
          <div class="trn-toggle-wrap">
            <input type="checkbox" id="trn-rule-extratime" class="trn-toggle-input" checked />
            <div class="trn-toggle"></div>
          </div>
        </label>
        <label class="trn-rule-row">
          <div class="trn-rule-body">
            <span class="trn-rule-name">Partido por el 3er puesto</span>
            <span class="trn-rule-hint">Los semifinalistas eliminados juegan por el 3er puesto</span>
          </div>
          <div class="trn-toggle-wrap">
            <input type="checkbox" id="trn-rule-3rd" class="trn-toggle-input" />
            <div class="trn-toggle"></div>
          </div>
        </label>`;
    }
  }

  function onCopaGroupsChange(checked) {
    _rules.copaMode = checked ? 'groups' : 'ko';
    _buildNumTeamsPicker();
    _rebuildCopaDetailRules();
    _draw = []; _groupsDraw = [];
    if (_teams.length === _numTeams) _updatePreDraw();
  }

  function _buildNumTeamsPicker() {
    const wrap = $('trn-num-teams');
    if (!wrap || !_fmt) return;
    const key = (_fmt === 'copa' && _rules.copaMode === 'groups') ? 'copa_groups' : _fmt;
    const counts = VALID_COUNTS[key] || [8, 16];
    _numTeams = counts.includes(_numTeams) ? _numTeams : counts[Math.floor(counts.length / 2)];
    wrap.innerHTML = counts.map(n =>
      `<button class="trn-num-pill${n === _numTeams ? ' trn-num-pill-active' : ''}" data-n="${n}">${n}</button>`
    ).join('');
  }
  function setNumTeams(n) {
    _numTeams = n;
    // Update pill active state
    const wrap = $('trn-num-teams');
    if (wrap) wrap.querySelectorAll('.trn-num-pill').forEach(b => b.classList.toggle('trn-num-pill-active', +b.textContent === n));
  }


  function goStep2() {
    if (!_fmt) { _showToast('⚠ Selecciona un formato primero.'); return; }
    // _numTeams already updated by setNumTeams / _buildNumTeamsPicker
    const container = $('trn-rules-list');
    if (container) {
      let html = '';
      if (_fmt === 'copa') {
        html = `
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Modalidad</span>
              <span class="trn-rule-hint">Solo KO directo · o activa con fase de grupos previa</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-copa-groups" class="trn-toggle-input"${_rules.copaMode === 'groups' ? ' checked' : ''} />
              <div class="trn-toggle"></div>
            </div>
          </label>
          <div id="trn-copa-detail-rules"></div>`;
        container.innerHTML = html;
        _rebuildCopaDetailRules();
        showStep(2);
        try { _gx('trn_step2_view', { format: _fmt }); } catch(_) {}
        return;
      } else if (_fmt === 'liga') {
        html = `
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Vueltas</span>
              <span class="trn-rule-hint">Solo ida (más rápido) · o activa doble vuelta completa</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-idavuelta" class="trn-toggle-input" />
              <div class="trn-toggle"></div>
            </div>
          </label>`;
      } else if (_fmt === 'champions' || (_fmt === 'copa' && _rules.copaMode === 'groups')) {
        html = `
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Fase de grupos</span>
              <span class="trn-rule-hint">Partido único en grupos · o activa ida y vuelta</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-grupos-idavuelta" class="trn-toggle-input" />
              <div class="trn-toggle"></div>
            </div>
          </label>
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">Fase eliminatoria</span>
              <span class="trn-rule-hint">Ida y vuelta en rondas KO · la final siempre a partido único</span>
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
    try { _gx('trn_step2_view', { format: _fmt }); } catch(_) {}
  }

  function goStep3() {
    if (_fmt === 'copa') {
      _rules.copaMode = $('trn-rule-copa-groups')?.checked ? 'groups' : 'ko';
      if (_rules.copaMode === 'groups') {
        _rules.grupasIdaVuelta = !!$('trn-rule-grupos-idavuelta')?.checked;
        _rules.koIdaVuelta     = !!$('trn-rule-ko-idavuelta')?.checked;
      } else {
        _rules.idaVuelta = !!$('trn-rule-idavuelta')?.checked;
        _rules.extraTime = !!$('trn-rule-extratime')?.checked;
        _rules.tercerPuesto = !!$('trn-rule-3rd')?.checked;
      }
    } else if (_fmt === 'liga') {
      _rules.idaVuelta = !!$('trn-rule-idavuelta')?.checked;
    } else if (_fmt === 'champions' || (_fmt === 'copa' && _rules.copaMode === 'groups')) {
      _rules.grupasIdaVuelta = !!$('trn-rule-grupos-idavuelta')?.checked;
      _rules.koIdaVuelta     = !!$('trn-rule-ko-idavuelta')?.checked;
    }
    // _numTeams already held in state
    _teams = [];
    _draw = [];
    _groupsDraw = [];
    _renderTeamSlots();
    // Show league-loader button only for liga format
    const ligaBtn = $('trn-btn-liga');
    if (ligaBtn) ligaBtn.classList.toggle('hidden', _fmt !== 'liga');
    closeLeagueLoader();
    showStep(3);
    try { _gx('trn_step3_view', { format: _fmt, teams: _numTeams }); } catch(_) {}
  }

  function goBack(step) { showStep(step); }

  // ── Step 3: Team management ──────────────────────────────
  function _renderTeamSlots() {
    const container = $('trn-teams-list');
    if (!container) return;
    container.innerHTML = _teams.map((t, i) => {
      const yr = t.era ? String(t.era).match(/\d{4}/)?.[0] : null;
      return `<div class="trn-team-slot">
        ${_badgeImg(t.slug, 'trn-slot-badge')}
        <span class="trn-slot-name">${_esc(t.name)}</span>
        ${yr ? `<span class="trn-slot-era">'${yr.slice(2)}</span>` : ''}
        <button class="trn-slot-remove" data-remove-idx="${i}" title="Quitar">✕</button>
      </div>`;
    }).join('') || '<p class="trn-teams-empty">Ningún equipo añadido todavía.<br><span style="font-size:.75rem;opacity:.6">Busca por nombre, país o usa ⚡ Aleatorio</span></p>';

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
    const _useGroups = (_fmt === 'champions') || (_fmt === 'copa' && _rules.copaMode === 'groups');
    if (!_useGroups && _draw.length !== _numTeams / 2) _generateDraw();
    if (_useGroups && _groupsDraw.length === 0)         _generateGroupsDraw();
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
        <button class="trn-draw-reshuffle" data-action="reshuffleDraw">🔀 Nuevo sorteo</button>
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
        <button class="trn-draw-reshuffle" data-action="reshuffleGroupsDraw">🔀 Nuevo sorteo</button>
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
  let _kbFocus = -1;  // keyboard-focused search result index

  function _setKbFocus(idx) {
    const items = $('trn-search-results')?.querySelectorAll('.trn-search-item');
    if (!items || !items.length) return;
    if (_kbFocus >= 0 && items[_kbFocus]) items[_kbFocus].classList.remove('trn-si-focused');
    _kbFocus = Math.max(-1, Math.min(idx, items.length - 1));
    if (_kbFocus >= 0 && items[_kbFocus]) {
      items[_kbFocus].classList.add('trn-si-focused');
      items[_kbFocus].scrollIntoView({ block: 'nearest' });
    }
  }

  function onSearchKeydown(e) {
    const res = $('trn-search-results');
    const hidden = !res || res.classList.contains('hidden');
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (hidden) return;
        _setKbFocus(_kbFocus + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (hidden) return;
        _setKbFocus(_kbFocus - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (hidden) return;
        if (_kbFocus >= 0) {
          const focused = res.querySelectorAll('.trn-search-item')[_kbFocus];
          if (focused) focused.click();
        } else {
          // If preview panel is open and no item focused, submit add
          const addBtn = $('trn-team-preview')?.querySelector('.btn-primary');
          if (addBtn) addBtn.click();
        }
        break;
      case 'Escape':
        clearSearch();
        break;
    }
  }

  function onTeamSearch(val) {
    clearTimeout(_searchTimer);
    _kbFocus = -1;
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

      // If the query contains a year, use it as the preferred era when previewing
      const queryYearMatch = q.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
      const queryYear = queryYearMatch ? queryYearMatch[1] : '';

      res.innerHTML = data.map(t => {
        const name  = _esc(t.nameEs || t.name || t.nameEn || t.slug || '');
        const slug  = _esc(t.slug  || name);
        const badge = _esc(t.badge || '');
        const ls    = t.latestSeason || '';
        const seasons = t.seasons || [];

        // Cache seasons for the era picker shown in previewTeam
        if (seasons.length && t.slug) _seasonCache[t.slug] = seasons;

        // Best era to preview: prefer query year (exact or nearest), else latest
        let bestEra = ls;
        if (queryYear && seasons.length) {
          bestEra = seasons.includes(queryYear)
            ? queryYear
            : seasons.reduce((best, s) =>
                Math.abs(+s - +queryYear) < Math.abs(+best - +queryYear) ? s : best);
        }

        // Meta badge: if team has multiple seasons show the vintage range, else just latest
        const sortedSeasons = [...seasons].sort((a, b) => +a - +b);
        const oldest = sortedSeasons[0];
        let meta;
        if (seasons.length > 1 && oldest && ls) {
          meta = `'${String(oldest).slice(-2)}–'${String(ls).slice(-2)}`;
        } else if (ls && ls !== 'all-time') {
          meta = `'${String(ls).slice(-2)}`;
        } else if (ls === 'all-time') {
          meta = 'All-Time';
        } else {
          meta = '';
        }

        const isLocked = !_isUnlocked() && !!_LOCKED_TEAMS[t.slug];
        if (isLocked) {
          return `<div class="trn-search-item trn-search-item-locked" data-action="showLockedHint">
            <img class="trn-si-badge" src="${badge || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
            <span class="trn-search-item-name">${name}</span>
            ${meta ? `<span class="trn-search-item-meta">${meta}</span>` : ''}
            <span class="trn-si-lock">🔒</span>
          </div>`;
        }
        return `<div class="trn-search-item" data-slug="${slug}" data-name="${name}" data-badge="${badge}" data-era="${_esc(bestEra)}">
          <img class="trn-si-badge" src="${badge || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <span class="trn-search-item-name">${name}</span>
          ${meta ? `<span class="trn-search-item-meta">${meta}</span>` : ''}
        </div>`;
      }).join('');
      res.classList.remove('hidden');
    } catch (_) { /* ignore network errors */ }
  }

  function showLockedHint() {
    const n = parseInt(localStorage.getItem('gx_sim_count') || '0', 10) || 0;
    const remaining = Math.max(0, 5 - n);
    const msg = remaining > 0
      ? `🔒 Equipo legendario bloqueado · ${remaining} simulación${remaining !== 1 ? 'es' : ''} más para desbloquear`
      : '🔒 Equipo legendario bloqueado · Comparte en Twitter para desbloquear';
    _showToast(msg);
  }

  function addTeam(slug, name, era = '', badge = '') {
    if (_teams.length >= _numTeams) return;
    if (_teams.some(t => t.slug === slug && (t.era || '') === (era || ''))) {
      _showToast('⚠ Ya tienes ese equipo con la misma temporada.');
      return;
    }
    if (badge) _badgeCache[slug] = badge;
    _teams.push({ slug, name, era });
    clearSearch();
    _renderTeamSlots();
  }

  async function previewTeam(slug, name, badge, era = '') {
    const panel = $('trn-team-preview');
    if (!panel) return;

    // Close dropdown, show loading immediately
    const res = $('trn-search-results');
    if (res) res.classList.add('hidden');

    const safeSlug  = _esc(slug);
    const safeName  = _esc(name);
    const safeBadge = _esc(badge);

    panel.innerHTML = `<div class="trn-preview-loading"><div class="trn-spinner"></div>Cargando plantilla…</div>`;
    panel.classList.remove('hidden');

    const GK_SET  = new Set(['GK']);
    const DEF_SET = new Set(['CB','LB','RB','WB','LWB','RWB','SW']);
    const MID_SET = new Set(['CM','CDM','CAM','LM','RM','DM','LCM','RCM']);
    const ATT_SET = new Set(['ST','CF','LW','RW','SS','FW']);

    const renderRow = (p, posClass, posLabel) => {
      const rt = Math.round(p.rating || 0);
      const rCls = rt >= 90 ? 'rtg-gold' : rt >= 80 ? 'rtg-cyan' : '';
      return `<div class="trn-preview-pos-row">
        <span class="trn-preview-pos-label ${posClass}">${_esc(posLabel)}</span>
        <span class="trn-preview-player-name">${_esc(p.name || '—')}</span>
        ${rt > 0 ? `<span class="trn-preview-rating ${rCls}">${rt}</span>` : ''}
      </div>`;
    };

    // Build era picker HTML if we have multiple seasons cached
    const _sc = _seasonCache[slug] || [];
    const _yrSeasons = _sc.filter(s => /^\d{4}$/.test(s)).sort((a, b) => b - a);
    const _activeEra = era || (_yrSeasons[0] || '');
    let eraPickerHtml = '';
    if (_yrSeasons.length > 1) {
      const chips = _yrSeasons.map(y =>
        `<button class="trn-era-chip${y === _activeEra ? ' trn-era-chip-active' : ''}" data-slug="${safeSlug}" data-name="${safeName}" data-badge="${safeBadge}" data-era="${_esc(y)}">${y}</button>`
      ).join('');
      eraPickerHtml = `<div class="trn-era-picker"><span class="trn-era-label">Temporada:</span><div class="trn-era-chips">${chips}</div></div>`;
    }

    try {
      const r = await fetch(`/lookup?team=${encodeURIComponent(slug)}&era=${encodeURIComponent(_activeEra)}`);
      const data = await r.json();

      const badgeUrl = _esc(data.badgeUrl || badge || '/img/badges/_placeholder.svg');
      const formation = data.formation ? _esc(data.formation) : '';
      const srcYear = data?.source ? (String(data.source).match(/\((\d{4})/)?.[1] || '') : '';
      const resolvedEra = srcYear || _activeEra || '';

      let playersHtml = '';
      if (data.found && Array.isArray(data.players) && data.players.length > 0) {
        const gk    = data.players.filter(p => GK_SET.has(p.position));
        const def   = data.players.filter(p => DEF_SET.has(p.position));
        const mid   = data.players.filter(p => MID_SET.has(p.position));
        const att   = data.players.filter(p => ATT_SET.has(p.position));
        const other = data.players.filter(p =>
          !GK_SET.has(p.position) && !DEF_SET.has(p.position) &&
          !MID_SET.has(p.position) && !ATT_SET.has(p.position));
        playersHtml = [
          ...gk.map(p    => renderRow(p, 'pos-gk',  'POR')),
          ...def.map(p   => renderRow(p, 'pos-def', 'DEF')),
          ...mid.map(p   => renderRow(p, 'pos-mid', 'MED')),
          ...att.map(p   => renderRow(p, 'pos-att', 'DEL')),
          ...other.map(p => renderRow(p, '',        p.position || '?')),
        ].join('');
      }

      panel.innerHTML = `
        ${eraPickerHtml}
        <div class="trn-preview-header">
          <img class="trn-preview-badge" src="${badgeUrl}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <div class="trn-preview-meta">
            <div class="trn-preview-team-name">${safeName}${resolvedEra ? ` <span class="trn-preview-season">'${resolvedEra.slice(-2)}</span>` : ''}</div>
            ${formation ? `<span class="trn-preview-formation">⬢ ${formation}</span>` : ''}
          </div>
        </div>
        ${playersHtml ? `<div class="trn-preview-players">${playersHtml}</div>` : ''}
        <div class="trn-preview-actions">
          <button class="btn-primary trn-preview-add" style="flex:1" data-slug="${safeSlug}" data-name="${safeName}" data-era="${_esc(resolvedEra)}" data-badge="${safeBadge}">✓ Añadir equipo</button>
          <button class="btn-secondary trn-preview-back">← Volver</button>
        </div>`;
    } catch (_err) {
      panel.innerHTML = `
        <div class="trn-preview-header">
          <img class="trn-preview-badge" src="${safeBadge || '/img/badges/_placeholder.svg'}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <div class="trn-preview-meta">
            <div class="trn-preview-team-name">${safeName}${era ? ` <span class="trn-preview-season">'${String(era).slice(-2)}</span>` : ''}</div>
          </div>
        </div>
        <div class="trn-preview-actions">
          <button class="btn-primary trn-preview-add" style="flex:1" data-slug="${safeSlug}" data-name="${safeName}" data-era="${_esc(era)}" data-badge="${safeBadge}">✓ Añadir equipo</button>
          <button class="btn-secondary trn-preview-back">← Volver</button>
        </div>`;
    }
  }

  function clearSearch() {
    const inp = $('trn-search-input');
    if (inp) inp.value = '';
    const res = $('trn-search-results');
    if (res) { res.innerHTML = ''; res.classList.add('hidden'); }
    const clr = $('trn-search-clear');
    if (clr) clr.classList.add('hidden');
    const prev = $('trn-team-preview');
    if (prev) { prev.innerHTML = ''; prev.classList.add('hidden'); }
  }

  function removeTeam(idx) {
    _teams.splice(idx, 1);
    _renderTeamSlots();
  }

  async function fillRandom() {
    const needed = _numTeams - _teams.length;
    if (needed <= 0) return;
    try {
      const catalog = await _getTrnCatalog();
      const existing = new Set(_teams.map(t => t.slug));
      const pool = catalog.filter(t => !existing.has(t.slug));
      const picks = pool.sort(() => Math.random() - 0.5).slice(0, needed);
      picks.forEach(t => {
        if (t.badge) _badgeCache[t.slug] = t.badge;
        const nums = (t.seasons || []).filter(s => /^\d{4}$/.test(s));
        const era  = nums.length ? String(nums.reduce((mx, s) => Math.max(mx, Number(s)), 0)) : '';
        _teams.push({ slug: t.slug, name: t.nameEs || t.nameEn || t.slug, era });
      });
      _renderTeamSlots();
    } catch (_) { /* ignore */ }
  }

  // -- Catalog cache helper -------------------------------------------
  async function _getTrnCatalog() {
    if (_trnCatalog) return _trnCatalog;
    const r = await fetch('/catalog');
    if (!r.ok) throw new Error('catalog unavailable');
    _trnCatalog = await r.json();
    return _trnCatalog;
  }

  // -- Real league loader -----------------------------------------------
  function openLeagueLoader() {
    const panel = $('trn-league-loader');
    if (!panel) return;
    if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    _renderLeagueLoader(panel);
  }

  function closeLeagueLoader() {
    const panel = $('trn-league-loader');
    if (panel) panel.classList.add('hidden');
  }

  async function _renderLeagueLoader(panel) {
    panel.innerHTML = '<div class="trn-ll-loading"><div class="trn-spinner"></div></div>';
    try {
      const catalog = await _getTrnCatalog();
      const groupMap = {};
      const EXCL = new Set(['Selecciones','Fantasy XI','Continentes Hist\u00f3ricos','Am\u00e9rica del Sur','Otros']);
      catalog.forEach(c => {
        if (!c.group) return;
        const gName = c.group.replace(/^\S+\s*/, '');
        if (EXCL.has(gName)) return;
        groupMap[c.group] = (groupMap[c.group] || 0) + 1;
      });
      const groups = Object.entries(groupMap).sort((a, b) => b[1] - a[1]);
      if (!groups.length) { panel.innerHTML = '<p class="trn-ll-empty">Sin ligas disponibles</p>'; return; }
      let html = '<div class="trn-ll-title">\uD83C\uDFC6 Selecciona una liga</div><div class="trn-ll-grid">';
      const _toFlag = code => {
        if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return null;
        const ch = code.toUpperCase();
        return String.fromCodePoint(ch.charCodeAt(0) - 65 + 0x1F1E6) +
               String.fromCodePoint(ch.charCodeAt(1) - 65 + 0x1F1E6);
      };
      groups.forEach(([g, count]) => {
        const rawPrefix = g.match(/^(\S+)/)?.[1] || '';
        const flag = _toFlag(rawPrefix) || rawPrefix || '\uD83C\uDFC6';
        const name  = _esc(g.replace(/^\S+\s*/, ''));
        html += '<button class="trn-ll-btn" data-league="' + _esc(g) + '">' +
          '<span class="trn-ll-icon">' + flag + '</span>' +
          '<span class="trn-ll-name">' + name + '</span>' +
          '<span class="trn-ll-count">' + count + ' eq.</span>' +
          '</button>';
      });
      html += '</div>';
      panel.innerHTML = html;
    } catch (_) {
      panel.innerHTML = '<p class="trn-ll-empty">Error al cargar ligas.</p>';
    }
  }

  // Returns the nearest valid count >= n for the current format.
  // Prefers rounding UP to include all real-league teams; caps at max if too many.
  function _snapCount(n) {
    const counts = VALID_COUNTS[_fmt] || [8, 16];
    if (counts.includes(n)) return n;
    const roundUp = counts.find(c => c >= n);
    return roundUp !== undefined ? roundUp : counts[counts.length - 1];
  }

  async function loadRealLeague(groupKey) {
    try {
      const catalog = await _getTrnCatalog();
      const leagueTeams = catalog.filter(c => c.group === groupKey);
      if (!leagueTeams.length) { _showToast('Sin equipos en esta liga'); return; }

      const teamFromEntry = t => {
        if (t.badge) _badgeCache[t.slug] = t.badge;
        const nums = (t.seasons || []).filter(s => /^\d{4}$/.test(s));
        const era  = nums.length ? String(nums.reduce((mx, s) => Math.max(mx, Number(s)), 0)) : '';
        return { slug: t.slug, name: t.nameEs || t.nameEn || t.slug, era };
      };

      _teams = leagueTeams.map(teamFromEntry);
      const target = _snapCount(_teams.length);

      // Trim if league is larger than the largest valid count
      if (_teams.length > target) _teams = _teams.slice(0, target);

      // Fill with random teams from other groups if league is smaller than target
      if (_teams.length < target) {
        const needed  = target - _teams.length;
        const already = new Set(_teams.map(t => t.slug));
        const pool    = catalog.filter(t => !already.has(t.slug))
                                .sort(() => Math.random() - 0.5)
                                .slice(0, needed);
        pool.forEach(t => _teams.push(teamFromEntry(t)));
      }

      // Update pill picker to the snapped count (pill will exist and highlight)
      setNumTeams(target);
      _buildNumTeamsPicker(); // rebuild pills so target pill is active
      closeLeagueLoader();
      _renderTeamSlots();

      const leagueName = _esc(groupKey.replace(/^\S+\s*/, ''));
      const filled = target - leagueTeams.length;
      const msg = filled > 0
        ? `✅ ${leagueTeams.length} eq. de ${leagueName} + ${filled} aleatorios`
        : `✅ ${_teams.length} equipos de ${leagueName} cargados`;
      _showToast(msg);
      try { _gx('trn_load_real_league', { league: groupKey, count: _teams.length }); } catch(_) {}
    } catch (_) {
      _showToast('Error al cargar la liga.');
    }
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
    _setProgress('Iniciando simulación…', 0);
    try { _gx('trn_simulate_start', { format: _fmt, teams: _numTeams }); } catch(_) {}

    try {
      let data;
      if (_fmt === 'copa' && _rules.copaMode === 'groups') data = await _simulateCopaGrupos();
      else if (_fmt === 'copa')   data = await _simulateCopa();
      else if (_fmt === 'liga')   data = await _simulateLiga();
      else                        data = await _simulateChampions();

      _stopTrnLoadCycle();
      _data = data;
      try { _gx('trn_simulate_success', { format: _fmt, champion: _data.champion?.name }); } catch(_) {}
      _computeTournamentStats(_data);
      _buildMatchCache(_data);
      hide($('trn-step-3'));
      await _showChampionReveal(_data);
      _renderDashboard();
      show($('trn-dashboard'));
    } catch (err) {
      _stopTrnLoadCycle();
      console.error('[TRN]', err);
      $('trn-progress-text').textContent = '⚠ Error en la simulación. Inténtalo de nuevo.';
      show($('trn-step-3-actions'));
    }
  }

  // ── Compartir resultado — Canvas poster ───────────────────
  async function shareTournament() {
    if (!_data) return;
    try { _gx('trn_share', { format: _data.format }); } catch(_) {}
    const btn = document.querySelector('.trn-share-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
    try {
      const blob = await _generateTrnPoster(_data);
      const champSlug = _data.champion?.slug || 'torneo';
      const fileName = `golazox-${champSlug}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `🏆 ${_data.champion?.name || 'GolazoX'} — GolazoX` });
      } else {
        _scDownload(blob, fileName);
        _showToast('🖼 Póster descargado');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[TRN poster]', err);
        _showToast('⚠ No se pudo generar el póster');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📤 Compartir'; }
    }
  }

  /** Generate a Canvas infographic PNG blob for the tournament result. */
  async function _generateTrnPoster(d) {
    await document.fonts.ready;
    await Promise.allSettled([
      'bold 100px "Rajdhani"', 'bold 78px "Rajdhani"',
      'bold 60px "Rajdhani"', 'bold 48px "Rajdhani"',
      '700 38px "Rajdhani"',  '700 30px "Rajdhani"',
      '600 28px "Rajdhani"',  '500 32px "Rajdhani"',
      '400 24px "Rajdhani"',
    ].map(f => document.fonts.load(f).catch(() => null)));

    const W = 1080, H = 4000;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const CYAN    = '#00d4ff';
    const MAGENTA = '#ff2d78';
    const GOLD    = '#ffd700';
    const WHITE   = '#ffffff';
    const DIM     = 'rgba(255,255,255,0.55)';
    const DIM2    = 'rgba(255,255,255,0.28)';

    // ── Background ──────────────────────────────────────────
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, W, H);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0,   '#070710');
    bgGrad.addColorStop(0.5, '#0b0d1a');
    bgGrad.addColorStop(1,   '#110418');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 54) {
      ctx.strokeStyle = `rgba(0,212,255,${x % 162 === 0 ? 0.06 : 0.022})`;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 54) {
      ctx.strokeStyle = `rgba(0,212,255,${y % 162 === 0 ? 0.06 : 0.022})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Glow orbs
    const addOrb = (x, y, r, color) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color + '22'); rg.addColorStop(1, color + '00');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    addOrb(540, 420, 420, '#00d4ff');
    addOrb(160, 1000, 340, '#ff2d78');
    addOrb(920, 1000, 340, '#8800ff');

    // Top neon bar
    const topBar = ctx.createLinearGradient(0, 0, W, 0);
    topBar.addColorStop(0, 'rgba(0,212,255,0)');
    topBar.addColorStop(0.5, 'rgba(0,212,255,0.9)');
    topBar.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = topBar; ctx.fillRect(0, 0, W, 3);

    // ── Header ──────────────────────────────────────────────
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 100px "Rajdhani",Arial,sans-serif';
    _scGlow(ctx, 'GOLAZOX', W / 2, 108, CYAN, 40);

    ctx.font = '500 30px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText('FOOTBALL TIME MACHINE', W / 2, 152);

    _scDivider(ctx, 175, W);

    // Format label
    const fmtLabel = d.format === 'copa' ? 'COPA' : d.format === 'liga' ? 'LIGA' : 'CHAMPIONS';
    ctx.font = 'bold 48px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(fmtLabel, W / 2, 238);

    _scDivider(ctx, 262, W);

    // ── Load champion badge ──────────────────────────────────
    const champSlug   = d.champion?.slug || '';
    const champBadge  = _badge(champSlug) || `/img/badges/${champSlug}.svg`;
    const imgChamp    = await _scLoadImg(champBadge);

    // ── Champion section ─────────────────────────────────────
    const CHAMP_CY = 460;
    _scBadge(ctx, imgChamp, W / 2, CHAMP_CY, 168, GOLD, d.champion?.name);

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 28px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = GOLD + 'cc';
    ctx.fillText('CAMPEÓN DEL TORNEO', W / 2, 655);

    const champName = _scSafe(d.champion?.name || '—');
    const champFontSz = champName.length > 18 ? 52 : champName.length > 14 ? 62 : champName.length > 10 ? 72 : 80;
    ctx.font = `bold ${champFontSz}px "Rajdhani",Arial,sans-serif`;
    _scGlow(ctx, champName, W / 2, 720, WHITE, 12);

    // Era label
    const champEra = d.champion?.era ? String(d.champion.era).match(/\d{4}/)?.[0] : null;
    if (champEra) {
      ctx.font = '500 36px "Rajdhani",Arial,sans-serif';
      ctx.fillStyle = CYAN + 'cc';
      ctx.fillText(`'${champEra.slice(2)}`, W / 2, 768);
    }

    _scDivider(ctx, 800, W);
    let curY = 854;

    // ── Result section ────────────────────────────────────────
    if (d.format === 'liga' && d.table) {
      ctx.font = '600 28px "Rajdhani",Arial,sans-serif';
      ctx.fillStyle = DIM2; ctx.textAlign = 'center';
      ctx.fillText('CLASIFICACIÓN FINAL', W / 2, curY);
      curY += 56;

      const podium  = d.table.slice(0, 3);
      const medals  = ['🥇', '🥈', '🥉'];
      const pillClr = [
        'rgba(255,215,0,0.12)', 'rgba(200,200,200,0.10)', 'rgba(205,127,50,0.10)',
      ];

      for (let i = 0; i < podium.length; i++) {
        const t    = podium[i];
        const rowY = curY + i * 96;
        // Pill background
        ctx.fillStyle = pillClr[i];
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(60, rowY - 28, W - 120, 76, 12);
        else                ctx.rect(60, rowY - 28, W - 120, 76);
        ctx.fill();
        // Medal emoji
        ctx.font = '44px Arial,sans-serif';
        ctx.textAlign = 'left'; ctx.fillStyle = WHITE;
        ctx.fillText(medals[i], 82, rowY + 22);
        // Team name
        const tName = _scSafe(t.name || '').slice(0, 22);
        ctx.font = `bold 46px "Rajdhani",Arial,sans-serif`;
        ctx.fillStyle = i === 0 ? GOLD : WHITE;
        ctx.fillText(tName, 148, rowY + 22);
        // Points
        ctx.textAlign = 'right'; ctx.font = '600 38px "Rajdhani",Arial,sans-serif';
        ctx.fillStyle = DIM;
        ctx.fillText(`${t.pts ?? '—'} pts`, W - 80, rowY + 22);
        ctx.textAlign = 'center';
      }
      curY += podium.length * 96 + 40;

    } else {
      // Copa / Champions — show final match
      const rounds   = d.format === 'copa' ? d.rounds : d.koRounds;
      const lastRnd  = rounds?.[rounds.length - 1];
      const fin      = lastRnd?.matches?.[0];

      if (fin) {
        ctx.font = '600 28px "Rajdhani",Arial,sans-serif';
        ctx.fillStyle = DIM2; ctx.textAlign = 'center';
        ctx.fillText('GRAN FINAL', W / 2, curY);
        curY += 60;

        const [imgA, imgB] = await Promise.all([
          _scLoadImg(_badge(fin.a?.slug) || `/img/badges/${fin.a?.slug || '_placeholder'}.svg`),
          _scLoadImg(_badge(fin.b?.slug) || `/img/badges/${fin.b?.slug || '_placeholder'}.svg`),
        ]);

        const BADGE_R = 90, BADGE_CY = curY + 95;
        const AX = W / 2 - 280, BX = W / 2 + 280;
        _scBadge(ctx, imgA, AX, BADGE_CY, BADGE_R, CYAN,    fin.a?.name);
        _scBadge(ctx, imgB, BX, BADGE_CY, BADGE_R, MAGENTA, fin.b?.name);

        // Score
        const sA = fin.scoreA ?? '?', sB = fin.scoreB ?? '?';
        ctx.font = 'bold 120px "Rajdhani",Arial,sans-serif';
        ctx.textAlign = 'center';
        _scGlow(ctx, `${sA}–${sB}`, W / 2, BADGE_CY + 48, WHITE, 15);

        // Team names
        curY = BADGE_CY + 116;
        ctx.font = '500 30px "Rajdhani",Arial,sans-serif';
        ctx.fillStyle = CYAN + 'cc'; ctx.textAlign = 'center';
        ctx.fillText(_scSafe((fin.a?.name || '').slice(0, 15)), AX, curY);
        ctx.fillStyle = MAGENTA + 'cc';
        ctx.fillText(_scSafe((fin.b?.name || '').slice(0, 15)), BX, curY);

        // Penalties if applicable
        if (fin.penA !== null && fin.penA !== undefined) {
          curY += 42;
          ctx.font = '500 28px "Rajdhani",Arial,sans-serif';
          ctx.fillStyle = GOLD; ctx.textAlign = 'center';
          ctx.fillText(`(Penaltis: ${fin.penA}–${fin.penB})`, W / 2, curY);
        }
        curY += 60;
      }
    }

    _scDivider(ctx, curY, W);
    curY += 54;

    // ── Individual Awards ─────────────────────────────────────
    ctx.font = '600 28px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2; ctx.textAlign = 'center';
    ctx.fillText('PREMIOS INDIVIDUALES', W / 2, curY);
    curY += 56;

    if (d.pichichi?.[0]) {
      const p = d.pichichi[0];
      const imgP = await _scLoadImg(_badge(p.teamSlug) || `/img/badges/${p.teamSlug || '_placeholder'}.svg`);
      _scBadge(ctx, imgP, 100, curY + 22, 36, CYAN, p.team);
      ctx.textAlign = 'left';
      ctx.font = 'bold 36px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = CYAN;
      ctx.fillText('⚽ PICHICHI', 152, curY + 6);
      ctx.font = '500 30px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = WHITE;
      ctx.fillText(_scSafe(p.name), 152, curY + 42);
      ctx.textAlign = 'right';
      ctx.font = 'bold 48px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = GOLD;
      ctx.fillText(`${p.goals}`, W - 80, curY + 32);
      ctx.font = '500 24px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = DIM;
      ctx.fillText('goles', W - 80, curY + 58);
      ctx.textAlign = 'center';
      curY += 110;
    }

    if (d.mvp?.[0]) {
      const m = d.mvp[0];
      const imgM = await _scLoadImg(_badge(m.teamSlug) || `/img/badges/${m.teamSlug || '_placeholder'}.svg`);
      _scBadge(ctx, imgM, 100, curY + 22, 36, MAGENTA, m.team);
      ctx.textAlign = 'left';
      ctx.font = 'bold 36px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = MAGENTA;
      ctx.fillText('⭐ MVP', 152, curY + 6);
      ctx.font = '500 30px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = WHITE;
      ctx.fillText(_scSafe(m.name), 152, curY + 42);
      ctx.textAlign = 'right';
      ctx.font = 'bold 48px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = GOLD;
      ctx.fillText(`${m.count}×`, W - 80, curY + 32);
      ctx.font = '500 24px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = DIM;
      ctx.fillText('MOM', W - 80, curY + 58);
      ctx.textAlign = 'center';
      curY += 110;
    }

    _scDivider(ctx, curY, W);

    // ── Footer ───────────────────────────────────────────────
    const footerY = curY + 24;
    const botBar  = ctx.createLinearGradient(0, 0, W, 0);
    botBar.addColorStop(0, 'rgba(0,212,255,0)');
    botBar.addColorStop(0.5, 'rgba(0,212,255,0.75)');
    botBar.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = botBar; ctx.fillRect(0, footerY, W, 2);

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 36px "Rajdhani",Arial,sans-serif';
    const _sUrl = ((window.GOLAZOX_CONFIG?.siteUrl) || 'golazox.com')
      .replace(/^https?:\/\//, '').replace(/\/$/, '');
    _scGlow(ctx, _sUrl, W / 2, footerY + 56, CYAN, 18);

    ctx.font = '400 22px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2;
    ctx.fillText('Football Time Machine', W / 2, footerY + 88);

    // ── Crop to content ───────────────────────────────────────
    const finalH  = footerY + 124;
    const out     = document.createElement('canvas');
    out.width = W; out.height = Math.min(finalH, H);
    const outCtx  = out.getContext('2d', { alpha: false });
    outCtx.drawImage(canvas, 0, 0, W, out.height, 0, 0, W, out.height);

    return new Promise((resolve, reject) => {
      try {
        out.toBlob(blob => {
          if (blob) { resolve(blob); return; }
          try {
            const dataUrl  = out.toDataURL('image/png');
            const [hdr, b64] = dataUrl.split(',');
            const mime     = (hdr.match(/:(.*?);/) || [])[1] || 'image/png';
            const bstr     = atob(b64);
            const u8       = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
            resolve(new Blob([u8], { type: mime }));
          } catch (e2) { reject(e2); }
        }, 'image/png');
      } catch (e) { reject(e); }
    });
  }

  function _showToast(msg, fallback = false) {
    let el = $('trn-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'trn-toast';
      el.className = 'trn-toast';
      document.body.appendChild(el);
    }
    el.textContent = fallback ? 'No se pudo copiar' : msg;
    el.classList.add('trn-toast--show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('trn-toast--show'), 2800);
  }

  const _TRN_LOADING_MSGS = [
    'Calculando xG con distribución de Poisson…',
    'Simulando 30 000 escenarios por partido…',
    'Aplicando ratings históricos de plantilla…',
    'Resolviendo eliminatorias y desempates…',
    'Calculando diferencia de goles y puntos…',
    'Determinando MVP y Pichichi del torneo…',
    'Compilando la tabla de clasificación…',
    'Construyendo el cuadro de eliminatorias…',
    'Generando estadísticas comparadas…',
    'Finalizando resultados del torneo…',
  ];
  let _trnLoadTimer = null;
  function _startTrnLoadCycle() {
    _stopTrnLoadCycle();
    let i = 0;
    const el = $('trn-progress-text');
    if (!el) return;
    _trnLoadTimer = setInterval(() => {
      i = (i + 1) % _TRN_LOADING_MSGS.length;
      if (el && el.isConnected) el.textContent = _TRN_LOADING_MSGS[i];
    }, 700);
  }
  function _stopTrnLoadCycle() {
    if (_trnLoadTimer) { clearInterval(_trnLoadTimer); _trnLoadTimer = null; }
  }

  function _setProgress(txt, pct) {
    _stopTrnLoadCycle();
    const el = $('trn-progress-text');
    if (el) el.textContent = txt;
    if (pct !== undefined) {
      const bar = $('trn-progress-bar');
      if (bar) bar.style.width = Math.round(Math.min(100, Math.max(0, pct))) + '%';
    }
    // If near the start, begin cycling
    if (pct !== undefined && pct < 10) _startTrnLoadCycle();
  }

  // ── Match cache (built once after simulation, used by bracket + calendar) ─
  function _buildMatchCache(data) {
    _matchCache = [];
    const add = (m, ctx) => {
      m._cacheIdx = _matchCache.length;
      _matchCache.push({ m, nameA: _tLabel(m.a) || '?', nameB: _tLabel(m.b) || '?', ctx: ctx || '' });
    };
    if (data.format === 'liga') {
      const chunk = Math.max(1, Math.floor(data.teams.length / 2));
      data.matches.forEach((m, i) => add(m, `Jornada ${Math.floor(i / chunk) + 1} · Liga`));
    } else if (data.format === 'copa' && !data.groups) {
      data.rounds.forEach(r => r.matches.forEach(m => add(m, r.label + ' · Copa')));
      if (data.thirdPlace) add(data.thirdPlace, '3er Puesto · Copa');
    } else {
      // Copa groups mode or old Champions
      const label = data.format === 'copa' ? 'Copa' : 'Champions';
      (data.groups || []).forEach(g => g.matches.forEach(m => add(m, g.label)));
      (data.koRounds || []).forEach(r => r.matches.forEach(m => add(m, r.label + ' · ' + label)));
      if (data.thirdPlace) add(data.thirdPlace, '3er Puesto · ' + label);
    }
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
      data.format === 'liga' ? '📊 Liga · Campeón' :
      (data.format === 'copa' && data.copaMode === 'groups') ? '🏆 Copa · Grupos · Campeón' :
      data.format === 'copa' ? '🏆 Copa · Campeón' : '⭐ Champions · Campeón';
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
    return `<div class="trn-bkt-match" style="top:${topPx}px" data-match-idx="${idx}">
      <div class="trn-bkt-team ${isWinA ? 'trn-bkt-winner' : 'trn-bkt-loser'}">
        <img class="trn-bkt-badge" src="${_esc(bA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
        <span class="trn-bkt-tname">${_esc(_tLabel(m.a) || '\u2014')}</span>
        ${isWinA ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
      </div>
      <div class="trn-bkt-score-mid">${_esc(score)}</div>
      <div class="trn-bkt-team ${isWinB ? 'trn-bkt-winner' : 'trn-bkt-loser'}">
        <img class="trn-bkt-badge" src="${_esc(bB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
        <span class="trn-bkt-tname">${_esc(_tLabel(m.b) || '\u2014')}</span>
        ${isWinB ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
      </div>
    </div>`;
  }

  function _renderVisualBracket(rounds) {
    if (!rounds || !rounds.length) return '<p style="color:var(--grey);padding:1rem">Sin datos</p>';
    const MATCH_H = 84, HEADER_H = 26, COL_W = 210, SW = 36;
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
      html += `<div class="trn-bkt-champ-name">${_esc(_tLabel(champ))}</div>`;
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
    const totalRounds = Math.ceil(Math.log2(_numTeams));
    let roundsDone = 0;

    while (bracket.length > 1) {
      const n = bracket.length;
      const label = ROUND_LABELS[n] || `Ronda (${n})`;
      _setProgress(`Simulando ${label}…`, 5 + Math.round((roundsDone / totalRounds) * 90));
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
      roundsDone++;
    }

    // ── Partido por el Tercer Puesto (opcional) ───────────
    let thirdPlace = null;
    if (_rules.tercerPuesto && rounds.length >= 2) {
      _setProgress('Simulando 3º puesto…', 97);
      const semiRound = rounds[rounds.length - 2];
      const losers = semiRound.matches.map(m => (m.winner?.slug === m.a?.slug ? m.b : m.a)).filter(Boolean);
      if (losers.length === 2) {
        const { match } = await _simSingleKO(losers[0], losers[1], 9999);
        thirdPlace = match;
      }
    }

    return { format: 'copa', champion: bracket[0], rounds, thirdPlace, teams: _teams };
  }

  // Helper: simulate a single knockout match
  async function _simSingleKO(a, b, salt) {
    const res = await _bulkSim([{ teamA: a.slug, teamB: b.slug, eraA: a.era, eraB: b.era, salt, penalties: true }]);
    const r = res[0];
    const winner = r.penA !== null ? (r.penA > r.penB ? a : b) : (r.scoreA > r.scoreB ? a : b);
    return { match: { a, b, scoreA: r.scoreA, scoreB: r.scoreB, penA: r.penA, penB: r.penB, scorersA: r.scorersA||[], scorersB: r.scorersB||[], mom: r.mom||null, stats: r.stats||null, winner, legs: 1 }, winner };
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
      _setProgress(`Simulando jornadas… (${Math.min(b + BATCH, fixtures.length)} / ${fixtures.length} partidos)`, 5 + Math.round(b / fixtures.length * 90));
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
    const totalGroups = groups.length;
    const groupData = [];
    for (let g = 0; g < groups.length; g++) {
      const grpPct = 5 + Math.round((g / totalGroups) * 55);
      _setProgress(`Simulando grupos… (${g + 1}/${totalGroups})`, grpPct);
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

    // Seeded KO: group winners in one pot, runners-up in another
    const groupWinners  = groupData.map(g => g.table[0]);
    const groupRunners  = groupData.map(g => g.table[1]);
    groupWinners.sort(() => Math.random() - 0.5);
    groupRunners.sort(() => Math.random() - 0.5);
    // Pair winners vs runners (no same-group clashes in R16)
    const seededKO = [];
    for (let i = 0; i < groupWinners.length; i++)
      seededKO.push(groupWinners[i], groupRunners[i]);

    _setProgress('Simulando eliminatorias\u2026', 62);
    // Reuse copa logic for KO rounds
    const koData = await _simulateCopa_internal(seededKO, { idaVuelta: _rules.koIdaVuelta, startPct: 62 });

    return { format: 'champions', champion: koData.champion, groups: groupData, koRounds: koData.rounds, teams: _teams };
  }

  // ── COPA GRUPOS (Fase de Grupos + Eliminatoria) ──────────────────────────
  async function _simulateCopaGrupos() {
    const result = await _simulateChampions();
    result.format = 'copa';
    result.copaMode = 'groups';
    return result;
  }

  // ── COPA GRUPOS (Fase de Grupos + Eliminatoria) ──────────────────────────
  async function _simulateCopaGrupos() {
    const result = await _simulateChampions();
    result.format = 'copa';
    result.copaMode = 'groups';
    return result;
  }

  // Internal copa simulation (reused for Champions KO rounds) — supports ida y vuelta
  async function _simulateCopa_internal(teamList, rules = {}) {
    const { idaVuelta = false, startPct = 5 } = rules;
    const ROUND_LABELS = { 2: 'Final', 4: 'Semifinales', 8: 'Cuartos de final', 16: 'Octavos de final', 32: 'Dieciseisavos de final' };
    let bracket = [...teamList];
    const rounds = [];
    const totalRounds = Math.ceil(Math.log2(teamList.length));
    let roundsDone = 0;

    while (bracket.length > 1) {
      const n = bracket.length;
      const label = ROUND_LABELS[n] || `Ronda ${n}`;
      const isFinal = n === 2;
      _setProgress(`Eliminatoria — ${label}…`, startPct + Math.round((roundsDone / totalRounds) * (90 - startPct)));
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
      roundsDone++;
    }

    return { champion: bracket[0], rounds };
  }

  // ── Champion path through the tournament ─────────────────
  function _renderChampionPath(data) {
    const champSlug = data.champion?.slug;
    if (!champSlug) return '';
    const path = [];

    if (data.format === 'champions' || (data.format === 'copa' && data.groups)) {
      // Group stage matches
      const champGroup = (data.groups || []).find(g => g.table.some(r => r.slug === champSlug));
      if (champGroup) {
        champGroup.matches.forEach(m => {
          const isA = m.a?.slug === champSlug;
          const isB = m.b?.slug === champSlug;
          if (!isA && !isB) return;
          const opp  = isA ? m.b : m.a;
          const gfC  = isA ? m.scoreA : m.scoreB;
          const gaC  = isA ? m.scoreB : m.scoreA;
          path.push({ round: champGroup.label, opp, gfC, gaC, result: gfC > gaC ? 'w' : gaC > gfC ? 'l' : 'd', legs: 1, penA: null });
        });
      }
    }

    const rounds = data.format === 'copa' ? data.rounds : (data.koRounds || []);
    rounds.forEach(r => {
      r.matches.forEach(m => {
        const isA = m.a?.slug === champSlug;
        const isB = m.b?.slug === champSlug;
        if (!isA && !isB) return;
        const opp = isA ? m.b : m.a;
        const gfC = m.legs === 2
          ? (isA ? m.aggA : m.aggB)
          : (isA ? m.scoreA : m.scoreB);
        const gaC = m.legs === 2
          ? (isA ? m.aggB : m.aggA)
          : (isA ? m.scoreB : m.scoreA);
        const result = gfC > gaC ? 'w' : gaC > gfC ? 'l' : 'd';
        path.push({ round: r.label, opp, gfC, gaC, result, legs: m.legs, penA: m.penA, penB: m.penB, aggA: m.aggA, aggB: m.aggB, isA });
      });
    });

    if (!path.length) return '';
    const rCls = { w: 'trn-path-w', d: 'trn-path-d', l: 'trn-path-l' };
    const rLabel = { w: 'V', d: 'E', l: 'D' };
    return `<h3 class="trn-section-h trn-section-h-mt">📍 Camino al t\u00edtulo</h3>
      <div class="trn-champ-path">
        ${path.map(p => {
          const penStr = p.penA !== null ? ` (${p.isA ? p.penA : p.penB}\u2013${p.isA ? p.penB : p.penA}p)` : '';
          const scoreStr = p.legs === 2 ? `${p.gfC}\u2013${p.gaC}${penStr}<small> agg</small>` : `${p.gfC}\u2013${p.gaC}${penStr}`;
          return `<div class="trn-path-row">
            <span class="trn-path-round">${_esc(p.round)}</span>
            ${_badgeImg(p.opp?.slug, 'trn-path-badge')}
            <span class="trn-path-opp">${_esc(_tLabel(p.opp) || '?')}</span>
            <span class="trn-path-score">${scoreStr}</span>
            <span class="trn-path-res ${rCls[p.result]}">${rLabel[p.result]}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  // ── Compute tournament-wide stats ─────────────────────
  function _computeTournamentStats(data) {
    const allMatches = _getAllMatches(data);
    const scorers = {};
    const moms    = {};

    function _processLeg(leg, teamA, teamB) {
      (leg.scorersA || []).forEach(s => {
        const key = s.name + '|' + (teamA?.slug || '');
        if (!scorers[key]) scorers[key] = { name: s.name, team: _tLabel(teamA) || '', teamSlug: teamA?.slug || '', era: teamA?.era || '', goals: 0 };
        scorers[key].goals++;
      });
      (leg.scorersB || []).forEach(s => {
        const key = s.name + '|' + (teamB?.slug || '');
        if (!scorers[key]) scorers[key] = { name: s.name, team: _tLabel(teamB) || '', teamSlug: teamB?.slug || '', era: teamB?.era || '', goals: 0 };
        scorers[key].goals++;
      });
      if (leg.mom) {
        const momTeam = leg.mom.team === 'A' ? teamA : teamB;
        const key = leg.mom.name + '|' + (momTeam?.slug || '');
        if (!moms[key]) moms[key] = { name: leg.mom.name, team: _tLabel(momTeam) || '', teamSlug: momTeam?.slug || '', era: momTeam?.era || '', count: 0 };
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

    data.pichichi    = Object.values(scorers).sort((a, b) => b.goals - a.goals).slice(0, 10);
    data.mvp         = Object.values(moms).sort((a, b) => b.count - a.count).slice(0, 5);
    data._scorersAll = Object.values(scorers);
    data._momsAll    = Object.values(moms);
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

  // ── Calendar match card helper ──────────────────────────
  function _matchCard(m, nameA, nameB, score) {
    const idx = m._cacheIdx ?? 0;
    const slugA = m.a?.slug, slugB = m.b?.slug;
    const bA = _badge(slugA) || '/img/badges/_placeholder.svg';
    const bB = _badge(slugB) || '/img/badges/_placeholder.svg';
    const isWinA = m.winner?.slug && m.winner.slug === slugA;
    const isWinB = m.winner?.slug && m.winner.slug === slugB;
    const scorersA = (m.scorersA || (m.r1 ? [...(m.r1.scorersA||[]),...(m.r2?.scorersB||[])] : [])).map(s=>_esc(s.name)).join(', ');
    const scorersB = (m.scorersB || (m.r1 ? [...(m.r1.scorersB||[]),...(m.r2?.scorersA||[])] : [])).map(s=>_esc(s.name)).join(', ');
    return `<div class="trn-cal-match${isWinA ? ' trn-cal-win-a' : isWinB ? ' trn-cal-win-b' : ''}" data-match-idx="${idx}">
      <div class="trn-cal-team-side">
        <img class="trn-cal-badge" src="${_esc(bA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
        <span class="trn-cal-tname${isWinA ? ' trn-q' : ''}">${_esc(nameA)}</span>
      </div>
      <div class="trn-cal-score">${score}</div>
      <div class="trn-cal-team-side trn-cal-side-right">
        <span class="trn-cal-tname${isWinB ? ' trn-q' : ''}">${_esc(nameB)}</span>
        <img class="trn-cal-badge" src="${_esc(bB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
      </div>
      ${(scorersA || scorersB) ? `<div class="trn-cal-scorers"><span class="trn-cal-scorer-a">${scorersA}</span><span class="trn-cal-scorer-sep"></span><span class="trn-cal-scorer-b">${scorersB}</span></div>` : ''}
    </div>`;
  }

  // ── Calendar match card helper ──────────────────────────
  function _matchCard(m, nameA, nameB, score) {
    const idx = m._cacheIdx ?? 0;
    const slugA = m.a?.slug, slugB = m.b?.slug;
    const bA = _badge(slugA) || '/img/badges/_placeholder.svg';
    const bB = _badge(slugB) || '/img/badges/_placeholder.svg';
    const isWinA = m.winner?.slug && m.winner.slug === slugA;
    const isWinB = m.winner?.slug && m.winner.slug === slugB;
    const scorersA = (m.scorersA || (m.r1 ? [...(m.r1.scorersA||[]),...(m.r2?.scorersB||[])] : [])).map(s=>_esc(s.name)).join(', ');
    const scorersB = (m.scorersB || (m.r1 ? [...(m.r1.scorersB||[]),...(m.r2?.scorersA||[])] : [])).map(s=>_esc(s.name)).join(', ');
    return `<div class="trn-cal-match${isWinA ? ' trn-cal-win-a' : isWinB ? ' trn-cal-win-b' : ''}" data-match-idx="${idx}">
      <div class="trn-cal-team-side">
        <img class="trn-cal-badge" src="${_esc(bA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
        <span class="trn-cal-tname${isWinA ? ' trn-q' : ''}">${_esc(nameA)}</span>
      </div>
      <div class="trn-cal-score">${score}</div>
      <div class="trn-cal-team-side trn-cal-side-right">
        <span class="trn-cal-tname${isWinB ? ' trn-q' : ''}">${_esc(nameB)}</span>
        <img class="trn-cal-badge" src="${_esc(bB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
      </div>
      ${(scorersA || scorersB) ? `<div class="trn-cal-scorers"><span class="trn-cal-scorer-a">${scorersA}</span><span class="trn-cal-scorer-sep"></span><span class="trn-cal-scorer-b">${scorersB}</span></div>` : ''}
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
      _data.format === 'liga' ? '📊 Liga' :
      (_data.format === 'copa' && _data.copaMode === 'groups') ? '🏆 Copa · Grupos' :
      _data.format === 'copa' ? '🏆 Copa' : '⭐ Champions';

    // Runner-up on poster
    const runnerUpEl = $('trn-champ-runnerup');
    if (runnerUpEl) {
      let ru = null;
      if (_data.format === 'copa' || _data.format === 'champions') {
        const finalRounds = _data.koRounds || _data.rounds;
        const fin = finalRounds?.[finalRounds.length - 1]?.matches[0];
        if (fin) ru = fin.winner?.slug === fin.a?.slug ? fin.b : fin.a;
      } else if (_data.format === 'liga') {
        ru = _data.table[1] || null;
      }
      if (ru) {
        runnerUpEl.innerHTML = `${_badgeImg(ru.slug, 'trn-ru-badge')}<span class="trn-ru-name">${_esc(_tLabel(ru))}</span>`;
        runnerUpEl.classList.remove('hidden');
      } else {
        runnerUpEl.classList.add('hidden');
      }
    }

    // Rename bracket tab based on format
    const bracketTabBtn = document.querySelector('.trn-dash-tab[data-tab="bracket"]');
    if (bracketTabBtn) bracketTabBtn.textContent = _data.format === 'liga' ? 'Clasificación' : 'Cuadro';

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

  // ── Calendar tab ─────────────────────────────────────────
  function _renderCalendar() {
    const el = $('trn-tab-calendar');
    if (!el || !_data) return;
    const d = _data;
    let html = '';

    if (d.format === 'liga') {
      html = `<h3 class="trn-section-h">📅 Partidos</h3>`;
      const matchesPerJornada = Math.max(1, Math.floor(_numTeams / 2));
      const matches = d.matches || [];
      for (let i = 0; i < matches.length; i += matchesPerJornada) {
        const jornada = matches.slice(i, i + matchesPerJornada);
        const jNum = Math.floor(i / matchesPerJornada) + 1;
        const openAttr = jNum === 1 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">Jornada ${jNum} <span class="trn-jornada-cnt">${jornada.length}</span></summary>`;
        jornada.forEach(m => {
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}`);
        });
        html += '</details>';
      }
    } else if (d.groups) {
      // Copa groups mode or old champions
      html = `<h3 class="trn-section-h">📅 Fase de Grupos</h3>`;
      (d.groups || []).forEach((g, gi) => {
        const openAttr = gi === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(g.label)} <span class="trn-jornada-cnt">${g.matches.length}</span></summary>`;
        // Group table first
        html += '<div class="trn-mini-table" style="margin:.5rem 0 .3rem">';
        g.table.forEach((r, i) => {
          const medals = ['🥇','🥈','🥉'];
          const qualifier = i < 2;
          html += `<div class="trn-mini-row${i===0?' trn-mini-row-top':''}">
            <span class="trn-mini-pos">${medals[i]||String(i+1)}</span>
            ${_badgeImg(r.slug,'trn-mini-badge')}
            <span class="trn-mini-team${qualifier?' trn-q':''}">${_esc(_tLabel(r))}</span>
            <span class="trn-mini-pts">${r.pts}p</span>
            <span class="trn-mini-gd">${r.gf}-${r.ga}</span>
          </div>`;
        });
        html += '</div>';
        // Group matches
        g.matches.forEach(m => {
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}`);
        });
        html += '</details>';
      });
      html += `<h3 class="trn-section-h trn-section-h-mt">📅 Eliminatorias</h3>`;
      [...(d.koRounds || [])].reverse().forEach((r, ri) => {
        const openAttr = ri === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
        });
        html += '</details>';
      });
    } else {
      // Copa KO mode
      html = `<h3 class="trn-section-h">📅 Resultados por ronda</h3>`;
      [...(d.rounds || [])].reverse().forEach((r, ri) => {
        const openAttr = ri === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          if (m.legs === 2) {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB} <small>(agg)</small>${penStr}`);
          } else {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
          }
        });
        html += '</details>';
      });
      if (d.thirdPlace) {
        const m = d.thirdPlace, penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
        html += `<h3 class="trn-section-h trn-section-h-mt">🥉 3er Puesto</h3>`;
        html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
      }
    }
    el.innerHTML = html;
  }

  // ── Bracket tab (= Clasificación tab for Liga) ───────────
  function _renderBracket() {
    const el = $('trn-tab-bracket');
    if (!el || !_data) return;
    const d = _data;
    if (d.format === 'liga') {
      const table = d.table || [];
      const medals = ['🥇', '🥈', '🥉'];
      const rows = table.map((r, i) => `
        <div class="trn-mini-row ${i === 0 ? 'trn-mini-row-top' : ''}">
          <span class="trn-mini-pos">${medals[i] || String(i + 1)}</span>
          ${_badgeImg(r.slug, 'trn-mini-badge')}
          <span class="trn-mini-team">${_esc(_tLabel(r))}</span>
          <span class="trn-mini-pts">${r.pts} pts</span>
          <span class="trn-mini-gd trn-mini-gd-full">
            <span>${r.p ?? 0} PJ</span>
            <span>${r.w ?? 0}G ${r.d ?? 0}E ${r.l ?? 0}P</span>
            <span>${r.gf ?? 0}:${r.ga ?? 0}</span>
          </span>
        </div>`).join('');
      el.innerHTML = `<h3 class="trn-section-h">📊 Clasificación</h3>
        <div class="trn-mini-table">${rows || '<p class="trn-lu-empty">Sin datos</p>'}</div>`;
      return;
    }
    const rounds = d.koRounds || d.rounds || [];
    el.innerHTML = `<div class="trn-bkt-scroll">${_renderVisualBracket(rounds)}</div>`;
  }

  // ── Calendar tab ─────────────────────────────────────────
  function _renderCalendar() {
    const el = $('trn-tab-calendar');
    if (!el || !_data) return;
    const d = _data;
    let html = '';

    if (d.format === 'liga') {
      html = `<h3 class="trn-section-h">📅 Partidos</h3>`;
      const matchesPerJornada = Math.max(1, Math.floor(_numTeams / 2));
      const matches = d.matches || [];
      for (let i = 0; i < matches.length; i += matchesPerJornada) {
        const jornada = matches.slice(i, i + matchesPerJornada);
        const jNum = Math.floor(i / matchesPerJornada) + 1;
        const openAttr = jNum === 1 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">Jornada ${jNum} <span class="trn-jornada-cnt">${jornada.length}</span></summary>`;
        jornada.forEach(m => {
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}`);
        });
        html += '</details>';
      }
    } else if (d.groups) {
      // Copa groups mode or old champions
      html = `<h3 class="trn-section-h">📅 Fase de Grupos</h3>`;
      (d.groups || []).forEach((g, gi) => {
        const openAttr = gi === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(g.label)} <span class="trn-jornada-cnt">${g.matches.length}</span></summary>`;
        // Group table first
        html += '<div class="trn-mini-table" style="margin:.5rem 0 .3rem">';
        g.table.forEach((r, i) => {
          const medals = ['🥇','🥈','🥉'];
          const qualifier = i < 2;
          html += `<div class="trn-mini-row${i===0?' trn-mini-row-top':''}">
            <span class="trn-mini-pos">${medals[i]||String(i+1)}</span>
            ${_badgeImg(r.slug,'trn-mini-badge')}
            <span class="trn-mini-team${qualifier?' trn-q':''}">${_esc(_tLabel(r))}</span>
            <span class="trn-mini-pts">${r.pts}p</span>
            <span class="trn-mini-gd">${r.gf}-${r.ga}</span>
          </div>`;
        });
        html += '</div>';
        // Group matches
        g.matches.forEach(m => {
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}`);
        });
        html += '</details>';
      });
      html += `<h3 class="trn-section-h trn-section-h-mt">📅 Eliminatorias</h3>`;
      [...(d.koRounds || [])].reverse().forEach((r, ri) => {
        const openAttr = ri === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
        });
        html += '</details>';
      });
    } else {
      // Copa KO mode
      html = `<h3 class="trn-section-h">📅 Resultados por ronda</h3>`;
      [...(d.rounds || [])].reverse().forEach((r, ri) => {
        const openAttr = ri === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          if (m.legs === 2) {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB} <small>(agg)</small>${penStr}`);
          } else {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
          }
        });
        html += '</details>';
      });
      if (d.thirdPlace) {
        const m = d.thirdPlace, penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
        html += `<h3 class="trn-section-h trn-section-h-mt">🥉 3er Puesto</h3>`;
        html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
      }
    }
    el.innerHTML = html;
  }

  // ── Swipe gestures on dashboard ──────────────────────────
  const _TAB_ORDER = ['summary', 'bracket', 'calendar', 'stats'];
  (function _initSwipe() {
    let _sx = 0, _sy = 0;
    document.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!_data) return;
      const dash = $('trn-dashboard');
      if (!dash || dash.classList.contains('hidden')) return;
      const dx = e.changedTouches[0].clientX - _sx;
      const dy = e.changedTouches[0].clientY - _sy;
      if (Math.abs(dx) < 52 || Math.abs(dy) > Math.abs(dx) * 0.8) return;
      const cur = _TAB_ORDER.indexOf(_tab);
      if (dx < 0 && cur < _TAB_ORDER.length - 1) switchDashTab(_TAB_ORDER[cur + 1]);
      if (dx > 0 && cur > 0) switchDashTab(_TAB_ORDER[cur - 1]);
    }, { passive: true });
  })();

  // ── Summary tab ──────────────────────────────────────────
  function _renderSummary() {
    const el = $('trn-tab-summary');
    if (!el || !_data) return;
    const d = _data;

    try {
      if (d.format === 'liga') {
        const medals = ['🥇', '🥈', '🥉'];
        const top5 = (d.table || []).slice(0, 5);
        el.innerHTML = _renderStatCards() + `
          <h3 class="trn-section-h">🥇 TOP 5</h3>
          <div class="trn-mini-table">
            ${top5.map((r, i) => `
              <div class="trn-mini-row ${i === 0 ? 'trn-mini-row-top' : ''}">
                <span class="trn-mini-pos">${medals[i] || String(i + 1)}</span>
                ${_badgeImg(r.slug, 'trn-mini-badge')}
                <span class="trn-mini-team">${_esc(_tLabel(r))}</span>
                <span class="trn-mini-pts">${r.pts} pts</span>
                <span class="trn-mini-gd">${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</span>
              </div>`).join('')}
          </div>`;
        return;
      }

      // Copa (KO or groups) and legacy Champions
      let html = _renderStatCards();

      // Champion path (bonus section — doesn't fail the whole render)
      try { html += _renderChampionPath(d); } catch(_) {}

      // Round results
      if (d.groups) {
        // Groups mode
        html += `<h3 class="trn-section-h trn-section-h-mt">📊 Grupos</h3>`;
        (d.groups || []).forEach((g, gi) => {
          const openAttr = gi === 0 ? ' open' : '';
          html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(g.label)} <span class="trn-jornada-cnt">${g.table.length}</span></summary>`;
          html += '<div class="trn-mini-table" style="margin:.4rem 0 .3rem">';
          (g.table || []).forEach((r, i) => {
            const q = i < 2;
            html += `<div class="trn-mini-row${i===0?' trn-mini-row-top':''}">
              ${_badgeImg(r.slug,'trn-mini-badge')}
              <span class="trn-mini-team${q?' trn-q':''}">${_esc(_tLabel(r))}</span>
              <span class="trn-mini-pts">${r.pts}p</span>
              <span class="trn-mini-gd">${r.gf}-${r.ga}</span>
            </div>`;
          });
          html += '</div></details>';
        });
        html += `<h3 class="trn-section-h trn-section-h-mt">🏆 Eliminatorias</h3>`;
        [...(d.koRounds || [])].reverse().forEach((r, ri) => {
          const openAttr = ri === 0 ? ' open' : '';
          html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
          r.matches.forEach(m => {
            const penStr = m.penA != null && typeof m.penA === 'number' ? ` (p: ${m.penA}–${m.penB})` : '';
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
          });
          html += '</details>';
        });
      } else {
        // Copa KO
        html += `<h3 class="trn-section-h trn-section-h-mt">🏆 Resultados por ronda</h3>`;
        [...(d.rounds || [])].reverse().forEach((r, ri) => {
          const openAttr = ri === 0 ? ' open' : '';
          html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
          r.matches.forEach(m => {
            const penStr = m.penA != null && typeof m.penA === 'number' ? ` (p: ${m.penA}–${m.penB})` : '';
            if (m.legs === 2) {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB} <small>(agg)</small>${penStr}`);
            } else {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
            }
          });
          html += '</details>';
        });
        if (d.thirdPlace) {
          const m = d.thirdPlace, penStr = m.penA != null && typeof m.penA === 'number' ? ` (p: ${m.penA}–${m.penB})` : '';
          html += `<h3 class="trn-section-h trn-section-h-mt">🥉 3er Puesto</h3>`;
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
        }
      }

      el.innerHTML = html;
    } catch (err) {
      console.error('[_renderSummary]', err);
      el.innerHTML = `<p style="padding:1rem;color:rgba(255,255,255,.5)">Error al renderizar resumen: ${_esc(err.message)}</p>`;
    }
  }

  // ── Dream XI ─────────────────────────────────────────────
  async function _buildDreamXI(d) {
    // Build composite player score: goals×1 + MOM×2
    const pm = {};
    (d._scorersAll || d.pichichi || []).forEach(r => {
      const k = r.name + '|' + r.teamSlug;
      if (!pm[k]) pm[k] = { name: r.name, team: r.team, teamSlug: r.teamSlug, era: r.era || '', goals: 0, mom: 0 };
      pm[k].goals += (r.goals || 0);
    });
    (d._momsAll || d.mvp || []).forEach(r => {
      const k = r.name + '|' + r.teamSlug;
      if (!pm[k]) pm[k] = { name: r.name, team: r.team, teamSlug: r.teamSlug, era: r.era || '', goals: 0, mom: 0 };
      pm[k].mom += (r.count || 0);
    });
    const players = Object.values(pm)
      .map(p => ({ ...p, score: p.goals + p.mom * 2 }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);
    if (players.length < 3) return null;

    // Fetch positions from /lookup for all unique team slugs in top 30
    const top30 = players.slice(0, 30);
    const teamKeys = [...new Set(top30.map(p => p.teamSlug + '|' + (p.era || '')))].filter(k => k.split('|')[0]);
        const lookupResults = await Promise.allSettled(teamKeys.map(k => {
      const idx = k.indexOf('|');
      const slug = k.slice(0, idx);
      const era  = k.slice(idx + 1);
      return fetch(`/lookup?team=${encodeURIComponent(slug)}&era=${encodeURIComponent(era)}`)
        .then(r => r.ok ? r.json() : null).catch(() => null);
    }));

    // Map lowercase name → position string
    const nameToPos = {};
    lookupResults.forEach(res => {
      const ld = res.value;
      if (!ld?.players) return;
      ld.players.forEach(p => { if (p.name) nameToPos[p.name.toLowerCase()] = p.position; });
    });

    // Position groups
    const GK_SET  = new Set(['GK']);
    const DEF_SET = new Set(['CB','LB','RB','WB','LWB','RWB','SW']);
    const MID_SET = new Set(['CM','CDM','CAM','LM','RM','DM','LCM','RCM']);
    const ATT_SET = new Set(['ST','CF','LW','RW','SS','FW']);
    const posGroup = pos => GK_SET.has(pos) ? 'gk' : DEF_SET.has(pos) ? 'def' : MID_SET.has(pos) ? 'mid' : ATT_SET.has(pos) ? 'att' : 'unk';

    const tagged = players.map(p => {
      const pos = nameToPos[p.name.toLowerCase()];
      return { ...p, pos: pos || '?', group: pos ? posGroup(pos) : 'unk' };
    });

    // Greedy selection: 1 GK, 4 DEF, 3 MID, 3 ATT
    const quotas = { gk: 1, def: 4, mid: 3, att: 3 };
    const selected = { gk: [], def: [], mid: [], att: [] };
    const used = new Set();

    // Pass 1: native position
    for (const p of tagged) {
      const key = p.name + '|' + p.teamSlug;
      if (used.has(key)) continue;
      const g = p.group;
      if (selected[g] && selected[g].length < quotas[g]) {
        selected[g].push(p);
        used.add(key);
      }
    }
    // Pass 2: fill gaps from remaining players in score order
    const remaining = tagged.filter(p => !used.has(p.name + '|' + p.teamSlug));
    for (const g of ['gk','def','mid','att']) {
      while (selected[g].length < quotas[g] && remaining.length) {
        const p = remaining.shift();
        selected[g].push({ ...p, pos: '?' });
        used.add(p.name + '|' + p.teamSlug);
      }
    }
    return selected;
  }

  function _renderXIHtml(xi) {
    if (!xi) return `<p class="trn-lu-empty">Datos insuficientes para el Once Ideal</p>`;
    const card = p => {
      const stat = p.goals > 0 && p.mom > 0 ? `${p.goals}⚽ ${p.mom}⭐`
                 : p.goals > 0 ? `${p.goals}⚽`
                 : p.mom > 0   ? `${p.mom}⭐`
                 : '';
      const last = _esc(p.name.split(/\s+/).slice(-1)[0] || p.name);
      return `<div class="trn-xi-player">
        ${_badgeImg(p.teamSlug, 'trn-xi-badge')}
        <div class="trn-xi-name">${last}</div>
        ${stat ? `<div class="trn-xi-stat">${stat}</div>` : ''}
      </div>`;
    };
    const line = (arr, cls) => arr?.length
      ? `<div class="trn-xi-line ${cls}">${arr.map(card).join('')}</div>` : '';
    return `<div class="trn-xi-pitch">
      ${line(xi.att, 'trn-xi-att')}
      ${line(xi.mid, 'trn-xi-mid')}
      ${line(xi.def, 'trn-xi-def')}
      ${line(xi.gk,  'trn-xi-gk')}
    </div>`;
  }

  async function _loadDreamXI(d) {
    const sec = document.getElementById('trn-xi-section');
    if (!sec) return;
    try {
      const xi = await _buildDreamXI(d);
      sec.innerHTML = `<h3 class="trn-section-h">\uD83C\uDF1F Once Ideal del Torneo</h3>${_renderXIHtml(xi)}`;
    } catch (_e) {
      sec.innerHTML = `<h3 class="trn-section-h">\uD83C\uDF1F Once Ideal del Torneo</h3><p class="trn-lu-empty">Sin datos suficientes</p>`;
    }
  }

  // ── 

  // ── Stats tab ────────────────────────────────────────────
  function _renderStats() {
    const el = $('trn-tab-stats');
    if (!el || !_data) return;
    const d = _data;

    // Aggregate all matches
    const allMatches = _getAllMatches(d);
    const totals = {};
    _teams.forEach(t => { totals[t.slug] = { name: _tLabel(t), slug: t.slug, gf: 0, ga: 0, mp: 0, w: 0 }; });

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
            ${_badgeImg(r.teamSlug, 'trn-stats-badge')}
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-club">${_esc(r.team)}</span>
            <span class="trn-stats-gf" title="Goles">${r.goals} goles</span>
          </div>`).join('')}
      </div>
      ${(d.mvp || []).length ? `
      <h3 class="trn-section-h trn-section-h-mt">⭐ Mejor Jugador (MOM)</h3>
      <div class="trn-stats-list">
        ${(d.mvp || []).slice(0, 5).map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            ${_badgeImg(r.teamSlug, 'trn-stats-badge')}
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-club">${_esc(r.team)}</span>
            <span class="trn-stats-gf">${r.count}× MOM</span>
          </div>`).join('')}
      </div>` : ''}
      <h3 class="trn-section-h trn-section-h-mt">⚽ Equipos más goleadores</h3>
      <div class="trn-stats-list">
        ${top.map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            ${_badgeImg(r.slug, 'trn-stats-badge')}
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-gf" title="Goles">${r.gf} G</span>
            <span class="trn-stats-ratio">${r.mp ? (r.gf / r.mp).toFixed(1) : '0.0'}/p</span>
            <span class="trn-stats-mp" title="Partidos">${r.mp} PJ</span>
          </div>`).join('')}
      </div>
      <h3 class="trn-section-h trn-section-h-mt">🛡 Defensas más sólidas</h3>
      <div class="trn-stats-list">
        ${Object.values(totals).filter(r => r.mp > 0).sort((a, b) => a.ga - b.ga).slice(0, 5).map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            ${_badgeImg(r.slug, 'trn-stats-badge')}
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-gf" title="Goles en contra">${r.ga} GC</span>
            <span class="trn-stats-ratio">${r.mp ? (r.w / r.mp * 100).toFixed(0) : '0'}% V</span>
          </div>`).join('')}
      </div>
      <div id="trn-xi-section">
        <h3 class="trn-section-h">🌟 Once Ideal del Torneo</h3>
        <div class="trn-xi-loading"><div class="trn-spinner"></div></div>
      </div>
      ${_renderDestacados(allMatches)}`;
    _loadDreamXI(d);
  }

  // ── Form guide (last N results for a team in Liga) ────────
  function _formGuide(slug, matches, n = 5) {
    const results = [];
    (matches || []).forEach(m => {
      if (m.a?.slug === slug) results.push(m.scoreA > m.scoreB ? 'w' : m.scoreA < m.scoreB ? 'l' : 'd');
      else if (m.b?.slug === slug) results.push(m.scoreB > m.scoreA ? 'w' : m.scoreB < m.scoreA ? 'l' : 'd');
    });
    return results.slice(-n)
      .map(r => `<span class="trn-form trn-form-${r}">${r.toUpperCase()}</span>`)
      .join('');
  }

  // ── Resultados destacados for stats tab ────────────────────
  function _renderDestacados(allMatches) {
    const singles = allMatches.filter(m => m.legs !== 2 && m.scoreA !== undefined);
    const byMargin = [...singles].sort((a, b) => Math.abs(b.scoreA - b.scoreB) - Math.abs(a.scoreA - a.scoreB)).slice(0, 3);
    const byGoals  = [...singles].sort((a, b) => (b.scoreA + b.scoreB) - (a.scoreA + a.scoreB)).slice(0, 3);
    const card = (m, label) => {
      if (!m) return '';
      return `<div class="trn-dest-card" data-match-idx="${m._cacheIdx ?? 0}" style="cursor:pointer">
        <div class="trn-dest-label">${label}</div>
        <div class="trn-dest-match">
          ${_badgeImg(m.a?.slug, 'trn-dest-badge')}
          <span class="trn-dest-score">${m.scoreA}\u2013${m.scoreB}</span>
          ${_badgeImg(m.b?.slug, 'trn-dest-badge')}
        </div>
        <div class="trn-dest-teams">${_esc(m.a?.name || '?')} vs ${_esc(m.b?.name || '?')}</div>
      </div>`;
    };
    if (!byMargin.length) return '';
    return `
      <h3 class="trn-section-h trn-section-h-mt">\ud83d\udcca Resultados destacados</h3>
      <div class="trn-dest-grid">
        ${byMargin.map((m, i) => card(m, i === 0 ? '\ud83e\udd47 Mayor goleada' : `Goleada #${i + 1}`)).join('')}
      </div>
      <div class="trn-dest-grid" style="margin-top:.5rem">
        ${byGoals.map((m, i) => card(m, i === 0 ? '\u26bd M\u00e1s goles' : `Golazos #${i + 1}`)).join('')}
      </div>`;
  }

  function _getAllMatches(d) {
    const extra = d.thirdPlace ? [d.thirdPlace] : [];
    if (d.format === 'liga') return d.matches;
    if (d.groups || d.koRounds) {
      // Copa groups mode or old Champions
      const grpMatches = (d.groups || []).flatMap(g => g.matches);
      const koMatches  = (d.koRounds || []).flatMap(r => r.matches);
      return [...grpMatches, ...koMatches, ...extra];
    }
    // Copa KO mode
    return [...(d.rounds || []).flatMap(r => r.matches), ...extra];
  }

  // ── Start over ───────────────────────────────────────────
  function startOver() {
    _fmt = null; _teams = []; _draw = []; _groupsDraw = []; _data = null; _tab = 'summary'; _matchCache = []; _badgeCache = {}; _modalIdx = -1;
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
    _modalIdx = idx;
    const { m, nameA, nameB, ctx } = entry;

    const modal  = $('trn-match-modal');
    const header = $('trn-modal-header');
    const body   = $('trn-modal-body');
    if (!modal || !header || !body) return;

    // Resolve aggregate scores & scorer lists
    let scoreA, scoreB, scorersA, scorersB;
    if (m.legs === 2) {
      scoreA   = m.aggA; scoreB = m.aggB;
      scorersA = [...(m.r1?.scorersA || []), ...(m.r2?.scorersB || [])];
      scorersB = [...(m.r1?.scorersB || []), ...(m.r2?.scorersA || [])];
    } else {
      scoreA   = m.scoreA ?? 0; scoreB = m.scoreB ?? 0;
      scorersA = m.scorersA || [];
      scorersB = m.scorersB || [];
    }

    // Who won?
    const isWinA = m.penA != null ? m.penA > m.penB : scoreA > scoreB;
    const isWinB = m.penA != null ? m.penB > m.penA : scoreB > scoreA;
    const penStr = m.penA != null && typeof m.penA === 'number'
      ? `<div class="trn-modal-pen-row">Penaltis: ${m.penA}–${m.penB}</div>` : '';
    const legsStr = m.legs === 2
      ? `<div class="trn-modal-legs-sub">Ida ${m.r1?.scoreA ?? '?'}–${m.r1?.scoreB ?? '?'} · Vuelta ${m.r2?.scoreA ?? '?'}–${m.r2?.scoreB ?? '?'}</div>` : '';

    const badgeA = _badge(m.a?.slug) || '/img/badges/_placeholder.svg';
    const badgeB = _badge(m.b?.slug) || '/img/badges/_placeholder.svg';

    header.innerHTML = `
      ${ctx ? `<div class="trn-modal-ctx">${_esc(ctx)}</div>` : ''}
      <div class="trn-modal-teams">
        <div class="trn-modal-team trn-modal-team-a${isWinA ? ' trn-modal-winner' : isWinB ? ' trn-modal-loser' : ''}">
          <img class="trn-modal-badge" src="${_esc(badgeA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <span class="trn-modal-teamname">${_esc(nameA)}</span>
        </div>
        <div class="trn-modal-score-block">
          <span class="trn-modal-score-big">${scoreA} – ${scoreB}</span>
          ${legsStr}${penStr}
        </div>
        <div class="trn-modal-team trn-modal-team-b${isWinB ? ' trn-modal-winner' : isWinA ? ' trn-modal-loser' : ''}">
          <img class="trn-modal-badge" src="${_esc(badgeB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <span class="trn-modal-teamname">${_esc(nameB)}</span>
        </div>
      </div>`;

    // Goal timeline
    const allGoals = [
      ...scorersA.map(s => ({ ...s, side: 'A' })),
      ...scorersB.map(s => ({ ...s, side: 'B' })),
    ].sort((a, b) => a.minute - b.minute);
    let rA = 0, rB = 0;
    const tlHtml = allGoals.length
      ? `<div class="trn-modal-timeline">${allGoals.map(g => {
          g.side === 'A' ? rA++ : rB++;
          const isA = g.side === 'A';
          return `<div class="trn-modal-tl-row${isA ? ' trn-tl-a' : ' trn-tl-b'}">
            ${isA
              ? `<span class="trn-tl-name">${_esc(g.name)}</span><span class="trn-tl-icon">⚽</span><span class="trn-tl-min">${g.minute}'</span><span class="trn-tl-score">${rA}–${rB}</span><span class="trn-tl-spacer"></span>`
              : `<span class="trn-tl-spacer"></span><span class="trn-tl-score">${rA}–${rB}</span><span class="trn-tl-min">${g.minute}'</span><span class="trn-tl-icon">⚽</span><span class="trn-tl-name">${_esc(g.name)}</span>`}
          </div>`;
        }).join('')}</div>`
      : `<div class="trn-modal-no-goals-row">Sin goles</div>`;

    // Stats
    const st  = m.legs === 2 ? m.r1 : m;
    const s   = st?.stats || {};
    const possA  = s.possession?.teamA ?? 50, possB  = s.possession?.teamB ?? 50;
    const shotA  = s.shots?.teamA    ?? 0,    shotB  = s.shots?.teamB    ?? 0;
    const cornA  = s.corners?.teamA  ?? 0,    cornB  = s.corners?.teamB  ?? 0;
    const foulA  = s.fouls?.teamA    ?? 0,    foulB  = s.fouls?.teamB    ?? 0;
    const saveA  = s.saves?.teamA    ?? 0,    saveB  = s.saves?.teamB    ?? 0;
    const mom = m.legs === 2 ? (m.r1?.mom || m.r2?.mom || null) : (m.mom || null);
    const momTeam = mom ? (mom.team === 'A' ? nameA : nameB) : null;

    const bar = (vA, vB, lbl) => {
      const t = vA + vB || 1;
      const w = Math.round(vA / t * 100);
      return `<div class="trn-modal-stat-row">
        <span class="trn-modal-stat-val">${vA}</span>
        <span class="trn-modal-stat-label">${lbl}</span>
        <span class="trn-modal-stat-val">${vB}</span>
      </div>
      <div class="trn-modal-poss-bar">
        <div class="trn-modal-poss-a" style="width:${w}%"></div>
        <div class="trn-modal-poss-b" style="width:${100-w}%"></div>
      </div>`;
    };

    body.innerHTML = `
      ${tlHtml}
      ${mom ? `<div class="trn-modal-mom">⭐ <strong>${_esc(mom.name)}</strong> <span class="trn-modal-mom-team">${_esc(momTeam)}</span></div>` : ''}
      <div class="trn-modal-stats">
        ${bar(possA, possB, 'Posesión %')}
        ${bar(shotA, shotB, 'Tiros')}
        ${cornA || cornB ? bar(cornA, cornB, 'Córners') : ''}
        ${saveA || saveB ? bar(saveA, saveB, 'Paradas') : ''}
        ${foulA || foulB ? bar(foulA, foulB, 'Faltas') : ''}
      </div>
      <div class="trn-modal-lu-section">
        <div class="trn-modal-lu-hdr">👥 Alineaciones</div>
        <div id="trn-modal-lu-area" class="trn-modal-lu-area"></div>
      </div>`;

    modal.classList.remove('hidden');
    const counter = $('trn-modal-counter');
    if (counter) counter.textContent = `${_modalIdx + 1} / ${_matchCache.length}`;
    const prev = $('trn-modal-prev'), next = $('trn-modal-next');
    if (prev) prev.disabled = _modalIdx <= 0;
    if (next) next.disabled = _modalIdx >= _matchCache.length - 1;
    loadModalLineups(); // auto-load
  }


  async function loadModalLineups() {
    const area = $('trn-modal-lu-area');
    if (!area) return;
    // Skip if already loaded
    if (area.dataset.loaded === '1') return;
    const entry = _matchCache[_modalIdx];
    if (!entry) return;
    const { m } = entry;
    const slugA = m.a?.slug, eraA = m.a?.era || '';
    const slugB = m.b?.slug, eraB = m.b?.era || '';
    if (!slugA || !slugB) { area.innerHTML = '<p class="trn-lu-empty">Sin datos de plantilla</p>'; return; }
    area.innerHTML = '<div class="trn-lu-loading"><div class="trn-spinner"></div></div>';
    try {
      const [dA, dB] = await Promise.all([
        fetch(`/lookup?team=${encodeURIComponent(slugA)}&era=${encodeURIComponent(eraA)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/lookup?team=${encodeURIComponent(slugB)}&era=${encodeURIComponent(eraB)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const GK_SET  = new Set(['GK']);
      const DEF_SET = new Set(['CB','LB','RB','WB','LWB','RWB','SW']);
      const MID_SET = new Set(['CM','CDM','CAM','LM','RM','DM','LCM','RCM']);
      const ATT_SET = new Set(['ST','CF','LW','RW','SS','FW']);
      const posRank  = p => GK_SET.has(p.position) ? 0 : DEF_SET.has(p.position) ? 1 : MID_SET.has(p.position) ? 2 : ATT_SET.has(p.position) ? 3 : 4;
      const posClass = p => GK_SET.has(p.position) ? 'pos-gk' : DEF_SET.has(p.position) ? 'pos-def' : MID_SET.has(p.position) ? 'pos-mid' : ATT_SET.has(p.position) ? 'pos-att' : '';
      const posLabel = p => GK_SET.has(p.position) ? 'POR' : DEF_SET.has(p.position) ? 'DEF' : MID_SET.has(p.position) ? 'MED' : ATT_SET.has(p.position) ? 'DEL' : (p.position || '?');
      const buildCol = (d, t) => {
        const yr = t?.era ? String(t.era).match(/\d{4}/)?.[0]
          : (d?.source ? String(d.source).match(/\((\d{4})/)?.[1] : null);
        const title = t ? `${_esc(t.name)}${yr ? ` <span class="trn-lu-yr">'${yr.slice(2)}</span>` : ''}` : _esc(d?.source || '?');
        if (!d?.found || !Array.isArray(d.players) || !d.players.length) {
          return `<div class="trn-lu-col"><div class="trn-lu-title">${title}</div><p class="trn-lu-empty">Sin alineación</p></div>`;
        }
        const sorted = [...d.players].sort((a, b) => posRank(a) - posRank(b)).slice(0, 11);
        const rows = sorted.map(p => `<div class="trn-preview-pos-row">
          <span class="trn-preview-pos-label ${posClass(p)}">${_esc(posLabel(p))}</span>
          <span class="trn-preview-player-name">${_esc(p.name || '—')}</span>
        </div>`).join('');
        return `<div class="trn-lu-col"><div class="trn-lu-title">${title}</div><div class="trn-preview-players" style="max-height:none;margin-bottom:0">${rows}</div></div>`;
      };
      area.innerHTML = `<div class="trn-lu-grid">${buildCol(dA, m.a)}${buildCol(dB, m.b)}</div>`;
      area.dataset.loaded = '1';
    } catch (_) {
      area.innerHTML = '<p class="trn-lu-empty">Error al cargar alineaciones</p>';
    }
  }
  function closeMatchModal() {
    const modal = $('trn-match-modal');
    if (modal) modal.classList.add('hidden');
  }

  function prevMatch() {
    if (_modalIdx > 0) openMatchModal(_modalIdx - 1);
  }
  function nextMatch() {
    if (_modalIdx < _matchCache.length - 1) openMatchModal(_modalIdx + 1);
  }

  // Event delegation for dynamic tournament UI
  document.addEventListener('DOMContentLoaded', () => {
    $('trn-num-teams')?.addEventListener('click', e => {
      const pill = e.target.closest('.trn-num-pill');
      if (pill) setNumTeams(+pill.dataset.n);
    });
    $('trn-rules-list')?.addEventListener('change', e => {
      if (e.target.id === 'trn-rule-copa-groups') onCopaGroupsChange(e.target.checked);
    });
    $('trn-teams-list')?.addEventListener('click', e => {
      const btn = e.target.closest('.trn-slot-remove');
      if (btn) removeTeam(+btn.dataset.removeIdx);
    });
    $('trn-pre-draw')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'reshuffleDraw') reshuffleDraw();
      else if (btn.dataset.action === 'reshuffleGroupsDraw') reshuffleGroupsDraw();
    });
    $('trn-search-results')?.addEventListener('click', e => {
      if (e.target.closest('.trn-search-item-locked')) { showLockedHint(); return; }
      const item = e.target.closest('.trn-search-item');
      if (item) previewTeam(item.dataset.slug, item.dataset.name, item.dataset.badge, item.dataset.era || '');
    });
    $('trn-team-preview')?.addEventListener('click', e => {
      const chip = e.target.closest('.trn-era-chip');
      if (chip) { previewTeam(chip.dataset.slug, chip.dataset.name, chip.dataset.badge, chip.dataset.era); return; }
      const addBtn = e.target.closest('.trn-preview-add');
      if (addBtn) { addTeam(addBtn.dataset.slug, addBtn.dataset.name, addBtn.dataset.era || '', addBtn.dataset.badge || ''); return; }
      if (e.target.closest('.trn-preview-back')) clearSearch();
    });
    $('trn-league-loader')?.addEventListener('click', e => {
      const btn = e.target.closest('.trn-ll-btn');
      if (btn) loadRealLeague(btn.dataset.league);
    });
    $('trn-dashboard')?.addEventListener('click', e => {
      const m = e.target.closest('[data-match-idx]');
      if (m) openMatchModal(+m.dataset.matchIdx);
    });
  });

  // ── Global keyboard shortcuts ─────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = $('trn-match-modal');
      if (modal && !modal.classList.contains('hidden')) { closeMatchModal(); return; }
    }
    if (e.key === 'ArrowLeft') {
      const modal = $('trn-match-modal');
      if (modal && !modal.classList.contains('hidden')) { prevMatch(); return; }
    }
    if (e.key === 'ArrowRight') {
      const modal = $('trn-match-modal');
      if (modal && !modal.classList.contains('hidden')) { nextMatch(); return; }
    }
  });

  // ── Public API ───────────────────────────────────────────
  return {
    switchMainTab,
    selectFormat,
    setNumTeams,
    onCopaGroupsChange,
    goStep2,
    goStep3,
    goBack,
    onTeamSearch,
    onSearchKeydown,
    clearSearch,
    addTeam,
    previewTeam,
    showLockedHint,
    removeTeam,
    fillRandom,
    runSimulation,
    reshuffleDraw,
    reshuffleGroupsDraw,
    shareTournament,
    switchDashTab,
    startOver,
    openMatchModal,
    closeMatchModal,
    prevMatch,
    nextMatch,
    loadRealLeague,
  };

})();
