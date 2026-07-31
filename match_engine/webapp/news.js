/**
 * news.js — Agregador de noticias y fichajes de fútbol (solo lectura)
 * ════════════════════════════════════════════════════════════════════
 * Obtiene TITULARES desde feeds RSS oficiales de medios deportivos y
 * los muestra con enlace a la fuente original. NO reproduce el cuerpo
 * de las noticias (evita problemas de copyright): título + fuente + link.
 *
 * - Fuentes fiables con RSS público (verificadas: responden con items).
 * - Caché en memoria de 15 min (evita golpear las fuentes en cada visita).
 * - Resiliente: si una fuente falla, se ignora y se sirven las demás.
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const fetch   = require('node-fetch');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

const FETCH_TIMEOUT = 8000;
const CACHE_TTL     = 15 * 60 * 1000; // 15 minutos

// Fuentes RSS. cat: 'fichajes' (mercado) | 'general' (actualidad).
// Todas verificadas (responden con items frescos). Los feeds 'general'
// también aportan fichajes: se reclasifican por palabras clave en getNews().
const FEEDS = [
  { name: 'Marca',            cat: 'fichajes', url: 'https://e00-marca.uecdn.es/rss/futbol/mercado-fichajes.xml' },
  { name: 'Mundo Deportivo',  cat: 'fichajes', url: 'https://www.mundodeportivo.com/feed/rss/futbol/fichajes' },
  { name: 'Marca',            cat: 'general',  url: 'https://e00-marca.uecdn.es/rss/futbol/mas-futbol.xml' },
  { name: 'Marca',            cat: 'general',  url: 'https://e00-marca.uecdn.es/rss/futbol/primera-division.xml' },
  { name: 'Marca',            cat: 'general',  url: 'https://e00-marca.uecdn.es/rss/futbol/champions-league.xml' },
  { name: 'AS',               cat: 'general',  url: 'https://as.com/rss/futbol/portada.xml' },
  { name: 'SPORT',            cat: 'general',  url: 'https://www.sport.es/es/rss/futbol/rss.xml' },
  { name: 'Mundo Deportivo',  cat: 'general',  url: 'https://www.mundodeportivo.com/feed/rss/futbol' },
];

// Detecta titulares de mercado dentro de feeds generales (para nutrir el
// tablón de fichajes con más volumen sin depender solo de feeds dedicados).
const _FICH_RE = /fich|traspas|acuerdo|firma|renov|refuerz|cesi[oó]n|libre|se marcha|adi[oó]s|nuevo\s+(jugador|fichaje)|se incorpora|oficial:/i;

// -- caché en memoria -------------------------------------------------------
let _cache = { ts: 0, data: null };

// Normaliza un título para deduplicar (sin acentos, minúsculas, sin signos).
function _normTitle(t) {
  return t.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dominios de imágenes permitidos (whitelist anti-SSRF para el proxy).
const IMG_HOSTS = [
  'estaticos-marca.com', 'e00-marca.uecdn.es',
  'mundodeportivo.com', 'epimg.net', 'as.com',
  'prensaiberica.es', 'sport.es',
];

// Extrae la primera imagen válida de un item RSS (enclosure / media:*).
function _extractImage($, $el) {
  let img = '';
  $el.find('enclosure').each((_, e) => {
    if (img) return;
    const u = ($(e).attr('url') || '').trim();
    const type = $(e).attr('type') || '';
    if (u && (/image/i.test(type) || /\.(jpe?g|png|webp)/i.test(u))) img = u;
  });
  if (!img) {
    $el.children().each((_, e) => {
      if (img) return;
      const name = (e.tagName || e.name || '').toLowerCase();
      if (name === 'media:content' || name === 'media:thumbnail') {
        const u = ($(e).attr('url') || '').trim();
        if (u) img = u;
      }
    });
  }
  if (!img || !/^https?:\/\//i.test(img)) return '';
  try {
    const host = new URL(img).hostname;
    if (!IMG_HOSTS.some(h => host === h || host.endsWith('.' + h) || host.includes(h))) return '';
  } catch (_) { return ''; }
  return '/newsimg?u=' + encodeURIComponent(img);
}

// Parsea un XML RSS/Atom y devuelve items { title, link, source, cat, ts, image }.
function _parseFeed(xml, source, cat) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out = [];
  $('item, entry').each((_, el) => {
    const $el = $(el);
    const title = ($el.children('title').first().text() || '').trim();
    // RSS usa <link>texto</link>; Atom usa <link href="...">
    let link = ($el.children('link').first().text() || '').trim();
    if (!link) link = ($el.children('link').first().attr('href') || '').trim();
    const dateStr = ($el.children('pubDate').first().text() ||
                     $el.children('published').first().text() ||
                     $el.children('updated').first().text() || '').trim();
    const ts = dateStr ? Date.parse(dateStr) : NaN;
    if (!title || !/^https?:\/\//i.test(link)) return;
    const image = _extractImage($, $el);
    out.push({ title, link, source, cat, ts: Number.isNaN(ts) ? 0 : ts, image });
  });
  return out;
}

async function _fetchFeed(feed) {
  try {
    const r = await fetch(feed.url, {
      timeout: FETCH_TIMEOUT,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolazoX/1.0; +https://golazox.com)' },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return _parseFeed(xml, feed.name, feed.cat);
  } catch (_) {
    return [];
  }
}

/**
 * Devuelve { fichajes: [...], general: [...], updated: <ms> }.
 * Usa caché de 15 min. Cada item: { title, link, source, ts }.
 */
