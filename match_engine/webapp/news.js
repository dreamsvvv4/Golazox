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

const FETCH_TIMEOUT = 8000;
const CACHE_TTL     = 15 * 60 * 1000; // 15 minutos

// Fuentes RSS. cat: 'fichajes' (mercado) | 'general' (actualidad).
const FEEDS = [
  { name: 'Marca',            cat: 'fichajes', url: 'https://e00-marca.uecdn.es/rss/futbol/mercado-fichajes.xml' },
  { name: 'Mundo Deportivo',  cat: 'fichajes', url: 'https://www.mundodeportivo.com/feed/rss/futbol/fichajes' },
  { name: 'Marca',            cat: 'general',  url: 'https://e00-marca.uecdn.es/rss/futbol/mas-futbol.xml' },
  { name: 'AS',               cat: 'general',  url: 'https://as.com/rss/futbol/portada.xml' },
  { name: 'SPORT',            cat: 'general',  url: 'https://www.sport.es/es/rss/futbol/rss.xml' },
  { name: 'Mundo Deportivo',  cat: 'general',  url: 'https://www.mundodeportivo.com/feed/rss/futbol' },
];

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

  const data = {
    fichajes: unique.filter(i => i.cat === 'fichajes').slice(0, 25),
    general:  unique.filter(i => i.cat === 'general').slice(0, 30),
    updated:  now,
  };

  // Si por lo que sea no hubo fichajes específicos, degradar con generales.
  if (data.fichajes.length === 0) {
    data.fichajes = unique.filter(i => /fich|traspas|acuerd|firma|refuerz/i.test(i.title)).slice(0, 15);
  }

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
    // Si la ventana actual aún tiene pocos movimientos, usar la anterior.
    if (list.length < 10) {
      try {
        const prev = await _fetchTransfers(saison - 1);
        if (prev.length > list.length) list = prev;
      } catch (_) {}
    }
    list.sort((a, b) => b.fee.value - a.fee.value); // reforzar orden por importe
    const top = list.filter(t => t.fee.value > 0).slice(0, 8);

    // ── Últimos fichajes cerrados (cronológico) ──
    const latest = latestRes.status === 'fulfilled' ? latestRes.value.slice(0, 24) : [];

    const data = { list: list.slice(0, 30), top, latest, updated: now };
    if (list.length > 0 || latest.length > 0) _tCache = { ts: now, data };
    return data;
  } catch (_) {
    return _tCache.data || { list: [], top: [], latest: [], updated: 0 };
  }
}

module.exports = { getNews, getTransfers, FEEDS, IMG_HOSTS };


