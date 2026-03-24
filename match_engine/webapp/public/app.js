/**
 * Simulador de Partidos de Fútbol — JavaScript Frontend
 * ═══════════════════════════════════════════════
 * Flujo:
 *   1. El usuario rellena los campos y pulsa “Simular Partido”
 *   2. handleSimulate() valida las entradas
 *   3. POST /simulate → Express → engine.js → resultado JSON
 *   4. renderResult(data) rellena todas las secciones de la UI
 */

'use strict';

// ── Internationalisation (ES / EN) ────────────────────────────
const I18N = {
  es: {
    'label-a':'EQUIPO A','label-b':'EQUIPO B',
    'inp-a-placeholder':'ej. FC Barcelona, Brasil, Ajax…','inp-b-placeholder':'ej. AC Milan, Real Madrid, Alemania…',
    'era-a-placeholder':'Temporada / Época (opcional) — ej. 1991-92','era-b-placeholder':'Temporada / Época (opcional) — ej. 1988-89',
    'formation-default':'Formación (automática)','lookup-btn':'🔍 Buscar alineación','lookup-searching':'⌛ Buscando…',
    'mode-lbl':'Modo:','stadium-lbl':'🏟️ ESTADIO','stadium-neutro':'Neutro',
    'btn-simulate':'Simular Partido','tagline':'Cualquier equipo · Cualquier época · Cualquier rivalidad',
    'loading-text':'Simulando 30 000 partidos…','pm-eyebrow':'PRESENTACIÓN DE EQUIPOS','pm-start-label':'Comenzando en',
    'live-badge':'EN DIRECTO','btn-skip':'⏭ Saltar',
    'poster-label-final':'RESULTADO FINAL','poster-label-pens':'EMPATE · PENALTIS','poster-context':'Partido de leyenda · Campo neutral',
    'section-probs':'PROBABILIDADES','section-timeline':'LÍNEA DE TIEMPO',
    'section-lineup':'ALINEACIONES','section-stats':'ESTADÍSTICAS','section-mom':'MEJOR JUGADOR',
    'btn-share':'📤 Compartir',
    'error-no-teams':'Introduce los nombres de ambos equipos.','error-too-long':'Los nombres de equipo no pueden superar 80 caracteres.',
    'fail-lookup':'❌ No encontrado','hint-lookup':'Prueba sin época, o con el nombre en inglés',
    'timeout-lookup':'Tiempo de espera agotado (scraper lento). Intenta de nuevo.',
    'no-connection':'Sin conexión al servidor. ¿Está iniciado?',
    'pen-shootout-title':'🎯 Tandas de Penaltis','pen-winner-suffix':'gana la tanda','pen-winner-sd':' (muerte súbita)',
    'timeline-events-suffix':'evento','timeline-events-suffix-pl':'eventos','timeline-empty':'Sin incidencias destacadas',
    'mom-badge-text':'MEJOR JUGADOR','bench-label':'BANQUILLO','ovr-lbl':'OVR',
    'sub-change-toast':'✅ Cambio realizado','tooltip-copied':'Resultado copiado ✓','tooltip-copy-fail':'No se pudo copiar',
    'ev-goal':'¡GOL!','ev-yellow':'TARJETA AMARILLA','ev-red':'TARJETA ROJA','ev-pen_winner':'¡GANADOR!','ev-injury':'🩹 LESIÓN',
    'ev-penalty':'PENALTI MARCADO','ev-penalty-miss':'PENALTI FALLADO','ev-corner':'CÓRNER','ev-freekick':'FALTA DIRECTA',
    'ev-tag-pen':'pen.','ev-tag-miss':'pen. fallado','ev-tag-corner':'córner','ev-tag-fk':'falta directa',
    'phase-playing':'EN JUEGO','phase-corner':'🚩 CÓRNER','phase-freekick':'🎯 FALTA DIRECTA',
    'phase-yellow':'🟨 T. AMARILLA','phase-red':'🟥 T. ROJA','phase-pen-miss':'❌ PENALTI FALLADO','phase-goal':'⚽ GOL','phase-injury':'🩹 LESIÓN',
    'pos-GK':'Portero','pos-RB':'Lateral Der.','pos-CB':'Central','pos-LB':'Lateral Izq.','pos-DM':'Mediocentro Def.',
    'pos-CM':'Centrocampista','pos-RM':'Interior Der.','pos-LM':'Interior Izq.','pos-AM':'Mediapunta',
    'pos-RW':'Extremo Der.','pos-LW':'Extremo Izq.','pos-ST':'Delantero Centro',
    'hth-possession':'Posesión','hth-shots':'Tiros','hth-corners':'Córneres','hth-saves':'Paradas','hth-fouls':'Faltas',
    'hth-attack':'Ataque','hth-midfield':'Centrocampo','hth-defense':'Defensa','hth-goalkeeping':'Portería',
    'radar-attack':'Ataque','radar-midfield':'Medio','radar-defense':'Defensa','radar-goalkeeping':'Portería','radar-physical':'Físico',
    'prob-draw':'Empate','alt-scores-label':'Otros resultados:',
    'prob-win-suffix':'gana','sim-iters-suffix':'simulaciones',
  },
  en: {
    'label-a':'TEAM A','label-b':'TEAM B',
    'inp-a-placeholder':'e.g. FC Barcelona, Brazil, Ajax…','inp-b-placeholder':'e.g. AC Milan, Real Madrid, Germany…',
    'era-a-placeholder':'Season / Era (optional) — e.g. 1991-92','era-b-placeholder':'Season / Era (optional) — e.g. 1988-89',
    'formation-default':'Formation (auto)','lookup-btn':'🔍 Search lineup','lookup-searching':'⌛ Searching…',
    'mode-lbl':'Mode:','stadium-lbl':'🏟️ STADIUM','stadium-neutro':'Neutral',
    'btn-simulate':'Simulate Match','tagline':'Any team · Any era · Any rivalry',
    'loading-text':'Simulating 30,000 matches…','pm-eyebrow':'TEAM PRESENTATION','pm-start-label':'Starting in',
    'live-badge':'LIVE','btn-skip':'⏭ Skip',
    'poster-label-final':'FINAL SCORE','poster-label-pens':'DRAW · PENALTIES','poster-context':'Legendary match · Neutral ground',
    'section-probs':'PROBABILITIES','section-timeline':'MATCH TIMELINE',
    'section-lineup':'LINEUPS','section-stats':'MATCH STATISTICS','section-mom':'PLAYER OF THE MATCH',
    'btn-share':'📤 Share',
    'error-no-teams':'Please enter both team names.','error-too-long':'Team names cannot exceed 80 characters.',
    'fail-lookup':'❌ Not found','hint-lookup':'Try without era, or use the English team name',
    'timeout-lookup':'Request timed out (slow scraper). Try again.',
    'no-connection':'No connection to server. Is it running?',
    'pen-shootout-title':'🎯 Penalty Shootout','pen-winner-suffix':'wins on penalties','pen-winner-sd':' (sudden death)',
    'timeline-events-suffix':'event','timeline-events-suffix-pl':'events','timeline-empty':'No notable incidents',
    'mom-badge-text':'PLAYER OF THE MATCH','bench-label':'BENCH','ovr-lbl':'OVR',
    'sub-change-toast':'✅ Substitution made','tooltip-copied':'Result copied ✓','tooltip-copy-fail':'Could not copy',
    'ev-goal':'GOAL!','ev-yellow':'YELLOW CARD','ev-red':'RED CARD','ev-pen_winner':'WINNER!','ev-injury':'🩹 INJURY',
    'ev-penalty':'PENALTY SCORED','ev-penalty-miss':'PENALTY MISSED','ev-corner':'CORNER','ev-freekick':'FREE KICK',
    'ev-tag-pen':'pen.','ev-tag-miss':'pen. missed','ev-tag-corner':'corner','ev-tag-fk':'free kick',
    'phase-playing':'IN PLAY','phase-corner':'🚩 CORNER','phase-freekick':'🎯 FREE KICK',
    'phase-yellow':'🟨 YELLOW CARD','phase-red':'🟥 RED CARD','phase-pen-miss':'❌ PENALTY MISSED','phase-goal':'⚽ GOAL','phase-injury':'🩹 INJURY',
    'pos-GK':'Goalkeeper','pos-RB':'Right Back','pos-CB':'Centre Back','pos-LB':'Left Back','pos-DM':'Def. Midfielder',
    'pos-CM':'Midfielder','pos-RM':'Right Mid','pos-LM':'Left Mid','pos-AM':'Attacking Mid',
    'pos-RW':'Right Winger','pos-LW':'Left Winger','pos-ST':'Striker',
    'hth-possession':'Possession','hth-shots':'Shots','hth-corners':'Corners','hth-saves':'Saves','hth-fouls':'Fouls',
    'hth-attack':'Attack','hth-midfield':'Midfield','hth-defense':'Defense','hth-goalkeeping':'Goalkeeping',
    'radar-attack':'Attack','radar-midfield':'Mid','radar-defense':'Defense','radar-goalkeeping':'GK','radar-physical':'Physical',
    'prob-draw':'Draw','alt-scores-label':'Other scorelines:',
    'prob-win-suffix':'wins','sim-iters-suffix':'simulations',
  },
};

// ── Web Audio Engine (procedural sounds, no external files) ─────────────────────
const _AC = (() => {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
})();

function _playSound(type) {
  if (!_AC) return;
  const go = () => {
    if (_AC.state !== 'running') return;
    const t0 = _AC.currentTime;
    // Bandpass white noise burst — crowd roar / impact gasp
    const noise = (freq, Q, dur, vol, atk = 0.10) => {
      const len = _AC.sampleRate * dur | 0, buf = _AC.createBuffer(1, len, _AC.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = _AC.createBufferSource(), flt = _AC.createBiquadFilter(), g = _AC.createGain();
      src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(_AC.destination);
      flt.type = 'bandpass'; flt.frequency.value = freq; flt.Q.value = Q;
      g.gain.setValueAtTime(0.001, t0); g.gain.linearRampToValueAtTime(vol, t0 + atk);
      g.gain.setValueAtTime(vol, t0 + dur * 0.62); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.start(t0); src.stop(t0 + dur);
    };
    // Sine tone with attack/release envelope + optional frequency glide
    const sine = (freq, dur, vol, endFreq) => {
      const osc = _AC.createOscillator(), g = _AC.createGain();
      osc.connect(g); g.connect(_AC.destination); osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
      g.gain.setValueAtTime(0.001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      g.gain.setValueAtTime(vol, t0 + dur - 0.06); g.gain.linearRampToValueAtTime(0.001, t0 + dur);
      osc.start(t0); osc.stop(t0 + dur);
    };
    switch (type) {
      case 'whistle_start': sine(3350, 0.65, 0.17); break;           // kickoff: 1 long blast
      case 'goal': noise(650, 0.40, 2.6, 0.28, 0.10); sine(440, 0.45, 0.09, 900); break; // crowd roar + rising whoosh
      case 'card':                                                    // two short ref blasts
        sine(3700, 0.17, 0.14);
        setTimeout(() => {
          if (_AC?.state !== 'running') return;
          const t1 = _AC.currentTime, o = _AC.createOscillator(), gn = _AC.createGain();
          o.connect(gn); gn.connect(_AC.destination); o.type = 'sine'; o.frequency.value = 3700;
          gn.gain.setValueAtTime(0.001,t1); gn.gain.linearRampToValueAtTime(0.14,t1+0.015);
          gn.gain.setValueAtTime(0.14,t1+0.13); gn.gain.linearRampToValueAtTime(0.001,t1+0.17);
          o.start(t1); o.stop(t1+0.18);
        }, 240);
        break;
      case 'injury': sine(130, 0.24, 0.22, 38); noise(1100, 2.0, 1.0, 0.06, 0.04); break; // thud + crowd gasp
      case 'penalty': noise(800, 0.65, 0.9, 0.10, 0.05); break;     // stadium tension hiss
    }
  };
  if (_AC.state === 'suspended') _AC.resume().then(go).catch(() => {}); else go();
}

let _lang = (() => { try { return localStorage.getItem('odyssey_lang') || 'es'; } catch(_) { return 'es'; } })();

function t(key) {
  return (I18N[_lang] || I18N.es)[key] || I18N.es[key] || key;
}

function setLang(lang) {
  _lang = (lang === 'en') ? 'en' : 'es';
  try { localStorage.setItem('odyssey_lang', _lang); } catch(_) {}
  applyI18n();
}

function applyI18n() {
  document.documentElement.lang = _lang;
  // Header
  const tagline = document.querySelector('.tagline');
  if (tagline) tagline.textContent = t('tagline');
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.textContent = _lang === 'es' ? 'EN' : 'ES';
  // Team labels
  document.querySelectorAll('.label-a').forEach(el => { el.textContent = t('label-a'); });
  document.querySelectorAll('.label-b').forEach(el => { el.textContent = t('label-b'); });
  // Inputs
  const el = id => document.getElementById(id);
  if (el('teamA')) el('teamA').placeholder = t('inp-a-placeholder');
  if (el('teamB')) el('teamB').placeholder = t('inp-b-placeholder');
  if (el('eraA'))  el('eraA').placeholder  = t('era-a-placeholder');
  if (el('eraB'))  el('eraB').placeholder  = t('era-b-placeholder');
  ['formationA','formationB'].forEach(id => {
    const sel = el(id);
    if (sel && sel.options.length) sel.options[0].textContent = t('formation-default');
  });
  // Buttons
  const la = el('lookupA'); if (la && !la.disabled) la.textContent = t('lookup-btn');
  const lb = el('lookupB'); if (lb && !lb.disabled) lb.textContent = t('lookup-btn');
  const bsim = el('btn-simulate');
  if (bsim) bsim.innerHTML = `<span class="btn-icon">▶</span> ${t('btn-simulate')}`;
  // Labels  
  document.querySelectorAll('.mode-lbl').forEach(el => { el.textContent = t('mode-lbl'); });
  document.querySelectorAll('.stadium-picker-lbl').forEach(el2 => { el2.textContent = t('stadium-lbl'); });
  const loaderSpan = document.querySelector('#loader span');
  if (loaderSpan) loaderSpan.textContent = t('loading-text');
  document.querySelectorAll('.live-badge').forEach(el2 => { el2.textContent = t('live-badge'); });
  document.querySelectorAll('.btn-skip').forEach(el2 => { el2.textContent = `⏭ ${t('btn-skip').replace(/^⏭\s*/,'')}`.replace('⏭ ⏭','⏭'); });
  const pmEye = document.querySelector('.pm-eyebrow');
  if (pmEye) pmEye.textContent = t('pm-eyebrow');
  const pmStart = document.querySelector('.pm-start-label');
  if (pmStart) pmStart.textContent = t('pm-start-label');
  // Update POS_DESCRIPTIONS in-place
  POS_DESCRIPTIONS.GK = t('pos-GK'); POS_DESCRIPTIONS.RB = t('pos-RB'); POS_DESCRIPTIONS.CB = t('pos-CB');
  POS_DESCRIPTIONS.LB = t('pos-LB'); POS_DESCRIPTIONS.DM = t('pos-DM'); POS_DESCRIPTIONS.CM = t('pos-CM');
  POS_DESCRIPTIONS.RM = t('pos-RM'); POS_DESCRIPTIONS.LM = t('pos-LM'); POS_DESCRIPTIONS.AM = t('pos-AM');
  POS_DESCRIPTIONS.RW = t('pos-RW'); POS_DESCRIPTIONS.LW = t('pos-LW'); POS_DESCRIPTIONS.ST = t('pos-ST');
  // Neutral stadium card
  const neutroCard = document.querySelector('.spk-card[data-id=""] .spk-name');
  if (neutroCard) neutroCard.textContent = t('stadium-neutro');
  // Generic data-i18n sweep
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.dataset.i18n;
    const val = t(key);
    if (val && val !== key) node.textContent = val;
  });
}

