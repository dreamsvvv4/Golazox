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
const espn    = require('./espn');

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
  { name: 'Marca',            cat: 'general',  url: 'https://e00-marca.uecdn.es/rss/futbol/real-madrid.xml' },
  { name: 'Marca',            cat: 'general',  url: 'https://e00-marca.uecdn.es/rss/futbol/barcelona.xml' },
  { name: 'Marca',            cat: 'general',  url: 'https://e00-marca.uecdn.es/rss/futbol/futbol-internacional.xml' },
  { name: 'SPORT',            cat: 'general',  url: 'https://www.sport.es/es/rss/futbol/rss.xml' },
  { name: 'Mundo Deportivo',  cat: 'general',  url: 'https://www.mundodeportivo.com/feed/rss/futbol' },
  { name: 'ABC',              cat: 'general',  url: 'https://www.abc.es/rss/2.0/deportes/futbol/' },
  { name: 'El Mundo',         cat: 'general',  url: 'https://e00-elmundo.uecdn.es/elmundodeporte/rss/futbol.xml' },
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

// ── Ranking de relevancia (para la Actualidad) ──────────────────────────
// Objetivo: que lo IMPORTANTE encabece, no solo lo más reciente. Se puntúa
// cada titular por: temática (clubes/estrellas/competiciones grandes, hitos),
// cobertura (nº de medios que publican la misma noticia) y frescura. Se
// penaliza el relleno de bajo valor (previas, "dónde ver", entrenamientos…).
const _BIG_CLUBS = /real madrid|barcelona|barça|atl[eé]tico|manchester (city|united)|man city|man utd|liverpool|chelsea|arsenal|tottenham|bayern|psg|paris saint|juventus|\binter\b|milan|napoli|dortmund|ajax|benfica|porto|sevilla|valencia|athletic|betis|villarreal|roma|leverkusen/i;
const _BIG_NAMES = /messi|cristiano|ronaldo|mbapp|haaland|vinicius|vin[ií]cius|bellingham|lamine|yamal|lewandowski|benzema|neymar|griezmann|modric|kroos|de bruyne|salah|\bkane\b|pedri|gavi|\brodri\b|courtois|ter stegen|lautaro|osimhen|endrick|guardiola|ancelotti|xabi alonso|flick|mourinho|klopp/i;
const _BIG_COMP  = /champions|liga de campeones|mundial|world cup|eurocopa|euro 202|copa del rey|europa league|final\b|semifinal|cl[aá]sico|derbi|bal[oó]n de oro|ballon|the best|fifa|uefa|supercopa/i;
const _HOT_WORDS = /oficial|confirmad|bombazo|acuerdo total|hist[oó]rico|r[eé]cord|lesi[oó]n|sanci[oó]n|dimite|destitu|despido|se marcha|adi[oó]s|renueva|nuevo entrenador|campe[oó]n|t[ií]tulo|remontada|hat[- ]?trick|golazo|expulsi[oó]n|pol[eé]mic|denuncia|investiga|dopaje|ces[ae]|estalla|estall[oó]|traici[oó]n|guerra/i;
const _LOW_WORDS = /previa|d[oó]nde ver|a qu[eé] hora|horario|alineaciones probables|c[oó]mo llegan|en directo|minuto a minuto|narraci[oó]n|s[ií]guelo|opini[oó]n|columna|editorial|encuesta|qu[ií]niela|hor[oó]scopo|entrenamiento|rueda de prensa|apuestas|cu[oó]tas|pron[oó]stico|\bfoto[s]?\b|galer[ií]a|as[ií] fue el|resumen del|lo mejor de|el d[ií]a de|abono|equipaci[oó]n|nueva camiseta|campa[ñn]a de|presenta su|d[ií]a del socio|se pone a la venta|entradas para|sorteo|felicita|cumplea[ñn]os|aniversario|efem[eé]ride/i;

// Puntúa la importancia temática de un titular (independiente de la fecha).
function _importancePts(title) {
  let s = 0;
  if (_HOT_WORDS.test(title)) s += 6;
  if (_BIG_COMP.test(title))  s += 4;
  if (_BIG_NAMES.test(title)) s += 4;
  if (_BIG_CLUBS.test(title)) s += 3;
  if (_LOW_WORDS.test(title)) s -= 7;
  return s;
}

