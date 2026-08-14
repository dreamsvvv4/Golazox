/**
 * espn.js — Fuente alternativa (ESPN, API pública sin clave) para clasificaciones
 * y partidos del día. Sirve de respaldo cuando Transfermarkt no responde.
 * ════════════════════════════════════════════════════════════════════════════
 * - No requiere registro ni API key.
 * - Clasificaciones: si la temporada en curso aún no tiene partidos jugados
 *   (pretemporada), cae automáticamente a la temporada anterior.
 * - Escudos: se sirven vía el proxy propio /newsimg (host espncdn.com en la
 *   whitelist IMG_HOSTS) para respetar la CSP img-src 'self'.
 * ════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const fetch = require('node-fetch');

const FETCH_TIMEOUT = 8000;
const CACHE_TTL     = 30 * 60 * 1000; // 30 min (clasificaciones)
const MATCH_TTL     = 15 * 60 * 1000; // 15 min (partidos del día)

const _HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
};

// Nuestros códigos de liga → slug de ESPN.
const LEAGUE_MAP = {
  ES1: 'esp.1',
  GB1: 'eng.1',
  IT1: 'ita.1',
  L1:  'ger.1',
  FR1: 'fra.1',
};

// Ligas cuyos partidos del día mostramos en la agenda (grandes + Champions).
const MATCH_LEAGUES = [
  { slug: 'uefa.champions', name: 'Champions League', icon: '⭐' },
  { slug: 'esp.1', name: 'LaLiga',        icon: '⚽' },
  { slug: 'eng.1', name: 'Premier League', icon: '⚽' },
  { slug: 'ita.1', name: 'Serie A',        icon: '⚽' },
  { slug: 'ger.1', name: 'Bundesliga',     icon: '⚽' },
  { slug: 'fra.1', name: 'Ligue 1',        icon: '⚽' },
];

const _STANDINGS_URL = (slug, season) =>
  `https://site.web.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season}`;
const _SCOREBOARD_URL = (slug, ymd) =>
  `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ymd}`;

// Año de inicio de la temporada en curso (jun→año actual, ene-may→año-1).
function _currentSeason() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

const _seasonLabel = (y) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;

// Escudo de ESPN vía proxy propio (respeta CSP img-src 'self').
function _badge(href) {
  if (!href || !/^https?:\/\//i.test(href)) return null;
  try {
    const u = new URL(href);
    // Los escudos de ESPN llegan a 500px (~100 KB). El combiner devuelve una
    // copia de 80px (~7 KB) — de sobra para los badges diminutos que pintamos.
    // Reduce ~90% el peso de cada escudo.
    if (/espncdn\.com$/i.test(u.hostname) && /\/teamlogos\//i.test(u.pathname)) {
      href = `https://a.espncdn.com/combiner/i?img=${u.pathname}&h=80&w=80`;
    }
  } catch (_) { /* deja el href original */ }
  return '/newsimg?u=' + encodeURIComponent(href);
}