const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-5-1', '4-1-4-1'];
const FORMATIONS_5V5 = ['1-2-1', '1-1-2', '2-1-1'];
const FORMATIONS_3V3 = ['1-1', '1-2'];
const FORMATION_LABELS = {
  '1-2-1':'1-2-1 (Equilibrado)', '1-1-2':'1-1-2 (Atacante)', '2-1-1':'2-1-1 (Defensivo)',
  '1-1':'1-1 (Estándar)', '1-2':'1-2 (Presión alta)',
};

// ── Badge fallback: SVG con iniciales del equipo ───────────────
function _badgeFallback(teamName) {
  const initials = (teamName || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  let h = 0;
  for (const c of (teamName || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  const hue = h % 360;
  const sz  = initials.length > 2 ? '24' : '30';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + `<circle cx="50" cy="50" r="48" fill="hsl(${hue},55%,22%)" stroke="hsl(${hue},80%,55%)" stroke-width="4"/>`
    + `<text x="50" y="62" text-anchor="middle" font-family="sans-serif" font-size="${sz}" font-weight="800" fill="white">${initials}</text>`
    + `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ── Match mode state ───────────────────────────────────────────
let _matchMode = '11v11';

function setMatchMode(mode) {
  _matchMode = mode;
  ['11v11','5v5','3v3'].forEach(m => {
    document.getElementById(`mode-${m}`)?.classList.toggle('mode-pill-active', m === mode);
  });
  const formations = mode === '5v5' ? FORMATIONS_5V5 : mode === '3v3' ? FORMATIONS_3V3 : FORMATIONS;
  ['formationA','formationB'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Formación (automática)</option>';
    formations.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = FORMATION_LABELS[f] || f;
      sel.appendChild(opt);
    });
  });
  // Refresh lookup previews so jersey count matches the new mode
  ['A','B'].forEach(s => { if (_lookupCache[s]) _renderLookupPlayers(s, _lookupCache[s]); });
}

// ── Estadios míticos ────────────────────────────────────────────
// Build proxied image URL (server fetches from Wikimedia, follows redirects)
const _imgProxy = f => `/img-proxy?url=${encodeURIComponent('https://commons.wikimedia.org/wiki/Special:FilePath/' + f + '?width=500')}`;

const STADIUMS = [
  { id:'bernabeu',   name:'Santiago Bernabéu',    city:'Madrid',          country:'España',
    capacity:81044, year:1947, surface:'Césped híbrido',  climate:'☀️ Templado',
    img: _imgProxy('Santiago_Bernabeu_Stadium.jpg') },
  { id:'campnou',    name:'Camp Nou',              city:'Barcelona',       country:'España',
    capacity:99354, year:1957, surface:'Césped natural',  climate:'☀️ Mediterráneo',
    img: _imgProxy('Camp_Nou.jpg') },
  { id:'wembley',    name:'Wembley Stadium',       city:'Londres',         country:'Inglaterra',
    capacity:90000, year:2007, surface:'Césped híbrido',  climate:'🌧️ Oceánico',
    img: _imgProxy('Wembley_stadium.jpg') },
  { id:'maracana',   name:'Maracanã',              city:'Río de Janeiro',  country:'Brasil',
    capacity:78838, year:1950, surface:'Césped natural',  climate:'☀️ Tropical',
    img: _imgProxy('Maracanã.jpg') },
  { id:'sansiro',    name:'San Siro (G. Meazza)',  city:'Milán',           country:'Italia',
    capacity:80018, year:1926, surface:'Césped híbrido',  climate:'🌦️ Continental',
    img: _imgProxy('San_Siro.jpg') },
  { id:'allianz',    name:'Allianz Arena',         city:'Múnich',          country:'Alemania',
    capacity:75024, year:2005, surface:'Césped natural',  climate:'🌨️ Frío',
    img: _imgProxy('Allianz_Arena.jpg') },
  { id:'dortmund',   name:'BVB-Stadion Dortmund',  city:'Dortmund',        country:'Alemania',
    capacity:81365, year:1974, surface:'Césped natural',  climate:'🌨️ Frío',
    img: _imgProxy('Signal_Iduna_Park.jpg') },
  { id:'oldtrafford',name:'Old Trafford',          city:'Mánchester',      country:'Inglaterra',
    capacity:74310, year:1910, surface:'Césped híbrido',  climate:'🌧️ Oceánico',
    img: _imgProxy('Old_Trafford.jpg') },
  { id:'anfield',    name:'Anfield',               city:'Liverpool',       country:'Inglaterra',
    capacity:61276, year:1884, surface:'Césped natural',  climate:'🌧️ Oceánico',
    img: _imgProxy('Anfield.jpg') },
  { id:'azteca',     name:'Estadio Azteca',        city:'Ciudad de México', country:'México',
    capacity:87523, year:1966, surface:'Césped natural',  climate:'⛅ Altitud',
    img: _imgProxy('Estadio_azteca.jpg') },
  { id:'luzhniki',   name:'Estadio Luzhniki',      city:'Moscú',           country:'Rusia',
    capacity:81000, year:1956, surface:'Césped natural',  climate:'❄️ Continental',
    img: _imgProxy('Luzhniki_Stadium.jpg') },
  { id:'sanmames',   name:'San Mamés',             city:'Bilbao',          country:'España',
    capacity:53289, year:2013, surface:'Césped híbrido',  climate:'🌧️ Atlántico',
    img: _imgProxy('San_Mames_stadium.jpg') },
  { id:'celtic',     name:'Celtic Park',           city:'Glasgow',         country:'Escocia',
    capacity:60411, year:1892, surface:'Césped natural',  climate:'🌧️ Oceánico',
    img: _imgProxy('Celtic_Park.jpg') },
];

let _selectedStadium = null;

function selectStadium(stadiumId) {
  _selectedStadium = STADIUMS.find(s => s.id === stadiumId) || null;
  // Update visual picker active state
  document.querySelectorAll('.spk-card').forEach(c => {
    c.classList.toggle('spk-active', c.dataset.id === (stadiumId || ''));
  });
}

// ── Autocomplete data: loaded once on startup ───────────────────
const _acList = [];
fetch('/suggest').then(r => r.json()).then(list => _acList.push(...list)).catch(() => {});

// ── Bootstrap ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved language preference
  applyI18n();

  // Logo is served directly as odyssey-logo.png from public/

  // Populate formation dropdowns (11v11 default)
  ['formationA', 'formationB'].forEach(id => {
    const sel = document.getElementById(id);
    FORMATIONS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f; opt.textContent = f;
      sel.appendChild(opt);
    });
  });

  // Build stadium visual picker
  const pickerRow = document.getElementById('stadium-picker-row');
  if (pickerRow) {
    // "Neutro" tile first
    const neutroCard = document.createElement('div');
    neutroCard.className = 'spk-card spk-active';
    neutroCard.dataset.id = '';
    neutroCard.innerHTML = `<div class="spk-img-placeholder">🏟️</div><div class="spk-name">Neutro</div>`;
    neutroCard.onclick = () => selectStadium('');
    pickerRow.appendChild(neutroCard);

    STADIUMS.forEach(s => {
      const card = document.createElement('div');
      card.className = 'spk-card';
      card.dataset.id = s.id;
      card.innerHTML =
        `<img class="spk-img" src="${escHtml(s.img)}" alt="${escHtml(s.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>` +
        `<div class="spk-img-placeholder" style="display:none">🏟️</div>` +
        `<div class="spk-name">${escHtml(s.name)}</div>` +
        `<div class="spk-city">${escHtml(s.city)}</div>`;
      card.onclick = () => selectStadium(s.id);
      pickerRow.appendChild(card);
    });
  }

  // Allow Enter key to trigger simulation from any input
  ['teamA','eraA','teamB','eraB','formationA','formationB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleSimulate(); });
  });

  // Setup autocomplete for both team inputs
  setupAutocomplete('teamA', 'ac-A', 'A');
  setupAutocomplete('teamB', 'ac-B', 'B');
});

// ── Lookup cache: stores last API result per side (A / B) ────
const _lookupCache = { A: null, B: null };

// Picks players by role for a given match mode (prevents 5v5 showing 4 defenders)
function _pickForMode(players, mode) {
  const POS_SORT = { GK:0, RB:1, CB:1, LB:1, DM:2, CM:3, RM:3, LM:3, AM:3.5, RW:4, LW:4, ST:4 };
  const sorted   = [...players].sort((a,b) => (POS_SORT[a.position]??3) - (POS_SORT[b.position]??3));
  if (mode === '11v11') return sorted.slice(0, 11);

  // Build pool grouped by position
  const byPos = {};
  sorted.forEach(p => { (byPos[p.position] = byPos[p.position] || []).push(p); });
  const pick = (...roles) => { for (const r of roles) if (byPos[r]?.length) return byPos[r].shift(); return null; };

  let result;
  if (mode === '3v3') {
    result = [
      pick('GK'),
      pick('CM','DM','AM','RM','LM','CB','RB','LB'),
      pick('ST','RW','LW','AM','CM'),
    ];
  } else /* 5v5 */ {
    result = [
      pick('GK'),
      pick('CB','RB','LB'),
      pick('DM','CM'),
      pick('AM','CM','RM','LM'),
      pick('ST','RW','LW'),
    ];
  }
  // Deduplicate and fill any nulls from remaining sorted players
  const used = new Set(result.filter(Boolean));
  for (const p of sorted) {
    if (result.length >= (mode === '3v3' ? 3 : 5)) break;
    if (!used.has(p)) { result.push(p); used.add(p); }
  }
  return result.filter(Boolean).slice(0, mode === '3v3' ? 3 : 5);
}

// Renders the jersey-card grid inside a lookup preview panel.
// Re-used both from handleLookup and from setMatchMode (mode switch).
function _renderLookupPlayers(side, data) {
  const picked = _pickForMode(data.players, _matchMode);
  const kitCol  = _getKitColor(data.teamLabel || document.getElementById(`team${side}`)?.value, side.toLowerCase());
  const el      = document.getElementById(`preview-players-${side}`);
  if (!el) return;
  const teamRxgs = data.ratings || { attack: 72, midfield: 72, defense: 72, goalkeeping: 72 };
  // Assign unique sequential numbers: avoid duplicates by bumping when colliding
  const usedNums = new Set();
  const header = '<div class="lk-header"><span class="lk-h-kit">Kit</span><span class="lk-h-ovr">Media</span><span class="lk-h-num">Dorsal</span><span class="lk-h-name">Nombre</span><span class="lk-h-pos">Pos</span></div>';
  el.innerHTML = header + picked.map((p, i) => {
    let num = _JERSEY_NUM[p.position] ?? (i + 1);
    while (usedNums.has(num)) num++;
    usedNums.add(num);
    // Show last word of name, but if it’s just initials/short, also use second-to-last
    const parts = p.name.trim().split(/\s+/);
    const last  = parts[parts.length - 1];
    const short = (last.length <= 3 && parts.length > 1)
      ? (parts[parts.length - 2] + ' ' + last).toUpperCase()
      : last.toUpperCase();
    const desc  = POS_DESCRIPTIONS[p.position] || p.position;
    const ovr   = calcPlayerRating(p, teamRxgs);
    const tier  = ovr >= 90 ? 'elite' : ovr >= 82 ? 'gold' : ovr >= 72 ? 'silver' : 'bronze';
    return [
      '<div class="lk-jcard lk-jcard-' + tier + '" title="' + escHtml(p.name) + ' — ' + escHtml(desc) + '">',
      '<span class="lk-jkit" style="background:' + kitCol + '"></span>',
      '<span class="lk-jovr">' + ovr + '</span>',
      '<span class="lk-jnum">#' + num + '</span>',
      '<span class="lk-jname">' + escHtml(short) + '</span>',
      '<span class="lk-jpos">' + escHtml(p.position) + '</span>',
      '</div>',
    ].join('');
  }).join('');
}

// ── Lookup handler — called by 🔍 buttons ─────────────────
async function handleLookup(side) {
  const teamInput = document.getElementById(`team${side}`).value.trim();
  const eraInput  = document.getElementById(`era${side}`).value.trim();
  const btn       = document.getElementById(`lookup${side}`);
  const preview   = document.getElementById(`preview-${side}`);

  if (!teamInput) {
    preview.classList.add('hidden');
    return;
  }

  btn.disabled    = true;
  btn.textContent = t('lookup-searching');

  try {
    const params = new URLSearchParams({ team: teamInput });
    if (eraInput) params.set('era', eraInput);

    // 30s timeout — external scrapers can be slow for historic teams
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 30000);
    let res;
    try {
      res = await fetch(`/lookup?${params}`, { signal: ctrl.signal });
    } finally {
      clearTimeout(tid);
    }

    if (!res.ok) throw new Error(`Servidor: HTTP ${res.status}`);
    const data = await res.json();

    if (!data.found) {
      document.getElementById(`preview-source-${side}`).textContent =
        `${t('fail-lookup')}: "${teamInput}"${eraInput ? ' · ' + eraInput : ''}`;
      document.getElementById(`preview-players-${side}`).innerHTML =
        `<div class="lk-hint">${t('hint-lookup')}</div>`;
      _lookupCache[side] = null;
    } else {
      _lookupCache[side] = data;

      document.getElementById(`preview-source-${side}`).textContent =
        `✅ ${data.source}`;

      _renderLookupPlayers(side, data);

      // Auto-fill formation if found
      const formSel = document.getElementById(`formation${side}`);
      if (data.formation && formSel) {
        const opt = [...formSel.options].find(o => o.value === data.formation);
        if (opt) formSel.value = data.formation;
      }
    }

    preview.classList.remove('hidden');

  } catch (err) {
    const msg = err.name === 'AbortError'
      ? t('timeout-lookup')
      : err.message === 'Failed to fetch'
        ? t('no-connection')
        : `Error: ${err.message}`;
    document.getElementById(`preview-source-${side}`).textContent = `⚠️ ${msg}`;
    document.getElementById(`preview-players-${side}`).innerHTML = '';
    preview.classList.remove('hidden');
    _lookupCache[side] = null;
  } finally {
    btn.disabled    = false;
    btn.textContent = t('lookup-btn');
  }
}

