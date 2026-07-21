/**
 * standings.js — Clasificaciones y goleadores de las grandes ligas (solo lectura)
 * ════════════════════════════════════════════════════════════════════════════
 * Obtiene las tablas de clasificación y el ranking de máximos goleadores de las
 * 5 grandes ligas europeas desde Transfermarkt. Datos públicos, sin reproducir
 * contenido editorial: números de una tabla deportiva + escudos vía proxy propio.
 *
 * - Caché en memoria de 30 min (evita golpear la fuente en cada visita).
 * - Resiliente: si una liga falla, se ignora y se sirven las demás.
 * - Detección de temporada: si la temporada en curso aún no tiene partidos
 *   jugados (pretemporada), cae automáticamente a la temporada anterior.
 * ════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const fetch   = require('node-fetch');
const cheerio = require('cheerio');

const FETCH_TIMEOUT = 8000;
const CACHE_TTL     = 30 * 60 * 1000; // 30 min

// Ligas soportadas (código de competición de Transfermarkt).
const LEAGUES = [
  { code: 'ES1', name: 'LaLiga',        short: 'ESP', flag: '🇪🇸' },
  { code: 'GB1', name: 'Premier League', short: 'ENG', flag: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { code: 'IT1', name: 'Serie A',        short: 'ITA', flag: '🇮🇹' },
  { code: 'L1',  name: 'Bundesliga',     short: 'GER', flag: '🇩🇪' },
  { code: 'FR1', name: 'Ligue 1',        short: 'FRA', flag: '🇫🇷' },
];

const _TM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Referer': 'https://www.transfermarkt.es/',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'same-origin',
};

// saison_id de Transfermarkt = año de inicio de la temporada.
function _currentSaison() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

const _tableUrl   = (code, s) => `https://www.transfermarkt.es/x/tabelle/wettbewerb/${code}/saison_id/${s}`;
const _scorersUrl = (code, s) => `https://www.transfermarkt.es/x/torschuetzenliste/wettbewerb/${code}/saison_id/${s}`;

// -- caché en memoria -------------------------------------------------------
let _cache = { ts: 0, data: null };

// Extrae { name, badge } de una celda con escudo de club.
function _clubFromCell($cell) {
  const $img = $cell.find('img').first();
  const alt  = ($img.attr('alt') || '').split('|')[0].trim();
  const src  = $img.attr('src') || $img.attr('data-src') || '';
  const idM  = src.match(/\/(\d+)\.png/);
  const name = alt || $cell.find('a').first().attr('title') || $cell.find('a').first().text().trim();
  return { name: name || '—', badge: idM ? `/tmbadge/${idM[1]}` : null };
}

// Fila de tabla de clasificación: 10 celdas
// [0]=pos [1]=escudo [2]=club [3]=PJ [4]=G [5]=E [6]=P [7]=GF:GC [8]=DG [9]=Pts
function _parseTableRow($, el) {
  const tds = $(el).children('td').toArray();
  if (tds.length < 10) return null;
  const pos = parseInt($(tds[0]).text().trim(), 10);
  // La celda [1] siempre lleva el escudo del club (su alt = nombre real).
  // Evitamos [2] porque en filas de campeón incluye un icono de trofeo cuyo
  // alt es "Campeón de …" y contaminaría el nombre/escudo.
  const club = _clubFromCell($(tds[1]));
  const played = parseInt($(tds[3]).text().trim(), 10) || 0;
  const won    = parseInt($(tds[4]).text().trim(), 10) || 0;
  const drawn  = parseInt($(tds[5]).text().trim(), 10) || 0;
  const lost   = parseInt($(tds[6]).text().trim(), 10) || 0;
  const goals  = $(tds[7]).text().replace(/\s+/g, '').trim(); // "95:36"
  const gd     = $(tds[8]).text().trim();
  const points = parseInt($(tds[9]).text().trim(), 10) || 0;
  if (!Number.isFinite(pos) || club.name === '—') return null;
  return { pos, club: club.name, badge: club.badge, played, won, drawn, lost, goals, gd, points };
}

async function _fetchTable(code, saison) {
  const r = await fetch(_tableUrl(code, saison), { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const $ = cheerio.load(await r.text());
  const rows = $('table.items').first().find('tbody > tr').toArray();
  const list = [];
  for (const el of rows) {
    const t = _parseTableRow($, el);
    if (t) list.push(t);
  }
  return list;
}

// Fila de goleadores: >=7 celdas
// [0]=rank [1]=jugador+pos [2]=nac(img) [3]=edad [4]=club(img) [5]=PJ [6]=goles
function _parseScorerRow($, el) {
  const tds = $(el).children('td').toArray();
  if (tds.length < 7) return null;
  const $1 = $(tds[1]);
  const player = ($1.find('img').first().attr('alt') || $1.find('a').first().text() || '').trim();
  const position = $1.text().replace(/\s+/g, ' ').replace(player, '').trim();
  const club  = _clubFromCell($(tds[4]));
  const goals = parseInt($(tds[tds.length - 1]).text().trim(), 10) || 0;
  if (!player || !goals) return null;
  return { player, position, club: club.name, badge: club.badge, goals };
}

async function _fetchScorers(code, saison) {
  const r = await fetch(_scorersUrl(code, saison), { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const $ = cheerio.load(await r.text());
  const rows = $('table.items').first().find('tbody > tr').toArray();
  const list = [];
  for (const el of rows) {
    const t = _parseScorerRow($, el);
    if (t) list.push(t);
  }
  return list;
}

// ── Calendario (gesamtspielplan) ──
const _fixturesUrl = (code, s) => `https://www.transfermarkt.es/x/gesamtspielplan/wettbewerb/${code}/saison_id/${s}`;

// Extrae { name, badge } de una celda de equipo del calendario.
// El nombre completo está en el title del enlace; el id del club en el href
// (/verein/<id>/) para reutilizar el proxy /tmbadge.
function _teamFromCell($cell) {
  const $a = $cell.find('a').first();
  const name = ($a.attr('title') || $a.text() || '').replace(/\s+/g, ' ').trim();
  const idM = ($a.attr('href') || '').match(/\/verein\/(\d+)/);
  return { name: name || '—', badge: idM ? `/tmbadge/${idM[1]}` : null };
}

// Parsea el calendario completo → [{ round, matches:[{date,time,home,away,score,played}] }].
async function _fetchFixtures(code, saison) {
  const r = await fetch(_fixturesUrl(code, saison), { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const $ = cheerio.load(await r.text());
  const rounds = [];
  $('.box').each((_, box) => {
    const $box = $(box);
    const head = $box.find('.content-box-headline, .table-header').first().text().replace(/\s+/g, ' ').trim();
    const rm = head.match(/(\d+)\.\s*Jornada/i);
    if (!rm) return;
    const round = parseInt(rm[1], 10);
    const matches = [];
    let lastDate = '';
    $box.find('table tbody tr').each((__, tr) => {
      const tds = $(tr).children('td').toArray();
      if (tds.length < 7) return;
      let date = $(tds[0]).text().replace(/\s+/g, ' ').trim();
      if (date) lastDate = date; else date = lastDate;
      const time = $(tds[1]).text().replace(/\s+/g, ' ').trim();
      const home = _teamFromCell($(tds[2]));
      const away = _teamFromCell($(tds[6]));
      const score = $(tds[4]).text().replace(/\s+/g, ' ').trim();
      if (home.name === '—' || away.name === '—') return;
      matches.push({
        date, time, home, away,
        score: /^\d+:\d+$/.test(score) ? score : '',
        played: /^\d+:\d+$/.test(score),
      });
    });
    if (matches.length) rounds.push({ round, matches });
  });
  rounds.sort((a, b) => a.round - b.round);
  return rounds;
}

// Selecciona la ventana relevante del calendario: la próxima jornada sin
// disputar y las siguientes. Si la temporada terminó, las últimas.
const _FX_WINDOW = 10;
function _fixtureWindow(rounds) {
  if (!rounds.length) return [];
  let idx = rounds.findIndex(r => r.matches.some(m => !m.played));
  if (idx === -1) idx = Math.max(0, rounds.length - _FX_WINDOW);
  return rounds.slice(idx, idx + _FX_WINDOW);
}

// Obtiene tabla + goleadores de una liga, con detección de temporada.
async function _fetchLeague(league) {
  const saison = _currentSaison();
  let table = [];
  let used = saison;
  try {
    table = await _fetchTable(league.code, saison);
  } catch (_) { table = []; }
  // Pretemporada: si nadie ha jugado aún, usar la temporada anterior.
  const anyPlayed = table.some(t => t.played > 0);
  if (!table.length || !anyPlayed) {
    try {
      const prev = await _fetchTable(league.code, saison - 1);
      if (prev.length) { table = prev; used = saison - 1; }
    } catch (_) {}
  }
  let scorers = [];
  try {
    scorers = await _fetchScorers(league.code, used);
  } catch (_) { scorers = []; }
  // Calendario: siempre de la temporada en curso (próximos partidos).
  let fixtures = [];
  let fxSeason = saison;
  try {
    const rounds = await _fetchFixtures(league.code, saison);
    fixtures = _fixtureWindow(rounds);
    // Si la temporada en curso aún no tiene calendario publicado, prueba la anterior.
    if (!fixtures.length) {
      const prevRounds = await _fetchFixtures(league.code, saison - 1);
      fixtures = _fixtureWindow(prevRounds);
      if (fixtures.length) fxSeason = saison - 1;
    }
  } catch (_) { fixtures = []; }
  return {
    code: league.code, name: league.name, short: league.short, flag: league.flag,
    season: `${used}/${String((used + 1) % 100).padStart(2, '0')}`,
    fxSeason: `${fxSeason}/${String((fxSeason + 1) % 100).padStart(2, '0')}`,
    table, scorers: scorers.slice(0, 10), fixtures,
  };
}

/**
 * Devuelve { leagues: [{ code, name, table, scorers, season }], updated }.
 * Caché de 30 min. Resiliente: ligas que fallan se omiten.
 */
async function getStandings() {
  const now = Date.now();
  if (_cache.data && (now - _cache.ts) < CACHE_TTL) return _cache.data;
  try {
    const results = await Promise.allSettled(LEAGUES.map(_fetchLeague));
    const leagues = results
      .filter(r => r.status === 'fulfilled' && r.value.table.length)
      .map(r => r.value);
    const data = { leagues, updated: now };
    if (leagues.length) _cache = { ts: now, data };
    return data;
  } catch (_) {
    return _cache.data || { leagues: [], updated: 0 };
  }
}

module.exports = { getStandings, LEAGUES };