// Valor numérico de un stat de la entrada de standings.
function _stat(entry, name) {
  const s = (entry.stats || []).find(x => x.name === name);
  if (!s) return null;
  const v = (s.value != null) ? s.value : parseFloat(String(s.displayValue).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

// Convierte una entrada de ESPN en la fila estándar de la tabla.
function _rowFromEntry(entry, idx) {
  const pos     = _stat(entry, 'rank') || (idx + 1);
  const played  = _stat(entry, 'gamesPlayed') || 0;
  const won     = _stat(entry, 'wins') || 0;
  const drawn   = _stat(entry, 'ties') || 0;
  const lost    = _stat(entry, 'losses') || 0;
  const gf      = _stat(entry, 'pointsFor') || 0;
  const ga      = _stat(entry, 'pointsAgainst') || 0;
  const gdNum   = (_stat(entry, 'pointDifferential'));
  const points  = _stat(entry, 'points') || 0;
  const team    = entry.team || {};
  const name    = team.shortDisplayName || team.displayName || team.name || '—';
  const logo    = (team.logos && team.logos[0] && team.logos[0].href) || '';
  return {
    pos: Math.round(pos),
    club: name,
    badge: _badge(logo),
    played: Math.round(played),
    won: Math.round(won),
    drawn: Math.round(drawn),
    lost: Math.round(lost),
    goals: `${Math.round(gf)}:${Math.round(ga)}`,
    gd: String(gdNum == null ? (gf - ga) : Math.round(gdNum)),
    points: Math.round(points),
  };
}

async function _fetchTable(slug, season) {
  const r = await fetch(_STANDINGS_URL(slug, season), { timeout: FETCH_TIMEOUT, headers: _HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  const entries = (data.children && data.children[0] && data.children[0].standings &&
                   data.children[0].standings.entries) || [];
  const rows = entries.map(_rowFromEntry);
  rows.sort((a, b) => a.pos - b.pos);
  const played = rows.reduce((n, r2) => n + r2.played, 0);
  return { rows, played };
}

// Tabla de una liga. Mostramos SIEMPRE la temporada en curso (la de ESTE año)
// en cuanto ESPN publica su tabla, aunque todavía no se haya jugado ningún
// partido (pretemporada = todos a 0). Solo caemos a la temporada anterior si la
// actual aún no existe (ninguna fila).
async function _leagueTable(code) {
  const slug = LEAGUE_MAP[code];
  if (!slug) return null;
  const cur = _currentSeason();
  let used = cur;
  let { rows } = await _fetchTable(slug, cur);
  if (!rows.length) {
    try {
      const prev = await _fetchTable(slug, cur - 1);
      if (prev.rows.length) { rows = prev.rows; used = cur - 1; }
    } catch (_) { /* nos quedamos con lo que haya */ }
  }
  return { table: rows, season: used };
}

// -- caché en memoria (clasificaciones) -------------------------------------
let _cache = { ts: 0, data: null };

/**
 * Clasificaciones de las 5 grandes ligas desde ESPN.
 * Devuelve la MISMA forma que standings.getStandings pero sin goleadores ni
 * calendario (scorers/fixtures vacíos): { leagues:[{code,name,short,flag,
 * season,fxSeason,table,scorers,fixtures}], updated }.
 * @param {Array} leagues  Metadatos de liga [{code,name,short,flag}] (de standings.js).
 */
async function getEspnStandings(leagues) {
  const now = Date.now();
  if (_cache.data && (now - _cache.ts) < CACHE_TTL) return _cache.data;
  const META = leagues || Object.keys(LEAGUE_MAP).map(code => ({ code, name: code, short: code, flag: '' }));
  const results = await Promise.allSettled(META.map(async (L) => {
    const t = await _leagueTable(L.code);
    if (!t || !t.table.length) return null;
    return {
      code: L.code, name: L.name, short: L.short, flag: L.flag,
      season: _seasonLabel(t.season),
      fxSeason: _seasonLabel(t.season),
      table: t.table,
      scorers: [],
      fixtures: [],
    };
  }));
  const out = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  const data = { leagues: out, updated: now };
  if (out.length) _cache = { ts: now, data };
  return data;
}

// -- caché en memoria (partidos del día) ------------------------------------
let _matchCache = { ts: 0, ymd: '', data: null };

function _ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Normaliza un nombre de club para emparejar entre fuentes (TM ↔ ESPN):
// minúsculas, sin acentos, sin sufijos/prefijos genéricos ni puntuación.
// "Deportivo Alavés" y "Alavés" → "alaves"; "Getafe CF" y "Getafe" → "getafe".
function _normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(cf|fc|ud|ca|rc|rcd|cd|sd|sad|club|de|del|balompie|deportivo|real|athletic|atletico)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Palabras corporativas/genéricas que no identifican al club (se descartan al
// tokenizar). OJO: NO incluimos "real"/"atletico"/"deportivo" porque SÍ
// distinguen (Real Madrid vs Atlético; Real Sociedad vs Real Betis).
const _STOP_TOKENS = new Set([
  'cf', 'fc', 'ud', 'ca', 'rc', 'rcd', 'cd', 'sd', 'sad', 'ac', 'as', 'ss', 'sc',
  'club', 'balompie', 'futbol', 'calcio', 'ssd', 'afc', 'bfc', 'the',
]);

// Convierte un nombre de club en un conjunto de tokens identificativos.
// "Deportivo Alavés" → {deportivo, alaves}; "Rayo Vallecano" → {rayo, vallecano};
// "Alavés" → {alaves}. Descarta sufijos corporativos y tokens de <3 letras.
function _teamTokens(name) {
  return new Set(
    String(name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 3 && !_STOP_TOKENS.has(t))
  );
}

// Nº de tokens compartidos entre dos nombres (fuerza del emparejamiento).
function _tokenOverlap(aSet, bSet) {
  let n = 0;
  for (const t of aSet) if (bSet.has(t)) n++;
  return n;
}

// Hora local (Europe/Madrid) a partir del ISO UTC del evento.
function _timeMadrid(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid',
    }).format(d);
  } catch (_) { return ''; }
}

// Escudo de un equipo desde una entrada de competidor de ESPN.
function _teamLogo(team) {
  if (!team) return null;
  const href = team.logo || (team.logos && team.logos[0] && team.logos[0].href) || '';
  return _badge(href);
}

// Peso de importancia de un partido para ordenar los más atractivos primero.
const _LEAGUE_WEIGHT = {
  'uefa.champions': 100, 'esp.1': 42, 'eng.1': 42, 'ita.1': 36, 'ger.1': 34, 'fra.1': 30,
};
const _BIG_CLUBS = /(real madrid|barcelona|bar[cç]a|atl[eé]tico|manchester city|manchester united|man city|man utd|liverpool|arsenal|chelsea|tottenham|bayern|dortmund|leverkusen|inter|a\.?c\.? milan|ac milan|milan|juventus|napoli|as roma|\broma\b|paris|psg|benfica|porto|ajax|athletic|sevilla|valencia|villarreal|real sociedad|betis)/i;
function _matchImportance(slug, home, away) {
  let s = _LEAGUE_WEIGHT[slug] || 12;
  if (_BIG_CLUBS.test(home)) s += 20;
  if (_BIG_CLUBS.test(away)) s += 20;
  return s;
}

async function _fetchScoreboard(lg, ymd) {
  const r = await fetch(_SCOREBOARD_URL(lg.slug, ymd), { timeout: FETCH_TIMEOUT, headers: _HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  const out = [];
  for (const ev of (data.events || [])) {
    const comp = (ev.competitions && ev.competitions[0]) || {};
    const cs = comp.competitors || [];
    const home = cs.find(c => c.homeAway === 'home');
    const away = cs.find(c => c.homeAway === 'away');
    if (!home || !away) continue;
    const homeName = (home.team && (home.team.shortDisplayName || home.team.displayName)) || '';
    const awayName = (away.team && (away.team.shortDisplayName || away.team.displayName)) || '';
    // Marcador si el partido ya se juega/jugó; si no, cadena vacía.
    const hScore = home.score != null ? String(home.score) : '';
    const aScore = away.score != null ? String(away.score) : '';
    const status = (comp.status && comp.status.type) || (ev.status && ev.status.type) || {};
    const played = status.state === 'in' || status.state === 'post';
    out.push({
      icon: lg.icon,
      competition: lg.name,
      home: homeName,
      away: awayName,
      homeBadge: _teamLogo(home.team),
      awayBadge: _teamLogo(away.team),
      score: (played && hScore !== '' && aScore !== '') ? `${hScore}:${aScore}` : '',
      state: status.state || 'pre',
      importance: _matchImportance(lg.slug, homeName, awayName),
      time: _timeMadrid(ev.date),
      _ts: ev.date ? new Date(ev.date).getTime() : 0,
    });
  }
  return out;
}

/**
 * Partidos de las grandes ligas para una fecha (por defecto hoy, Europe/Madrid).
 * Devuelve { events:[{icon,competition,home,away,time,_ts}], updated }.
 * Resiliente: ligas que fallan (o ESPN limita) se ignoran.
 */
async function getEspnMatches(dateStr) {
  const now = Date.now();
  // Fecha "hoy" en Europe/Madrid para no desfasar por zona horaria del server.
  let ymd;
  if (dateStr) {
    ymd = String(dateStr).replace(/-/g, '');
  } else {
    const madrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    ymd = _ymd(madrid);
  }
  if (_matchCache.data && _matchCache.ymd === ymd && (now - _matchCache.ts) < MATCH_TTL) {
    return _matchCache.data;
  }
  const results = await Promise.allSettled(MATCH_LEAGUES.map(lg => _fetchScoreboard(lg, ymd)));
  const events = [];
  results.forEach(r => { if (r.status === 'fulfilled') events.push(...r.value); });
  events.sort((a, b) => a._ts - b._ts);
  const data = { events, updated: now };
  // Cacheamos aunque venga vacío para no martillear ESPN en días sin fútbol.
  _matchCache = { ts: now, ymd, data };
  return data;
}

// -- caché en memoria (próximos partidos) -----------------------------------
let _upCache = { ts: 0, range: '', data: null };

/**
 * Partidos destacados de HOY y los próximos `days` días (Europe/Madrid). Sirve
 * para el bloque "partidos del día" incluso en pretemporada: si hoy no hay
 * fútbol, muestra la jornada de apertura. Cada evento lleva `_ts` (para agrupar
 * por día) e `importance` (para ordenar los grandes partidos primero).
 * Devuelve { events, updated }.
 */
async function getEspnUpcoming(days) {
  const n = Math.max(0, days == null ? 4 : days);
  const now = Date.now();
  const madrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const start = _ymd(madrid);
  const endD = new Date(madrid); endD.setDate(endD.getDate() + n);
  const range = `${start}-${_ymd(endD)}`;
  if (_upCache.data && _upCache.range === range && (now - _upCache.ts) < MATCH_TTL) return _upCache.data;
  const results = await Promise.allSettled(MATCH_LEAGUES.map(lg => _fetchScoreboard(lg, range)));
  const events = [];
  results.forEach(r => { if (r.status === 'fulfilled') events.push(...r.value); });
  events.sort((a, b) => a._ts - b._ts);
  const data = { events, updated: now };
  _upCache = { ts: now, range, data };
  return data;
}

// -- caché en memoria (resultados por rango) --------------------------------
let _resCache = { ts: 0, key: '', data: null };
const RESULTS_TTL = 10 * 60 * 1000; // 10 min (marcadores en vivo)

// Parsea un evento del scoreboard en un resultado con goleadores.
// Devuelve { dayIso, home, away, tHome, tAway, score, state, live, scorers[] } | null.
// tHome/tAway = tokens del nombre COMPLETO (para emparejar con Transfermarkt).
function _resultFromEvent(ev) {
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const cs = comp.competitors || [];
  const home = cs.find(c => c.homeAway === 'home');
  const away = cs.find(c => c.homeAway === 'away');
  if (!home || !away) return null;
  const homeName = (home.team && (home.team.displayName || home.team.shortDisplayName)) || '';
  const awayName = (away.team && (away.team.displayName || away.team.shortDisplayName)) || '';
  const status = (comp.status && comp.status.type) || (ev.status && ev.status.type) || {};
  const state = status.state || 'pre';                 // 'pre' | 'in' | 'post'
  const played = state === 'in' || state === 'post';
  const hScore = home.score != null ? String(home.score) : '';
  const aScore = away.score != null ? String(away.score) : '';
  // Goleadores desde competition.details (viene en la misma respuesta).
  const scorers = [];
  const hId = home.team && String(home.team.id);
  for (const dt of (comp.details || [])) {
    if (!dt.scoringPlay) continue;
    const side = (dt.team && String(dt.team.id) === hId) ? 'home' : 'away';
    const name = (dt.athletesInvolved && dt.athletesInvolved[0] && dt.athletesInvolved[0].displayName) || '';
    if (!name) continue;
    const min = (dt.clock && dt.clock.displayValue) || '';
    scorers.push({ name, min, side, pen: !!dt.penaltyKick, og: !!dt.ownGoal });
  }
  return {
    dayIso: (ev.date || '').slice(0, 10),
    home: homeName, away: awayName,
    tHome: _teamTokens(homeName), tAway: _teamTokens(awayName),
    score: (played && hScore !== '' && aScore !== '') ? `${hScore}:${aScore}` : '',
    state, live: state === 'in', scorers,
  };
}

// Trae los resultados (marcador + estado + goleadores) de las grandes ligas
// para el rango [fromYmd, toYmd] (YYYYMMDD). Como ESPN topa a ~100 eventos por
// petición, paginamos en ventanas de 50 días. No está bloqueado en prod, así
// que sirve de fuente en vivo para rellenar el calendario. Devuelve
// { byCode: { ES1:[res…], … }, updated }.
async function getEspnResults(fromYmd, toYmd) {
  const now = Date.now();
  const key = `${fromYmd}-${toYmd}`;
  if (_resCache.data && _resCache.key === key && (now - _resCache.ts) < RESULTS_TTL) {
    return _resCache.data;
  }
  const parse = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
  const codes = Object.keys(LEAGUE_MAP);
  const jobs = [];
  for (const code of codes) {
    const slug = LEAGUE_MAP[code];
    let cur = parse(fromYmd);
    const end = parse(toYmd);
    while (cur <= end) {
      const chunkEnd = new Date(cur); chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 49);
      const to = chunkEnd < end ? chunkEnd : end;
      const range = `${_ymd(cur)}-${_ymd(to)}`;
      jobs.push({ code, url: _SCOREBOARD_URL(slug, range) });
      cur = new Date(to); cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  const byCode = {};
  for (const c of codes) byCode[c] = [];
  await Promise.allSettled(jobs.map(async (j) => {
    const r = await fetch(j.url, { timeout: FETCH_TIMEOUT, headers: _HEADERS });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    for (const ev of (d.events || [])) {
      const res = _resultFromEvent(ev);
      if (res) byCode[j.code].push(res);
    }
  }));
  const data = { byCode, updated: now };
  // Cacheamos aunque venga parcial: mejor algo que nada, y evita martillear.
  _resCache = { ts: now, key, data };
  return data;
}

module.exports = { getEspnStandings, getEspnMatches, getEspnUpcoming, getEspnResults, teamTokens: _teamTokens, tokenOverlap: _tokenOverlap, LEAGUE_MAP };
