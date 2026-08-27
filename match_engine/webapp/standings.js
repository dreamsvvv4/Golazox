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

const fs      = require('fs');
const path    = require('path');
const fetch   = require('node-fetch');
const cheerio = require('cheerio');
const espn    = require('./espn');

const FETCH_TIMEOUT = 8000;
const CACHE_TTL     = 30 * 60 * 1000; // 30 min
const TM_CAP        = 9000;           // tope para el enriquecimiento de Transfermarkt

// ── Snapshot de calendario (para servidores con la IP bloqueada por TM) ──────
// El calendario (gesamtspielplan) solo lo publica Transfermarkt, que bloquea las
// IP de datacenter. En prod las tablas llegan por ESPN pero el calendario vendría
// vacío. Igual que con los fichajes, generamos un snapshot desde una IP que SÍ
// puede scrapear (`snapshotFixtures()`), lo commiteamos y lo servimos cuando el
// scrape en vivo devuelve calendario vacío.
const _FX_SNAP_FILE = path.join(__dirname, 'data', 'fixtures_snapshot.json');

// Lee el snapshot de calendario commiteado → { ES1:{fxSeason,fixtures}, … } | null.
function _readFixturesSnapshot() {
  try {
    const s = JSON.parse(fs.readFileSync(_FX_SNAP_FILE, 'utf8'));
    if (s && s.leagues && typeof s.leagues === 'object') return s.leagues;
  } catch (_) { /* no existe aún */ }
  return null;
}

// Persiste el calendario Y los goleadores de las ligas que tengan datos (nunca
// sobrescribe con vacío). Transfermarkt bloquea la IP del server, así que en
// prod tanto el calendario como los goleadores llegan de este snapshot.
// Estructura: { updated, leagues: { <code>: { fxSeason, fixtures, season, scorers } } }.
function _writeFixturesSnapshot(leagues) {
  const withData = (leagues || []).filter(l =>
    (l.fixtures && l.fixtures.length) || (l.scorers && l.scorers.length));
  if (!withData.length) return;
  try {
    fs.mkdirSync(path.dirname(_FX_SNAP_FILE), { recursive: true });
    const out = { updated: Date.now(), leagues: {} };
    for (const l of withData) out.leagues[l.code] = {
      fxSeason: l.fxSeason, fixtures: l.fixtures || [],
      season: l.season, scorers: l.scorers || [],
    };
    fs.writeFileSync(_FX_SNAP_FILE, JSON.stringify(out), 'utf8');
  } catch (_) { /* disco no disponible: no romper */ }
}

// Superpone los resultados en vivo de ESPN sobre el esqueleto de jornadas.
// Empareja cada partido por SOLAPAMIENTO DE TOKENS del par local-visitante
// (robusto ante nombres cortos/largos: "Rayo Vallecano"↔"Rayo", "Deportivo
// Alavés"↔"Alavés"). La restricción de par (ambos equipos deben solapar) evita
// colisiones tipo Real Madrid ↔ Real Sociedad. Rellena marcador, estado (jugado
// / en vivo) y goleadores. No toca los partidos futuros.
async function _overlayResults(leagues) {
  const withFx = (leagues || []).filter(l => l.fixtures && l.fixtures.length);
  if (!withFx.length) return;
  // Rango: desde el 1 de julio de la temporada en curso hasta hoy + 2 días.
  const d = new Date();
  const startY = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  const pad = (n) => String(n).padStart(2, '0');
  const fromYmd = `${startY}0701`;
  const to = new Date(d.getTime() + 2 * 86400000);
  const toYmd = `${to.getFullYear()}${pad(to.getMonth() + 1)}${pad(to.getDate())}`;
  const { byCode } = await espn.getEspnResults(fromYmd, toYmd);
  if (!byCode) return;
  for (const l of withFx) {
    const results = byCode[l.code];
    if (!results || !results.length) continue;
    for (const rnd of l.fixtures) {
      for (const m of (rnd.matches || [])) {
        const th = espn.teamTokens(m.home.name);
        const ta = espn.teamTokens(m.away.name);
        let best = null, bestScore = 0;
        for (const r of results) {
          const oh = espn.tokenOverlap(th, r.tHome);
          const oa = espn.tokenOverlap(ta, r.tAway);
          if (oh < 1 || oa < 1) continue;            // ambos equipos deben coincidir
          const s = oh + oa;
          if (s > bestScore) { bestScore = s; best = r; }
        }
        if (!best) continue;
        if (best.score) { m.score = best.score; m.played = true; }
        m.state = best.state;
        m.live = !!best.live;
        if (best.scorers && best.scorers.length) m.scorers = best.scorers;
      }
    }
  }
  // Pichichi EN VIVO: agrega los goleadores de la temporada desde los mismos
  // resultados de ESPN y los cuelga de cada liga (l._espnScorers). getStandings
  // los usa con prioridad para que la tabla de goleadores se actualice sola en
  // prod (donde Transfermarkt está bloqueado y el snapshot queda estancado).
  try {
    const agg = espn.aggregateScorers(byCode);
    for (const l of (leagues || [])) {
      const sc = agg[l.code];
      if (sc && sc.length) l._espnScorers = sc;
    }
  } catch (_) { /* la agregación es opcional: no romper el overlay */ }
}

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