// Puntúa la frescura (decae con las horas). Mantiene relevante lo reciente
// sin dejar que domine por completo sobre un notición un poco más antiguo.
function _recencyPts(ts, now) {
  if (!ts) return 0;
  const h = (now - ts) / 3600000;
  if (h < 1)  return 9;
  if (h < 3)  return 7;
  if (h < 6)  return 5;
  if (h < 12) return 3;
  if (h < 24) return 2;
  if (h < 48) return 1;
  return 0;
}

// Puntuación global: importancia + cobertura (nº de medios) + frescura.
function _newsRank(it, now) {
  const cov = Math.min(it._cov || 1, 4);         // 1..4 medios cubriendo
  return _importancePts(it.title) + (cov - 1) * 3 + _recencyPts(it.ts, now);
}

// Dominios de imágenes permitidos (whitelist anti-SSRF para el proxy).
const IMG_HOSTS = [
  'estaticos-marca.com', 'e00-marca.uecdn.es',
  'mundodeportivo.com', 'epimg.net', 'as.com',
  'prensaiberica.es', 'sport.es',
  'espncdn.com',
  'abcstatics.com', 'e00-elmundo.uecdn.es',
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

// ════════════════════════════════════════════════════════════════════
//  CACHÉ EN DISCO + ESTADO DE SCRAPERS + ALERTAS
//  - Persiste el último resultado bueno de cada scraper en data/.cache/
//    para que un reinicio (Passenger) no obligue a re-raspar en frío.
//  - Registra el estado de cada fuente (ok / vacío / fallo) para /health.
//  - Si ALERT_WEBHOOK está definido, avisa (throttled) cuando algo falla.
// ════════════════════════════════════════════════════════════════════
const _CACHE_DIR = path.join(__dirname, 'data', '.cache');
const _cacheFile = (key) => path.join(_CACHE_DIR, `${key}.json`);

// Lee del disco el último resultado persistido: { ts, data } | null.
function _cacheGet(key) {
  try {
    const raw = JSON.parse(fs.readFileSync(_cacheFile(key), 'utf8'));
    if (raw && raw.data && typeof raw.ts === 'number') return { ts: raw.ts, data: raw.data };
  } catch (_) { /* no existe o corrupto */ }
  return null;
}

// Persiste { ts, data } en disco (fire-and-forget, nunca rompe la respuesta).
function _cachePut(key, entry) {
  try {
    fs.mkdirSync(_CACHE_DIR, { recursive: true });
    fs.writeFileSync(_cacheFile(key), JSON.stringify({ ts: entry.ts, data: entry.data }), 'utf8');
  } catch (_) { /* disco no disponible */ }
}

// Registro de estado por scraper (para el endpoint /health y las alertas).
const _status = {};   // key -> { state, count, lastOk, lastErr, err }
let _lastAlert = {};   // key -> ts del último aviso (throttle)
const _ALERT_TTL = 30 * 60 * 1000; // no repetir el mismo aviso en 30 min

// Cuenta los registros de un data-object cacheado (según su forma).
function _countData(d) {
  if (!d) return 0;
  if (Array.isArray(d.list)) return d.list.length;
  if (Array.isArray(d.scorers)) return d.scorers.length;
  if (d.fichajes || d.general) return (d.fichajes || []).length + (d.general || []).length;
  return 0;
}

// Marca una fuente como OK sembrada desde disco, para que /health la refleje
// aunque no se haya vuelto a raspar en la vida de este proceso.
function _seed(key, entry) {
  if (!entry || _status[key]) return;
  _status[key] = { state: 'ok', count: _countData(entry.data), lastOk: entry.ts || 0, lastErr: 0, err: '' };
}

function _mark(key, state, count, err) {
  const prev = _status[key] || {};
  _status[key] = {
    state,
    count: count != null ? count : (prev.count || 0),
    lastOk: state === 'ok' ? Date.now() : (prev.lastOk || 0),
    lastErr: (state === 'fail' || state === 'empty') ? Date.now() : (prev.lastErr || 0),
    err: err || (state === 'ok' ? '' : (prev.err || '')),
  };
  if (state === 'fail' || state === 'empty') _alert(key, state, err);
}

// Aviso opcional a un webhook (Slack/Discord/Telegram-compatible via texto).
function _alert(key, state, err) {
  const url = process.env.ALERT_WEBHOOK;
  if (!url) return;
  const now = Date.now();
  if (_lastAlert[key] && (now - _lastAlert[key]) < _ALERT_TTL) return; // throttle
  _lastAlert[key] = now;
  const msg = `⚠️ GolazoX scraper "${key}": ${state}${err ? ' — ' + err : ''}`;
  fetch(url, {
    method: 'POST',
    timeout: FETCH_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: msg, content: msg }),
  }).catch(() => { /* el aviso nunca debe romper nada */ });
}