// ── Main handler — called by the "Simulate Match" button ──
async function handleSimulate() {
  const teamA = document.getElementById('teamA').value.trim();
  const teamB = document.getElementById('teamB').value.trim();

  // Basic validation
  if (!teamA || !teamB) {
    showError(t('error-no-teams'));
    return;
  }
  if (teamA.length > 80 || teamB.length > 80) {
    showError(t('error-too-long'));
    return;
  }

  clearError();

  // ── Clear previous match state ────────────────────────────────
  ['prematch-screen', 'live-viewer', 'event-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('pm-fade-out', 'live-fade-out', 'eo-fade-in', 'eo-fade-out');
    }
  });
  document.getElementById('results')?.classList.add('hidden');
  if (_liveTimer)         { clearTimeout(_liveTimer);          _liveTimer = null; }
  if (_liveClockInterval) { clearInterval(_liveClockInterval); _liveClockInterval = null; }

  setLoading(true);

  const payload = {
    teamA,
    teamB,
    eraA:       document.getElementById('eraA').value.trim(),
    eraB:       document.getElementById('eraB').value.trim(),
    formationA: document.getElementById('formationA').value || _lookupCache['A']?.formation || '',
    formationB: document.getElementById('formationB').value || _lookupCache['B']?.formation || '',
    matchMode:  _matchMode,
    stadium:    _selectedStadium ? _selectedStadium.id : null,
    matchSalt:  Date.now() & 0x7fffffff,
  };

  try {
    // ── POST /simulate ──────────────────────────────────
    const response = await fetch('/simulate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${response.status}`);
    }

    const data = await response.json();
    showPreMatch(data, payload);

  } catch (err) {
    showError(`Error en la simulación: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

// ── Render all result sections ────────────────────────────
function renderResult(data, payload) {
  const { lineups, ratings, probabilities, finalScore, altScores, simulation } = data;

  // Show results section with animation
  const section = document.getElementById('results');
  section.classList.remove('hidden');
  section.classList.add('fade-in');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ── Score poster ───────────────────────────────────────
  document.getElementById('poster-name-a').textContent = payload.teamA;
  document.getElementById('poster-era-a').textContent  = payload.eraA || '';
  document.getElementById('poster-name-b').textContent = payload.teamB;
  document.getElementById('poster-era-b').textContent  = payload.eraB || '';
  animateScore(0, finalScore.teamA, 0, finalScore.teamB);

  // ── Escudos ──────────────────────────────────────────────
  const setBadge = (id, url) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (url) { el.src = url; el.style.display = 'block'; el.classList.add('badge-loaded'); }
    else      { el.style.display = 'none'; }
  };
  setBadge('badge-a', data.badgeA || _badgeFallback(payload.teamA));
  setBadge('badge-b', data.badgeB || _badgeFallback(payload.teamB));

  // Scorers (with goal minute) — premium style
  const scorersAEl = document.getElementById('scorers-a');
  const scorersBEl = document.getElementById('scorers-b');
  const fmtGoal = g => `<div class="scorer-entry"><span class="scorer-ball">\u26bd</span><span class="scorer-name">${escHtml(g.name)}</span><span class="goal-min">${g.minute}'</span></div>`;
  scorersAEl.innerHTML = finalScore.scorersA.length
    ? finalScore.scorersA.map(fmtGoal).join('')
    : '<div class="scorer-empty">\u2014</div>';
  scorersBEl.innerHTML = finalScore.scorersB.length
    ? finalScore.scorersB.map(fmtGoal).join('')
    : '<div class="scorer-empty">\u2014</div>';

  // ── Tarjetas ───────────────────────────────────────────────────────
  const renderCards = (el, cards) => {
    if (!el) return;
    const yellows = (cards?.yellow || []).map(c => `<div class="card-entry">🟨 ${escHtml(c.name)} <span class="card-min">${c.minute}'</span></div>`).join('');
    const reds    = (cards?.red    || []).map(c => `<div class="card-entry">🟥 ${escHtml(c.name)} <span class="card-min">${c.minute}'</span></div>`).join('');
    el.innerHTML  = (yellows + reds) || '<span style="opacity:.3">—</span>';
  };
  renderCards(document.getElementById('cards-a'), finalScore.cardsA);
  renderCards(document.getElementById('cards-b'), finalScore.cardsB);
  renderTimeline(finalScore.scorersA, finalScore.scorersB, finalScore.cardsA, finalScore.cardsB, payload.teamA, payload.teamB, finalScore.matchPenalties, data.stats?.notableEvents);

  // ── Penaltis (sólo si hubo empate)
  document.getElementById('poster-label').textContent =
    t(finalScore.penalties ? 'poster-label-pens' : 'poster-label-final');
  const stadiumCtxEl = document.getElementById('poster-context');
  if (stadiumCtxEl) {
    const stadiumTxt = _selectedStadium ? `🏟️ ${_selectedStadium.name} · ${_selectedStadium.city}` : 'Partido de leyenda · Campo neutral';
    stadiumCtxEl.textContent = stadiumTxt;
  }
  renderPenalties(finalScore.penalties, payload.teamA, payload.teamB);

  // ── Resultado: destacar ganador ───────────────────────────────────
  const posterA = document.getElementById('poster-team-a');
  const posterB = document.getElementById('poster-team-b');
  posterA.classList.remove('poster-winner', 'poster-loser');
  posterB.classList.remove('poster-winner', 'poster-loser');
  if (finalScore.teamA > finalScore.teamB) {
    posterA.classList.add('poster-winner');
    posterB.classList.add('poster-loser');
  } else if (finalScore.teamB > finalScore.teamA) {
    posterB.classList.add('poster-winner');
    posterA.classList.add('poster-loser');
  }

  // ── Probabilidades ──────────────────────────────────────────────
  document.getElementById('prob-label-a').textContent = `${payload.teamA} ${t('prob-win-suffix')}`;
  document.getElementById('prob-label-b').textContent = `${payload.teamB} ${t('prob-win-suffix')}`;

  const pA = probabilities.teamA_win;
  const pD = probabilities.draw;
  const pB = probabilities.teamB_win;
  document.getElementById('prob-a').textContent    = `${pA}%`;
  document.getElementById('prob-draw').textContent = `${pD}%`;
  document.getElementById('prob-b').textContent    = `${pB}%`;

  // Animate bars (rAF ensures CSS transitions fire)
  requestAnimationFrame(() => {
    document.getElementById('bar-a').style.width = `${pA}%`;
    document.getElementById('bar-d').style.width = `${pD}%`;
    document.getElementById('bar-b').style.width = `${pB}%`;
  });

  // Alt scorelines
  const altEl = document.getElementById('alt-scores-list');
  altEl.innerHTML = altScores
    .map(s => `<span class="alt-score-chip">${escHtml(s.score)} <small>(${s.probability}%)</small></span>`)
    .join('');

  // xG + iterations
  document.getElementById('xg-a').textContent     = simulation.xgA;
  document.getElementById('xg-b').textContent     = simulation.xgB;
  document.getElementById('sim-iters').textContent = `${simulation.iterations.toLocaleString()} ${t('sim-iters-suffix')}`;

  // ── Estadísticas + Mejor jugador ──────────────────────
  renderHthBars(ratings, data.stats, payload.teamA, payload.teamB);
  renderMoM(data.stats?.manOfMatch);

  // ── Alineaciones ────────────────────────────────────────────
  renderLineup('a', lineups.teamA, payload.teamA, payload.eraA, data.badgeA || _badgeFallback(payload.teamA));
  renderLineup('b', lineups.teamB, payload.teamB, payload.eraB, data.badgeB || _badgeFallback(payload.teamB));
}

// ── Lineup pitch renderer ─────────────────────────────────
/**
 * Groups players by position row and renders a mini-pitch layout.
 * Position rows: GK(0) → CB/RB/LB(1) → DM(2) → CM/RM/LM(3) → AM(3.5) → RW/LW/ST(4)
 */
const POS_ROW = { GK:0, RB:1, CB:1, LB:1, DM:2, CM:3, RM:3, LM:3, AM:3.5, RW:4, LW:4, ST:4 };

// Team colour palettes — indexed by 'a' or 'b'
const JERSEY_COLORS = {
  a: { bg: '#1a56db', txt: '#ffffff' },
  b: { bg: '#c0392b', txt: '#ffffff' },
};

const POS_DESCRIPTIONS = {
  GK: 'Portero',          RB: 'Lateral Derecho',  CB: 'Central',
  LB: 'Lateral Izquierdo',DM: 'Mediocentro Def.', CM: 'Centrocampista',
  RM: 'Interior Derecho', LM: 'Interior Izquierdo',AM: 'Mediapunta',
  RW: 'Extremo Derecho',  LW: 'Extremo Izquierdo',ST: 'Delantero Centro',
};

function renderLineup(side, lineup, teamName, era, badgeUrl) {
  const titleEl = document.getElementById(`lineup-title-${side}`);
  titleEl.textContent = '';
  if (badgeUrl) {
    const img = document.createElement('img');
    img.className = 'lineup-badge';
    img.src       = badgeUrl;
    img.alt       = '';
    img.onerror   = () => img.remove();
    titleEl.appendChild(img);
  }
  titleEl.appendChild(document.createTextNode(era ? `${teamName} · ${era}` : teamName));
  document.getElementById(`formation-${side}-badge`).textContent = lineup.formation;
  document.getElementById(`source-${side}`).textContent = lineup.source;

  // Group by row — respect match mode player count
  const nPlayersRL = { '3v3':3, '5v5':5, '11v11':11 }[_matchMode] || 11;
  const rows = {};
  lineup.players.slice(0, nPlayersRL).forEach(p => {
    const row = POS_ROW[p.position] ?? 3;
    (rows[row] = rows[row] || []).push(p);
  });

  const pitch = document.getElementById(`pitch-${side}`);
  pitch.innerHTML = '';
  const { primary: kitPrimary, secondary: kitSecondary } = _getKitColors(teamName, side.toLowerCase());
  const kitBg  = kitPrimary  || JERSEY_COLORS[side].bg;

  Object.keys(rows).sort((a, b) => a - b).forEach(rowKey => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'pitch-row';
    rows[rowKey].forEach(player => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      const posDesc = POS_DESCRIPTIONS[player.position] || player.position;
      chip.innerHTML = `
        <div class="player-jersey">${_jerseyIcon(kitBg, _JERSEY_NUM[player.position] ?? '?', kitSecondary)}</div>
        <div class="player-name">${escHtml(player.name)}</div>
        <div class="player-tooltip">
          <span class="tooltip-pos">${escHtml(player.position)}</span>
          <span class="tooltip-name">${escHtml(player.name)}</span>
          <span class="tooltip-desc">${escHtml(posDesc)}</span>
        </div>
      `;
      rowDiv.appendChild(chip);
    });
    pitch.appendChild(rowDiv);
  });
}