// Calendario de la liga: unas cuantas jornadas ya jugadas (para ver los ÚLTIMOS
// RESULTADOS) + las próximas sin disputar hasta el final ("toda la liga"). Si la
// temporada terminó, las últimas.
// OJO: arrancar en la primera jornada sin jugar (comportamiento anterior)
// ocultaba jornadas RECIÉN COMPLETADAS. En ligas cuya última jornada está
// entera jugada (p. ej. Serie A/Bundesliga al inicio, con la J1 completa y la J2
// aún futura) el calendario empezaba en la J2 sin marcadores → "no se ven los
// resultados". Retrocedemos `_FX_BACK` jornadas para incluir los últimos
// resultados disputados.
const _FX_WINDOW = 40; // cubre las 34-38 jornadas de cualquier gran liga
const _FX_BACK   = 4;  // jornadas ya jugadas que mostramos (resultados recientes)
function _fixtureWindow(rounds) {
  if (!rounds.length) return [];
  let idx = rounds.findIndex(r => r.matches.some(m => !m.played));
  if (idx === -1) idx = Math.max(0, rounds.length - _FX_WINDOW);
  const start = Math.max(0, idx - _FX_BACK);
  return rounds.slice(start, start + _FX_WINDOW);
}

// Obtiene tabla + goleadores de una liga, con detección de temporada.
async function _fetchLeague(league) {
  const saison = _currentSaison();
  let table = [];
  let used = saison;
  try {
    table = await _fetchTable(league.code, saison);
  } catch (_) { table = []; }
  // Mostramos SIEMPRE la temporada en curso (la de ESTE año) en cuanto TM publica
  // su tabla, aunque todavía no se haya jugado (pretemporada = todos a 0). Solo
  // caemos a la temporada anterior si la actual aún no existe.
  if (!table.length) {
    try {
      const prev = await _fetchTable(league.code, saison - 1);
      if (prev.length) { table = prev; used = saison - 1; }
    } catch (_) {}
  }
  // Goleadores de la temporada mostrada (en pretemporada vendrá vacío: correcto).
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
 *
 * Fuentes: Transfermarkt (tabla + goleadores + calendario) y, como respaldo,
 * ESPN (solo tabla, sin clave). Si Transfermarkt no devuelve la tabla de una
 * liga (bloqueo/pretemporada), se usa la de ESPN para que la clasificación
 * nunca aparezca vacía. Los goleadores y el calendario siguen siendo de TM.
 */
async function getStandings() {
  const now = Date.now();
  if (_cache.data && (now - _cache.ts) < CACHE_TTL) return _cache.data;
  try {
    // ESPN es la base rápida y fiable (solo tabla). Transfermarkt enriquece con
    // goleadores y calendario, pero está IP-bloqueado a veces y cada liga puede
    // agotar varios timeouts de 8 s: por eso lo acotamos con TM_CAP para no
    // bloquear la respuesta. Si TM no llega a tiempo, se sirve la tabla de ESPN.
    const espnP = espn.getEspnStandings(LEAGUES).catch(() => ({ leagues: [] }));
    const tmP   = Promise.allSettled(LEAGUES.map(_fetchLeague));
    const tmCapped = Promise.race([
      tmP,
      new Promise(resolve => setTimeout(() => resolve(null), TM_CAP)),
    ]);
    const [espnData, tmSettled] = await Promise.all([espnP, tmCapped]);

    // Transfermarkt: ligas con tabla no vacía (datos ricos: + goleadores/calendario).
    const tmLeagues = Array.isArray(tmSettled)
      ? tmSettled.filter(r => r.status === 'fulfilled' && r.value.table.length).map(r => r.value)
      : [];
    // ESPN: respaldo de solo tabla.
    const espnLeagues = (espnData && espnData.leagues) || [];

    // Fusión por código: TM manda cuando tiene tabla; si no, entra ESPN.
    const byCode = {};
    for (const l of espnLeagues) byCode[l.code] = l;
    for (const l of tmLeagues) byCode[l.code] = l;
    const leagues = LEAGUES.map(L => byCode[L.code]).filter(Boolean);

    // Calendario Y goleadores: si alguna liga viene sin fixtures o sin goleadores
    // (ESPN trae la tabla pero no goleadores/calendario, y TM está bloqueado en
    // prod), los rellenamos desde el snapshot commiteado. Si el scrape en vivo
    // sí los trajo, refrescamos el snapshot para mantenerlo al día.
    const anyLive = leagues.some(l =>
      (l.fixtures && l.fixtures.length) || (l.scorers && l.scorers.length));
    if (anyLive) {
      try { _writeFixturesSnapshot(leagues); } catch (_) {}
    }
    if (leagues.some(l => !l.fixtures || !l.fixtures.length || !l.scorers || !l.scorers.length)) {
      const snap = _readFixturesSnapshot();
      if (snap) {
        for (const l of leagues) {
          const s = snap[l.code];
          if (!s) continue;
          if ((!l.fixtures || !l.fixtures.length) && s.fixtures && s.fixtures.length) {
            l.fixtures = s.fixtures;
            l.fxSeason = s.fxSeason || l.fxSeason;
          }
          if ((!l.scorers || !l.scorers.length) && s.scorers && s.scorers.length) {
            l.scorers = s.scorers;
            l.season = s.season || l.season;
          }
        }
      }
    }

    // Resultados EN VIVO desde ESPN (no bloqueado en prod): rellenan marcador,
    // estado y goleadores sobre el esqueleto de jornadas. Así el calendario se
    // actualiza solo según se juegan los partidos, sin regenerar el snapshot.
    try {
      await _overlayResults(leagues);
    } catch (_) { /* si ESPN falla, el calendario queda como esté (sin regresión) */ }

    // Pichichi EN VIVO: si ESPN ha agregado goleadores (temporada en curso),
    // reemplazan a los de TM/snapshot para que la tabla se actualice sola. Solo
    // cae al snapshot cuando ESPN aún no tiene datos (arranque de temporada).
    for (const l of leagues) {
      if (l._espnScorers && l._espnScorers.length) l.scorers = l._espnScorers;
      delete l._espnScorers;
    }

    const data = { leagues, updated: now };
    if (leagues.length) _cache = { ts: now, data };
    return data;
  } catch (_) {
    return _cache.data || { leagues: [], updated: 0 };
  }
}

// Genera y persiste el snapshot de calendario desde una IP que SÍ puede scrapear
// Transfermarkt. Se commitea y despliega para que prod (IP bloqueada) lo sirva.
// Lanza si el scrape viene vacío para no sobrescribir un snapshot bueno.
async function snapshotFixtures() {
  const settled = await Promise.allSettled(LEAGUES.map(_fetchLeague));
  const leagues = settled
    .filter(r => r.status === 'fulfilled' &&
      ((r.value.fixtures && r.value.fixtures.length) || (r.value.scorers && r.value.scorers.length)))
    .map(r => r.value);
  if (!leagues.length) throw new Error('scrape de calendario vacío (¿IP bloqueada por Transfermarkt?)');
  _writeFixturesSnapshot(leagues);
  return leagues.map(l => ({ code: l.code, fxSeason: l.fxSeason, rounds: (l.fixtures || []).length, scorers: (l.scorers || []).length }));
}

module.exports = { getStandings, snapshotFixtures, LEAGUES };