async function getNews() {
  const now = Date.now();
  if (_cache.data && (now - _cache.ts) < CACHE_TTL) return _cache.data;

  const results = await Promise.allSettled(FEEDS.map(_fetchFeed));
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  // Deduplicar por título normalizado (distintos medios repiten noticia).
  const seen = new Set();
  const unique = [];
  for (const it of all) {
    const k = _normTitle(it.title);
    if (k.length < 8 || seen.has(k)) continue;
    seen.add(k);
    unique.push(it);
  }
  unique.sort((a, b) => b.ts - a.ts);

  // Reparto en dos tablones disjuntos: un titular de un feed 'general' que
  // hable de mercado se muestra en Fichajes (no en Actualidad) para no duplicar.
  const fichajes = [];
  const general  = [];
  for (const it of unique) {
    if (it.cat === 'fichajes' || _FICH_RE.test(it.title)) fichajes.push(it);
    else general.push(it);
  }

  const data = {
    fichajes: fichajes.slice(0, 40),
    general:  general.slice(0, 60),
    updated:  now,
  };

  // Solo cachear si obtuvimos algo; si todo falló, reintentar en la próxima visita.
  if (unique.length > 0) _cache = { ts: now, data };
  return data;
}

// ════════════════════════════════════════════════════════════════════
//  FICHAJES — fichajes MÁS CAROS de la temporada actual (Transfermarkt)
//  Fuente: /transfers/transferrekorde — ya viene ordenado por importe
//  descendente (los fichajes bomba de la ventana). Devuelve jugador,
//  posición, edad, club origen→destino (con escudo) e importe.
//  La duración de contrato NO está en la fuente: se muestra el importe
//  y, cuando aplica, el tipo (cesión/libre).
// ════════════════════════════════════════════════════════════════════

const TRANSFERS_TTL = 30 * 60 * 1000; // 30 min
let _tCache = { ts: 0, data: null };

const _TM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Referer': 'https://www.transfermarkt.es/',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'same-origin',
};

// saison_id de Transfermarkt = año de inicio de la temporada.
// Ventana de verano (jul-dic) → año actual; ventana de invierno (ene-jun) → año-1.
function _currentSaison() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

const _transfersUrl = (saison) =>
  `https://www.transfermarkt.es/transfers/transferrekorde/statistik/top/plus/1/galerie/0?saison_id=${saison}`;