// ── Animated score counter ────────────────────────────────
function animateScore(fromA, toA, fromB, toB) {
  const el  = document.getElementById('poster-score');
  const dur = 900;
  const t0  = performance.now();
  function step(now) {
    const p  = Math.min(1, (now - t0) / dur);
    const ea = Math.round(fromA + (toA - fromA) * p);
    const eb = Math.round(fromB + (toB - fromB) * p);
    el.textContent = `${ea} : ${eb}`;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Match timeline (broadcast-style 3-column) ──────────────
function renderTimeline(scorersA, scorersB, cardsA, cardsB, teamA, teamB, matchPenalties = [], notableEvents = []) {
  const events = [
    ...(scorersA || []).map(s => ({ ...s, type: 'goal',     side: 'A' })),
    ...(scorersB || []).map(s => ({ ...s, type: 'goal',     side: 'B' })),
    ...((cardsA?.yellow) || []).map(c => ({ ...c, type: 'yellow',  side: 'A' })),
    ...((cardsA?.red)    || []).map(c => ({ ...c, type: 'red',     side: 'A' })),
    ...((cardsB?.yellow) || []).map(c => ({ ...c, type: 'yellow',  side: 'B' })),
    ...((cardsB?.red)    || []).map(c => ({ ...c, type: 'red',     side: 'B' })),
    ...(matchPenalties || []).map(p => ({ type: p.scored ? 'penalty' : 'penalty-miss', side: p.side, minute: p.minute, name: p.taker })),
    ...(notableEvents  || []).map(e => ({ type: e.type, side: e.side, minute: e.minute, name: e.name || null })),
  ].sort((a, b) => a.minute - b.minute);

  const evCount = events.length;
  const header = document.getElementById('timeline-header');
  header.innerHTML = `<span style="color:var(--accent-a)">${escHtml(teamA)}</span><span class="timeline-count">${evCount} ${evCount !== 1 ? t('timeline-events-suffix-pl') : t('timeline-events-suffix')}</span><span style="color:var(--accent-b)">${escHtml(teamB)}</span>`;

  const container = document.getElementById('timeline-events');
  if (!events.length) {
    container.innerHTML = `<div class="t-empty-match">${t('timeline-empty')}</div>`;
    return;
  }
  container.innerHTML = events.map(ev => {
    let icon, suffix;
    switch (ev.type) {
      case 'goal':         icon = '⚽'; suffix = ''; break;
      case 'yellow':       icon = '🟨'; suffix = ''; break;
      case 'red':          icon = '🟥'; suffix = ''; break;
      case 'penalty':      icon = '⚽'; suffix = ` <span class="t-tag t-tag-pen">${t('ev-tag-pen')}</span>`; break;
      case 'penalty-miss': icon = '❌'; suffix = ` <span class="t-tag t-tag-miss">${t('ev-tag-miss')}</span>`; break;
      case 'corner':       icon = '🚩'; suffix = ` <span class="t-tag t-tag-corner">${t('ev-tag-corner')}</span>`; break;
      case 'freekick':     icon = '🎯'; suffix = ` <span class="t-tag t-tag-fk">${t('ev-tag-fk')}</span>`; break;
      default:             icon = '•';  suffix = ''; break;
    }
    const isA  = ev.side === 'A';
    const nameStr = ev.name ? escHtml(ev.name) : (ev.type === 'corner' ? '' : '');
    const label = `${icon}${nameStr ? ' ' + nameStr : ''}${suffix}`;
    return `<div class="t-event"><div class="t-left">${isA ? label : ''}</div><div class="t-mid"><span class="t-icon">${icon}</span><span class="t-min">${ev.minute}'</span></div><div class="t-right">${!isA ? label : ''}</div></div>`;
  }).join('');
}

// ── Head-to-head attribute + stat bars ────────────────────
function renderHthBars(ratings, stats, teamA, teamB) {
  document.getElementById('hth-name-a').textContent = teamA;
  document.getElementById('hth-name-b').textContent = teamB;

  const poss    = stats?.possession || { teamA: 50,  teamB: 50  };
  const shots   = stats?.shots      || { teamA: 5,   teamB: 5   };
  const corners = stats?.corners    || { teamA: 4,   teamB: 4   };
  const fouls   = stats?.fouls      || { teamA: 10,  teamB: 10  };
  const saves   = stats?.saves      || { teamA: 3,   teamB: 3   };
  const extraRows = [
    { label: t('hth-possession'),  vA: poss.teamA,    vB: poss.teamB,    suffix: '%' },
    { label: t('hth-shots'),       vA: shots.teamA,   vB: shots.teamB,   suffix: ''  },
    { label: t('hth-corners'),     vA: corners.teamA, vB: corners.teamB, suffix: ''  },
    { label: t('hth-saves'),       vA: saves.teamA,   vB: saves.teamB,   suffix: ''  },
    { label: t('hth-fouls'),       vA: fouls.teamA,   vB: fouls.teamB,   suffix: '',  lowerWins: true },
  ];
  const attrRows = [
    { key: 'attack',      label: t('hth-attack') },
    { key: 'midfield',    label: t('hth-midfield') },
    { key: 'defense',     label: t('hth-defense') },
    { key: 'goalkeeping', label: t('hth-goalkeeping') },
  ];

  function makeRow(label, vA, vB, suffix = '', lowerWins = false) {
    const total = vA + vB || 1;
    const pctA  = Math.round(vA / total * 100);
    const pctB  = 100 - pctA;
    const winA  = (lowerWins ? vA < vB : vA > vB) ? ' hth-win' : '';
    const winB  = (lowerWins ? vB < vA : vB > vA) ? ' hth-win' : '';
    return `<div class="hth-row"><div class="hth-val hth-val-a${winA}">${vA}${suffix}</div><div class="hth-track hth-track-a"><div class="hth-fill-a" data-w="${pctA}"></div></div><div class="hth-label">${label}</div><div class="hth-track"><div class="hth-fill-b" data-w="${pctB}"></div></div><div class="hth-val hth-val-b${winB}">${vB}${suffix}</div></div>`;
  }

  const container = document.getElementById('hth-rows');
  container.innerHTML =
    attrRows.map(a => makeRow(a.label, ratings.teamA[a.key], ratings.teamB[a.key])).join('') +
    '<div class="stat-sep"></div>' +
    extraRows.map(r => makeRow(r.label, r.vA, r.vB, r.suffix, r.lowerWins)).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
  });
}

// ── Man of the Match card ──────────────────────────────────
function renderMoM(mom) {
  if (!mom) return;
  document.getElementById('mom-name').textContent = mom.name;
  const teamColor = mom.team === 'A' ? 'var(--accent-a)' : 'var(--accent-b)';
  document.getElementById('mom-meta').innerHTML =
    `${escHtml(mom.teamName)} · <span style="color:${teamColor}">${escHtml(mom.reason)}</span>`;
}

// ── Pre-match player card presentation ──────────────────────
let _pmData = null, _pmPayload = null, _pmTick = 667; // ms per simulated minute (default 1 min)

function selectSpeed(btn) {
  document.querySelectorAll('.pm-speed-pill').forEach(b => b.classList.remove('pm-speed-active'));
  btn.classList.add('pm-speed-active');
  _pmTick = parseInt(btn.dataset.tick, 10);
}

function showPreMatch(data, payload) {
  _pmData    = data;
  _pmPayload = payload;

  const screen = document.getElementById('prematch-screen');
  screen.classList.remove('hidden', 'pm-fade-out');
  screen.scrollIntoView({ behavior: 'smooth', block: 'start' });

  buildPreMatchSide('a', data.lineups.teamA, payload.teamA, payload.eraA, data.badgeA || _badgeFallback(payload.teamA), data.ratings.teamA);
  buildPreMatchSide('b', data.lineups.teamB, payload.teamB, payload.eraB, data.badgeB || _badgeFallback(payload.teamB), data.ratings.teamB);

  // Show stadium info if selected
  const pmStadInfo = document.getElementById('pm-stadium-info');
  if (pmStadInfo) {
    if (_selectedStadium) {
      const s = _selectedStadium;
      pmStadInfo.innerHTML = `<span class="pm-stad-icon">🏟️</span> <span class="pm-stad-name">${escHtml(s.name)}</span> <span class="pm-stad-loc">${escHtml(s.city)} · ${s.capacity.toLocaleString()}</span>`;
      pmStadInfo.classList.remove('hidden');
    } else {
      pmStadInfo.classList.add('hidden');
    }
  }

  // Reset speed pills to default (1 min)
  _pmTick = 667;
  document.querySelectorAll('.pm-speed-pill').forEach(b => {
    b.classList.toggle('pm-speed-active', parseInt(b.dataset.tick, 10) === 667);
  });
}

function skipPreMatch() {
  // Read the current starter cards from the DOM and apply any pre-match
  // substitutions the user made to _pmData before launching the simulation.
  const _readLineupFromDom = (side, originalLineup) => {
    const block = document.getElementById(`pm-block-${side}`);
    if (!block) return originalLineup;
    const starters = [...block.querySelectorAll('.pm-starter')]
      .map(c => ({ name: c.dataset.playerName, position: c.dataset.playerPos }))
      .filter(p => p.name && p.position);
    if (starters.length === 0) return originalLineup;
    return { ...originalLineup, players: starters };
  };

  const updatedData = {
    ..._pmData,
    lineups: {
      teamA: _readLineupFromDom('a', _pmData.lineups.teamA),
      teamB: _readLineupFromDom('b', _pmData.lineups.teamB),
    },
  };

  const screen = document.getElementById('prematch-screen');
  screen.classList.add('pm-fade-out');
  setTimeout(() => {
    screen.classList.add('hidden');
    screen.classList.remove('pm-fade-out');
    playLiveMatch(updatedData, _pmPayload, _pmTick);
  }, 400);
}

function buildPreMatchSide(side, lineup, teamName, era, badgeUrl, ratings) {
  const block = document.getElementById(`pm-block-${side}`);
  block.innerHTML = '';

  // ── Premium header with big badge ──────────────────────
  const hdr = document.createElement('div');
  hdr.className = `pm-team-hdr${side === 'b' ? ' pm-team-hdr-b' : ''}`;

  // Big badge zone
  const badgeZone = document.createElement('div');
  badgeZone.className = 'pm-badge-zone';
  if (badgeUrl) {
    const img = document.createElement('img');
    img.className = 'pm-badge-big';
    img.src = badgeUrl;
    img.alt = '';
    img.onerror = () => { img.style.display = 'none'; };
    badgeZone.appendChild(img);
  } else {
    badgeZone.innerHTML = `<div class="pm-badge-placeholder">${escHtml(teamName.slice(0,3).toUpperCase())}</div>`;
  }

  const info = document.createElement('div');
  info.className = 'pm-hdr-info';
  info.innerHTML =
    `<div class="pm-hdr-name">${escHtml(teamName)}</div>` +
    (era ? `<div class="pm-hdr-era">📅 ${escHtml(era)}</div>` : '') +
    `<div class="pm-hdr-form"><span class="pm-form-tag">${escHtml(lineup.formation)}</span></div>`;

  if (side === 'b') {
    hdr.appendChild(info);
    hdr.appendChild(badgeZone);
  } else {
    hdr.appendChild(badgeZone);
    hdr.appendChild(info);
  }
  block.appendChild(hdr);

  // ── Rating bar under header ─────────────────────────────
  const overallRating = Math.round((ratings.attack + ratings.midfield + ratings.defense + ratings.goalkeeping) / 4);
  const ratingBar = document.createElement('div');
  ratingBar.className = `pm-rating-bar pm-rating-bar-${side}`;
  ratingBar.innerHTML = `<span class="pm-rating-num">${overallRating}</span><span class="pm-rating-lbl">OVR</span>`;
  block.appendChild(ratingBar);

  // ── Rows (attack first → descending POS_ROW sort) — respect match mode ─
  const _nPM = { '3v3':3, '5v5':5, '11v11':11 }[_matchMode] || 11;
  const rows = {};
  lineup.players.slice(0, _nPM).forEach(p => {
    const r = POS_ROW[p.position] ?? 3;
    (rows[r] = rows[r] || []).push(p);
  });
  const rowsWrap = document.createElement('div');
  rowsWrap.className = 'pm-rows';
  let cardIdx = 0;
  const { primary: pmKit1, secondary: pmKit2 } = _getKitColors(teamName, side.toLowerCase());
  Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(rowKey => {
    const rowEl = document.createElement('div');
    rowEl.className = `pm-row${side === 'b' ? ' pm-row-b' : ''}`;
    rows[rowKey].forEach(player => {
      const card = buildPlayerCard(player, ratings, 60 + cardIdx * 45, side, badgeUrl, pmKit1, pmKit2);
      card.dataset.slot   = player.name;
      card.dataset.pmSide = side;
      card.classList.add('pm-starter');
      card.title = `${player.name} — clic para cambio`;
      card.addEventListener('click', () => _handlePmCardClick(card, side));
      rowEl.appendChild(card);
      cardIdx++;
    });
    rowsWrap.appendChild(rowEl);
  });
  block.appendChild(rowsWrap);

  // ── Bench section — only if at least one real squad player ──────
  const realBench = _matchMode === '11v11' ? (lineup.bench || []).filter(p => p.isReal) : [];
  if (realBench.length > 0) {
    const benchLabel = document.createElement('div');
    benchLabel.className = 'pm-bench-label';
    benchLabel.textContent = t('bench-label');
    block.appendChild(benchLabel);

    const benchRow = document.createElement('div');
    benchRow.className = `pm-bench-row${side === 'b' ? ' pm-row-b' : ''}`;
    realBench.forEach((player, i) => {
      const card = buildPlayerCard(player, ratings, 60 + (cardIdx + i) * 30, side, badgeUrl, pmKit1, pmKit2);
      card.classList.add('pm-card-bench');
      card.dataset.slot   = player.name;
      card.dataset.pmSide = side;
      card.classList.add('pm-sub');
      card.title = `${player.name} — clic para sustituir`;
      card.addEventListener('click', () => _handlePmCardClick(card, side));
      benchRow.appendChild(card);
    });
    block.appendChild(benchRow);
  }
}

// ── Pre-match substitution interaction ──────────────────────
// State: stores selected card for swapping
const _pmSubState = { a: null, b: null };

function _handlePmCardClick(card, side) {
  const state = _pmSubState;
  const lside = side.toLowerCase();
  const isSub = card.classList.contains('pm-sub');

  // If nothing selected yet → select this card (highlight)
  if (!state[lside]) {
    card.classList.add('pm-selected');
    state[lside] = card;
    return;
  }

  const selected = state[lside];
  if (selected === card) {
    // Deselect on second click of same card
    card.classList.remove('pm-selected');
    state[lside] = null;
    return;
  }

  // Swap selected ↔ this card only if one is starter and one is bench
  const selectedIsSub = selected.classList.contains('pm-sub');
  if (isSub === selectedIsSub) {
    // Both same type — just re-select
    selected.classList.remove('pm-selected');
    card.classList.add('pm-selected');
    state[lside] = card;
    return;
  }

  // Perform swap: exchange innerHTML content + data attributes + title
  const aHtml = selected.innerHTML;
  const bHtml = card.innerHTML;
  selected.innerHTML = bHtml;
  card.innerHTML = aHtml;

  // Swap player data so DOM state stays consistent with visual content
  const aName = selected.dataset.playerName, aPos = selected.dataset.playerPos, aTitle = selected.title;
  selected.dataset.playerName = card.dataset.playerName;
  selected.dataset.playerPos  = card.dataset.playerPos;
  selected.title              = card.title;
  card.dataset.playerName = aName;
  card.dataset.playerPos  = aPos;
  card.title              = aTitle;

  // Swap the pm-sub / pm-starter class marker
  if (selectedIsSub) {
    selected.classList.remove('pm-sub');  selected.classList.add('pm-starter');
    card.classList.remove('pm-starter');  card.classList.add('pm-sub');
  } else {
    selected.classList.remove('pm-starter'); selected.classList.add('pm-sub');
    card.classList.remove('pm-sub');         card.classList.add('pm-starter');
  }

  // Show toast confirmation
  showToast(t('sub-change-toast'));

  // Deselect both
  selected.classList.remove('pm-selected');
  card.classList.remove('pm-selected');
  state[lside] = null;
}

// Footballer SVG silhouette — proper filled shapes
const _SILHOUETTE = `<svg viewBox="0 0 56 74" xmlns="http://www.w3.org/2000/svg">
  <circle cx="28" cy="10" r="8"/>
  <path d="M28 18 C20 18 13 22 11 28 L9 38 L19 40 L19 56 L37 56 L37 40 L47 38 L45 28 C43 22 36 18 28 18Z"/>
  <path d="M11 28 L5 33 L7 42 L19 40 L19 34Z" opacity=".72"/>
  <path d="M45 28 L51 33 L49 42 L37 40 L37 34Z" opacity=".72"/>
  <path d="M19 56 L16 72 L24 72 L28 61 L32 72 L40 72 L37 56Z" opacity=".68"/>
</svg>`;

const _KIT_COLORS = { a: '#1a56db', b: '#c0392b' };

