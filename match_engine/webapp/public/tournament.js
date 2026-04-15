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
  let _activePreset = null;  // 'ucl2026' | 'wc2026' | 'wc-historical' | null
  let _uclFixtures  = null;  // pre-generated UCL league phase fixtures (144 matches)
  let _wcHistoricalYear = null;  // year of selected historical WC edition
  let _uclDrawRunning = false;
  let _potEditMode  = false; // pot editor: click-to-swap mode
  let _potEditSel   = null;  // { slug, potIdx } of first selected team in swap

  const VALID_COUNTS = {
    copa:        [4, 8, 16, 32],
    copa_groups: [8, 12, 16, 20, 24, 32],
    liga:        [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
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
  // Converts a 4-digit year key to season notation: "2025" → "25/26"
  const _eraLabel = (yr) => {
    const n = parseInt(yr, 10);
    if (!n || n < 1000) return yr;
    const s1 = String(n).slice(2);
    const s2 = String(n + 1).slice(2);
    return `${s1}/${s2}`;
  };
  // Returns display label "Team Name '25/26" (or just "Team Name" if no era)
  const _tLabel = (t) => {
    if (!t) return '?';
    const yr = t.era ? String(t.era).match(/\d{4}/)?.[0] : null;
    return yr ? `${t.name} '${_eraLabel(yr)}` : (t.name || '?');
  };

  // ── Main tab switching (⚽ Partido / 🥅 Penaltis / 🏆 Torneo) ─────────
  function switchMainTab(tab) {
    $('main-match-wrap').classList.toggle('hidden', tab !== 'match');
    $('main-pen-wrap') && $('main-pen-wrap').classList.toggle('hidden', tab !== 'pen');
    $('main-trn-wrap').classList.toggle('hidden', tab !== 'trn');
    document.querySelectorAll('.main-tab-btn').forEach(b =>
      b.classList.toggle('main-tab-active', b.dataset.tab === tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'trn' && !_fmt && !_data) showStep(1);
    if (tab === 'pen' && typeof _initPenPickers === 'function') _initPenPickers();
  }

  // ── Wizard step navigation ───────────────────────────────
  function showStep(n) {
    for (let i = 1; i <= 3; i++) {
      const el = $(`trn-step-${i}`);
      if (el) el.classList.toggle('hidden', i !== n);
    }
    // Restore stepbar (may have been hidden by preset screens)
    const stepbar = document.querySelector('.trn-stepbar'); if (stepbar) show(stepbar);
    // Also hide any open preset screens
    const uclDraw = $('trn-ucl-draw'); if (uclDraw) hide(uclDraw);
    const presetConfirm = $('trn-preset-confirm'); if (presetConfirm) hide(presetConfirm);
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
    _updateFmtPreview();
    _updateNextBtn();
  }

  // Renders one toggle row with a dynamic hint that updates on change
  function _ruleRow(id, nameKey, offKey, onKey, checked) {
    return `
      <label class="trn-rule-row">
        <div class="trn-rule-body">
          <span class="trn-rule-name">${t(nameKey)}</span>
          <span class="trn-rule-hint" id="hint-${id}">${checked ? t(onKey) : t(offKey)}</span>
        </div>
        <div class="trn-toggle-wrap">
          <input type="checkbox" id="${id}" class="trn-toggle-input"${checked ? ' checked' : ''} />
          <div class="trn-toggle"></div>
        </div>
      </label>`;
  }

  // Wire all dynamic hints in a container after innerHTML has been set
  function _wireRuleHints(container) {
    container.querySelectorAll('.trn-toggle-input').forEach(cb => {
      const hintId = 'hint-' + cb.id;
      const hintEl = document.getElementById(hintId);
      if (!hintEl) return;
      const offText = cb.dataset.off;
      const onText  = cb.dataset.on;
      if (!offText || !onText) return;
      cb.addEventListener('change', () => { hintEl.textContent = cb.checked ? onText : offText; });
    });
  }

  function _rebuildCopaDetailRules() {
    const detailEl = $('trn-copa-detail-rules');
    if (!detailEl) return;
    if (_rules.copaMode === 'groups') {
      detailEl.innerHTML =
        _ruleRow('trn-rule-grupos-idavuelta', 'trn-rule-group-stage',  'trn-rule-group-hint-off',  'trn-rule-group-hint-on',  false) +
        _ruleRow('trn-rule-ko-idavuelta',     'trn-rule-ko-stage',     'trn-rule-ko-hint-off',     'trn-rule-ko-hint-on',     true);
    } else {
      detailEl.innerHTML =
        _ruleRow('trn-rule-idavuelta',  'trn-rule-match-fmt', 'trn-rule-match-fmt-off', 'trn-rule-match-fmt-on', false) +
        _ruleRow('trn-rule-extratime',  'trn-rule-tiebreak',  'trn-rule-tiebreak-off',  'trn-rule-tiebreak-on',  true)  +
        _ruleRow('trn-rule-3rd',        'trn-rule-third',     'trn-rule-third-off',     'trn-rule-third-on',     false);
    }
    // Patch data attributes for the listener (keys resolved at render time)
    detailEl.querySelectorAll('.trn-toggle-input').forEach(cb => {
      const hintEl = document.getElementById('hint-' + cb.id);
      if (!hintEl) return;
      const baseKey = cb.id.replace('trn-rule-', 'trn-rule-');
      // Map id → off/on keys
      const map = {
        'trn-rule-grupos-idavuelta': ['trn-rule-group-hint-off', 'trn-rule-group-hint-on'],
        'trn-rule-ko-idavuelta':     ['trn-rule-ko-hint-off',    'trn-rule-ko-hint-on'],
        'trn-rule-idavuelta':        ['trn-rule-match-fmt-off',  'trn-rule-match-fmt-on'],
        'trn-rule-extratime':        ['trn-rule-tiebreak-off',   'trn-rule-tiebreak-on'],
        'trn-rule-3rd':              ['trn-rule-third-off',      'trn-rule-third-on'],
      };
      const [offKey, onKey] = map[cb.id] || ['', ''];
      cb.addEventListener('change', () => { hintEl.textContent = cb.checked ? t(onKey) : t(offKey); });
    });
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

  function _updateFmtPreview() {
    const panel = $('trn-fmt-preview');
    if (!panel) return;
    if (!_fmt || (_fmt !== 'copa' && _fmt !== 'liga')) { panel.classList.add('hidden'); return; }
    const n = _numTeams || 16;
    const lang = _getLang();
    let iconText, titleHTML, statsHTML;
    if (_fmt === 'copa') {
      const isGroups = _rules.copaMode === 'groups';
      iconText = '\uD83C\uDFC6';
      titleHTML = lang === 'es' ? 'Copa <strong>GolazoX</strong>' : 'Cup <strong>GolazoX</strong>';
      if (isGroups) {
        const groups = Math.ceil(n / 4);
        const groupMatches = groups * 6;
        const koMatches = n / 2 - 1;
        const total = groupMatches + Math.round(koMatches);
        statsHTML = lang === 'es'
          ? `<span>${n} equipos</span><span>${groups} grupos + KO</span><span>\u2248${total} partidos</span>`
          : `<span>${n} teams</span><span>${groups} groups + KO</span><span>\u2248${total} matches</span>`;
      } else {
        const rounds = Math.round(Math.log2(n));
        const total = n - 1;
        statsHTML = lang === 'es'
          ? `<span>${n} equipos</span><span>${rounds} rondas KO</span><span>${total} partidos</span>`
          : `<span>${n} teams</span><span>${rounds} KO rounds</span><span>${total} matches</span>`;
      }
    } else {
      iconText = '\uD83D\uDCCA';
      titleHTML = lang === 'es' ? 'Liga <strong>GolazoX</strong>' : 'League <strong>GolazoX</strong>';
      const matchdays = (n - 1) * 2;
      const total = n * (n - 1);
      statsHTML = lang === 'es'
        ? `<span>${n} equipos</span><span>${matchdays} jornadas</span><span>${total} partidos</span>`
        : `<span>${n} teams</span><span>${matchdays} matchdays</span><span>${total} matches</span>`;
    }
    const iconEl = $('trn-fmtp-icon');
    const titleEl = $('trn-fmtp-title');
    const statsEl = $('trn-fmtp-stats');
    if (iconEl) iconEl.textContent = iconText;
    if (titleEl) titleEl.innerHTML = titleHTML;
    if (statsEl) statsEl.innerHTML = statsHTML;
    panel.dataset.fmt = _fmt;
    panel.classList.remove('hidden');
  }

  function _updateNextBtn() {
    const btn = $('trn-next-1');
    if (btn) btn.classList.toggle('trn-btn-next-ready', !!_fmt);
  }
  function setNumTeams(n) {
    _numTeams = n;
    // Update pill active state
    const wrap = $('trn-num-teams');
    if (wrap) wrap.querySelectorAll('.trn-num-pill').forEach(b => b.classList.toggle('trn-num-pill-active', +b.textContent === n));
    _updateFmtPreview();
  }


  function goStep2() {
    if (!_fmt) { _showToast(t('trn-toast-no-fmt')); return; }
    // _numTeams already updated by setNumTeams / _buildNumTeamsPicker
    const container = $('trn-rules-list');
    if (container) {
      let html = '';
      if (_fmt === 'copa') {
        html = `
          <label class="trn-rule-row">
            <div class="trn-rule-body">
              <span class="trn-rule-name">${t('trn-rule-modality')}</span>
              <span class="trn-rule-hint" id="hint-trn-rule-copa-groups">${_rules.copaMode === 'groups' ? t('trn-rule-modality-on') : t('trn-rule-modality-off')}</span>
            </div>
            <div class="trn-toggle-wrap">
              <input type="checkbox" id="trn-rule-copa-groups" class="trn-toggle-input"${_rules.copaMode === 'groups' ? ' checked' : ''} />
              <div class="trn-toggle"></div>
            </div>
          </label>
          <div id="trn-copa-detail-rules"></div>`;
        container.innerHTML = html;
        // Wire dynamic hint for the top modality toggle
        const mCb = $('trn-rule-copa-groups');
        const mHint = $('hint-trn-rule-copa-groups');
        if (mCb && mHint) mCb.addEventListener('change', () => {
          mHint.textContent = mCb.checked ? t('trn-rule-modality-on') : t('trn-rule-modality-off');
        });
        _rebuildCopaDetailRules();
        showStep(2);
        try { _gx('trn_step2_view', { format: _fmt }); } catch(_) {}
        return;
      } else if (_fmt === 'liga') {
        html = _ruleRow('trn-rule-idavuelta', 'trn-rule-legs', 'trn-rule-legs-off', 'trn-rule-legs-on', false);
      } else if (_fmt === 'champions' || (_fmt === 'copa' && _rules.copaMode === 'groups')) {
        html =
          _ruleRow('trn-rule-grupos-idavuelta', 'trn-rule-group-stage', 'trn-rule-group-hint-off', 'trn-rule-group-hint-on', false) +
          _ruleRow('trn-rule-ko-idavuelta',     'trn-rule-ko-stage',    'trn-rule-ko-hint-off',    'trn-rule-ko-hint-on',    true);
      }
      container.innerHTML = html;
      // Wire dynamic hints for all rendered toggles
      const map = {
        'trn-rule-idavuelta':        ['trn-rule-legs-off',       'trn-rule-legs-on'],
        'trn-rule-grupos-idavuelta': ['trn-rule-group-hint-off', 'trn-rule-group-hint-on'],
        'trn-rule-ko-idavuelta':     ['trn-rule-ko-hint-off',    'trn-rule-ko-hint-on'],
      };
      container.querySelectorAll('.trn-toggle-input').forEach(cb => {
        const hintEl = document.getElementById('hint-' + cb.id);
        const [offKey, onKey] = map[cb.id] || [];
        if (hintEl && offKey) cb.addEventListener('change', () => { hintEl.textContent = cb.checked ? t(onKey) : t(offKey); });
      });
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
    const _removeLabel = t('trn-remove-team');
    container.innerHTML = _teams.map((t, i) => {
      const yr = t.era ? String(t.era).match(/\d{4}/)?.[0] : null;
      return `<div class="trn-team-slot">
        ${_badgeImg(t.slug, 'trn-slot-badge')}
        <span class="trn-slot-name">${_esc(t.name)}</span>
        ${yr ? `<span class="trn-slot-era">'${_eraLabel(yr)}</span>` : ''}
        <button class="trn-slot-remove" data-remove-idx="${i}" title="${_removeLabel}">✕</button>
      </div>`;
    }).join('') || `<p class="trn-teams-empty">${t('trn-teams-empty-1')}<br><span style="font-size:.75rem;opacity:.6">${t('trn-teams-empty-2')}</span></p>`;

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
    // Keep catalog browser in sync (mark added teams)
    const cbPanel = $('trn-catalog-browser');
    if (cbPanel && !cbPanel.classList.contains('hidden')) _refreshCatalogBrowserState(cbPanel);
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
    const _useGroups = (_fmt === 'champions') || (_fmt === 'copa' && _rules.copaMode === 'groups');
    if (_fmt === 'copa' && !_useGroups) {
      let html = `<div class="trn-draw-header">
        <span class="trn-label">🏆 ${_esc(_roundLabel(_numTeams))}</span>
        <button class="trn-draw-reshuffle" data-action="reshuffleDraw">${t('trn-draw-reshuffle')}</button>
      </div><div class="trn-pre-draw-bkt-wrap">${_buildPreDrawBracket(_draw)}</div>`;
      el.innerHTML = html;
    } else if (_useGroups) {
      let html = `<div class="trn-draw-header">
        <span class="trn-label">${t('trn-draw-groups-title')}</span>
        <button class="trn-draw-reshuffle" data-action="reshuffleGroupsDraw">${t('trn-draw-reshuffle')}</button>
      </div><div class="trn-groups-draw-grid">`;
      _groupsDraw.forEach((grp, g) => {
        html += `<div class="trn-group-draw-card">
          <div class="trn-group-draw-label">${t('trn-draw-group-prefix')}${String.fromCharCode(65 + g)}</div>
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

  // Helper: round label for N teams
  function _roundLabel(n) {
    const map = {
      2: t('trn-round-final'), 4: t('trn-round-semi'), 8: t('trn-round-qf'),
      16: t('trn-round-r16'), 32: t('trn-round-r32'), 64: t('trn-round-r64'),
    };
    return map[n] || `${t('trn-round-default')} (${n / 2})`;
  }

  // Build full bracket preview HTML from a draw array.
  // Round 1 shows the real pairs; subsequent rounds show TBD placeholder slots.
  function _buildPreDrawBracket(draw) {
    if (!draw || !draw.length) return '';
    const MATCH_H = 84, HEADER_H = 26, SW = 36;

    // Build synthetic rounds: R1 with real teams, then shrinking empty rounds
    const rounds = [];
    rounds.push({
      label: _roundLabel(draw.length * 2),
      matches: draw.map(m => ({ a: m.a, b: m.b }))
    });
    let count = Math.floor(draw.length / 2);
    while (count >= 1) {
      rounds.push({
        label: _roundLabel(count * 2),
        matches: Array.from({ length: count }, () => ({ a: null, b: null }))
      });
      count = Math.floor(count / 2);
    }

    const pos = _computeBracketPositions(rounds);
    const maxBottom = Math.max(...pos.map(p => p.length ? p[p.length - 1].top + MATCH_H : 0));
    const totalH = maxBottom + HEADER_H + 8;

    let html = `<div class="trn-bkt-tree" style="height:${totalH}px">`;

    for (let ri = 0; ri < rounds.length; ri++) {
      const round = rounds[ri];
      const isLast = ri === rounds.length - 1;
      html += `<div class="trn-bkt-col" style="height:${totalH}px">`;
      html += `<div class="trn-bkt-col-label">${_esc(round.label)}</div>`;

      pos[ri].forEach(({ top }, mi) => {
        const m = round.matches[mi];
        const topPx = top + HEADER_H;
        if (m.a && m.b) {
          // Real draw pair — no winner/score yet
          const bA = _badge(m.a.slug) || '/img/badges/_placeholder.svg';
          const bB = _badge(m.b.slug) || '/img/badges/_placeholder.svg';
          html += `<div class="trn-bkt-match trn-bkt-preview" style="top:${topPx}px">
            <div class="trn-bkt-team">
              <img class="trn-bkt-badge" src="${_esc(bA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
              <span class="trn-bkt-tname">${_esc(_tLabel(m.a))}</span>
            </div>
            <div class="trn-bkt-score-mid trn-bkt-vs-lbl">vs</div>
            <div class="trn-bkt-team">
              <img class="trn-bkt-badge" src="${_esc(bB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
              <span class="trn-bkt-tname">${_esc(_tLabel(m.b))}</span>
            </div>
          </div>`;
        } else {
          // TBD slot
          html += `<div class="trn-bkt-match trn-bkt-tbd" style="top:${topPx}px">
            <div class="trn-bkt-team"><span class="trn-bkt-tbd-bar"></span></div>
            <div class="trn-bkt-score-mid trn-bkt-vs-lbl">vs</div>
            <div class="trn-bkt-team"><span class="trn-bkt-tbd-bar"></span></div>
          </div>`;
        }
      });

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
            html += `<div class="trn-bkt-line" style="top:${Math.min(f1y, f2y)}px;left:${SW / 2 - .5}px;height:${Math.abs(f2y - f1y) + 1}px;width:1px"></div>`;
          }
          html += `<div class="trn-bkt-line" style="top:${ny - .5}px;left:${SW / 2}px;width:${SW / 2}px"></div>`;
        }
        html += '</div>';
      }
    }

    // Trophy column at the end
    const champY = HEADER_H + pos[rounds.length - 1][0].top + MATCH_H / 2;
    html += `<div class="trn-bkt-spacer" style="height:${totalH}px">
      <div class="trn-bkt-line" style="top:${champY - .5}px;left:0;width:${SW}px"></div>
    </div>`;
    html += `<div class="trn-bkt-col trn-bkt-champ-col" style="height:${totalH}px">
      <div class="trn-bkt-col-label">🏆</div>
      <div class="trn-bkt-champion-card trn-bkt-tbd-champ" style="top:${Math.max(8, champY - 30)}px">
        <span class="trn-bkt-tbd-champ-icon">🏆</span>
        <div class="trn-bkt-champ-name" style="opacity:.3">?</div>
      </div>
    </div>`;
    html += '</div>';
    return html;
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
        res.innerHTML = `<div class="trn-search-empty">${t('trn-search-no-results')}</div>`;
        res.classList.remove('hidden');
        return;
      }

      // If the query contains a year, use it as the preferred era when previewing
      const queryYearMatch = q.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
      const queryYear = queryYearMatch ? queryYearMatch[1] : '';

      res.innerHTML = data.map(t => {
        const name  = _esc((_getLang() === 'en' ? (t.nameEn || t.nameEs) : (t.nameEs || t.nameEn)) || t.name || t.slug || '');
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
      ? `🔒 ${t('trn-locked-prefix')} × ${remaining} ${remaining !== 1 ? t('trn-locked-sim-n') : t('trn-locked-sim-1')}`
      : `🔒 ${t('trn-locked-prefix')} × ${t('trn-locked-share-cta')}`;
    _showToast(msg);
  }

  function addTeam(slug, name, era = '', badge = '') {
    if (_teams.length >= _numTeams) return;
    if (_teams.some(t => t.slug === slug && (t.era || '') === (era || ''))) {
      _showToast(t('trn-toast-duplicate'));
      return;
    }
    if (badge) _badgeCache[slug] = badge;
    // Resolve OVR from catalog so the simulator can bias xG correctly
    const catEntry = _trnCatalog ? _trnCatalog.find(c => c.slug === slug) : null;
    const ovr = catEntry?.ovr || null;
    _teams.push({ slug, name, era, ovr });
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
          <button class="btn-primary trn-preview-add" style="flex:1" data-slug="${safeSlug}" data-name="${safeName}" data-era="${_esc(resolvedEra)}" data-badge="${safeBadge}">${t('trn-add-team')}</button>
          <button class="btn-secondary trn-preview-back">${t('trn-preview-back')}</button>
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
          <button class="btn-primary trn-preview-add" style="flex:1" data-slug="${safeSlug}" data-name="${safeName}" data-era="${_esc(era)}" data-badge="${safeBadge}">${t('trn-add-team')}</button>
          <button class="btn-secondary trn-preview-back">${t('trn-preview-back')}</button>
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
        _teams.push({ slug: t.slug, name: (_getLang() === 'en' ? (t.nameEn || t.nameEs) : (t.nameEs || t.nameEn)) || t.slug, era, ovr: t.ovr || null });
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

  // -- Catalog DB browser -----------------------------------------------
  let _catBrowserFilter = '';

  async function toggleCatalogBrowser() {
    const panel = $('trn-catalog-browser');
    if (!panel) return;
    if (!panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    if (panel.dataset.loaded !== '1') {
      panel.innerHTML = '<div class="trn-ll-loading"><div class="trn-spinner"></div></div>';
      await _renderCatalogBrowser(panel);
    } else {
      _refreshCatalogBrowserState(panel);
    }
  }

  async function _renderCatalogBrowser(panel) {
    try {
      const catalog = await _getTrnCatalog();
      panel.dataset.loaded = '1';
      _catBrowserFilter = '';

      // Group teams
      const groupMap = Object.create(null);
      for (const e of catalog) {
        const g = e.group || '🌍 Otros';
        (groupMap[g] = groupMap[g] || []).push(e);
      }

      let html = `<div class="trn-cb-filterrow">
        <span class="trn-cb-filter-icon">🔍</span>
        <input id="trn-cb-filter" class="trn-cb-filter" type="search" placeholder="Filtrar equipos…" autocomplete="off">
      </div><div id="trn-cb-groups" class="trn-cb-groups">`;

      for (const [g, teams] of Object.entries(groupMap)) {
        const open = Object.keys(groupMap).indexOf(g) < 3 ? ' open' : '';
        html += `<details class="trn-cb-group"${open}><summary class="trn-cb-group-label">${_esc(g)} <span class="trn-cb-group-cnt">(${teams.length})</span></summary><div class="trn-cb-group-items">`;
        for (const e of teams) {
          const badge = e.badge || '/img/badges/_placeholder.svg';
          const name  = (_getLang() === 'en' ? (e.nameEn || e.nameEs) : (e.nameEs || e.nameEn)) || e.slug;
          const bestEra = (e.seasons || [])[0] || '';
          const slug = _esc(e.slug); const nameE = _esc(name);
          html += `<div class="trn-cb-item" data-slug="${slug}" data-name="${nameE}" data-badge="${_esc(badge)}" data-era="${_esc(bestEra)}">
            <img class="trn-cb-badge" src="${_esc(badge)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
            <span class="trn-cb-name">${nameE}</span>
          </div>`;
        }
        html += `</div></details>`;
      }
      html += `</div>`;
      panel.innerHTML = html;

      // Filter input
      const fi = panel.querySelector('#trn-cb-filter');
      if (fi) {
        fi.addEventListener('input', () => {
          _catBrowserFilter = fi.value.trim().toLowerCase();
          _refreshCatalogBrowserState(panel);
        });
      }

      _refreshCatalogBrowserState(panel);
    } catch (e) {
      panel.innerHTML = `<div style="padding:.75rem;color:rgba(255,255,255,.5);font-size:.8rem">Error al cargar catálogo</div>`;
    }
  }

  function _refreshCatalogBrowserState(panel) {
    const existing = new Set(_teams.map(t => t.slug));
    const q = _catBrowserFilter;
    const items = panel.querySelectorAll('.trn-cb-item');
    items.forEach(el => {
      const slug = el.dataset.slug;
      const name = el.dataset.name;
      const added = existing.has(slug);
      el.classList.toggle('trn-cb-item-added', added);
      const matchesFilter = !q || name.toLowerCase().includes(q) || slug.includes(q);
      el.style.display = matchesFilter ? '' : 'none';
    });
    // Update group counts visibility
    panel.querySelectorAll('.trn-cb-group').forEach(grp => {
      const visible = [...grp.querySelectorAll('.trn-cb-item')].some(el => el.style.display !== 'none');
      grp.style.display = visible ? '' : 'none';
    });
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
      const groupBadges = {};
      const EXCL = new Set(['Selecciones','Fantasy XI','Continentes Hist\u00f3ricos','Am\u00e9rica del Sur','Otros']);
      catalog.forEach(c => {
        if (!c.group) return;
        const gName = c.group.replace(/^\S+\s*/, '');
        if (EXCL.has(gName)) return;
        groupMap[c.group] = (groupMap[c.group] || 0) + 1;
        if (!groupBadges[c.group]) groupBadges[c.group] = [];
        if (groupBadges[c.group].length < 4 && c.badge) groupBadges[c.group].push(c.badge);
      });
      const groups = Object.entries(groupMap).sort((a, b) => b[1] - a[1]);
      if (!groups.length) { panel.innerHTML = '<p class="trn-ll-empty">Sin ligas disponibles</p>'; return; }
      const _toFlag = code => {
        if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return null;
        const ch = code.toUpperCase();
        return String.fromCodePoint(ch.charCodeAt(0) - 65 + 0x1F1E6) +
               String.fromCodePoint(ch.charCodeAt(1) - 65 + 0x1F1E6);
      };
      const PH = '/img/badges/_placeholder.svg';
      let html = '<div class="trn-ll-title">\uD83C\uDFC6 Selecciona una liga</div><div class="trn-ll-grid">';
      groups.forEach(([g, count]) => {
        const llMeta = (typeof _LEAGUE_META !== 'undefined' && _LEAGUE_META[g]) || null;
        let flagHtml;
        if (llMeta?.iso) {
          flagHtml = `<img class="trn-ll-flag-img" src="https://flagcdn.com/w40/${_esc(llMeta.iso)}.png" alt="" loading="lazy">`;
        } else if (llMeta?.svg) {
          flagHtml = `<img class="trn-ll-flag-img trn-ll-flag-img-svg" src="${_esc(llMeta.svg)}" alt="" loading="lazy">`;
        } else {
          const rawPrefix = g.match(/^(\S+)/)?.[1] || '';
          const emojiFlag = _toFlag(rawPrefix) || rawPrefix || '\uD83C\uDFC6';
          flagHtml = `<span class="trn-ll-flag-big">${emojiFlag}</span>`;
        }
        const name  = _esc(g.replace(/^\S+\s*/, ''));
        const bdgs  = (groupBadges[g] || []).slice(0, 4);
        while (bdgs.length < 4) bdgs.push(PH);
        const badgeRow = bdgs.map(b =>
          `<img class="trn-ll-team-badge" src="${_esc(b)}" onerror="this.src='${PH}'" alt="">`
        ).join('');
        html += `<button class="trn-ll-btn" data-league="${_esc(g)}">
          <div class="trn-ll-card-top">
            ${flagHtml}
            <span class="trn-ll-count">${count} eq.</span>
          </div>
          <span class="trn-ll-name">${name}</span>
          <div class="trn-ll-badges-row">${badgeRow}</div>
        </button>`;
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
      if (!leagueTeams.length) { _showToast(t('trn-toast-no-teams')); return; }

      const teamFromEntry = t => {
        if (t.badge) _badgeCache[t.slug] = t.badge;
        const nums = (t.seasons || []).filter(s => /^\d{4}$/.test(s));
        const era  = nums.length ? String(nums.reduce((mx, s) => Math.max(mx, Number(s)), 0)) : '';
        return { slug: t.slug, name: (_getLang() === 'en' ? (t.nameEn || t.nameEs) : (t.nameEs || t.nameEn)) || t.slug, era, ovr: t.ovr || null };
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
      _showToast(t('trn-toast-league-err'));
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

  // ── Predefined official tournament templates ─────────────

  // FIFA World Cup 2026  — official groups (draw Dec 2025)
  const _WC2026_GROUPS = [
    { label: 'A', teams: [
      { slug: 'mexiko',           era:'2025', name:'México',               badge:'/img/badges/mexico.png'       },
      { slug: 'south-africa',     era:'2025', name:'Sudáfrica',            badge:'/img/badges/south-africa.png' },
      { slug: 'south-korea',      era:'2025', name:'Corea del Sur',        badge:'/img/badges/south-korea.png'  },
      { slug: 'tschechien',       era:'2025', name:'Rep. Checa',           badge:'/img/badges/tschechien.png'   },
    ]},
    { label: 'B', teams: [
      { slug: 'kanada',           era:'2025', name:'Canadá',               badge:'/img/badges/canada.png'       },
      { slug: 'bosnien-herzegowina', era:'2025', name:'Bosnia y Herz.',    badge:'/img/badges/bosnia.png'       },
      { slug: 'katar',            era:'2025', name:'Catar',                badge:'/img/badges/katar.png'         },
      { slug: 'schweiz',          era:'2025', name:'Suiza',                badge:'/img/badges/schweiz.png'      },
    ]},
    { label: 'C', teams: [
      { slug: 'brasilien',        era:'2025', name:'Brasil',               badge:'/img/badges/brasilien.png'    },
      { slug: 'marokko',          era:'2025', name:'Marruecos',            badge:'/img/badges/marruecos.png'    },
      { slug: 'haiti',            era:'2025', name:'Haití',                badge:'/img/badges/haiti.png'        },
      { slug: 'schottland',       era:'2025', name:'Escocia',              badge:'/img/badges/schottland.png'   },
    ]},
    { label: 'D', teams: [
      { slug: 'united-states',    era:'2025', name:'Estados Unidos',       badge:'/img/badges/united-states.png'},
      { slug: 'paraguay',         era:'2025', name:'Paraguay',             badge:'/img/badges/paraguay.png'     },
      { slug: 'australien',       era:'2025', name:'Australia',            badge:'/img/badges/australia.png'    },
      { slug: 'turkey',           era:'2025', name:'Turquía',              badge:'/img/badges/turkey.png'       },
    ]},
    { label: 'E', teams: [
      { slug: 'deutschland',      era:'2025', name:'Alemania',             badge:'/img/badges/deutschland.png'  },
      { slug: 'curacao',          era:'2025', name:'Curazao',              badge:'/img/badges/curacao.png'        },
      { slug: 'ivory-coast',      era:'2025', name:'Costa de Marfil',      badge:'/img/badges/ivory-coast.png'  },
      { slug: 'ecuador',          era:'2025', name:'Ecuador',              badge:'/img/badges/ecuador.png'      },
    ]},
    { label: 'F', teams: [
      { slug: 'niederlande',      era:'2025', name:'Países Bajos',         badge:'/img/badges/niederlande.png'  },
      { slug: 'japan',            era:'2025', name:'Japón',                badge:'/img/badges/japan.png'        },
      { slug: 'schweden',         era:'2025', name:'Suecia',               badge:'/img/badges/schweden.png'     },
      { slug: 'tunesien',         era:'2025', name:'Túnez',                badge:'/img/badges/tunisia.png'      },
    ]},
    { label: 'G', teams: [
      { slug: 'belgien',          era:'2025', name:'Bélgica',              badge:'/img/badges/belgien.png'      },
      { slug: 'agypten',          era:'2025', name:'Egipto',               badge:'/img/badges/egypt.png'        },
      { slug: 'iran',             era:'2025', name:'Irán',                 badge:'/img/badges/iran.png'         },
      { slug: 'neuseeland',       era:'2025', name:'Nueva Zelanda',        badge:'/img/badges/new-zealand.png'  },
    ]},
    { label: 'H', teams: [
      { slug: 'spanien',          era:'2025', name:'España',               badge:'/img/badges/spanien.png'      },
      { slug: 'kap-verde',        era:'2025', name:'Cabo Verde',           badge:'/img/badges/cape-verde.png'   },
      { slug: 'saudi-arabien',    era:'2025', name:'Arabia Saudí',         badge:'/img/badges/saudi-arabia.png' },
      { slug: 'uruguay',          era:'2025', name:'Uruguay',              badge:'/img/badges/uruguay.png'      },
    ]},
    { label: 'I', teams: [
      { slug: 'frankreich',       era:'2025', name:'Francia',              badge:'/img/badges/frankreich.png'   },
      { slug: 'senegal',          era:'2025', name:'Senegal',              badge:'/img/badges/senegal.png'      },
      { slug: 'irak',             era:'2025', name:'Irak',                 badge:'/img/badges/iraq.png'         },
      { slug: 'norwegen',         era:'2025', name:'Noruega',              badge:'/img/badges/noruega.png'      },
    ]},
    { label: 'J', teams: [
      { slug: 'argentinien',      era:'2025', name:'Argentina',            badge:'/img/badges/argentinien.png'  },
      { slug: 'algerien',         era:'2025', name:'Argelia',              badge:'/img/badges/algerien.png'     },
      { slug: 'osterreich',       era:'2025', name:'Austria',              badge:'/img/badges/osterreich.png'   },
      { slug: 'jordanien',        era:'2025', name:'Jordania',             badge:'/img/badges/jordan.png'       },
    ]},
    { label: 'K', teams: [
      { slug: 'portugal',         era:'2025', name:'Portugal',             badge:'/img/badges/portugal.png'     },
      { slug: 'kolumbien',        era:'2025', name:'Colombia',             badge:'/img/badges/colombia.png'     },
      { slug: 'usbekistan',       era:'2025', name:'Uzbekistán',           badge:'/img/badges/uzbekistan.png'   },
      { slug: 'kongo',            era:'2025', name:'R.D. Congo',           badge:'/img/badges/kongo.svg'        },
    ]},
    { label: 'L', teams: [
      { slug: 'england',          era:'2025', name:'Inglaterra',           badge:'/img/badges/england.png'      },
      { slug: 'kroatien',         era:'2025', name:'Croacia',              badge:'/img/badges/kroatien.png'     },
      { slug: 'ghana',            era:'2025', name:'Ghana',                badge:'/img/badges/ghana.png'        },
      { slug: 'panama',           era:'2025', name:'Panamá',               badge:'/img/badges/panama.png'       },
    ]},
  ];

  // UEFA Champions League 2025/26 — 36 clubs in 9 groups of 4
  const _UCL2026_GROUPS = [
    { label: 'A', teams: [
      { slug: 'real-madrid',         era:'2025', name:'Real Madrid',          badge:'/img/badges/real-madrid.png' },
      { slug: 'fc-bayern-munchen',   era:'2025', name:'Bayern München',       badge:'/img/badges/fc-bayern-munchen.png' },
      { slug: 'newcastle-united',    era:'2025', name:'Newcastle United',     badge:'/img/badges/newcastle-united.png' },
      { slug: 'bodo-glimt',          era:'2025', name:'Bodø/Glimt',           badge:'/img/badges/fk-bod-glimt.png' },
    ]},
    { label: 'B', teams: [
      { slug: 'fc-barcelona',        era:'2025', name:'Barcelona',            badge:'/img/badges/fc-barcelona.png' },
      { slug: 'fc-paris-saint-germain', era:'2025', name:'Paris Saint-Germain', badge:'/img/badges/fc-paris-saint-germain.png' },
      { slug: 'galatasaray',         era:'2025', name:'Galatasaray',          badge:'/img/badges/galatasaray.png' },
      { slug: 'qarabag',             era:'2025', name:'Qarabağ',              badge:'/img/badges/qarabag-fk.png' },
    ]},
    { label: 'C', teams: [
      { slug: 'fc-liverpool',        era:'2025', name:'Liverpool',            badge:'/img/badges/fc-liverpool.png' },
      { slug: 'fc-arsenal',          era:'2025', name:'Arsenal',              badge:'/img/badges/fc-arsenal.png' },
      { slug: 'as-monaco',           era:'2025', name:'AS Monaco',            badge:'/img/badges/as-monaco.png' },
      { slug: 'union-saint-gilloise', era:'2025', name:'Union Saint-Gilloise', badge:'/img/badges/union-saint-gilloise.png' },
    ]},
    { label: 'D', teams: [
      { slug: 'atletico-madrid',     era:'2025', name:'Atlético Madrid',      badge:'/img/badges/atletico-madrid.png' },
      { slug: 'inter-mailand',       era:'2025', name:'Inter',                badge:'/img/badges/inter-mailand.png' },
      { slug: 'ajax-amsterdam',      era:'2025', name:'Ajax',                 badge:'/img/badges/ajax-amsterdam.png' },
      { slug: 'kairat-almaty',       era:'2025', name:'Kairat Almaty',        badge:'/img/badges/fc-kairat-almaty.png' },
    ]},
    { label: 'E', teams: [
      { slug: 'fc-chelsea',          era:'2025', name:'Chelsea',              badge:'/img/badges/fc-chelsea.png' },
      { slug: 'juventus-turin',      era:'2025', name:'Juventus',             badge:'/img/badges/juventus-turin.png' },
      { slug: 'psv-eindhoven',       era:'2025', name:'PSV Eindhoven',        badge:'/img/badges/psv-eindhoven.png' },
      { slug: 'pafos',               era:'2025', name:'Pafos FC',             badge:'/img/badges/pafos.png' },
    ]},
    { label: 'F', teams: [
      { slug: 'manchester-city',     era:'2025', name:'Manchester City',      badge:'/img/badges/manchester-city.png' },
      { slug: 'bayer-04-leverkusen', era:'2025', name:'Bayer Leverkusen',     badge:'/img/badges/bayer-04-leverkusen.png' },
      { slug: 'club-brugge',         era:'2025', name:'Club Brugge',          badge:'/img/badges/club-brugge.png' },
      { slug: 'fc-kopenhagen',       era:'2025', name:'Copenhagen',           badge:'/img/badges/fc-kopenhagen.png' },
    ]},
    { label: 'G', teams: [
      { slug: 'borussia-dortmund',   era:'2025', name:'Borussia Dortmund',    badge:'/img/badges/borussia-dortmund.png' },
      { slug: 'benfica-lissabon',    era:'2025', name:'Benfica',              badge:'/img/badges/benfica-lissabon.png' },
      { slug: 'celtic-glasgow',      era:'2025', name:'Celtic',               badge:'/img/badges/celtic-glasgow.png' },
      { slug: 'olympiacos',          era:'2025', name:'Olympiacos',           badge:'/img/badges/olympiakos-piraeus.png' },
    ]},
    { label: 'H', teams: [
      { slug: 'atalanta-bc',         era:'2025', name:'Atalanta',             badge:'/img/badges/atalanta-bc.png' },
      { slug: 'athletic-club',       era:'2025', name:'Athletic Club',        badge:'/img/badges/athletic-club.png' },
      { slug: 'eintracht-frankfurt', era:'2025', name:'Eintracht Frankfurt',  badge:'/img/badges/eintracht-frankfurt.png' },
      { slug: 'tottenham-hotspur',   era:'2025', name:'Tottenham Hotspur',    badge:'/img/badges/tottenham-hotspur.png' },
    ]},
    { label: 'I', teams: [
      { slug: 'sporting-cp',         era:'2025', name:'Sporting CP',          badge:'/img/badges/sporting-cp.png' },
      { slug: 'ssc-neapel',          era:'2025', name:'Napoli',               badge:'/img/badges/ssc-neapel.png' },
      { slug: 'olympique-marseille', era:'2025', name:'Olympique Marseille',  badge:'/img/badges/olympique-marseille.png' },
      { slug: 'villarreal-cf',       era:'2025', name:'Villarreal',           badge:'/img/badges/villarreal-cf.png' },
    ]},
  ];

  // ── UCL 2025/26 — 4 pots × 9 teams (broadcast draw) ────────
  const _UCL_POTS = [
    { pot: 1, label: 'Bombo 1', color: '#c8a951', teams: [
      { slug: 'real-madrid',         era:'2025', name:'Real Madrid'         },
      { slug: 'fc-bayern-munchen',   era:'2025', name:'Bayern München'      },
      { slug: 'manchester-city',     era:'2025', name:'Man City'            },
      { slug: 'fc-paris-saint-germain', era:'2025', name:'PSG'              },
      { slug: 'fc-liverpool',        era:'2025', name:'Liverpool'           },
      { slug: 'fc-barcelona',        era:'2025', name:'Barcelona'           },
      { slug: 'fc-arsenal',          era:'2025', name:'Arsenal'             },
      { slug: 'atletico-madrid',     era:'2025', name:'Atlético Madrid'     },
      { slug: 'inter-mailand',       era:'2025', name:'Inter'               },
    ]},
    { pot: 2, label: 'Bombo 2', color: '#a0a8c0', teams: [
      { slug: 'fc-chelsea',          era:'2025', name:'Chelsea'             },
      { slug: 'bayer-04-leverkusen', era:'2025', name:'Bayer Leverkusen'    },
      { slug: 'juventus-turin',      era:'2025', name:'Juventus'            },
      { slug: 'sporting-cp',         era:'2025', name:'Sporting CP'         },
      { slug: 'psv-eindhoven',       era:'2025', name:'PSV Eindhoven'       },
      { slug: 'club-brugge',         era:'2025', name:'Club Brugge'         },
      { slug: 'borussia-dortmund',   era:'2025', name:'Borussia Dortmund'   },
      { slug: 'benfica-lissabon',    era:'2025', name:'Benfica'             },
      { slug: 'ajax-amsterdam',      era:'2025', name:'Ajax'                },
    ]},
    { pot: 3, label: 'Bombo 3', color: '#5b9bd5', teams: [
      { slug: 'as-monaco',           era:'2025', name:'AS Monaco'           },
      { slug: 'galatasaray',         era:'2025', name:'Galatasaray'         },
      { slug: 'fc-kopenhagen',       era:'2025', name:'Copenhagen'          },
      { slug: 'celtic-glasgow',      era:'2025', name:'Celtic'              },
      { slug: 'eintracht-frankfurt', era:'2025', name:'Eintracht Frankfurt' },
      { slug: 'tottenham-hotspur',   era:'2025', name:'Tottenham'           },
      { slug: 'newcastle-united',    era:'2025', name:'Newcastle'           },
      { slug: 'atalanta-bc',         era:'2025', name:'Atalanta'            },
      { slug: 'athletic-club',       era:'2025', name:'Athletic Club'       },
    ]},
    { pot: 4, label: 'Bombo 4', color: '#e07b54', teams: [
      { slug: 'ssc-neapel',          era:'2025', name:'Napoli'              },
      { slug: 'olympique-marseille', era:'2025', name:'Marseille'           },
      { slug: 'villarreal-cf',       era:'2025', name:'Villarreal'          },
      { slug: 'union-saint-gilloise', era:'2025', name:'Union SG'           },
      { slug: 'olympiacos',          era:'2025', name:'Olympiacos'          },
      { slug: 'bodo-glimt',          era:'2025', name:'Bodø/Glimt'          },
      { slug: 'qarabag',             era:'2025', name:'Qarabağ'             },
      { slug: 'kairat-almaty',       era:'2025', name:'Kairat Almaty'       },
      { slug: 'pafos',               era:'2025', name:'Pafos FC'            },
    ]},
  ];

  // UEFA Euro 2024 — 6 groups × 4 = 24 teams
  const _EURO2024_GROUPS = [
    { label: 'A', teams: [
      { slug: 'deutschland',  era:'2025', name:'Alemania',       badge:'/img/badges/deutschland.png' },
      { slug: 'schottland',   era:'2025', name:'Escocia',        badge:'/img/badges/schottland.png'  },
      { slug: 'ungarn',       era:'2025', name:'Hungría',        badge:'/img/badges/hungary.png'     },
      { slug: 'schweiz',      era:'2025', name:'Suiza',          badge:'/img/badges/schweiz.png'     },
    ]},
    { label: 'B', teams: [
      { slug: 'spanien',      era:'2025', name:'España',         badge:'/img/badges/spanien.png'     },
      { slug: 'kroatien',     era:'2025', name:'Croacia',        badge:'/img/badges/kroatien.png'    },
      { slug: 'italien',      era:'2025', name:'Italia',         badge:'/img/badges/italien.png'     },
      { slug: 'albania',      era:'2025', name:'Albania',        badge:'/img/badges/albania.png'     },
    ]},
    { label: 'C', teams: [
      { slug: 'slowenien',    era:'2025', name:'Eslovenia',      badge:'/img/badges/slovenia.png'    },
      { slug: 'danemark',     era:'2025', name:'Dinamarca',      badge:'/img/badges/danemark.png'    },
      { slug: 'serbia',       era:'2025', name:'Serbia',         badge:'/img/badges/serbia.png'      },
      { slug: 'england',      era:'2025', name:'Inglaterra',     badge:'/img/badges/england.png'     },
    ]},
    { label: 'D', teams: [
      { slug: 'niederlande',  era:'2025', name:'Países Bajos',   badge:'/img/badges/niederlande.png' },
      { slug: 'frankreich',   era:'2025', name:'Francia',        badge:'/img/badges/frankreich.png'  },
      { slug: 'poland',       era:'2025', name:'Polonia',        badge:'/img/badges/poland.png'      },
      { slug: 'osterreich',   era:'2025', name:'Austria',        badge:'/img/badges/osterreich.png'  },
    ]},
    { label: 'E', teams: [
      { slug: 'belgien',      era:'2025', name:'Bélgica',        badge:'/img/badges/belgien.png'     },
      { slug: 'slowakei',     era:'2025', name:'Eslovaquia',     badge:'/img/badges/slovakia.png'    },
      { slug: 'rumania',      era:'2025', name:'Rumanía',        badge:'/img/badges/rumania.png'     },
      { slug: 'ukraine',      era:'2025', name:'Ucrania',        badge:'/img/badges/ukraine.png'     },
    ]},
    { label: 'F', teams: [
      { slug: 'portugal',     era:'2025', name:'Portugal',       badge:'/img/badges/portugal.png'    },
      { slug: 'tschechien',   era:'2025', name:'Rep. Checa',     badge:'/img/badges/tschechien.png'  },
      { slug: 'georgien',     era:'2025', name:'Georgia',        badge:'/img/badges/georgien.png'    },
      { slug: 'turkey',       era:'2025', name:'Turquía',        badge:'/img/badges/turkey.png'      },
    ]},
  ];

  // Copa América 2024 — 4 groups × 4 = 16 teams
  const _COPAMERICA2024_GROUPS = [
    { label: 'A', teams: [
      { slug: 'argentinien',  era:'2025', name:'Argentina',      badge:'/img/badges/argentinien.png' },
      { slug: 'peru',         era:'2025', name:'Perú',           badge:'/img/badges/peru.png'        },
      { slug: 'chile',        era:'2025', name:'Chile',          badge:'/img/badges/chile.png'       },
      { slug: 'kanada',       era:'2025', name:'Canadá',         badge:'/img/badges/canada.png'      },
    ]},
    { label: 'B', teams: [
      { slug: 'mexiko',       era:'2025', name:'México',         badge:'/img/badges/mexico.png'      },
      { slug: 'ecuador',      era:'2025', name:'Ecuador',        badge:'/img/badges/ecuador.png'     },
      { slug: 'venezuela',    era:'2025', name:'Venezuela',      badge:'/img/badges/venezuela.png'   },
      { slug: 'jamaika',      era:'2025', name:'Jamaica',        badge:'/img/badges/jamaica.png'     },
    ]},
    { label: 'C', teams: [
      { slug: 'united-states', era:'2025', name:'Estados Unidos', badge:'/img/badges/united-states.png' },
      { slug: 'uruguay',      era:'2025', name:'Uruguay',        badge:'/img/badges/uruguay.png'     },
      { slug: 'panama',       era:'2025', name:'Panamá',         badge:'/img/badges/panama.png'      },
      { slug: 'bolivien',     era:'2025', name:'Bolivia',        badge:'/img/badges/bolivien.png'    },
    ]},
    { label: 'D', teams: [
      { slug: 'brasilien',    era:'2025', name:'Brasil',         badge:'/img/badges/brasilien.png'   },
      { slug: 'kolumbien',    era:'2025', name:'Colombia',       badge:'/img/badges/colombia.png'    },
      { slug: 'paraguay',     era:'2025', name:'Paraguay',       badge:'/img/badges/paraguay.png'    },
      { slug: 'costa-rica',   era:'2025', name:'Costa Rica',     badge:'/img/badges/costa-rica.png'  },
    ]},
  ];

  // Copa Libertadores 2026 — 8 grupos × 4 = 32 clubes sudamericanos
  // Copa CONMEBOL Libertadores 2026 — Group stage draw (19 March 2026)
  const _LIBERTADORES2025_GROUPS = [
    { label: 'A', teams: [
      { slug: 'flamengo',                   era:'2025', name:'Flamengo',              badge:'/img/badges/flamengo.png'                        },
      { slug: 'estudiantes',                era:'2025', name:'Estudiantes',           badge:'/img/badges/estudiantes.png'                     },
      { slug: 'cusco-fc',                   era:'2025', name:'Cusco FC',              badge:'/img/badges/cusco-fc.png?v=38'                   },
      { slug: 'independiente-medellin',     era:'2025', name:'Ind. Medellín',         badge:'/img/badges/independiente-medellin.png'          },
    ]},
    { label: 'B', teams: [
      { slug: 'nacional',                   era:'2025', name:'Nacional',              badge:'/img/badges/nacional.png'                        },
      { slug: 'universitario',              era:'2025', name:'Universitario',         badge:'/img/badges/universitario.png'                   },
      { slug: 'coquimbo-unido',             era:'2025', name:'Coquimbo Unido',        badge:'/img/badges/coquimbo-unido.png'                  },
      { slug: 'deportes-tolima',            era:'2025', name:'Deportes Tolima',       badge:'/img/badges/deportes-tolima.png'                 },
    ]},
    { label: 'C', teams: [
      { slug: 'fluminense',                 era:'2025', name:'Fluminense',            badge:'/img/badges/fluminense.png'                      },
      { slug: 'bolivar',                    era:'2025', name:'Bolívar',               badge:'/img/badges/bolivar.png'                         },
      { slug: 'deportivo-la-guaira',        era:'2025', name:'Deportivo La Guaira',   badge:'/img/badges/deportivo-la-guaira.png'             },
      { slug: 'independiente-rivadavia',    era:'2025', name:'Ind. Rivadavia',        badge:'/img/badges/independiente-rivadavia.png'         },
    ]},
    { label: 'D', teams: [
      { slug: 'boca-juniors',               era:'2025', name:'Boca Juniors',          badge:'/img/badges/boca-juniors.png'                    },
      { slug: 'cruzeiro',                   era:'2025', name:'Cruzeiro',              badge:'/img/badges/cruzeiro.png'                        },
      { slug: 'universidad-catholica-chile',era:'2025', name:'U. Católica (Chile)',   badge:'/img/badges/universidad-catholica-chile.png'     },
      { slug: 'barcelona-sc',               era:'2025', name:'Barcelona SC',          badge:'/img/badges/barcelona-sc.png'                    },
    ]},
    { label: 'E', teams: [
      { slug: 'penarol',                    era:'2025', name:'Peñarol',               badge:'/img/badges/penarol.png'                         },
      { slug: 'corinthians',                era:'2025', name:'Corinthians',           badge:'/img/badges/corinthians.png'                     },
      { slug: 'independiente-santa-fe',     era:'2025', name:'Ind. Santa Fe',         badge:'/img/badges/independiente-santa-fe.png'          },
      { slug: 'platense',                   era:'2025', name:'Platense',              badge:'/img/badges/platense.png'                        },
    ]},
    { label: 'F', teams: [
      { slug: 'se-palmeiras',               era:'2025', name:'Palmeiras',             badge:'/img/badges/palmeiras.png'                       },
      { slug: 'cerro-porteno',              era:'2025', name:'Cerro Porteño',         badge:'/img/badges/cerro-porteno.png'                   },
      { slug: 'junior-barranquilla',        era:'2025', name:'Junior',                badge:'/img/badges/junior-barranquilla.png'             },
      { slug: 'sporting-cristal',           era:'2025', name:'Sporting Cristal',      badge:'/img/badges/sporting-cristal.png'                },
    ]},
    { label: 'G', teams: [
      { slug: 'ldu-quito',                  era:'2025', name:'LDU Quito',             badge:'/img/badges/ldu-quito.png'                       },
      { slug: 'lanus',                      era:'2025', name:'Lanús',                 badge:'/img/badges/lanus.png'                           },
      { slug: 'always-ready',               era:'2025', name:'Always Ready',          badge:'/img/badges/always-ready.png'                    },
      { slug: 'mirassol',                   era:'2025', name:'Mirassol',              badge:'/img/badges/mirassol.png'                        },
    ]},
    { label: 'H', teams: [
      { slug: 'independiente-del-valle',    era:'2025', name:'Ind. del Valle',        badge:'/img/badges/independiente-del-valle.png'         },
      { slug: 'libertad',                   era:'2025', name:'Libertad',              badge:'/img/badges/libertad.png'                        },
      { slug: 'rosario-central',            era:'2025', name:'Rosario Central',       badge:'/img/badges/rosario-central.png'                 },
      { slug: 'universidad-central-vzla',   era:'2025', name:'Universidad Central',   badge:'/img/badges/universidad-central-vzla.png'        },
    ]},
  ];

  function _showUCLDrawScreen() {
    hide($('trn-step-1')); hide($('trn-step-2')); hide($('trn-step-3'));
    const existing = $('trn-preset-confirm'); if (existing) hide(existing);
    const stepbar = document.querySelector('.trn-stepbar'); if (stepbar) hide(stepbar);

    let el = $('trn-ucl-draw');
    if (!el) {
      el = document.createElement('div');
      el.id = 'trn-ucl-draw';
      el.className = 'trn-step trn-ucl-draw-wrap';
      $('trn-wizard').appendChild(el);
    }
    _uclDrawRunning = false;
    _potEditMode = false;
    _potEditSel  = null;
    show(el);
    el.innerHTML = _buildUCLDrawHTML();

    _wireUCLDrawButtons(el);

    // Async badge load
    _getTrnCatalog().then(cat => {
      if (!Array.isArray(cat)) return;
      _UCL_POTS.forEach(pot => pot.teams.forEach(t => {
        const ce = cat.find(c => c.slug === t.slug);
        if (ce && ce.badge) {
          _badgeCache[t.slug] = ce.badge;
          el.querySelectorAll(`.ucl-pot-team[data-slug="${t.slug}"] img`).forEach(img => img.src = ce.badge);
        }
      }));
    }).catch(() => {});
  }

  function _wireUCLDrawButtons(el) {
    el.querySelector('#ucl-start-btn')?.addEventListener('click', startUCLDraw);
    el.querySelector('#ucl-cancel-btn')?.addEventListener('click', cancelPreset);
    el.querySelector('#ucl-sim-btn')?.addEventListener('click', runPresetSimulation);
    el.querySelector('#ucl-randomize-btn')?.addEventListener('click', randomizeUCLPots);
    el.querySelector('#ucl-edit-btn')?.addEventListener('click', toggleUCLPotEditMode);
    // Pot team click delegation for swap mode
    const grid = el.querySelector('#ucl-pots-grid');
    if (grid) {
      grid.addEventListener('click', e => {
        if (!_potEditMode) return;
        const teamEl = e.target.closest('.ucl-pot-team');
        if (!teamEl) return;
        const slug = teamEl.dataset.slug;
        const potIdx = _UCL_POTS.findIndex(p => p.teams.some(t => t.slug === slug));
        if (potIdx === -1) return;
        const teamIdx = _UCL_POTS[potIdx].teams.findIndex(t => t.slug === slug);
        _openPresetReplace({ type: 'ucl', potIdx, teamIdx });
      });
    }
  }

  function _buildPotsHTML() {
    return _UCL_POTS.map(pot => {
      const teamRows = pot.teams.map(t =>
        `<div class="ucl-pot-team${_potEditMode ? ' ucl-pot-editable' : ''}" data-slug="${_esc(t.slug)}" data-pot="${pot.pot}">
          <img class="ucl-draw-team-badge" src="${_badgeCache[t.slug] || '/img/badges/_placeholder.svg'}"
               onerror="this.src='/img/badges/_placeholder.svg'" alt="">
          <span class="ucl-draw-team-name">${_esc(t.name)}</span>
        </div>`
      ).join('');
      return `<div class="ucl-pot" data-pot="${pot.pot}" style="--pot-clr:${_esc(pot.color)}">
        <div class="ucl-pot-header">${_esc(pot.label)}</div>
        <div class="ucl-pot-teams">${teamRows}</div>
      </div>`;
    }).join('');
  }

  function _buildUCLDrawHTML() {
    return `
      <div class="ucl-broadcast-header">
        <div class="ucl-bh-stars">✦ ✦ ✦</div>
        <div class="ucl-bh-title">UEFA Champions League</div>
        <div class="ucl-bh-subtitle">SORTEO FASE DE LIGA · 2025/26</div>
      </div>
      <div class="ucl-pots-grid" id="ucl-pots-grid">${_buildPotsHTML()}</div>
      <div class="ucl-draw-results-wrap">
        <div class="ucl-draw-results-header">
          <span class="ucl-draw-counter" id="ucl-counter">${t('trn-draw-init-hint')}</span>
          <div class="ucl-progress-bar" style="margin-top:.35rem"><div class="ucl-progress-fill" id="ucl-progress-fill"></div></div>
        </div>
        <div class="ucl-draw-results" id="ucl-draw-results"></div>
      </div>
      <div class="ucl-draw-actions">
        <button class="btn-secondary" id="ucl-cancel-btn">${t('trn-btn-back')}</button>
        <div class="ucl-draw-tools">
          <button class="btn-secondary ucl-tool-btn" id="ucl-randomize-btn" title="${t('trn-btn-shuffle')}">🔀 ${t('trn-btn-shuffle').replace(/^🔀\s*/,'')}</button>
          <button class="btn-secondary ucl-tool-btn" id="ucl-edit-btn" title="${t('trn-btn-edit')}">✏️ ${t('trn-btn-edit').replace(/^✏️\s*/,'')}</button>
        </div>
        <button class="btn-primary ucl-start-btn" id="ucl-start-btn">
          ▶&nbsp;${t('trn-draw-start').replace(/^▶[·\u00a0]*/,'') || 'SORTEAR'}
        </button>
        <button class="btn-primary ucl-sim-btn" id="ucl-sim-btn" style="display:none">
          ${t('trn-btn-simulate-ucl')}
        </button>
      </div>
    `;
  }

  function randomizeUCLPots() {
    if (_uclDrawRunning) return;
    const allTeams = _UCL_POTS.flatMap(p => p.teams);
    for (let i = allTeams.length - 1; i > 0; i--) {
      const j = 0 | Math.random() * (i + 1);
      [allTeams[i], allTeams[j]] = [allTeams[j], allTeams[i]];
    }
    _UCL_POTS.forEach((pot, pi) => { pot.teams = allTeams.slice(pi * 9, (pi + 1) * 9); });
    _uclFixtures = null;
    _potEditSel  = null;
    const grid = $('trn-ucl-draw')?.querySelector('#ucl-pots-grid');
    if (grid) grid.innerHTML = _buildPotsHTML();
    // Reset draw results panel
    const counter = $('ucl-counter');
    if (counter) counter.textContent = 'Pulsa SORTEAR para iniciar · 8 partidos por equipo (4🏠 · 4✈)';
    const fill = $('ucl-progress-fill');
    if (fill) fill.style.width = '0%';
    const results = $('ucl-draw-results');
    if (results) results.innerHTML = '';
    const simBtn = $('ucl-sim-btn');
    if (simBtn) simBtn.style.display = 'none';
    const startBtn = $('ucl-start-btn');
    if (startBtn) { startBtn.style.display = ''; startBtn.disabled = false; startBtn.textContent = '▶\u00a0SORTEAR'; }
  }

  function toggleUCLPotEditMode() {
    if (_uclDrawRunning) return;
    _potEditMode = !_potEditMode;
    _potEditSel  = null;
    const btn = $('trn-ucl-draw')?.querySelector('#ucl-edit-btn');
    if (btn) btn.classList.toggle('btn-active', _potEditMode);
    const grid = $('trn-ucl-draw')?.querySelector('#ucl-pots-grid');
    if (grid) {
      grid.classList.toggle('ucl-pots-edit-mode', _potEditMode);
      grid.innerHTML = _buildPotsHTML();
    }
    // Re-wire delegation after innerHTML reset
    if (grid && _potEditMode) {
      // delegation is already set up on the persistent grid element; innerHTML change just re-populates content
    }
  }

  async function startUCLDraw() {
    if (_uclDrawRunning) return;
    _uclDrawRunning = true;
    const startBtn = $('ucl-start-btn');
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = '⏳ Sorteando...'; }

    // Build pots → generate fixtures (reused by simulation)
    const pots = _UCL_POTS.map(pot =>
      pot.teams.map(pt => _teams.find(t => t.slug === pt.slug) || { slug: pt.slug, era:'2025', name: pt.name })
    );
    _uclFixtures = _generateUCLLeagueFixtures(pots);

    // Build per-team opponent map: slug → [{slug, name, potNum, potColor, isHome}]
    const teamOpponents = {};
    _UCL_POTS.forEach(pot => pot.teams.forEach(t => { teamOpponents[t.slug] = []; }));
    _uclFixtures.forEach(f => {
      const hpot = _UCL_POTS.find(p => p.teams.some(t => t.slug === f.home.slug));
      const apot = _UCL_POTS.find(p => p.teams.some(t => t.slug === f.away.slug));
      if (teamOpponents[f.home.slug]) teamOpponents[f.home.slug].push(
        { slug: f.away.slug, name: f.away.name, potNum: apot?.pot||0, potColor: apot?.color||'#888', isHome: true });
      if (teamOpponents[f.away.slug]) teamOpponents[f.away.slug].push(
        { slug: f.home.slug, name: f.home.name, potNum: hpot?.pot||0, potColor: hpot?.color||'#888', isHome: false });
    });

    const counter    = $('ucl-counter');
    const progressFill = $('ucl-progress-fill');
    const resultsEl  = $('ucl-draw-results');
    let drawn = 0;

    // Draw pot by pot (Bombo 1 → 4), random order within each pot
    for (const pot of _UCL_POTS) {
      // Pot section header in results
      if (resultsEl) {
        const sec = document.createElement('div');
        sec.className = 'ucl-res-section';
        sec.innerHTML = `<span style="color:${pot.color}">● ${_esc(pot.label)}</span>`;
        resultsEl.appendChild(sec);
      }

      const shuffled = [...pot.teams].sort(() => Math.random() - 0.5);
      for (const team of shuffled) {
        drawn++;
        const opps = (teamOpponents[team.slug] || []).slice().sort((a, b) => a.potNum - b.potNum || (a.isHome ? -1 : 1));

        // Flash team card in pot grid
        document.querySelectorAll('.ucl-pot-team.ucl-drawn-active').forEach(c => c.classList.remove('ucl-drawn-active'));
        const card = document.querySelector(`.ucl-pot-team[data-slug="${team.slug}"]`);
        if (card) {
          card.classList.add('ucl-drawn', 'ucl-drawn-active');
          card.style.setProperty('--drawn-clr', pot.color);
        }

        // Add row to results panel
        if (resultsEl) {
          const oppsHtml = opps.map(o => {
            const ob = _badgeCache[o.slug] || '/img/badges/_placeholder.svg';
            return `<span class="ucl-res-opp" style="--opp-clr:${o.potColor}">
              <img src="${_esc(ob)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="" class="ucl-res-opp-badge">
              <span class="ucl-res-opp-name">${_esc(o.name)}</span>
              <span class="ucl-res-opp-ha">${o.isHome ? '🏠' : '✈'}</span>
            </span>`;
          }).join('');
          const tb = _badgeCache[team.slug] || '/img/badges/_placeholder.svg';
          const row = document.createElement('div');
          row.className = 'ucl-res-row ucl-res-row-in';
          row.innerHTML = `
            <img src="${_esc(tb)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="" class="ucl-res-team-badge">
            <span class="ucl-res-team-name" style="color:${pot.color}">${_esc(team.name)}</span>
            <span class="ucl-res-arrow">→</span>
            <div class="ucl-res-opps">${oppsHtml}</div>
          `;
          resultsEl.appendChild(row);
          resultsEl.scrollTop = resultsEl.scrollHeight;
          requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove('ucl-res-row-in')));
        }

        if (counter) counter.textContent = `${t('trn-draw-counter')} ${pot.pot} — ${drawn} / 36 ${t('trn-draw-drawn-of')}`;
        if (progressFill) progressFill.style.width = Math.round((drawn / 36) * 100) + '%';
        await new Promise(r => setTimeout(r, 160));
      }
    }

    // Done
    _uclDrawRunning = false;
    if (counter) counter.textContent = `${t('trn-draw-complete')} — 36 ${t('trn-teams-unit')} · 144 ${t('trn-cal-matches-lbl').toLowerCase()}`;
    const simBtn = $('ucl-sim-btn');
    if (simBtn) { simBtn.style.display = ''; simBtn.classList.add('ucl-sim-ready'); }
    if (startBtn) startBtn.style.display = 'none';
  }

  // ── Historical World Cup year picker ─────────────────────────────────────
  function _showWCYearPicker() {
    // Hide other overlay screens
    const conf = $('trn-preset-confirm'); if (conf) hide(conf);
    const ucl  = $('trn-ucl-draw');      if (ucl)  hide(ucl);

    // Build or reuse picker element
    let el = $('trn-wc-year-picker');
    if (!el) {
      el = document.createElement('div');
      el.id = 'trn-wc-year-picker';
      el.className = 'trn-step';
      $('trn-wizard').appendChild(el);
    }
    show(el);

    // Collect editions (may not be available if script failed to load)
    const years  = (typeof _WC_EDITION_YEARS !== 'undefined') ? _WC_EDITION_YEARS : [];
    const edsMap = (typeof _WC_EDITIONS      !== 'undefined') ? _WC_EDITIONS      : {};

    const yearsHtml = years.map(yr => {
      const ed = edsMap[yr] || {};
      const isCancelled = ed.format === 'cancelled';
      const normativa = ed.normativa || '';

      // Determine visual era for retro theming
      const era = yr <= 1950 ? 'pioneer'
                : yr <= 1970 ? 'classic'
                : yr <= 1990 ? 'retro'
                : yr >= 2026 ? 'future'
                : 'modern';
      const eraLabel = yr <= 1950 ? 'Pioneros'
                     : yr <= 1970 ? 'Clásica'
                     : yr <= 1990 ? 'Retro'
                     : yr >= 2026 ? 'En curso'
                     : 'Moderna';

      if (isCancelled) {
        return `<div class="trn-wcy-btn trn-wcy-btn--cancelled" aria-disabled="true" data-era="${era}">
          <span class="trn-wcy-year">${yr}</span>
          <span class="trn-wcy-cancelled-label">⚔️ ${_esc(normativa)}</span>
        </div>`;
      }
      return `<button class="trn-wcy-btn" data-year="${yr}" data-era="${era}">
        <span class="trn-wcy-era">${eraLabel}</span>
        <span class="trn-wcy-year">${yr}</span>
        <span class="trn-wcy-host">${_esc(ed.host || '')}</span>
        ${normativa ? `<span class="trn-wcy-fmt">${_esc(normativa)}</span>` : ''}
      </button>`;
    }).join('');

    el.innerHTML = `
      <div class="trn-preset-confirm-header">
        <div class="trn-preset-confirm-icon">
          <img src="/img/trophy-wc.png" class="trn-preset-confirm-trophy" alt="WC Trophy">
        </div>
        <div>
          <h2 class="trn-step-title" style="margin:0">FIFA World Cup</h2>
          <p class="trn-step-hint" style="margin:.2rem 0 0">Elige una edición histórica</p>
        </div>
      </div>
      <div class="trn-wcy-grid">${yearsHtml}</div>
      <div class="trn-step-actions trn-preset-confirm-actions">
        <button class="btn-secondary" id="wcy-cancel-btn">${t('trn-btn-back')}</button>
      </div>
    `;

    el.querySelector('#wcy-cancel-btn')?.addEventListener('click', cancelPreset);
    el.querySelector('.trn-wcy-grid')?.addEventListener('click', e => {
      const btn = e.target.closest('.trn-wcy-btn');
      if (!btn) return;
      const yr = +btn.dataset.year;
      if (yr) _loadWCEdition(yr);
    });
  }

  function _loadWCEdition(year) {
    const edsMap = (typeof _WC_EDITIONS !== 'undefined') ? _WC_EDITIONS : {};
    const ed = edsMap[year];
    if (!ed) return;

    // Hide year picker
    const yrPicker = $('trn-wc-year-picker'); if (yrPicker) hide(yrPicker);

    // 2026: route to the full wc2026 preset
    if (ed.format === 'wc2026') {
      loadPreset('wc2026');
      return;
    }

    // Cancelled editions — nothing to load
    if (ed.format === 'cancelled' || !ed.groups) return;

    _wcHistoricalYear = year;
    _activePreset     = 'wc-historical';
    _fmt              = 'champions';
    _uclFixtures      = null;
    _rules = { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: false, extraTime: true, tercerPuesto: true, copaMode: 'groups' };

    _teams      = [];
    _groupsDraw = [];
    ed.groups.forEach(g => g.teams.forEach(tm => {
      _teams.push({ slug: tm.slug, era: tm.era, name: tm.name, ovr: null });
    }));
    _numTeams   = _teams.length;
    if (ed.format !== 'knockout16') {
      _groupsDraw = ed.groups.map(g => g.teams.map(t => _teams.find(x => x.slug === t.slug) || t));
    }

    // Pre-seed badge cache from edition data; lock non-placeholder slugs so
    // the catalog can never overwrite historical badges with modern ones.
    const _lockedBadges = new Set();
    ed.groups.forEach(g => g.teams.forEach(t => {
      if (t.badge) _badgeCache[t.slug] = t.badge;
      if (t.badge && !t.badge.includes('_placeholder')) _lockedBadges.add(t.slug);
    }));
    _setPresetBadges(_teams, _lockedBadges);

    _showPresetConfirm('wc-historical');
  }

  function loadPreset(presetId) {
    // Historical WC editions: show year picker first
    if (presetId === 'wc-historical') {
      _activePreset = 'wc-historical';
      _showWCYearPicker();
      return;
    }

    const _PRESET_GROUPS = {
      'wc2026':          _WC2026_GROUPS,
      'ucl2026':         _UCL2026_GROUPS,
      'euro2024':        _EURO2024_GROUPS,
      'copamerica2024':  _COPAMERICA2024_GROUPS,
      'libertadores2025': _LIBERTADORES2025_GROUPS,
    };
    const groups  = _PRESET_GROUPS[presetId] || _UCL2026_GROUPS;
    const isWC    = presetId === 'wc2026';

    _fmt          = 'champions';
    _activePreset = presetId;
    _uclFixtures  = null;
    _rules = isWC
      ? { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: false, extraTime: true, tercerPuesto: true,  copaMode: 'groups' }
      : presetId === 'libertadores2025'
        ? { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: true,  extraTime: true, tercerPuesto: false, copaMode: 'groups' }
      : presetId === 'euro2024'
        ? { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: false, extraTime: true, tercerPuesto: false, copaMode: 'groups' }
      : presetId === 'copamerica2024'
        ? { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: false, extraTime: true, tercerPuesto: true,  copaMode: 'groups' }
      : { idaVuelta: false, grupasIdaVuelta: false, koIdaVuelta: true,  extraTime: true, tercerPuesto: false, copaMode: 'groups' };
    _teams     = [];
    _groupsDraw = [];

    groups.forEach(g => g.teams.forEach(t => {
      _teams.push({ slug: t.slug, era: t.era, name: t.name, ovr: null });
    }));
    _numTeams   = _teams.length;
    _groupsDraw = groups.map(g => g.teams.map(t => _teams.find(x => x.slug === t.slug) || t));

    // Pre-seed badge cache from inline badge fields (no network needed)
    groups.forEach(g => g.teams.forEach(t => {
      if (t.badge) _badgeCache[t.slug] = t.badge;
    }));

    // Load badges async in background — does not block navigation
    _setPresetBadges(_teams);

    // UCL → broadcast draw screen; others → static confirm
    if (presetId === 'ucl2026') {
      _showUCLDrawScreen();
    } else {
      _showPresetConfirm(presetId);
    }
  }

  function _setPresetBadges(teams, lockedSlugs) {
    const locked = lockedSlugs instanceof Set ? lockedSlugs : new Set();
    if (Array.isArray(_trnCatalog)) {
      teams.forEach(t => {
        if (locked.has(t.slug)) return;
        const cat = _trnCatalog.find(c => c.slug === t.slug);
        if (cat && cat.badge) _badgeCache[t.slug] = cat.badge;
      });
    } else {
      fetch('/catalog').then(r => r.json()).then(d => {
        if (!Array.isArray(d)) return;
        _trnCatalog = d;
        teams.forEach(t => {
          if (locked.has(t.slug)) return;
          const cat = d.find(c => c.slug === t.slug);
          if (cat && cat.badge) {
            _badgeCache[t.slug] = cat.badge;
            document.querySelectorAll(`[data-slug="${t.slug}"] img.trn-badge`).forEach(img => { img.src = cat.badge; });
          }
        });
      }).catch(() => {});
    }
  }

  function _showPresetConfirm(presetId) {
    const isWC    = presetId === 'wc2026' || presetId === 'wc-historical';
    const isHistoricalWC = presetId === 'wc-historical';

    // Build dynamic historical WC meta using the selected year
    const _wcHistMeta = (() => {
      if (!isHistoricalWC || !_wcHistoricalYear) return null;
      const ed = (typeof _WC_EDITIONS !== 'undefined') ? _WC_EDITIONS[_wcHistoricalYear] : null;
      const sub  = ed ? (ed.normativa || (_teams.length + ' selecciones')) : '';
      const host = ed ? (ed.host || '') : '';
      return {
        title:     `FIFA World Cup ${_wcHistoricalYear}`,
        icon:      `<img src="/img/trophy-wc.png" class="trn-preset-confirm-trophy" alt="WC Trophy">`,
        subtitle:  host ? `${host} · ${sub}` : sub,
        gridClass: _groupsDraw.length <= 4  ? 'trn-preset-groups-copa-america'
                 : _groupsDraw.length <= 6  ? 'trn-preset-groups-euro'
                 :                            'trn-preset-groups-wc',
      };
    })();

    const _PRESET_META = {
      'wc2026':          { title: 'FIFA World Cup 2026',             icon: `<img src="/img/trophy-wc.png"  class="trn-preset-confirm-trophy" alt="WC Trophy">`, subtitle: t('trn-preset-subtitle-wc'),           gridClass: 'trn-preset-groups-wc' },
      'euro2024':        { title: 'UEFA Euro 2024',                  icon: `<img src="/img/trophy-euro.png"          class="trn-preset-confirm-trophy" alt="Euro Trophy">`,         subtitle: t('trn-preset-subtitle-euro') || '6 grupos + KO · 24 selecciones',            gridClass: 'trn-preset-groups-euro' },
      'copamerica2024':  { title: 'Copa América 2024',               icon: `<img src="/img/trophy-copa-america.png"  class="trn-preset-confirm-trophy" alt="Copa America Trophy">`, subtitle: t('trn-preset-subtitle-copa-america') || '4 grupos + KO · 16 selecciones',   gridClass: 'trn-preset-groups-copa-america' },
      'libertadores2025':{ title: 'Copa Libertadores 2026',          icon: `<img src="/img/trophy-libertadores.png"  class="trn-preset-confirm-trophy" alt="Libertadores Trophy">`, subtitle: t('trn-preset-subtitle-libertadores') || '8 grupos + KO ida y vuelta · 32 clubes', gridClass: 'trn-preset-groups-libertadores' },
    };
    const meta  = _wcHistMeta || _PRESET_META[presetId] || _PRESET_META['wc2026'];
    const title = meta.title;
    const iconHtml = isWC ? `<img src="/img/trophy-wc.png" class="trn-preset-confirm-trophy" alt="WC Trophy">` : meta.icon;
    const isKO16 = isHistoricalWC && (typeof _WC_EDITIONS !== 'undefined') && _WC_EDITIONS[_wcHistoricalYear]?.format === 'knockout16';
    const numGrps = _groupsDraw.length;

    hide($('trn-step-1'));
    hide($('trn-step-2'));
    hide($('trn-step-3'));
    const stepbar = document.querySelector('.trn-stepbar'); if (stepbar) hide(stepbar);

    let el = $('trn-preset-confirm');
    if (!el) {
      el = document.createElement('div');
      el.id = 'trn-preset-confirm';
      el.className = 'trn-step';
      $('trn-wizard').appendChild(el);
    }
    show(el);

    // KO16: show all teams as a simple grid (no group labels)
    const groupsHtml = isKO16
      ? `<div class="trn-pg-group" style="display:contents">${_teams.map(tm => {
          const badge = _badgeCache[tm.slug] || tm.badge || '/img/badges/_placeholder.svg';
          return `<div class="trn-pg-team" data-slug="${_esc(tm.slug)}">
            <img class="trn-mini-badge" src="${_esc(badge)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
            <span>${_esc(tm.name)}</span>
          </div>`;
        }).join('')}</div>`
      : _groupsDraw.map((grp, gi) => {
          const lbl = String.fromCharCode(65 + gi);
          const rows = grp.map(tm => {
            const badge = _badgeCache[tm.slug] || tm.badge || '/img/badges/_placeholder.svg';
            return `<div class="trn-pg-team" data-slug="${_esc(tm.slug)}">
              <img class="trn-mini-badge" src="${_esc(badge)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
              <span>${_esc(tm.name)}</span>
            </div>`;
          }).join('');
          return `<div class="trn-pg-group"><div class="trn-pg-label">${_esc(t('trn-draw-group-prefix') || 'Grupo ')}${lbl}</div>${rows}</div>`;
        }).join('');

    el.innerHTML = `
      <div class="trn-preset-confirm-header">
        <div class="trn-preset-confirm-icon">${iconHtml}</div>
        <div>
          <h2 class="trn-step-title" style="margin:0">${_esc(title)}</h2>
          <p class="trn-step-hint" style="margin:.2rem 0 0">${isHistoricalWC ? meta.subtitle : `${_teams.length} ${t('trn-teams-unit')} · ${numGrps} ${t('trn-groups-unit')} · ${meta.subtitle}`}</p>
        </div>
      </div>
      <div class="trn-preset-groups-preview${isKO16 ? ' trn-preset-groups-copa-america' : isHistoricalWC ? ' ' + (meta.gridClass || 'trn-preset-groups-wc') : isWC ? ' trn-preset-groups-wc' : meta.gridClass ? ' ' + meta.gridClass : ''}">${groupsHtml}</div>
      <div class="trn-step-actions trn-preset-confirm-actions">
        <button class="btn-secondary" id="preset-confirm-cancel">${t('trn-btn-back')}</button>
        <button class="btn-secondary" id="preset-confirm-edit" title="${t('trn-btn-edit')}">✏️ ${t('trn-btn-edit').replace(/^✏️\s*/,'')}</button>
        ${isWC && !isKO16 ? `<button class="btn-secondary" id="preset-confirm-shuffle" title="${t('trn-btn-shuffle')}">🔀 ${t('trn-btn-shuffle').replace(/^🔀\s*/,'')}</button>` : ''}
        <button class="btn-primary" id="preset-confirm-run">▶ Simular &nbsp;${_esc(title)}</button>
      </div>
    `;

    let _presetEditMode = false;

    // Wire up buttons (CSP blocks inline onclick)
    // For historical WC: back button goes to year picker, not step 1
    const cancelHandler = isHistoricalWC
      ? () => { hide(el); _showWCYearPicker(); }
      : cancelPreset;
    el.querySelector('#preset-confirm-cancel')?.addEventListener('click', cancelHandler);
    el.querySelector('#preset-confirm-shuffle')?.addEventListener('click', shufflePresetGroups);
    el.querySelector('#preset-confirm-run')?.addEventListener('click', runPresetSimulation);

    // Edit button: toggle click-to-replace mode
    el.querySelector('#preset-confirm-edit')?.addEventListener('click', () => {
      _presetEditMode = !_presetEditMode;
      const editBtn = el.querySelector('#preset-confirm-edit');
      if (editBtn) {
        editBtn.classList.toggle('ucl-tool-active', _presetEditMode);
        editBtn.textContent = _presetEditMode ? '✅ ' + (t('trn-btn-edit') || 'Editar') : '✏️ ' + (t('trn-btn-edit') || 'Editar').replace(/^✏️\s*/,'');
      }
      el.querySelectorAll('.trn-pg-team').forEach(te => te.classList.toggle('ucl-pot-editable', _presetEditMode));
    });

    // Click on team → open replace search (all group-stage presets)
    el.querySelector('.trn-preset-groups-preview')?.addEventListener('click', e => {
      if (!_presetEditMode && !isWC) return;
      const teamEl = e.target.closest('.trn-pg-team');
      if (!teamEl) return;
      const groupEl = teamEl.closest('.trn-pg-group');
      const groupIdx = [...el.querySelectorAll('.trn-pg-group')].indexOf(groupEl);
      const teamIdx  = [...groupEl.querySelectorAll('.trn-pg-team')].indexOf(teamEl);
      _openPresetReplace({ type: 'wc', groupIdx, teamIdx });
    });

    // Retroactively update badge img src as catalog resolves
    _getTrnCatalog().then(cat => {
      if (!Array.isArray(cat)) return;
      _teams.forEach(tm => {
        const ce = cat.find(c => c.slug === tm.slug);
        if (ce && ce.badge) {
          _badgeCache[tm.slug] = ce.badge;
          el.querySelectorAll(`[data-slug="${_esc(tm.slug)}"] img`).forEach(img => { img.src = ce.badge; });
        }
      });
    }).catch(() => {});
  }

  // ── Preset team replace (WC confirm groups + UCL pots) ───────
  let _replaceTarget = null;  // { groupIdx, teamIdx } | { potIdx, teamIdx }

  async function _openPresetReplace(context) {
    // context: { type:'wc'|'ucl', groupIdx?, potIdx?, teamIdx }
    _replaceTarget = context;
    let modal = document.getElementById('preset-replace-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'preset-replace-modal';
      modal.className = 'preset-replace-modal hidden';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="preset-replace-card">
        <div class="preset-replace-header">
          <span class="preset-replace-title">Cambiar equipo</span>
          <button class="preset-replace-close" id="preset-replace-close">✕</button>
        </div>
        <div class="preset-replace-search-row">
          <input id="preset-replace-input" class="preset-replace-input" type="search" placeholder="Busca equipo…" autocomplete="off" spellcheck="false">
        </div>
        <div id="preset-replace-results" class="preset-replace-results"></div>
      </div>`;
    modal.classList.remove('hidden');
    const input = modal.querySelector('#preset-replace-input');
    modal.querySelector('#preset-replace-close').addEventListener('click', _closePresetReplace);
    modal.addEventListener('click', e => { if (e.target === modal) _closePresetReplace(); });
    input.addEventListener('input', async () => {
      const q = input.value.trim();
      const res = modal.querySelector('#preset-replace-results');
      if (q.length < 2) { res.innerHTML = ''; return; }
      try {
        const catalog = await _getTrnCatalog();
        const ql = q.toLowerCase();
        const matches = catalog.filter(e => {
          const n = ((e.nameEs || '') + ' ' + (e.nameEn || '')).toLowerCase();
          return n.includes(ql) || e.slug.includes(ql);
        }).slice(0, 8);
        if (!matches.length) { res.innerHTML = `<div class="preset-replace-empty">Sin resultados</div>`; return; }
        // One row per (team × season) so user can pick any era
        res.innerHTML = matches.map(e => {
          const badge   = e.badge || '/img/badges/_placeholder.svg';
          const name    = (_getLang() === 'en' ? (e.nameEn || e.nameEs) : (e.nameEs || e.nameEn)) || e.slug;
          const seasons = (e.seasons || []).slice().reverse(); // newest first
          if (!seasons.length) seasons.push('');
          return `<div class="preset-replace-group">
            <div class="preset-replace-group-header">
              <img class="preset-replace-badge" src="${_esc(badge)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
              <span class="preset-replace-group-name">${_esc(name)}</span>
            </div>
            <div class="preset-replace-eras">
              ${seasons.map(era => `<div class="preset-replace-item" data-slug="${_esc(e.slug)}" data-name="${_esc(name)}" data-badge="${_esc(badge)}" data-era="${_esc(era)}">${era || '—'}</div>`).join('')}
            </div>
          </div>`;
        }).join('');
        res.querySelectorAll('.preset-replace-item').forEach(item => {
          item.addEventListener('click', () => _applyPresetReplace(item.dataset));
        });
      } catch (_) {}
    });
    setTimeout(() => input.focus(), 50);
  }

  function _closePresetReplace() {
    const modal = document.getElementById('preset-replace-modal');
    if (modal) modal.classList.add('hidden');
    _replaceTarget = null;
  }

  function _applyPresetReplace({ slug, name, badge, era }) {
    if (!_replaceTarget) return;
    const newTeam = { slug, name, era: era || '2025', badge: badge || '/img/badges/_placeholder.svg', ovr: null };
    // Resolve OVR from catalog if available
    if (_trnCatalog) { const ce = _trnCatalog.find(c => c.slug === slug); if (ce?.ovr) newTeam.ovr = ce.ovr; }
    if (badge) _badgeCache[slug] = badge;
    if (_replaceTarget.type === 'wc') {
      const { groupIdx, teamIdx } = _replaceTarget;
      // Capture old team BEFORE overwriting
      const oldSlugWC = _groupsDraw[groupIdx]?.[teamIdx]?.slug;
      if (_groupsDraw[groupIdx]) _groupsDraw[groupIdx][teamIdx] = newTeam;
      // Sync _teams using the old slug
      const ti = _teams.findIndex(t => t.slug === (oldSlugWC || ''));
      if (ti >= 0) _teams[ti] = newTeam; else _teams.push(newTeam);
    } else if (_replaceTarget.type === 'ucl') {
      const { potIdx, teamIdx } = _replaceTarget;
      const oldSlug = _UCL_POTS[potIdx]?.teams[teamIdx]?.slug;
      if (_UCL_POTS[potIdx]) _UCL_POTS[potIdx].teams[teamIdx] = { ...newTeam, pot: potIdx + 1 };
      if (oldSlug) {
        const ti = _teams.findIndex(t => t.slug === oldSlug);
        if (ti >= 0) _teams[ti] = newTeam; else _teams.push(newTeam);
      }
      _uclFixtures = null;
    }
    _closePresetReplace();
    // Re-render the appropriate screen
    if (_activePreset === 'ucl2026') {
      const grid = $('trn-ucl-draw')?.querySelector('#ucl-pots-grid');
      if (grid) grid.innerHTML = _buildPotsHTML();
    } else {
      _showPresetConfirm(_activePreset);
    }
  }

  function shufflePresetGroups() {
    if (!_groupsDraw.length) return;
    const groupSizes  = _groupsDraw.map(g => g.length);
    const allTeams    = _groupsDraw.flat();
    for (let i = allTeams.length - 1; i > 0; i--) {
      const j = 0 | Math.random() * (i + 1);
      [allTeams[i], allTeams[j]] = [allTeams[j], allTeams[i]];
    }
    let idx = 0;
    _groupsDraw = groupSizes.map(size => { const g = allTeams.slice(idx, idx + size); idx += size; return g; });
    _showPresetConfirm(_activePreset);
  }

  function cancelPreset() {
    _teams = []; _groupsDraw = []; _fmt = null; _activePreset = null; _uclFixtures = null;
    _wcHistoricalYear = null;
    const conf    = $('trn-preset-confirm');    if (conf)    hide(conf);
    const ucl     = $('trn-ucl-draw');          if (ucl)     hide(ucl);
    const yrPicker = $('trn-wc-year-picker');   if (yrPicker) hide(yrPicker);
    showStep(1);
  }

  async function runPresetSimulation() {
    const conf = $('trn-preset-confirm');
    const ucl  = $('trn-ucl-draw');
    if (conf) hide(conf);
    if (ucl)  hide(ucl);
    show($('trn-progress'));
    _setProgress(t('trn-progress-starting'), 0);
    try {
      const data = _activePreset === 'ucl2026'
        ? await _simulateUCLLeaguePhase()
        : _activePreset === 'wc2026'
          ? await _simulateWC2026()
          : _activePreset === 'euro2024'
            ? await _simulateEuro2024()
            : _activePreset === 'copamerica2024'
              ? await _simulateChampions()     // 4 groups, top 2 → QF
              : _activePreset === 'libertadores2025'
                ? await _simulateChampions()   // 8 groups, top 2, KO ida y vuelta
                : _activePreset === 'wc-historical'
                  ? await _simulateHistoricalWC()  // routes by edition format
                  : await _simulateChampions();
      _stopTrnLoadCycle();
      _data = data;
      _computeTournamentStats(_data);
      _buildMatchCache(_data);
      await _showChampionReveal(_data);
      _renderDashboard();
      show($('trn-dashboard'));
    } catch (err) {
      _stopTrnLoadCycle();
      console.error('[TRN preset]', err);
      if ($('trn-progress-text')) $('trn-progress-text').textContent = t('trn-sim-error') || 'Error al simular';
      hide($('trn-progress'));
      // Re-show whichever preset screen was active
      if (_activePreset === 'ucl2026' && ucl) show(ucl);
      else if (conf) show(conf);
    }
  }

  // ── Run simulation entry point ───────────────────────────
  async function runSimulation() {
    if (_teams.length !== _numTeams) return;
    show($('trn-progress'));
    hide($('trn-step-3-actions'));
    _setProgress(t('trn-progress-starting'), 0);
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
      if ($('trn-progress-text')) $('trn-progress-text').textContent = t('trn-sim-error') || 'Error al simular';
      hide($('trn-progress'));
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
        _showToast(t('trn-toast-poster-ok'));
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[TRN poster]', err);
        _showToast(t('trn-toast-poster-fail'));
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🏆 Compartir'; }
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
    ctx.fillText(t('trn-poster-champ-lbl'), W / 2, 655);

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
      ctx.fillText(t('trn-poster-standings'), W / 2, curY);
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
        ctx.fillText(t('trn-poster-final'), W / 2, curY);
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
        const sA = fin.legs === 2 ? (fin.aggA ?? '?') : (fin.scoreA ?? '?');
        const sB = fin.legs === 2 ? (fin.aggB ?? '?') : (fin.scoreB ?? '?');
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
          ctx.fillText(`(${t('trn-modal-pens')} ${fin.penA}–${fin.penB})`, W / 2, curY);
        }
        curY += 60;
      }
    }

    _scDivider(ctx, curY, W);
    curY += 54;

    // ── Individual Awards ─────────────────────────────────────
    ctx.font = '600 28px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2; ctx.textAlign = 'center';
    ctx.fillText(t('trn-poster-awards'), W / 2, curY);
    curY += 56;

    if (d.pichichi?.[0]) {
      const p = d.pichichi[0];
      const imgP = await _scLoadImg(_badge(p.teamSlug) || `/img/badges/${p.teamSlug || '_placeholder'}.svg`);
      _scBadge(ctx, imgP, 100, curY + 22, 36, CYAN, p.team);
      ctx.textAlign = 'left';
      ctx.font = 'bold 36px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = CYAN;
      ctx.fillText(t('trn-poster-pichichi'), 152, curY + 6);
      ctx.font = '500 30px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = WHITE;
      ctx.fillText(_scSafe(p.name), 152, curY + 42);
      ctx.textAlign = 'right';
      ctx.font = 'bold 48px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = GOLD;
      ctx.fillText(`${p.goals}`, W - 80, curY + 32);
      ctx.font = '500 24px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = DIM;
      ctx.fillText(t('trn-poster-goals-lbl'), W - 80, curY + 58);
      ctx.textAlign = 'center';
      curY += 110;
    }

    if (d.mvp?.[0]) {
      const m = d.mvp[0];
      const imgM = await _scLoadImg(_badge(m.teamSlug) || `/img/badges/${m.teamSlug || '_placeholder'}.svg`);
      _scBadge(ctx, imgM, 100, curY + 22, 36, MAGENTA, m.team);
      ctx.textAlign = 'left';
      ctx.font = 'bold 36px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = MAGENTA;
      ctx.fillText(t('trn-poster-mvp'), 152, curY + 6);
      ctx.font = '500 30px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = WHITE;
      ctx.fillText(_scSafe(m.name), 152, curY + 42);
      ctx.textAlign = 'right';
      ctx.font = 'bold 48px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = GOLD;
      ctx.fillText(`${m.count}×`, W - 80, curY + 32);
      ctx.font = '500 24px "Rajdhani",Arial,sans-serif'; ctx.fillStyle = DIM;
      ctx.fillText(t('trn-poster-mom'), W - 80, curY + 58);
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
    el.textContent = fallback ? t('trn-copy-fail') : msg;
    el.classList.add('trn-toast--show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('trn-toast--show'), 2800);
  }

  const _TRN_LOADING_MSGS = () => [
    t('trn-loading-1'), t('trn-loading-2'), t('trn-loading-3'), t('trn-loading-4'),
    t('trn-loading-5'), t('trn-loading-6'), t('trn-loading-7'), t('trn-loading-8'),
    t('trn-loading-9'), t('trn-loading-10'),
  ];
  let _trnLoadTimer = null;
  function _startTrnLoadCycle() {
    _stopTrnLoadCycle();
    let i = 0;
    const el = $('trn-progress-text');
    if (!el) return;
    _trnLoadTimer = setInterval(() => {
      i = (i + 1) % _TRN_LOADING_MSGS().length;
      if (el && el.isConnected) el.textContent = _TRN_LOADING_MSGS()[i];
    }, 700);
  }
  function _stopTrnLoadCycle() {
    if (_trnLoadTimer) { clearInterval(_trnLoadTimer); _trnLoadTimer = null; }
  }

  // ── Simulation screen initialise (title, trophy, phase steps) ─
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
      data.matches.forEach((m, i) => add(m, `${t('trn-cal-jornada')} ${Math.floor(i / chunk) + 1} × ${t('trn-fmt-name-liga')}`));
    } else if (data.format === 'ucl-league') {
      (data.leagueMatches || []).forEach((m, i) => add(m, `Fase de Liga — J${Math.floor(i / 36) + 1}`));
      (data.playoffRound?.matches || []).forEach(m => add(m, 'Play-In'));
      (data.koRounds || []).forEach(r => r.matches.forEach(m => add(m, r.label + ' × Champions')));
    } else if (data.format === 'copa' && !data.groups) {
      data.rounds.forEach(r => r.matches.forEach(m => add(m, r.label + ' × ' + t('trn-fmt-name-copa'))));
      if (data.thirdPlace) add(data.thirdPlace, t('trn-cal-3rd-suffix') + t('trn-fmt-name-copa'));
    } else {
      // Copa groups mode or old Champions
      const label = data.format === 'copa' ? t('trn-fmt-name-copa') : t('trn-fmt-name-champions');
      (data.groups || []).forEach(g => g.matches.forEach(m => add(m, g.label)));
      (data.koRounds || []).forEach(r => r.matches.forEach(m => add(m, r.label + ' × ' + label)));
      if (data.thirdPlace) add(data.thirdPlace, t('trn-cal-3rd-suffix') + label);
    }
  }

  // ── Trophy SVG — format-specific (UCL, WC, generic) ─────
  // pfx: unique ID prefix so gradient IDs never clash between poster and reveal
  function _trophySVG(fmt, pfx) {
    const p = pfx || 't' + (Math.random() * 1e5 | 0);
    const isWC   = fmt === 'champions' && _activePreset === 'wc2026';
    const isEuro  = fmt === 'champions' && _activePreset === 'euro2024';
    const isCopa  = fmt === 'champions' && _activePreset === 'copamerica2024';
    const isLibt  = fmt === 'champions' && _activePreset === 'libertadores2025';
    const isUCL   = fmt === 'ucl-league' || (fmt === 'champions' && !isWC && !isEuro && !isCopa && !isLibt);
    const isRv    = pfx === 'rv';
    const sz      = isRv ? '94px' : '58px';
    // ── Custom Liga/Copa GolazoxX trophies (always) ─────────
    if (fmt === 'liga' && !_activePreset)
      return `<img src="/img/trophy-liga.png" class="trn-trophy-img trn-trophy-ani${isRv ? ' trn-trophy-ani-rv' : ''}" style="width:${sz};height:auto" alt="Liga Trophy">`;
    if ((fmt === 'copa' || (fmt === 'copa' && _rules && _rules.copaMode === 'groups')) && !_activePreset)
      return `<img src="/img/trophy-copa.png" class="trn-trophy-img trn-trophy-ani${isRv ? ' trn-trophy-ani-rv' : ''}" style="width:${sz};height:auto" alt="Copa Trophy">`;
    // Use real trophy PNGs for preset tournaments
    if (isUCL && _activePreset)
      return `<img src="/img/trophy-ucl.png"          class="trn-trophy-img trn-trophy-ani${isRv ? ' trn-trophy-ani-rv' : ''}" style="width:${sz};height:auto" alt="UCL Trophy">`;
    if (isWC && _activePreset)
      return `<img src="/img/trophy-wc.png"           class="trn-trophy-img trn-trophy-ani${isRv ? ' trn-trophy-ani-rv' : ''}" style="width:${sz};height:auto" alt="WC Trophy">`;
    if (isEuro)
      return `<img src="/img/trophy-euro.png"         class="trn-trophy-img trn-trophy-ani${isRv ? ' trn-trophy-ani-rv' : ''}" style="width:${sz};height:auto" alt="Euro Trophy">`;
    if (isCopa)
      return `<img src="/img/trophy-copa-america.png" class="trn-trophy-img trn-trophy-ani${isRv ? ' trn-trophy-ani-rv' : ''}" style="width:${sz};height:auto" alt="Copa America Trophy">`;
    if (isLibt)
      return `<img src="/img/trophy-libertadores.png" class="trn-trophy-img trn-trophy-ani${isRv ? ' trn-trophy-ani-rv' : ''}" style="width:${sz};height:auto" alt="Libertadores Trophy">`;

    // ── UCL "Big-Ears" ──────────────────────────────────────
    if (isUCL) return `<svg class="trn-trophy-svg" viewBox="0 0 80 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${p}a" x1="14" y1="30" x2="66" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffe878"/><stop offset="42%" stop-color="#c8a020"/><stop offset="100%" stop-color="#7a5800"/>
        </linearGradient>
        <linearGradient id="${p}b" x1="40" y1="60" x2="40" y2="102" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#d4a818"/><stop offset="100%" stop-color="#8a6000"/>
        </linearGradient>
        <linearGradient id="${p}c" x1="14" y1="91" x2="66" y2="91" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#9a7408"/><stop offset="45%" stop-color="#e0ba28"/><stop offset="100%" stop-color="#9a7408"/>
        </linearGradient>
      </defs>
      <!-- Base -->
      <rect x="23" y="100" width="34" height="6" rx="1" fill="#7a5800"/>
      <rect x="16" y="90" width="48" height="11" rx="2" fill="url(#${p}c)"/>
      <rect x="24" y="81" width="32" height="10" rx="2" fill="#c8a020"/>
      <!-- Stem -->
      <rect x="35" y="62" width="10" height="20" rx="3" fill="url(#${p}b)"/>
      <ellipse cx="40" cy="62" rx="7" ry="2" fill="#9a7808"/>
      <!-- Cup body -->
      <path d="M18 33 Q13 51 15 63 Q21 75 40 77 Q59 75 65 63 Q67 51 62 33 Z" fill="url(#${p}a)" stroke="#8a6000" stroke-width=".8"/>
      <!-- Left big ear — three layered arcs for depth -->
      <path d="M19 42 Q1 42 1 54 Q1 66 19 66" fill="none" stroke="#7a5800" stroke-width="12" stroke-linecap="round"/>
      <path d="M19 42 Q4 42 4 54 Q4 66 19 66"  fill="none" stroke="#b89010" stroke-width="9"  stroke-linecap="round"/>
      <path d="M19 42 Q9 42 9 54 Q9 66 19 66"   fill="none" stroke="#d4a820" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M19 42 Q13 42 13 54 Q13 66 19 66" fill="none" stroke="#ead040" stroke-width="2"   stroke-linecap="round"/>
      <!-- Right big ear -->
      <path d="M61 42 Q79 42 79 54 Q79 66 61 66" fill="none" stroke="#7a5800" stroke-width="12" stroke-linecap="round"/>
      <path d="M61 42 Q76 42 76 54 Q76 66 61 66"  fill="none" stroke="#b89010" stroke-width="9"  stroke-linecap="round"/>
      <path d="M61 42 Q71 42 71 54 Q71 66 61 66"   fill="none" stroke="#d4a820" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M61 42 Q67 42 67 54 Q67 66 61 66"    fill="none" stroke="#ead040" stroke-width="2"   stroke-linecap="round"/>
      <!-- Rim -->
      <ellipse cx="40" cy="33" rx="22" ry="5.5" fill="#d0a820" stroke="#8a6000" stroke-width=".8"/>
      <path d="M21 32 Q40 28 59 32" stroke="rgba(255,240,80,.45)" stroke-width="2" fill="none"/>
      <!-- Reflection -->
      <path d="M23 44 Q21 57 22 65" stroke="rgba(255,255,255,.36)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- Star on rim -->
      <polygon points="40,21 42,27 48.5,27 43.3,31 45.3,37 40,33 34.7,37 36.7,31 31.5,27 38,27" fill="#fff8c0" opacity=".92"/>
    </svg>`;

    // ── FIFA World Cup ──────────────────────────────────────
    if (isWC) return `<svg class="trn-trophy-svg" viewBox="0 0 80 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="${p}a" cx="32" cy="10" r="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fff0a0"/><stop offset="50%" stop-color="#c8a020"/><stop offset="100%" stop-color="#8a6000"/>
        </radialGradient>
        <linearGradient id="${p}b" x1="40" y1="20" x2="40" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#e0b828"/><stop offset="100%" stop-color="#885e00"/>
        </linearGradient>
        <linearGradient id="${p}c" x1="14" y1="91" x2="66" y2="91" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#9a7408"/><stop offset="45%" stop-color="#e0ba28"/><stop offset="100%" stop-color="#9a7408"/>
        </linearGradient>
      </defs>
      <!-- Base -->
      <rect x="14" y="100" width="52" height="6" rx="1.5" fill="#7a5800"/>
      <rect x="18" y="90" width="44" height="11" rx="2" fill="url(#${p}c)"/>
      <rect x="24" y="81" width="32" height="10" rx="2.5" fill="#c8a020"/>
      <!-- Column (tapered) -->
      <path d="M34 52 L27 81 L53 81 L46 52 Z" fill="#9a7808"/>
      <path d="M36 52 L30 81 L50 81 L44 52 Z" fill="#c8a020"/>
      <path d="M38 52 L35 81 L45 81 L42 52 Z" fill="rgba(255,220,60,.18)"/>
      <!-- Left figure: torso + arm reaching up -->
      <path d="M34 52 Q26 46 21 35 Q17 25 22 18 Q27 11 33 20 Q37 28 37 37 L37 52 Z" fill="url(#${p}b)" stroke="#7a5800" stroke-width=".6"/>
      <!-- Left arm highlight -->
      <path d="M25 38 Q24 29 27 22" stroke="rgba(255,225,70,.48)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Right figure: torso + arm reaching up -->
      <path d="M46 52 Q54 46 59 35 Q63 25 58 18 Q53 11 47 20 Q43 28 43 37 L43 52 Z" fill="url(#${p}b)" stroke="#7a5800" stroke-width=".6"/>
      <!-- Right arm highlight -->
      <path d="M55 38 Q56 29 53 22" stroke="rgba(255,225,70,.48)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Globe -->
      <circle cx="40" cy="18" r="17" fill="url(#${p}a)" stroke="#8a6000" stroke-width="1.2"/>
      <!-- Latitude lines -->
      <ellipse cx="40" cy="18" rx="17" ry="6.5" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".9"/>
      <ellipse cx="40" cy="18" rx="17" ry="12.5" fill="none" stroke="rgba(255,255,255,.14)" stroke-width=".9"/>
      <!-- Meridian -->
      <line x1="40" y1="1" x2="40" y2="35" stroke="rgba(255,255,255,.14)" stroke-width=".9"/>
      <!-- Globe highlight -->
      <path d="M27 8 Q24 13 24 18" stroke="rgba(255,255,255,.6)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`;

    // ── Generic Copa / Liga ─────────────────────────────────
    return `<svg class="trn-trophy-svg" viewBox="0 0 80 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${p}a" x1="12" y1="26" x2="68" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffe878"/><stop offset="44%" stop-color="#c8a020"/><stop offset="100%" stop-color="#7a5800"/>
        </linearGradient>
        <linearGradient id="${p}c" x1="12" y1="91" x2="68" y2="91" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#9a7408"/><stop offset="45%" stop-color="#e0ba28"/><stop offset="100%" stop-color="#9a7408"/>
        </linearGradient>
      </defs>
      <!-- Base -->
      <rect x="18" y="100" width="44" height="6" rx="1.5" fill="#7a5800"/>
      <rect x="14" y="89" width="52" height="12" rx="2" fill="url(#${p}c)"/>
      <rect x="21" y="80" width="38" height="10" rx="2" fill="#c8a020"/>
      <!-- Stem -->
      <rect x="33" y="62" width="14" height="20" rx="4" fill="#b89010"/>
      <ellipse cx="40" cy="62" rx="9" ry="2.5" fill="#9a7808"/>
      <!-- Cup body (taller classic cup) -->
      <path d="M15 28 Q10 47 12 62 Q18 75 40 77 Q62 75 68 62 Q70 47 65 28 Z" fill="url(#${p}a)" stroke="#8a6000" stroke-width=".8"/>
      <!-- Left handle — three layers -->
      <path d="M16 38 Q2 38 2 54 Q2 69 16 69"  fill="none" stroke="#7a5800" stroke-width="11" stroke-linecap="round"/>
      <path d="M16 38 Q6 38 6 54 Q6 69 16 69"   fill="none" stroke="#b89010" stroke-width="7.5" stroke-linecap="round"/>
      <path d="M16 38 Q10 38 10 54 Q10 69 16 69"  fill="none" stroke="#d4a820" stroke-width="4"   stroke-linecap="round"/>
      <path d="M16 38 Q13 38 13 54 Q13 69 16 69"   fill="none" stroke="#ead040" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Right handle -->
      <path d="M64 38 Q78 38 78 54 Q78 69 64 69"  fill="none" stroke="#7a5800" stroke-width="11" stroke-linecap="round"/>
      <path d="M64 38 Q74 38 74 54 Q74 69 64 69"   fill="none" stroke="#b89010" stroke-width="7.5" stroke-linecap="round"/>
      <path d="M64 38 Q70 38 70 54 Q70 69 64 69"   fill="none" stroke="#d4a820" stroke-width="4"   stroke-linecap="round"/>
      <path d="M64 38 Q67 38 67 54 Q67 69 64 69"    fill="none" stroke="#ead040" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Rim -->
      <ellipse cx="40" cy="28" rx="25" ry="5.5" fill="#d4a820" stroke="#8a6000" stroke-width=".8"/>
      <path d="M17 27 Q40 23 63 27" stroke="rgba(255,240,80,.45)" stroke-width="2" fill="none"/>
      <!-- Reflection -->
      <path d="M20 40 Q18 54 19 64" stroke="rgba(255,255,255,.34)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- Star -->
      <polygon points="40,17 42,23.5 49,23.5 43.6,27.5 45.6,34 40,30.5 34.4,34 36.4,27.5 31,23.5 38,23.5" fill="#fff8c0" opacity=".92"/>
    </svg>`;
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
    // Inject format-specific trophy
    const trophyRevEl = el.querySelector('.trn-reveal-trophy');
    if (trophyRevEl) trophyRevEl.innerHTML = _trophySVG(data.format, 'rv');
    const badge = _badge(data.champion?.slug);
    const imgEl = $('trn-reveal-badge');
    if (imgEl) { imgEl.src = badge || '/img/badges/_placeholder.svg'; }
    const nameEl = $('trn-reveal-name');
    if (nameEl) nameEl.textContent = data.champion?.name || '—';
    const fmtEl = $('trn-reveal-format');
    if (fmtEl) fmtEl.textContent =
      data.format === 'liga' ? t('trn-reveal-liga') :
      (data.format === 'copa' && data.copaMode === 'groups') ? t('trn-reveal-copa-groups') :
      data.format === 'copa' ? t('trn-reveal-copa') :
      data.format === 'ucl-league' ? 'Champions League 2025/26' :
      _activePreset === 'wc2026'          ? 'FIFA World Cup 2026' :
      _activePreset === 'euro2024'        ? 'UEFA Euro 2024' :
      _activePreset === 'copamerica2024'  ? 'Copa América 2024' :
      _activePreset === 'libertadores2025'? 'Copa Libertadores 2026' :
      t('trn-reveal-champions');
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
    if (!rounds || !rounds.length) return `<p style="color:var(--grey);padding:1rem">${t('trn-col-sin-datos')}</p>`;
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
    const ROUND_LABELS = {
      2: t('trn-round-final'), 4: t('trn-round-semi'), 8: t('trn-round-qf'),
      16: t('trn-round-r16'), 32: t('trn-round-r32'), 64: t('trn-round-r64')
    };

    // Use pre-generated draw if available, otherwise shuffle now
    let bracket = (_draw.length === _numTeams / 2)
      ? _draw.flatMap(m => [m.a, m.b])
      : [..._teams].sort(() => Math.random() - 0.5);
    const rounds = [];
    const totalRounds = Math.ceil(Math.log2(_numTeams));
    let roundsDone = 0;

    while (bracket.length > 1) {
      const n = bracket.length;
      const label = ROUND_LABELS[n] || `${t('trn-round-default')} (${n})`;
      _setProgress(`${t('trn-progress-ko')} — ${label}…`, 5 + Math.round((roundsDone / totalRounds) * 90));
      const isFinal = n === 2;
      const specs = [];

      for (let i = 0; i < n; i += 2) {
        const a = bracket[i], b = bracket[i + 1];
        if (_rules.idaVuelta && !isFinal) {
          // Two legs — each team plays at home once
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era, eraB: b.era, salt: n * 100 + i,       penalties: false, ovrA: a.ovr||null, ovrB: b.ovr||null, homeAdvantage: true });
          specs.push({ teamA: b.slug, teamB: a.slug, eraA: b.era, eraB: a.era, salt: n * 100 + i + 50, penalties: false, ovrA: b.ovr||null, ovrB: a.ovr||null, homeAdvantage: true });
        } else {
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era, eraB: b.era, salt: n * 100 + i, penalties: true, isFinal, ovrA: a.ovr||null, ovrB: b.ovr||null, homeAdvantage: !isFinal });
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
      _setProgress(t('trn-progress-3rd'), 97);
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
    const res = await _bulkSim([{ teamA: a.slug, teamB: b.slug, eraA: a.era, eraB: b.era, salt, penalties: true, ovrA: a.ovr||null, ovrB: b.ovr||null, homeAdvantage: false }]);
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

    // Build a proper round-robin schedule so each team plays once per matchday.
    // Algorithm: fix teams[0], rotate the rest each round.
    const buildRoundRobin = (arr) => {
      const t = arr.length % 2 === 0 ? [...arr] : [...arr, null]; // null = bye
      const m = t.length;
      const rounds = [];
      for (let r = 0; r < m - 1; r++) {
        const round = [];
        for (let i = 0; i < m / 2; i++) {
          const a = t[i], b = t[m - 1 - i];
          if (a && b) round.push({ a, b });
        }
        rounds.push(round);
        const last = t.pop();
        t.splice(1, 0, last); // rotate keeping t[0] fixed
      }
      return rounds;
    };

    const homeRounds = buildRoundRobin(teams);
    const allRounds = _rules.idaVuelta
      ? [...homeRounds, ...homeRounds.map(r => r.map(m => ({ a: m.b, b: m.a })))]
      : homeRounds;

    // Flatten into fixtures preserving jornada index (1-based)
    const fixtures = allRounds.flatMap((round, ri) =>
      round.map(m => ({ a: m.a, b: m.b, jornada: ri + 1 }))
    );

    const BATCH = 50;
    for (let b = 0; b < fixtures.length; b += BATCH) {
      const chunk = fixtures.slice(b, b + BATCH);
      _setProgress(`${t('trn-progress-league')} (${Math.min(b + BATCH, fixtures.length)} / ${fixtures.length})`, 5 + Math.round(b / fixtures.length * 90));
      const specs = chunk.map((f, i) => ({
        teamA: f.a.slug, teamB: f.b.slug, eraA: f.a.era, eraB: f.b.era, salt: b + i + 9000, penalties: false,
        ovrA: f.a.ovr || null, ovrB: f.b.ovr || null,
        homeAdvantage: true,  // team A is always “home” in this fixture
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

  // ── UCL LEAGUE PHASE — fixture generator ─────────────────
  // 4 pots of equal size; each team plays 2 per pot (1H, 1A) → 8 games total
  function _generateUCLLeagueFixtures(pots) {
    const _shu = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=0|Math.random()*(i+1);[b[i],b[j]]=[b[j],b[i]];}return b; };
    const fixtures = [];
    for (let pi = 0; pi < 4; pi++) {
      for (let pj = pi; pj < 4; pj++) {
        const A = _shu([...pots[pi]]);
        const B = _shu([...pots[pj]]);
        if (pi === pj) {
          // Within-pot ring: 9 matches, each team 1H + 1A
          for (let k = 0; k < A.length; k++)
            fixtures.push({ home: A[k], away: A[(k+1) % A.length] });
        } else {
          // Cross-pot: 2 rounds via shift → 18 matches
          for (let k = 0; k < A.length; k++) {
            fixtures.push({ home: A[k], away: B[k] });
            fixtures.push({ home: B[k], away: A[(k+1) % A.length] });
          }
        }
      }
    }
    return fixtures; // 144 matches: 36 within-pot + 108 cross-pot
  }

  // ── UCL 2025/26 LEAGUE PHASE SIMULATION ──────────────────
  async function _simulateUCLLeaguePhase() {
    // Build 4 pots from _UCL_POTS → map to loaded _teams
    const pots = _UCL_POTS.map(pot =>
      pot.teams.map(pt => _teams.find(t => t.slug === pt.slug) || { slug: pt.slug, era: '2025', name: pt.name, ovr: null })
    );

    // Generate or reuse pre-drawn fixtures
    const fixtures = _uclFixtures || _generateUCLLeagueFixtures(pots);

    // Build table
    const tableMap = {};
    _teams.forEach(t => { tableMap[t.slug] = { ...t, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 }; });

    // Simulate all 144 matches in batches
    const BATCH = 36;
    const allFx = [];
    for (let b = 0; b < fixtures.length; b += BATCH) {
      const chunk = fixtures.slice(b, b + BATCH);
      _setProgress(`Fase de Liga… (${b+chunk.length}/${fixtures.length})`, 5 + Math.round((b/fixtures.length)*50));
      const specs = chunk.map((f, i) => ({
        teamA: f.home.slug, teamB: f.away.slug,
        eraA: f.home.era||'', eraB: f.away.era||'',
        salt: 1000 + b + i, penalties: false, homeAdvantage: true,
        ovrA: f.home.ovr||null, ovrB: f.away.ovr||null,
      }));
      const res = await _bulkSim(specs);
      chunk.forEach((f, i) => {
        const r = res[i];
        f.scoreA = r.scoreA; f.scoreB = r.scoreB;
        f.scorersA = r.scorersA||[]; f.scorersB = r.scorersB||[];
        f.mom = r.mom||null; f.stats = r.stats||null;
        f.a = f.home; f.b = f.away; // align with match card / stats expectations
        const rH = tableMap[f.home.slug];
        const rA = tableMap[f.away.slug];
        if (!rH || !rA) return;
        rH.p++; rA.p++;
        rH.gf += r.scoreA; rH.ga += r.scoreB;
        rA.gf += r.scoreB; rA.ga += r.scoreA;
        if      (r.scoreA > r.scoreB) { rH.w++; rH.pts+=3; rA.l++; }
        else if (r.scoreA < r.scoreB) { rA.w++; rA.pts+=3; rH.l++; }
        else                           { rH.d++; rA.d++; rH.pts++; rA.pts++; }
      });
      allFx.push(...chunk);
    }

    // Sort table: pts > gd > gf
    const leagueTable = Object.values(tableMap).sort((a,b) =>
      b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf
    );
    leagueTable.forEach((r,i) => {
      r.pos    = i+1;
      r.status = i < 8 ? 'direct' : i < 24 ? 'playoff' : 'out';
    });

    // ── Playoff (ranks 9-24): seeded 9-16 host 2nd leg, unseeded 17-24 host 1st leg
    _setProgress('Play-In…', 58);
    const seeded   = leagueTable.slice(8,  16);    // 9-16
    const unseeded = leagueTable.slice(16, 24);   // 17-24
    // Pair: seed 9 vs seed 24, seed 10 vs seed 23, ...
    const playoffPairs = seeded.map((s, i) => ({ a: unseeded[7-i], b: s }));
    const playoffSpecs = playoffPairs.flatMap((p, i) => [
      { teamA: p.a.slug, teamB: p.b.slug, eraA: p.a.era||'', eraB: p.b.era||'', salt: 5000+i, penalties: false, homeAdvantage: true, ovrA: p.a.ovr||null, ovrB: p.b.ovr||null },
      { teamA: p.b.slug, teamB: p.a.slug, eraA: p.b.era||'', eraB: p.a.era||'', salt: 5100+i, penalties: false, homeAdvantage: true, ovrA: p.b.ovr||null, ovrB: p.a.ovr||null },
    ]);
    const playoffRes = await _bulkSim(playoffSpecs);
    const playoffMatches = [], playoffWinners = [];
    for (let i = 0; i < playoffPairs.length; i++) {
      const { a, b } = playoffPairs[i];
      const r1 = playoffRes[i*2], r2 = playoffRes[i*2+1];
      const aggA = r1.scoreA + r2.scoreB;
      const aggB = r1.scoreB + r2.scoreA;
      let winner, penA = null, penB = null;
      if      (aggA > aggB) winner = a;
      else if (aggB > aggA) winner = b;
      else {
        const pen = await _bulkSim([{ teamA: a.slug, teamB: b.slug, eraA: a.era||'', eraB: b.era||'', salt: 5200+i, penalties: true, homeAdvantage: false }]);
        penA = pen[0].penA; penB = pen[0].penB;
        winner = (penA||0) >= (penB||0) ? a : b;
      }
      playoffMatches.push({ a, b, r1, r2, aggA, aggB, penA, penB, winner, legs: 2 });
      playoffWinners.push(winner);
    }
    const playoffRound = { label: 'Play-In', matches: playoffMatches };

    // ── Round of 16: top 8 direct + 8 playoff winners
    _setProgress('Octavos de final…', 67);
    // Seeded (1-8) vs unseeded (playoff winners) — no same-team clash
    const direct = leagueTable.slice(0, 8);
    const r16Bracket = [];
    const pwShuffle = [...playoffWinners].sort(() => Math.random() - 0.5);
    // Alternate: direct[0], pwShuffle[0], direct[1], pwShuffle[1]...
    for (let i = 0; i < 8; i++) { r16Bracket.push(direct[i]); r16Bracket.push(pwShuffle[i]); }

    const koData = await _simulateCopa_internal(r16Bracket, { idaVuelta: true, startPct: 67 });

    return {
      format: 'ucl-league',
      champion: koData.champion,
      leagueTable,
      leagueMatches: allFx,
      playoffRound,
      koRounds: koData.rounds,
      teams: _teams,
    };
  }

  // ── HISTORICAL WORLD CUP — routes to correct sim by format ────────────
  async function _simulateHistoricalWC() {
    const edsMap = (typeof _WC_EDITIONS !== 'undefined') ? _WC_EDITIONS : {};
    const ed     = _wcHistoricalYear ? edsMap[_wcHistoricalYear] : null;
    const fmt    = ed ? ed.format : 'groups32_ko';
    // knockout16 (1934, 1938): pure knockout tournament — no group stage
    if (fmt === 'knockout16') return _simulateCopa();
    // groups_semifinal (1930): 4 groups, winner of each → semis directly
    if (fmt === 'groups_semifinal') return _simulateGroupsSemifinal();
    // groups24_ko (1982-1994): 6 groups + best 4 thirds → 16 team R16
    if (fmt === 'groups24_ko') return _simulateEuro2024();
    // all other formats (16-team or 32-team groups KO): standard champions sim
    return _simulateChampions();
  }

  // ── GROUPS → SEMIFINAL (1930 format) ─────────────────────
  // 4 groups of 3-4 teams. Winner of each group → 4 semis directly (no R16/QF).
  async function _simulateGroupsSemifinal() {
    const groups = _groupsDraw.length > 0 ? _groupsDraw : (() => {
      const s = [..._teams].sort(() => Math.random() - 0.5);
      return [s.slice(0, 4), s.slice(4, 7), s.slice(7, 10), s.slice(10)];
    })();

    // Group stage
    const totalGroups = groups.length;
    const groupData = [];
    for (let g = 0; g < groups.length; g++) {
      _setProgress(`${t('trn-progress-groups')} (${g + 1}/${totalGroups})`, 5 + Math.round((g / totalGroups) * 50));
      const grp = groups[g];
      const table = grp.map(tm => ({ ...tm, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
      const idxG = {};
      table.forEach((r, i) => { idxG[r.slug] = i; });
      const fixtures = [];
      for (let i = 0; i < grp.length; i++)
        for (let j = i + 1; j < grp.length; j++)
          fixtures.push({ a: grp[i], b: grp[j] });
      const res = await _bulkSim(fixtures.map((f, i) => ({
        teamA: f.a.slug, teamB: f.b.slug, eraA: f.a.era || '', eraB: f.b.era || '',
        salt: (g + 1) * 300 + i, penalties: false, ovrA: f.a.ovr || null, ovrB: f.b.ovr || null, homeAdvantage: true,
      })));
      fixtures.forEach((f, i) => {
        const r = res[i];
        f.scoreA = r.scoreA; f.scoreB = r.scoreB;
        f.scorersA = r.scorersA || []; f.scorersB = r.scorersB || [];
        f.mom = r.mom || null; f.stats = r.stats || null;
        const rA = table[idxG[f.a.slug]], rB = table[idxG[f.b.slug]];
        rA.p++; rB.p++; rA.gf += r.scoreA; rA.ga += r.scoreB; rB.gf += r.scoreB; rB.ga += r.scoreA;
        if (r.scoreA > r.scoreB) { rA.w++; rA.pts += 2; rB.l++; }
        else if (r.scoreA < r.scoreB) { rB.w++; rB.pts += 2; rA.l++; }
        else { rA.d++; rB.d++; rA.pts++; rB.pts++; }
      });
      table.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      groupData.push({ label: `Grupo ${g + 1}`, table, matches: fixtures });
    }

    // 4 group winners → 2 semi-finals
    _setProgress(t('trn-progress-ko'), 60);
    const winners = groupData.map(g => g.table[0]);
    // SF: G1 winner vs G2 winner, G3 winner vs G4 winner (historical: Arg vs USA, Uru vs Yug)
    const koData = await _simulateCopa_internal(winners, { idaVuelta: false, startPct: 62 });

    return { format: 'champions', champion: koData.champion, groups: groupData, koRounds: koData.rounds, teams: _teams };
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
      _setProgress(`${t('trn-progress-groups')} (${g + 1}/${totalGroups})`, grpPct);
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
        ovrA: f.a.ovr || null, ovrB: f.b.ovr || null,
        homeAdvantage: true,  // team A is always “home” in this fixture
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
      groupData.push({ label: `${t('trn-draw-group-prefix')}${String.fromCharCode(65 + g)}`, table, matches: grpFixtures });
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

    _setProgress(t('trn-progress-ko'), 62);
    // Reuse copa logic for KO rounds
    const koData = await _simulateCopa_internal(seededKO, { idaVuelta: _rules.koIdaVuelta, startPct: 62 });

    return { format: 'champions', champion: koData.champion, groups: groupData, koRounds: koData.rounds, teams: _teams };
  }

  // ── WORLD CUP 2026 — 48 teams, 12 groups → 32 team KO bracket ───────────
  // Format: 12 groups of 4. Top 2 from each group (24) + 8 best 3rd-placed = 32
  // KO: R32 → R16 → QF → SF → 3rd place → Final. Single-leg, ET+pen.
  async function _simulateWC2026() {
    const GRP_SIZE = 4;
    const groups = _groupsDraw.length > 0 ? _groupsDraw : (() => {
      const s = [..._teams].sort(() => Math.random() - 0.5);
      return Array.from({ length: Math.ceil(s.length / GRP_SIZE) }, (_, g) => s.slice(g * GRP_SIZE, (g + 1) * GRP_SIZE));
    })();

    // ── Group stage ───────────────────────────────────────────────────────
    const totalGroups = groups.length;
    const groupData   = [];

    for (let g = 0; g < groups.length; g++) {
      const grpPct = 5 + Math.round((g / totalGroups) * 55);
      _setProgress(`${t('trn-progress-groups')} (${g + 1}/${totalGroups})`, grpPct);
      const grp   = groups[g];
      const table = grp.map(tm => ({ ...tm, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
      const idxG  = {};
      table.forEach((r, i) => { idxG[r.slug] = i; });

      const grpFixtures = [];
      for (let i = 0; i < grp.length; i++)
        for (let j = i + 1; j < grp.length; j++)
          grpFixtures.push({ a: grp[i], b: grp[j] });

      const specs = grpFixtures.map((f, i) => ({
        teamA: f.a.slug, teamB: f.b.slug,
        eraA: f.a.era || '', eraB: f.b.era || '',
        salt: (g + 1) * 300 + i, penalties: false,
        ovrA: f.a.ovr || null, ovrB: f.b.ovr || null,
        homeAdvantage: false,
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
        if      (r.scoreA > r.scoreB) { rA.w++; rA.pts += 3; rB.l++; }
        else if (r.scoreA < r.scoreB) { rB.w++; rB.pts += 3; rA.l++; }
        else                          { rA.d++; rB.d++; rA.pts++; rB.pts++; }
      });
      table.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      // Stamp group label on each row (used for bracket display)
      const grpLabel = String.fromCharCode(65 + g);
      table.forEach((r, i) => { r._grp = grpLabel; r._grpPos = i; });
      groupData.push({ label: `${t('trn-draw-group-prefix')}${grpLabel}`, table, matches: grpFixtures });
    }

    // ── Collect 32 qualifiers ─────────────────────────────────────────────
    const groupWinners = groupData.map(g => g.table[0]);   // 12
    const groupRunners = groupData.map(g => g.table[1]);   // 12
    // Rank all 3rd-placed teams by pts > GD > GF, take best 8
    const thirds = groupData.map(g => g.table[2])
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const bestThirds  = thirds.slice(0, 8);   // 8
    // thirds 9-12 are eliminated
    thirds.slice(8).forEach(t => { t.status = 'out'; });

    // Mark statuses for group table coloring
    groupWinners.forEach(t  => { t.status = 'direct'; });
    groupRunners.forEach(t  => { t.status = 'direct'; });
    thirds.slice(0, 8).forEach(t => { t.status = 'playoff'; });  // best thirds → advance
    thirds.slice(8).forEach(t   => { t.status = 'out'; });
    groupData.forEach(g => { if (g.table[3]) g.table[3].status = 'out'; });

    // ── Build R32 bracket (seeded: winners don't face each other in round 1) ──
    // 12 winners vs 12 opponents drawn from runners∪thirds
    // remaining 8 teams (all from runners∪thirds) pair among themselves
    const shuffledWinners  = [...groupWinners].sort(() => Math.random() - 0.5);
    const shuffledOthers   = [...groupRunners, ...bestThirds].sort(() => Math.random() - 0.5);
    const winnersOpponents = shuffledOthers.slice(0, 12);
    const remainingOthers  = shuffledOthers.slice(12);   // 8 teams

    _setProgress(t('trn-progress-ko'), 65);
    const r32 = [];
    for (let i = 0; i < 12; i++) r32.push(shuffledWinners[i], winnersOpponents[i]);
    for (let i = 0; i < 8;  i += 2) r32.push(remainingOthers[i], remainingOthers[i + 1]);

    const koData = await _simulateCopa_internal(r32, { idaVuelta: false, startPct: 65 });

    return {
      format:     'champions',
      champion:   koData.champion,
      groups:     groupData,
      koRounds:   koData.rounds,
      thirdPlace: koData.thirdPlace || null,
      teams:      _teams,
    };
  }

  // ── UEFA Euro / Copa América — groups → top 2 + best thirds → KO ────────
  // Euro: 6 groups → top 2 (12) + 4 best thirds = 16 teams (R16)
  // Copa Am: 4 groups → top 2 (8) per QF directly (handled by _simulateChampions)
  async function _simulateEuro2024() {
    const GRP_SIZE = 4;
    const groups = _groupsDraw.length > 0 ? _groupsDraw : (() => {
      const s = [..._teams].sort(() => Math.random() - 0.5);
      return Array.from({ length: Math.ceil(s.length / GRP_SIZE) }, (_, g) => s.slice(g * GRP_SIZE, (g + 1) * GRP_SIZE));
    })();

    const totalGroups = groups.length;
    const groupData   = [];

    for (let g = 0; g < groups.length; g++) {
      const grpPct = 5 + Math.round((g / totalGroups) * 55);
      _setProgress(`${t('trn-progress-groups')} (${g + 1}/${totalGroups})`, grpPct);
      const grp   = groups[g];
      const table = grp.map(tm => ({ ...tm, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
      const idxG  = {};
      table.forEach((r, i) => { idxG[r.slug] = i; });
      const grpFixtures = [];
      for (let i = 0; i < grp.length; i++)
        for (let j = i + 1; j < grp.length; j++)
          grpFixtures.push({ a: grp[i], b: grp[j] });
      const specs = grpFixtures.map((f, i) => ({
        teamA: f.a.slug, teamB: f.b.slug, eraA: f.a.era || '', eraB: f.b.era || '',
        salt: (g + 1) * 300 + i, penalties: false, ovrA: f.a.ovr || null, ovrB: f.b.ovr || null, homeAdvantage: false,
      }));
      const res = await _bulkSim(specs);
      grpFixtures.forEach((f, i) => {
        const r = res[i];
        f.scoreA = r.scoreA; f.scoreB = r.scoreB;
        f.scorersA = r.scorersA || []; f.scorersB = r.scorersB || [];
        f.mom = r.mom || null; f.stats = r.stats || null;
        const rA = table[idxG[f.a.slug]], rB = table[idxG[f.b.slug]];
        rA.p++; rB.p++;
        rA.gf += r.scoreA; rA.ga += r.scoreB;
        rB.gf += r.scoreB; rB.ga += r.scoreA;
        if      (r.scoreA > r.scoreB) { rA.w++; rA.pts += 3; rB.l++; }
        else if (r.scoreA < r.scoreB) { rB.w++; rB.pts += 3; rA.l++; }
        else                          { rA.d++; rB.d++; rA.pts++; rB.pts++; }
      });
      table.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const grpLabel = String.fromCharCode(65 + g);
      table.forEach((r, i) => { r._grp = grpLabel; r._grpPos = i; });
      groupData.push({ label: `${t('trn-draw-group-prefix')}${grpLabel}`, table, matches: grpFixtures });
    }

    // Collect qualifiers: top 2 from each group + 4 best thirds
    const groupWinners = groupData.map(g => g.table[0]);
    const groupRunners = groupData.map(g => g.table[1]);
    const thirds = groupData.map(g => g.table[2])
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const bestThirds = thirds.slice(0, 4);
    thirds.slice(4).forEach(t  => { t.status = 'out'; });
    groupWinners.forEach(t  => { t.status = 'direct'; });
    groupRunners.forEach(t  => { t.status = 'direct'; });
    bestThirds.forEach(t    => { t.status = 'playoff'; });
    groupData.forEach(g     => { if (g.table[3]) g.table[3].status = 'out'; });

    // Build R16 bracket: 6 winners vs 6 runners, 4 thirds paired vs remaining runners/winners
    const shuffledWinners  = [...groupWinners].sort(() => Math.random() - 0.5);
    const shuffledRunners  = [...groupRunners].sort(() => Math.random() - 0.5);
    const shuffledThirds   = [...bestThirds].sort(() => Math.random() - 0.5);
    // Pair winners vs runners for 6 matches, then mix thirds
    const r16 = [];
    for (let i = 0; i < 6; i++) r16.push(shuffledWinners[i], shuffledRunners[i]);
    // Add 4 thirds as extra pairs (they'll play each other, seeded into bracket)
    // To make 16, pair 4 thirds: 2 extra matches against 2 remaining runners
    // Simple approach: append in shuffled order; _simulateCopa_internal handles odd bracket
    for (let i = 0; i < shuffledThirds.length; i++) r16.push(shuffledThirds[i]);

    _setProgress(t('trn-progress-ko'), 65);
    const koData = await _simulateCopa_internal(r16, { idaVuelta: false, startPct: 65 });

    return {
      format:     'champions',
      champion:   koData.champion,
      groups:     groupData,
      koRounds:   koData.rounds,
      thirdPlace: koData.thirdPlace || null,
      teams:      _teams,
    };
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
    const ROUND_LABELS = {
      2: t('trn-round-final'), 4: t('trn-round-semi'), 8: t('trn-round-qf'),
      16: t('trn-round-r16'), 32: t('trn-round-r32'), 64: t('trn-round-r64')
    };
    let bracket = [...teamList];
    const rounds = [];

    // ── Handle non-power-of-2 bracket sizes with a play-in round ──────────
    const _isPow2 = n => n > 0 && (n & (n - 1)) === 0;
    if (!_isPow2(bracket.length) && bracket.length > 1) {
      const n = bracket.length;
      const prevPow2 = Math.pow(2, Math.floor(Math.log2(n)));
      const playInCount = (n - prevPow2) * 2;  // these teams compete in play-in
      const byeTeams = bracket.slice(0, n - playInCount);         // top seeds get byes
      const playInTeams = bracket.slice(n - playInCount);        // bottom seeds play in
      _setProgress(`${t('trn-progress-ko')} — play-in…`, startPct);
      const specs = [];
      for (let i = 0; i < playInTeams.length; i += 2) {
        const a = playInTeams[i], b = playInTeams[i + 1];
        specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era||'', eraB: b.era||'', salt: 9999+i, penalties: true, ovrA: a.ovr||null, ovrB: b.ovr||null, homeAdvantage: false });
      }
      const results = await _bulkSim(specs);
      const playInWinners = [];
      const playInMatches = [];
      for (let i = 0; i < playInTeams.length; i += 2) {
        const a = playInTeams[i], b = playInTeams[i + 1];
        const r = results[i / 2];
        const winner = (r.scoreA + (r.penA||0)) >= (r.scoreB + (r.penB||0)) ? a : b;
        playInMatches.push({ a, b, scoreA: r.scoreA, scoreB: r.scoreB, penA: r.penA, penB: r.penB, scorersA: r.scorersA||[], scorersB: r.scorersB||[], mom: r.mom||null, stats: r.stats||null, winner, legs: 1 });
        playInWinners.push(winner);
      }
      rounds.push({ label: 'Play-in', matches: playInMatches });
      bracket = [...byeTeams, ...playInWinners];
    }
    // ──────────────────────────────────────────────────────────────────────

    const totalRounds = Math.ceil(Math.log2(bracket.length));
    let roundsDone = 0;

    while (bracket.length > 1) {
      const n = bracket.length;
      const label = ROUND_LABELS[n] || `${t('trn-round-default')} ${n}`;
      const isFinal = n === 2;
      _setProgress(`${t('trn-progress-ko')} — ${label}…`, startPct + Math.round((roundsDone / totalRounds) * (90 - startPct)));
      const specs = [];

      for (let i = 0; i < n; i += 2) {
        const a = bracket[i], b = bracket[i + 1];
        if (idaVuelta && !isFinal) {
          // Each leg played at the home ground of team A then team B
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era||'', eraB: b.era||'', salt: n*100+i,    penalties: false, ovrA: a.ovr||null, ovrB: b.ovr||null, homeAdvantage: true });
          specs.push({ teamA: b.slug, teamB: a.slug, eraA: b.era||'', eraB: a.era||'', salt: n*100+i+50, penalties: false, ovrA: b.ovr||null, ovrB: a.ovr||null, homeAdvantage: true });
        } else {
          specs.push({ teamA: a.slug, teamB: b.slug, eraA: a.era||'', eraB: b.era||'', salt: n*500+i, penalties: true, isFinal, ovrA: a.ovr||null, ovrB: b.ovr||null, homeAdvantage: !isFinal });
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

    if (data.format === 'ucl-league') {
      // League phase: show champion's position + W/D/L record in 8 games
      const row = (data.leagueTable || []).find(r => r.slug === champSlug);
      if (row) {
        const leagueMatches = (data.leagueMatches || []).filter(m => m.home?.slug === champSlug || m.away?.slug === champSlug);
        leagueMatches.forEach(m => {
          const isHome = m.home?.slug === champSlug;
          const opp  = isHome ? m.away : m.home;
          const gfC  = isHome ? m.scoreA : m.scoreB;
          const gaC  = isHome ? m.scoreB : m.scoreA;
          path.push({ round: 'Fase de Liga', opp, gfC, gaC, result: gfC > gaC ? 'w' : gaC > gfC ? 'l' : 'd', legs: 1, penA: null });
        });
      }
      // Playoff if champion came through it
      if (data.playoffRound) {
        data.playoffRound.matches.forEach(m => {
          const isA = m.a?.slug === champSlug, isB = m.b?.slug === champSlug;
          if (!isA && !isB) return;
          const opp = isA ? m.b : m.a;
          path.push({ round: 'Playoff', opp, gfC: isA ? m.aggA : m.aggB, gaC: isA ? m.aggB : m.aggA,
            result: m.winner?.slug === champSlug ? 'w' : 'l', legs: 2, penA: m.penA, penB: m.penB, isA, aggA: m.aggA, aggB: m.aggB });
        });
      }
    } else if (data.format === 'champions' || (data.format === 'copa' && data.groups)) {
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
    return `<h3 class="trn-section-h trn-section-h-mt">🏆 Camino al t\u00edtulo</h3>
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
          <div class="trn-stat-card-label">${t('trn-stat-card-champ')}</div>
          <div class="trn-stat-card-value">${_esc(d.champion?.name || '—')}</div>
        </div>
        <div class="trn-stat-card trn-stat-card-pich">
          <div class="trn-stat-card-icon">⚽</div>
          <div class="trn-stat-card-label">${t('trn-stat-card-pich')}</div>
          <div class="trn-stat-card-value">${pichichi ? _esc(pichichi.name) : '—'}</div>
          ${pichichi ? `<div class="trn-stat-card-sub">${pichichi.goals} ${t('trn-stat-goals-unit')} × ${_esc(pichichi.team)}</div>` : ''}
        </div>
        <div class="trn-stat-card trn-stat-card-mvp">
          <div class="trn-stat-card-icon">⭐</div>
          <div class="trn-stat-card-label">${t('trn-stat-card-mvp')}</div>
          <div class="trn-stat-card-value">${mvp ? _esc(mvp.name) : '—'}</div>
          ${mvp ? `<div class="trn-stat-card-sub">${mvp.count}× MOM × ${_esc(mvp.team)}</div>` : ''}
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

  // ── Dashboard rendering ──────────────────────────────────
  function _renderDashboard() {
    if (!_data) return;

    // Hide wizard, show dashboard
    const wizard = $('trn-wizard');
    if (wizard) hide(wizard);
    show($('trn-dashboard'));

    // Inject format-specific trophy into poster
    const trophyEl = document.querySelector('.trn-champ-trophy-big');
    if (trophyEl) trophyEl.innerHTML = _trophySVG(_data.format, 'ps');

    // Champion poster
    const champ = _data.champion;
    const champBadge = _badge(champ?.slug);
    const champBadgeEl = $('trn-champ-badge-img');
    if (champBadgeEl) champBadgeEl.src = champBadge || '/img/badges/_placeholder.svg';
    $('trn-champ-name').textContent = champ?.name || '—';
    $('trn-champ-format').textContent =
      _data.format === 'liga' ? '🏆 Liga' :
      (_data.format === 'copa' && _data.copaMode === 'groups') ? '🏆 Copa × Grupos' :
      _data.format === 'copa' ? '🏆 Copa' :
      _data.format === 'ucl-league' ? '⭐ Champions League 2025/26' :
      (_activePreset === 'wc2026') ? '🌍 FIFA World Cup 2026' : '⭐ Champions';

    // Runner-up on poster
    const runnerUpEl = $('trn-champ-runnerup');
    if (runnerUpEl) {
      let ru = null;
      if (_data.format === 'copa' || _data.format === 'champions' || _data.format === 'ucl-league') {
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
    if (bracketTabBtn) {
      bracketTabBtn.textContent = _data.format === 'liga' ? t('trn-tab-bracket-liga') : t('trn-tab-bracket-ko');
      bracketTabBtn.dataset.trnFmt = _data.format;
    }

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

    if (d.format === 'ucl-league') {
      html = `<h3 class="trn-section-h">Fase de Liga — ${(d.leagueMatches||[]).length} partidos</h3>`;
      const lm = d.leagueMatches || [];
      const batchSize = 36;
      const numBatches = Math.ceil(lm.length / batchSize) || 1;
      for (let bi = 0; bi < numBatches; bi++) {
        const batch = lm.slice(bi * batchSize, (bi + 1) * batchSize);
        const openAttr = bi === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">Jornada ${bi + 1} <span class="trn-jornada-cnt">${batch.length}</span></summary>`;
        batch.forEach(m => { html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}`); });
        html += '</details>';
      }
      if (d.playoffRound?.matches?.length) {
        html += `<h3 class="trn-section-h trn-section-h-mt">🔵 Play-In (9-24)</h3>`;
        html += `<details class="trn-cal-jornada" open><summary class="trn-cal-jornada-label">Play-In <span class="trn-jornada-cnt">${d.playoffRound.matches.length}</span></summary>`;
        d.playoffRound.matches.forEach(m => {
          const penStr = m.penA != null ? ` (p: ${m.penA}–${m.penB})` : '';
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
        });
        html += '</details>';
      }
      if (d.koRounds?.length) {
        html += `<h3 class="trn-section-h trn-section-h-mt">⚽ Fase Eliminatoria</h3>`;
        [...d.koRounds].reverse().forEach((r, ri) => {
          const openAttr = ri === 0 ? ' open' : '';
          html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
          r.matches.forEach(m => {
            const penStr = m.penA != null ? ` (p: ${m.penA}–${m.penB})` : '';
            if (m.legs === 2) {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
            } else {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
            }
          });
          html += '</details>';
        });
      }
      el.innerHTML = html;
      return;
    }

    if (d.format === 'liga') {
      html = `<h3 class="trn-section-h">${t('trn-cal-calendar-liga')}</h3>`;
      const matches = d.matches || [];
      // Group by jornada property (set by round-robin scheduler)
      const byJornada = [];
      matches.forEach(m => {
        const j = (m.jornada || 1) - 1;
        if (!byJornada[j]) byJornada[j] = [];
        byJornada[j].push(m);
      });
      byJornada.forEach((jornada, ji) => {
        const jNum = ji + 1;
        const openAttr = jNum === 1 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${t('trn-cal-jornada')} ${jNum} <span class="trn-jornada-cnt">${jornada.length}</span></summary>`;
        jornada.forEach(m => {
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}`);
        });
        html += '</details>';
      });
    } else if (d.groups) {
      // Copa groups / champions — cls-table standings per group + collapsible matches
      html = `<h3 class="trn-section-h">${t('trn-cal-calendar-groups')}</h3>
        <div class="trn-cal-groups-grid">`;
      (d.groups || []).forEach((g) => {
        const podiumClass = ['trn-cls-pos-1', 'trn-cls-pos-2', '', ''];
        const posLabel = (i) => i < 2 ? ['🥇', '🥈'][i] : String(i + 1);
        const rows = g.table.map((r, i) => {
          const gd = (r.gf ?? 0) - (r.ga ?? 0);
          const gdStr = gd > 0 ? `+${gd}` : String(gd);
          const gdCls = gd > 0 ? 'trn-cls-dif-pos' : gd < 0 ? 'trn-cls-dif-neg' : 'trn-cls-dif-neu';
          return `<div class="trn-cls-row ${podiumClass[i] || ''}" style="--row-i:${i}">
            <span class="trn-cls-pos-cell">${posLabel(i)}</span>
            ${_badgeImg(r.slug, 'trn-cls-badge')}
            <span class="trn-cls-name">${_esc(_tLabel(r))}</span>
            <span class="trn-cls-num">${r.p ?? 0}</span>
            <span class="trn-cls-num">${r.w ?? 0}</span>
            <span class="trn-cls-num">${r.d ?? 0}</span>
            <span class="trn-cls-num">${r.l ?? 0}</span>
            <span class="trn-cls-num">${r.gf ?? 0}</span>
            <span class="trn-cls-num">${r.ga ?? 0}</span>
            <span class="trn-cls-num ${gdCls}">${gdStr}</span>
            <span class="trn-cls-pts-val">${r.pts}</span>
          </div>`;
        }).join('');
        const matchesHtml = g.matches.map(m =>
          _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}`)
        ).join('');
        html += `<div class="trn-cal-group-block">
          <div class="trn-cal-group-header">${_esc(g.label)}</div>
          <div class="trn-cls-wrap">
            <div class="trn-cls-table">
              <div class="trn-cls-header">
                <span>#</span><span></span><span>${t('trn-col-team')}</span>
                <span>${t('trn-col-pj-abbr')}</span><span>${t('trn-col-w-abbr')}</span><span>${t('trn-col-d-abbr')}</span><span>${t('trn-col-l-abbr')}</span>
                <span>${t('trn-col-gf-abbr')}</span><span>${t('trn-col-gc-abbr')}</span><span>${t('trn-col-dif')}</span><span>${t('trn-col-pts')}</span>
              </div>
              ${rows}
            </div>
          </div>
          <details class="trn-cal-grp-matches">
            <summary class="trn-cal-grp-matches-lbl">${t('trn-cal-matches-lbl')} <span class="trn-jornada-cnt">${g.matches.length}</span></summary>
            ${matchesHtml}
          </details>
        </div>`;
      });
      html += `</div>
        <h3 class="trn-section-h trn-section-h-mt">${t('trn-cal-calendar-ko')}</h3>`;
      [...(d.koRounds || [])].reverse().forEach((r, ri) => {
        const openAttr = ri === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          if (m.legs === 2) {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
          } else {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
          }
        });
        html += '</details>';
      });
    } else {
      // Copa KO mode
      html = `<h3 class="trn-section-h">${t('trn-cal-calendar-copa')}</h3>`;
      [...(d.rounds || [])].reverse().forEach((r, ri) => {
        const openAttr = ri === 0 ? ' open' : '';
        html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
        r.matches.forEach(m => {
          const penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
          if (m.legs === 2) {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
          } else {
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
          }
        });
        html += '</details>';
      });
      if (d.thirdPlace) {
        const m = d.thirdPlace, penStr = m.penA !== null ? ` (p: ${m.penA}–${m.penB})` : '';
        html += `<h3 class="trn-section-h trn-section-h-mt">${t('trn-summ-3rd')}</h3>`;
        html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
      }
    }
    el.innerHTML = html;
  }

  // ── Bracket tab (= Clasificaci×n tab for Liga) ───────────
  function _renderBracket() {
    const el = $('trn-tab-bracket');
    if (!el || !_data) return;
    const d = _data;
    if (d.format === 'liga') {
      const table = d.table || [];
      const podiumClass = ['trn-cls-pos-1', 'trn-cls-pos-2', '', ''];
      const posLabel = (i) => i < 2 ? ['🥇', '🥈'][i] : String(i + 1);
      const rows = table.map((r, i) => {
        const gd = (r.gf ?? 0) - (r.ga ?? 0);
        const gdStr = gd > 0 ? `+${gd}` : String(gd);
        const gdCls = gd > 0 ? 'trn-cls-dif-pos' : gd < 0 ? 'trn-cls-dif-neg' : 'trn-cls-dif-neu';
        return `
        <div class="trn-cls-row ${podiumClass[i] || ''}" style="--row-i:${i}">
          <span class="trn-cls-pos-cell">${posLabel(i)}</span>
          ${_badgeImg(r.slug, 'trn-cls-badge')}
          <span class="trn-cls-name">${_esc(_tLabel(r))}</span>
          <span class="trn-cls-num">${r.p ?? 0}</span>
          <span class="trn-cls-num">${r.w ?? 0}</span>
          <span class="trn-cls-num">${r.d ?? 0}</span>
          <span class="trn-cls-num">${r.l ?? 0}</span>
          <span class="trn-cls-num">${r.gf ?? 0}</span>
          <span class="trn-cls-num">${r.ga ?? 0}</span>
          <span class="trn-cls-num ${gdCls}">${gdStr}</span>
          <span class="trn-cls-pts-val">${r.pts}</span>
        </div>`;
      }).join('');
      el.innerHTML = `
        <h3 class="trn-section-h">${t('trn-bracket-standings-h')}</h3>
        <div class="trn-cls-wrap">
          <div class="trn-cls-table">
            <div class="trn-cls-header">
              <span>#</span><span></span><span>${t('trn-col-team')}</span>
              <span>${t('trn-col-pj-abbr')}</span><span>${t('trn-col-w-abbr')}</span><span>${t('trn-col-d-abbr')}</span><span>${t('trn-col-l-abbr')}</span>
              <span>${t('trn-col-gf-abbr')}</span><span>${t('trn-col-gc-abbr')}</span><span>${t('trn-col-dif')}</span><span>${t('trn-col-pts')}</span>
            </div>
            ${rows || `<p class="trn-lu-empty">${t('trn-col-sin-datos')}</p>`}
          </div>
        </div>`;
      return;
    }
    // ── UCL League Phase — Playoff + KO bracket ──────────
    if (d.format === 'ucl-league') {
      let html = '';
      if (d.playoffRound?.matches?.length) {
        html += `<h3 class="trn-section-h">\uD83D\uDD35 Play-In \u2014 Clasificaci\u00F3n a Octavos</h3>
          <div class="trn-bkt-playoff-grid">`;
        d.playoffRound.matches.forEach(m => {
          const isWinA = m.winner?.slug === m.a?.slug;
          const bA = _badge(m.a?.slug) || '/img/badges/_placeholder.svg';
          const bB = _badge(m.b?.slug) || '/img/badges/_placeholder.svg';
          const penStr = m.penA != null ? ` (${m.penA}\u2013${m.penB}p)` : '';
          const idx = m._cacheIdx ?? 0;
          html += `<div class="trn-bkt-po-card" data-match-idx="${idx}">
            <div class="trn-bkt-po-team${isWinA ? ' trn-bkt-winner' : ' trn-bkt-loser'}">
              <img class="trn-bkt-badge" src="${_esc(bA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
              <span class="trn-bkt-tname">${_esc(_tLabel(m.a) || '\u2014')}</span>
              ${isWinA ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
            </div>
            <div class="trn-bkt-po-score">${m.aggA}\u2013${m.aggB}${penStr}</div>
            <div class="trn-bkt-po-team${!isWinA ? ' trn-bkt-winner' : ' trn-bkt-loser'}">
              <img class="trn-bkt-badge" src="${_esc(bB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
              <span class="trn-bkt-tname">${_esc(_tLabel(m.b) || '\u2014')}</span>
              ${!isWinA ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
            </div>
          </div>`;
        });
        html += `</div>`;
      }
      html += `<h3 class="trn-section-h trn-section-h-mt">\u26BD Fase Eliminatoria</h3>`;
      html += `<div class="trn-bkt-scroll">${_renderVisualBracket(d.koRounds || [])}</div>`;
      el.innerHTML = html;
      return;
    }

    let allRounds = d.koRounds || d.rounds || [];
    // Separate an optional Play-in round from the main KO tree
    // (Play-in + same-size next round breaks _computeBracketPositions)
    const playInRound = allRounds[0]?.label === 'Play-in' ? allRounds[0] : null;
    const koRounds = playInRound ? allRounds.slice(1) : allRounds;

    let html = '';
    if (playInRound && playInRound.matches.length) {
      html += `<h3 class="trn-section-h">🔵 Play-in</h3>
        <div class="trn-bkt-playoff-grid">`;
      playInRound.matches.forEach(m => {
        const isWinA = m.winner?.slug === m.a?.slug;
        const bA = _badge(m.a?.slug) || '/img/badges/_placeholder.svg';
        const bB = _badge(m.b?.slug) || '/img/badges/_placeholder.svg';
        const penStr = m.penA != null ? ` (${m.penA}\u2013${m.penB}p)` : '';
        const score = m.legs === 2
          ? `${m.aggA}\u2013${m.aggB}${penStr}`
          : `${m.scoreA ?? '?'}\u2013${m.scoreB ?? '?'}${penStr}`;
        const idx = m._cacheIdx ?? 0;
        html += `<div class="trn-bkt-po-card" data-match-idx="${idx}">
          <div class="trn-bkt-po-team${isWinA ? ' trn-bkt-winner' : ' trn-bkt-loser'}">
            <img class="trn-bkt-badge" src="${_esc(bA)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
            <span class="trn-bkt-tname">${_esc(_tLabel(m.a) || '\u2014')}</span>
            ${isWinA ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
          </div>
          <div class="trn-bkt-po-score">${score}</div>
          <div class="trn-bkt-po-team${!isWinA ? ' trn-bkt-winner' : ' trn-bkt-loser'}">
            <img class="trn-bkt-badge" src="${_esc(bB)}" onerror="this.src='/img/badges/_placeholder.svg'" alt="">
            <span class="trn-bkt-tname">${_esc(_tLabel(m.b) || '\u2014')}</span>
            ${!isWinA ? '<span class="trn-bkt-win-star">\u2605</span>' : ''}
          </div>
        </div>`;
      });
      html += `</div>`;
      if (koRounds.length) html += `<h3 class="trn-section-h trn-section-h-mt">⚽ Fase Eliminatoria</h3>`;
    }
    html += `<div class="trn-bkt-scroll">${_renderVisualBracket(koRounds)}</div>`;
    el.innerHTML = html;
  }

  // ── Swipe gestures on dashboard ──────────────────────────
  const _TAB_ORDER = ['summary', 'bracket', 'calendar', 'stats'];
  (function _initSwipe() {
    let _sx = 0, _sy = 0, _swipeLocked = false;
    document.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
      // Lock swipe if touch starts inside a horizontally-scrollable container
      _swipeLocked = !!e.target.closest('[data-no-swipe], #trn-tab-bracket, .trn-bkt-scroll, .trn-pre-draw-bkt-wrap, .trn-table-wrap');
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!_data || _swipeLocked) return;
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
          <h3 class="trn-section-h">${t('trn-summ-top5')}</h3>
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

      // ── UCL League Phase format ────────────────────────────
      if (d.format === 'ucl-league') {
        // Full 36-team league table
        html += `<h3 class="trn-section-h trn-section-h-mt">📊 Clasificación — Fase de Liga</h3>`;
        html += `<div class="trn-ucl-table-wrap"><table class="trn-ucl-table">
          <thead><tr>
            <th>#</th><th></th><th>Club</th>
            <th title="Partidos jugados">PJ</th><th title="Victorias">G</th><th title="Empates">E</th><th title="Derrotas">P</th>
            <th title="Goles a favor">GF</th><th title="Goles en contra">GC</th><th title="Diferencia">DIF</th><th title="Puntos">PTS</th>
          </tr></thead><tbody>`;
        const statusColor = { direct:'#2a9', playoff:'#c8a030', out:'rgba(255,255,255,.25)' };
        const statusLabel = { direct:'Octavos', playoff:'Playoff', out:'Eliminado' };
        d.leagueTable.forEach((r, i) => {
          const gd = r.gf - r.ga;
          const sc = statusColor[r.status] || '';
          const sl = statusLabel[r.status] || '';
          let sep = '';
          if (i === 7)  sep = ' trn-ucl-sep-direct';
          if (i === 23) sep = ' trn-ucl-sep-out';
          html += `<tr class="trn-ucl-row${sep}" style="--row-border:${sc}" title="${sl}">
            <td class="trn-ucl-pos">${i+1}</td>
            <td class="trn-ucl-badge">${_badgeImg(r.slug,'trn-mini-badge')}</td>
            <td class="trn-ucl-name">${_esc(_tLabel(r))}</td>
            <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
            <td>${r.gf}</td><td>${r.ga}</td>
            <td style="color:${gd>0?'#7adf7a':gd<0?'#f06':''}">${gd>0?'+':''}${gd}</td>
            <td class="trn-ucl-pts">${r.pts}</td>
          </tr>`;
        });
        html += `</tbody></table></div>`;

        // Legend
        html += `<div class="trn-ucl-legend">
          <span style="border-left:3px solid #2a9;padding-left:.4rem">Directo a Octavos (1-8)</span>
          <span style="border-left:3px solid #c8a030;padding-left:.4rem">Play-In (9-24)</span>
          <span style="border-left:3px solid rgba(255,255,255,.25);padding-left:.4rem">Eliminados (25-36)</span>
        </div>`;

        // Playoff round
        if (d.playoffRound) {
          html += `<h3 class="trn-section-h trn-section-h-mt">🔵 Play-In (ida y vuelta)</h3>`;
          html += `<details class="trn-cal-jornada" open><summary class="trn-cal-jornada-label">Play-In <span class="trn-jornada-cnt">${d.playoffRound.matches.length}</span></summary>`;
          d.playoffRound.matches.forEach(m => {
            const penStr = m.penA != null ? ` (p: ${m.penA}–${m.penB})` : '';
            html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
          });
          html += '</details>';
        }

        // KO rounds
        html += `<h3 class="trn-section-h trn-section-h-mt">⚽ Fase eliminatoria</h3>`;
        [...(d.koRounds || [])].reverse().forEach((r, ri) => {
          const openAttr = ri === 0 ? ' open' : '';
          html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
          r.matches.forEach(m => {
            const penStr = m.penA != null && typeof m.penA === 'number' ? ` (p: ${m.penA}–${m.penB})` : '';
            if (m.legs === 2) {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
            } else {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
            }
          });
          html += '</details>';
        });
        el.innerHTML = html;
        return;
      }

      // Round results
      if (d.groups) {
        // Groups mode
        html += `<h3 class="trn-section-h trn-section-h-mt">${t('trn-summ-groups-h')}</h3>`;
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
        html += `<h3 class="trn-section-h trn-section-h-mt">${t('trn-summ-ko-h')}</h3>`;
        [...(d.koRounds || [])].reverse().forEach((r, ri) => {
          const openAttr = ri === 0 ? ' open' : '';
          html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
          r.matches.forEach(m => {
            const penStr = m.penA != null && typeof m.penA === 'number' ? ` (p: ${m.penA}–${m.penB})` : '';
            if (m.legs === 2) {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
            } else {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
            }
          });
          html += '</details>';
        });
      } else {
        // Copa KO
        html += `<h3 class="trn-section-h trn-section-h-mt">${t('trn-summ-rounds-h')}</h3>`;
        [...(d.rounds || [])].reverse().forEach((r, ri) => {
          const openAttr = ri === 0 ? ' open' : '';
          html += `<details class="trn-cal-jornada"${openAttr}><summary class="trn-cal-jornada-label">${_esc(r.label)} <span class="trn-jornada-cnt">${r.matches.length}</span></summary>`;
          r.matches.forEach(m => {
            const penStr = m.penA != null && typeof m.penA === 'number' ? ` (p: ${m.penA}–${m.penB})` : '';
            if (m.legs === 2) {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.aggA} – ${m.aggB}${penStr}`);
            } else {
              html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
            }
          });
          html += '</details>';
        });
        if (d.thirdPlace) {
          const m = d.thirdPlace, penStr = m.penA != null && typeof m.penA === 'number' ? ` (p: ${m.penA}–${m.penB})` : '';
          html += `<h3 class="trn-section-h trn-section-h-mt">${t('trn-summ-3rd')}</h3>`;
          html += _matchCard(m, _tLabel(m.a), _tLabel(m.b), `${m.scoreA} – ${m.scoreB}${penStr}`);
        }
      }

      el.innerHTML = html;
    } catch (err) {
      console.error('[_renderSummary]', err);
      el.innerHTML = `<p style="padding:1rem;color:rgba(255,255,255,.5)">${t('trn-render-error')}: ${_esc(err.message)}</p>`;
    }
  }

  // ── Dream XI ─────────────────────────────────────────────
  async function _buildDreamXI(d) {
    // Build composite player score: goals×1 + MOM×2
    // Guard: skip entries whose name is a placeholder (last word is all digits, or name is ≤2 chars)
    const _validName = n => n && n.length > 2 && !/\s\d+$/.test(n) && !/^\d+$/.test(n);
    const pm = {};
    (d._scorersAll || d.pichichi || []).forEach(r => {
      if (!_validName(r.name)) return;
      const k = r.name + '|' + r.teamSlug;
      if (!pm[k]) pm[k] = { name: r.name, team: r.team, teamSlug: r.teamSlug, era: r.era || '', goals: 0, mom: 0 };
      pm[k].goals += (r.goals || 0);
    });
    (d._momsAll || d.mvp || []).forEach(r => {
      if (!_validName(r.name)) return;
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

    // Position groups (defined early so posGroup is available below)
    const GK_SET  = new Set(['GK']);
    const DEF_SET = new Set(['CB','LB','RB','WB','LWB','RWB','SW']);
    const MID_SET = new Set(['CM','CDM','CAM','LM','RM','DM','LCM','RCM']);
    const ATT_SET = new Set(['ST','CF','LW','RW','SS','FW']);
    const posGroup = pos => GK_SET.has(pos) ? 'gk' : DEF_SET.has(pos) ? 'def' : MID_SET.has(pos) ? 'mid' : ATT_SET.has(pos) ? 'att' : 'unk';

    // Map lowercase name → position string; also build supplementary pool per group
    // (players from looked-up rosters who didn't score/win MOM — used to fill empty slots)
    const nameToPos = {};
    const suppByGroup = { gk: [], def: [], mid: [], att: [] };
    lookupResults.forEach((res, i) => {
      const ld = res.value;
      if (!ld?.players) return;
      const tk    = teamKeys[i];
      const sep   = tk.indexOf('|');
      const tSlug = tk.slice(0, sep);
      const tEra  = tk.slice(sep + 1);
      const tName = top30.find(p => p.teamSlug === tSlug)?.team || '';
      ld.players.forEach(p => {
        if (!p.name) return;
        nameToPos[p.name.toLowerCase()] = p.position;
        // Add to supplementary if not already in scoring pool
        if (!pm[p.name + '|' + tSlug]) {
          const g = posGroup(p.position);
          if (suppByGroup[g]) suppByGroup[g].push({ name: p.name, team: tName, teamSlug: tSlug, era: tEra, goals: 0, mom: 0, score: 0, pos: p.position, group: g });
        }
      });
    });

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
    // Pass 2: fill gaps using remaining scorers/MOM — only if their position group matches
    // (prevents field players being placed in the GK slot; those fall through to Pass 3)
    const remaining = tagged.filter(p => !used.has(p.name + '|' + p.teamSlug));
    for (const g of ['gk','def','mid','att']) {
      let ri = 0;
      while (selected[g].length < quotas[g] && ri < remaining.length) {
        const p = remaining[ri];
        const fits = p.group === g || (p.group === 'unk' && g !== 'gk');
        if (fits) {
          selected[g].push({ ...p, pos: p.pos || '?' });
          used.add(p.name + '|' + p.teamSlug);
          remaining.splice(ri, 1);
        } else {
          ri++;
        }
      }
    }
    // Pass 3: fill any still-empty slots from supplementary lineup pool
    // (defenders/GKs who played but didn't score — common in short tournaments)
    for (const g of ['gk', 'def', 'mid', 'att']) {
      let si = 0;
      while (selected[g].length < quotas[g] && si < suppByGroup[g].length) {
        const p = suppByGroup[g][si++];
        if (!used.has(p.name + '|' + p.teamSlug)) {
          selected[g].push(p);
          used.add(p.name + '|' + p.teamSlug);
        }
      }
    }
    return selected;
  }

  function _renderXIHtml(xi) {
    if (!xi) return `<p class="trn-lu-empty">${t('trn-xi-empty')}</p>`;
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
      sec.innerHTML = `<h3 class="trn-section-h">${t('trn-stats-h-xi')}</h3>${_renderXIHtml(xi)}`;
    } catch (_e) {
      sec.innerHTML = `<h3 class="trn-section-h">${t('trn-stats-h-xi')}</h3><p class="trn-lu-empty">${t('trn-xi-no-data')}</p>`;
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
      const sa = m.legs === 2 ? (m.aggA ?? 0) : (m.scoreA ?? 0);
      const sb = m.legs === 2 ? (m.aggB ?? 0) : (m.scoreB ?? 0);
      const slugA = m.a?.slug, slugB = m.b?.slug;
      if (totals[slugA]) { totals[slugA].gf += sa; totals[slugA].ga += sb; totals[slugA].mp++; if (sa > sb) totals[slugA].w++; }
      if (totals[slugB]) { totals[slugB].gf += sb; totals[slugB].ga += sa; totals[slugB].mp++; if (sb > sa) totals[slugB].w++; }
    });

    const sorted = Object.values(totals).sort((a, b) => b.gf - a.gf);
    const top = sorted.slice(0, 10);

    el.innerHTML = `
      <h3 class="trn-section-h">${t('trn-stats-h-pichichi')}</h3>
      <div class="trn-stats-list">
        ${(d.pichichi || []).slice(0, 10).map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            ${_badgeImg(r.teamSlug, 'trn-stats-badge')}
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-club">${_esc(r.team)}</span>
            <span class="trn-stats-gf" title="${t('trn-col-goles')}">${r.goals} ${t('trn-stat-goals-unit')}</span>
          </div>`).join('')}
      </div>
      ${(d.mvp || []).length ? `
      <h3 class="trn-section-h trn-section-h-mt">${t('trn-stats-h-mvp')}</h3>
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
      <h3 class="trn-section-h trn-section-h-mt">${t('trn-stats-h-teams-goals')}</h3>
      <div class="trn-stats-list">
        ${top.map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            ${_badgeImg(r.slug, 'trn-stats-badge')}
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-ratio">${r.mp ? (r.gf / r.mp).toFixed(1) : '0.0'}${t('trn-col-per-match')}</span>
            <span class="trn-stats-mp" title="${t('trn-col-pj')}">${r.mp} ${t('trn-col-pj-abbr')}</span>
            <span class="trn-stats-gf" title="${t('trn-col-goles')}">${r.gf} G</span>
          </div>`).join('')}
      </div>
      <h3 class="trn-section-h trn-section-h-mt">${t('trn-stats-h-defense')}</h3>
      <div class="trn-stats-list">
        ${Object.values(totals).filter(r => r.mp > 0).sort((a, b) => a.ga - b.ga).slice(0, 5).map((r, i) => `
          <div class="trn-stats-row">
            <span class="trn-stats-pos">${i + 1}</span>
            ${_badgeImg(r.slug, 'trn-stats-badge')}
            <span class="trn-stats-team">${_esc(r.name)}</span>
            <span class="trn-stats-ratio">${r.mp ? (r.w / r.mp * 100).toFixed(0) : '0'}${t('trn-col-w-pct')}</span>
            <span class="trn-stats-gf" title="${t('trn-col-gc')}">${r.ga} ${t('trn-col-gc-abbr')}</span>
          </div>`).join('')}
      </div>
      <div id="trn-xi-section">
        <h3 class="trn-section-h">${t('trn-stats-h-xi')}</h3>
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
      <h3 class="trn-section-h trn-section-h-mt">${t('trn-stats-h-highlights')}</h3>
      <div class="trn-dest-grid">
        ${byMargin.map((m, i) => card(m, i === 0 ? t('trn-hl-top-win') : `${t('trn-hl-win')} #${i + 1}`)).join('')}
      </div>
      <div class="trn-dest-grid" style="margin-top:.5rem">
        ${byGoals.map((m, i) => card(m, i === 0 ? t('trn-hl-top-goals') : `${t('trn-hl-goals')} #${i + 1}`)).join('')}
      </div>`;
  }

  function _getAllMatches(d) {
    const extra = d.thirdPlace ? [d.thirdPlace] : [];
    if (d.format === 'liga') return d.matches;
    if (d.format === 'ucl-league') {
      const playoff = d.playoffRound ? d.playoffRound.matches : [];
      const ko      = (d.koRounds || []).flatMap(r => r.matches);
      return [...(d.leagueMatches || []), ...playoff, ...ko];
    }
    if (d.groups || d.koRounds) {
      const grpMatches = (d.groups || []).flatMap(g => g.matches);
      const koMatches  = (d.koRounds || []).flatMap(r => r.matches);
      return [...grpMatches, ...koMatches, ...extra];
    }
    return [...(d.rounds || []).flatMap(r => r.matches), ...extra];
  }

  // ── Start over ───────────────────────────────────────────
  function startOver() {
    _fmt = null; _teams = []; _draw = []; _groupsDraw = []; _data = null; _tab = 'summary'; _matchCache = []; _badgeCache = {}; _modalIdx = -1;
    _activePreset = null; _uclFixtures = null; _potEditMode = false; _potEditSel = null;
    // Reset simulation state so step 3 is clean on re-entry
    _stopTrnLoadCycle();
    hide($('trn-progress'));
    show($('trn-step-3-actions'));
    const pb = $('trn-progress-bar');
    if (pb) pb.style.width = '0%';
    hide($('trn-dashboard'));
    const conf = $('trn-preset-confirm'); if (conf) hide(conf);
    const ucl  = $('trn-ucl-draw');      if (ucl)  hide(ucl);
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
      ? `<div class="trn-modal-pen-row">${t('trn-modal-pens')} ${m.penA}–${m.penB}</div>` : '';
    const legsStr = m.legs === 2
      ? `<div class="trn-modal-legs-sub">${t('trn-modal-legs-ida')}: ${m.r1?.scoreA ?? '?'}–${m.r1?.scoreB ?? '?'} · ${t('trn-modal-legs-vuelta')}: ${m.r2?.scoreA ?? '?'}–${m.r2?.scoreB ?? '?'}</div>` : '';

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
          <span class="trn-modal-score-big">${scoreA}–${scoreB}</span>
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
      : `<div class="trn-modal-no-goals-row">${t('trn-modal-no-goals')}</div>`;

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
        ${bar(possA, possB, t('trn-modal-poss'))}
        ${bar(shotA, shotB, t('trn-modal-shots'))}
        ${cornA || cornB ? bar(cornA, cornB, t('trn-modal-corners')) : ''}
        ${saveA || saveB ? bar(saveA, saveB, t('trn-modal-saves')) : ''}
        ${foulA || foulB ? bar(foulA, foulB, t('trn-modal-fouls')) : ''}
      </div>
      <div class="trn-modal-lu-section">
        <div class="trn-modal-lu-hdr">${t('trn-modal-lineups')}</div>
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
    if (!slugA || !slugB) { area.innerHTML = `<p class="trn-lu-empty">${t('trn-no-squad-data')}</p>`; return; }
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
        const title = t ? `${_esc(t.name)}${yr ? ` <span class="trn-lu-yr">'${_eraLabel(yr)}</span>` : ''}` : _esc(d?.source || '?');
        if (!d?.found || !Array.isArray(d.players) || !d.players.length) {
          return `<div class="trn-lu-col"><div class="trn-lu-title">${title}</div><p class="trn-lu-empty">${t('trn-xi-no-lineup')}</p></div>`;
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
    // Catalog DB browser
    $('trn-btn-catalog')?.addEventListener('click', () => toggleCatalogBrowser());
    $('trn-catalog-browser')?.addEventListener('click', e => {
      const item = e.target.closest('.trn-cb-item');
      if (!item) return;
      const { slug, name, badge, era } = item.dataset;
      if (_teams.some(t => t.slug === slug)) { removeTeam(_teams.findIndex(t => t.slug === slug)); return; }
      addTeam(slug, name, era || '', badge || '');
      _refreshCatalogBrowserState($('trn-catalog-browser'));
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
    openLeagueLoader,
    closeLeagueLoader,
    loadPreset,
    cancelPreset,
    runPresetSimulation,
    startUCLDraw,
  };

})();