// Estado agregado de todas las fuentes (para GET /health).
function getStatus() {
  const now = Date.now();
  const sources = Object.entries(_status).map(([key, s]) => ({
    key,
    state: s.state,
    count: s.count,
    ageMin: s.lastOk ? Math.round((now - s.lastOk) / 60000) : null,
    lastOk: s.lastOk || null,
    err: s.err || undefined,
  }));
  const healthy = sources.length === 0 || sources.every(s => s.state === 'ok');
  return { ok: healthy, ts: now, sources };
}

/**
 * Devuelve { fichajes: [...], general: [...], updated: <ms> }.
 * Usa caché de 15 min. Cada item: { title, link, source, ts }.
 */
async function getNews() {
  const now = Date.now();
  if (!_cache.data) { const d = _cacheGet('news'); if (d) { _cache = d; _seed('news', d); } }
  if (_cache.data && (now - _cache.ts) < CACHE_TTL) return _cache.data;

  const results = await Promise.allSettled(FEEDS.map(_fetchFeed));
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  // Ordenar por recencia y deduplicar CONTANDO cobertura: cuántos medios
  // publican la misma noticia es una señal fuerte de importancia.
  all.sort((a, b) => b.ts - a.ts);
  const byKey = new Map();
  const unique = [];
  for (const it of all) {
    const k = _normTitle(it.title);
    if (k.length < 8) continue;
    const prev = byKey.get(k);
    if (prev) { prev._cov = (prev._cov || 1) + 1; continue; } // ya visto (más nuevo)
    it._cov = 1;
    byKey.set(k, it);
    unique.push(it);
  }

  // Reparto en dos tablones disjuntos: un titular de un feed 'general' que
  // hable de mercado se muestra en Fichajes (no en Actualidad) para no duplicar.
  const fichajes = [];
  const general  = [];
  for (const it of unique) {
    if (it.cat === 'fichajes' || _FICH_RE.test(it.title)) fichajes.push(it);
    else general.push(it);
  }

  // Fichajes: se mantiene el orden cronológico (el mercado quiere lo último).
  // Actualidad: se ordena por RELEVANCIA (importancia + cobertura + frescura)
  // para que lo más importante encabece y la portada destaque un notición.
  for (const it of general) it._rank = _newsRank(it, now);
  general.sort((a, b) => (b._rank - a._rank) || (b.ts - a.ts));

  const data = {
    fichajes: fichajes.slice(0, 40),
    general:  general.slice(0, 60),
    updated:  now,
  };

  // Solo cachear si obtuvimos algo; si todo falló, reintentar en la próxima visita.
  if (unique.length > 0) { _cache = { ts: now, data }; _cachePut('news', _cache); _mark('news', 'ok', unique.length); }
  else _mark('news', 'empty', 0);
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

// ── Snapshot de fichajes (para servidores con la IP bloqueada por TM) ────
// Transfermarkt bloquea las IP de datacenter (403/429), así que el scrape en
// vivo solo funciona desde una IP residencial (tu PC / un cron local). Para que
// producción muestre fichajes igualmente, generamos un snapshot completo desde
// donde SÍ funciona (`snapshotTransfers()`), lo commiteamos y lo desplegamos;
// el server lo sirve cuando el scrape en vivo devuelve vacío. Es la última hora
// del mercado real, no una caché rancia: por eso se etiqueta `source:'snapshot'`.
const _SNAP_FILE = path.join(_DB_DIR, 'transfers_snapshot.json');

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

// Persiste un snapshot completo del mercado (list/top/latest/history) para que
// un server con la IP bloqueada por TM pueda servirlo. Solo se escribe desde
// donde el scrape en vivo funciona (nunca se sobrescribe con datos vacíos).
function _writeSnapshot(data) {
  if (!data || (!data.list?.length && !data.latest?.length)) return;
  try {
    fs.mkdirSync(_DB_DIR, { recursive: true });
    const snap = {
      list: data.list || [], top: data.top || [], latest: data.latest || [],
      history: data.history || [], historyTotal: data.historyTotal || 0,
      updated: data.updated || Date.now(),
    };
    fs.writeFileSync(_SNAP_FILE, JSON.stringify(snap), 'utf8');
  } catch (_) { /* disco no disponible: no romper */ }
}

// Lee el snapshot commiteado. Devuelve el payload con `source:'snapshot'` para
// que el server sepa que es dato deliberado (mercado actual), no caché rancia.
function _readSnapshot() {
  try {
    const s = JSON.parse(fs.readFileSync(_SNAP_FILE, 'utf8'));
    if (s && (Array.isArray(s.list) || Array.isArray(s.latest))) {
      return {
        list: s.list || [], top: s.top || [], latest: s.latest || [],
        history: s.history || [], historyTotal: s.historyTotal || 0,
        updated: s.updated || 0, source: 'snapshot',
      };
    }
  } catch (_) { /* no existe aún */ }
  return null;
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

// Scrape en vivo de Transfermarkt (récords de la temporada + últimos cerrados).
// Solo devuelve datos si la IP no está bloqueada por TM (residencial). Devuelve
// { list, top, latest, usedSaison, saison } con `list` ordenada por importe.
async function _scrapeLive() {
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
  return { list, top, latest, usedSaison, saison };
}

// Construye el payload público a partir de un scrape, fusionando en el histórico.
function _buildTransferData(scr, updated, source) {
  try {
    _mergeTransfers(scr.list, scr.usedSaison);
    _mergeTransfers(scr.latest, scr.saison);
  } catch (_) { /* no bloquear la respuesta por un fallo de persistencia */ }
  return {
    list: scr.list.slice(0, 40), top: scr.top, latest: scr.latest,
    history: _historyView(), historyTotal: _loadDb().items.length,
    updated, source,
  };
}

// Genera y persiste el snapshot de fichajes desde una IP que SÍ puede scrapear
// Transfermarkt (tu PC / cron local). Se commitea y despliega para que producción
// lo sirva. Lanza si el scrape viene vacío (probable bloqueo de IP) para no
// sobrescribir un snapshot bueno con datos vacíos.
async function snapshotTransfers() {
  const scr = await _scrapeLive();
  if (!scr.list.length && !scr.latest.length) {
    throw new Error('scrape vacío (¿IP bloqueada por Transfermarkt?)');
  }
  const data = _buildTransferData(scr, Date.now(), 'snapshot');
  _writeSnapshot(data);
  return data;
}

async function getTransfers() {
  const now = Date.now();
  if (!_tCache.data) { const d = _cacheGet('transfers'); if (d) { _tCache = d; _seed('transfers', d); } }
  if (_tCache.data && (now - _tCache.ts) < TRANSFERS_TTL) return _tCache.data;
  try {
    const scr = await _scrapeLive();

    if (scr.list.length > 0 || scr.latest.length > 0) {
      const data = _buildTransferData(scr, now, 'live');
      _tCache = { ts: now, data }; _cachePut('transfers', _tCache);
      _mark('transfers', 'ok', scr.list.length);
      try { _writeSnapshot(data); } catch (_) {} // mantener snapshot fresco donde el scrape funciona
      return data;
    }

    // Scrape vacío (IP bloqueada por TM): servir el snapshot commiteado, que trae
    // el mercado real capturado desde una IP residencial.
    _mark('transfers', 'empty', 0);
    const snap = _readSnapshot();
    if (snap) { snap.history = _historyView(); snap.historyTotal = _loadDb().items.length; _tCache = { ts: now, data: snap }; return snap; }
    let history = [], historyTotal = 0;
    try { history = _historyView(); historyTotal = _loadDb().items.length; } catch (_) {}
    return { list: [], top: [], latest: [], history, historyTotal, updated: 0 };
  } catch (e) {
    _mark('transfers', 'fail', 0, e.message);
    // Aunque el scrapeo falle: 1) caché en vivo reciente, 2) snapshot commiteado,
    // 3) histórico propio. Así producción muestra fichajes reales sin TM en vivo.
    if (_tCache.data && _tCache.data.source === 'live') return _tCache.data;
    const snap = _readSnapshot();
    if (snap) { try { snap.history = _historyView(); snap.historyTotal = _loadDb().items.length; } catch (_) {} _tCache = { ts: now, data: snap }; return snap; }
    if (_tCache.data) return _tCache.data;
    let history = [], historyTotal = 0;
    try { history = _historyView(); historyTotal = _loadDb().items.length; } catch (_) {}
    return { list: [], top: [], latest: [], history, historyTotal, updated: 0 };
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
  if (!_vCache.data) { const d = _cacheGet('values'); if (d) { _vCache = d; _seed('values', d); } }
  if (_vCache.data && (now - _vCache.ts) < RANK_TTL) return _vCache.data;
  try {
    const r = await fetch(VALUES_URL, { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const $ = cheerio.load(await r.text());
    const rows = $('table.items').first().find('tbody > tr').toArray();
    const list = [];
    for (const el of rows) { const t = _parseValueRow($, el); if (t) list.push(t); }
    const data = { list: list.slice(0, 50), updated: now };
    if (list.length) { _vCache = { ts: now, data }; _cachePut('values', _vCache); _mark('values', 'ok', list.length); }
    else _mark('values', 'empty', 0);
    return data;
  } catch (e) {
    _mark('values', 'fail', 0, e.message);
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

// Reconstruye el ranking de participaciones (G+A) a partir de la unión de
// goleadores + asistentes cuando el dato cacheado no lo trae (compatibilidad
// con cachés antiguas). Así la pestaña G+A funciona sin esperar al refresco.
function _ensureContribs(data) {
  if (!data) return data;
  if (Array.isArray(data.contributions) && data.contributions.length) return data;
  const map = new Map();
  for (const p of [...(data.scorers || []), ...(data.assists || [])]) {
    const key = `${p.player}|${(p.club && p.club.name) || ''}`;
    if (!map.has(key)) map.set(key, { ...p, ga: (p.goals || 0) + (p.assists || 0) });
  }
  data.contributions = [...map.values()]
    .filter(p => p.ga > 0)
    .sort((a, b) => b.ga - a.ga || b.goals - a.goals)
    .slice(0, 30);
  return data;
}

async function getStats() {
  const now = Date.now();
  if (!_sCache.data) { const d = _cacheGet('stats'); if (d) { _sCache = d; _seed('stats', d); } }
  if (_sCache.data && (now - _sCache.ts) < RANK_TTL) return _ensureContribs(_sCache.data);
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
    const contributions = all.slice()
      .map(p => ({ ...p, ga: (p.goals || 0) + (p.assists || 0) }))
      .filter(p => p.ga > 0)
      .sort((a, b) => b.ga - a.ga || b.goals - a.goals)
      .slice(0, 30);
    const label = `${season}/${String(season + 1).slice(-2)}`;
    const data = { scorers, assists, contributions, season: label, updated: now };
    if (all.length) { _sCache = { ts: now, data }; _cachePut('stats', _sCache); _mark('stats', 'ok', all.length); }
    else _mark('stats', 'empty', 0);
    if (all.length) return data;
    // Transfermarkt no respondió (IP bloqueada en prod): construimos el Pichichi
    // desde ESPN, que sí funciona y se actualiza solo según se juegan partidos.
    const fromEspn = await _statsFromEspn(now);
    if (fromEspn) { _sCache = { ts: now, data: fromEspn }; _cachePut('stats', _sCache); _mark('stats', 'ok', fromEspn.scorers.length); return fromEspn; }
    return data;
  } catch (e) {
    _mark('stats', 'fail', 0, e.message);
    const fromEspn = await _statsFromEspn(Date.now()).catch(() => null);
    if (fromEspn) { _sCache = { ts: Date.now(), data: fromEspn }; return fromEspn; }
    return _ensureContribs(_sCache.data) || { scorers: [], assists: [], contributions: [], season: '', updated: 0 };
  }
}

// Pichichi global desde ESPN (respaldo cuando Transfermarkt está bloqueado).
// Fusiona los goleadores de las 5 grandes ligas en una sola tabla de goles.
// ESPN no da asistencias fiables, así que ese ranking queda vacío (secundario).
async function _statsFromEspn(now) {
  const byCode = await espn.getEspnScorers();       // { ES1:[{player,club,badge,goals,pens}], … }
  const merged = [];
  for (const code of Object.keys(byCode || {})) {
    for (const s of byCode[code]) {
      merged.push({ player: s.player, club: { name: s.club, badge: s.badge }, goals: s.goals, assists: 0 });
    }
  }
  if (!merged.length) return null;
  merged.sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player));
  const scorers = merged.slice(0, 30);
  const contributions = scorers.map(p => ({ ...p, ga: p.goals }));
  const y = _currentSaison();
  return { scorers, assists: [], contributions, season: `${y}/${String(y + 1).slice(-2)}`, updated: now, source: 'espn' };
}

// ── Rumores de fichajes (con probabilidad de traspaso) ──
// Transfermarkt publica la "probabilidad de cambio" votada por usuarios en
// /geruechte/aktuellegeruechte/statistik. Cada fila: jugador, club actual →
// club interesado, edad, nacionalidad, fecha y % de probabilidad.
let _rCache = { ts: 0, data: null };
const RUMORS_URL = 'https://www.transfermarkt.es/geruechte/aktuellegeruechte/statistik';
const RUMORS_TTL = 30 * 60 * 1000; // 30 min
const _RUMORS_SNAP_FILE = path.join(_DB_DIR, 'rumors_snapshot.json');

// Lee el snapshot de rumores commiteado (para servidores con la IP bloqueada por
// TM). Devuelve el payload con `source:'snapshot'`, o null si no existe.
function _readRumorsSnapshot() {
  try {
    const s = JSON.parse(fs.readFileSync(_RUMORS_SNAP_FILE, 'utf8'));
    if (s && Array.isArray(s.list) && s.list.length) {
      return { list: s.list, updated: s.updated || 0, source: 'snapshot' };
    }
  } catch (_) { /* no existe aún */ }
  return null;
}

// Persiste el snapshot de rumores (nunca sobrescribe con vacío).
function _writeRumorsSnapshot(data) {
  if (!data || !data.list || !data.list.length) return;
  try {
    fs.mkdirSync(_DB_DIR, { recursive: true });
    fs.writeFileSync(_RUMORS_SNAP_FILE, JSON.stringify({ list: data.list, updated: data.updated || Date.now() }), 'utf8');
  } catch (_) { /* disco no disponible: no romper */ }
}

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
  if (!_rCache.data) { const d = _cacheGet('rumors'); if (d) { _rCache = d; _seed('rumors', d); } }
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
    if (list.length) {
      _rCache = { ts: now, data }; _cachePut('rumors', _rCache); _mark('rumors', 'ok', list.length);
      try { _writeRumorsSnapshot(data); } catch (_) {} // mantener snapshot fresco donde el scrape funciona
      return data;
    }
    // Scrape vacío (IP bloqueada por TM o cambió el HTML): servir el snapshot
    // commiteado si existe, en vez de dejar la pestaña de rumores vacía.
    _mark('rumors', 'empty', 0); console.warn('[news] getRumors: 0 rumores parseados (¿cambió el HTML de Transfermarkt?)');
    const snap = _readRumorsSnapshot();
    if (snap) { _rCache = { ts: now, data: snap }; return snap; }
    return data;
  } catch (e) {
    _mark('rumors', 'fail', 0, e.message);
    console.warn('[news] getRumors falló:', e.message);
    if (_rCache.data) return _rCache.data;
    const snap = _readRumorsSnapshot();
    if (snap) { _rCache = { ts: now, data: snap }; return snap; }
    return { list: [], updated: 0 };
  }
}

// Genera y persiste el snapshot de rumores desde una IP que SÍ puede scrapear
// Transfermarkt. Se commitea y despliega para que prod (IP bloqueada) lo sirva.
// Lanza si el scrape viene vacío para no sobrescribir un snapshot bueno.
async function snapshotRumors() {
  const r = await fetch(RUMORS_URL, { timeout: FETCH_TIMEOUT, headers: _TM_HEADERS });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const $ = cheerio.load(await r.text());
  const trs = $('table.items').first().children('tbody').children('tr').toArray();
  const list = [];
  for (const el of trs) { const it = _parseRumorRow($, el); if (it) list.push(it); }
  list.sort((a, b) => (b.prob == null ? -1 : b.prob) - (a.prob == null ? -1 : a.prob));
  if (!list.length) throw new Error('scrape de rumores vacío (¿IP bloqueada por Transfermarkt?)');
  const data = { list: list.slice(0, 30), updated: Date.now() };
  _writeRumorsSnapshot(data);
  return data;
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
  const raw = _readJson('legends.json', { scorers: [], assists: [], note: '' });
  return { scorers: raw.scorers || [], assists: raw.assists || [], note: raw.note || '', updated: raw.updated || 0 };
}

// ════════════════════════════════════════════════════════════════════
//  GUÍA DE TV — partidos de fútbol de HOY con hora, competición y canal
//  Fuente: marca.com/programacion-tv.html (SSR, sin JS). La parrilla trae
//  VARIOS días agrupados en <li class="content-item"> dentro de .daylist;
//  cada uno con su fecha (.title-section-widget) y sus <li class="dailyevent">
//  (.dailyhour, .dailycompetition, .dailyteams, .dailychannel). Filtramos
//  solo fútbol (icon-futbol) y quedamos SOLO con el día de hoy.
//  OJO: la página está en iso-8859-15, no UTF-8 → hay que decodificar el
//  buffer como latin1 o las tildes salen rotas ("Shangh�i").
//  Son datos FACTUALES (hora/canal), cacheados 3 h y citando la fuente;
//  los canales son de la parrilla ESPAÑOLA (los derechos varían por país).
// ════════════════════════════════════════════════════════════════════
let _tvCache = { ts: 0, data: null };
const TV_URL = 'https://www.marca.com/programacion-tv.html';
const TV_TTL = 3 * 60 * 60 * 1000; // 3 h

const _TV_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Competiciones de primer nivel: se marcan como destacadas (orden y estilo).
const _TV_BIG_RE = /\b(LALIGA|LA LIGA|PRIMERA|CHAMPIONS|LIGA DE CAMPEONES|EUROPA LEAGUE|CONFERENCE|PREMIER|SERIE A|BUNDESLIGA|LIGUE 1|COPA DEL REY|SUPERCOPA|MUNDIAL|EUROCOPA|NATIONS LEAGUE|CLASIFICACI)/i;

const _MESES_TV = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

// Parsea "Viernes31 de Julio de 2026" → Date (medianoche local) o null.
function _parseTvDate(txt) {
  const m = (txt || '').match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const mon = _MESES_TV[m[2].toLowerCase()];
  if (mon == null) return null;
  return new Date(parseInt(m[3], 10), mon, parseInt(m[1], 10));
}

async function getTvGuide() {
  const now = Date.now();
  if (!_tvCache.data) { const d = _cacheGet('tvguide'); if (d) { _tvCache = d; _seed('tvguide', d); } }
  // Servir de caché solo si es fresca Y del día de hoy (la parrilla cambia a diario).
  if (_tvCache.data && (now - _tvCache.ts) < TV_TTL &&
      new Date(_tvCache.ts).toDateString() === new Date(now).toDateString()) {
    return _tvCache.data;
  }
  try {
    const r = await fetch(TV_URL, { timeout: FETCH_TIMEOUT, headers: _TV_HEADERS });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    // La página es iso-8859-15: decodificar el buffer como latin1 (compatible
    // para las tildes españolas); .text() asumiría UTF-8 y rompería los acentos.
    // node-fetch v2 expone .buffer(); el fetch global de Node solo .arrayBuffer().
    const buf = typeof r.buffer === 'function'
      ? await r.buffer()
      : Buffer.from(await r.arrayBuffer());
    const html = buf.toString('latin1');
    const $ = cheerio.load(html);

    const parseEvents = ($scope) => {
      const evs = [];
      $scope.find('li.dailyevent').each((_, el) => {
        const $el = $(el);
        const isFootball = $el.find('.dailytime i').is('.icon-futbol') ||
                           /f[uú]tbol/i.test($el.find('.dailyday').text());
        if (!isFootball) return;
        const time    = $el.find('.dailyhour').text().replace(/\s+/g, ' ').trim();
        const comp    = $el.find('.dailycompetition').text().replace(/\s+/g, ' ').trim();
        const teams   = $el.find('.dailyteams').text().replace(/\s+/g, ' ').trim();
        const channel = $el.find('.dailychannel').text().replace(/\s+/g, ' ').trim();
        if (!teams) return;
        evs.push({ time, competition: comp, teams, channel, big: _TV_BIG_RE.test(comp) });
      });
      return evs;
    };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const DAY_MS = 86400000;
    const _DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const _MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const dayLabel = (d) => {
      const diff = Math.round((d.getTime() - today.getTime()) / DAY_MS);
      if (diff === 0) return 'Hoy';
      if (diff === 1) return 'Mañana';
      return _DIAS[d.getDay()];
    };

    // Cada día es un <li class="content-item"> con su fecha. Agrupamos por día
    // (desde hoy en adelante, hasta 3 días) para no mezclar jornadas.
    const days = [];
    $('.daylist > li.content-item').each((_, el) => {
      const $el = $(el);
      const d = _parseTvDate($el.find('.title-section-widget').first().text());
      if (!d || d.getTime() < today.getTime() || days.length >= 3) return;
      const evs = parseEvents($el);
      if (!evs.length) return;
      evs.sort((a, b) => (b.big - a.big) || a.time.localeCompare(b.time));
      days.push({
        label: dayLabel(d),
        dateStr: `${d.getDate()} ${_MESES_ABR[d.getMonth()]}`,
        events: evs.slice(0, 20),
      });
    });
    // Fallback: sin agrupación por fecha reconocible, tomar el primer grupo o
    // toda la página como "Hoy" (Marca lista siempre el día en curso primero).
    if (!days.length) {
      const first = $('.daylist > li.content-item').first();
      const evs = first.length ? parseEvents(first) : parseEvents($('body'));
      evs.sort((a, b) => (b.big - a.big) || a.time.localeCompare(b.time));
      if (evs.length) days.push({ label: 'Hoy', dateStr: '', events: evs.slice(0, 20) });
    }

    const total = days.reduce((s, d) => s + d.events.length, 0);
    const data = { days, updated: now };
    if (total) { _tvCache = { ts: now, data }; _cachePut('tvguide', _tvCache); _mark('tvguide', 'ok', total); }
    else { _mark('tvguide', 'empty', 0); console.warn('[news] getTvGuide: 0 partidos parseados (¿cambió el HTML de Marca?)'); }
    return data;
  } catch (e) {
    _mark('tvguide', 'fail', 0, e.message);
    console.warn('[news] getTvGuide falló:', e.message);
    return _tvCache.data || { days: [], updated: 0 };
  }
}

module.exports = {
  getNews, getTransfers, snapshotTransfers, getValues, getStats, getRumors, snapshotRumors,
  getAgenda, getSalaries, getLegends, getStatus, getTvGuide,
  FEEDS, IMG_HOSTS,
};