// ── Team kit colors (primary shirt) — keyed by lowercase normalized name ──
const _TEAM_KIT_MAP = {
  // National teams
  'spain':'#c60b1e', 'españa':'#c60b1e', 'espana':'#c60b1e',
  'germany':'#ffffff', 'alemania':'#ffffff', 'deutschland':'#ffffff', 'west germany':'#ffffff',
  'france':'#003189', 'francia':'#003189',
  'brazil':'#f9c30e', 'brasil':'#f9c30e',
  'argentina':'#74acdf', 'argentina 1986':'#74acdf',
  'italy':'#003da5', 'italia':'#003da5',
  'england':'#ffffff', 'inglaterra':'#ffffff',
  'portugal':'#006600', 'portugal 1966':'#006600',
  'netherlands':'#ff6600', 'holanda':'#ff6600', 'holland':'#ff6600',
  'belgium':'#d01020', 'belgica':'#d01020',
  'croatia':'#ff2020', 'croacia':'#ff2020',
  'denmark':'#c60c30', 'dinamarca':'#c60c30',
  'sweden':'#006aa7', 'suecia':'#006aa7',
  'norway':'#ef2b2d', 'noruega':'#ef2b2d',
  'scotland':'#003da5', 'escocia':'#003da5',
  'ireland':'#169b62', 'irlanda':'#169b62',
  'wales':'#c8102e', 'gales':'#c8102e',
  'russia':'#cc0000', 'rusia':'#cc0000',
  'ukraine':'#0057b7', 'ucrania':'#0057b7',
  'turkey':'#e30a17', 'turquia':'#e30a17',
  'mexico':'#006847', 'méxico':'#006847',
  'usa':'#002868', 'estados unidos':'#002868',
  'colombia':'#fcd116',
  'chile':'#d52b1e',
  'uruguay':'#5aaad0',
  'paraguay':'#d52b1e',
  'ecuador':'#ffd100',
  'peru':'#d91023', 'perú':'#d91023',
  'venezuela':'#cf142b',
  'senegal':'#00853f',
  'nigeria':'#008751',
  'ghana':'#006b3f',
  'cameroon':'#007a5e', 'camerún':'#007a5e',
  'morocco':'#c1272d', 'marruecos':'#c1272d',
  'egypt':'#c8102e', 'egipto':'#c8102e',
  'japan':'#003087', 'japón':'#003087', 'japon':'#003087',
  'south korea':'#c60c30', 'corea':'#c60c30',
  'australia':'#f9c30e',
  'iran':'#239f40',
  'saudi arabia':'#006c35',
  'china':'#de2910',
  // Club teams — European
  'real madrid':'#ffffff',
  'barcelona':'#a50044',
  'atletico madrid':'#cc0000', 'atlético madrid':'#cc0000',
  'sevilla':'#ffffff',
  'valencia':'#ff8c00',
  'villarreal':'#f7d000',
  'athletic club':'#cc0000', 'athletic bilbao':'#cc0000',
  'manchester united':'#da291c',
  'manchester city':'#6cabdd',
  'liverpool':'#c8102e',
  'arsenal':'#ef0107',
  'chelsea':'#034694',
  'tottenham':'#132257', 'tottenham hotspur':'#132257',
  'everton':'#003399',
  'leicester':'#003090', 'leicester city':'#003090',
  'aston villa':'#95bfe5',
  'newcastle':'#000000', 'newcastle united':'#000000',
  'west ham':'#7a263a', 'west ham united':'#7a263a',
  'leeds':'#ffffff', 'leeds united':'#ffffff',
  'juventus':'#000000',
  'ac milan':'#fb090b', 'milan':'#fb090b',
  'inter milan':'#0068a8', 'inter':'#0068a8', 'internazionale':'#0068a8',
  'napoli':'#0067b1',
  'roma':'#8e1f2f', 'as roma':'#8e1f2f',
  'lazio':'#87ceeb',
  'fiorentina':'#4b0082',
  'atalanta':'#0000cd',
  'torino':'#8b0000',
  'sampdoria':'#003da5',
  'parma':'#0046a0',
  'udinese':'#000000',
  'bologna':'#bc0000',
  'ajax':'#9b0000',
  'psv':'#d00022', 'psv eindhoven':'#d00022',
  'feyenoord':'#c40022',
  'porto':'#003087',
  'benfica':'#cc0000',
  'sporting cp':'#006600', 'sporting':'#006600',
  'braga':'#9b0000',
  'celtic':'#16a929',
  'rangers':'#003da5',
  'anderlecht':'#6a0dad',
  'club brugge':'#003087',
  'standard liege':'#c40022',
  'marseille':'#009fda', 'olympique marseille':'#009fda',
  'paris saint-germain':'#003189', 'psg':'#003189',
  'lyon':'#0063a0', 'olympique lyon':'#0063a0',
  'monaco':'#e50020', 'as monaco':'#e50020',
  'lille':'#c60b1e',
  'bordeaux':'#003189',
  'nice':'#c60b1e',
  'lens':'#ffd700',
  'rc lens':'#ffd700',
  'rennes':'#cc0000',
  'bayern munich':'#dc052d', 'fc bayern':'#dc052d',
  'borussia dortmund':'#fde100', 'dortmund':'#fde100',
  'bayer leverkusen':'#e32221', 'leverkusen':'#e32221',
  'rb leipzig':'#cc1433', 'red bull leipzig':'#cc1433',
  'schalke':'#004b9c', 'fc schalke':'#004b9c',
  'borussia mönchengladbach':'#000000',
  'wolfsburg':'#65b32e',
  'eintracht frankfurt':'#e2001a', 'frankfurt':'#e2001a',
  'hamburger sv':'#005ca8', 'hamburg':'#005ca8',
  'stuttgart':'#e32221',
  'werder bremen':'#1d5e2b', 'bremen':'#1d5e2b',
  'real sociedad':'#003da5',
  'real betis':'#007e33',
  'celta vigo':'#87ceeb',
  'deportivo la coruna':'#003da5',
  'osasuna':'#c60b1e',
  'getafe':'#0033a0',
  'girona':'#9b0000',
  'fenerbahce':'#f9c30e', 'fenerbahçe':'#f9c30e',
  'galatasaray':'#c8102e',
  'besiktas':'#000000', 'beşiktaş':'#000000',
  'shakhtar donetsk':'#f08000',
  'dinamo kyiv':'#ffffff',
  'spartak moscow':'#c8102e',
  'cska moscow':'#cc0000',
  'red star belgrade':'#cc0000', 'estrella roja':'#cc0000',
  'dinamo zagreb':'#003da5',
  'panathinaikos':'#006400',
  'olympiakos':'#cc0000',
  'celtic 1967':'#16a929',
  // South American clubs
  'boca juniors':'#f9c30e',
  'river plate':'#cc0000',
  'flamengo':'#ed1c24',
  'corinthians':'#000000',
  'são paulo':'#cc0000', 'sao paulo':'#cc0000',
  'santos':'#000000',
  'cruzeiro':'#003da5',
  'atletico mineiro':'#000000',
  'gremio':'#003da5', 'grêmio':'#003da5',
  'nacional':'#ffffff',
  'peñarol':'#f9c30e',
  'colo-colo':'#ffffff',
  'universitario':'#cc0000',
  'alianza lima':'#003da5',
};

// Secondary/sleeve colour accents per team
const _TEAM_KIT_SECONDARY = {
  'germany':'#000000','alemania':'#000000',
  'argentina':'#75b2dd','brazil':'#009c3b','brasil':'#009c3b',
  'italy':'#ffffff','italia':'#ffffff',
  'netherlands':'#ffffff','holanda':'#ffffff','holland':'#ffffff',
  'england':'#cc0000','spain':'#f7c948','españa':'#f7c948',
  'france':'#cc0000','francia':'#cc0000',
  'portugal':'#006600',
  'croatia':'#cc0000','croacia':'#cc0000',
  'belgium':'#f7c948','bélgica':'#f7c948',
  'fc barcelona':'#004d98','barcelona':'#004d98',
  'real madrid':'#f7c948',
  'manchester united':'#ffe000','manchester city':'#ffffff',
  'juventus':'#ffffff','ac milan':'#000000','milan':'#000000',
  'inter milan':'#003da5','inter':'#003da5',
  'borussia dortmund':'#000000','dortmund':'#000000',
  'ajax':'#ffffff',
  'atletico madrid':'#002d6a','atlético madrid':'#002d6a',
  'river plate':'#cc0000','boca juniors':'#f7c948',
  'celtic':'#ffffff','rangers':'#cc0000',
  'porto':'#0070b8','benfica':'#cc0000',
  'psg':'#cc0000','paris saint-germain':'#cc0000',
  'arsenal':'#ffffff','chelsea':'#cc0000','liverpool':'#000000',
  'tottenham':'#000034','tottenham hotspur':'#000034',
  'sevilla':'#cc0000','villarreal':'#000000',
  'lyon':'#0047ab','marseille':'#000034',
  'leverkusen':'#000000','bayer leverkusen':'#000000',
  'rb leipzig':'#cc0000',
  'napoli':'#ffffff','lazio':'#003da5',
  'roma':'#cc0000','as roma':'#cc0000',
};

function _getKitColor(teamLabel, fallbackSide) {
  if (!teamLabel) return _KIT_COLORS[fallbackSide] || _KIT_COLORS.a;
  const key = teamLabel.toLowerCase().replace(/\s+\d{4}(-\d{2,4})?$/, '').trim();
  return _TEAM_KIT_MAP[key] || _TEAM_KIT_MAP[key.replace(/\s+(fc|cf|ac|as|rc|sc|1\.?\s*fc|united|city|town|club)$/i, '').trim()] || _KIT_COLORS[fallbackSide] || _KIT_COLORS.a;
}

function _getKitColors(teamLabel, fallbackSide) {
  const primary   = _getKitColor(teamLabel, fallbackSide);
  const key       = teamLabel ? teamLabel.toLowerCase().replace(/\s+\d{4}(-\d{2,4})?$/, '').trim() : '';
  const secondary = _TEAM_KIT_SECONDARY[key]
    || _TEAM_KIT_SECONDARY[key.replace(/\s+(fc|cf|ac|as|rc|sc|1\.?\s*fc|united|city|town|club)$/i, '').trim()]
    || null;
  return { primary, secondary };
}

// Jersey number by position (FUT-style defaults)
const _JERSEY_NUM = { GK:1, RB:2, CB:5, LB:3, DM:6, CM:8, RM:7, LM:11, AM:10, RW:7, LW:11, ST:9 };

// ── Jersey SVG shirt icon ────────────────────────────────────
// Renders a football-shirt silhouette with a number inside
function _jerseyIcon(col, num, col2) {
  const sl = col2 || 'rgba(0,0,0,.20)';
  return `<svg viewBox="0 0 54 60" xmlns="http://www.w3.org/2000/svg">
    <path d="M8,2 Q14,7 27,7 Q40,7 46,2 L54,8 L54,24 L44,22 L44,58 L10,58 L10,22 L0,24 L0,8 Z"
          fill="${col}" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
    <path d="M8,2 L0,8 L0,24 L10,22 L10,8 Z" fill="${sl}" opacity="0.85"/>
    <path d="M46,2 L54,8 L54,24 L44,22 L44,8 Z" fill="${sl}" opacity="0.85"/>
    <path d="M14,20 L40,20" stroke="rgba(255,255,255,.18)" stroke-width="1" stroke-dasharray="3,3"/>
    <text x="27" y="43" text-anchor="middle" dominant-baseline="middle"
          font-size="19" fill="rgba(255,255,255,.97)" font-weight="900"
          font-family="'Arial Black',Arial,sans-serif">${num}</text>
  </svg>`;
}

const _STAT_MAP = {
  GK:  [['REF',0,'goalkeeping'],['KIC',0,'goalkeeping'],['POS',0,'defense'],  ['SPD',1,'midfield']],
  CB:  [['DEF',0,'defense'],    ['FIS',0,'defense'],    ['PAS',1,'midfield'], ['VEL',1,'attack']],
  RB:  [['DEF',0,'defense'],    ['VEL',0,'attack'],     ['PAS',1,'midfield'], ['FIS',1,'defense']],
  LB:  [['DEF',0,'defense'],    ['VEL',0,'attack'],     ['PAS',1,'midfield'], ['FIS',1,'defense']],
  DM:  [['DEF',0,'defense'],    ['PAS',0,'midfield'],   ['FIS',1,'defense'],  ['TIR',1,'midfield']],
  CM:  [['PAS',0,'midfield'],   ['REG',0,'midfield'],   ['DEF',1,'defense'],  ['TIR',1,'attack']],
  RM:  [['PAS',0,'midfield'],   ['VEL',0,'attack'],     ['TIR',1,'attack'],   ['REG',1,'midfield']],
  LM:  [['PAS',0,'midfield'],   ['VEL',0,'attack'],     ['TIR',1,'attack'],   ['REG',1,'midfield']],
  AM:  [['REG',0,'midfield'],   ['TIR',0,'attack'],     ['PAS',1,'midfield'], ['VEL',1,'attack']],
  RW:  [['VEL',0,'attack'],     ['TIR',0,'attack'],     ['REG',1,'midfield'], ['PAS',1,'midfield']],
  LW:  [['VEL',0,'attack'],     ['TIR',0,'attack'],     ['REG',1,'midfield'], ['PAS',1,'midfield']],
  ST:  [['TIR',0,'attack'],     ['FIS',0,'defense'],    ['VEL',1,'attack'],   ['REG',1,'midfield']],
};

function buildPlayerCard(player, teamRatings, delayMs, side, badgeUrl, kitOverride, kit2Override) {
  const rating   = calcPlayerRating(player, teamRatings);
  const tier     = rating >= 90 ? 'elite' : rating >= 82 ? 'gold' : rating >= 72 ? 'silver' : 'bronze';
  const parts    = player.name.split(' ');
  const display  = (player.name.length <= 11 ? player.name : parts[parts.length - 1]).toUpperCase();
  const kitColor = kitOverride || _KIT_COLORS[side] || _KIT_COLORS.a;
  const kitColor2 = kit2Override || null;
  const jerseyN  = _JERSEY_NUM[player.position] ?? 0;

  // Hash for stat variation
  let h = 0;
  for (let i = 0; i < player.name.length; i++) h = ((h * 31) + player.name.charCodeAt(i)) & 0xffff;

  const statDefs = _STAT_MAP[player.position] || _STAT_MAP.CM;
  const statsHtml = statDefs.map(([label, minor, ratKey], idx) => {
    const base = teamRatings[ratKey];
    const seed = (h >> (idx * 4)) & 0xf;
    const v    = Math.max(40, Math.min(99, Math.round(base + (seed - 7) + (minor ? -5 : 3))));
    return `<div class="pmc-stat"><div class="pmc-stat-v">${v}</div><div class="pmc-stat-bar"><span style="width:${v}%"></span></div><div class="pmc-stat-l">${label}</div></div>`;
  }).join('');

  // Badge corner (team shield on card)
  const badgeCorner = badgeUrl
    ? `<img class="pmc-badge" src="${escHtml(badgeUrl)}" alt="" onerror="this.style.display='none'">`
    : '';

  // Jersey number watermark
  const jerseyNum = jerseyN ? `<div class="pmc-jersey-num">${jerseyN}</div>` : '';

  const card = document.createElement('div');
  card.className = `pm-card pm-card-${tier}`;
  card.style.animationDelay = `${delayMs}ms`;
  card.style.setProperty('--kit', kitColor);
  card.title = player.name;
  card.dataset.playerName = player.name;
  card.dataset.playerPos  = player.position;
  card.innerHTML =
    `<div class="pmc-top">${badgeCorner}<div class="pmc-ovr-pos"><div class="pmc-ovr">${rating}</div><div class="pmc-pos-tag">${escHtml(player.position)}</div></div></div>` +
    `<div class="pmc-sil">${_jerseyIcon(kitColor, jerseyN || '', kitColor2)}</div>` +
    `<div class="pmc-name">${escHtml(display)}</div>` +
    `<div class="pmc-stats">${statsHtml}</div>`;
  return card;
}