// Últimos fichajes cerrados (orden cronológico, los más recientes primero).
const LATEST_URL = 'https://www.transfermarkt.es/statistik/neuestetransfers';

// ══ Base de datos propia de fichajes (histórico acumulativo) ════════════
// Transfermarkt no ofrece API ni un histórico completo descargable; cada
// raspado devuelve una ventana (~40 movimientos). Aquí persistimos los
// fichajes únicos que vamos viendo en un JSON propio que crece con el tiempo:
// una base de datos que controlamos, sin depender de terceros ni violar ToS.
const _DB_DIR      = path.join(__dirname, 'data');
const _DB_FILE     = path.join(_DB_DIR, 'transfers_db.json');
const _DB_MAX      = 5000;   // tope de registros (poda los más antiguos por descubrimiento)
const _HISTORY_VIEW = 300;   // cuántos registros exponer al front

let _db = null;              // caché en memoria del histórico

function _normKey(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Identidad de un fichaje: jugador + origen + destino + temporada (el importe
// puede cambiar de rumor a confirmado, por eso NO forma parte de la clave).
function _transferKey(t, saison) {
  return `${_normKey(t.player)}|${_normKey(t.from && t.from.name)}|${_normKey(t.to && t.to.name)}|${saison}`;
}

function _loadDb() {
  if (_db) return _db;
  try {
    const parsed = JSON.parse(fs.readFileSync(_DB_FILE, 'utf8'));
    _db = (parsed && Array.isArray(parsed.items)) ? { items: parsed.items } : { items: [] };
  } catch (_) {
    _db = { items: [] };   // no existe aún o está corrupto: empezar limpio
  }
  return _db;
}

function _saveDb() {
  try {
    fs.mkdirSync(_DB_DIR, { recursive: true });
    fs.writeFileSync(_DB_FILE, JSON.stringify({ items: _db.items }), 'utf8');
  } catch (_) { /* disco no disponible: no romper la página */ }
}

// Fusiona fichajes raspados en el histórico. Devuelve el número de nuevos.
function _mergeTransfers(items, saison) {
  const db = _loadDb();
  const now = Date.now();
  if (!db._idx) {
    db._idx = new Map();
    for (const it of db.items) db._idx.set(it.key, it);
  }
  let added = 0;
  for (const t of items) {
    if (!t || !t.player || !t.to || t.to.name === '—') continue;
    const key = _transferKey(t, saison);
    const existing = db._idx.get(key);
    if (existing) {
      existing.lastSeen = now;
      const prevFee = existing.fee ? existing.fee.value : 0;
      if (t.fee && (t.fee.value || 0) > prevFee) existing.fee = t.fee;
      continue;
    }
    const rec = {
      key,
      player: t.player, position: t.position || '', age: t.age || '', nat: t.nat || '',
      from: t.from, to: t.to, fee: t.fee || { value: 0, label: '', type: '' },
      saison, firstSeen: now, lastSeen: now,
    };
    db.items.push(rec);
    db._idx.set(key, rec);
    added++;
  }
  if (added) {
    if (db.items.length > _DB_MAX) {   // poda: conservar los más recientes
      db.items.sort((a, b) => b.firstSeen - a.firstSeen);
      db.items = db.items.slice(0, _DB_MAX);
      db._idx = new Map(db.items.map(it => [it.key, it]));
    }
    _saveDb();
  }
  return added;
}

// Vista para el front: más recientes primero (por orden de descubrimiento).
function _historyView() {
  const db = _loadDb();
  return db.items
    .slice()
    .sort((a, b) => b.firstSeen - a.firstSeen)
    .slice(0, _HISTORY_VIEW)
    .map(({ key, firstSeen, lastSeen, ...pub }) => pub);
}

// Convierte "145,00 mill. €" | "876 mil €" | "Libre" | "Cesión" a estructura.
function _parseFee(raw) {
  const t = (raw || '').replace(/\s+/g, ' ').trim();
  if (!t || t === '?' || t === '-') return { type: 'unknown', label: '—', value: 0 };
  if (/^libre/i.test(t))            return { type: 'free',    label: 'Libre',   value: 0 };
  if (/^cesi[oó]n$/i.test(t))       return { type: 'loan',    label: 'Cesión',  value: 0 };
  const isLoanFee = /coste de cesi[oó]n/i.test(t);
  const src = isLoanFee ? t.replace(/.*coste de cesi[oó]n:?/i, '') : t;
  const m = src.match(/([\d.,]+)\s*(mil|mill\.?)\s*€/i);
  let value = 0;
  if (m) {
    const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    value = /mill/i.test(m[2]) ? num * 1e6 : num * 1e3;
  }
  const label = isLoanFee ? 'Cesión · ' + src.trim() : t;
  return { type: isLoanFee ? 'loan' : 'fee', label, value };
}

function _clubFromCell($cell) {
  const $img = $cell.find('img').first();
  const alt  = ($img.attr('alt') || '').split('|')[0].trim();
  const src  = $img.attr('src') || $img.attr('data-src') || '';
  const idM  = src.match(/wappen\/\w+\/(\d+)\.png/);
  const name = alt || $cell.find('a').first().attr('title') || $cell.find('a').first().text().trim();
  return { name: name || '—', badge: idM ? `/tmbadge/${idM[1]}` : null };
}

// Fila de la tabla de récords: 9 celdas
// [0]=rango [1]=jugador+pos [2]=edad [3]=valor [4]=temporada [5]=nac [6]=origen [7]=destino [8]=importe
function _parseRecordRow($, el) {
  const tds = $(el).children('td').toArray();
  if (tds.length < 9) return null;
  const $1 = $(tds[1]);
  const player = ($1.find('img').first().attr('alt') || $1.find('a').first().text() || '').trim();
  const position = $1.text().replace(/\s+/g, ' ').replace(player, '').trim();
  const age = $(tds[2]).text().trim();
  const nat = ($(tds[5]).find('img').first().attr('alt') || '').split('|')[0].trim();
  const from = _clubFromCell($(tds[6]));
  const to   = _clubFromCell($(tds[7]));
  const fee  = _parseFee($(tds[8]).text());
  if (!player || from.name === '—' || to.name === '—') return null;
  return { player, position, age, nat, from, to, fee };
}

async function _fetchTransfers(saison) {
  const r = await fetch(_transfersUrl(saison), { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const $ = cheerio.load(await r.text());
  const rows = $('table.items').first().find('tbody > tr').toArray();
  const list = [];
  for (const el of rows) {
    const t = _parseRecordRow($, el);
    if (t) list.push(t);
  }
  return list;
}

// Fila de "últimos fichajes": 6 celdas
// [0]=jugador+pos [1]=edad [2]=nacionalidad [3]=origen [4]=destino [5]=importe
function _parseLatestRow($, el) {
  const tds = $(el).children('td').toArray();
  if (tds.length < 6) return null;
  const $0 = $(tds[0]);
  const player = ($0.find('img').first().attr('alt') || $0.find('a').first().text() || '').trim();
  const position = $0.text().replace(/\s+/g, ' ').replace(player, '').trim();
  const age = $(tds[1]).text().trim();
  const nat = ($(tds[2]).find('img').first().attr('alt') || '').split('|')[0].trim();
  const from = _clubFromCell($(tds[3]));
  const to   = _clubFromCell($(tds[4]));
  const fee  = _parseFee($(tds[5]).text());
  if (!player || from.name === '—' || to.name === '—') return null;
  return { player, position, age, nat, from, to, fee };
}

async function _fetchLatest() {
  const r = await fetch(LATEST_URL, { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const $ = cheerio.load(await r.text());
  const rows = $('table.items').first().find('tbody > tr').toArray();
  const list = [];
  for (const el of rows) {
    const t = _parseLatestRow($, el);
    if (t) list.push(t);
  }
  return list;
}

async function getTransfers() {
  const now = Date.now();
  if (_tCache.data && (now - _tCache.ts) < TRANSFERS_TTL) return _tCache.data;
  try {
    const saison = _currentSaison();
    const [seasonRes, latestRes] = await Promise.allSettled([
      _fetchTransfers(saison),
      _fetchLatest(),
    ]);

    // ── Fichajes más caros de la temporada ──
    let list = seasonRes.status === 'fulfilled' ? seasonRes.value : [];
    let usedSaison = saison;
    // Si la ventana actual aún tiene pocos movimientos, usar la anterior.
    if (list.length < 10) {
      try {
        const prev = await _fetchTransfers(saison - 1);
        if (prev.length > list.length) { list = prev; usedSaison = saison - 1; }
      } catch (_) {}
    }
    list.sort((a, b) => b.fee.value - a.fee.value); // reforzar orden por importe
    const top = list.filter(t => t.fee.value > 0).slice(0, 8);

    // ── Últimos fichajes cerrados (cronológico) ──
    const latest = latestRes.status === 'fulfilled' ? latestRes.value.slice(0, 40) : [];

    // ── Persistir en el histórico propio (fichajes únicos vistos) ──
    try {
      _mergeTransfers(list, usedSaison);
      _mergeTransfers(latest, saison);
    } catch (_) { /* no bloquear la respuesta por un fallo de persistencia */ }
    const history = _historyView();
    const historyTotal = _loadDb().items.length;

    const data = { list: list.slice(0, 40), top, latest, history, historyTotal, updated: now };
    if (list.length > 0 || latest.length > 0) _tCache = { ts: now, data };
    return data;
  } catch (_) {
    return _tCache.data || { list: [], top: [], latest: [], history: [], historyTotal: 0, updated: 0 };
  }
}

// ════════════════════════════════════════════════════════════════════
//  RANKINGS DE JUGADORES  (valor de mercado + estadísticas)
// ════════════════════════════════════════════════════════════════════
const RANK_TTL = 6 * 60 * 60 * 1000; // 6 h — cambian despacio

// Nombre + posición desde una celda "jugador" de Transfermarkt.
function _playerFromCell($cell) {
  const $img = $cell.find('img').first();
  const name = ($img.attr('alt') || $cell.find('a').first().attr('title') ||
                $cell.find('a').first().text() || '').trim();
  const position = $cell.text().replace(/\s+/g, ' ').replace(name, '').trim();
  return { name, position };
}

// ── Jugadores más valiosos (valor de mercado) ──
let _vCache = { ts: 0, data: null };
const VALUES_URL = 'https://www.transfermarkt.es/marktwertetop/wertvollstespieler';

// Fila de valor de mercado: 6 celdas
// [0]=rango [1]=jugador+pos [2]=edad [3]=nac [4]=club [5]=valor
function _parseValueRow($, el) {
  const tds = $(el).children('td').toArray();
  if (tds.length < 6) return null;
  const { name: player, position } = _playerFromCell($(tds[1]));
  if (!player) return null;
  const age  = $(tds[2]).text().trim();
  const nat  = ($(tds[3]).find('img').first().attr('alt') || '').split('|')[0].trim();
  const club = _clubFromCell($(tds[4]));
  const fee  = _parseFee($(tds[5]).text());
  return { player, position, age, nat, club, value: fee.value, valueLabel: fee.label };
}

async function getValues() {
  const now = Date.now();
  if (_vCache.data && (now - _vCache.ts) < RANK_TTL) return _vCache.data;
  try {
    const r = await fetch(VALUES_URL, { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const $ = cheerio.load(await r.text());
    const rows = $('table.items').first().find('tbody > tr').toArray();
    const list = [];
    for (const el of rows) { const t = _parseValueRow($, el); if (t) list.push(t); }
    const data = { list: list.slice(0, 50), updated: now };
    if (list.length) _vCache = { ts: now, data };
    return data;
  } catch (_) {
    return _vCache.data || { list: [], updated: 0 };
  }
}

// ── Estadísticas: goleadores y asistentes (scorerliste por liga) ──
let _sCache = { ts: 0, data: null };
const _STAT_LEAGUES = [
  { slug: 'laliga',                code: 'ES1', name: 'LaLiga' },
  { slug: 'premier-league',        code: 'GB1', name: 'Premier League' },
  { slug: 'serie-a',               code: 'IT1', name: 'Serie A' },
  { slug: 'bundesliga',            code: 'L1',  name: 'Bundesliga' },
  { slug: 'ligue-1',               code: 'FR1', name: 'Ligue 1' },
];
const _scorerUrl = (slug, code, saison) =>
  `https://www.transfermarkt.es/${slug}/scorerliste/wettbewerb/${code}/saison_id/${saison}`;

// Fila scorerliste: 9 celdas
// [0]=rango [1]=jugador+pos [2]=club [3]=nac [4]=edad [5]=partidos [6]=goles [7]=asist [8]=puntos
function _parseScorerRow($, el, league) {
  const tds = $(el).children('td').toArray();
  if (tds.length < 9) return null;
  const { name: player, position } = _playerFromCell($(tds[1]));
  if (!player) return null;
  const club = _clubFromCell($(tds[2]));
  const nat  = ($(tds[3]).find('img').first().attr('alt') || '').split('|')[0].trim();
  const age  = $(tds[4]).text().trim();
  const toInt = (i) => parseInt(($(tds[i]).text() || '').replace(/[^\d]/g, ''), 10) || 0;
  return { player, position, club, nat, age, apps: toInt(5), goals: toInt(6), assists: toInt(7), league };
}

async function _fetchScorers(saison) {
  const results = await Promise.allSettled(_STAT_LEAGUES.map(async (lg) => {
    const r = await fetch(_scorerUrl(lg.slug, lg.code, saison), { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const $ = cheerio.load(await r.text());
    const rows = $('table.items').first().find('tbody > tr').toArray();
    const out = [];
    for (const el of rows) { const t = _parseScorerRow($, el, lg.name); if (t) out.push(t); }
    return out;
  }));
  const all = [];
  for (const res of results) if (res.status === 'fulfilled') all.push(...res.value);
  return all;
}

async function getStats() {
  const now = Date.now();
  if (_sCache.data && (now - _sCache.ts) < RANK_TTL) return _sCache.data;
  try {
    const saison = _currentSaison();
    let all = await _fetchScorers(saison);
    let season = saison;
    // Al inicio de temporada aún no hay datos: usar la temporada anterior.
    const totalGoals = all.reduce((s, p) => s + p.goals, 0);
    if (all.length < 20 || totalGoals < 20) {
      const prev = await _fetchScorers(saison - 1);
      if (prev.reduce((s, p) => s + p.goals, 0) > totalGoals) { all = prev; season = saison - 1; }
    }
    const scorers = all.slice().sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 30);
    const assists = all.slice().sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 30);
    const label = `${season}/${String(season + 1).slice(-2)}`;
    const data = { scorers, assists, season: label, updated: now };
    if (all.length) _sCache = { ts: now, data };
    return data;
  } catch (_) {
    return _sCache.data || { scorers: [], assists: [], season: '', updated: 0 };
  }
}

// ── Rumores de fichajes (con probabilidad de traspaso) ──
// Transfermarkt publica la "probabilidad de cambio" votada por usuarios en
// /geruechte/aktuellegeruechte/statistik. Cada fila: jugador, club actual →
// club interesado, edad, nacionalidad, fecha y % de probabilidad.
let _rCache = { ts: 0, data: null };
const RUMORS_URL = 'https://www.transfermarkt.es/geruechte/aktuellegeruechte/statistik';
const RUMORS_TTL = 30 * 60 * 1000; // 30 min

// Quita texto duplicado tipo "Sin equipoSin equipo" → "Sin equipo".
function _dedupText(s) {
  s = (s || '').replace(/\s+/g, ' ').trim();
  const h = s.slice(0, s.length / 2);
  if (h && s === h + h) return h.trim();
  return s;
}

// Fila de rumor: 13 celdas (con inline-tables anidadas).
// [2]=jugador [3]=pos [4]=edad [5]=nac [6]=club actual [7]=club interesado
// [9]=nombre club interesado [11]=fecha [12]=probabilidad
function _parseRumorRow($, el) {
  const tds = $(el).find('td');
  if (tds.length < 12) return null;
  const player = _dedupText($(tds[2]).find('a').first().text() || $(tds[2]).text());
  if (!player) return null;
  const position = $(tds[3]).text().trim();
  const age = $(tds[4]).text().trim();
  const nat = ($(tds[5]).find('img').first().attr('title') ||
               $(tds[5]).find('img').first().attr('alt') || '').split('|')[0].trim();
  const from = _clubFromCell($(tds[6]));
  // El club interesado: escudo en la celda 7, nombre completo en su título.
  const to = _clubFromCell($(tds[7]));
  const toFull = _dedupText($(tds[7]).find('a').first().attr('title') || '');
  if (toFull) to.name = toFull;
  const probRaw = $(tds[12]).text().replace(/\s+/g, ' ').trim();
  const pm = probRaw.match(/(\d{1,3})\s?%/);
  const prob = pm ? parseInt(pm[1], 10) : null;
  if (from.name === '—' && to.name === '—') return null;
  return { player, position, age, nat, from, to, prob };
}

async function getRumors() {
  const now = Date.now();
  if (_rCache.data && (now - _rCache.ts) < RUMORS_TTL) return _rCache.data;
  try {
    const r = await fetch(RUMORS_URL, { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const $ = cheerio.load(await r.text());
    const trs = $('table.items').first().children('tbody').children('tr').toArray();
    const list = [];
    for (const el of trs) { const it = _parseRumorRow($, el); if (it) list.push(it); }
    // Los que tienen probabilidad primero (mayor a menor); los sin % al final.
    list.sort((a, b) => (b.prob == null ? -1 : b.prob) - (a.prob == null ? -1 : a.prob));
    const data = { list: list.slice(0, 30), updated: now };
    if (list.length) _rCache = { ts: now, data };
    return data;
  } catch (_) {
    return _rCache.data || { list: [], updated: 0 };
  }
}

// ════════════════════════════════════════════════════════════════════
//  DATOS CURADOS  (no existen en fuentes gratuitas fiables)
//  Se leen de /data/*.json y son editables a mano. Si el archivo no
//  existe se devuelve un valor vacío sin romper la página.
// ════════════════════════════════════════════════════════════════════
function _readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(_DB_DIR, file), 'utf8')); }
  catch (_) { return fallback; }
}

// Agenda: próximos eventos importantes (sorteos, inicios de liga, finales…).
// Se filtran los ya pasados y se ordenan por fecha ascendente.
function getAgenda() {
  const raw = _readJson('agenda.json', { events: [] });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const events = (raw.events || [])
    .filter(e => e && e.date && new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 40);
  return { events, updated: raw.updated || 0 };
}

// Mejor pagados: estimaciones de salario anual según prensa (curado).
function getSalaries() {
  const raw = _readJson('salaries.json', { players: [] });
  const players = (raw.players || [])
    .slice()
    .sort((a, b) => (b.salary || 0) - (a.salary || 0))
    .slice(0, 30);
  return { players, updated: raw.updated || 0, note: raw.note || '' };
}

// Leyendas / máximos históricos (curado).
function getLegends() {
  return _readJson('legends.json', { scorers: [], assists: [], note: '' });
}

module.exports = {
  getNews, getTransfers, getValues, getStats, getRumors,
  getAgenda, getSalaries, getLegends,
  FEEDS, IMG_HOSTS,
};