// Notable player overrides — always displayed correctly regardless of team tier.
// Keys are lowercase substrings of player name (checked with .includes).
// More specific keys first (e.g. 'sergio ramos' before 'ramos') to avoid
// false positives. Accented + unaccented variants both listed.
// ─────────────────────────────────────────────────────────────────────────────
// PLAYER_OVERRIDES — only for genuinely distinctive names / unique nicknames.
// RULE: single-word keys only when the word is globally unique in football
// (e.g. 'benzema', 'ibrahimovic', 'ronaldinho'). NEVER use common surnames
// like 'suárez', 'marcelo', 'pepe', 'henry', 'villa', etc. as standalone keys
// because they match any squad player with that surname.
// ─────────────────────────────────────────────────────────────────────────────
const PLAYER_OVERRIDES = new Map([
  // ── Goalkeepers ──────────────────────────────────────────────────────────
  ['iker casillas',      88], ['casillas',         88],
  ['gianluigi buffon',   89], ['buffon',            89],
  ['manuel neuer',       93], ['neuer',             93],
  ['thibaut courtois',   91], ['courtois',          91],
  ['jan oblak',          92], ['oblak',             92],
  ['david de gea',       87], ['de gea',            87],
  ['marc-andré ter stegen',89],['ter stegen',       89],
  ['alisson becker',     91], ['alisson',           91],
  ['ederson moraes',     88], ['ederson',           88],
  ['hugo lloris',        87], ['lloris',            87],
  ['peter schmeichel',   91], ['schmeichel',        91],
  ['petr čech',          88], ['peter cech',        88], ['čech', 88],
  ['edwin van der sar',  89], ['van der sar',       89],
  ['oliver kahn',        92], ['kahn',              92],
  ['lev yashin',         95], ['yashin',            95],
  ['dino zoff',          91], ['zoff',              91],
  ['gianluigi donnarumma',90],['donnarumma',        90],
  ['keylor navas',       86],
  ['rene higuita',       82], ['higuita',           82],
  ['walter zenga',       85],
  ['pepe reina',         84],
  // ── Defenders ────────────────────────────────────────────────────────────
  ['sergio ramos',       91],
  ['raphael varane',     89], ['raphaël varane',   89], ['varane',      89],
  ['franco baresi',      97], ['baresi',            97],
  ['paolo maldini',      97], ['maldini',           97],
  ['carles puyol',       90], ['puyol',             90],
  ['alessandro nesta',   93], ['nesta',             93],
  ['fabio cannavaro',    93], ['cannavaro',         93],
  ['roberto carlos',     91],
  ['marcelo vieira',     87], ['marcelo brozovic',  86],
  ['philipp lahm',       92], ['lahm',              92],
  ['jordi alba',         86],
  ['dani carvajal',      87], ['carvajal',          87],
  ['giorgio chiellini',  89], ['chiellini',         89],
  ['leonardo bonucci',   87], ['bonucci',           87],
  ['nemanja vidic',      88], ['vidic',             88],
  ['rio ferdinand',      89],
  ['john terry',         87],
  ['lilian thuram',      88], ['thuram',            88],
  ['bixente lizarazu',   86], ['lizarazu',          86],
  ['cafu',               90], ['cafú',              90],
  ['pepe kellermann',    86], // Pepe (Portuguese CB) only when full name stored
  ['gabriel heinze',     80], ['heinze',            80],
  ['ferland mendy',      85],
  ['éder militão',       86], ['militao',           86], ['militão',   86],
  ['david alaba',        87], ['alaba',             87],
  ['virgil van dijk',    91], ['van dijk',          91],
  ['antonio rüdiger',    85], ['rudiger',           85], ['rüdiger',   85],
  // ── Midfielders ──────────────────────────────────────────────────────────
  ['luka modrić',        91], ['luka modric',       91], ['modrić',    91], ['modric',  91],
  ['toni kroos',         91], ['kroos',             91],
  ['xavi hernández',     93], ['xavi hernandez',    93],
  ['andrés iniesta',     92], ['andres iniesta',    92], ['iniesta',   92],
  ['andrea pirlo',       93], ['pirlo',             93],
  ['zinedine zidane',    96], ['zidane',            96],
  ['michel platini',     96], ['platini',           96],
  ['xabi alonso',        91],
  ['sergio busquets',    89], ['busquets',          89],
  ['casemiro',           88],
  ['sami khedira',       84], ['khedira',           84],
  ['mesut özil',         88], ['mesut ozil',        88], ['özil',      88], ['ozil', 88],
  ['cesc fàbregas',      87], ['fabregas',          87], ['fàbregas',  87],
  ['frank lampard',      89], ['lampard',           89],
  ['steven gerrard',     89], ['gerrard',           89],
  ['paul scholes',       88], ['scholes',           88],
  ['ryan giggs',         88], ['giggs',             88],
  ['patrick vieira',     90], ['vieira',            90],
  ['claude makélélé',    88], ['makelele',          88], ['makélélé',  88],
  ['fernando redondo',   89],
  ['pablo aimar',        86], ['aimar',             86],
  ['pep guardiola',      88],
  ['federico valverde',  88],
  ['jude bellingham',    90], ['bellingham',        90],
  ['kevin de bruyne',    92], ['de bruyne',         92],
  ['eden hazard',        89], ['hazard',            89],
  ['camavinga',          85],
  ['pedri',              88], ['frenkie de jong',   88],
  // La Liga quality players — unique enough nicknames
  ['isco alarcón',       84], ['isco',              84],
  ['joaquín sánchez',    82], ['joaquín',           82],
  ['dani ceballos',      82], ['ceballos',          82],
  ['marco asensio',      83], ['asensio',           83],
  ['lucas vázquez',      82], ['lucas vázquez',     82],
  ['nacho fernández',    83],
  ['sergio canales',     83], ['canales',           83],
  ['nabil fekir',        83], ['fekir',             83],
  ['pablo fornals',      81], ['fornals',           81],
  ['dani parejo',        84], ['parejo',            84],
  ['ferran torres',      84],
  ['pablo sarabia',      82], ['sarabia',           82],
  ['mikel oyarzabal',    85], ['oyarzabal',         85],
  ['david silva',        91], // David Silva — unique enough (not generic 'silva')
  // ── Forwards / Attackers ─────────────────────────────────────────────────
  ['lionel messi',       99], ['leo messi',         99], ['messi',     99],
  ['cristiano ronaldo',  99],
  ['ronaldo nazário',    98], ['ronaldo nazario',   98],
  ['ronaldo fenomeno',   97], ['ronaldo r9',        97],
  ['ronaldinho',         96],
  ['pelé',               99], ['pele',              99],
  ['diego maradona',     99], ['maradona',          99],
  ['alfredo di stéfano', 98], ['di stéfano',        98], ['di stefano', 98],
  ['ferenc puskás',      96], ['puskas',            96], ['puskás',    96],
  ['francisco gento',    90], ['gento',             90],
  ['karim benzema',      91], ['benzema',           91],
  ['raúl gonzález',      88], ['raul gonzalez',     88],
  ['gonzalo higuaín',    85], ['higuain',           85], ['higuaín',   85],
  ['zlatan ibrahimovic', 92], ['ibrahimovic',       92], ['ibrahimović',92],
  ['robert lewandowski', 93], ['lewandowski',       93],
  ['luis suárez',        91], ['luis suarez',       91],
  ['neymar',             93],
  ['kylian mbappé',      96], ['mbappe',            96], ['mbappé',    96],
  ['arjen robben',       89], ['robben',            89],
  ['franck ribéry',      90], ['ribery',            90], ['ribéry',    90],
  ['gareth bale',        87],
  ['marco van basten',   98], ['van basten',        98],
  ['ruud van nistelrooy',88], ['van nistelrooy',    88],
  ['thierry henry',      93],
  ['jürgen klinsmann',   87], ['klinsmann',         87],
  ['thomas müller',      88], ['thomas muller',     88],
  ['ángel di maría',     88], ['angel di maria',    88], ['di maría',  88], ['di maria', 88],
  ['vinícius jr',        89], ['vinicius jr',       89], ['vinícius',  89], ['vinicius', 89],
  ['mo salah',           91], ['salah',             91],
  ['sadio mané',         89], ['sadio mane',        89],
  ['harry kane',         91],
  ['son heung-min',      88], ['heung-min',         88],
  ['antoine griezmann',  89], ['griezmann',         89],
  ['samuel eto\'o',      92], ['eto\'o',            92],
  ['carlos tevez',       88], ['tevez',             88],
  ['sergio agüero',      90], ['aguero',            90], ['agüero',    90],
  ['wayne rooney',       89], ['rooney',            89],
  ['didier drogba',      90], ['drogba',            90],
  ['michael owen',       87],
  ['rivaldo',            93],
  ['romário',            94], ['romario',           94],
  ['hristo stoichkov',   91], ['stoichkov',         91],
  ['george weah',        90],
  ['david villa',        89],
  ['lamine yamal',       87],
  ['wesley sneijder',    88], ['sneijder',          88],
  ['rafael van der vaart',84],['van der vaart',     84],
]);

function calcPlayerRating(player, teamRatings) {
  const nameLow = (player.name || '').toLowerCase();
  // Check famous-player overrides first — they always win regardless of team tier
  for (const [key, ovr] of PLAYER_OVERRIDES) {
    if (nameLow.includes(key)) return ovr;
  }
  // Fallback: team aggregate ± deterministic name hash (±8)
  const pos  = player.position;
  const base = pos === 'GK'                        ? teamRatings.goalkeeping
             : ['CB','RB','LB'].includes(pos)      ? teamRatings.defense
             : ['DM','CM','RM','LM'].includes(pos) ? teamRatings.midfield
             :                                       teamRatings.attack;
  let h = 0;
  for (let i = 0; i < player.name.length; i++) h = ((h * 31) + player.name.charCodeAt(i)) & 0xffff;
  return Math.max(55, Math.min(99, Math.round(base + (h % 17) - 8)));
}

// ── Radar (spider) chart ─────────────────────────────────────
function drawRadar(ratings, teamA, teamB) {
  const axes = [
    { label: t('radar-attack'),      vA: ratings.teamA.attack,      vB: ratings.teamB.attack },
    { label: t('radar-midfield'),    vA: ratings.teamA.midfield,    vB: ratings.teamB.midfield },
    { label: t('radar-defense'),     vA: ratings.teamA.defense,     vB: ratings.teamB.defense },
    { label: t('radar-goalkeeping'), vA: ratings.teamA.goalkeeping, vB: ratings.teamB.goalkeeping },
    { label: t('radar-physical'),    vA: Math.round((ratings.teamA.attack  + ratings.teamA.midfield)  / 2),
                         vB: Math.round((ratings.teamB.attack  + ratings.teamB.midfield)  / 2) },
  ];
  const N = axes.length;
  const cx = 100, cy = 105, R = 68;
  const angle = i => (Math.PI * 2 * i / N) - Math.PI / 2;
  const pt    = (r, i) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const maxV  = Math.max(...axes.flatMap(a => [a.vA, a.vB]), 1);

  let svg = '';
  // Grid rings
  [.25,.5,.75,1].forEach(f => {
    const pts = axes.map((_, i) => pt(R * f, i).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width=".8"/>`;
  });
  // Axis spokes
  axes.forEach((_, i) => {
    const [x, y] = pt(R, i);
    svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.12)" stroke-width=".8"/>`;
  });
  // Team A fill
  const ptsA = axes.map((a, i) => pt(R * a.vA / maxV, i).join(',')).join(' ');
  svg += `<polygon points="${ptsA}" fill="rgba(26,86,219,.3)" stroke="#4f83ff" stroke-width="2" stroke-linejoin="round"/>`;
  // Team B fill
  const ptsB = axes.map((a, i) => pt(R * a.vB / maxV, i).join(',')).join(' ');
  svg += `<polygon points="${ptsB}" fill="rgba(192,57,43,.28)" stroke="#e74c3c" stroke-width="2" stroke-linejoin="round"/>`;
  // Dots
  axes.forEach((a, i) => {
    const [xA, yA] = pt(R * a.vA / maxV, i);
    const [xB, yB] = pt(R * a.vB / maxV, i);
    svg += `<circle cx="${xA}" cy="${yA}" r="3" fill="#4f83ff"/>`;
    svg += `<circle cx="${xB}" cy="${yB}" r="3" fill="#e74c3c"/>`;
  });
  // Labels
  axes.forEach((a, i) => {
    const [x, y] = pt(R + 14, i);
    const anchor = x < cx - 6 ? 'end' : x > cx + 6 ? 'start' : 'middle';
    svg += `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"
      fill="rgba(255,255,255,.65)" font-size="8.5" font-family="sans-serif">${a.label}</text>`;
  });
  document.getElementById('radar-svg').innerHTML = svg;

  // Legend
  const leg = document.getElementById('radar-legend');
  leg.innerHTML =
    `<span class="radar-legend-item"><span class="radar-legend-dot" style="background:#4f83ff"></span>${escHtml(teamA.slice(0,14))}</span>` +
    `<span class="radar-legend-item"><span class="radar-legend-dot" style="background:#e74c3c"></span>${escHtml(teamB.slice(0,14))}</span>`;
}

// ── Live mini-pitch ───────────────────────────────────────────
// Pitch SVG dimensions (viewBox="0 0 140 200")
const _LP = { W: 140, H: 200, cx: 70, cy: 100 };

// Base pitch coordinates per position (percentage of pitch, origin = team A goal at top)
// Team A attacks downward (top half), Team B attacks upward (bottom half)
const _LP_POS_A = {
  GK: [0.50, 0.06], RB: [0.80, 0.20], CB: [0.62, 0.18], LB: [0.20, 0.20],
  DM: [0.50, 0.33], CM: [0.42, 0.40], RM: [0.75, 0.38], LM: [0.25, 0.38],
  AM: [0.50, 0.44], RW: [0.78, 0.42], LW: [0.22, 0.42], ST: [0.50, 0.46],
};
const _LP_POS_B = {
  GK: [0.50, 0.94], RB: [0.20, 0.80], CB: [0.38, 0.82], LB: [0.80, 0.80],
  DM: [0.50, 0.67], CM: [0.58, 0.60], RM: [0.25, 0.62], LM: [0.75, 0.62],
  AM: [0.50, 0.56], RW: [0.22, 0.58], LW: [0.78, 0.58], ST: [0.50, 0.54],
};

let _pitchDots = { a: [], b: [], ball: null };
let _pitchDriftInterval = null;

function initLivePitch(lineupA, lineupB) {
  const svg = document.getElementById('live-pitch-svg');
  if (!svg) return;

  // Pitch markings
  svg.innerHTML = `
    <rect x="0" y="0" width="${_LP.W}" height="${_LP.H}" rx="4" fill="#1a4a1a"/>
    <line x1="0" y1="${_LP.H/2}" x2="${_LP.W}" y2="${_LP.H/2}" stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <circle cx="${_LP.cx}" cy="${_LP.cy}" r="18" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <circle cx="${_LP.cx}" cy="${_LP.cy}" r="1.5" fill="rgba(255,255,255,.35)"/>
    <rect x="42" y="1" width="56" height="20" rx="1" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <rect x="42" y="${_LP.H-21}" width="56" height="20" rx="1" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <rect x="58" y="1" width="24" height="9" rx="1" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <rect x="58" y="${_LP.H-10}" width="24" height="9" rx="1" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <rect x="1" y="1" width="${_LP.W-2}" height="${_LP.H-2}" rx="3" fill="none" stroke="rgba(255,255,255,.15)" stroke-width=".7"/>
  `;

  // Draw team A players
  _pitchDots.a = [];
  (lineupA?.players || []).forEach((p, i) => {
    const base = _LP_POS_A[p.position] || _LP_POS_A.CM;
    const cx = base[0] * _LP.W;
    const cy = base[1] * _LP.H;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', '4.5');
    circle.setAttribute('fill', '#4f83ff');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '1');
    circle.classList.add('lp-dot');
    circle.dataset.bx = cx;
    circle.dataset.by = cy;
    circle.dataset.pos = p.position;
    svg.appendChild(circle);
    _pitchDots.a.push(circle);
  });

  // Draw team B players
  _pitchDots.b = [];
  (lineupB?.players || []).forEach((p, i) => {
    const base = _LP_POS_B[p.position] || _LP_POS_B.CM;
    const cx = base[0] * _LP.W;
    const cy = base[1] * _LP.H;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', '4.5');
    circle.setAttribute('fill', '#e74c3c');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '1');
    circle.classList.add('lp-dot');
    circle.dataset.bx = cx;
    circle.dataset.by = cy;
    circle.dataset.pos = p.position;
    svg.appendChild(circle);
    _pitchDots.b.push(circle);
  });

  // Ball
  const ball = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ball.setAttribute('cx', _LP.cx);
  ball.setAttribute('cy', _LP.cy);
  ball.setAttribute('r', '3');
  ball.setAttribute('fill', '#fff');
  ball.setAttribute('stroke', '#333');
  ball.setAttribute('stroke-width', '.8');
  ball.classList.add('lp-ball');
  svg.appendChild(ball);
  _pitchDots.ball = ball;

  // Start idle drift
  _startPitchDrift();
}

function _startPitchDrift() {
  if (_pitchDriftInterval) clearInterval(_pitchDriftInterval);
  _pitchDriftInterval = setInterval(_driftPlayers, 900);
}

function _driftPlayers() {
  const jitter = (dot, amp) => {
    const bx = parseFloat(dot.dataset.bx);
    const by = parseFloat(dot.dataset.by);
    const nx = Math.max(4, Math.min(_LP.W - 4, bx + (Math.random() - .5) * amp));
    const ny = Math.max(4, Math.min(_LP.H - 4, by + (Math.random() - .5) * amp));
    dot.setAttribute('cx', nx);
    dot.setAttribute('cy', ny);
  };
  _pitchDots.a.forEach(d => jitter(d, 6));
  _pitchDots.b.forEach(d => jitter(d, 6));
  // Ball wanders toward midfield
  if (_pitchDots.ball) {
    const bx = _LP.cx + (Math.random() - .5) * 40;
    const by = _LP.cy + (Math.random() - .5) * 40;
    _pitchDots.ball.setAttribute('cx', bx);
    _pitchDots.ball.setAttribute('cy', by);
  }
}

function animatePitchEvent(type, ev) {
  const svg = document.getElementById('live-pitch-svg');
  const phaseEl = document.getElementById('live-pitch-phase');
  if (!svg || !phaseEl) return;

  // Resolve the team name for display in the pitch phase label
  const teamLabel = ev.side === 'A'
    ? (_livePayload?.teamA || 'A')
    : (_livePayload?.teamB || 'B');

  if (type === 'goal') {
    phaseEl.textContent = `${t('phase-goal')} — ${teamLabel}`;
    // Push attacking team forward toward goal, defenders back
    const attackers = ev.side === 'A' ? _pitchDots.a : _pitchDots.b;
    const defenders = ev.side === 'A' ? _pitchDots.b : _pitchDots.a;
    attackers.forEach(d => {
      const goalY = ev.side === 'A' ? _LP.H * 0.88 : _LP.H * 0.12;
      const cx  = parseFloat(d.getAttribute('cx'));
      const cy  = parseFloat(d.getAttribute('cy'));
      d.setAttribute('cx', cx + (Math.random() - .5) * 12);
      d.setAttribute('cy', cy + (goalY - cy) * 0.4);
    });
    // Ball to goal area
    if (_pitchDots.ball) {
      _pitchDots.ball.setAttribute('cx', _LP.cx + (Math.random() - .5) * 20);
      _pitchDots.ball.setAttribute('cy', ev.side === 'A' ? _LP.H * 0.92 : _LP.H * 0.08);
    }
    // Reset toward base after 2s
    setTimeout(() => {
      phaseEl.textContent = t('phase-playing');
      _resetToBase();
    }, 2200);
  } else if (type === 'yellow' || type === 'red') {
    phaseEl.textContent = type === 'yellow'
      ? `${t('phase-yellow')} — ${teamLabel}`
      : `${t('phase-red')} — ${teamLabel}`;
    setTimeout(() => { phaseEl.textContent = t('phase-playing'); }, 1800);
  } else if (type === 'penalty-miss') {
    phaseEl.textContent = `${t('phase-pen-miss')} — ${teamLabel}`;
    setTimeout(() => { phaseEl.textContent = t('phase-playing'); }, 1800);
  } else if (type === 'corner') {
    phaseEl.textContent = `${t('phase-corner')} — ${teamLabel}`;
    if (_pitchDots.ball) {
      const cornerX = ev.side === 'A' ? _LP.W * 0.96 : _LP.W * 0.04;
      const cornerY = Math.random() < 0.5 ? _LP.H * 0.97 : _LP.H * 0.03;
      _pitchDots.ball.setAttribute('cx', cornerX);
      _pitchDots.ball.setAttribute('cy', cornerY);
    }
    setTimeout(() => { phaseEl.textContent = t('phase-playing'); _resetToBase(); }, 1100);
  } else if (type === 'freekick') {
    phaseEl.textContent = `${t('phase-freekick')} — ${teamLabel}`;
    setTimeout(() => { phaseEl.textContent = t('phase-playing'); }, 1200);
  } else if (type === 'injury') {
    phaseEl.textContent = `${t('phase-injury')} — ${teamLabel}`;
    setTimeout(() => { phaseEl.textContent = t('phase-playing'); }, 1600);
  }
}

function _resetToBase() {
  _pitchDots.a.forEach(d => {
    d.setAttribute('cx', d.dataset.bx);
    d.setAttribute('cy', d.dataset.by);
  });
  _pitchDots.b.forEach(d => {
    d.setAttribute('cx', d.dataset.bx);
    d.setAttribute('cy', d.dataset.by);
  });
  if (_pitchDots.ball) {
    _pitchDots.ball.setAttribute('cx', _LP.cx);
    _pitchDots.ball.setAttribute('cy', _LP.cy);
  }
}

function stopLivePitch() {
  if (_pitchDriftInterval) { clearInterval(_pitchDriftInterval); _pitchDriftInterval = null; }
  _pitchDots = { a: [], b: [], ball: null };
}

// ── Live match playback ───────────────────────────────────────
let _liveTimer = null;
let _liveClockInterval = null;
let _liveData    = null;
let _livePayload = null;
let _lastGoalSide = 'A';  // tracks last team to score (for overlay)
let _overlayHideTimer1 = null;  // pending "start fade-out" timer
let _overlayHideTimer2 = null;  // pending "add hidden" timer

function playLiveMatch(data, payload, tickMs = 300) {
  _liveData    = data;
  _livePayload = payload;
  if (_liveTimer)         { clearTimeout(_liveTimer);          _liveTimer = null; }
  if (_liveClockInterval) { clearInterval(_liveClockInterval); _liveClockInterval = null; }

  // ── Instant / "Directo" mode: skip live viewer entirely ─────────
  if (tickMs === 0) {
    finishLive();
    return;
  }

  const { finalScore } = data;
  const events = [
    ...(finalScore.scorersA || []).map(s => ({ ...s, type: 'goal',   side: 'A' })),
    ...(finalScore.scorersB || []).map(s => ({ ...s, type: 'goal',   side: 'B' })),
    ...((finalScore.cardsA?.yellow) || []).map(c => ({ ...c, type: 'yellow', side: 'A' })),
    ...((finalScore.cardsA?.red)    || []).map(c => ({ ...c, type: 'red',    side: 'A' })),
    ...((finalScore.cardsB?.yellow) || []).map(c => ({ ...c, type: 'yellow', side: 'B' })),
    ...((finalScore.cardsB?.red)    || []).map(c => ({ ...c, type: 'red',    side: 'B' })),
    ...(finalScore.matchPenalties || []).map(p => ({ type: p.scored ? 'penalty' : 'penalty-miss', side: p.side, minute: p.minute, name: p.taker })),
    ...(data.stats?.notableEvents || []).map(e => ({ type: e.type, side: e.side, minute: e.minute, name: e.name || '' })),
    ...(finalScore.injuriesA || []).map(i => ({ ...i, type: 'injury', side: 'A' })),
    ...(finalScore.injuriesB || []).map(i => ({ ...i, type: 'injury', side: 'B' })),
  ].sort((a, b) => a.minute - b.minute);

  // Init viewer
  const viewer = document.getElementById('live-viewer');
  viewer.classList.remove('hidden', 'live-fade-out');
  document.getElementById('live-team-a').textContent  = payload.teamA;
  document.getElementById('live-team-b').textContent  = payload.teamB;
  document.getElementById('live-clock').textContent   = "0'";
  document.getElementById('live-score-a').textContent = '0';
  document.getElementById('live-score-b').textContent = '0';
  document.getElementById('live-feed').innerHTML      = '';
  drawRadar(data.ratings, payload.teamA, payload.teamB);
  initLivePitch(data.lineups?.teamA, data.lineups?.teamB);
  viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Kickoff whistle — AudioContext unlocked by the click that triggered simulate
  if (_AC?.state === 'suspended') _AC.resume().catch(() => {});
  setTimeout(() => _playSound('whistle_start'), 350);

  // tickMs=0 → instant result (no animation delay)
  const TICK = tickMs;

  // ── Pre-compute total match duration so the clock syncs with events ──
  // (events with sequential accDelay can exceed 90*TICK)
  function _holdMs(type) {
    if (type === 'goal')         return 2600;
    if (type === 'penalty')     return 2200;
    if (type === 'penalty-miss') return 1800;
    if (type === 'corner')      return 1100;
    if (type === 'freekick')    return 1200;
    if (type === 'injury')      return 1600;
    return 1800; // yellow/red
  }
  let _preAcc = 0;
  events.forEach(ev => {
    const fireAt  = ev.minute * TICK;
    const startAt = Math.max(fireAt, _preAcc);
    _preAcc = startAt + _holdMs(ev.type) + 350;
  });
  const totalMatchMs = Math.max(90 * TICK, _preAcc);

  const start = performance.now();

  // Clock: advances 0→90' proportionally to totalMatchMs
  _liveClockInterval = setInterval(() => {
    const elapsed = performance.now() - start;
    const min = Math.min(90, Math.floor(elapsed / totalMatchMs * 90));
    document.getElementById('live-clock').textContent = `${min}'`;
    if (elapsed >= totalMatchMs) { clearInterval(_liveClockInterval); _liveClockInterval = null; }
  }, 200);

  // Schedule events with sequential queue
  let scoreA = 0, scoreB = 0;
  let accDelay = 0;

  events.forEach(ev => {
    const fireAt  = ev.minute * TICK;
    const startAt = Math.max(fireAt, accDelay);
    accDelay      = startAt + _holdMs(ev.type) + 350;

    setTimeout(() => {
      if (ev.type === 'goal') {
        if (ev.side === 'A') scoreA++; else scoreB++;
        _lastGoalSide = ev.side;
        const numA = document.getElementById('live-score-a');
        const numB = document.getElementById('live-score-b');
        numA.textContent = scoreA;
        numB.textContent = scoreB;
        const changed = ev.side === 'A' ? numA : numB;
        changed.classList.remove('pulse');
        void changed.offsetWidth;
        changed.classList.add('pulse');
        setTimeout(() => changed.classList.remove('pulse'), 450);
        triggerEventOverlay('goal', ev.name, `${scoreA} - ${scoreB}`, ev.side);
        animatePitchEvent('goal', ev);
      } else if (ev.type === 'penalty') {
        if (ev.side === 'A') scoreA++; else scoreB++;
        _lastGoalSide = ev.side;
        const numA = document.getElementById('live-score-a');
        const numB = document.getElementById('live-score-b');
        numA.textContent = scoreA;
        numB.textContent = scoreB;
        const changed = ev.side === 'A' ? numA : numB;
        changed.classList.remove('pulse'); void changed.offsetWidth; changed.classList.add('pulse');
        setTimeout(() => changed.classList.remove('pulse'), 450);
        triggerEventOverlay('penalty', ev.name, `${scoreA} - ${scoreB}`, ev.side);
        animatePitchEvent('goal', ev);
      } else {
        triggerEventOverlay(ev.type, ev.name, null, ev.side);
        animatePitchEvent(ev.type, ev);
      }
      addFeedEvent(ev);
    }, startAt);
  });

  // ── Penalty shootout animation (if draw) ────────────────────────
  const pens = finalScore.penalties;
  const regularMs = Math.max(90 * TICK, accDelay);
  let penaltyEndMs = 0;
  if (pens) {
    const kicks = Math.max(pens.shotsA.length, pens.shotsB.length);
    penaltyEndMs = regularMs + 900 + kicks * 1100 + 1400;

    // Full-time whistle before shootout (so users see the draw score clearly)
    const ftLabel = (lang === 'es' ? '⏱ PITIDO FINAL' : '⏱ FULL TIME') +
      ` — ${finalScore.teamA}:${finalScore.teamB}`;
    setTimeout(() => addFeedEvent({ type: 'ft_whistle', minute: 90, name: ftLabel, side: 'N' }), regularMs + 50);

    // Announcement
    setTimeout(() => addFeedEvent({ type: 'pen_start', minute: 90, name: t('pen-shootout-title'), side: 'N' }), regularMs + 500);

    let penT = regularMs + 900;
    for (let i = 0; i < kicks; i++) {
      const kA = pens.shotsA[i];
      const kB = pens.shotsB[i];
      if (kA) {
        ((t, k) => setTimeout(() => addFeedEvent({ type: k.scored ? 'pen_goal' : 'pen_miss', minute: 90, name: k.name, side: 'A', scored: k.scored }), t))(penT, kA);
        penT += 560;
      }
      if (kB) {
        ((t, k) => setTimeout(() => addFeedEvent({ type: k.scored ? 'pen_goal' : 'pen_miss', minute: 90, name: k.name, side: 'B', scored: k.scored }), t))(penT, kB);
        penT += 560;
      }
      penT += 140;
    }
    // Winner overlay
    setTimeout(() => {
      const winName = pens.winner === 'A' ? payload.teamA : payload.teamB;
      addFeedEvent({ type: 'pen_winner', minute: 90, name: winName, side: pens.winner });
      triggerEventOverlay('pen_winner', winName, `${pens.scoreA}–${pens.scoreB}`);
    }, penT + 400);
  }

  // Finish after full match + optional penalty sequence.
  // For penalties: wait until pen_winner overlay has fully displayed (holdMs 3200 + fade 550 + 200 padding)
  const overlayWait = pens ? 3950 : 0;
  _liveTimer = setTimeout(finishLive, Math.max(regularMs, penaltyEndMs) + 800 + overlayWait);
}

function addFeedEvent(ev) {
  const feed = document.getElementById('live-feed');
  let icon;
  if      (ev.type === 'goal')          icon = '⚽';
  else if (ev.type === 'yellow')        icon = '🟨';
  else if (ev.type === 'pen_start')     icon = '🎯';
  else if (ev.type === 'pen_goal')      icon = '⚽';
  else if (ev.type === 'pen_miss')      icon = '✕';
  else if (ev.type === 'pen_winner')    icon = '🏆';
  else if (ev.type === 'penalty')       icon = '⚽';
  else if (ev.type === 'penalty-miss')  icon = '❌';
  else if (ev.type === 'corner')        icon = '🚩';
  else if (ev.type === 'freekick')      icon = '🎯';
  else if (ev.type === 'injury')        icon = '🩹';
  else if (ev.type === 'ft_whistle')    icon = '🏁';
  else                                  icon = '🟥';
  const sideClass = ev.side === 'N' ? 'live-event-n' : `live-event-${ev.side.toLowerCase()}`;
  const extraClass = ev.type === 'pen_miss' ? ' pen-miss-entry' : ev.type === 'pen_start' ? ' pen-header-entry' : ev.type === 'ft_whistle' ? ' pen-header-entry' : '';
  const div  = document.createElement('div');
  div.className = `live-event ${sideClass}${extraClass}`;
  div.innerHTML = `<span class="le-min">${ev.type.startsWith('pen') ? 'P' : ev.minute + "'"}</span><span class="le-icon">${icon}</span><span class="le-name">${escHtml(ev.name)}</span>`;
  feed.prepend(div);
}

function triggerEventOverlay(type, name, score, side) {
  // Sound effect tied to overlay type
  const _snd = { goal:'goal', penalty:'goal', yellow:'card', red:'card', injury:'injury', 'penalty-miss':'penalty' };
  if (_snd[type]) _playSound(_snd[type]);
  // Cancel any stale hide timers from previous overlay events
  if (_overlayHideTimer1) { clearTimeout(_overlayHideTimer1); _overlayHideTimer1 = null; }
  if (_overlayHideTimer2) { clearTimeout(_overlayHideTimer2); _overlayHideTimer2 = null; }

  const overlay = document.getElementById('event-overlay');
  const inner   = document.getElementById('event-overlay-inner');
  const icon    = type === 'goal' || type === 'penalty' ? '⚽'
                : type === 'yellow' ? '🟨'
                : type === 'pen_winner' ? '🏆'
                : type === 'penalty-miss' ? '❌'
                : type === 'corner' ? '🚩'
                : type === 'freekick' ? '🎯'
                : type === 'injury' ? '🩹'
                : '🟥';
  const titleKey = type === 'goal'         ? 'ev-goal'
                 : type === 'yellow'       ? 'ev-yellow'
                 : type === 'pen_winner'   ? 'ev-pen_winner'
                 : type === 'penalty'      ? 'ev-penalty'
                 : type === 'penalty-miss' ? 'ev-penalty-miss'
                 : type === 'corner'       ? 'ev-corner'
                 : type === 'freekick'     ? 'ev-freekick'
                 : type === 'injury'       ? 'ev-injury'
                 : 'ev-red';
  const title   = t(titleKey);
  const holdMs  = (type === 'goal' || type === 'pen_winner' || type === 'penalty') ? 3200
                : (type === 'penalty-miss') ? 1800
                : (type === 'corner' || type === 'freekick') ? 1100
                : (type === 'injury') ? 1600
                : 1800;

  let badgeHtml = '';
  let teamName  = '';
  if (_livePayload) {
    if (type === 'pen_winner') {
      // Penalty winner: determine winning side from data
      const curSide = _liveData?.finalScore?.penalties?.winner || _lastGoalSide;
      const tName   = curSide === 'A' ? _livePayload.teamA : _livePayload.teamB;
      const rawBadge = curSide === 'A' ? _liveData?.badgeA : _liveData?.badgeB;
      teamName  = tName;
      badgeHtml = `<img class="eo-badge" src="${escHtml(rawBadge || _badgeFallback(tName))}" alt="">`;
    } else {
      // All other events: use event side
      const evSide = side || _lastGoalSide;
      const tName  = evSide === 'A' ? _livePayload.teamA : _livePayload.teamB;
      teamName = tName;
      if (type === 'goal' || type === 'penalty') {
        const rawBadge = evSide === 'A' ? _liveData?.badgeA : _liveData?.badgeB;
        badgeHtml = `<img class="eo-badge" src="${escHtml(rawBadge || _badgeFallback(tName))}" alt="">`;
      }
    }
  }

  inner.className = `eo-inner eo-${type}`;
  inner.innerHTML =
    (badgeHtml ? `<div class="eo-badge-wrap">${badgeHtml}</div>` : '') +
    `<div class="eo-icon">${icon}</div>` +
    `<div class="eo-title">${title}</div>` +
    (teamName ? `<div class="eo-team">${escHtml(teamName)}</div>` : '') +
    `<div class="eo-name">${escHtml(name)}</div>` +
    (score ? `<div class="eo-score">${escHtml(score)}</div>` : '');

  // Force visible, reset animation classes, trigger reflow for CSS re-play
  overlay.classList.remove('hidden', 'eo-fade-out', 'eo-fade-in');
  void overlay.offsetWidth;
  overlay.classList.add('eo-fade-in');
  _overlayHideTimer1 = setTimeout(() => {
    _overlayHideTimer1 = null;
    overlay.classList.remove('eo-fade-in');
    overlay.classList.add('eo-fade-out');
    _overlayHideTimer2 = setTimeout(() => {
      _overlayHideTimer2 = null;
      overlay.classList.add('hidden');
    }, 550);
  }, holdMs);
}

function finishLive() {
  if (_liveTimer)         { clearTimeout(_liveTimer);          _liveTimer = null; }
  if (_liveClockInterval) { clearInterval(_liveClockInterval); _liveClockInterval = null; }
  if (_overlayHideTimer1) { clearTimeout(_overlayHideTimer1);  _overlayHideTimer1 = null; }
  if (_overlayHideTimer2) { clearTimeout(_overlayHideTimer2);  _overlayHideTimer2 = null; }
  // Always hide event overlay before transitioning to results
  document.getElementById('event-overlay').classList.add('hidden');
  stopLivePitch();
  const viewer = document.getElementById('live-viewer');
  viewer.classList.add('live-fade-out');
  setTimeout(() => {
    viewer.classList.add('hidden');
    viewer.classList.remove('live-fade-out');
    renderResult(_liveData, _livePayload);
  }, 620);
}

function skipLive() {
  document.getElementById('event-overlay').classList.add('hidden');
  finishLive();
}

// ── Share result ───────────────────────────────────────────
function shareResult() {
  const nameA = document.getElementById('poster-name-a').textContent;
  const nameB = document.getElementById('poster-name-b').textContent;
  const eraA  = document.getElementById('poster-era-a').textContent;
  const eraB  = document.getElementById('poster-era-b').textContent;
  const score = document.getElementById('poster-score').textContent.trim().replace(' : ', '-');
  const text  = `⚽ ${nameA}${eraA ? ' ('+eraA+')' : ''} ${score} ${nameB}${eraB ? ' ('+eraB+')' : ''}\n🎮 Simulador de Partidos de Fútbol`;
  if (typeof navigator.share === 'function') {
    navigator.share({ title: 'Resultado del partido', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text)
      .then(() => showToast(t('tooltip-copied')))
      .catch(() => showToast(t('tooltip-copy-fail')));
  }
}

function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast'; el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('toast-show');
  setTimeout(() => el.classList.remove('toast-show'), 2500);
}

// ── Penalty shootout renderer ────────────────────────────────
function renderPenalties(penalties, teamA, teamB) {
  const card = document.getElementById('penalty-card');
  if (!penalties) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  document.getElementById('pen-header').innerHTML =
    `<span style="color:var(--accent-a)">${escHtml(teamA)}</span>` +
    `<span class="pen-header-vs">${t('pen-shootout-title')}</span>` +
    `<span style="color:var(--accent-b)">${escHtml(teamB)}</span>`;

  const kicks = Math.max(penalties.shotsA.length, penalties.shotsB.length);
  const rowsEl = document.getElementById('pen-rows');
  rowsEl.innerHTML = '';

  for (let i = 0; i < kicks; i++) {
    const kA = penalties.shotsA[i];
    const kB = penalties.shotsB[i];
    const mkKick = k => `<span class="pen-kick ${k.scored ? 'scored' : 'missed'}">${k.scored ? '⚽' : '✕'}</span>`;
    const row = document.createElement('div');
    row.className = 'pen-row' + (i >= 5 ? ' pen-sd' : '');
    row.innerHTML =
      `<div class="pen-kicker-a">${kA ? `<span class="pen-name pen-name-a">${escHtml(kA.name)}</span>${mkKick(kA)}` : ''}</div>` +
      `<div class="pen-round-num">${i < 5 ? i + 1 : 'SD'}</div>` +
      `<div class="pen-kicker-b">${kB ? `${mkKick(kB)}<span class="pen-name">${escHtml(kB.name)}</span>` : ''}</div>`;
    rowsEl.appendChild(row);
  }

  const winnerName = penalties.winner === 'A' ? teamA : teamB;
  const sdNote     = penalties.suddenDeath ? t('pen-winner-sd') : '';
  document.getElementById('pen-result').innerHTML =
    `<div class="pen-score-display">${penalties.scoreA} – ${penalties.scoreB}</div>` +
    `<div class="pen-winner">🏆 <strong>${escHtml(winnerName)}</strong> ${t('pen-winner-suffix')}${sdNote}</div>`;
}

// ── Autocomplete (team name suggestions) ─────────────────────
function setupAutocomplete(inputId, dropdownId, teamSide) {
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropdownId);
  if (!input || !drop) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { drop.classList.add('hidden'); return; }
    const matches = _acList.filter(s => s.toLowerCase().includes(q)).slice(0, 12);
    if (!matches.length) { drop.classList.add('hidden'); return; }
    drop.innerHTML = matches.map(m =>
      `<div class="ac-item" data-val="${escHtml(m)}">${escHtml(m)}</div>`
    ).join('');
    drop.classList.remove('hidden');
    drop.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        const val = item.dataset.val;
        // Parse "Real Madrid 1960" → team="Real Madrid", era="1960"
        const yearMatch = val.match(/\b(\d{4})\b/);
        input.value = yearMatch ? val.replace(yearMatch[0], '').trim() : val;
        const eraEl = document.getElementById(`era${teamSide}`);
        if (yearMatch && eraEl && !eraEl.value.trim()) eraEl.value = yearMatch[1];
        drop.classList.add('hidden');
      });
    });
  });

  input.addEventListener('keydown', e => {
    const items = [...drop.querySelectorAll('.ac-item')];
    if (!items.length || drop.classList.contains('hidden')) return;
    const active = drop.querySelector('.ac-active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active ? active.nextElementSibling : items[0];
      active?.classList.remove('ac-active');
      next?.classList.add('ac-active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = active ? active.previousElementSibling : items[items.length - 1];
      active?.classList.remove('ac-active');
      prev?.classList.add('ac-active');
    } else if (e.key === 'Enter' && active) {
      active.dispatchEvent(new MouseEvent('mousedown'));
    } else if (e.key === 'Escape') {
      drop.classList.add('hidden');
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => drop.classList.add('hidden'), 150);
  });
}

// ── UI state helpers ──────────────────────────────────────
function setLoading(on) {
  document.getElementById('loader').classList.toggle('hidden', !on);
  document.getElementById('btn-simulate').disabled = on;
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError() {
  document.getElementById('error-msg').classList.add('hidden');
}

// ── XSS-safe HTML escape ──────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
