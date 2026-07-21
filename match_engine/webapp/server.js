/**
 * Football Match Simulator — Express Backend
 * ---------------------------------------------
 * Start:  node server.js
 * API:    POST /simulate
 */

const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const compress   = require('compression');
const nodemailer = require('nodemailer');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const slowDown                         = require('express-slow-down');
const { simulateMatch, buildLineupFromCache, deriveRatings } = require('./engine');
const { describeTimeline }                      = require('./narrator');
const { lookupTeam, fetchTeamBadge } = require('./lookup');
const { SQUADS }        = require('./squads');
const { REFEREES }      = require('./referee_logic');
const { getNews, getTransfers, IMG_HOSTS } = require('./news');
const { getStandings } = require('./standings');

const app    = express();
app.set('trust proxy', 1); // Correct req.ip behind nginx/Cloudflare
app.disable('x-powered-by');  // Don't expose server fingerprint
const PORT = process.env.PORT || 3000;

// -- Squad JSON async cache ------------------------------------------------
// LRU-style Map: evicts oldest entry when size exceeds MAX.
// Avoids blocking the event loop with fs.readFileSync on every SSR request.
const _SQUAD_CACHE_MAX = 300; // ~300 squads — ~8 KB avg = ~2.4 MB RAM
const _squadCache = new Map(); // slug ? parsed JSON
async function _loadSquad(slug) {
  if (_squadCache.has(slug)) return _squadCache.get(slug);
  const raw = await fs.promises.readFile(
    path.join(__dirname, 'squads', `${slug}.json`), 'utf8'
  );
  const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (_squadCache.size >= _SQUAD_CACHE_MAX) {
    // Evict oldest inserted entry (Map preserves insertion order)
    _squadCache.delete(_squadCache.keys().next().value);
  }
  _squadCache.set(slug, data);
  return data;
}

// Module-level rosterFull — used by all 3 matchup SSR routes and equipo/team.
// Returns { players, ratings, formation, avgRating, top3 } for a squad+era.
async function _rosterFull(slug, era) {
  try {
    const lu = await lookupTeam(slug, era);
    const d = await _loadSquad(slug);
    const seasons = Object.keys(d.seasons || {}).sort((a, b) => Number(b) - Number(a));
    const key = era && d.seasons[era] ? era : seasons[0];
    const season = d.seasons[key] || {};
    const ratings = season.ratings || {};
    const formation = lu.found ? (lu.formation || season.formation || '-') : (season.formation || '-');
    const allPlayers = lu.found ? (lu.players || []) : (season.players || []);

    // Build a proper starting XI by formation: parse "4-3-3" -> [4,3,3]
    const GK_POS  = new Set(['GK']);
    const DEF_POS = new Set(['CB','RB','LB','RWB','LWB']);
    const MID_POS = new Set(['DM','CM','RM','LM','AM']);
    const FWD_POS = new Set(['RW','LW','ST','CF','SS','AM']);
    const byRating = (a, b) => (b.rating || 0) - (a.rating || 0);
    const pick = (pool, n) => [...pool].sort(byRating).slice(0, n);

    const fmParts = formation.match(/^(\d+)-(\d+)-(\d+)$/);
    const nDef = fmParts ? parseInt(fmParts[1]) : 4;
    const nMid = fmParts ? parseInt(fmParts[2]) : 3;
    const nFwd = fmParts ? parseInt(fmParts[3]) : 3;

    const gks  = allPlayers.filter(p => GK_POS.has(p.position));
    const defs = allPlayers.filter(p => DEF_POS.has(p.position));
    const mids = allPlayers.filter(p => MID_POS.has(p.position) && !GK_POS.has(p.position) && !FWD_POS.has(p.position));
    const fwds = allPlayers.filter(p => FWD_POS.has(p.position) && !GK_POS.has(p.position) && !DEF_POS.has(p.position));

    // Position-aware defender selection: avoid duplicate LBs/RBs
    let defXI;
    if (nDef === 4) {
      const cbs  = defs.filter(p => p.position === 'CB');
      const rbs  = defs.filter(p => p.position === 'RB' || p.position === 'RWB');
      const lbs  = defs.filter(p => p.position === 'LB' || p.position === 'LWB');
      const defSlots = [...pick(cbs, 2), ...pick(rbs, 1), ...pick(lbs, 1)];
      // Fallback: if not enough positional matches, fill from remaining defs
      if (defSlots.length < 4) {
        const used = new Set(defSlots.map(p => p.name));
        defXI = [...defSlots, ...defs.filter(p => !used.has(p.name)).sort(byRating)].slice(0, 4);
      } else { defXI = defSlots; }
    } else {
      defXI = pick(defs, nDef);
    }

    // Position-aware forward selection for 4-3-3 (RW×1, ST×1, LW×1)
    let fwdXI;
    if (nFwd === 3) {
      const rws = fwds.filter(p => p.position === 'RW');
      const lws = fwds.filter(p => p.position === 'LW');
      const sts = fwds.filter(p => ['ST','CF'].includes(p.position));
      const fwdSlots = [...pick(rws, 1), ...pick(sts, 1), ...pick(lws, 1)];
      if (fwdSlots.length < 3) {
        const used = new Set(fwdSlots.map(p => p.name));
        fwdXI = [...fwdSlots, ...fwds.filter(p => !used.has(p.name)).sort(byRating)].slice(0, 3);
      } else { fwdXI = fwdSlots; }
    } else {
      fwdXI = pick(fwds, nFwd);
    }

    // Position-aware mid selection: 1 DM + (nMid-1) non-DM mids
    let midXI;
    const dm_pool   = mids.filter(p => p.position === 'DM');
    const non_dm    = mids.filter(p => p.position !== 'DM');
    if (dm_pool.length > 0 && non_dm.length >= nMid - 1) {
      const dmSlot = pick(dm_pool, 1);
      const cmSlots = pick(non_dm, nMid - 1);
      midXI = [...dmSlot, ...cmSlots];
      if (midXI.length < nMid) {
        const used = new Set(midXI.map(p => p.name));
        midXI = [...midXI, ...mids.filter(p => !used.has(p.name)).sort(byRating)].slice(0, nMid);
      }
    } else {
      midXI = pick(mids, nMid);
    }

    let xi = [
      ...pick(gks, 1),
      ...defXI,
      ...midXI,
      ...fwdXI,
    ];
    // Fallback: if not enough players per position, fill from remaining
    if (xi.length < 11) {
      const used = new Set(xi.map(p => p.name));
      const rest = allPlayers.filter(p => !used.has(p.name)).sort(byRating);
      xi = [...xi, ...rest].slice(0, 11);
    }

    const avgRating = xi.length
      ? (xi.reduce((s, p) => s + (p.rating || 0), 0) / xi.length).toFixed(1)
      : null;
    const top3 = [...xi].sort(byRating).slice(0, 3);
    return { players: xi, ratings, formation, avgRating, top3 };
  } catch (_) {
    return { players: [], ratings: {}, formation: '', avgRating: null, top3: [] };
  }
}

// Auto-create logs/ dir (used by PM2 ecosystem config)
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Pre-build autocomplete list from local squad DB (capitalised, sorted)
const SQUAD_SUGGESTIONS = [...new Set(
  Object.keys(SQUADS).map(k => k.replace(/\b\w/g, c => c.toUpperCase()))
)].sort();

// Badge map: lowercased name ? local path (built from squads/ at startup)
// Falls back to placeholder when nothing is found.
const BADGE_PLACEHOLDER = '/img/badges/_placeholder.svg';
const _squadFiles = fs.readdirSync(path.join(__dirname, 'squads'))
  .filter(f => f.endsWith('.json') && !f.startsWith('.'));
const _badgeMap = new Map();  // name.lc ? localPath
const _allTeams = [];         // { name, badge, slug } — full list for /badges
for (const file of _squadFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', file), 'utf8'));
    const name  = d.name || file.replace('.json', '');
    const badge = d.badgeLocalPath || BADGE_PLACEHOLDER;
    _badgeMap.set(name.toLowerCase(), badge);
    _allTeams.push({ name, badge, slug: d.slug || file.replace('.json', '') });
  } catch(_) {}
}
_allTeams.sort((a, b) => a.name.localeCompare(b.name));

// -- League/group mapping: slug ? display group ---------------
// Order determines display order in the UI.
const _GROUP_ORDER = [
  '⭐ Fantasy XI',
  '🌐 Continentes Históricos',
  '🌍 Selecciones',
  '🇪🇸 La Liga', '🇪🇸 La Liga 2',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  '🇩🇪 Bundesliga', '🇩🇪 2. Bundesliga',
  '🇮🇹 Serie A', '🇮🇹 Serie B',
  '🇫🇷 Ligue 1', '🇫🇷 Ligue 2',
  '🇳🇱 Eredivisie', '🇵🇹 Liga Portugal',
  '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia',
  '🇸🇦 Saudi Pro League', '🇺🇸 MLS',
  '🇧🇷 Brasileirão', '🌎 Argentina Primera', '🌎 América del Sur', '🌍 Otros',
];
// group, nameEn, nameEs: stored in each squad JSON, with squads-meta.json as overlay.
// squads-meta.json maps slug ? { group, nameEn, nameEs } and overrides per-file values.
// This allows correct metadata even for squad files that are gitignored (seeded on server).
const _SQUADS_META = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'squads-meta.json'), 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return {}; }
})();


// Catalog: name + slug + available seasons (only teams with =1 season)
// Built once at startup from squads/ JSON files. Used by the era dropdown in the UI.
const CATALOG = [];
for (const file of _squadFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', file), 'utf8'));
    const seasons = Object.keys(d.seasons || {}).filter(s => {
      if (!/^(19[5-9]\d|20[0-2]\d|all-time)$/.test(s)) return false; // only valid years or 'all-time'
      const p = d.seasons[s];
      return p && Array.isArray(p.players) && p.players.length >= 8;
    }).sort((a, b) => Number(b) - Number(a)); // newest first
    if (seasons.length === 0) continue;
    const slug = d.slug || file.replace('.json', '');
    const _meta = _SQUADS_META[slug] || {};
    const group = _meta.group || d.group || '?? Otros';
    const nameEn = _meta.nameEn || d.nameEn || d.name || slug;
    const nameEs = _meta.nameEs || d.nameEs || d.nameEn || d.name || slug;
    const badge = _meta.badgeLocalPath || d.badgeLocalPath || BADGE_PLACEHOLDER;
    // Compute team OVR: average of deriveRatings() using good scraped data when available,
    // otherwise pure name-based heuristic. Stored so the tournament can bias match xG.
    const _latestSn      = seasons[0];
    const _latestSnData  = d.seasons[_latestSn];
    const _snRaw         = _latestSnData?.ratings;
    const _snAvg         = _snRaw ? (_snRaw.attack + _snRaw.midfield + _snRaw.defense + (_snRaw.goalkeeping || 70)) / 4 : 0;
    const _scrRatings    = (_snRaw && _snAvg >= 70) ? _snRaw : null;
    const _dr            = deriveRatings(nameEs, _latestSn, _scrRatings);
    const ovr            = Math.round((_dr.attack + _dr.midfield + _dr.defense + _dr.goalkeeping) / 4);
    CATALOG.push({ slug, nameEn, nameEs, name: nameEn, badge, seasons, group, ovr });
  } catch (_) {}
}
// Sort by group order then alphabetically within group
CATALOG.sort((a, b) => {
  const gi = _GROUP_ORDER.indexOf(a.group) - _GROUP_ORDER.indexOf(b.group);
  if (gi !== 0) return gi;
  return a.nameEn.localeCompare(b.nameEn, 'es', { sensitivity: 'base' });
});

function _badgeFor(teamName) {
  if (!teamName) return BADGE_PLACEHOLDER;
  return _badgeMap.get(teamName.toLowerCase())
      || _badgeMap.get(teamName.toLowerCase().replace(/^(fc|ac|as|rc|sc|cd|ud|cf|ss|sk)\s+/i, ''))
      || BADGE_PLACEHOLDER;
}

// Resolve a display name / slug / localized label ? canonical squad slug
// Used by /simulate so picker-submitted slugs and typed names both work.
const _catalogNameMap = (() => {
  const m = new Map();
  for (const e of CATALOG) {
    m.set(e.slug.toLowerCase(), e.slug);
    if (e.nameEn) m.set(e.nameEn.toLowerCase(), e.slug);
    if (e.nameEs) m.set(e.nameEs.toLowerCase(), e.slug);
    // Also map slug-with-spaces so "river plate" ? "river-plate", etc.
    const slugWords = e.slug.toLowerCase().replace(/-/g, ' ');
    if (!m.has(slugWords)) m.set(slugWords, e.slug);
  }
  return m;
})();
function _resolveTeamSlug(input) {
  return _catalogNameMap.get(input.trim().toLowerCase()) || input.trim();
}

// -- Resolver robusto: nombre de equipo (Transfermarkt) -> slug del catalogo.
// Usado por el boton "Simular" del calendario. Devuelve null si no hay match seguro
// (preferimos NO poner boton antes que enlazar a un equipo equivocado).
const _FX_ZW = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff\u00ad]/g;
const _fxNorm = (s) => s.toLowerCase().replace(_FX_ZW, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' ')
  .replace(/\b(fc|cf|cd|ud|rc|rcd|sc|sd|ss|ssc|ac|afc|as|sk|club|deportivo|balompie|calcio|futbol|football|de|do|the|1846|1848|1860|1889|1893|1899|1900|1904|1905|1907|1909|1910|05|04|07|29|96)\b/g, ' ')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// Alias curados para colisiones europeas/sudamericanas y variantes de idioma.
const _FX_ALIASES = {
  'fc barcelona': 'fc-barcelona', 'racing club de estrasburgo': 'rc-strasbourg', 'estrasburgo': 'rc-strasbourg',
  'genova': 'cfc-genua', 'genoa': 'cfc-genua', 'rc celta': 'celta-vigo', 'celta': 'celta-vigo',
  'augsburgo': 'fc-augsburg', 'niza': 'ogc-nice', 'ogc niza': 'ogc-nice', 'francfort': 'eintracht-frankfurt',
  'eintracht francfort': 'eintracht-frankfurt', 'brestois': 'stade-brest-29', 'stade brestois': 'stade-brest-29',
  'coruna': 'rc-deportivo', 'a coruna': 'rc-deportivo', 'deportivo a coruna': 'rc-deportivo',
  'atalanta de bergamo': 'atalanta-bc', 'bolonia': 'bologna', 'fc colonia': '1-fc-koln', 'colonia': '1-fc-koln',
  'sc friburgo': 'freiburg', 'friburgo': 'freiburg',
  'estac troyes': 'es-troyes-ac', 'troyes': 'es-troyes-ac', 'le mans fc': 'le-mans-fc', 'le mans': 'le-mans-fc',
  'paris fc': 'paris-fc',
};
const _fxSlugSet = new Set(CATALOG.map(c => c.slug));
const _fxNormMap = (() => {
  const m = new Map();
  for (const e of CATALOG) for (const k of [e.slug.replace(/-/g, ' '), e.nameEn, e.nameEs]) {
    const n = _fxNorm(k); if (n && !m.has(n)) m.set(n, e.slug);
  }
  return m;
})();
function _resolveFixtureSlug(name) {
  if (!name) return null;
  const raw = name.toLowerCase().replace(_FX_ZW, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (_FX_ALIASES[raw] && _fxSlugSet.has(_FX_ALIASES[raw])) return _FX_ALIASES[raw];
  const n = _fxNorm(name);
  if (_FX_ALIASES[n] && _fxSlugSet.has(_FX_ALIASES[n])) return _FX_ALIASES[n];
  return _fxNormMap.get(n) || null;
}

// -- Middleware --------------------------------
// -- www ? non-www redirect (301) -----------------------------------------
// Prevents duplicate content: www.golazox.com and golazox.com must not both
// serve the same pages or Google will reject indexing requests.
app.use((req, res, next) => {
  const host = req.headers.host || '-';
  if (host.startsWith('www.')) {
    return res.redirect(301, `https://${host.slice(4)}${req.url}`);
  }
  next();
});

// Gzip/Brotli compression for all text responses (HTML, CSS, JS, JSON).
// Reduces bandwidth ~70-80% — essential for mobile performance and hosting costs.
app.use(compress({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '32kb' }));

// -- Per-request timeout: 25 s hard cap -----------------------------------
// Prevents a hung /simulate (e.g. external API not responding) from holding
// a Node.js worker open indefinitely and eventually exhausting memory.
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timed out. Please try again.' });
    }
  }, 25_000);
  res.on('finish', () => clearTimeout(timer));
  res.on('close',  () => clearTimeout(timer));
  next();
});

// Security headers — registered FIRST so they apply to ALL responses,
// including static files (index.html, CSS, JS, images).
// upgrade-insecure-requests is only valid (and needed) when serving over HTTPS.
// On HTTP (local dev via LAN IP), it causes browsers to upgrade same-origin requests
// to HTTPS (which fails), making the page completely unstyled on mobile devices.
const _siteIsHttps = (process.env.SITE_URL || '-').startsWith('https://');

app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-DNS-Prefetch-Control', 'off');  // Prevent DNS prefetch leaking browsed URLs
  res.set('Content-Security-Policy',
    "default-src 'self'; " +
    "img-src 'self' data: blob:; " +
    "script-src 'self' https://www.googletagmanager.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; " +
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; " +
    "worker-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'" +
    (_siteIsHttps ? "; upgrade-insecure-requests" : ""));
  res.set('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=()');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.set('Cross-Origin-Embedder-Policy', 'credentialless');
  // HSTS: only sent over HTTPS; harmless on HTTP (ignored by browsers then)
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

// -- Dynamic index.html (injects og:url + canonical from SITE_URL env var) --
// Must come before express.static so the route wins over the static file handler.
// -- sitemap_index.xml alias ? prevents GSC 404 if that URL was submitted --
app.get('/sitemap_index.xml', (_req, res) => res.redirect(301, '/sitemap.xml'));

// ── WC2026 Final shortlink ─────────────────────────────────────────────────
app.get('/final',    (_req, res) => res.redirect(302, '/partido/spanien:2026-vs-argentinien:2026'));
app.get('/final-en', (_req, res) => res.redirect(302, '/match/spanien:2026-vs-argentinien:2026'));
app.get('/final-pt', (_req, res) => res.redirect(302, '/partida/spanien:2026-vs-argentinien:2026'));

// ── /final-card  : screenshot-ready visual card for TikTok/social ──────────
app.get('/final-card', async (_req, res) => {
  try {
    const siteUrl = (process.env.SITE_URL || 'https://golazox.com').replace(/\/$/, '');
    const [luA, luB] = await Promise.all([lookupTeam('spanien','2026'), lookupTeam('argentinien','2026')]);
    const entryA = CATALOG.find(c => c.slug === 'spanien');
    const entryB = CATALOG.find(c => c.slug === 'argentinien');
    const nameA  = (entryA?.nameEs || 'España');
    const nameB  = (entryB?.nameEs || 'Argentina');
    const badgeA = entryA?.badge && entryA.badge !== BADGE_PLACEHOLDER ? entryA.badge : '';
    const badgeB = entryB?.badge && entryB.badge !== BADGE_PLACEHOLDER ? entryB.badge : '';

    // Stable deterministic simulation (same result every time)
    const salt = 'spanien2026argentinien2026final'.split('').reduce((h,c) => (Math.imul(31,h)+c.charCodeAt(0))|0, 0) & 0x7fffffff;
    const sim  = simulateMatch({
      teamA: nameA, teamB: nameB, eraA: '2026', eraB: '2026',
      formationA: luA.formation||'4-3-3', formationB: luB.formation||'4-5-1',
      cachedLineupA: luA, cachedLineupB: luB,
      matchMode: '11v11', matchSalt: salt, refereeId: null, isFinal: true, weatherId: null,
    });
    const scoreA = sim.finalScore?.teamA ?? 1;
    const scoreB = sim.finalScore?.teamB ?? 0;
    const mom    = sim.stats?.manOfMatch;
    const pA     = sim.probabilities?.teamA_win ?? 0;
    const pB     = sim.probabilities?.teamB_win ?? 0;
    const pD     = sim.probabilities?.draw       ?? 0;

    // Penalty shootout if draw (deterministic with offset salt)
    let penWinner = null, penScoreA = null, penScoreB = null;
    if (scoreA === scoreB) {
      const penSim = simulateMatch({
        teamA: nameA, teamB: nameB, eraA: '2026', eraB: '2026',
        formationA: luA.formation||'4-3-3', formationB: luB.formation||'4-5-1',
        cachedLineupA: luA, cachedLineupB: luB,
        matchMode: 'penalties', matchSalt: salt + 7919,
        refereeId: null, isFinal: true, weatherId: null,
      });
      const pen = penSim.finalScore?.penalties;
      if (pen) { penWinner = pen.winner === 'A' ? nameA : nameB; penScoreA = pen.scoreA; penScoreB = pen.scoreB; }
    }

    const winner = scoreA > scoreB ? nameA : scoreB > scoreA ? nameB : (penWinner || 'Empate');
    const winnerColor = scoreA > scoreB ? '#c60b1e' : scoreB > scoreA ? '#74acdf' : '#f8c300';

    res.set('Cache-Control', 'public, max-age=900').type('text/html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="robots" content="noindex"/>
  <title>Final Copa del Mundo 2026 · GolazoX</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:100%;min-height:100vh;background:#060a14;
      font-family:'Segoe UI',system-ui,sans-serif;color:#fff;
      display:flex;align-items:center;justify-content:center}
    .card{
      width:min(420px,98vw);
      background:linear-gradient(160deg,#0d1528 0%,#060a14 60%,#0d0820 100%);
      border:1px solid rgba(255,255,255,.08);
      border-radius:1.5rem;
      padding:2.2rem 2rem 2.4rem;
      box-shadow:0 0 60px rgba(123,47,247,.25),0 0 120px rgba(0,212,255,.08);
      position:relative;overflow:hidden;
    }
    .card::before{
      content:'';position:absolute;inset:0;
      background:radial-gradient(ellipse 70% 40% at 50% 0%,rgba(123,47,247,.18),transparent);
      pointer-events:none;
    }
    .badge-top{
      display:flex;align-items:center;justify-content:center;gap:.5rem;
      margin-bottom:1.6rem;
    }
    .badge-top span{
      font-size:.72rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase;
      color:#f8c300;background:rgba(248,195,0,.12);
      border:1px solid rgba(248,195,0,.3);
      padding:.3rem .9rem;border-radius:999px;
    }
    .trophy{font-size:1.1rem}
    .teams{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:1.6rem}
    .team{display:flex;flex-direction:column;align-items:center;gap:.7rem;flex:1}
    .team img{width:80px;height:80px;object-fit:contain;display:block;margin:0 auto;filter:drop-shadow(0 4px 16px rgba(0,0,0,.6))}
    .team-name{font-size:1rem;font-weight:800;text-align:center;color:#e2e8f0;line-height:1.2}
    .score-wrap{display:flex;flex-direction:column;align-items:center;gap:.35rem}
    .score{display:flex;align-items:center;gap:.15rem}
    .score-num{font-size:5rem;font-weight:900;line-height:1;letter-spacing:-.04em;
      background:linear-gradient(135deg,#fff 40%,rgba(255,255,255,.6));
      -webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .score-sep{font-size:2.5rem;font-weight:900;color:#475569;margin:0 .35rem;
      -webkit-text-fill-color:#475569;line-height:1}
    .sim-label{font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
      color:#475569;margin-top:.15rem}
    .winner-bar{
      text-align:center;padding:.9rem 1.2rem;border-radius:.875rem;margin-bottom:1.4rem;
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
    }
    .winner-label{font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:.35rem}
    .winner-name{font-size:1.35rem;font-weight:900;color:${winnerColor};line-height:1.3}
    .mvp{
      background:linear-gradient(135deg,rgba(248,195,0,.08),rgba(248,195,0,.03));
      border:1px solid rgba(248,195,0,.2);border-radius:.875rem;
      padding:1rem 1.3rem;margin-bottom:1.4rem;
      display:flex;align-items:center;gap:.9rem;
    }
    .mvp-icon{font-size:1.8rem}
    .mvp-info{flex:1}
    .mvp-label{font-size:.65rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#f8c300;margin-bottom:.2rem}
    .mvp-name{font-size:1.15rem;font-weight:900;color:#fff;line-height:1.2}
    .mvp-team{font-size:.78rem;color:#94a3b8;margin-top:.2rem}
    .probs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:1.6rem}
    .prob{text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:.875rem;padding:.8rem .4rem}
    .prob-val{font-size:1.35rem;font-weight:900;color:#38bdf8}
    .prob-lbl{font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;margin-top:.2rem}
    .probs-title{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#475569;text-align:center;margin-bottom:.6rem}
    .cta-wrap{text-align:center}
    .cta-btn{display:block;background:linear-gradient(135deg,#7b2ff7,#00d4ff);color:#fff;
      font-size:1.05rem;font-weight:900;text-decoration:none;padding:.95rem 1.5rem;
      border-radius:.875rem;letter-spacing:.03em;transition:opacity .15s;margin-bottom:.55rem}
    .cta-btn:hover{opacity:.88}
    .cta-sub{font-size:.72rem;color:#475569}
    .gx-brand{display:flex;align-items:center;justify-content:center;gap:.4rem;margin-bottom:1.6rem}
    .gx-dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#7b2ff7,#00d4ff)}
    .gx-name{font-size:.75rem;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#475569}
  </style>
</head>
<body>
<div class="card">
  <div class="gx-brand"><div class="gx-dot"></div><span class="gx-name">GolazoX · Monte Carlo Engine</span><div class="gx-dot"></div></div>

  <div class="badge-top">
    <span class="trophy">🏆</span>
    <span>Final Copa del Mundo 2026</span>
    <span class="trophy">🏆</span>
  </div>

  <div class="teams">
    <div class="team">
      ${badgeA ? `<img src="${badgeA}" alt="${nameA}"/>` : '<div style="width:72px;height:72px;background:rgba(255,255,255,.05);border-radius:50%"></div>'}
      <div class="team-name">${nameA}</div>
    </div>
    <div class="score-wrap">
      <div class="score"><span class="score-num">${scoreA}</span><span class="score-sep">-</span><span class="score-num">${scoreB}</span></div>
      <div class="sim-label">simulación · 1.000 partidos</div>
    </div>
    <div class="team">
      ${badgeB ? `<img src="${badgeB}" alt="${nameB}"/>` : '<div style="width:72px;height:72px;background:rgba(255,255,255,.05);border-radius:50%"></div>'}
      <div class="team-name">${nameB}</div>
    </div>
  </div>

  <div class="winner-bar">
    <div class="winner-label">Resultado más probable</div>
        <div class="winner-name">${scoreA === scoreB
          ? penWinner ? `⚽ Empate · ${penWinner} gana en penaltis (${penScoreA}-${penScoreB})` : '⚖️ Empate — Penaltis'
          : `🏆 Gana ${winner}`}</div>
  </div>

  ${mom ? `
  <div class="mvp">
    <div class="mvp-icon">⭐</div>
    <div class="mvp-info">
      <div class="mvp-label">MVP · Mejor jugador</div>
      <div class="mvp-name">${mom.name}</div>
      <div class="mvp-team">${mom.teamName} · ${mom.reason?.type === 'goals' ? `${mom.reason.count} gol${mom.reason.count > 1 ? 'es' : ''}` : 'Mejor del campo'}</div>
    </div>
  </div>` : ''}

  <div class="probs-title">Probabilidades en 1.000 simulaciones</div>
  <div class="probs">
    <div class="prob"><div class="prob-val">${pA}%</div><div class="prob-lbl">Gana ${nameA}</div></div>
    <div class="prob"><div class="prob-val">${pD}%</div><div class="prob-lbl">Empate</div></div>
    <div class="prob"><div class="prob-val">${pB}%</div><div class="prob-lbl">Gana ${nameB}</div></div>
  </div>

  <div class="cta-wrap">
    <a class="cta-btn" href="/partido/spanien:2026-vs-argentinien:2026">⚽ Simula tú mismo en GolazoX</a>
    <div class="cta-sub">golazox.com/final · Gratis · Sin registro</div>
  </div>
</div>
</body>
</html>`);
  } catch(err) {
    console.error('[/final-card]', err.message);
    res.status(500).send('Error');
  }
});

app.get('/', (_req, res) => {
  const cleanUrl = (process.env.SITE_URL || 'https://golazox.com').replace(/[\\"'<>]/g, '').replace(/\/$/, '');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  // Inject og:url only (canonical already in index.html; injecting both caused duplicates)
  const injected = html.replace(
    '<meta property="og:type" content="website" />',
    `<meta property="og:type" content="website" />\n  <meta property="og:url" content="${cleanUrl}/" />`
  );
  res.set('Cache-Control', 'no-cache').type('text/html').send(injected);
});

// -- /partido/:matchup — SSR matchup pages for SEO -----------------
// URL format: /partido/real-madrid:2002-vs-barcelona:2009
// or without era: /partido/real-madrid-vs-barcelona
// Generates a full HTML page with real content (title, description, h1, h2,
// roster snippets, JSON-LD) that Google can index, while the SPA app loads
// underneath so users can actually simulate the match.
app.get('/partido/:matchup', async (req, res) => {
  try {
  const _routeSiteUrl = SITE_URL.replace(/\/$/, '');
  const raw = req.params.matchup || '-';
  // Parse "slugA:eraA-vs-slugB:eraB"  or  "slugA-vs-slugB"
  const vsIdx = raw.indexOf('-vs-');
  if (vsIdx === -1) return res.status(404).send('Not Found');
  const partA = raw.slice(0, vsIdx);   // e.g. "real-madrid:2002" or "real-madrid"
  const partB = raw.slice(vsIdx + 4);  // e.g. "barcelona:2009"
  const [slugA, eraA = ''] = partA.split(':');
  const [slugB, eraB = ''] = partB.split(':');

  const entryA = CATALOG.find(c => c.slug === slugA);
  const entryB = CATALOG.find(c => c.slug === slugB);
  // If either team is unknown, return 404 so Google drops the URL from its crawl queue
  if (!entryA || !entryB) return res.status(404).send('Not Found');

  const nameA = entryA.nameEs || entryA.nameEn;
  const nameB = entryB.nameEs || entryB.nameEn;
  const labelA = eraA ? `${nameA} ${eraA}` : nameA;
  const labelB = eraB ? `${nameB} ${eraB}` : nameB;
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Load rosters in parallel from cache (non-blocking)
  const [dataA, dataB] = await Promise.all([_rosterFull(slugA, eraA), _rosterFull(slugB, eraB)]);
  const playersA = dataA.players;
  const playersB = dataB.players;
  // Also get 3 related matches for internal linking (same team A vs other rivals)
  const relatedMatches = (() => {
    const rivals = ['real-madrid','fc-barcelona','manchester-united','fc-bayern-munchen','ac-mailand','brasil','alemania','argentina'];
    const related = [];
    for (const r of rivals) {
      if (r === slugA || r === slugB) continue;
      const entry = CATALOG.find(c => c.slug === r);
      if (!entry) continue;
      related.push({ slug: r, name: entry.nameEs || entry.nameEn });
      if (related.length >= 3) break;
    }
    return related;
  })();

  const pageTitle   = `${esc(labelA)} vs ${esc(labelB)} · Simula el partido | GolazoX`;
  const pageDesc    = `¿Quién ganaría ${esc(labelA)} contra ${esc(labelB)}? Simúlalo ahora con el motor de Monte Carlo de GolazoX. Estadísticas, alineaciones históricas y resultado en segundos.`;
  const canonUrl    = `${_routeSiteUrl}/partido/${esc(raw)}`;
  const enUrl       = `${_routeSiteUrl}/match/${esc(raw)}`;
  const ptUrl       = `${_routeSiteUrl}/partida/${esc(raw)}`;
  const deepLink    = `${_routeSiteUrl}/?a=${encodeURIComponent(eraA ? `${slugA}:${eraA}` : slugA)}&b=${encodeURIComponent(eraB ? `${slugB}:${eraB}` : slugB)}`;
  const badgeA      = entryA.badge && entryA.badge !== BADGE_PLACEHOLDER ? entryA.badge : '';
  const badgeB      = entryB.badge && entryB.badge !== BADGE_PLACEHOLDER ? entryB.badge : '';

  // Build FAQ items for this specific matchup (AEO / featured snippets)
  const faqItems = [
    {
      q: `¿Quién ganaría entre ${labelA} y ${labelB}?`,
      a: `Según el motor estadístico de GolazoX, que simula miles de partidos usando las alineaciones reales de ${labelA} y ${labelB}, el resultado más probable se puede calcular de forma gratuita en golazox.com. El simulador tiene en cuenta las estadísticas históricas reales de cada jugador y la formación táctica de cada equipo.`,
    },
    {
      q: `¿Cuál es la alineación de ${labelA}?`,
      a: dataA.players.length
        ? `La alineación titular de ${labelA} en GolazoX es: ${dataA.players.map(p => p.name).join(', ')}. Formación: ${dataA.formation || 'variable'}.`
        : `GolazoX dispone de la plantilla histórica completa de ${nameA} con las estadísticas reales de cada jugador.`,
    },
    {
      q: `¿Cuál es la alineación de ${labelB}?`,
      a: dataB.players.length
        ? `La alineación titular de ${labelB} en GolazoX es: ${dataB.players.map(p => p.name).join(', ')}. Formación: ${dataB.formation || 'variable'}.`
        : `GolazoX dispone de la plantilla histórica completa de ${nameB} con las estadísticas reales de cada jugador.`,
    },
    {
      q: `¿Cuál es el mejor jugador de ${labelA}?`,
      a: dataA.top3.length
        ? `Los jugadores mejor valorados de ${labelA} en GolazoX son: ${dataA.top3.map(p => `${p.name} (${p.rating})`).join(', ')}.`
        : `GolazoX incluye las valoraciones individuales de todos los jugadores de ${nameA}.`,
    },
    {
      q: `¿Cómo simular ${labelA} contra ${labelB} gratis?`,
      a: `Entra en golazox.com, selecciona ${nameA} (era ${eraA || 'actual'}) como equipo A y ${nameB} (era ${eraB || 'actual'}) como equipo B, y pulsa Simular. El motor Monte Carlo ejecuta miles de partidos en milisegundos y muestra el resultado más probable. Es completamente gratuito, sin registro.`,
    },
  ];

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'GolazoX', 'item': _routeSiteUrl },
          { '@type': 'ListItem', 'position': 2, 'name': `${labelA} vs ${labelB}` },
        ],
      },
      {
        '@type': 'WebPage',
        'name': `${labelA} vs ${labelB} · Simulación de Fútbol`,
        'description': pageDesc.replace(/&\w+;/g, ' '),
        'url': canonUrl,
        'inLanguage': 'es',
        'about': [
          { '@type': 'SportsTeam', 'name': labelA, 'sport': 'Soccer', ...(badgeA ? { 'logo': badgeA } : {}) },
          { '@type': 'SportsTeam', 'name': labelB, 'sport': 'Soccer', ...(badgeB ? { 'logo': badgeB } : {}) },
        ],
        'publisher': { '@type': 'Organization', 'name': 'GolazoX', 'url': _routeSiteUrl },
      },
      {
        '@type': 'FAQPage',
        'mainEntity': faqItems.map(({ q, a }) => ({
          '@type': 'Question',
          'name': q,
          'acceptedAnswer': { '@type': 'Answer', 'text': a },
        })),
      },
    ],
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDesc}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${canonUrl}"/>
  <link rel="alternate" hreflang="es" href="${canonUrl}"/>
  <link rel="alternate" hreflang="en" href="${enUrl}"/>
  <link rel="alternate" hreflang="pt-BR" href="${ptUrl}"/>
  <link rel="alternate" hreflang="x-default" href="${canonUrl}"/>
  <meta property="og:type" content="article"/>
  <meta property="article:published_time" content="${new Date().toISOString().slice(0,10)}T00:00:00Z"/>
  <meta property="article:section" content="Simulaciones de Fútbol Histórico"/>
  <style>.mp-stat-wrap{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:.4rem;padding:.35rem .6rem;min-height:2.2rem}.mp-stat-bar{position:absolute;top:0;bottom:0;background:rgba(123,47,247,.25);border-radius:.4rem}.mp-stat-a .mp-stat-bar{right:0;left:auto}.mp-stat-b .mp-stat-bar{left:0;right:auto}.mp-stats-hi .mp-stat-bar{background:rgba(0,212,255,.38)}.mp-stat-val{position:relative;z-index:1;font-weight:700}</style>
  <meta property="og:title" content="${pageTitle}"/>
  <meta property="og:description" content="${pageDesc}"/>
  <meta property="og:url" content="${canonUrl}"/>
  <meta property="og:image" content="${_routeSiteUrl}/og-image.png?v=2"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${pageTitle}"/>
  <meta name="twitter:description" content="${pageDesc}"/>
  <script type="application/ld+json">${jsonLd}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2BSP5YDS7N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-2BSP5YDS7N');</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0f1a;color:#e2e8f0;font-family:system-ui,sans-serif;min-height:100vh}
    .mp-wrap{max-width:760px;margin:0 auto;padding:2rem 1.2rem 4rem}
    .mp-backlink{display:inline-flex;align-items:center;gap:.4rem;color:#38bdf8;font-size:.85rem;margin-bottom:1.8rem;text-decoration:none;opacity:.8}
    .mp-backlink:hover{opacity:1;text-decoration:underline}
    .mp-teams{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.6rem}
    .mp-badge{width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;filter:drop-shadow(0 2px 12px rgba(0,0,0,.6))}
    .mp-vs{font-size:1.4rem;font-weight:900;color:#7b2ff7;flex-shrink:0;padding:0 .4rem}
    .mp-team-block{display:flex;flex-direction:column;align-items:center;gap:.35rem;flex:1;min-width:0;text-align:center}
    .mp-team-info{display:flex;flex-direction:column;align-items:center;gap:.2rem}
    .mp-name{font-size:1.2rem;font-weight:700;line-height:1.2;color:#f1f5f9}
    .mp-era{font-size:.8rem;color:#7b2ff7;font-weight:600;background:rgba(123,47,247,.12);padding:.15rem .5rem;border-radius:999px;width:fit-content}
    h1{font-size:1.65rem;font-weight:900;line-height:1.2;margin-bottom:.8rem;color:#f1f5f9}
    .mp-intro{color:#94a3b8;font-size:.97rem;line-height:1.7;margin-bottom:2rem;border-left:3px solid #7b2ff7;padding-left:1rem}
    .mp-rosters{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:2rem}
    .mp-roster-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:.875rem;padding:1.2rem}
    .mp-roster-title{font-size:.75rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7b2ff7;margin-bottom:.8rem}
    .mp-player-row{display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.875rem}
    .mp-player-row:last-child{border-bottom:0}
    .mp-player-name{color:#e2e8f0}
    .mp-player-pos{color:#64748b;font-size:.75rem;font-weight:600;min-width:2.5rem;text-align:right}
    .mp-cta{display:block;background:linear-gradient(135deg,#7b2ff7,#00d4ff);color:#fff;text-align:center;padding:1.1rem 2rem;border-radius:.875rem;font-size:1.1rem;font-weight:800;text-decoration:none;letter-spacing:.04em;margin-bottom:.8rem;transition:opacity .15s}
    .mp-cta:hover{opacity:.9}
    .mp-note{font-size:.8rem;color:#475569;text-align:center;margin-bottom:2.5rem}
    .mp-related{margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.07)}
    .mp-related-title{font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:.8rem}
    .mp-related-links{display:flex;flex-wrap:wrap;gap:.5rem}
    .mp-related-link{color:#38bdf8;font-size:.875rem;text-decoration:none;background:rgba(56,189,248,.07);padding:.3rem .8rem;border-radius:999px;border:1px solid rgba(56,189,248,.15)}
    .mp-related-link:hover{background:rgba(56,189,248,.15)}
    .mp-footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid rgba(255,255,255,.06);font-size:.78rem;color:#334155;text-align:center}
    .mp-footer a{color:#475569;text-decoration:none}
    .mp-footer a:hover{text-decoration:underline}
    .mp-stats-section{margin-bottom:2rem}
    .mp-stats-title{font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:.6rem}
    .mp-stats-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .mp-stats-table caption{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;caption-side:top;text-align:left;padding-bottom:.4rem}
    .mp-stats-table th{color:#94a3b8;font-size:.75rem;font-weight:700;letter-spacing:.06em;padding:.5rem .6rem;text-align:center}
    .mp-stats-table th:nth-child(2){color:#7b2ff7}
    .mp-stats-table td{padding:.4rem .6rem;text-align:center;border-bottom:1px solid rgba(255,255,255,.05);font-weight:700;color:#e2e8f0}
    .mp-stats-table td:nth-child(2){color:#64748b;font-size:.8rem;font-weight:600}
    .mp-stats-hi{color:#7b2ff7}
    @media(max-width:520px){.mp-rosters{grid-template-columns:1fr}.mp-teams{gap:.8rem}.mp-badge{width:52px;height:52px}}
  </style>
</head>
<body>
<main class="mp-wrap">
  <a class="mp-backlink" href="/">← GolazoX · Football Time Machine</a>

  <div class="mp-teams">
    <div class="mp-team-block">
      ${badgeA ? `<img class="mp-badge" src="${badgeA}" alt="${esc(nameA)}" width="72" height="72" loading="eager"/>` : ''}
      <div class="mp-name">${esc(nameA)}</div>
      ${eraA ? `<div class="mp-era">${esc(eraA)}</div>` : ''}
    </div>
    <span class="mp-vs">VS</span>
    <div class="mp-team-block">
      ${badgeB ? `<img class="mp-badge" src="${badgeB}" alt="${esc(nameB)}" width="72" height="72" loading="eager"/>` : ''}
      <div class="mp-name">${esc(nameB)}</div>
      ${eraB ? `<div class="mp-era">${esc(eraB)}</div>` : ''}
    </div>
  </div>

  <h1>¿Quién ganaría ${esc(labelA)} vs ${esc(labelB)}?</h1>

  <a class="mp-cta" href="${deepLink}">⚽ Simular ${esc(labelA)} vs ${esc(labelB)} ahora</a>
  <p class="mp-note">Motor Monte Carlo · +500 plantillas históricas · Resultado en segundos</p>

  ${(dataA.ratings && Object.keys(dataA.ratings).length) || (dataB.ratings && Object.keys(dataB.ratings).length) ? `
  <section class="mp-stats-section" aria-label="Comparación de estadísticas ${esc(labelA)} vs ${esc(labelB)}">
    <h2 class="mp-stats-title">Comparación de estadísticas</h2>
    <table class="mp-stats-table">
      <caption>${esc(labelA)} vs ${esc(labelB)} · estadísticas por categoría</caption>
      <thead><tr><th>${esc(labelA)}</th><th>Categoría</th><th>${esc(labelB)}</th></tr></thead>
      <tbody>
        ${[['attack','Ataque'],['midfield','Mediocampo'],['defense','Defensa'],['goalkeeping','Portería']].map(([k,label]) => {
          const va = dataA.ratings[k] ?? '-';
          const vb = dataB.ratings[k] ?? '-';
          const hiA = typeof va === 'number' && typeof vb === 'number' && va > vb;
          const hiB = typeof va === 'number' && typeof vb === 'number' && vb > va;
          const bw = v => typeof v === 'number' ? Math.round(Math.max(0,Math.min(100,(v-60)/40*100))) : 0;
          const bgA = `background:linear-gradient(to left,rgba(${hiA?'0,212,255,.42':'123,47,247,.28'}) ${bw(va)}%,transparent ${bw(va)}%)`;
          const bgB = `background:linear-gradient(to right,rgba(${hiB?'0,212,255,.42':'123,47,247,.28'}) ${bw(vb)}%,transparent ${bw(vb)}%)`;
          return `<tr><td${hiA?' class="mp-stats-hi"':''} style="${bgA}">${va}</td><td>${label}</td><td${hiB?' class="mp-stats-hi"':''} style="${bgB}">${vb}</td></tr>`;
        }).join('')}
        ${dataA.avgRating || dataB.avgRating ? `<tr>
          <td${dataA.avgRating && dataB.avgRating && Number(dataA.avgRating) > Number(dataB.avgRating) ? ' class="mp-stats-hi"' : ''}>${dataA.avgRating ?? '-'}</td>
          <td>Media overall</td>
          <td${dataA.avgRating && dataB.avgRating && Number(dataB.avgRating) > Number(dataA.avgRating) ? ' class="mp-stats-hi"' : ''}>${dataB.avgRating ?? '-'}</td>
        </tr>` : ''}
        ${dataA.formation || dataB.formation ? `<tr>
          <td>${esc(dataA.formation) || '-'}</td><td>Formación</td><td>${esc(dataB.formation) || '-'}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </section>` : ''}

  <p class="mp-intro">
    Usa el simulador de fútbol histórico GolazoX para enfrentar a <strong>${esc(labelA)}</strong> y <strong>${esc(labelB)}</strong>.
    Nuestro motor probabilístico ejecuta miles de simulaciones con las alineaciones reales de cada era,
    el rendimiento histórico de cada jugador y factores tácticos para darte el resultado más probable.
    Gratis, sin registro, en segundos.
  </p>

  ${(playersA.length || playersB.length) ? `
  <div class="mp-rosters">
    ${playersA.length ? `<div class="mp-roster-card">
      <div class="mp-roster-title">${esc(labelA)}</div>
      ${playersA.map(p => `<div class="mp-player-row"><span class="mp-player-name">${esc(p.name)}</span><span class="mp-player-pos">${esc(p.position)}</span></div>`).join('')}
    </div>` : ''}
    ${playersB.length ? `<div class="mp-roster-card">
      <div class="mp-roster-title">${esc(labelB)}</div>
      ${playersB.map(p => `<div class="mp-player-row"><span class="mp-player-name">${esc(p.name)}</span><span class="mp-player-pos">${esc(p.position)}</span></div>`).join('')}
    </div>` : ''}
  </div>` : ''}

  <a class="mp-cta" href="${deepLink}">
    ⚽ Simular ${esc(labelA)} vs ${esc(labelB)} ahora
  </a>
  <p class="mp-note">Motor Monte Carlo · +500 plantillas históricas · Resultado en segundos</p>

  ${relatedMatches.length ? `
  <div class="mp-related">
    <div class="mp-related-title">Otros enfrentamientos</div>
    <div class="mp-related-links">
      ${relatedMatches.map(r => `<a class="mp-related-link" href="/partido/${encodeURIComponent(slugA + (eraA ? ':'+eraA : ''))}-vs-${encodeURIComponent(r.slug)}">${esc(labelA)} vs ${esc(r.name)}</a>`).join('')}
      ${relatedMatches.map(r => `<a class="mp-related-link" href="/partido/${encodeURIComponent(r.slug)}-vs-${encodeURIComponent(slugB + (eraB ? ':'+eraB : ''))}">${esc(r.name)} vs ${esc(labelB)}</a>`).join('')}
    </div>
  </div>` : ''}

  <div class="mp-footer">
    <a href="/">GolazoX</a> · <a href="/legal">Aviso Legal</a> · <a href="/privacy">Privacidad</a>
    · Simulador de fútbol histórico · Sin afiliación con FIFA, UEFA ni clubes
  </div>
</main>
</body>
</html>`;

  res.set('Cache-Control', 'public, max-age=3600').type('text/html').send(html);
  } catch (err) {
    console.error('[/partido/] SSR error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// -- /match/:matchup — English SSR page (mirrors /partido/ for EN SEO) ------
app.get('/match/:matchup', async (req, res) => {
  try {
  const _routeSiteUrl = SITE_URL.replace(/\/$/, '');
  const raw = req.params.matchup || '-';
  const vsIdx = raw.indexOf('-vs-');
  if (vsIdx === -1) return res.status(404).send('Not Found');
  const partA = raw.slice(0, vsIdx);
  const partB = raw.slice(vsIdx + 4);
  const [slugA, eraA = ''] = partA.split(':');
  const [slugB, eraB = ''] = partB.split(':');

  const entryA = CATALOG.find(c => c.slug === slugA);
  const entryB = CATALOG.find(c => c.slug === slugB);
  if (!entryA || !entryB) return res.status(404).send('Not Found');

  const nameA  = entryA.nameEn || entryA.nameEs;
  const nameB  = entryB.nameEn || entryB.nameEs;
  const labelA = eraA ? `${nameA} ${eraA}` : nameA;
  const labelB = eraB ? `${nameB} ${eraB}` : nameB;
  const esc    = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Load rosters in parallel from cache (non-blocking)
  const [dataA, dataB] = await Promise.all([_rosterFull(slugA, eraA), _rosterFull(slugB, eraB)]);
  const playersA = dataA.players;
  const playersB = dataB.players;

  const relatedMatches = (() => {
    const rivals = ['real-madrid','fc-barcelona','manchester-united','fc-bayern-munchen','ac-mailand','brasilien','deutschland','argentinien'];
    const related = [];
    for (const r of rivals) {
      if (r === slugA || r === slugB) continue;
      const entry = CATALOG.find(c => c.slug === r);
      if (!entry) continue;
      related.push({ slug: r, name: entry.nameEn || entry.nameEs });
      if (related.length >= 3) break;
    }
    return related;
  })();

  const pageTitle = `${esc(labelA)} vs ${esc(labelB)} · Simulate the Match | GolazoX`;
  const pageDesc  = `Who would win: ${esc(labelA)} vs ${esc(labelB)}? Simulate it now with GolazoX's Monte Carlo engine. Real historical squads, stats, and result in seconds.`;
  const canonUrl  = `${_routeSiteUrl}/match/${esc(raw)}`;
  const esUrl     = `${_routeSiteUrl}/partido/${esc(raw)}`;
  const ptUrl     = `${_routeSiteUrl}/partida/${esc(raw)}`;
  const deepLink  = `${_routeSiteUrl}/?a=${encodeURIComponent(eraA ? `${slugA}:${eraA}` : slugA)}&b=${encodeURIComponent(eraB ? `${slugB}:${eraB}` : slugB)}&lang=en`;
  const badgeA    = entryA.badge && entryA.badge !== BADGE_PLACEHOLDER ? entryA.badge : '';
  const badgeB    = entryB.badge && entryB.badge !== BADGE_PLACEHOLDER ? entryB.badge : '';

  const faqItems = [
    {
      q: `Who would win between ${labelA} and ${labelB}?`,
      a: `According to GolazoX's statistical engine, which simulates thousands of matches using the real historical squads of ${labelA} and ${labelB}, the most likely result can be calculated for free at golazox.com. The simulator takes into account real historical stats for each player and the tactical formation of each team.`,
    },
    {
      q: `What is the lineup of ${labelA}?`,
      a: dataA.players.length
        ? `The starting lineup of ${labelA} in GolazoX is: ${dataA.players.map(p => p.name).join(', ')}. Formation: ${dataA.formation || 'variable'}.`
        : `GolazoX has the full historical squad of ${nameA} with real stats for each player.`,
    },
    {
      q: `What is the lineup of ${labelB}?`,
      a: dataB.players.length
        ? `The starting lineup of ${labelB} in GolazoX is: ${dataB.players.map(p => p.name).join(', ')}. Formation: ${dataB.formation || 'variable'}.`
        : `GolazoX has the full historical squad of ${nameB} with real stats for each player.`,
    },
    {
      q: `Who is the best player in ${labelA}?`,
      a: dataA.top3.length
        ? `The top-rated players in ${labelA} on GolazoX are: ${dataA.top3.map(p => `${p.name} (${p.rating})`).join(', ')}.`
        : `GolazoX includes individual ratings for all players in ${nameA}.`,
    },
    {
      q: `How to simulate ${labelA} vs ${labelB} for free?`,
      a: `Go to golazox.com, select ${nameA} (era ${eraA || 'current'}) as team A and ${nameB} (era ${eraB || 'current'}) as team B, then click Simulate. The Monte Carlo engine runs thousands of matches in milliseconds and shows the most likely result. Completely free, no registration required.`,
    },
  ];

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'GolazoX', 'item': _routeSiteUrl },
          { '@type': 'ListItem', 'position': 2, 'name': `${labelA} vs ${labelB}` },
        ],
      },
      {
        '@type': 'WebPage',
        'name': `${labelA} vs ${labelB} · Football Simulation`,
        'description': pageDesc,
        'url': canonUrl,
        'inLanguage': 'en',
        'about': [
          { '@type': 'SportsTeam', 'name': labelA, 'sport': 'Soccer', ...(badgeA ? { 'logo': badgeA } : {}) },
          { '@type': 'SportsTeam', 'name': labelB, 'sport': 'Soccer', ...(badgeB ? { 'logo': badgeB } : {}) },
        ],
        'publisher': { '@type': 'Organization', 'name': 'GolazoX', 'url': _routeSiteUrl },
      },
      {
        '@type': 'FAQPage',
        'mainEntity': faqItems.map(({ q, a }) => ({
          '@type': 'Question',
          'name': q,
          'acceptedAnswer': { '@type': 'Answer', 'text': a },
        })),
      },
    ],
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDesc}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${canonUrl}"/>
  <link rel="alternate" hreflang="es" href="${esUrl}"/>
  <link rel="alternate" hreflang="en" href="${canonUrl}"/>
  <link rel="alternate" hreflang="pt-BR" href="${ptUrl}"/>
  <link rel="alternate" hreflang="x-default" href="${canonUrl}"/>
  <meta property="og:type" content="article"/>
  <meta property="article:published_time" content="${new Date().toISOString().slice(0,10)}T00:00:00Z"/>
  <meta property="article:section" content="Historical Football Simulation"/>
  <style>.mp-stat-wrap{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:.4rem;padding:.35rem .6rem;min-height:2.2rem}.mp-stat-bar{position:absolute;top:0;bottom:0;background:rgba(123,47,247,.25);border-radius:.4rem}.mp-stat-a .mp-stat-bar{right:0;left:auto}.mp-stat-b .mp-stat-bar{left:0;right:auto}.mp-stats-hi .mp-stat-bar{background:rgba(0,212,255,.38)}.mp-stat-val{position:relative;z-index:1;font-weight:700}</style>
  <meta property="og:title" content="${pageTitle}"/>
  <meta property="og:description" content="${pageDesc}"/>
  <meta property="og:url" content="${canonUrl}"/>
  <meta property="og:image" content="${_routeSiteUrl}/og-image.png?v=2"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${pageTitle}"/>
  <meta name="twitter:description" content="${pageDesc}"/>
  <script type="application/ld+json">${jsonLd}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2BSP5YDS7N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-2BSP5YDS7N');</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0f1a;color:#e2e8f0;font-family:system-ui,sans-serif;min-height:100vh}
    .mp-wrap{max-width:760px;margin:0 auto;padding:2rem 1.2rem 4rem}
    .mp-backlink{display:inline-flex;align-items:center;gap:.4rem;color:#38bdf8;font-size:.85rem;margin-bottom:1.8rem;text-decoration:none;opacity:.8}
    .mp-backlink:hover{opacity:1;text-decoration:underline}
    .mp-teams{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.6rem}
    .mp-badge{width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;filter:drop-shadow(0 2px 12px rgba(0,0,0,.6))}
    .mp-vs{font-size:1.4rem;font-weight:900;color:#7b2ff7;flex-shrink:0;padding:0 .4rem}
    .mp-team-block{display:flex;flex-direction:column;align-items:center;gap:.35rem;flex:1;min-width:0;text-align:center}
    .mp-team-info{display:flex;flex-direction:column;align-items:center;gap:.2rem}
    .mp-name{font-size:1.2rem;font-weight:700;line-height:1.2;color:#f1f5f9}
    .mp-era{font-size:.8rem;color:#7b2ff7;font-weight:600;background:rgba(123,47,247,.12);padding:.15rem .5rem;border-radius:999px;width:fit-content}
    h1{font-size:1.65rem;font-weight:900;line-height:1.2;margin-bottom:.8rem;color:#f1f5f9}
    .mp-intro{color:#94a3b8;font-size:.97rem;line-height:1.7;margin-bottom:2rem;border-left:3px solid #7b2ff7;padding-left:1rem}
    .mp-rosters{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:2rem}
    .mp-roster-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:.875rem;padding:1.2rem}
    .mp-roster-title{font-size:.75rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7b2ff7;margin-bottom:.8rem}
    .mp-player-row{display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.875rem}
    .mp-player-row:last-child{border-bottom:0}
    .mp-player-name{color:#e2e8f0}
    .mp-player-pos{color:#64748b;font-size:.75rem;font-weight:600;min-width:2.5rem;text-align:right}
    .mp-cta{display:block;background:linear-gradient(135deg,#7b2ff7,#00d4ff);color:#fff;text-align:center;padding:1.1rem 2rem;border-radius:.875rem;font-size:1.1rem;font-weight:800;text-decoration:none;letter-spacing:.04em;margin-bottom:.8rem;transition:opacity .15s}
    .mp-cta:hover{opacity:.9}
    .mp-note{font-size:.8rem;color:#475569;text-align:center;margin-bottom:2.5rem}
    .mp-related{margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.07)}
    .mp-related-title{font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:.8rem}
    .mp-related-links{display:flex;flex-wrap:wrap;gap:.5rem}
    .mp-related-link{color:#38bdf8;font-size:.875rem;text-decoration:none;background:rgba(56,189,248,.07);padding:.3rem .8rem;border-radius:999px;border:1px solid rgba(56,189,248,.15)}
    .mp-related-link:hover{background:rgba(56,189,248,.15)}
    .mp-footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid rgba(255,255,255,.06);font-size:.78rem;color:#334155;text-align:center}
    .mp-footer a{color:#475569;text-decoration:none}
    .mp-footer a:hover{text-decoration:underline}
    .mp-stats-section{margin-bottom:2rem}
    .mp-stats-title{font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:.6rem}
    .mp-stats-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .mp-stats-table caption{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;caption-side:top;text-align:left;padding-bottom:.4rem}
    .mp-stats-table th{color:#94a3b8;font-size:.75rem;font-weight:700;letter-spacing:.06em;padding:.5rem .6rem;text-align:center}
    .mp-stats-table th:nth-child(2){color:#7b2ff7}
    .mp-stats-table td{padding:.4rem .6rem;text-align:center;border-bottom:1px solid rgba(255,255,255,.05);font-weight:700;color:#e2e8f0}
    .mp-stats-table td:nth-child(2){color:#64748b;font-size:.8rem;font-weight:600}
    .mp-stats-hi{color:#7b2ff7}
    @media(max-width:520px){.mp-rosters{grid-template-columns:1fr}.mp-teams{gap:.8rem}.mp-badge{width:52px;height:52px}}
  </style>
</head>
<body>
<main class="mp-wrap">
  <a class="mp-backlink" href="/">← GolazoX · Football Time Machine</a>

  <div class="mp-teams">
    <div class="mp-team-block">
      ${badgeA ? `<img class="mp-badge" src="${badgeA}" alt="${esc(nameA)}" width="72" height="72" loading="eager"/>` : ''}
      <div class="mp-name">${esc(nameA)}</div>
      ${eraA ? `<div class="mp-era">${esc(eraA)}</div>` : ''}
    </div>
    <span class="mp-vs">VS</span>
    <div class="mp-team-block">
      ${badgeB ? `<img class="mp-badge" src="${badgeB}" alt="${esc(nameB)}" width="72" height="72" loading="eager"/>` : ''}
      <div class="mp-name">${esc(nameB)}</div>
      ${eraB ? `<div class="mp-era">${esc(eraB)}</div>` : ''}
    </div>
  </div>

  <h1>Who would win: ${esc(labelA)} vs ${esc(labelB)}?</h1>

  <a class="mp-cta" href="${deepLink}">⚽ Simulate ${esc(labelA)} vs ${esc(labelB)} now</a>
  <p class="mp-note">Monte Carlo Engine · 500+ historical squads · Result in seconds</p>

  ${(dataA.ratings && Object.keys(dataA.ratings).length) || (dataB.ratings && Object.keys(dataB.ratings).length) ? `
  <section class="mp-stats-section" aria-label="Stats comparison ${esc(labelA)} vs ${esc(labelB)}">
    <h2 class="mp-stats-title">Stats Comparison</h2>
    <table class="mp-stats-table">
      <caption>${esc(labelA)} vs ${esc(labelB)} · stats by category</caption>
      <thead><tr><th>${esc(labelA)}</th><th>Category</th><th>${esc(labelB)}</th></tr></thead>
      <tbody>
        ${[['attack','Attack'],['midfield','Midfield'],['defense','Defense'],['goalkeeping','Goalkeeping']].map(([k,label]) => {
          const va = dataA.ratings[k] ?? '-';
          const vb = dataB.ratings[k] ?? '-';
          const hiA = typeof va === 'number' && typeof vb === 'number' && va > vb;
          const hiB = typeof va === 'number' && typeof vb === 'number' && vb > va;
          const bw = v => typeof v === 'number' ? Math.round(Math.max(0,Math.min(100,(v-60)/40*100))) : 0;
          const bgA = `background:linear-gradient(to left,rgba(${hiA?'0,212,255,.42':'123,47,247,.28'}) ${bw(va)}%,transparent ${bw(va)}%)`;
          const bgB = `background:linear-gradient(to right,rgba(${hiB?'0,212,255,.42':'123,47,247,.28'}) ${bw(vb)}%,transparent ${bw(vb)}%)`;
          return `<tr><td${hiA?' class="mp-stats-hi"':''} style="${bgA}">${va}</td><td>${label}</td><td${hiB?' class="mp-stats-hi"':''} style="${bgB}">${vb}</td></tr>`;
        }).join('')}
        ${dataA.avgRating || dataB.avgRating ? `<tr>
          <td${dataA.avgRating && dataB.avgRating && Number(dataA.avgRating) > Number(dataB.avgRating) ? ' class="mp-stats-hi"' : ''}>${dataA.avgRating ?? '-'}</td>
          <td>Avg. Overall</td>
          <td${dataA.avgRating && dataB.avgRating && Number(dataB.avgRating) > Number(dataA.avgRating) ? ' class="mp-stats-hi"' : ''}>${dataB.avgRating ?? '-'}</td>
        </tr>` : ''}
        ${dataA.formation || dataB.formation ? `<tr>
          <td>${esc(dataA.formation) || '-'}</td><td>Formation</td><td>${esc(dataB.formation) || '-'}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </section>` : ''}

  <p class="mp-intro">
    Use GolazoX's historical football simulator to pit <strong>${esc(labelA)}</strong> against <strong>${esc(labelB)}</strong>.
    Our probabilistic engine runs thousands of simulations using each era's real squads,
    player historical performance and tactical factors to give you the most likely result.
    Free, no sign-up, in seconds.
  </p>

  ${(playersA.length || playersB.length) ? `
  <div class="mp-rosters">
    ${playersA.length ? `<div class="mp-roster-card">
      <div class="mp-roster-title">${esc(labelA)}</div>
      ${playersA.map(p => `<div class="mp-player-row"><span class="mp-player-name">${esc(p.name)}</span><span class="mp-player-pos">${esc(p.position)}</span></div>`).join('')}
    </div>` : ''}
    ${playersB.length ? `<div class="mp-roster-card">
      <div class="mp-roster-title">${esc(labelB)}</div>
      ${playersB.map(p => `<div class="mp-player-row"><span class="mp-player-name">${esc(p.name)}</span><span class="mp-player-pos">${esc(p.position)}</span></div>`).join('')}
    </div>` : ''}
  </div>` : ''}

  <a class="mp-cta" href="${deepLink}">
    ⚽ Simulate ${esc(labelA)} vs ${esc(labelB)} now
  </a>
  <p class="mp-note">Monte Carlo Engine · 500+ historical squads · Result in seconds</p>

  ${relatedMatches.length ? `
  <div class="mp-related">
    <div class="mp-related-title">More matchups</div>
    <div class="mp-related-links">
      ${relatedMatches.map(r => `<a class="mp-related-link" href="/match/${encodeURIComponent(slugA + (eraA ? ':'+eraA : ''))}-vs-${encodeURIComponent(r.slug)}">${esc(labelA)} vs ${esc(r.name)}</a>`).join('')}
      ${relatedMatches.map(r => `<a class="mp-related-link" href="/match/${encodeURIComponent(r.slug)}-vs-${encodeURIComponent(slugB + (eraB ? ':'+eraB : ''))}">${esc(r.name)} vs ${esc(labelB)}</a>`).join('')}
    </div>
  </div>` : ''}

  <div class="mp-footer">
    <a href="/">GolazoX</a> · <a href="/legal">Legal Notice</a> · <a href="/privacy">Privacy</a>
    · Historical football simulator · Not affiliated with FIFA, UEFA or any club
  </div>
</main>
</body>
</html>`;

  res.set('Cache-Control', 'public, max-age=3600').type('text/html').send(html);
  } catch (err) {
    console.error('[/match/] SSR error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// -- /partida/:matchup — Portuguese (PT-BR) SSR page --------------------------
app.get('/partida/:matchup', async (req, res) => {
  try {
  const _routeSiteUrl = SITE_URL.replace(/\/$/, '');
  const raw = req.params.matchup || '-';
  const vsIdx = raw.indexOf('-vs-');
  if (vsIdx === -1) return res.status(404).send('Not Found');
  const partA = raw.slice(0, vsIdx);
  const partB = raw.slice(vsIdx + 4);
  const [slugA, eraA = ''] = partA.split(':');
  const [slugB, eraB = ''] = partB.split(':');

  const entryA = CATALOG.find(c => c.slug === slugA);
  const entryB = CATALOG.find(c => c.slug === slugB);
  if (!entryA || !entryB) return res.status(404).send('Not Found');

  const nameA  = entryA.nameEs || entryA.nameEn;
  const nameB  = entryB.nameEs || entryB.nameEn;
  const labelA = eraA ? `${nameA} ${eraA}` : nameA;
  const labelB = eraB ? `${nameB} ${eraB}` : nameB;
  const esc    = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Load rosters in parallel from cache (non-blocking)
  const [dataA, dataB] = await Promise.all([_rosterFull(slugA, eraA), _rosterFull(slugB, eraB)]);
  const playersA = dataA.players;
  const playersB = dataB.players;

  const relatedMatches = (() => {
    const rivals = ['real-madrid','fc-barcelona','manchester-united','fc-bayern-munchen','ac-mailand','flamengo','brasilien','argentinien'];
    const related = [];
    for (const r of rivals) {
      if (r === slugA || r === slugB) continue;
      const entry = CATALOG.find(c => c.slug === r);
      if (!entry) continue;
      related.push({ slug: r, name: entry.nameEs || entry.nameEn });
      if (related.length >= 3) break;
    }
    return related;
  })();

  const pageTitle = `${esc(labelA)} vs ${esc(labelB)} · Simule a Partida | GolazoX`;
  const pageDesc  = `Quem venceria ${esc(labelA)} contra ${esc(labelB)}? Simule agora com o motor Monte Carlo do GolazoX. Elencos históricos reais, estatísticas e resultado em segundos.`;
  const canonUrl  = `${_routeSiteUrl}/partida/${esc(raw)}`;
  const esUrl     = `${_routeSiteUrl}/partido/${esc(raw)}`;
  const enUrl     = `${_routeSiteUrl}/match/${esc(raw)}`;
  const deepLink  = `${_routeSiteUrl}/?a=${encodeURIComponent(eraA ? `${slugA}:${eraA}` : slugA)}&b=${encodeURIComponent(eraB ? `${slugB}:${eraB}` : slugB)}`;
  const badgeA    = entryA.badge && entryA.badge !== BADGE_PLACEHOLDER ? entryA.badge : '';
  const badgeB    = entryB.badge && entryB.badge !== BADGE_PLACEHOLDER ? entryB.badge : '';

  const faqItems = [
    {
      q: `Quem venceria entre ${labelA} e ${labelB}?`,
      a: `De acordo com o motor estatístico do GolazoX, que simula milhares de partidas usando os elencos históricos reais de ${labelA} e ${labelB}, o resultado mais provável pode ser calculado gratuitamente em golazox.com. O simulador leva em conta as estatísticas históricas reais de cada jogador e a formação tática de cada equipe.`,
    },
    {
      q: `Qual é a escalação de ${labelA}?`,
      a: dataA.players.length
        ? `A escalação titular de ${labelA} no GolazoX é: ${dataA.players.map(p => p.name).join(', ')}. Formação: ${dataA.formation || 'variável'}.`
        : `O GolazoX possui o elenco histórico completo de ${nameA} com as estatísticas reais de cada jogador.`,
    },
    {
      q: `Qual é a escalação de ${labelB}?`,
      a: dataB.players.length
        ? `A escalação titular de ${labelB} no GolazoX é: ${dataB.players.map(p => p.name).join(', ')}. Formação: ${dataB.formation || 'variável'}.`
        : `O GolazoX possui o elenco histórico completo de ${nameB} com as estatísticas reais de cada jogador.`,
    },
    {
      q: `Quem é o melhor jogador de ${labelA}?`,
      a: dataA.top3.length
        ? `Os jogadores mais bem avaliados de ${labelA} no GolazoX são: ${dataA.top3.map(p => `${p.name} (${p.rating})`).join(', ')}.`
        : `O GolazoX inclui avaliações individuais de todos os jogadores de ${nameA}.`,
    },
    {
      q: `Como simular ${labelA} contra ${labelB} de graça?`,
      a: `Acesse golazox.com, selecione ${nameA} (era ${eraA || 'atual'}) como equipe A e ${nameB} (era ${eraB || 'atual'}) como equipe B, e clique em Simular. O motor Monte Carlo executa milhares de partidas em milissegundos e mostra o resultado mais provável. Completamente grátis, sem cadastro.`,
    },
  ];

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'GolazoX', 'item': _routeSiteUrl },
          { '@type': 'ListItem', 'position': 2, 'name': `${labelA} vs ${labelB}` },
        ],
      },
      {
        '@type': 'WebPage',
        'name': `${labelA} vs ${labelB} · Simulação de Futebol`,
        'description': pageDesc,
        'url': canonUrl,
        'inLanguage': 'pt-BR',
        'about': [
          { '@type': 'SportsTeam', 'name': labelA, 'sport': 'Soccer', ...(badgeA ? { 'logo': badgeA } : {}) },
          { '@type': 'SportsTeam', 'name': labelB, 'sport': 'Soccer', ...(badgeB ? { 'logo': badgeB } : {}) },
        ],
        'publisher': { '@type': 'Organization', 'name': 'GolazoX', 'url': _routeSiteUrl },
      },
      {
        '@type': 'FAQPage',
        'mainEntity': faqItems.map(({ q, a }) => ({
          '@type': 'Question',
          'name': q,
          'acceptedAnswer': { '@type': 'Answer', 'text': a },
        })),
      },
    ],
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDesc}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${canonUrl}"/>
  <link rel="alternate" hreflang="pt-BR" href="${canonUrl}"/>
  <link rel="alternate" hreflang="es" href="${esUrl}"/>
  <link rel="alternate" hreflang="en" href="${enUrl}"/>
  <link rel="alternate" hreflang="x-default" href="${esUrl}"/>
  <meta property="og:type" content="article"/>
  <meta property="article:published_time" content="${new Date().toISOString().slice(0,10)}T00:00:00Z"/>
  <meta property="article:section" content="Simulação de Futebol Histórico"/>
  <style>.mp-stat-wrap{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:.4rem;padding:.35rem .6rem;min-height:2.2rem}.mp-stat-bar{position:absolute;top:0;bottom:0;background:rgba(123,47,247,.25);border-radius:.4rem}.mp-stat-a .mp-stat-bar{right:0;left:auto}.mp-stat-b .mp-stat-bar{left:0;right:auto}.mp-stats-hi .mp-stat-bar{background:rgba(0,212,255,.38)}.mp-stat-val{position:relative;z-index:1;font-weight:700}</style>
  <meta property="og:title" content="${pageTitle}"/>
  <meta property="og:description" content="${pageDesc}"/>
  <meta property="og:url" content="${canonUrl}"/>
  <meta property="og:image" content="${_routeSiteUrl}/og-image.png?v=2"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${pageTitle}"/>
  <meta name="twitter:description" content="${pageDesc}"/>
  <script type="application/ld+json">${jsonLd}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2BSP5YDS7N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-2BSP5YDS7N');</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0f1a;color:#e2e8f0;font-family:system-ui,sans-serif;min-height:100vh}
    .mp-wrap{max-width:760px;margin:0 auto;padding:2rem 1.2rem 4rem}
    .mp-backlink{display:inline-flex;align-items:center;gap:.4rem;color:#38bdf8;font-size:.85rem;margin-bottom:1.8rem;text-decoration:none;opacity:.8}
    .mp-backlink:hover{opacity:1;text-decoration:underline}
    .mp-teams{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.6rem}
    .mp-badge{width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;filter:drop-shadow(0 2px 12px rgba(0,0,0,.6))}
    .mp-vs{font-size:1.4rem;font-weight:900;color:#7b2ff7;flex-shrink:0;padding:0 .4rem}
    .mp-team-block{display:flex;flex-direction:column;align-items:center;gap:.35rem;flex:1;min-width:0;text-align:center}
    .mp-team-info{display:flex;flex-direction:column;align-items:center;gap:.2rem}
    .mp-name{font-size:1.2rem;font-weight:700;line-height:1.2;color:#f1f5f9}
    .mp-era{font-size:.8rem;color:#7b2ff7;font-weight:600;background:rgba(123,47,247,.12);padding:.15rem .5rem;border-radius:999px;width:fit-content}
    h1{font-size:1.65rem;font-weight:900;line-height:1.2;margin-bottom:.8rem;color:#f1f5f9}
    .mp-intro{color:#94a3b8;font-size:.97rem;line-height:1.7;margin-bottom:2rem;border-left:3px solid #7b2ff7;padding-left:1rem}
    .mp-rosters{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:2rem}
    .mp-roster-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:.875rem;padding:1.2rem}
    .mp-roster-title{font-size:.75rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7b2ff7;margin-bottom:.8rem}
    .mp-player-row{display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.875rem}
    .mp-player-row:last-child{border-bottom:0}
    .mp-player-name{color:#e2e8f0}
    .mp-player-pos{color:#64748b;font-size:.75rem;font-weight:600;min-width:2.5rem;text-align:right}
    .mp-cta{display:block;background:linear-gradient(135deg,#7b2ff7,#00d4ff);color:#fff;text-align:center;padding:1.1rem 2rem;border-radius:.875rem;font-size:1.1rem;font-weight:800;text-decoration:none;letter-spacing:.04em;margin-bottom:.8rem;transition:opacity .15s}
    .mp-cta:hover{opacity:.9}
    .mp-note{font-size:.8rem;color:#475569;text-align:center;margin-bottom:2.5rem}
    .mp-related{margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.07)}
    .mp-related-title{font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:.8rem}
    .mp-related-links{display:flex;flex-wrap:wrap;gap:.5rem}
    .mp-related-link{color:#38bdf8;font-size:.875rem;text-decoration:none;background:rgba(56,189,248,.07);padding:.3rem .8rem;border-radius:999px;border:1px solid rgba(56,189,248,.15)}
    .mp-related-link:hover{background:rgba(56,189,248,.15)}
    .mp-footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid rgba(255,255,255,.06);font-size:.78rem;color:#334155;text-align:center}
    .mp-footer a{color:#475569;text-decoration:none}
    .mp-footer a:hover{text-decoration:underline}
    .mp-stats-section{margin-bottom:2rem}
    .mp-stats-title{font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:.6rem}
    .mp-stats-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .mp-stats-table caption{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;caption-side:top;text-align:left;padding-bottom:.4rem}
    .mp-stats-table th{color:#94a3b8;font-size:.75rem;font-weight:700;letter-spacing:.06em;padding:.5rem .6rem;text-align:center}
    .mp-stats-table th:nth-child(2){color:#7b2ff7}
    .mp-stats-table td{padding:.4rem .6rem;text-align:center;border-bottom:1px solid rgba(255,255,255,.05);font-weight:700;color:#e2e8f0}
    .mp-stats-table td:nth-child(2){color:#64748b;font-size:.8rem;font-weight:600}
    .mp-stats-hi{color:#7b2ff7}
    @media(max-width:520px){.mp-rosters{grid-template-columns:1fr}.mp-teams{gap:.8rem}.mp-badge{width:52px;height:52px}}
  </style>
</head>
<body>
<main class="mp-wrap">
  <a class="mp-backlink" href="/">← GolazoX · Football Time Machine</a>

  <div class="mp-teams">
    <div class="mp-team-block">
      ${badgeA ? `<img class="mp-badge" src="${badgeA}" alt="${esc(nameA)}" width="72" height="72" loading="eager"/>` : ''}
      <div class="mp-name">${esc(nameA)}</div>
      ${eraA ? `<div class="mp-era">${esc(eraA)}</div>` : ''}
    </div>
    <span class="mp-vs">VS</span>
    <div class="mp-team-block">
      ${badgeB ? `<img class="mp-badge" src="${badgeB}" alt="${esc(nameB)}" width="72" height="72" loading="eager"/>` : ''}
      <div class="mp-name">${esc(nameB)}</div>
      ${eraB ? `<div class="mp-era">${esc(eraB)}</div>` : ''}
    </div>
  </div>

  <h1>Quem venceria: ${esc(labelA)} vs ${esc(labelB)}?</h1>

  <a class="mp-cta" href="${deepLink}">⚽ Simular ${esc(labelA)} vs ${esc(labelB)} agora</a>
  <p class="mp-note">Motor Monte Carlo · +500 elencos históricos · Resultado em segundos</p>

  ${(dataA.ratings && Object.keys(dataA.ratings).length) || (dataB.ratings && Object.keys(dataB.ratings).length) ? `
  <section class="mp-stats-section" aria-label="Comparação de estatísticas ${esc(labelA)} vs ${esc(labelB)}">
    <h2 class="mp-stats-title">Comparação de Estatísticas</h2>
    <table class="mp-stats-table">
      <caption>${esc(labelA)} vs ${esc(labelB)} · estatísticas por categoria</caption>
      <thead><tr><th>${esc(labelA)}</th><th>Categoria</th><th>${esc(labelB)}</th></tr></thead>
      <tbody>
        ${[['attack','Ataque'],['midfield','Meio-campo'],['defense','Defesa'],['goalkeeping','Goleiro']].map(([k,label]) => {
          const va = dataA.ratings[k] ?? '-';
          const vb = dataB.ratings[k] ?? '-';
          const hiA = typeof va === 'number' && typeof vb === 'number' && va > vb;
          const hiB = typeof va === 'number' && typeof vb === 'number' && vb > va;
          const bw = v => typeof v === 'number' ? Math.round(Math.max(0,Math.min(100,(v-60)/40*100))) : 0;
          const bgA = `background:linear-gradient(to left,rgba(${hiA?'0,212,255,.42':'123,47,247,.28'}) ${bw(va)}%,transparent ${bw(va)}%)`;
          const bgB = `background:linear-gradient(to right,rgba(${hiB?'0,212,255,.42':'123,47,247,.28'}) ${bw(vb)}%,transparent ${bw(vb)}%)`;
          return `<tr><td${hiA?' class="mp-stats-hi"':''} style="${bgA}">${va}</td><td>${label}</td><td${hiB?' class="mp-stats-hi"':''} style="${bgB}">${vb}</td></tr>`;
        }).join('')}
        ${dataA.avgRating || dataB.avgRating ? `<tr>
          <td${dataA.avgRating && dataB.avgRating && Number(dataA.avgRating) > Number(dataB.avgRating) ? ' class="mp-stats-hi"' : ''}>${dataA.avgRating ?? '-'}</td>
          <td>Média overall</td>
          <td${dataA.avgRating && dataB.avgRating && Number(dataB.avgRating) > Number(dataA.avgRating) ? ' class="mp-stats-hi"' : ''}>${dataB.avgRating ?? '-'}</td>
        </tr>` : ''}
        ${dataA.formation || dataB.formation ? `<tr>
          <td>${esc(dataA.formation) || '-'}</td><td>Formação</td><td>${esc(dataB.formation) || '-'}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </section>` : ''}

  <p class="mp-intro">
    Use o simulador de futebol histórico GolazoX para enfrentar <strong>${esc(labelA)}</strong> e <strong>${esc(labelB)}</strong>.
    Nosso motor probabilístico executa milhares de simulações com os elencos reais de cada era,
    o desempenho histórico de cada jogador e fatores táticos para te dar o resultado mais provável.
    Grátis, sem cadastro, em segundos.
  </p>

  ${(playersA.length || playersB.length) ? `
  <div class="mp-rosters">
    ${playersA.length ? `<div class="mp-roster-card">
      <div class="mp-roster-title">${esc(labelA)}</div>
      ${playersA.map(p => `<div class="mp-player-row"><span class="mp-player-name">${esc(p.name)}</span><span class="mp-player-pos">${esc(p.position)}</span></div>`).join('')}
    </div>` : ''}
    ${playersB.length ? `<div class="mp-roster-card">
      <div class="mp-roster-title">${esc(labelB)}</div>
      ${playersB.map(p => `<div class="mp-player-row"><span class="mp-player-name">${esc(p.name)}</span><span class="mp-player-pos">${esc(p.position)}</span></div>`).join('')}
    </div>` : ''}
  </div>` : ''}

  <a class="mp-cta" href="${deepLink}">
    ⚽ Simular ${esc(labelA)} vs ${esc(labelB)} agora
  </a>
  <p class="mp-note">Motor Monte Carlo · +500 elencos históricos · Resultado em segundos</p>

  ${relatedMatches.length ? `
  <div class="mp-related">
    <div class="mp-related-title">Outros confrontos</div>
    <div class="mp-related-links">
      ${relatedMatches.map(r => `<a class="mp-related-link" href="/partida/${encodeURIComponent(slugA + (eraA ? ':'+eraA : ''))}-vs-${encodeURIComponent(r.slug)}">${esc(labelA)} vs ${esc(r.name)}</a>`).join('')}
      ${relatedMatches.map(r => `<a class="mp-related-link" href="/partida/${encodeURIComponent(r.slug)}-vs-${encodeURIComponent(slugB + (eraB ? ':'+eraB : ''))}">${esc(r.name)} vs ${esc(labelB)}</a>`).join('')}
    </div>
  </div>` : ''}

  <div class="mp-footer">
    <a href="/">GolazoX</a> · <a href="/legal">Aviso Legal</a> · <a href="/privacy">Privacidade</a>
    · Simulador de futebol histórico · Sem afiliação com FIFA, UEFA ou clubes
  </div>
</main>
</body>
</html>`;

  res.set('Cache-Control', 'public, max-age=3600').type('text/html').send(html);
  } catch (err) {
    console.error('[/partida/] SSR error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// -- /resultado/:matchup, /result/:matchup, /jogo/:matchup -----------------
// Canonical pages for a pre-simulated result (indexed by Google for long-tail).
// The simulation runs server-side with a stable salt derived from the URL,
// so the result stays consistent across crawls. Cached 24 h per matchup.
//
// URL format: /resultado/real-madrid:2014-vs-fc-barcelona:2009
// Supports: /resultado/ (ES), /result/ (EN), /jogo/ (PT-BR)

// 24-hour result cache: "slugA:eraA-vs-slugB:eraB" ? { html, cachedAt }
const _resultCache = new Map();
const _RESULT_CACHE_TTL = 24 * 3600 * 1000; // 24 h

async function _buildResultPage(slugA, eraA, slugB, eraB, lang, siteUrl) {
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const entryA = CATALOG.find(c => c.slug === slugA);
  const entryB = CATALOG.find(c => c.slug === slugB);
  if (!entryA || !entryB) return null;

  const isEn = lang === 'en';
  const isPt = lang === 'pt';
  const nameA = isEn ? (entryA.nameEn || entryA.nameEs) : (entryA.nameEs || entryA.nameEn);
  const nameB = isEn ? (entryB.nameEn || entryB.nameEs) : (entryB.nameEs || entryB.nameEn);
  const labelA = eraA ? `${nameA} ${eraA}` : nameA;
  const labelB = eraB ? `${nameB} ${eraB}` : nameB;

  // Run the simulation with a deterministic salt (so Googlebot always sees the same result)
  const saltStr = `${slugA}${eraA}${slugB}${eraB}`;
  const stableSalt = saltStr.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0) & 0x7fffffff;

  const [luA, luB] = await Promise.all([
    lookupTeam(slugA, eraA),
    lookupTeam(slugB, eraB),
  ]);
  if (!luA.found || !luB.found) return null;

  const params = {
    teamA: nameA, teamB: nameB,
    eraA, eraB,
    formationA: luA.formation || '-', formationB: luB.formation || '-',
    cachedLineupA: luA, cachedLineupB: luB,
    matchMode: '11v11',
    matchSalt: stableSalt,
    refereeId: null, isFinal: false, weatherId: null,
  };
  const sim = simulateMatch(params);
  const scoreA = sim.finalScore?.teamA ?? 0;
  const scoreB = sim.finalScore?.teamB ?? 0;
  const pA = sim.probabilities?.teamA_win ?? 0;
  const pD = sim.probabilities?.draw ?? 0;
  const pB = sim.probabilities?.teamB_win ?? 0;
  const topMom = sim.stats?.manOfMatch;

  // I18n strings
  const ui = {
    es: {
      titleSuffix: 'Resultado Simulado | GolazoX',
      h1prefix: 'Resultado simulado:',
      subTitle: 'Simulación GolazoX · Motor Monte Carlo',
      probsTitle: 'Probabilidades a lo largo de 1000 partidas',
      momTitle: 'Mejor jugador del partido',
      ctaText: 'Ver estadísticas completas →',
      altTitle: 'Resultados alternativos',
      backLabel: '← GolazoX · Football Time Machine',
      descPrefix: 'Resultado de la simulación',
      winLabel: 'victorias', drawLabel: 'empates',
      routePrefix: 'partido',
    },
    en: {
      titleSuffix: 'Simulated Result | GolazoX',
      h1prefix: 'Simulated result:',
      subTitle: 'GolazoX Simulation · Monte Carlo Engine',
      probsTitle: 'Win probabilities across 1,000 matches',
      momTitle: 'Man of the Match',
      ctaText: 'See full stats & historical squads →',
      altTitle: 'Alternative scorelines',
      backLabel: '← GolazoX · Football Time Machine',
      descPrefix: 'Simulation result',
      winLabel: 'wins', drawLabel: 'draws',
      routePrefix: 'match',
    },
    pt: {
      titleSuffix: 'Resultado Simulado | GolazoX',
      h1prefix: 'Resultado simulado:',
      subTitle: 'Simulação GolazoX · Motor Monte Carlo',
      probsTitle: 'Probabilidades em 1.000 partidas',
      momTitle: 'Melhor jogador da partida',
      ctaText: 'Ver estatísticas completas →',
      altTitle: 'Resultados alternativos',
      backLabel: '← GolazoX · Football Time Machine',
      descPrefix: 'Resultado da simulação',
      winLabel: 'vitórias', drawLabel: 'empates',
      routePrefix: 'partida',
    },
  };
  const s = ui[isPt ? 'pt' : isEn ? 'en' : 'es'];

  const matchupParam = `${encodeURIComponent(eraA ? `${slugA}:${eraA}` : slugA)}-vs-${encodeURIComponent(eraB ? `${slugB}:${eraB}` : slugB)}`;
  const ssrUrl  = `${siteUrl}/${s.routePrefix}/${matchupParam}`;
  const selfUrl = `${siteUrl}/${isPt ? 'jogo' : isEn ? 'result' : 'resultado'}/${matchupParam}`;

  const canonLang = isPt ? 'pt-BR' : isEn ? 'en' : 'es';
  const pageTitle = `${esc(labelA)} ${scoreA} - ${scoreB} ${esc(labelB)} · ${s.titleSuffix}`;
  const pageDesc  = `${s.descPrefix}: ${esc(labelA)} ${scoreA} - ${scoreB} ${esc(labelB)}. ${esc(labelA)}: ${pA}% ${s.winLabel}, ${pD}% ${s.drawLabel}. Motor Monte Carlo de GolazoX, gratis.`;
  const badgeA = entryA.badge && entryA.badge !== BADGE_PLACEHOLDER ? entryA.badge : '';
  const badgeB = entryB.badge && entryB.badge !== BADGE_PLACEHOLDER ? entryB.badge : '';

  const altScores = (sim.altScores || []).slice(0, 5);

  // Determine result label for schema
  const winner = scoreA > scoreB ? labelA : scoreB > scoreA ? labelB : null;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'GolazoX', 'item': siteUrl },
          { '@type': 'ListItem', 'position': 2, 'name': `${labelA} vs ${labelB}`, 'item': ssrUrl },
          { '@type': 'ListItem', 'position': 3, 'name': `${scoreA} - ${scoreB}` },
        ],
      },
      {
        '@type': 'SportsEvent',
        'name': `${labelA} vs ${labelB} · ${s.subTitle}`,
        'description': pageDesc.replace(/&\w+;/g, ' '),
        'url': selfUrl,
        'sport': 'Soccer',
        'competitor': [
          { '@type': 'SportsTeam', 'name': labelA, ...(badgeA ? { 'logo': badgeA } : {}) },
          { '@type': 'SportsTeam', 'name': labelB, ...(badgeB ? { 'logo': badgeB } : {}) },
        ],
        ...(winner ? { 'winner': { '@type': 'SportsTeam', 'name': winner } } : {}),
        'organizer': { '@type': 'Organization', 'name': 'GolazoX', 'url': siteUrl },
      },
      {
        '@type': 'WebPage',
        'url': selfUrl,
        'name': pageTitle,
        'description': pageDesc.replace(/&\w+;/g, ' '),
        'inLanguage': canonLang,
        'isPartOf': { '@type': 'WebSite', 'url': siteUrl, 'name': 'GolazoX' },
      },
    ],
  });

  return `<!DOCTYPE html>
<html lang="${canonLang}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDesc}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${ssrUrl}"/>
  <link rel="alternate" hreflang="es" href="${siteUrl}/partido/${matchupParam}"/>
  <link rel="alternate" hreflang="en" href="${siteUrl}/match/${matchupParam}"/>
  <link rel="alternate" hreflang="pt-BR" href="${siteUrl}/partida/${matchupParam}"/>
  <link rel="alternate" hreflang="x-default" href="${siteUrl}/partido/${matchupParam}"/>
  <meta property="og:type" content="article"/>
  <meta property="article:published_time" content="${new Date().toISOString().slice(0,10)}T00:00:00Z"/>
  <meta property="article:section" content="${isEn ? 'Football Simulation' : 'Simulación de Fútbol'}"/>
  <meta property="og:title" content="${pageTitle}"/>
  <meta property="og:description" content="${pageDesc}"/>
  <meta property="og:url" content="${selfUrl}"/>
  <meta property="og:image" content="${siteUrl}/og-image.png?v=2"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0f1a;color:#e2e8f0;font-family:system-ui,sans-serif;min-height:100vh}
    .rp-wrap{max-width:600px;margin:0 auto;padding:2rem 1.2rem 4rem}
    .rp-back{display:inline-flex;align-items:center;gap:.4rem;color:#38bdf8;font-size:.85rem;margin-bottom:1.8rem;text-decoration:none;opacity:.8}
    .rp-back:hover{opacity:1;text-decoration:underline}
    .rp-eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7b2ff7;margin-bottom:.75rem}
    .rp-scoreboard{display:flex;align-items:center;justify-content:center;gap:1.4rem;flex-wrap:wrap;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:1rem;padding:1.6rem 1.2rem;margin-bottom:1.5rem}
    .rp-team{display:flex;flex-direction:column;align-items:center;gap:.5rem;flex:1;min-width:100px;max-width:160px}
    .rp-badge{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 2px 10px rgba(0,0,0,.6))}
    .rp-team-name{font-size:.9rem;font-weight:700;text-align:center;color:#f1f5f9;line-height:1.2}
    .rp-era-badge{font-size:.72rem;color:#7b2ff7;font-weight:600;background:rgba(123,47,247,.12);padding:.12rem .45rem;border-radius:999px}
    .rp-score{font-size:3.5rem;font-weight:900;color:#f8fafc;letter-spacing:-.02em;line-height:1;flex-shrink:0}
    .rp-score-sep{font-size:2rem;font-weight:900;color:#475569;margin:0 -.3rem}
    h1{font-size:1.1rem;font-weight:700;color:#94a3b8;margin-bottom:1.4rem;text-align:center}
    .rp-probs{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:.875rem;padding:1.1rem 1.2rem;margin-bottom:1.2rem}
    .rp-probs-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:.85rem}
    .rp-prob-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;text-align:center}
    .rp-prob-val{font-size:1.6rem;font-weight:900;color:#f1f5f9}
    .rp-prob-lbl{font-size:.7rem;color:#64748b;font-weight:600;margin-top:.2rem}
    .rp-bar-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.3rem;margin-top:.7rem}
    .rp-bar-bg{background:rgba(255,255,255,.06);border-radius:4px;height:5px;overflow:hidden}
    .rp-bar-fill-a{background:#7b2ff7;height:100%;border-radius:4px}
    .rp-bar-fill-d{background:#475569;height:100%;border-radius:4px}
    .rp-bar-fill-b{background:#00d4ff;height:100%;border-radius:4px}
    .rp-alt{margin-bottom:1.2rem}
    .rp-alt-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:.6rem}
    .rp-alt-chips{display:flex;flex-wrap:wrap;gap:.4rem}
    .rp-chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:.25rem .7rem;font-size:.82rem;font-weight:700;color:#cbd5e1}
    .rp-chip small{font-weight:400;color:#64748b;margin-left:.3rem}
    .rp-mom{background:rgba(123,47,247,.07);border:1px solid rgba(123,47,247,.2);border-radius:.875rem;padding:.9rem 1.1rem;margin-bottom:1.4rem;font-size:.9rem}
    .rp-mom-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7b2ff7;margin-bottom:.4rem}
    .rp-mom-name{font-weight:700;color:#f1f5f9}
    .rp-cta{display:block;background:linear-gradient(135deg,#7b2ff7,#00d4ff);color:#fff;text-align:center;padding:1rem 2rem;border-radius:.875rem;font-size:1rem;font-weight:800;text-decoration:none;letter-spacing:.04em;margin-bottom:2rem;transition:opacity .15s}
    .rp-cta:hover{opacity:.9}
    .rp-footer{margin-top:2rem;padding-top:1.2rem;border-top:1px solid rgba(255,255,255,.06);font-size:.78rem;color:#334155;text-align:center}
    .rp-footer a{color:#475569;text-decoration:none}
    .rp-footer a:hover{text-decoration:underline}
  </style>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2BSP5YDS7N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-2BSP5YDS7N');</script>
</head>
<body>
<main class="rp-wrap">
  <a class="rp-back" href="/">${esc(s.backLabel)}</a>
  <div class="rp-eyebrow">${esc(s.subTitle)}</div>

  <div class="rp-scoreboard">
    <div class="rp-team">
      ${badgeA ? `<img class="rp-badge" src="${badgeA}" alt="${esc(nameA)}" width="64" height="64" loading="eager"/>` : ''}
      <div class="rp-team-name">${esc(nameA)}</div>
      ${eraA ? `<div class="rp-era-badge">${esc(eraA)}</div>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:.2rem">
      <span class="rp-score">${scoreA}</span>
      <span class="rp-score-sep">-</span>
      <span class="rp-score">${scoreB}</span>
    </div>
    <div class="rp-team">
      ${badgeB ? `<img class="rp-badge" src="${badgeB}" alt="${esc(nameB)}" width="64" height="64" loading="eager"/>` : ''}
      <div class="rp-team-name">${esc(nameB)}</div>
      ${eraB ? `<div class="rp-era-badge">${esc(eraB)}</div>` : ''}
    </div>
  </div>

  <h1>${esc(s.h1prefix)} ${esc(labelA)} vs ${esc(labelB)}</h1>

  <div class="rp-probs">
    <div class="rp-probs-title">${esc(s.probsTitle)}</div>
    <div class="rp-prob-row">
      <div><div class="rp-prob-val">${pA}%</div><div class="rp-prob-lbl">${esc(labelA)}</div></div>
      <div><div class="rp-prob-val">${pD}%</div><div class="rp-prob-lbl">${esc(s.drawLabel)}</div></div>
      <div><div class="rp-prob-val">${pB}%</div><div class="rp-prob-lbl">${esc(labelB)}</div></div>
    </div>
    <div class="rp-bar-row">
      <div class="rp-bar-bg"><div class="rp-bar-fill-a" style="width:${pA}%"></div></div>
      <div class="rp-bar-bg"><div class="rp-bar-fill-d" style="width:${pD}%"></div></div>
      <div class="rp-bar-bg"><div class="rp-bar-fill-b" style="width:${pB}%"></div></div>
    </div>
  </div>

  ${altScores.length ? `
  <div class="rp-alt">
    <div class="rp-alt-title">${esc(s.altTitle)}</div>
    <div class="rp-alt-chips">
      ${altScores.map(a => `<span class="rp-chip">${esc(a.score)}<small>${a.probability}%</small></span>`).join('')}
    </div>
  </div>` : ''}

  ${topMom ? `
  <div class="rp-mom">
    <div class="rp-mom-title">${esc(s.momTitle)}</div>
    <div class="rp-mom-name">${esc(topMom.name)}${topMom.rating ? ` · ${topMom.rating}` : ''}</div>
  </div>` : ''}

  <a class="rp-cta" href="${ssrUrl}">${esc(s.ctaText)}</a>

  <div class="rp-footer">
    <a href="/">GolazoX</a> · <a href="/legal">${isEn ? 'Legal Notice' : 'Aviso Legal'}</a> · <a href="/privacy">${isEn ? 'Privacy' : 'Privacidad'}</a>
    · ${isEn ? 'Historical football simulator · Not affiliated with FIFA, UEFA or any club' : 'Simulador de fútbol histórico · Sin afiliación con FIFA, UEFA ni clubes'}
  </div>
</main>
</body>
</html>`;
}

const _handleResultRoute = (routeLang) => async (req, res) => {
  const _routeSiteUrl = SITE_URL.replace(/\/$/, '');
  const raw = req.params.matchup || '-';
  const vsIdx = raw.indexOf('-vs-');
  if (vsIdx === -1) return res.status(404).send('Not Found');
  const [slugA, eraA = ''] = raw.slice(0, vsIdx).split(':');
  const [slugB, eraB = ''] = raw.slice(vsIdx + 4).split(':');

  // Reject unknown slugs early
  if (!CATALOG.find(c => c.slug === slugA) || !CATALOG.find(c => c.slug === slugB)) {
    return res.status(404).send('Not Found');
  }

  const cacheKey = `${routeLang}:${slugA}:${eraA}-vs-${slugB}:${eraB}`;
  const cached = _resultCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < _RESULT_CACHE_TTL) {
    return res.set('Cache-Control', 'public, max-age=3600').type('text/html').send(cached.html);
  }

  try {
    const html = await _buildResultPage(slugA, eraA, slugB, eraB, routeLang, _routeSiteUrl);
    if (!html) return res.status(404).send('Not Found');
    _resultCache.set(cacheKey, { html, cachedAt: Date.now() });
    res.set('Cache-Control', 'public, max-age=3600').type('text/html').send(html);
  } catch (err) {
    console.error('[/resultado/] SSR error:', err.message);
    res.status(500).send('Internal Server Error');
  }
};

app.get('/resultado/:matchup', _handleResultRoute('es'));
app.get('/result/:matchup',    _handleResultRoute('en'));
app.get('/jogo/:matchup',      _handleResultRoute('pt'));

// -- /equipo/:slug and /team/:slug — SSR team profile pages for SEO ----------
// URL examples:
//   /equipo/real-madrid        ? Spanish profile (latest season)
//   /equipo/real-madrid:2002   ? Spanish profile for 2002 season
//   /team/real-madrid:2002     ? English version
const _buildTeamPage = ({ entry, slug, era, lang, siteUrl, squadData }) => {
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const isEn = lang === 'en';
  const name = isEn ? (entry.nameEn||entry.nameEs) : (entry.nameEs||entry.nameEn);
  const badgeUrl = (entry.badge && entry.badge !== BADGE_PLACEHOLDER) ? entry.badge : '';

  // Use pre-loaded squadData (from async cache) or fall back to sync read
  let players = [], resolvedEra = '';
  try {
    const d = squadData || JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', `${slug}.json`), 'utf8').replace(/^\uFEFF/, ''));
    const seasons = Object.keys(d.seasons||{}).sort((a,b) => Number(b)-Number(a));
    const key = (era && d.seasons[era]) ? era : seasons[0];
    resolvedEra = key;
    players = (d.seasons[key]?.players||[]).slice(0, 11);
  } catch (_) {}

  const displayEra   = era || resolvedEra;
  const label        = displayEra ? `${name} ${displayEra}` : name;
  const allSeasons   = entry.seasons || [];
  const routePrefix  = isEn ? 'team'    : 'equipo';
  const matchPrefix  = isEn ? 'match'   : 'partido';
  const canonUrl     = `${siteUrl}/${routePrefix}/${displayEra ? slug+':'+displayEra : slug}`;
  const deepLink     = `${siteUrl}/?a=${encodeURIComponent(displayEra ? `${slug}:${displayEra}` : slug)}`;

  const pageTitle = isEn
    ? `${esc(label)} · Historical Squad & Simulator | GolazoX`
    : `${esc(label)} · Plantilla Histórica y Simulador | GolazoX`;

  // Build description with actual player names for rich, unique snippets
  const topPlayers = players.slice(0, 4).map(p => p.name).filter(Boolean);
  const playerSnippet = topPlayers.length ? topPlayers.join(', ') + ' y más. ' : '';
  const pageDesc = isEn
    ? `${esc(label)}: full historical squad, key players, stats. Simulate ${esc(name)} against the greatest teams in football history with GolazoX's free Monte Carlo engine.`
    : `Plantel completo de ${esc(label)}${topPlayers.length ? `: ${topPlayers.join(', ')}` : ''}. Simula ${esc(name)} contra los mejores equipos de la historia con el motor Monte Carlo de GolazoX. Gratis.`;

  const TOP_RIVALS = ['real-madrid','fc-barcelona','manchester-united','fc-bayern-munchen',
    'ac-mailand','inter-mailand','juventus-turin','fc-liverpool',
    'brasilien','argentinien','deutschland','ajax-amsterdam'];
  const rivals = TOP_RIVALS
    .filter(r => r !== slug)
    .map(r => CATALOG.find(c => c.slug === r)).filter(Boolean)
    .slice(0, 6)
    .map(r => ({ slug: r.slug, name: isEn ? (r.nameEn||r.nameEs) : (r.nameEs||r.nameEn) }));

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', 'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'GolazoX', 'item': siteUrl },
        { '@type': 'ListItem', 'position': 2, 'name': name, 'item': `${siteUrl}/${routePrefix}/${slug}` },
        ...(displayEra ? [{ '@type': 'ListItem', 'position': 3, 'name': label }] : []),
      ]},
      { '@type': 'SportsTeam', 'name': name, 'sport': 'Soccer', 'url': canonUrl,
        ...(badgeUrl ? { 'logo': badgeUrl } : {}),
        ...(players.length ? { 'member': players.map(p => ({ '@type': 'Person', 'name': p.name })) } : {}),
      },
    ],
  });

  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'es'}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${pageTitle}</title>
  <meta name="description" content="${esc(pageDesc)}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${canonUrl}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${pageTitle}"/>
  <meta property="og:description" content="${esc(pageDesc)}"/>
  <meta property="og:url" content="${canonUrl}"/>
  <meta property="og:image" content="${siteUrl}/og-image.png?v=2"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0f1a;color:#e2e8f0;font-family:system-ui,sans-serif;min-height:100vh}
    .tp{max-width:760px;margin:0 auto;padding:2rem 1.2rem 4rem}
    .tp-back{display:inline-flex;align-items:center;gap:.4rem;color:#38bdf8;font-size:.85rem;margin-bottom:1.8rem;text-decoration:none;opacity:.8}
    .tp-back:hover{opacity:1;text-decoration:underline}
    .tp-hdr{display:flex;align-items:center;gap:1.4rem;flex-wrap:wrap;margin-bottom:1.8rem}
    .tp-badge{width:80px;height:80px;object-fit:contain;filter:drop-shadow(0 2px 12px rgba(0,0,0,.6))}
    .tp-grp{font-size:.72rem;color:#64748b;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.3rem}
    h1{font-size:1.7rem;font-weight:900;line-height:1.2;color:#f1f5f9;margin-bottom:.4rem}
    .tp-era{font-size:.82rem;color:#7b2ff7;font-weight:700;background:rgba(123,47,247,.12);padding:.2rem .65rem;border-radius:999px;border:1px solid rgba(123,47,247,.2);width:fit-content}
    .tp-intro{color:#94a3b8;font-size:.97rem;line-height:1.7;margin-bottom:2rem;border-left:3px solid #7b2ff7;padding-left:1rem}
    .tp-sec{font-size:.75rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7b2ff7;margin-bottom:.7rem}
    .tp-pills{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:2rem}
    .tp-pill{color:#38bdf8;font-size:.85rem;text-decoration:none;background:rgba(56,189,248,.07);padding:.25rem .7rem;border-radius:999px;border:1px solid rgba(56,189,248,.12)}
    .tp-pill:hover,.tp-pill.active{background:rgba(56,189,248,.18)}
    .tp-pill.active{border-color:rgba(56,189,248,.5);font-weight:700}
    .tp-roster{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:.875rem;padding:1.4rem;margin-bottom:2rem}
    .tp-row{display:flex;justify-content:space-between;align-items:center;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.9rem}
    .tp-row:last-child{border-bottom:0}
    .tp-pname{color:#e2e8f0}
    .tp-pos{color:#64748b;font-size:.72rem;font-weight:700;background:rgba(255,255,255,.05);padding:.1rem .4rem;border-radius:4px}
    .tp-cta{display:block;background:linear-gradient(135deg,#7b2ff7,#00d4ff);color:#fff;text-align:center;padding:1.1rem 2rem;border-radius:.875rem;font-size:1.1rem;font-weight:800;text-decoration:none;letter-spacing:.04em;margin-bottom:.8rem;transition:opacity .15s}
    .tp-cta:hover{opacity:.9}
    .tp-note{font-size:.8rem;color:#475569;text-align:center;margin-bottom:2.5rem}
    .tp-rivals{margin-bottom:2rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.07)}
    .tp-rlinks{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.7rem}
    .tp-rlink{color:#38bdf8;font-size:.875rem;text-decoration:none;background:rgba(56,189,248,.07);padding:.3rem .8rem;border-radius:999px;border:1px solid rgba(56,189,248,.15)}
    .tp-rlink:hover{background:rgba(56,189,248,.15)}
    .tp-footer{padding-top:1.2rem;border-top:1px solid rgba(255,255,255,.06);font-size:.78rem;color:#334155;text-align:center}
    .tp-footer a{color:#475569;text-decoration:none}.tp-footer a:hover{text-decoration:underline}
    @media(max-width:520px){.tp-badge{width:60px;height:60px}h1{font-size:1.4rem}}
  </style>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2BSP5YDS7N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-2BSP5YDS7N');</script>
</head>
<body><main class="tp">
  <a class="tp-back" href="/">← GolazoX · Football Time Machine</a>

  <div class="tp-hdr">
    ${badgeUrl ? `<img class="tp-badge" src="${badgeUrl}" alt="${esc(name)}" width="80" height="80" loading="eager"/>` : ''}
    <div>
      ${entry.group ? `<div class="tp-grp">${esc(entry.group.replace(/\p{Emoji_Presentation}/gu,'').trim())}</div>` : ''}
      <h1>${esc(name)}</h1>
      ${displayEra ? `<div class="tp-era">${esc(displayEra)}</div>` : ''}
    </div>
  </div>

  <p class="tp-intro">
    ${isEn
      ? `Explore the full historical squad of <strong>${esc(label)}</strong> and simulate matches against any team from any era. Our Monte Carlo engine uses real player stats, tactics and historical performance to decide the match. Free, no sign-up required.`
      : `Explora la plantilla histórica completa de <strong>${esc(label)}</strong> y simula partidos contra cualquier equipo de cualquier era. Nuestro motor Monte Carlo usa estadísticas reales de jugadores, tácticas y rendimiento histórico. Gratis, sin registro.`}
  </p>

  ${allSeasons.length > 1 ? `
  <div>
    <div class="tp-sec">${isEn ? 'Available seasons' : 'Temporadas disponibles'}</div>
    <div class="tp-pills">
      ${allSeasons.map(s => `<a class="tp-pill${s === displayEra ? ' active' : ''}" href="/${routePrefix}/${slug}:${s}">${esc(s)}</a>`).join('')}
    </div>
  </div>` : ''}

  ${players.length ? `
  <div class="tp-roster">
    <div class="tp-sec">${isEn ? `${esc(label)} lineup` : `Alineación · ${esc(label)}`}</div>
    ${players.map(p => `<div class="tp-row"><span class="tp-pname">${esc(p.name)}</span><span class="tp-pos">${esc(p.position)}</span></div>`).join('')}
  </div>` : ''}

  <a class="tp-cta" href="${deepLink}">⚽ ${isEn ? `Simulate ${esc(label)} now` : `Simular ${esc(label)} ahora`}</a>
  <p class="tp-note">${isEn ? 'Monte Carlo Engine · 500+ historical squads · Result in seconds' : 'Motor Monte Carlo · +500 plantillas históricas · Resultado en segundos'}</p>

  ${rivals.length ? `
  <div class="tp-rivals">
    <div class="tp-sec">${isEn ? 'Simulate against legendary rivals' : 'Simular contra rivales legendarios'}</div>
    <div class="tp-rlinks">
      ${rivals.map(r => `<a class="tp-rlink" href="/${matchPrefix}/${encodeURIComponent(displayEra ? slug+':'+displayEra : slug)}-vs-${encodeURIComponent(r.slug)}">${esc(label)} vs ${esc(r.name)}</a>`).join('')}
    </div>
  </div>` : ''}

  <div class="tp-footer">
    <a href="/">GolazoX</a> · <a href="/legal">${isEn ? 'Legal Notice' : 'Aviso Legal'}</a> · <a href="/privacy">${isEn ? 'Privacy' : 'Privacidad'}</a>
    · ${isEn ? 'Historical football simulator · Not affiliated with FIFA, UEFA or any club' : 'Simulador de fútbol histórico · Sin afiliación con FIFA, UEFA ni clubes'}
  </div>
</main></body></html>`;
};

app.get('/equipo/:slug', async (req, res) => {
  const _routeSiteUrl = SITE_URL.replace(/\/$/, '');
  const raw = req.params.slug || '-';
  const ci  = raw.indexOf(':');
  const slug = ci === -1 ? raw : raw.slice(0, ci);
  const era  = ci === -1 ? '' : raw.slice(ci + 1);
  if (!/^[a-z0-9-]+$/i.test(slug) || (era && !/^[a-z0-9-]+$/i.test(era))) return res.status(404).send('Not Found');
  const entry = CATALOG.find(c => c.slug === slug);
  if (!entry) return res.status(404).send('Not Found');
  try {
    const squadData = await _loadSquad(slug);
    res.set('Cache-Control', 'public, max-age=3600').type('text/html')
       .send(_buildTeamPage({ entry, slug, era, lang: 'es', siteUrl: _routeSiteUrl, squadData }));
  } catch (err) {
    console.error('[/equipo/] SSR error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/team/:slug', async (req, res) => {
  const _routeSiteUrl = SITE_URL.replace(/\/$/, '');
  const raw = req.params.slug || '-';
  const ci  = raw.indexOf(':');
  const slug = ci === -1 ? raw : raw.slice(0, ci);
  const era  = ci === -1 ? '' : raw.slice(ci + 1);
  if (!/^[a-z0-9-]+$/i.test(slug) || (era && !/^[a-z0-9-]+$/i.test(era))) return res.status(404).send('Not Found');
  const entry = CATALOG.find(c => c.slug === slug);
  if (!entry) return res.status(404).send('Not Found');
  try {
    const squadData = await _loadSquad(slug);
    res.set('Cache-Control', 'public, max-age=3600').type('text/html')
       .send(_buildTeamPage({ entry, slug, era, lang: 'en', siteUrl: _routeSiteUrl, squadData }));
  } catch (err) {
    console.error('[/team/] SSR error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Fuentes auto-alojadas: cache inmutable 1 año
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), {
  maxAge: '1y',
  immutable: true,
}));

// Imágenes de árbitros y estadios — nunca cachear (se pueden sustituir en cualquier momento)
app.use('/img/referees', (req, res, next) => {
  const accepts = req.headers['accept'] || '-';
  if (accepts.includes('image/webp') && /\.(jpg|jpeg|png)$/i.test(req.path)) {
    const webpFile = req.path.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    const webpPath = path.join(__dirname, 'public', 'img', 'referees', webpFile);
    if (fs.existsSync(webpPath)) {
      return res.set('Cache-Control', 'public, max-age=31536000, immutable')
                .set('Content-Type', 'image/webp')
                .sendFile(webpPath);
    }
  }
  next();
}, express.static(path.join(__dirname, 'public', 'img', 'referees'), {
  maxAge: '7d',
  setHeaders: (res) => res.set('Cache-Control', 'public, max-age=604800'),
}));
app.use('/img/stadiums', (req, res, next) => {
  const accepts = req.headers['accept'] || '-';
  if (accepts.includes('image/webp') && /\.(jpg|jpeg|png)$/i.test(req.path)) {
    const webpFile = req.path.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    const webpPath = path.join(__dirname, 'public', 'img', 'stadiums', webpFile);
    if (fs.existsSync(webpPath)) {
      return res.set('Cache-Control', 'public, max-age=31536000, immutable')
                .set('Content-Type', 'image/webp')
                .sendFile(webpPath);
    }
  }
  next();
}, express.static(path.join(__dirname, 'public', 'img', 'stadiums'), {
  maxAge: '7d',
  setHeaders: (res) => res.set('Cache-Control', 'public, max-age=604800'),
}));

// Service Worker — must be served from the root scope with the correct header
// so it can intercept all requests under '/'.
// The Service-Worker-Allowed header grants it scope beyond its script directory.
app.get('/sw.js', (_req, res) => {
  res.set('Service-Worker-Allowed', '/');
  res.set('Cache-Control', 'no-cache');  // SW must always re-validate
  res.set('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Versioned assets (app.js?v=N, style.css?v=N) — serve minified in production.
const IS_PROD = process.env.NODE_ENV === 'production';
app.get('/app.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Content-Type', 'application/javascript');
  const file = IS_PROD && fs.existsSync(path.join(__dirname, 'public', 'app.min.js'))
    ? 'app.min.js' : 'app.js';
  res.sendFile(path.join(__dirname, 'public', file));
});
app.get('/style.css', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Content-Type', 'text/css');
  const file = IS_PROD && fs.existsSync(path.join(__dirname, 'public', 'style.min.css'))
    ? 'style.min.css' : 'style.css';
  res.sendFile(path.join(__dirname, 'public', file));
});

// Badge images — serve WebP when available and browser accepts it (transparent format negotiation)
app.use('/img/badges', (req, res, next) => {
  const accepts = req.headers['accept'] || '-';
  if (accepts.includes('image/webp') && /\.(png|jpg)$/i.test(req.path)) {
    const webpPath = path.join(__dirname, 'public', 'img', 'badges', req.path.replace(/\.(png|jpg)$/i, '.webp'));
    if (fs.existsSync(webpPath)) {
      return res.set('Cache-Control', 'public, max-age=31536000, immutable')
                .set('Content-Type', 'image/webp')
                .sendFile(webpPath);
    }
  }
  next();
}, express.static(path.join(__dirname, 'public', 'img', 'badges'), {
  maxAge: '30d',
  setHeaders: (res) => res.set('Cache-Control', 'public, max-age=2592000'),
}));

// Long-cache for any request with ?v= (versioned static assets — safe to cache 1 year)
app.use((req, res, next) => {
  if (req.query.v && /\.(js|css|woff2?|png|webp|jpg|svg|ico)$/.test(req.path)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// -- Flag proxy — caches country flags locally from flagcdn.com ----------------
// Subdivision codes not supported by flagcdn ? map to closest alternative
const _FLAG_ISO_MAP = {
  'gb-eng': 'gb',       // England → UK flag
  'gb-sct': 'gb-sct',   // Scotland → Saltire (served from local public/img/flags/gb-sct.png)
  'gb-wls': 'gb-wls',   // Wales → Welsh dragon (flagcdn supports gb-wls)
  'gb-nir': 'gb-nir',   // Northern Ireland → Ulster Banner (flagcdn supports gb-nir)
};
const _flagCache = new Map();
app.get('/flag/:iso', async (req, res) => {
  const rawIso = req.params.iso.replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 8);
  if (!rawIso) return res.status(400).end();
  // Check local override image first (e.g. historical nations: su, yu)
  const localFlagPath = path.join(__dirname, 'public', 'img', 'flags', `${rawIso}.png`);
  if (fs.existsSync(localFlagPath)) {
    return res.set('Content-Type', 'image/png')
              .set('Cache-Control', 'public, max-age=604800')
              .sendFile(localFlagPath);
  }
  const iso = _FLAG_ISO_MAP[rawIso] || rawIso.slice(0, 3);
  if (_flagCache.has(iso)) {
    const cached = _flagCache.get(iso);
    return res.set('Content-Type', cached.type)
              .set('Cache-Control', 'public, max-age=604800')
              .send(cached.data);
  }
  try {
    const upstream = await fetch(`https://flagcdn.com/w40/${iso}.png`);
    if (!upstream.ok) return res.status(404).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    _flagCache.set(iso, { data: buf, type: 'image/png' });
    res.set('Content-Type', 'image/png')
       .set('Cache-Control', 'public, max-age=604800')
       .send(buf);
  } catch { res.status(502).end(); }
});

// Serve generated videos for Meta (Instagram/Facebook) API which requires a public URL
app.use('/videos', express.static(path.join(__dirname, 'videos'), {
  maxAge: '1h',
  setHeaders: (res) => { res.set('Access-Control-Allow-Origin', '*'); },
}));

// -- Club badge proxy — caches Transfermarkt club crests locally --------------
// The /fichajes page references badges as same-origin /tmbadge/:id so they pass
// the strict img-src 'self' CSP. Upstream images are cached in memory; clients
// cache 7 days via Cache-Control.
const _tmBadgeCache = new Map();
app.get('/tmbadge/:id', async (req, res) => {
  const id = String(req.params.id).replace(/\D/g, '').slice(0, 10);
  if (!id) return res.status(400).end();
  if (_tmBadgeCache.has(id)) {
    return res.set('Content-Type', 'image/png')
              .set('Cache-Control', 'public, max-age=604800')
              .send(_tmBadgeCache.get(id));
  }
  try {
    const up = await fetch(`https://tmssl.akamaized.net/images/wappen/head/${id}.png`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.transfermarkt.es/' },
    });
    if (!up.ok) return res.status(404).end();
    const buf = Buffer.from(await up.arrayBuffer());
    if (_tmBadgeCache.size > 2000) _tmBadgeCache.clear(); // simple bound
    _tmBadgeCache.set(id, buf);
    res.set('Content-Type', 'image/png')
       .set('Cache-Control', 'public, max-age=604800')
       .send(buf);
  } catch { res.status(502).end(); }
});

// -- News image proxy — same-origin thumbnails for RSS items ------------------
// External media is blocked by the strict img-src 'self' CSP, so news images are
// referenced as /newsimg?u=<url>. Only whitelisted hosts are fetched (anti-SSRF).
const _newsImgCache = new Map();
app.get('/newsimg', async (req, res) => {
  const raw = String(req.query.u || '');
  let url;
  try { url = new URL(raw); } catch { return res.status(400).end(); }
  if (url.protocol !== 'https:') return res.status(400).end();
  const host = url.hostname;
  const ok = (IMG_HOSTS || []).some(h => host === h || host.endsWith('.' + h) || host.includes(h));
  if (!ok) return res.status(403).end();

  const key = url.href;
  const cached = _newsImgCache.get(key);
  if (cached) {
    return res.set('Content-Type', cached.type)
              .set('Cache-Control', 'public, max-age=86400')
              .send(cached.buf);
  }
  try {
    const up = await fetch(url.href, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
    });
    if (!up.ok) return res.status(404).end();
    const type = up.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//i.test(type)) return res.status(415).end();
    const buf = Buffer.from(await up.arrayBuffer());
    if (buf.length > 3_000_000) return res.status(413).end();
    if (_newsImgCache.size > 400) _newsImgCache.clear(); // simple bound
    _newsImgCache.set(key, { buf, type });
    res.set('Content-Type', type)
       .set('Cache-Control', 'public, max-age=86400')
       .send(buf);
  } catch { res.status(502).end(); }
});
app.get('/player_ratings.min.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('application/javascript');
  const f = require('fs').existsSync(require('path').join(__dirname,'public','player_ratings.min.js')) ? require('path').join(__dirname,'public','player_ratings.min.js') : require('path').join(__dirname,'player_ratings.js');
  res.sendFile(f);
});
app.get('/player_ratings.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'player_ratings.js'));
});

// -- Config endpoint: injects site URL into the frontend ----------------------
// Loaded as /config.js — exposes only safe, non-secret config to the client.
app.get('/config.js', (_req, res) => {
  const safeUrl = SITE_URL.replace(/[\\"'<>]/g, '');
  res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').send(
    `window.GOLAZOX_CONFIG=${JSON.stringify({ siteUrl: safeUrl, version: '2.0' })};`
  );
});

// ── GX Ranking: El Muro de la Fama ────────────────────────────────────────────
// Archivo de datos: data/gx_leaderboard.json
// Formato: { "2026-W16": [ { name, score, level, country, flag, ts }, ... ] }
// Se autolimpia manteniendo solo las últimas 8 semanas.
// Reset: automático por clave de semana ISO — no necesita cron.
const GX_LB_FILE  = path.join(__dirname, 'data', 'gx_leaderboard.json');
const GX_GLOBAL_FILE = path.join(__dirname, 'data', 'gx_global_lb.json');
const GX_SALT     = process.env.GX_SALT || 'golazox_2026_xp';
const GX_MAX_PER_WEEK  = 1000;
const GX_MAX_NAME_LEN  = 28;
const GX_MAX_SCORE     = 9_999_999;
// Rate limiters específicos para GX (definidos inline para no depender de _rl)
const _gxRlRead  = rateLimit({ windowMs: 60000, max: 20, standardHeaders: 'draft-6', legacyHeaders: false, keyGenerator: ipKeyGenerator, message: { error: 'Too many requests' } });
const _gxRlWrite = rateLimit({ windowMs: 60000, max: 10, standardHeaders: 'draft-6', legacyHeaders: false, keyGenerator: ipKeyGenerator, message: { error: 'Too many requests' } });
const _gxRlGeo   = rateLimit({ windowMs: 60000, max: 5,  standardHeaders: 'draft-6', legacyHeaders: false, keyGenerator: ipKeyGenerator, message: { error: 'Too many requests' } });

function _gxWeekKey(d) {
  // ISO week number (lunes = inicio de semana)
  const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = day.getUTCDay() || 7; // 1(Lun)…7(Dom)
  day.setUTCDate(day.getUTCDate() + 4 - dow);
  const jan4 = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
  const wk   = 1 + Math.round(((day - jan4) / 86400000 - 3 + ((jan4.getUTCDay() || 7) - 1)) / 7);
  return `${day.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function _gxHash(name, score, level, weekKey) {
  // FNV-1a 32-bit sobre el string combinado + salt — sin deps externos
  const str = `${name}:${score}:${level}:${weekKey}:${GX_SALT}`;
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

function _gxLoadLB() {
  try {
    if (!fs.existsSync(GX_LB_FILE)) return {};
    return JSON.parse(fs.readFileSync(GX_LB_FILE, 'utf8'));
  } catch (_) { return {}; }
}

function _gxSaveLB(data) {
  try {
    // Mantener solo las últimas 8 semanas (evitar crecimiento infinito)
    const keys = Object.keys(data).sort().reverse();
    const pruned = {};
    keys.slice(0, 8).forEach(k => { pruned[k] = data[k]; });
    fs.writeFileSync(GX_LB_FILE, JSON.stringify(pruned), 'utf8');
  } catch (_) {}
}

function _gxLoadGlobal() {
  try {
    if (!fs.existsSync(GX_GLOBAL_FILE)) return [];
    return JSON.parse(fs.readFileSync(GX_GLOBAL_FILE, 'utf8'));
  } catch (_) { return []; }
}

function _gxSaveGlobal(entries) {
  try {
    fs.writeFileSync(GX_GLOBAL_FILE, JSON.stringify(entries.slice(0, 2000)), 'utf8');
  } catch (_) {}
}

// GET /gx/check-name?name=xxx — comprueba si un nombre ya existe en el ranking global
app.get('/gx/check-name', _gxRlRead, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const name = String(req.query.name || '').trim().slice(0, 28);
  if (name.length < 3) return res.json({ taken: false });
  const global = _gxLoadGlobal();
  const taken  = global.some(e => e.name === name);
  res.json({ taken });
});

// GET /gx/leaderboard?week=current|prev&type=weekly|global
app.get('/gx/leaderboard', _gxRlRead, (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.query.type === 'global') {
    const entries = _gxLoadGlobal().slice(0, 20);
    return res.json({ type: 'global', entries, total: entries.length });
  }
  const lb      = _gxLoadLB();
  const now     = new Date();
  const wkKey   = req.query.week === 'prev'
    ? _gxWeekKey(new Date(now - 7 * 86400000))
    : _gxWeekKey(now);
  const entries = (lb[wkKey] || []).slice(0, 20);
  res.json({ week: wkKey, entries, total: entries.length });
});

// POST /gx/score
// Body: { name, score, level, country, flag, hash }
const _gxCheckJson = (req, res, next) => { const ct = req.headers['content-type'] || ''; return ct.includes('application/json') ? next() : res.status(415).json({ error: 'Content-Type must be application/json' }); };
app.post('/gx/score', _gxRlWrite, express.json({ limit: '2kb' }), _gxCheckJson, (req, res) => {
  try {
    const { name, score, level, country, flag, hash, xp: rawXp, hashGlobal } = req.body || {};

    // Validación
    if (typeof name !== 'string' || typeof score !== 'number' || typeof level !== 'number') {
      return res.status(400).json({ error: 'invalid payload' });
    }
    const safeName  = String(name).replace(/[<>&"']/g, '').trim().slice(0, GX_MAX_NAME_LEN);
    const safeScore = Math.min(Math.max(0, Math.floor(score)), GX_MAX_SCORE);
    const safeLevel = Math.min(Math.max(1, Math.floor(level)), 12);
    const safeCountry = String(country || '').replace(/[^A-Z]/g, '').slice(0, 2).toUpperCase();
    const safeFlag  = String(flag || '').replace(/[^🌍-🌏🇦-🇿]/gu, '').slice(0, 4);

    if (safeName.length < 3) return res.status(400).json({ error: 'name too short' });

    // Verificación del hash anti-spoofing
    const wkKey   = _gxWeekKey(new Date());
    const expect  = _gxHash(safeName, safeScore, safeLevel, wkKey);
    if (hash !== expect) {
      console.warn(`[gx:score] hash mismatch IP=${req.ip} name="${safeName}"`);
      return res.status(403).json({ error: 'invalid hash' });
    }

    const lb = _gxLoadLB();
    if (!lb[wkKey]) lb[wkKey] = [];

    // Upsert: si el mismo nombre ya existe esta semana, actualizar solo si el score es mayor
    const idx = lb[wkKey].findIndex(e => e.name === safeName);
    if (idx >= 0) {
      if (safeScore > lb[wkKey][idx].score) {
        lb[wkKey][idx].score = safeScore;
        lb[wkKey][idx].level = safeLevel;
        lb[wkKey][idx].ts    = Date.now();
        if (safeCountry) lb[wkKey][idx].country = safeCountry;
        if (safeFlag)    lb[wkKey][idx].flag    = safeFlag;
      }
    } else {
      if (lb[wkKey].length < GX_MAX_PER_WEEK) {
        lb[wkKey].push({ name: safeName, score: safeScore, level: safeLevel, country: safeCountry, flag: safeFlag, ts: Date.now() });
      }
    }

    // Ordenar por score desc
    lb[wkKey].sort((a, b) => b.score - a.score);

    _gxSaveLB(lb);

    // Global leaderboard update (based on total XP, never resets)
    let globalRank = null;
    if (typeof rawXp === 'number' && typeof hashGlobal === 'string') {
      const safeXp = Math.min(Math.max(0, Math.floor(rawXp)), GX_MAX_SCORE);
      const expectG = _gxHash(safeName, safeXp, safeLevel, 'global');
      if (hashGlobal === expectG) {
        const global = _gxLoadGlobal();
        const gIdx = global.findIndex(e => e.name === safeName);
        if (gIdx >= 0) {
          if (safeXp >= (global[gIdx].xp || 0)) {
            global[gIdx] = { name: safeName, xp: safeXp, level: safeLevel, country: safeCountry, flag: safeFlag, ts: Date.now() };
          }
        } else if (global.length < 2000) {
          global.push({ name: safeName, xp: safeXp, level: safeLevel, country: safeCountry, flag: safeFlag, ts: Date.now() });
        }
        global.sort((a, b) => b.xp - a.xp);
        _gxSaveGlobal(global);
        globalRank = global.findIndex(e => e.name === safeName) + 1;
      }
    }

    // Devuelve posición del usuario
    const pos = lb[wkKey].findIndex(e => e.name === safeName) + 1;
    const resp = { ok: true, week: wkKey, rank: pos, total: lb[wkKey].length };
    if (globalRank) resp.globalRank = globalRank;
    res.json(resp);
  } catch (err) {
    console.error('[gx:score]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET /gx/country — detección de país del usuario por IP + Accept-Language fallback
app.get('/gx/country', _gxRlGeo, (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Cloudflare expone CF-IPCountry (2-letter ISO). Si no, usar Accept-Language como señal.
  const cfCountry = req.headers['cf-ipcountry'];
  if (cfCountry && /^[A-Z]{2}$/.test(cfCountry) && cfCountry !== 'T1') {
    return res.json({ country: cfCountry, source: 'cf' });
  }
  // Accept-Language: "es-ES,es;q=0.9,en;q=0.8" → primary language locale
  const al  = String(req.headers['accept-language'] || '');
  const m   = al.match(/^([a-z]{2})-([A-Z]{2})/);
  const country = m ? m[2] : '';
  res.json({ country, source: 'lang' });
});

// Per-endpoint rate limiters (sliding window, survives restarts via express-rate-limit)
const _rl = (max, windowMs) => rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-6',
  legacyHeaders:   false,
  message:         { error: 'Too many requests. Please wait.' },
  keyGenerator:    ipKeyGenerator,
});
const _rateLimit = _rl;  // alias — all call sites unchanged

// ----------------------------------------------------------------------------
// CAPA DE SEGURIDAD ANTI-DDOS / ANTI-SCRAPING / ANTI-BRUTEFORCE
// ----------------------------------------------------------------------------

// -- 1. Bloqueo de bots y clientes automatizados (API endpoints) ----------
// Regla: si el UA está vacío o coincide con herramientas CLI/scraping, devuelve
// 403. Los navegadores reales siempre envían un UA con "Mozilla/". Los crawlers
// SEO legítimos (Googlebot, Bingbot) nunca deberían llamar a los endpoints de
// la API, pero si lo hacen no se les bloquea para no romper indexación.
const _BLOCKED_UA_RE = /^(curl|wget|python[\s\-/]|scrapy|go-http-client|java\/|okhttp\/|axios\/|node-fetch|got\/|libwww|libcurl|perl\/|ruby\/|php\/|nikto|sqlmap|masscan|nmap|zgrab|nuclei[/ ]|dirbuster|gobuster|wfuzz|ffuf|hydra[/ ]|acunetix|nessus|burp|zap\/)/i;

const _apiBotBlock = (req, res, next) => {
  const ua = req.headers['user-agent'] || '-';
  if (!ua || _BLOCKED_UA_RE.test(ua)) {
    console.warn(`[security:bot] BLOCKED IP=${req.ip} UA="${ua.slice(0, 120)}" ${req.method} ${req.path}`);
    return res.status(403).set('Retry-After', '3600').json({ error: 'Forbidden' });
  }
  next();
};
// Sólo se aplica a los endpoints de datos — NO a ficheros estáticos ni HTML
app.use(['/simulate', '/simulate-bulk', '/lookup', '/catalog', '/suggest', '/referees'], _apiBotBlock);

// -- 2. Presupuesto global de peticiones: 200 req / 5 min por IP ----------
// Capa compartida para TODAS las rutas. Un usuario legítimo rara vez supera
// 40 req/min; un bot en paralelo lo satura en segundos.
// Si se supera: 429 con Retry-After. Se registra IP + ruta para análisis.
app.use(rateLimit({
  windowMs: 5 * 60 * 1000,   // ventana de 5 minutos
  max:      200,              // máximo acumulado entre TODOS los endpoints
  standardHeaders: 'draft-6',
  legacyHeaders:   false,
  message:         { error: 'Rate limit global. Espera unos minutos.' },
  keyGenerator:    ipKeyGenerator,
  handler: (req, res, _next, options) => {
    console.warn(`[security:global-rl] IP=${req.ip} ${req.method} ${req.path} ? HTTP 429`);
    res.status(options.statusCode)
       .set('Retry-After', String(Math.ceil(options.windowMs / 1000)))
       .json(options.message);
  },
}));

// -- 3. Slow-down progresivo en /simulate ---------------------------------
// Las primeras 3 simulaciones/min: sin demora (flujo normal de usuario).
// A partir de la 4ª: +1 s por llamada extra, máximo 6 s.
// Efecto: el usuario lo nota levemente; un script en bucle queda bloqueado
// esperando sin consumir tus créditos de hosting en cómputo intensivo.
const _simulateSlowDown = slowDown({
  windowMs:     60_000,   // ventana de 1 minuto
  delayAfter:   3,        // sin demora en las primeras 3 llamadas
  delayMs:      (used, req) => {
    const excess = used - req.slowDown.limit;   // req.slowDown.limit = delayAfter
    return Math.min(excess * 1000, 6000);       // +1 s por llamada, tope 6 s
  },
  keyGenerator: ipKeyGenerator,
  headers:      true,     // X-SlowDown-* headers para debug
});

// -- 4. Validación de Content-Type en /simulate ---------------------------
// Rechaza payloads que no sean JSON plano (bloquea formularios HTML y ataques
// de tipo content-type confusion que intentan bypassar parsers).
const _requireJSON = (req, res, next) => {
  const ct = req.headers['content-type'] || '-';
  if (!ct.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
};

// Whitelist of accepted formations (+ empty = auto)
const _VALID_FORMATIONS = new Set([
  '','4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2','4-5-1','4-1-4-1',
  '4-1-2-1-2','1-2-1','1-1-2','2-1-1','1-1','1-2','2-1','3-2','2-3',
]);

// -- GET /catalog ------------------------------
// Returns the full catalog of local teams + their available seasons.
// Cached for 5 min (re-run seed to update).
// Rate: 8/5min per IP (1.6/min) — it's a ~150 kB JSON payload with all 471 teams;
// a legitimate client loads it once at startup and caches it for 5 minutes.
app.get('/catalog', _rateLimit(8, 5 * 60000), (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.json(CATALOG);
});

// -- GET /catalog-groups -----------------------
// Diagnostic: returns each team's slug, group, and source (meta vs file).
// Publicly readable since /catalog already exposes group data.
app.get('/catalog-groups', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  const groups = {};
  for (const t of CATALOG) {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t.slug);
  }
  const summary = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([g, slugs]) => ({ group: g, count: slugs.length, teams: slugs }));
  res.json(summary);
});

// -- GET /suggest -----------------------------
// Query: ?q=bar  ? returns up to 15 matching {name, slug, badge} objects for autocomplete
// Rate: 40/min — fast autocomplete, pero con margen para que un bot necesite más.
app.get('/suggest', _rateLimit(40, 60000), (req, res) => {
  const q = String(req.query.q || '-').replace(/[<>]/g, '').trim().toLowerCase().slice(0, 40);
  const matches = q.length < 1
    ? CATALOG.slice(0, 20)
    : CATALOG.filter(t =>
        t.nameEn.toLowerCase().includes(q) ||
        t.nameEs.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q)
      ).slice(0, 15);
  const result = matches.map(t => {
    const nums = (t.seasons || []).filter(s => /^\d{4}$/.test(s));
    const latestSeason = nums.length
      ? String(nums.reduce((mx, s) => Math.max(mx, Number(s)), 0))
      : ((t.seasons || []).includes('all-time') ? 'all-time' : '');
    return {
      name:   t.nameEs || t.nameEn,
      nameEs: t.nameEs,
      nameEn: t.nameEn,
      slug:   t.slug,
      badge:  t.badge,
      latestSeason,
      seasons: nums.sort((a, b) => b - a),  // all year seasons, newest first
    };
  });
  res.set('Cache-Control', 'no-store');
  res.json(result);
});

// -- GET /badges -------------------------------
// Gallery page: returns all known teams with badges as HTML
app.get('/badges', _rateLimit(30, 60000), (_req, res) => {
  const rows = _allTeams.map(t =>
    `<div class="bg-card">`+
    `<img src="${_esc(t.badge)}" alt="" onerror="this.src='/img/badges/_placeholder.svg'">` +
    `<div class="bg-name">${_esc(t.name)}</div>`+
    `</div>`
  ).join('');
  res.set('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Badge Gallery</title>
<style>body{background:#0d1526;color:#e2e8f0;font-family:sans-serif;padding:1rem}
h1{color:#00d4ff;margin-bottom:1.2rem}input{background:#1a2236;color:#e2e8f0;border:1px solid #2d3f5e;border-radius:6px;padding:.4rem .8rem;font-size:.9rem;margin-bottom:1rem;width:280px}
.bg-grid{display:flex;flex-wrap:wrap;gap:10px}
.bg-card{background:#1a2236;border:1px solid #2d3f5e;border-radius:8px;width:90px;padding:10px 6px 8px;text-align:center;transition:border-color .15s}
.bg-card:hover{border-color:#00d4ff}
.bg-card img{width:56px;height:56px;object-fit:contain;display:block;margin:0 auto 6px}
.bg-name{font-size:.65rem;line-height:1.3;word-break:break-word;color:#94a3b8}
</style></head><body>
<h1>? Badge Gallery &nbsp;<small style="font-size:.7rem;color:#94a3b8">${_allTeams.length} equipos</small></h1>
<input id="f" placeholder="Filtrar…" oninput="document.querySelectorAll('.bg-card').forEach(c=>c.style.display=this.value&&!c.querySelector('.bg-name').textContent.toLowerCase().includes(this.value.toLowerCase())?'none':'')">
<div class="bg-grid">${rows}</div></body></html>`);
});

// -- GET /lookup ------------------------------
// Query: ?team=Arsenal&era=2004
// Returns live squad data from local DB or TheSportsDB API
// Rate: 15/min — cada lookup puede llegar a hacer una llamada externa; 15 es
// más que suficiente para uso interactivo y inhibe el harvesting automatizado.
app.get('/lookup', _rateLimit(15, 60000), async (req, res) => {
  try {
    const sanitise = (s) => String(s || '-').replace(/[<>]/g, '').trim().slice(0, 80);
    const team = sanitise(req.query.team);
    const era  = sanitise(req.query.era);

    if (!team) return res.status(400).json({ found: false, error: 'team param required' });

    const result  = await lookupTeam(team, era);

    // Team not found — return a helpful error distinguishing offline vs unknown
    if (!result.found) {
      const isOffline = process.env.OFFLINE_MODE === 'true';
      return res.status(404).json({
        found:   false,
        offline: isOffline,
        error:   isOffline
          ? `"${team}" no está en la base de datos local. Prueba con otro equipo o usa el buscador de sugerencias.`
          : `No se encontró "${team}". Comprueba el nombre o prueba otra temporada.`,
      });
    }

    const badgeUrl = result.badgeUrl ||
      await Promise.race([
        fetchTeamBadge(team),
        new Promise(r => setTimeout(() => r(null), 3000)),
      ]).catch(() => null);

    // Apply formation template so the frontend always receives a proper 11-man
    // lineup instead of the raw ~25-player squad stored in cache.
    let displayResult = result;
    if (result.found && result.players && result.players.length > 0) {
      const formationOverride = String(req.query.formation || '-').replace(/[^0-9\-]/g, '').trim();
      const lineup = buildLineupFromCache(result, formationOverride || '-');
      // Resolve to catalog display name (same as /simulate) so deriveRatings hint tokens match
      const slug         = _resolveTeamSlug(team);
      const catalogEntry = CATALOG.find(c => c.slug === slug);
      const displayName  = catalogEntry ? catalogEntry.nameEn : team;
      const computedRatings = deriveRatings(displayName, era, result.ratings);
      displayResult = { ...result, ...lineup, ratings: computedRatings };
    }
    res.set('Cache-Control', 'no-store');
    res.json({ ...displayResult, badgeUrl });
  } catch (err) {
    console.error('[/lookup error]', err.message);
    res.status(500).json({ found: false, error: 'Error al buscar el equipo. Inténtalo de nuevo.' });
  }
});

// -- POST /simulate ----------------------------
// Body: { teamA, teamB, eraA, eraB, formationA, formationB }
// Returns: { lineups, ratings, probabilities, finalScore, scorers, altScores, narrative }
// Rate: 10/min hard block + slow-down progresivo a partir de la 4ª llamada.
// Content-Type: application/json requerido (bloquea formularios y payloads raw).
app.post('/simulate', _requireJSON, _simulateSlowDown, _rateLimit(10, 60000), async (req, res) => {
  try {
    const { teamA, teamB, eraA = '', eraB = '', formationA = '', formationB = '', matchMode = '11v11', matchSalt = 0, lang: reqLang = 'es',
            refereeId = null, isFinal = false, weatherId = null,
            playersOverrideA = null, playersOverrideB = null } = req.body;

    if (!teamA || !teamB) {
      return res.status(400).json({ error: 'Both teamA and teamB are required.' });
    }

    // Sanitise inputs (max 80 chars each, strip HTML)
    const sanitise = (s) => String(s).replace(/[<>]/g, '').trim().slice(0, 80);
    const sanitiseFormation = (s) => {
      const f = String(s || '-').replace(/[^0-9\-]/g, '').trim();
      return _VALID_FORMATIONS.has(f) ? f : '';
    };

    const sTeamA = sanitise(teamA);
    const sTeamB = sanitise(teamB);
    const sEraA  = sanitise(eraA);
    const sEraB  = sanitise(eraB);

    // Resolve display name / slug to canonical catalog slug for reliable local-file lookup
    const lang    = reqLang === 'en' ? 'en' : 'es';
    const slugA   = _resolveTeamSlug(sTeamA);
    const slugB   = _resolveTeamSlug(sTeamB);
    // Localized display names for the match (from catalog if available, else use submitted value)
    const entryA  = _catalogNameMap.has(sTeamA.toLowerCase()) ? CATALOG.find(c => c.slug === slugA) : null;
    const entryB  = _catalogNameMap.has(sTeamB.toLowerCase()) ? CATALOG.find(c => c.slug === slugB) : null;
    const dispA   = entryA ? (lang === 'en' ? entryA.nameEn : entryA.nameEs) : sTeamA;
    const dispB   = entryB ? (lang === 'en' ? entryB.nameEn : entryB.nameEs) : sTeamB;

    // Fetch real lineups for both teams in parallel
    // Start badge fetches immediately (in parallel with team lookups)
    const mkBadgeRace = name => Promise.race([
      fetchTeamBadge(name),
      new Promise(r => setTimeout(() => r(null), 7000)),
    ]).catch(() => null);
    const badgeRaceA = mkBadgeRace(slugA);
    const badgeRaceB = mkBadgeRace(slugB);

    const [luA, luB] = await Promise.all([
      lookupTeam(slugA, sEraA),
      lookupTeam(slugB, sEraB),
    ]);

    // Reject simulation if either team was not found anywhere
    if (!luA.found) {
      return res.status(404).json({ error: `Equipo no encontrado: "${dispA}"${sEraA ? ' (' + sEraA + ')' : ''}. Prueba sin año o con el nombre en inglés.` });
    }
    if (!luB.found) {
      return res.status(404).json({ error: `Equipo no encontrado: "${dispB}"${sEraB ? ' (' + sEraB + ')' : ''}. Prueba sin año o con el nombre en inglés.` });
    }

    // Apply pre-match player overrides (from user substitutions in the pre-match screen).
    // Sanitise each player: strip HTML, limit name to 60 chars, validate position code.
    const VALID_POSITIONS = new Set(['GK','RB','CB','LB','DM','CM','RM','LM','AM','RW','LW','ST']);
    const sanitisePlayers = (arr) => {
      if (!Array.isArray(arr) || arr.length < 8) return null;
      const cleaned = arr.slice(0, 25).map(p => ({
        name:     String(p.name || '-').replace(/[<>]/g, '').trim().slice(0, 60),
        position: VALID_POSITIONS.has(String(p.position || '-').toUpperCase()) ? String(p.position).toUpperCase() : null,
      })).filter(p => p.name.length > 0 && p.position);
      return cleaned.length >= 8 ? cleaned : null;
    };
    const cleanOverrideA = sanitisePlayers(playersOverrideA);
    const cleanOverrideB = sanitisePlayers(playersOverrideB);
    if (cleanOverrideA) { luA.allPlayers = luA.players; luA.players = cleanOverrideA; }
    if (cleanOverrideB) { luB.allPlayers = luB.players; luB.players = cleanOverrideB; }

    const params = {
      teamA:      dispA,
      teamB:      dispB,
      eraA:       sEraA,
      eraB:       sEraB,
      formationA:    sanitiseFormation(formationA) || (luA.found ? luA.formation : ''),
      formationB:    sanitiseFormation(formationB) || (luB.found ? luB.formation : ''),
      cachedLineupA: luA.found ? luA : null,
      cachedLineupB: luB.found ? luB : null,
      matchMode:     ['11v11','5v5','3v3','penalties'].includes(matchMode) ? matchMode : '11v11',
      matchSalt:     (Math.trunc(Number(matchSalt || 0)) || 0) & 0x7fffffff,
      refereeId:     typeof refereeId === 'string' ? refereeId.slice(0, 32) : null,
      isFinal:       !!isFinal,
      weatherId:     typeof weatherId === 'string' ? weatherId.slice(0, 24) : null,
    };

    const [badgeA, badgeB] = await Promise.all([
      luA.badgeUrl ? Promise.resolve(luA.badgeUrl) : badgeRaceA,
      luB.badgeUrl ? Promise.resolve(luB.badgeUrl) : badgeRaceB,
    ]);

    const simResult = simulateMatch(params);
    // Annotate timeline with narratives in the language the client requested
    if (Array.isArray(simResult.timeline)) {
      describeTimeline(simResult.timeline, simResult.playStyle || {}, lang, params.matchSalt);
    }
    const result = { ...simResult, badgeA, badgeB };
    res.set('Cache-Control', 'no-store');
    res.json(result);

  } catch (err) {
    console.error('[/simulate error]', err.message);
    res.status(500).json({ error: 'Simulation failed. Check server logs.' });
  }
});

// -- POST /simulate-bulk ---------------------------------------------------
// Batch simulator for tournaments. Accepts up to 50 match pairs, returns
// minimal results (score + optional penalties) — no narrative, no badges.
// Rate limit: 3 calls per minute per IP (each call can have up to 50 matches).
app.post('/simulate-bulk', _requireJSON, _apiBotBlock, _rateLimit(3, 60000), async (req, res) => {
  try {
    const { matches, lang: reqLang = 'es' } = req.body;
    const lang = reqLang === 'en' ? 'en' : 'es';

    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ error: 'matches array required' });
    }
    if (matches.length > 50) {
      return res.status(400).json({ error: 'max 50 matches per bulk call' });
    }

    const sanitise = (s) => String(s || '-').replace(/[<>]/g, '').trim().slice(0, 80);

    // Build pairs and collect unique team lookup keys
    const _clampOvr = (v) => (v != null) ? Math.max(60, Math.min(99, Math.trunc(Number(v)) || 0)) || null : null;
    const teamPairs = matches.map((m, i) => ({
      slugA:    _resolveTeamSlug(sanitise(m.teamA)),
      slugB:    _resolveTeamSlug(sanitise(m.teamB)),
      eraA:     sanitise(m.eraA || '-'),
      eraB:     sanitise(m.eraB || '-'),
      salt:     (Math.trunc(Number(m.salt || i)) || 0) & 0x7fffffff,
      penalties: !!m.penalties,
      isFinal:  !!m.isFinal,
      ovrA:     _clampOvr(m.ovrA),
      ovrB:     _clampOvr(m.ovrB),
      homeAdvantage: !!m.homeAdvantage,
    }));

    // Resolve unique team lookups in parallel (shared cache)
    const teamCache = new Map();
    const lookupKey = (slug, era) => `${slug}::${era}`;
    const uniqueKeys = new Set();
    teamPairs.forEach(p => {
      uniqueKeys.add(lookupKey(p.slugA, p.eraA));
      uniqueKeys.add(lookupKey(p.slugB, p.eraB));
    });
    await Promise.all([...uniqueKeys].map(async key => {
      const sep = key.indexOf('::');
      const slug = key.slice(0, sep);
      const era  = key.slice(sep + 2);
      const r = await lookupTeam(slug, era).catch(() => ({ found: false }));
      teamCache.set(key, r);
    }));

    // Convert OVR scalar (60–99) → synthetic ATK/MID/DEF/GK for biasing deriveRatings.
    // The four offsets average to zero so avg(result) == ovr.
    const _ovrToRatings = (ovr) => ({
      attack:      Math.min(99, ovr + 3),
      midfield:    ovr,
      defense:     Math.max(60, ovr - 1),
      goalkeeping: Math.max(60, ovr - 2),
    });

    // Simulate each match (synchronous — no timeline/narrative needed)
    const results = teamPairs.map(pair => {
      const luA = teamCache.get(lookupKey(pair.slugA, pair.eraA)) || { found: false };
      const luB = teamCache.get(lookupKey(pair.slugB, pair.eraB)) || { found: false };
      if (!luA.found || !luB.found) return { scoreA: 0, scoreB: 0, penA: null, penB: null };

      const entryA = CATALOG.find(c => c.slug === pair.slugA);
      const entryB = CATALOG.find(c => c.slug === pair.slugB);
      const dispA  = entryA ? (lang === 'en' ? entryA.nameEn : entryA.nameEs) : pair.slugA;
      const dispB  = entryB ? (lang === 'en' ? entryB.nameEn : entryB.nameEs) : pair.slugB;

      // When tournament provides ovr values, patch the lineup's ratings to ensure
      // teams with higher overall strength generate proportionally more expected goals.
      const effLuA = pair.ovrA ? { ...luA, ratings: _ovrToRatings(pair.ovrA) } : luA;
      const effLuB = pair.ovrB ? { ...luB, ratings: _ovrToRatings(pair.ovrB) } : luB;

      const params = {
        teamA: dispA, teamB: dispB,
        eraA: pair.eraA, eraB: pair.eraB,
        formationA: effLuA.formation || '-', formationB: effLuB.formation || '-',
        cachedLineupA: effLuA, cachedLineupB: effLuB,
        matchMode: '11v11',
        matchSalt: pair.salt,
        refereeId: null, isFinal: pair.isFinal, weatherId: null,
        homeAdvantage: pair.homeAdvantage,
      };

      const sim = simulateMatch(params);
      const { teamA: scoreA, teamB: scoreB, scorersA, scorersB, penalties: penDetails } = sim.finalScore;
      const mom = sim.stats?.manOfMatch || null;
      let penA = null, penB = null;

      if (pair.penalties && scoreA === scoreB) {
        const penParams = { ...params, cachedLineupA: effLuA, cachedLineupB: effLuB };
        const pen = simulateMatch({ ...penParams, matchMode: 'penalties', matchSalt: (pair.salt + 37) & 0x7fffffff });
        penA = pen.finalScore.teamA;
        penB = pen.finalScore.teamB;
        if (penA === penB) { penA = 5; penB = 4; }  // guaranteed winner
      }

      return {
        scoreA, scoreB, penA, penB,
        scorersA: scorersA || [],
        scorersB: scorersB || [],
        mom: mom ? { name: mom.name, team: mom.team, reason: mom.reason } : null,
        stats: {
          possession: sim.stats?.possession || { teamA: 50, teamB: 50 },
          shots:      sim.stats?.shots      || { teamA: 0,  teamB: 0  },
          corners:    sim.stats?.corners    || { teamA: 0,  teamB: 0  },
          fouls:      sim.stats?.fouls      || { teamA: 0,  teamB: 0  },
          saves:      sim.stats?.saves      || { teamA: 0,  teamB: 0  },
        },
      };
    });

    res.set('Cache-Control', 'no-store').json(results);
  } catch (err) {
    console.error('[/simulate-bulk error]', err.message);
    res.status(500).json({ error: 'Bulk simulation failed.' });
  }
});

// -- GET /referees ---------------------------------------------------------
// Returns the full list of available referees (id, name, multipliers).
// Used by the client to populate the referee picker.
app.get('/referees', _rateLimit(30, 60000), (_req, res) => {
  res.json(REFEREES);
});

// Images are served as static files from public/img/ — no proxy needed.
// -- HTML escape helper (XSS prevention) -------------------
const _esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// -- Language helper — reads cookie or ?lang= param --------
const _lang = (req) => {
  const q = req.query && req.query.lang;
  if (q === 'en' || q === 'es') return q;
  const cookie = req.headers.cookie || '-';
  const m = cookie.match(/(?:^|;\s*)golazox_lang=([^;]+)/);
  if (m && (m[1] === 'en' || m[1] === 'es')) return m[1];
  return 'es';
};
// -- Páginas legales (LSSI-CE / RGPD) ---------------------
const LEGAL_HTML = (title, body) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} · GolazoX</title>
  <link rel="icon" type="image/png" href="/golazox-coin.png"/>
  <link rel="stylesheet" href="/style.css?v=21"/>
  <style>
    body { max-width: 760px; margin: 3rem auto; padding: 0 1.5rem; }
    h1 { font-size: 1.6rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.1rem; margin: 1.5rem 0 .5rem; color: rgba(255,255,255,.7); }
    p, li { font-size: .88rem; line-height: 1.7; color: rgba(255,255,255,.55); margin-bottom: .6rem; }
    a { color: #00d4ff; } a:hover { opacity: .75; }
    .back { display:inline-block; margin-top:2rem; font-size:.8rem; opacity:.5; }
  </style>
</head>
<body>${body}<a class="back" href="/">← Volver al simulador</a></body>
</html>`;

const OWNER_NAME  = process.env.OWNER_NAME  || 'Victor Vega Viyuela';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'info@golazox.com'; // NEVER rendered in HTML
const SITE_URL    = process.env.SITE_URL    || 'https://golazox.com';
const CONTACT_FILE = path.join(__dirname, 'contact_messages.json');

// -- Nodemailer transporter (optional — only active when EMAIL_PASS is set) --
// Set env vars in Hostinger panel:
//   EMAIL_USER = info@golazox.com
//   EMAIL_PASS = <password del buzón info@golazox.com en Hostinger>
//   EMAIL_HOST = mail.golazox.com  (o smtp.hostinger.com — ver panel Hostinger → Email → Configure)
//   EMAIL_PORT = 465  (SSL) o 587 (STARTTLS)
const _emailHost = process.env.EMAIL_HOST || 'smtp.hostinger.com';
const _emailPort = parseInt(process.env.EMAIL_PORT || '465', 10);
const _emailSecure = _emailPort === 465; // true = SSL, false = STARTTLS
const _mailer = (process.env.EMAIL_USER && process.env.EMAIL_PASS)
  ? nodemailer.createTransport({
      host:   _emailHost,
      port:   _emailPort,
      secure: _emailSecure,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    })
  : null;
if (_mailer) {
  _mailer.verify(err => {
    if (err) console.warn('[mail] SMTP verify failed:', err.message);
    else     console.log('[mail] SMTP ready ? will email', OWNER_EMAIL);
  });
} else {
  console.log('[mail] No EMAIL_USER/EMAIL_PASS set — contact messages saved to file only.');
}

async function _sendContactEmail({ name, email, subject, message }) {
  if (!_mailer) return;
  try {
    await _mailer.sendMail({
      from:    `"GolazoX Contact" <${process.env.EMAIL_USER}>`,
      to:      OWNER_EMAIL,
      replyTo: email,
      subject: `[GolazoX] ${subject || 'Nuevo mensaje de contacto'} — ${name}`,
      text:    `De: ${name} <${email}>\n\nAsunto: ${subject || '(sin asunto)'}\n\n${message}`,
      html:    `<p><strong>De:</strong> ${_esc(name)} &lt;${_esc(email)}&gt;</p>
                <p><strong>Asunto:</strong> ${_esc(subject || '(sin asunto)')}</p>
                <hr>
                <p style="white-space:pre-wrap">${_esc(message)}</p>`,
    });
    console.log(`[mail] Contact email sent for ${email}`);
  } catch (err) {
    console.error('[mail] Failed to send email:', err.message);
  }
}

app.get('/legal', (req, res) => {
  const lang = _lang(req);
  if (lang === 'en') {
    res.type('text/html').send(LEGAL_HTML('Legal Notice', `
    <h1>Legal Notice</h1>
    <p><strong>Site Owner:</strong> \"GolazoX — Football Time Machine\" is a non-commercial personal fan project.
    Owner: ${OWNER_NAME}. Contact: <a href=\"/contact?lang=en\">Contact form</a>.</p>
    <h2>Purpose and Nature of the Service</h2>
    <p>GolazoX is a probabilistic simulation engine for historical football teams, intended solely for entertainment
    purposes. It does not provide gambling services, official match predictions, or any official sports information.</p>
    <h2>Intellectual Property — Code and Design</h2>
    <p>The source code, design, and simulation logic are the property of the site owner and are published under a
    personal non-commercial licence. Team and player names are used in a purely referential and informational capacity,
    under the descriptive trademark use doctrine and the public-domain nature of professional athletes\' public activities.</p>
    <h2>Third-Party Trademarks and Badges</h2>
    <p>The logos and visual identifiers of clubs and national teams displayed on this site are registered trademarks
    of their respective owners (clubs, national federations, UEFA, FIFA, and equivalent bodies). Their use is strictly
    limited to the referential identification of the simulated teams in a non-commercial, entertainment and educational
    context. This does not imply affiliation, sponsorship, endorsement, or association with any of those trademark holders.</p>
    <p>If you are the owner of any of these trademarks and consider their use inappropriate, please contact us via the
    <a href=\"/contact?lang=en\">contact form</a> and we will address your request as soon as possible.</p>
    <h2>Data Sources</h2>
    <p>Historical squad data is sourced from publicly accessible sources. None of these sources constitute official
    data from clubs or federations.</p>
    <h2>Disclaimer</h2>
    <p>Simulation results are fictional and randomly generated by a probabilistic model. They do not reflect real
    results and do not constitute predictions. The site owner is not responsible for any use made of the results
    or for the accuracy of historical data.</p>
    <h2>Applicable Law</h2>
    <p>This notice is governed by Spanish law (Law 34/2002 LSSI-CE) and applicable European regulations.</p>
  `, 'en'));
  } else {
  res.type('text/html').send(LEGAL_HTML('Aviso Legal', `
    <h1>Aviso Legal</h1>
    <p><strong>Identidad del titular:</strong> Este sitio web, \"GolazoX — Football Time Machine\", es un proyecto
    personal de carácter no comercial y sin ánimo de lucro. Titular: ${_esc(OWNER_NAME)}.
    Contacto: <a href=\"/contact\">Formulario de contacto</a>.</p>
    <h2>Objeto y naturaleza del servicio</h2>
    <p>GolazoX es un simulador probabilístico de partidos de fútbol históricos con fines exclusivamente lúdicos
    y de entretenimiento. No ofrece servicios de apuestas, predicciones deportivas ni información oficial.</p>
    <h2>Propiedad intelectual — código y diseño</h2>
    <p>El código fuente, diseño y lógica de simulación son propiedad del titular y se publican bajo licencia
    personal no comercial. Los nombres de equipos y jugadores se usan con carácter referencial e informativo
    bajo la doctrina de uso descriptivo de marcas y de figuras públicas en el ejercicio de su actividad profesional.</p>
    <h2>Marcas registradas y escudos de terceros</h2>
    <p>Los logotipos e identificadores visuales de clubes y selecciones nacionales mostrados en este sitio son
    marcas registradas de sus respectivos titulares (clubes, federaciones nacionales, UEFA, FIFA y organismos
    equivalentes). Su uso se limita exclusivamente a la identificación referencial de los equipos simulados
    en un contexto no comercial, lúdico y educativo, sin que ello implique afiliación, patrocinio, asociación
    ni respaldo por parte de ninguno de dichos titulares.</p>
    <p>Si eres titular de alguna de estas marcas y consideras que su uso no es adecuado, puedes contactarnos a través del
    <a href=\"/contact\">formulario de contacto</a> y atenderemos tu solicitud a la mayor brevedad posible.</p>
    <h2>Fuentes de datos</h2>
    <p>Los datos de plantillas históricas se obtienen de fuentes de acceso público. Ninguna de
    estas fuentes constituye datos oficiales de los clubes o federaciones.</p>
    <h2>Exclusión de responsabilidad</h2>
    <p>Los resultados del simulador son ficticios y generados aleatoriamente mediante un modelo probabilístico.
    No reflejan resultados reales ni constituyen predicciones. El titular no se responsabiliza del uso que los
    usuarios hagan de los resultados ni de la exactitud de los datos históricos.</p>
    <h2>Legislación aplicable</h2>
    <p>Este aviso se rige por la legislación española (Ley 34/2002 LSSI-CE) y la normativa europea aplicable.</p>
  `));
  }
});

// -- TikTok OAuth callback -----------------------------------------------------
app.get('/tiktok-callback', (req, res) => {
  const code  = req.query.code  || '-';
  const error = req.query.error || '-';
  if (error) {
    return res.type('text/html').send(`<h2 style="color:red;font-family:sans-serif">Error: ${_esc(error)}</h2>`);
  }
  res.type('text/html').send(`
    <html><head><title>TikTok Auth</title></head>
    <body style="font-family:sans-serif;max-width:600px;margin:60px auto;text-align:center">
      <h2 style="color:green">? TikTok autorizado</h2>
      <p>Copia este código y pégalo en el terminal:</p>
      <code style="display:block;background:#f0f0f0;padding:16px;font-size:14px;word-break:break-all;border-radius:8px">${_esc(code)}</code>
      <p style="margin-top:24px;color:#666">Luego ejecuta:<br>
      <code>node uploader.js --auth-exchange-tiktok PEGA_EL_CODIGO_AQUI</code></p>
    </body></html>
  `);
});

app.get('/privacy', (req, res) => {
  const lang = _lang(req);
  if (lang === 'en') {
    res.type('text/html').send(LEGAL_HTML('Privacy Policy', `
    <h1>Privacy Policy</h1>
    <p>Last updated: ${new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' })}</p>
    <h2>Data Controller</h2>
    <p>${_esc(OWNER_NAME)} — <a href="/contact?lang=en">Contact form</a></p>
    <h2>Data We Collect</h2>
    <p>GolazoX <strong>does not require registration</strong>, does not use tracking cookies, and does not actively
    collect personally identifiable information.</p>
    <h2>Local Storage</h2>
    <p>The application stores only the following in your browser's local storage:</p>
    <ul>
      <li><strong>golazox_lang</strong>: your preferred interface language (ES/EN). Contains no personal data.
      Is not transmitted to any server. Is deleted when you clear your browser data.</li>
    </ul>
    <h2>Server Logs</h2>
    <p>The hosting server may automatically log the IP address of requests for security and technical diagnostic
    purposes. These logs are retained for a maximum of 30 days and are not shared with third parties.</p>
    <h2>Cookies</h2>
    <p>This website <strong>does not use</strong> any first-party or third-party cookies for tracking or advertising.</p>
    <h2>External Data Sources</h2>
    <p>To retrieve historical squad data, the application may query publicly available APIs (no user key,
    no personal data from the visitor). These services have their own privacy policies.</p>
    <h2>Your Rights</h2>
    <p>As we do not process personally identifiable data, data access/rectification/erasure rights do not formally
    apply. For any query, use the <a href="/contact?lang=en">contact form</a>.</p>
    <h2>Changes to This Policy</h2>
    <p>Any changes will be published on this page with an updated date.</p>
  `, 'en'));
  } else {
  res.type('text/html').send(LEGAL_HTML('Política de Privacidad', `
    <h1>Política de Privacidad</h1>
    <p>Última actualización: ${new Date().toLocaleDateString('es-ES', { year:'numeric', month:'long', day:'numeric' })}</p>
    <h2>Responsable del tratamiento</h2>
    <p>${_esc(OWNER_NAME)} — <a href="/contact">Formulario de contacto</a></p>
    <h2>Datos que recopilamos</h2>
    <p>GolazoX <strong>no solicita registro</strong>, no usa cookies de seguimiento y no recopila datos personales
    identificativos de forma activa.</p>
    <h2>Almacenamiento local (localStorage)</h2>
    <p>La aplicación guarda en el almacenamiento local de tu navegador únicamente:</p>
    <ul>
      <li><strong>golazox_lang</strong>: idioma preferido de la interfaz (ES/EN). No contiene datos personales.
      No se transmite a ningún servidor. Se elimina al borrar los datos del navegador.</li>
    </ul>
    <h2>Registros del servidor (logs)</h2>
    <p>El servidor de alojamiento puede registrar automáticamente la dirección IP de las peticiones con fines
    de seguridad y diagnóstico técnico. Estos registros se conservan un máximo de 30 días y no se ceden a terceros.</p>
    <h2>Cookies</h2>
    <p>Este sitio web <strong>no utiliza cookies</strong> propias ni de terceros para seguimiento o publicidad.</p>
    <h2>Fuentes de datos externas</h2>
    <p>Para obtener datos de plantillas históricas, la aplicación puede consultar APIs públicas
    (sin clave de usuario, sin datos personales del visitante). Estas fuentes tienen sus propias políticas de privacidad.</p>
    <h2>Derechos del usuario</h2>
    <p>Dado que no tratamos datos personales identificativos, no aplica el ejercicio de derechos ARCO/ARCOPOL
    en sentido estricto. Para cualquier consulta: <a href="/contact">formulario de contacto</a>.</p>
    <h2>Cambios en esta política</h2>
    <p>Cualquier modificación se publicará en esta página con la fecha de actualización actualizada.</p>
  `));
  }
});

// -- Contact form ------------------------------------------------------------
const _contactLimit = _rateLimit(5, 10 * 60 * 1000); // 5 sends per 10 minutes

app.get('/contact', (req, res) => {
  const lang = _lang(req);
  const isEn = lang === 'en';
  res.type('text/html').send(LEGAL_HTML(isEn ? 'Contact' : 'Contacto', `
    <h1>${isEn ? 'Contact' : 'Contacto'}</h1>
    <p style="color:rgba(255,255,255,.55);font-size:.88rem">${isEn
      ? 'Use this form for any enquiry, takedown notice, or suggestion. Your email address will only be used to reply to you.'
      : 'Usa este formulario para cualquier consulta, aviso de derechos o sugerencia. Tu direcci\u00f3n de correo solo se usar\u00e1 para responderte.'}</p>
    <form method="POST" action="/contact${isEn ? '?lang=en' : ''}" style="display:flex;flex-direction:column;gap:.9rem;margin-top:1.5rem">
      <!-- Honeypot: bots fill this, humans don't see it -->
      <input name="url" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0;height:0;width:0" aria-hidden="true" />
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">${isEn ? 'Name' : 'Nombre'}
        <input name="name" required maxlength="120"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;box-sizing:border-box"/>
      </label>
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">Email
        <input name="email" type="email" required maxlength="120"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;box-sizing:border-box"/>
      </label>
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">${isEn ? 'Subject' : 'Asunto'}
        <input name="subject" maxlength="200"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;box-sizing:border-box"/>
      </label>
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">${isEn ? 'Message' : 'Mensaje'}
        <textarea name="message" required maxlength="2000" rows="6"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;resize:vertical;box-sizing:border-box"></textarea>
      </label>
      <button type="submit"
        style="align-self:flex-start;padding:.55rem 1.5rem;background:#00d4ff;color:#000;font-weight:700;
        border:none;border-radius:6px;cursor:pointer;font-size:.9rem">${isEn ? 'Send' : 'Enviar'}</button>
    </form>
  `, lang));
});

app.post('/contact', _contactLimit, express.urlencoded({ extended: false, limit: '8kb' }), (req, res) => {
  const lang    = _lang(req);
  const isEn    = lang === 'en';
  // Honeypot check: bots fill the hidden 'url' field, humans leave it empty
  const honeypot = String(req.body.url || '-').trim();
  if (honeypot.length > 0) {
    // Silent reject — return success to not hint to bots
    return res.type('text/html').send(LEGAL_HTML(lang === 'en' ? 'Message sent' : 'Mensaje enviado', `
      <h1>${lang === 'en' ? 'Message received ?' : 'Mensaje recibido ?'}</h1>
      <p><a href="/">${lang === 'en' ? 'Back to simulator' : 'Volver al simulador'}</a></p>`, lang));
  }
  const name    = String(req.body.name    || '-').slice(0, 120).trim();
  const email   = String(req.body.email   || '-').slice(0, 120).trim();
  const subject = String(req.body.subject || '-').slice(0, 200).trim();
  const message = String(req.body.message || '-').slice(0, 2000).trim();

  if (!name || !email || !message) {
    return res.status(400).type('text/html').send(LEGAL_HTML(isEn ? 'Error' : 'Error', `
      <h1>${isEn ? 'Missing fields' : 'Faltan campos'}</h1>
      <p>${isEn ? 'Please fill in name, email and message.' : 'Por favor, rellena nombre, email y mensaje.'}
      <a href="/contact${isEn ? '?lang=en' : ''}">${isEn ? 'Back to form' : 'Volver al formulario'}</a>.</p>`, lang));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).type('text/html').send(LEGAL_HTML(isEn ? 'Error' : 'Error', `
      <h1>${isEn ? 'Invalid email' : 'Email no válido'}</h1>
      <p><a href="/contact${isEn ? '?lang=en' : ''}">${isEn ? 'Back to form' : 'Volver al formulario'}</a>.</p>`, lang));
  }

  const entry = { ts: new Date().toISOString(), name, email, subject, message };
  try {
    let messages = [];
    if (fs.existsSync(CONTACT_FILE)) {
      try { messages = JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8')); } catch (_) {}
    }
    // Cap to 1000 messages to prevent disk exhaustion
    if (messages.length >= 1000) messages = messages.slice(-999);
    messages.push(entry);
    fs.writeFileSync(CONTACT_FILE, JSON.stringify(messages, null, 2), 'utf8');
  } catch (err) {
    console.error('[contact] Error saving message:', err.message);
  }
  console.log(`[contact] New message from ${name} <${email}>`);
  _sendContactEmail({ name, email, subject, message }); // fire-and-forget

  res.type('text/html').send(LEGAL_HTML(isEn ? 'Message sent' : 'Mensaje enviado', `
    <h1>${isEn ? 'Message received \u2713' : 'Mensaje recibido \u2713'}</h1>
    <p>${isEn
      ? `Thank you, ${_esc(name)}. We have received your message and will reply to <strong>${_esc(email)}</strong> as soon as possible.`
      : `Gracias, ${_esc(name)}. Hemos recibido tu mensaje y te responderemos a <strong>${_esc(email)}</strong> a la mayor brevedad posible.`}</p>
    <p><a href="/">${isEn ? 'Back to simulator' : 'Volver al simulador'}</a></p>
  `, lang));
});

// -- Serve index.html for all other routes -----
// Always serve with explicit charset=utf-8 to prevent the em-dash encoding
// corruption seen in GA (garbled bytes instead of "—").
// Bots probing unknown paths (/cmd_sco, /wp-admin…) get a 404 status so
// Google doesn't index phantom pages, but still receive the SPA HTML.
// -- Subscribers storage: MySQL (primary) + JSON fallback -----------------
// MySQL config: set DB_HOST, DB_USER, DB_PASS, DB_NAME in .env to activate.
// JSON fallback always stays in sync so you can read it without DB access.
//
// Hostinger cPanel: Databases ? MySQL Databases ? create DB + user.
// Then add to .env:  DB_HOST=127.0.0.1  DB_USER=u123_golazox
//                    DB_PASS=<password>  DB_NAME=u123_golazox
const SUBS_FILE = path.join(__dirname, 'subscribers.json');

// Attempt to load mysql2 — package is optional (npm install mysql2 on server)
let _db = null;
(async () => {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) return;
  try {
    const mysql = require('mysql2/promise');
    _db = await mysql.createPool({
      host: process.env.DB_HOST, user: process.env.DB_USER,
      password: process.env.DB_PASS, database: process.env.DB_NAME,
      waitForConnections: true, connectionLimit: 5, queueLimit: 0,
    });
    // Create table if missing
    await _db.execute(`CREATE TABLE IF NOT EXISTS subscribers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      ts DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('[db] MySQL subscribers table ready');
  } catch (e) {
    console.warn('[db] MySQL not available, using JSON fallback:', e.message);
    _db = null;
  }
})();

// -- Admin token for /admin/* endpoints ---------------------------------
// Set ADMIN_TOKEN=<random secret> in .env on the server.
// Access: GET /admin/subscribers?token=<ADMIN_TOKEN>
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

// -- POST /subscribe — Newsletter opt-in ----------------------------------
// Stores emails in MySQL + JSON. Rate: 5/hour per IP. Deduplicates.
const _subscribeLimit = _rl(5, 60 * 60000);
app.post('/subscribe', _requireJSON, _subscribeLimit, async (req, res) => {
  const email = String(req.body.email || '-').slice(0, 200).trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }
  try {
    let total = 0;
    let already = false;

    if (_db) {
      // -- MySQL path --------------------------------------------------
      try {
        await _db.execute('INSERT INTO subscribers (email) VALUES (?)', [email]);
        const [[{ cnt }]] = await _db.execute('SELECT COUNT(*) AS cnt FROM subscribers');
        total = Number(cnt);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') { already = true; total = 0; }
        else throw e;
      }
    } else {
      // -- JSON fallback -----------------------------------------------
      let subs = [];
      if (fs.existsSync(SUBS_FILE)) {
        try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (_) {}
      }
      if (subs.some(s => s.email === email)) { already = true; }
      else {
        if (subs.length >= 10000) subs = subs.slice(-9999);
        subs.push({ email, ts: new Date().toISOString() });
        fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
        total = subs.length;
      }
    }

    // Keep JSON file in sync with MySQL (best-effort)
    if (_db && !already) {
      try {
        const [rows] = await _db.execute('SELECT email, DATE_FORMAT(ts, "%Y-%m-%dT%TZ") as ts FROM subscribers ORDER BY id');
        fs.writeFileSync(SUBS_FILE, JSON.stringify(rows, null, 2), 'utf8');
      } catch (_) {}
    }

    if (!already) {
      console.log('[subscribe] ' + email + (total ? ' (total: ' + total + ')' : ''));
      if (_mailer) {
        _mailer.sendMail({
          from: '"GolazoX" <' + process.env.EMAIL_USER + '>',
          to: OWNER_EMAIL,
          subject: '[GolazoX] Nuevo suscriptor' + (total ? ' #' + total : ''),
          text: 'Email: ' + email + (total ? '\nTotal: ' + total : ''),
        }).catch(e => console.warn('[subscribe] notify:', e.message));
      }
    }
    res.json({ ok: true, already });
  } catch (err) {
    console.error('[subscribe]', err.message);
    res.status(500).json({ error: 'Error. Inténtalo de nuevo.' });
  }
});

// -- GET /admin/subscribers — Export CSV (token-protected) ----------------
// Usage: https://golazox.com/admin/subscribers?token=TU_TOKEN
// Returns CSV with all subscriber emails + signup dates, ready to import
// into Mailchimp, Brevo, Hostinger Email Campaigns, etc.
app.get('/admin/subscribers', async (req, res) => {
  const tok = String(req.query.token || '-').trim();
  if (!ADMIN_TOKEN || tok !== ADMIN_TOKEN) {
    return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'Unauthorized' });
  }
  try {
    let rows = [];
    if (_db) {
      const [r] = await _db.execute('SELECT email, DATE_FORMAT(ts, "%Y-%m-%dT%TZ") as ts FROM subscribers ORDER BY id');
      rows = r;
    } else if (fs.existsSync(SUBS_FILE)) {
      rows = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
    }
    const fmt = req.query.format === 'json' ? 'json' : 'csv';
    if (fmt === 'json') return res.json({ total: rows.length, subscribers: rows });
    const csv = ['Email,Fecha registro', ...rows.map(r => `${r.email},${r.ts || '-'}`)].join('\n');
    res.set('Content-Type', 'text/csv; charset=utf-8')
       .set('Content-Disposition', `attachment; filename="golazox-suscriptores-${new Date().toISOString().slice(0,10)}.csv"`)
       .send('\uFEFF' + csv); // BOM prefix ? Excel opens UTF-8 correctly
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -- GET /fichajes — Fichajes (Transfermarkt) + tablón de noticias (RSS) ------
// Datos de fichajes: club origen→destino con escudo, jugador, precio y tipo.
// Tablón: titulares agregados de medios (título + fuente + enlace).
// Todo se auto-actualiza vía caché en news.js (fichajes 30 min, noticias 15 min).
const _newsLimit = _rateLimit(60, 5 * 60 * 1000); // 60 vistas / 5 min por IP

const _timeAgo = (ms) => {
  if (!ms) return '';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)     return 'hace un momento';
  const m = Math.floor(s / 60);
  if (m < 60)     return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)     return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
};

// Formatea un importe en € a texto compacto (26 M €, 876 K €).
const _fmtFee = (v) => {
  if (!v) return '';
  if (v >= 1e6) return `${(v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',')} M €`;
  return `${Math.round(v / 1e3)} K €`;
};

// Color del badge de precio según tipo de operación.
const _feeStyle = (fee) => {
  if (fee.type === 'fee')  return 'background:rgba(16,185,129,.15);color:#10d98a;border-color:rgba(16,185,129,.35)';
  if (fee.type === 'loan') return 'background:rgba(0,212,255,.13);color:#00d4ff;border-color:rgba(0,212,255,.35)';
  if (fee.type === 'free') return 'background:rgba(251,191,36,.13);color:#fbbf24;border-color:rgba(251,191,36,.35)';
  return 'background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.15)';
};

const _badgeImg = (club) => club.badge
  ? `<img src="${_esc(club.badge)}" alt="" loading="lazy" width="34" height="34" style="width:34px;height:34px;object-fit:contain"/>`
  : `<span class="crest-fallback">${_esc((club.name || '?').slice(0, 1))}</span>`;

const _transferCardHTML = (t, rank) => `
  <article class="tcard${rank && rank <= 3 ? ' tcard-podium tcard-r' + rank : ''}" data-search="${_esc((t.player + ' ' + t.from.name + ' ' + t.to.name + ' ' + t.position).toLowerCase())}">
    ${rank ? `<span class="trank">${rank}</span>` : ''}
    <div class="tcard-head">
      <span class="tplayer">${_esc(t.player)}</span>
      <span class="tpos">${_esc(t.position)}${t.age ? ' · ' + _esc(t.age) : ''}</span>
    </div>
    <div class="tflow">
      <div class="tclub">${_badgeImg(t.from)}<span>${_esc(t.from.name)}</span></div>
      <span class="tarrow">→</span>
      <div class="tclub tclub-to">${_badgeImg(t.to)}<span>${_esc(t.to.name)}</span></div>
    </div>
    <div class="tfee" style="${_feeStyle(t.fee)}">${_esc(t.fee.label)}</div>
  </article>`;

// Barra de estadísticas del mercado con contadores animados.
const _statsHTML = (transfers) => {
  const list = transfers.list || [];
  const latest = transfers.latest || [];
  // Inversión y récord salen de los récords de la temporada (ordenados por importe).
  const paid = list.filter(t => t.fee.type === 'fee');
  const total = paid.reduce((s, t) => s + (t.fee.value || 0), 0);
  const record = list.length ? list[0].fee.value : 0;
  // Cesiones y libres pueden no estar entre los récords (importe 0): se cuentan
  // sobre el conjunto combinado (récords + recién cerrados), sin duplicar.
  const seen = new Set();
  const all = [];
  for (const t of [...list, ...latest]) {
    const key = (t.player + '|' + t.to.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(t);
  }
  const loans = all.filter(t => t.fee.type === 'loan').length;
  const free = all.filter(t => t.fee.type === 'free').length;
  const stat = (icon, val, label, cls) =>
    `<div class="stat"><span class="stat-ico">${icon}</span>
      <span class="stat-val ${cls}" data-count="${val}">0</span>
      <span class="stat-lbl">${label}</span></div>`;
  return `<section class="stats">
    ${stat('💰', total, 'Inversión top', 'is-money')}
    ${stat('🚀', record, 'Fichaje récord', 'is-money')}
    ${stat('🤝', loans, 'Cesiones', '')}
    ${stat('🆓', free, 'Libres', '')}
  </section>`;
};

const _chartHTML = (top) => {
  if (!top.length) return '';
  const max = top[0].fee.value || 1;
  const rows = top.map((t, i) => {
    const pct = Math.max(6, Math.round((t.fee.value / max) * 100));
    return `
    <div class="bar-row">
      <span class="bar-rank">${i + 1}</span>
      <span class="bar-label">${_esc(t.player)}<em>${_badgeImg(t.to)}${_esc(t.to.name)}</em></span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span class="bar-val">${_fmtFee(t.fee.value)}</span>
    </div>`;
  }).join('');
  return `<section class="chart-box">
    <div class="chart-head"><h2>🏆 Ranking por importe</h2><span class="chart-tag">Temporada actual</span></div>
    <div class="chart">${rows}</div>
  </section>`;
};

// Color de acento por medio para el tablón de noticias.
const _sourceColor = (src = '') => {
  const s = src.toLowerCase();
  if (s.includes('marca'))  return '#e3130b';
  if (s.includes('as'))     return '#1d6fd6';
  if (s.includes('sport'))  return '#e30613';
  if (s.includes('mundo'))  return '#00963f';
  return '#00d4ff';
};

// Tarjeta destacada (noticia más reciente, ocupa todo el ancho).
const _newsFeaturedHTML = (it) => {
  const c = _sourceColor(it.source);
  const img = it.image
    ? `<span class="news-hero-img"><img src="${_esc(it.image)}" alt="" loading="lazy"/></span>`
    : '';
  return `
  <a class="news-hero${it.image ? ' has-img' : ''}" data-source="${_esc((it.source || '').toLowerCase())}" style="--src:${c}" href="${_esc(it.link)}" target="_blank" rel="noopener nofollow">
    ${img}
    <span class="news-hero-body">
      <span class="news-chip" style="background:${c}">${_esc(it.source)}</span>
      <span class="news-hero-title">${_esc(it.title)}</span>
      <span class="news-hero-meta">${it.ts ? '🕒 ' + _timeAgo(it.ts) : ''} · Leer en ${_esc(it.source)} →</span>
    </span>
  </a>`;
};

const _newsItemHTML = (it) => {
  const c = _sourceColor(it.source);
  const img = it.image
    ? `<span class="news-thumb"><img src="${_esc(it.image)}" alt="" loading="lazy"/></span>`
    : '';
  return `
  <li class="news-item${it.image ? ' has-img' : ''}" data-source="${_esc((it.source || '').toLowerCase())}" style="--src:${c}">
    <a href="${_esc(it.link)}" target="_blank" rel="noopener nofollow">
      ${img}
      <span class="news-body">
        <span class="news-chip" style="background:${c}">${_esc(it.source)}</span>
        <span class="news-title">${_esc(it.title)}</span>
        <span class="news-meta">${it.ts ? _timeAgo(it.ts) : ''}</span>
      </span>
    </a>
  </li>`;
};

// Chips de filtro por medio (deriva las fuentes presentes en los items).
const _newsFilterHTML = (items) => {
  const sources = [...new Set(items.map(i => i.source).filter(Boolean))];
  if (sources.length < 2) return '';
  const chips = sources.map(s =>
    `<button class="nfilter" data-src="${_esc(s.toLowerCase())}" style="--src:${_sourceColor(s)}">${_esc(s)}</button>`
  ).join('');
  return `<div class="nfilters"><button class="nfilter active" data-src="">Todos</button>${chips}</div>`;
};

// Bloque de noticias: destacada + rejilla. `items` ya viene ordenado por fecha.
const _newsSectionHTML = (title, items, limit) => {
  if (!items.length) return '';
  const [head, ...rest] = items.slice(0, limit);
  return `<div class="news-group">
    <h2>${title}</h2>
    ${_newsFeaturedHTML(head)}
    ${rest.length ? `<ul class="news-list">${rest.map(_newsItemHTML).join('')}</ul>` : ''}
  </div>`;
};

// ── Sidebar persistente (mismo menú en todas las páginas) ──
const GX_SIDE_NAV = (active) => `
  <aside class="side-nav side-nav--fixed" aria-label="Secciones">
    <nav class="side-nav-inner">
      <a class="side-brand" href="/" aria-label="GolazoX — inicio">
        <span class="side-brand-mark"><span class="bx-go">GOLAZ</span><span class="bx-ox">OX</span></span>
      </a>
      <a class="side-link${active === 'sim' ? ' side-link-active' : ''}" href="/"${active === 'sim' ? ' aria-current="page"' : ''}>
        <span class="side-ico">⚽</span><span class="side-lbl">Simulador</span>
      </a>
      <div class="side-group-label">Explorar</div>
      <a class="side-link${active === 'standings' ? ' side-link-active' : ''}" href="/clasificaciones"${active === 'standings' ? ' aria-current="page"' : ''}>
        <span class="side-ico">📊</span><span class="side-lbl">Clasificaciones</span>
      </a>
      <a class="side-link${active === 'transfers' ? ' side-link-active' : ''}" href="/fichajes"${active === 'transfers' ? ' aria-current="page"' : ''}>
        <span class="side-ico">💸</span><span class="side-lbl">Fichajes</span>
      </a>
      <a class="side-link${active === 'news' ? ' side-link-active' : ''}" href="/noticias"${active === 'news' ? ' aria-current="page"' : ''}>
        <span class="side-ico">📰</span><span class="side-lbl">Noticias</span>
      </a>
    </nav>
  </aside>
  <script src="/gx-nav.js?v=1" defer></script>`;

const FICHAJES_HTML = (transfers, news, page = 'fichajes') => {
  const _base = SITE_URL.replace(/\/$/, '');
  const _isNews = page === 'noticias';
  const _url = _isNews ? `${_base}/noticias` : `${_base}/fichajes`;
  const _title = _isNews
    ? 'Noticias de fútbol hoy · última hora · GolazoX'
    : 'Fichajes de fútbol hoy · mercado y traspasos · GolazoX';
  const _desc = _isNews
    ? 'Noticias de fútbol de última hora: actualidad, mercado de fichajes y titulares de Marca, AS, SPORT y Mundo Deportivo. Actualizado automáticamente.'
    : 'Últimos fichajes del fútbol con club de origen y destino, precio y tipo de operación, más un tablón de noticias. Actualizado automáticamente.';
  const _crumbName = _isNews ? 'Noticias' : 'Fichajes';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${_title}</title>
  <meta name="description" content="${_desc}"/>
  <meta name="robots" content="index,follow,max-image-preview:large"/>
  <link rel="canonical" href="${_url}"/>
  <link rel="alternate" hreflang="es" href="${_url}"/>
  <link rel="alternate" hreflang="x-default" href="${_url}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="GolazoX"/>
  <meta property="og:locale" content="es_ES"/>
  <meta property="og:title" content="${_title}"/>
  <meta property="og:description" content="${_desc}"/>
  <meta property="og:url" content="${_url}"/>
  <meta property="og:image" content="${_base}/og-image.png?v=2"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${_title}"/>
  <meta name="twitter:description" content="${_desc}"/>
  <meta name="twitter:image" content="${_base}/og-image.png?v=2"/>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': _title.replace(' · GolazoX', ''),
    'description': _desc,
    'url': _url,
    'inLanguage': 'es',
    'isPartOf': { '@type': 'WebSite', 'name': 'GolazoX', 'url': _base },
    'publisher': { '@type': 'Organization', 'name': 'GolazoX', 'url': _base, 'logo': `${_base}/golazox-coin.png` },
    'breadcrumb': { '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'GolazoX', 'item': _base },
      { '@type': 'ListItem', 'position': 2, 'name': _crumbName, 'item': _url }
    ] }
  })}</script>
  <link rel="icon" type="image/png" href="/golazox-coin.png"/>
  <link rel="stylesheet" href="/style.css?v=28"/>
  <style>
    :root { --cyan:#00d4ff; --green:#10d98a; --ink:#0b0f14; }
    * { box-sizing:border-box; }
    body { max-width:1080px; margin:0 auto; padding:0 1.1rem 4rem; }

    /* ── Hero ── */
    .hero { position:relative; text-align:center; padding:3rem 1rem 2.4rem; margin-bottom:.5rem; overflow:hidden; }
    .hero::before { content:""; position:absolute; inset:-40% 0 auto 0; height:340px; background:radial-gradient(60% 100% at 50% 0%, rgba(0,212,255,.16), transparent 70%); pointer-events:none; z-index:-1; }
    .hero h1 { font-size:clamp(2rem,5vw,3rem); font-weight:800; letter-spacing:-.02em; margin:0 0 .5rem; background:linear-gradient(92deg,#fff 10%,var(--cyan) 55%,var(--green) 95%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .hero p { font-size:.9rem; color:rgba(255,255,255,.5); margin:0; display:inline-flex; align-items:center; gap:.5rem; }
    .live { display:inline-flex; align-items:center; gap:.4rem; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--green); }
    .live::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 0 rgba(16,217,138,.6); animation:pulse 1.8s infinite; }
    @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(16,217,138,.55);} 70%{box-shadow:0 0 0 9px rgba(16,217,138,0);} 100%{box-shadow:0 0 0 0 rgba(16,217,138,0);} }

    /* ── Tabs (segmented) ── */
    .tabs { display:flex; gap:.3rem; margin:0 auto 2rem; padding:.35rem; max-width:640px; background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.08); border-radius:999px; overflow-x:auto; }
    /* En escritorio el menú lateral ya rotula Fichajes/Noticias → el switcher superior sobra. */
    @media (min-width:1041px){ .tabs { display:none; } }
    .tab { flex:1 0 auto; appearance:none; background:none; border:0; border-radius:999px; color:rgba(255,255,255,.55); font-size:.92rem; font-weight:700; padding:.65rem .8rem; cursor:pointer; white-space:nowrap; text-decoration:none; text-align:center; transition:all .2s; }
    .tab:hover { color:#fff; }
    .tab.active { color:var(--ink); background:linear-gradient(92deg,var(--green),var(--cyan)); box-shadow:0 6px 20px -8px rgba(0,212,255,.6); }
    .tab .count { font-size:.68rem; opacity:.7; margin-left:.35rem; }
    .tab-link { color:rgba(255,255,255,.5); }
    .tab-link:hover { color:var(--cyan); background:rgba(255,255,255,.04); }

    h2 { font-size:1.15rem; margin:1.8rem 0 1rem; }

    /* ── Chart / ranking ── */
    .chart-box { background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:1.2rem 1.3rem; margin-bottom:2rem; }
    .chart-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
    .chart-head h2 { margin:0; font-size:1.1rem; }
    .chart-tag { font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--cyan); background:rgba(0,212,255,.1); border:1px solid rgba(0,212,255,.25); padding:.25rem .6rem; border-radius:999px; }
    .chart { display:flex; flex-direction:column; gap:.7rem; }
    .bar-row { display:grid; grid-template-columns:26px minmax(120px,190px) 1fr 74px; align-items:center; gap:.7rem; }
    .bar-rank { font-size:.82rem; font-weight:800; color:rgba(255,255,255,.35); text-align:center; }
    .bar-label { font-size:.82rem; color:#fff; font-weight:600; line-height:1.15; overflow:hidden; }
    .bar-label em { display:flex; align-items:center; gap:.3rem; font-style:normal; font-size:.66rem; font-weight:500; color:rgba(255,255,255,.45); margin-top:.15rem; }
    .bar-label em img { width:15px; height:15px; object-fit:contain; }
    .bar-track { height:10px; background:rgba(255,255,255,.06); border-radius:6px; overflow:hidden; }
    .bar-fill { display:block; height:100%; background:linear-gradient(90deg,var(--green),var(--cyan)); border-radius:6px; box-shadow:0 0 12px -2px rgba(0,212,255,.5); animation:grow 1s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes grow { from{transform:scaleX(0); transform-origin:left;} to{transform:scaleX(1);} }
    .bar-val { font-size:.84rem; color:var(--green); text-align:right; font-weight:800; }

    /* ── Transfer cards ── */
    .tgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:.9rem; }
    .tcard { position:relative; background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.09); border-radius:16px; padding:1rem 1.05rem; display:flex; flex-direction:column; gap:.75rem; transition:transform .18s, border-color .18s, box-shadow .18s; }
    .tcard:hover { transform:translateY(-4px); border-color:rgba(0,212,255,.4); box-shadow:0 14px 30px -18px rgba(0,212,255,.55); }
    .trank { position:absolute; top:.7rem; right:.85rem; font-size:.95rem; font-weight:800; color:rgba(255,255,255,.18); }
    .tcard-podium { border-color:rgba(255,255,255,.16); }
    .tcard-r1 { border-color:rgba(255,215,0,.5); box-shadow:0 0 0 1px rgba(255,215,0,.18) inset; }
    .tcard-r1 .trank { color:#ffd700; }
    .tcard-r2 .trank { color:#cfd6df; }
    .tcard-r3 .trank { color:#e0965b; }
    .tcard-head { display:flex; flex-direction:column; padding-right:1.4rem; }
    .tplayer { font-size:1rem; font-weight:700; color:#fff; line-height:1.2; }
    .tpos { font-size:.72rem; color:rgba(255,255,255,.42); margin-top:.1rem; }
    .tflow { display:flex; align-items:center; gap:.5rem; padding:.55rem 0; border-top:1px solid rgba(255,255,255,.06); border-bottom:1px solid rgba(255,255,255,.06); }
    .tclub { display:flex; align-items:center; gap:.45rem; flex:1; min-width:0; font-size:.8rem; color:rgba(255,255,255,.85); }
    .tclub img, .crest-fallback { width:30px; height:30px; flex:0 0 auto; }
    .tclub span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tclub-to { justify-content:flex-end; text-align:right; font-weight:600; color:#fff; }
    .tarrow { color:var(--cyan); font-size:1.15rem; flex:0 0 auto; }
    .crest-fallback { display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(255,255,255,.08); font-size:.8rem; font-weight:700; color:rgba(255,255,255,.6); }
    .tfee { align-self:flex-start; font-size:.82rem; font-weight:800; padding:.28rem .75rem; border-radius:999px; border:1px solid; }

    /* ── News board ── */
    .news-chip { display:inline-block; align-self:flex-start; font-size:.62rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#fff; padding:.16rem .5rem; border-radius:6px; }
    .news-hero { display:flex; flex-direction:column; text-decoration:none; margin-bottom:1.4rem; border-radius:16px; overflow:hidden; background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.1); border-left:4px solid var(--src,var(--cyan)); transition:transform .18s, box-shadow .18s; }
    .news-hero:hover { transform:translateY(-3px); box-shadow:0 16px 34px -20px var(--src,rgba(0,212,255,.6)); }
    .news-hero-img { display:block; width:100%; height:230px; background:rgba(0,0,0,.25); }
    .news-hero-img img { width:100%; height:100%; object-fit:cover; display:block; }
    .news-hero-body { display:flex; flex-direction:column; gap:.55rem; padding:1.2rem 1.5rem 1.4rem; }
    .news-hero-title { font-size:1.28rem; line-height:1.3; font-weight:800; color:#fff; letter-spacing:-.01em; }
    .news-hero:hover .news-hero-title { color:var(--src,var(--cyan)); }
    .news-hero-meta { font-size:.74rem; color:rgba(255,255,255,.45); font-weight:600; }
    @media (min-width:720px){
      .news-hero.has-img { flex-direction:row; }
      .news-hero.has-img .news-hero-img { width:42%; height:auto; min-height:210px; flex:0 0 42%; }
      .news-hero.has-img .news-hero-body { justify-content:center; flex:1; }
    }
    /* Rejilla */
    .news-list { list-style:none; padding:0; margin:0 0 .5rem; display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1rem; }
    .news-item { background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.07); border-radius:12px; overflow:hidden; transition:transform .15s, background .15s, border-color .15s; }
    .news-item:hover { transform:translateY(-3px); background:rgba(255,255,255,.06); border-color:color-mix(in srgb, var(--src) 45%, transparent); }
    .news-item a { display:flex; gap:.85rem; padding:0; color:#fff; text-decoration:none; height:100%; align-items:stretch; }
    .news-thumb { display:block; flex:0 0 96px; width:96px; background:rgba(0,0,0,.25); }
    .news-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
    .news-body { display:flex; flex-direction:column; gap:.5rem; padding:.85rem 1rem .85rem .1rem; flex:1; min-width:0; }
    .news-item:not(.has-img) .news-body { padding-left:1rem; }
    .news-title { display:block; font-size:.9rem; line-height:1.4; font-weight:600; }
    .news-item:hover .news-title { color:var(--src,var(--cyan)); }
    .news-meta { margin-top:auto; font-size:.7rem; color:rgba(255,255,255,.4); font-weight:600; }

    .empty { color:rgba(255,255,255,.4); font-size:.9rem; padding:1.5rem 0; text-align:center; }
    .disclaimer { margin-top:3rem; font-size:.72rem; color:rgba(255,255,255,.3); line-height:1.6; border-top:1px solid rgba(255,255,255,.07); padding-top:1.2rem; }
    .back { display:inline-block; margin-top:1.4rem; font-size:.82rem; opacity:.6; color:var(--cyan); text-decoration:none; }
    .back:hover { opacity:1; }

    .panel { display:none; }
    .panel.active { display:block; animation:fade .3s ease; }
    @keyframes fade { from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:none;} }

    /* Sub-tabs dentro de Fichajes */
    .subtabs { display:flex; gap:.5rem; flex-wrap:wrap; margin:0 0 1.5rem; }
    .subtab { appearance:none; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:999px; color:rgba(255,255,255,.6); font-size:.84rem; font-weight:700; padding:.5rem 1rem; cursor:pointer; transition:all .18s; }
    .subtab:hover { color:#fff; border-color:rgba(255,255,255,.28); }
    .subtab.active { color:var(--ink); background:linear-gradient(92deg,var(--green),var(--cyan)); border-color:transparent; }
    .subtab .count { font-size:.68rem; opacity:.7; margin-left:.3rem; }
    .subpanel { display:none; }
    .subpanel.active { display:block; animation:fade .25s ease; }
    .sub-note { font-size:.8rem; color:rgba(255,255,255,.42); margin:0 0 1.1rem; }

    /* ── Stats bar (contadores animados) ── */
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:.7rem; margin:0 0 1.8rem; }
    .stat { display:flex; flex-direction:column; align-items:center; gap:.15rem; text-align:center; padding:1rem .6rem; border-radius:14px; background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.08); }
    .stat-ico { font-size:1.3rem; }
    .stat-val { font-size:1.35rem; font-weight:800; color:#fff; letter-spacing:-.02em; line-height:1.1; }
    .stat-val.is-money { background:linear-gradient(92deg,var(--green),var(--cyan)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .stat-lbl { font-size:.68rem; color:rgba(255,255,255,.45); text-transform:uppercase; letter-spacing:.04em; font-weight:600; }
    @media (max-width:560px){ .stats { grid-template-columns:repeat(2,1fr); } }

    /* ── Buscador ── */
    .searchbar { position:relative; display:flex; align-items:center; margin:0 0 1.4rem; }
    .searchbar .search-ico { position:absolute; left:.9rem; font-size:.95rem; opacity:.5; pointer-events:none; }
    .searchbar input { width:100%; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:999px; color:#fff; font-size:.92rem; padding:.7rem 2.4rem; outline:none; transition:border-color .15s, background .15s; }
    .searchbar input:focus { border-color:var(--cyan); background:rgba(255,255,255,.07); }
    .searchbar input::placeholder { color:rgba(255,255,255,.4); }
    .search-clear { position:absolute; right:1rem; cursor:pointer; font-size:.8rem; opacity:.6; color:#fff; }
    .search-clear:hover { opacity:1; }
    .search-empty { text-align:center; color:rgba(255,255,255,.45); font-size:.9rem; padding:1.5rem 0; }
    .tcard.hide, .news-item.hide, .news-hero.hide, .news-group.hide { display:none !important; }

    /* ── Filtro por medio (noticias) ── */
    .nfilters { display:flex; flex-wrap:wrap; gap:.5rem; margin:0 0 1.5rem; }
    .nfilter { appearance:none; cursor:pointer; font-size:.78rem; font-weight:700; padding:.42rem .9rem; border-radius:999px; color:rgba(255,255,255,.7); background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); transition:all .15s; }
    .nfilter:hover { color:#fff; border-color:var(--src,rgba(255,255,255,.3)); }
    .nfilter.active { color:#fff; background:var(--src,#1d6fd6); border-color:transparent; }

    /* ── Refresh pill (auto-refresh) ── */
    .refresh-pill { position:fixed; left:50%; bottom:1.4rem; transform:translateX(-50%); z-index:50; cursor:pointer; font-size:.85rem; font-weight:700; color:var(--ink); background:linear-gradient(92deg,var(--green),var(--cyan)); padding:.65rem 1.2rem; border-radius:999px; box-shadow:0 10px 30px -8px rgba(0,212,255,.6); animation:pop .3s ease; }
    .refresh-pill span { text-decoration:underline; }
    @keyframes pop { from{opacity:0; transform:translate(-50%,10px);} to{opacity:1; transform:translate(-50%,0);} }

    @media (max-width:640px){
      .bar-row { grid-template-columns:20px 1fr 60px; }
      .bar-track { display:none; }
    }
  </style>
</head>
<body class="has-side-nav">
  ${GX_SIDE_NAV(_isNews ? 'news' : 'transfers')}
  <header class="hero">
    <h1 id="heroTitle" data-title-fichajes="Mercado de Fichajes" data-title-noticias="Noticias">${_isNews ? 'Noticias' : 'Mercado de Fichajes'}</h1>
    <p><span class="live">En directo</span> · <span class="ago" data-updated="${transfers.updated || news.updated || Date.now()}">actualizado ${_timeAgo(transfers.updated) || _timeAgo(news.updated) || 'ahora'}</span></p>
  </header>

  <div class="refresh-pill" id="refreshPill" hidden>✨ Hay novedades · <span>actualizar</span></div>

  <nav class="tabs" role="tablist">
    <button class="tab${_isNews ? '' : ' active'}" data-tab="fichajes" role="tab">💸 Fichajes<span class="count">${transfers.list.length}</span></button>
    <button class="tab${_isNews ? ' active' : ''}" data-tab="noticias" role="tab">📰 Noticias<span class="count">${(news.fichajes.length + news.general.length)}</span></button>
  </nav>

  <section id="tab-fichajes" class="panel${_isNews ? '' : ' active'}" role="tabpanel">
    ${_statsHTML(transfers)}

    <div class="subtabs">
      <button class="subtab active" data-sub="top">🏆 Bombazos de la temporada</button>
      <button class="subtab" data-sub="latest">🔥 Recién cerrados<span class="count">${transfers.latest ? transfers.latest.length : 0}</span></button>
    </div>

    <div class="searchbar">
      <span class="search-ico">🔍</span>
      <input id="tsearch" type="search" placeholder="Buscar jugador, club o posición…" autocomplete="off" aria-label="Buscar fichajes"/>
      <span class="search-clear" id="tsearchClear" hidden>✕</span>
    </div>
    <p class="search-empty" id="searchEmpty" hidden>Sin resultados para tu búsqueda.</p>

    <div id="sub-top" class="subpanel active">
      ${_chartHTML(transfers.top)}
      ${transfers.list.length
        ? `<h2>💎 Los más caros del mercado</h2><div class="tgrid">${transfers.list.map((t, i) => _transferCardHTML(t, i + 1)).join('')}</div>`
        : '<p class="empty">No hay datos de fichajes disponibles ahora mismo. Vuelve en unos minutos.</p>'}
    </div>

    <div id="sub-latest" class="subpanel">
      <p class="sub-note">Operaciones cerradas más recientes, en orden cronológico.</p>
      ${(transfers.latest && transfers.latest.length)
        ? `<div class="tgrid">${transfers.latest.map(t => _transferCardHTML(t)).join('')}</div>`
        : '<p class="empty">No hay fichajes recientes disponibles ahora mismo.</p>'}
    </div>
  </section>

  <section id="tab-noticias" class="panel${_isNews ? ' active' : ''}" role="tabpanel">
    ${_newsFilterHTML([...news.fichajes, ...news.general])}
    ${_newsSectionHTML('🔄 Mercado de fichajes', news.fichajes, 13)}
    ${_newsSectionHTML('🗞️ Actualidad', news.general, 13)}
    ${(!news.fichajes.length && !news.general.length)
      ? '<p class="empty">No hay noticias disponibles ahora mismo.</p>' : ''}
  </section>

  <p class="disclaimer">Datos de fichajes y escudos: Transfermarkt. Titulares: Marca, AS, SPORT, Mundo Deportivo.
  GolazoX agrega y enlaza a las fuentes originales con fines informativos; no reproduce el contenido de las noticias.
  La duración de contrato no se muestra por no estar disponible en la fuente; se indica el tipo de operación (fichaje, cesión o libre) y el importe.</p>
  <a class="back" href="/">← Volver al simulador</a>

  <script src="/fichajes.js?v=5" defer></script>
</body>
</html>`;
};

app.get('/fichajes', _newsLimit, async (_req, res) => {
  try {
    const [transfers, news] = await Promise.all([getTransfers(), getNews()]);
    res.set('Cache-Control', 'public, max-age=300')
       .type('text/html')
       .send(FICHAJES_HTML(transfers, news));
  } catch (e) {
    console.error('[fichajes] error:', e.message);
    res.status(503).type('text/html').send(FICHAJES_HTML(
      { list: [], top: [], latest: [], updated: 0 },
      { fichajes: [], general: [], updated: 0 },
    ));
  }
});

// Ping ligero para el auto-refresh: devuelve solo el timestamp de los datos.
app.get('/fichajes/ping', _newsLimit, async (_req, res) => {
  try {
    const [transfers, news] = await Promise.all([getTransfers(), getNews()]);
    const updated = Math.max(transfers.updated || 0, news.updated || 0);
    res.set('Cache-Control', 'no-store').json({ updated });
  } catch {
    res.json({ updated: 0 });
  }
});

// Página de Noticias — misma plantilla que /fichajes pero con la pestaña de
// noticias activa y SEO propio (URL indexable independiente).
app.get('/noticias', _newsLimit, async (_req, res) => {
  try {
    const [transfers, news] = await Promise.all([getTransfers(), getNews()]);
    res.set('Cache-Control', 'public, max-age=300')
       .type('text/html')
       .send(FICHAJES_HTML(transfers, news, 'noticias'));
  } catch (e) {
    console.error('[noticias] error:', e.message);
    res.status(503).type('text/html').send(FICHAJES_HTML(
      { list: [], top: [], latest: [], updated: 0 },
      { fichajes: [], general: [], updated: 0 },
      'noticias',
    ));
  }
});

// ═══════════════════════ CLASIFICACIONES ═══════════════════════
// Escudo de club (reutiliza el proxy /tmbadge). `badge` puede ser null.
const _crest = (badge, name, size = 26) => badge
  ? `<img src="${_esc(badge)}" alt="" loading="lazy" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain"/>`
  : `<span class="crest-fallback" style="width:${size}px;height:${size}px">${_esc((name || '?').slice(0, 1))}</span>`;

// Zona de la tabla según posición (UCL, Europa, descenso) → clase CSS.
const _zone = (pos, total) => {
  if (pos <= 4)            return 'z-ucl';
  if (pos === 5)           return 'z-uel';
  if (pos === 6)           return 'z-conf';
  if (pos > total - 3)     return 'z-rel';
  return '';
};

const _standingsRowHTML = (r, total) => {
  const [gf, ga] = (r.goals || '0:0').split(':');
  const gdNum = parseInt(r.gd, 10) || 0;
  const gdCls = gdNum > 0 ? 'pos' : (gdNum < 0 ? 'neg' : '');
  return `<tr class="${_zone(r.pos, total)}" data-search="${_esc((r.club || '').toLowerCase())}">
    <td class="c-pos">${r.pos}</td>
    <td class="c-club"><span class="crest">${_crest(r.badge, r.club, 24)}</span><span class="club-name">${_esc(r.club)}</span></td>
    <td class="c-num">${r.played}</td>
    <td class="c-num hide-sm">${r.won}</td>
    <td class="c-num hide-sm">${r.drawn}</td>
    <td class="c-num hide-sm">${r.lost}</td>
    <td class="c-num hide-md">${_esc(gf)}:${_esc(ga)}</td>
    <td class="c-num c-gd ${gdCls}">${gdNum > 0 ? '+' + gdNum : gdNum}</td>
    <td class="c-pts">${r.points}</td>
  </tr>`;
};

const _scorerRowHTML = (s, i) => `
  <li class="scorer">
    <span class="sc-rank">${i + 1}</span>
    <span class="sc-crest">${_crest(s.badge, s.club, 22)}</span>
    <span class="sc-name">${_esc(s.player)}<em>${_esc(s.club)}</em></span>
    <span class="sc-goals">${s.goals}<small>gol${s.goals === 1 ? '' : 'es'}</small></span>
  </li>`;

// Limpia la hora del calendario ("desconocido" / vacío → sin hora).
const _fxTime = (t) => (!t || /desconocido/i.test(t)) ? '' : t;

// Una jornada del calendario.
const _fxRoundHTML = (rnd) => {
  const matches = rnd.matches.map(m => {
    const mid = m.played
      ? `<span class="fx-score">${_esc(m.score)}</span>`
      : `<span class="fx-vs">${_fxTime(m.time) ? _esc(_fxTime(m.time)) : 'vs'}</span>`;
    // Boton "Simular": solo si ambos equipos resuelven a un slug del catalogo.
    const hs = _resolveFixtureSlug(m.home.name);
    const as = _resolveFixtureSlug(m.away.name);
    const canSim = hs && as && hs !== as;
    // Reservamos siempre la columna (boton o hueco) para que todas las filas se alineen.
    const simBtn = canSim
      ? `<a class="fx-sim" href="/?a=${encodeURIComponent(hs)}&amp;b=${encodeURIComponent(as)}" title="Simular ${_esc(m.home.name)} vs ${_esc(m.away.name)}" aria-label="Simular ${_esc(m.home.name)} contra ${_esc(m.away.name)}">\u25B6</a>`
      : `<span class="fx-sim-empty" aria-hidden="true"></span>`;
    return `<li class="fx-match">
      <span class="fx-team fx-home"><span class="fx-name">${_esc(m.home.name)}</span><span class="fx-crest">${_crest(m.home.badge, m.home.name, 22)}</span></span>
      <span class="fx-mid${m.played ? ' is-played' : ''}">${mid}</span>
      <span class="fx-team fx-away"><span class="fx-crest">${_crest(m.away.badge, m.away.name, 22)}</span><span class="fx-name">${_esc(m.away.name)}</span></span>
      ${simBtn}
    </li>`;
  }).join('');
  // Fecha de referencia de la jornada = fecha del primer partido.
  const day = rnd.matches[0] ? rnd.matches[0].date : '';
  return `<div class="fx-round">
    <div class="fx-round-head"><span class="fx-jornada">Jornada ${rnd.round}</span><span class="fx-date">${_esc(day)}</span></div>
    <ul class="fx-list">${matches}</ul>
  </div>`;
};

const _fixturesHTML = (lg) => {
  if (!lg.fixtures || !lg.fixtures.length) {
    return '<p class="empty">Calendario no disponible todavía para esta liga.</p>';
  }
  return `<div class="fx-head">
      <h2>📅 Próximos partidos</h2>
      <span class="fx-tag">Temporada ${_esc(lg.fxSeason)}</span>
    </div>
    <div class="fx-rounds">${lg.fixtures.map(_fxRoundHTML).join('')}</div>`;
};

const _leaguePanelHTML = (lg, idx) => {
  const total = lg.table.length;
  const rows = lg.table.map(r => _standingsRowHTML(r, total)).join('');
  const scorers = lg.scorers.length
    ? `<aside class="scorers-box">
        <div class="sc-head"><h2>⚽ Máximos goleadores</h2><span class="sc-tag">${_esc(lg.season)}</span></div>
        <ol class="scorers">${lg.scorers.map(_scorerRowHTML).join('')}</ol>
      </aside>`
    : '';
  return `<section id="lg-${_esc(lg.code)}" class="panel${idx === 0 ? ' active' : ''}" role="tabpanel">
    <div class="lgviews">
      <button class="lgview active" data-view="table">📊 Clasificación</button>
      <button class="lgview" data-view="calendar">📅 Calendario</button>
    </div>

    <div class="lgview-panel view-table active">
    <div class="lg-layout">
      <div class="table-box">
        <div class="tbl-head"><h2>${lg.flag} ${_esc(lg.name)}</h2><span class="tbl-tag">Temporada ${_esc(lg.season)}</span></div>
        <div class="tbl-scroll">
        <table class="ltable">
          <thead><tr>
            <th class="c-pos">#</th><th class="c-club">Equipo</th>
            <th class="c-num" title="Partidos jugados">PJ</th>
            <th class="c-num hide-sm" title="Ganados">G</th>
            <th class="c-num hide-sm" title="Empatados">E</th>
            <th class="c-num hide-sm" title="Perdidos">P</th>
            <th class="c-num hide-md" title="Goles a favor y en contra">GF:GC</th>
            <th class="c-num" title="Diferencia de goles">DG</th>
            <th class="c-pts">Pts</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        </div>
        <div class="tbl-legend">
          <span><i class="lg-ucl"></i> Champions</span>
          <span><i class="lg-uel"></i> Europa League</span>
          <span><i class="lg-conf"></i> Conference</span>
          <span><i class="lg-rel"></i> Descenso</span>
        </div>
      </div>
      ${scorers}
    </div>
    </div>

    <div class="lgview-panel view-calendar">
      ${_fixturesHTML(lg)}
    </div>
  </section>`;
};

const CLASIFICACIONES_HTML = (standings) => {
  const leagues = standings.leagues || [];
  const tabs = leagues.map((lg, i) =>
    `<button class="tab${i === 0 ? ' active' : ''}" data-tab="${_esc(lg.code)}" role="tab">${lg.flag} <span class="tab-txt">${_esc(lg.name)}</span></button>`
  ).join('');
  const panels = leagues.map(_leaguePanelHTML).join('');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Clasificaciones y goleadores de las grandes ligas · GolazoX</title>
  <meta name="description" content="Clasificaciones de LaLiga, Premier League, Serie A, Bundesliga y Ligue 1 con máximos goleadores. Tablas actualizadas automáticamente."/>
  <meta name="robots" content="index,follow,max-image-preview:large"/>
  <link rel="canonical" href="${SITE_URL.replace(/\/$/, '')}/clasificaciones"/>
  <link rel="alternate" hreflang="es" href="${SITE_URL.replace(/\/$/, '')}/clasificaciones"/>
  <link rel="alternate" hreflang="x-default" href="${SITE_URL.replace(/\/$/, '')}/clasificaciones"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="GolazoX"/>
  <meta property="og:locale" content="es_ES"/>
  <meta property="og:title" content="Clasificaciones y goleadores de las grandes ligas · GolazoX"/>
  <meta property="og:description" content="Clasificaciones de LaLiga, Premier League, Serie A, Bundesliga y Ligue 1 con máximos goleadores. Tablas actualizadas automáticamente."/>
  <meta property="og:url" content="${SITE_URL.replace(/\/$/, '')}/clasificaciones"/>
  <meta property="og:image" content="${SITE_URL.replace(/\/$/, '')}/og-image.png?v=2"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="Clasificaciones y goleadores de las grandes ligas · GolazoX"/>
  <meta name="twitter:description" content="Clasificaciones de LaLiga, Premier League, Serie A, Bundesliga y Ligue 1 con máximos goleadores."/>
  <meta name="twitter:image" content="${SITE_URL.replace(/\/$/, '')}/og-image.png?v=2"/>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'Clasificaciones y goleadores de las grandes ligas',
    'description': 'Clasificaciones de LaLiga, Premier League, Serie A, Bundesliga y Ligue 1 con máximos goleadores.',
    'url': `${SITE_URL.replace(/\/$/, '')}/clasificaciones`,
    'inLanguage': 'es',
    'isPartOf': { '@type': 'WebSite', 'name': 'GolazoX', 'url': SITE_URL.replace(/\/$/, '') },
    'publisher': { '@type': 'Organization', 'name': 'GolazoX', 'url': SITE_URL.replace(/\/$/, ''), 'logo': `${SITE_URL.replace(/\/$/, '')}/golazox-coin.png` },
    'mainEntity': { '@type': 'ItemList', 'itemListElement': leagues.map((lg, i) => ({ '@type': 'ListItem', 'position': i + 1, 'name': lg.name })) },
    'breadcrumb': { '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'GolazoX', 'item': SITE_URL.replace(/\/$/, '') },
      { '@type': 'ListItem', 'position': 2, 'name': 'Clasificaciones', 'item': `${SITE_URL.replace(/\/$/, '')}/clasificaciones` }
    ] }
  })}</script>
  <link rel="icon" type="image/png" href="/golazox-coin.png"/>
  <link rel="stylesheet" href="/style.css?v=28"/>
  <style>
    :root { --cyan:#00d4ff; --green:#10d98a; --ink:#0b0f14; }
    * { box-sizing:border-box; }
    body { max-width:1080px; margin:0 auto; padding:0 1.1rem 4rem; }

    .hero { position:relative; text-align:center; padding:3rem 1rem 2.2rem; margin-bottom:.5rem; overflow:hidden; }
    .hero::before { content:""; position:absolute; inset:-40% 0 auto 0; height:340px; background:radial-gradient(60% 100% at 50% 0%, rgba(0,212,255,.16), transparent 70%); pointer-events:none; z-index:-1; }
    .hero h1 { font-size:clamp(2rem,5vw,3rem); font-weight:800; letter-spacing:-.02em; margin:0 0 .5rem; background:linear-gradient(92deg,#fff 10%,var(--cyan) 55%,var(--green) 95%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .hero p { font-size:.9rem; color:rgba(255,255,255,.5); margin:0; display:inline-flex; align-items:center; gap:.5rem; }
    .live { display:inline-flex; align-items:center; gap:.4rem; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--green); }
    .live::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 0 rgba(16,217,138,.6); animation:pulse 1.8s infinite; }
    @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(16,217,138,.55);} 70%{box-shadow:0 0 0 9px rgba(16,217,138,0);} 100%{box-shadow:0 0 0 0 rgba(16,217,138,0);} }

    /* Menú principal (consistente con la página de fichajes) */
    .mainnav { display:flex; gap:.3rem; margin:0 auto 1.6rem; padding:.35rem; max-width:560px; background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.08); border-radius:999px; overflow-x:auto; }
    .mnav { flex:1 0 auto; text-align:center; text-decoration:none; border-radius:999px; color:rgba(255,255,255,.55); font-size:.9rem; font-weight:700; padding:.6rem .85rem; white-space:nowrap; transition:all .2s; }
    .mnav:hover { color:#fff; }
    .mnav.active { color:var(--ink); background:linear-gradient(92deg,var(--green),var(--cyan)); box-shadow:0 6px 20px -8px rgba(0,212,255,.6); }

    /* Tabs de liga */
    .tabs { display:flex; align-items:center; gap:.4rem; margin:0 auto 2rem; padding:.35rem; max-width:760px; background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow-x:auto; }
    .tab { flex:1 0 auto; appearance:none; background:none; border:0; border-radius:12px; color:rgba(255,255,255,.55); font-size:.9rem; font-weight:700; padding:.6rem .9rem; cursor:pointer; white-space:nowrap; text-decoration:none; text-align:center; transition:all .2s; }
    .tab:hover { color:#fff; }
    .tab.active { color:var(--ink); background:linear-gradient(92deg,var(--green),var(--cyan)); box-shadow:0 6px 20px -8px rgba(0,212,255,.6); }

    .panel { display:none; }
    .panel.active { display:block; animation:fade .3s ease; }
    @keyframes fade { from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:none;} }

    /* Sub-toggle Clasificación / Calendario */
    .lgviews { display:flex; gap:.5rem; margin:0 0 1.3rem; flex-wrap:wrap; }
    .lgview { appearance:none; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:999px; color:rgba(255,255,255,.6); font-size:.84rem; font-weight:700; padding:.5rem 1rem; cursor:pointer; transition:all .18s; }
    .lgview:hover { color:#fff; border-color:rgba(255,255,255,.28); }
    .lgview.active { color:var(--ink); background:linear-gradient(92deg,var(--green),var(--cyan)); border-color:transparent; }
    .lgview-panel { display:none; }
    .lgview-panel.active { display:block; animation:fade .25s ease; }

    /* Calendario */
    .fx-head { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-bottom:1.1rem; }
    .fx-head h2 { margin:0; font-size:1.1rem; }
    .fx-tag { font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--cyan); background:rgba(0,212,255,.1); border:1px solid rgba(0,212,255,.25); padding:.25rem .6rem; border-radius:999px; white-space:nowrap; }
    .fx-rounds { display:grid; grid-template-columns:1fr; gap:1.1rem; }
    @media (min-width:760px){ .fx-rounds { grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); align-items:start; } }
    .fx-round { background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:1rem 1.1rem 1.1rem; }
    .fx-round-head { display:flex; align-items:baseline; justify-content:space-between; gap:.6rem; margin-bottom:.8rem; padding-bottom:.6rem; border-bottom:1px solid rgba(255,255,255,.08); }
    .fx-jornada { font-size:.9rem; font-weight:800; color:#fff; }
    .fx-date { font-size:.72rem; color:rgba(255,255,255,.45); font-weight:600; text-transform:capitalize; }
    .fx-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.15rem; }
    .fx-match { display:grid; grid-template-columns:1fr auto 1fr 26px; align-items:center; gap:.5rem; padding:.5rem .2rem; border-radius:8px; transition:background .15s; }
    .fx-match:hover { background:rgba(255,255,255,.035); }
    .fx-sim { flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:7px; font-size:.6rem; color:#fff; text-decoration:none; background:linear-gradient(135deg,var(--cyan,#00d4ff),#0077ff); box-shadow:0 2px 6px rgba(0,119,255,.35); opacity:.55; transition:opacity .15s, transform .15s; }
    .fx-sim-empty { display:inline-block; width:26px; height:26px; }
    .fx-match:hover .fx-sim { opacity:1; }
    .fx-sim:hover { transform:scale(1.12); opacity:1; }
    .fx-team { display:flex; align-items:center; gap:.45rem; min-width:0; font-size:.82rem; font-weight:600; color:#fff; }
    .fx-home { justify-content:flex-end; text-align:right; }
    .fx-away { justify-content:flex-start; text-align:left; }
    .fx-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.2; }
    .fx-team .fx-crest { flex:0 0 auto; display:inline-flex; }
    .fx-crest img, .fx-crest .crest-fallback { width:22px; height:22px; }
    .fx-mid { flex:0 0 auto; min-width:58px; text-align:center; }
    .fx-vs { font-size:.72rem; font-weight:700; color:rgba(255,255,255,.5); background:rgba(255,255,255,.05); border-radius:6px; padding:.2rem .45rem; display:inline-block; }
    .fx-mid.is-played .fx-score { font-size:.9rem; font-weight:800; color:var(--cyan); background:rgba(0,212,255,.1); border-radius:6px; padding:.2rem .5rem; display:inline-block; }

    .lg-layout { display:grid; grid-template-columns:1fr; gap:1.4rem; }
    @media (min-width:900px){ .lg-layout { grid-template-columns:1fr 320px; align-items:start; } }

    .table-box, .scorers-box { background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02)); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:1.1rem 1.2rem 1.2rem; }
    .tbl-head, .sc-head { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-bottom:1rem; }
    .tbl-head h2, .sc-head h2 { margin:0; font-size:1.1rem; }
    .tbl-tag, .sc-tag { font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--cyan); background:rgba(0,212,255,.1); border:1px solid rgba(0,212,255,.25); padding:.25rem .6rem; border-radius:999px; white-space:nowrap; }

    .tbl-scroll { overflow-x:auto; }
    .ltable { width:100%; border-collapse:collapse; font-size:.86rem; }
    .ltable th { font-size:.64rem; text-transform:uppercase; letter-spacing:.05em; color:rgba(255,255,255,.4); font-weight:700; padding:.4rem .35rem; text-align:center; border-bottom:1px solid rgba(255,255,255,.1); }
    .ltable td { padding:.5rem .35rem; text-align:center; border-bottom:1px solid rgba(255,255,255,.05); color:rgba(255,255,255,.8); }
    .ltable tbody tr { transition:background .15s; }
    .ltable tbody tr:hover { background:rgba(255,255,255,.04); }
    .c-pos { width:30px; font-weight:800; color:rgba(255,255,255,.45); position:relative; }
    .c-club { text-align:left !important; }
    .c-club .crest { display:inline-flex; vertical-align:middle; width:24px; margin-right:.5rem; }
    .club-name { vertical-align:middle; font-weight:600; color:#fff; }
    .c-num { color:rgba(255,255,255,.7); font-variant-numeric:tabular-nums; }
    .c-gd.pos { color:var(--green); } .c-gd.neg { color:#ff6b6b; }
    .c-pts { font-weight:800; color:#fff; width:44px; font-variant-numeric:tabular-nums; }
    .crest-fallback { display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(255,255,255,.08); font-size:.72rem; font-weight:700; color:rgba(255,255,255,.6); }

    /* Zonas (borde izquierdo de color en la posición) */
    .ltable tbody tr .c-pos::before { content:""; position:absolute; left:0; top:6px; bottom:6px; width:3px; border-radius:3px; background:transparent; }
    tr.z-ucl  .c-pos::before { background:var(--green); }
    tr.z-uel  .c-pos::before { background:var(--cyan); }
    tr.z-conf .c-pos::before { background:#7c9cff; }
    tr.z-rel  .c-pos::before { background:#ff6b6b; }

    .tbl-legend { display:flex; flex-wrap:wrap; gap:.6rem 1.1rem; margin-top:1rem; font-size:.68rem; color:rgba(255,255,255,.45); }
    .tbl-legend span { display:inline-flex; align-items:center; gap:.35rem; }
    .tbl-legend i { width:10px; height:10px; border-radius:3px; display:inline-block; }
    .lg-ucl { background:var(--green); } .lg-uel { background:var(--cyan); } .lg-conf { background:#7c9cff; } .lg-rel { background:#ff6b6b; }

    /* Goleadores */
    .scorers { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.55rem; }
    .scorer { display:flex; align-items:center; gap:.6rem; }
    .sc-rank { flex:0 0 20px; text-align:center; font-size:.8rem; font-weight:800; color:rgba(255,255,255,.35); }
    .scorer:nth-child(1) .sc-rank { color:#ffd700; } .scorer:nth-child(2) .sc-rank { color:#cfd6df; } .scorer:nth-child(3) .sc-rank { color:#e0965b; }
    .sc-crest { flex:0 0 22px; display:inline-flex; }
    .sc-name { flex:1; min-width:0; font-size:.85rem; font-weight:600; color:#fff; line-height:1.2; overflow:hidden; }
    .sc-name em { display:block; font-style:normal; font-size:.68rem; font-weight:500; color:rgba(255,255,255,.42); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sc-goals { flex:0 0 auto; font-size:1.05rem; font-weight:800; color:var(--green); text-align:right; }
    .sc-goals small { display:block; font-size:.58rem; font-weight:600; color:rgba(255,255,255,.4); text-transform:uppercase; letter-spacing:.04em; }

    .searchbar { position:relative; display:flex; align-items:center; margin:0 auto 1.6rem; max-width:420px; }
    .searchbar .search-ico { position:absolute; left:.9rem; font-size:.95rem; opacity:.5; pointer-events:none; }
    .searchbar input { width:100%; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:999px; color:#fff; font-size:.92rem; padding:.65rem 2.4rem; outline:none; transition:border-color .15s, background .15s; }
    .searchbar input:focus { border-color:var(--cyan); background:rgba(255,255,255,.07); }
    .searchbar input::placeholder { color:rgba(255,255,255,.4); }
    .search-clear { position:absolute; right:1rem; cursor:pointer; font-size:.8rem; opacity:.6; color:#fff; }
    .ltable tr.hide { display:none !important; }

    .empty { color:rgba(255,255,255,.4); font-size:.9rem; padding:2rem 0; text-align:center; }
    .disclaimer { margin-top:3rem; font-size:.72rem; color:rgba(255,255,255,.3); line-height:1.6; border-top:1px solid rgba(255,255,255,.07); padding-top:1.2rem; }
    .back { display:inline-block; margin-top:1.4rem; font-size:.82rem; opacity:.6; color:var(--cyan); text-decoration:none; }
    .back:hover { opacity:1; }

    @media (max-width:640px){ .hide-sm { display:none !important; } }
    @media (max-width:440px){ .hide-md { display:none !important; } .tab-txt { display:none; } .tab { padding:.6rem .8rem; font-size:1.1rem; } }
  </style>
</head>
<body class="has-side-nav">
  ${GX_SIDE_NAV('standings')}
  <header class="hero">
    <h1>Clasificaciones</h1>
    <p><span class="live">En directo</span> · <span class="ago" data-updated="${standings.updated || Date.now()}">actualizado ${_timeAgo(standings.updated) || 'ahora'}</span></p>
  </header>

  ${leagues.length ? `
  <div class="searchbar">
    <span class="search-ico">🔍</span>
    <input id="lsearch" type="search" placeholder="Buscar equipo…" autocomplete="off" aria-label="Buscar equipo"/>
    <span class="search-clear" id="lsearchClear" hidden>✕</span>
  </div>

  <nav class="tabs" role="tablist">${tabs}</nav>
  ${panels}
  ` : '<p class="empty">No hay clasificaciones disponibles ahora mismo. Vuelve en unos minutos.</p>'}

  <p class="disclaimer">Datos de clasificaciones, goleadores y escudos: Transfermarkt. Cifras de una tabla deportiva pública, actualizadas automáticamente.
  En pretemporada se muestra la última temporada con partidos disputados.</p>
  <a class="back" href="/">← Volver al simulador</a>

  <script src="/clasificaciones.js" defer></script>
</body>
</html>`;
};

app.get('/clasificaciones', _newsLimit, async (_req, res) => {
  try {
    const standings = await getStandings();
    res.set('Cache-Control', 'public, max-age=600')
       .type('text/html')
       .send(CLASIFICACIONES_HTML(standings));
  } catch (e) {
    console.error('[clasificaciones] error:', e.message);
    res.status(503).type('text/html').send(CLASIFICACIONES_HTML({ leagues: [], updated: 0 }));
  }
});

app.get('*', (req, res) => {
  const p = req.path;
  const isBotProbe = p.length > 1;
  const cleanUrl = (process.env.SITE_URL || 'https://golazox.com').replace(/[\\"'<>]/g, '').replace(/\/$/, '');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const injected = html.replace(
    '<meta property="og:type" content="website" />',
    `<meta property="og:type" content="website" />\n  <meta property="og:url" content="${cleanUrl}/" />\n  <link rel="canonical" href="${cleanUrl}/" />`
  );
  res.status(isBotProbe ? 404 : 200)
     .set('Cache-Control', 'no-cache')
     .type('text/html')
     .send(injected);
});

// -- Process crash guards ---------------------
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason);
});

app.listen(PORT, '0.0.0.0', () => {
  // Print local network IPs so devices on the same WiFi can connect
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const localIPs = [];
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) localIPs.push(net.address);
    }
  }
  console.log(`\n  ?  Football Simulator running at:`);
  console.log(`       http://localhost:${PORT}`);
  localIPs.forEach(ip => console.log(`       http://${ip}:${PORT}  ? use this on your iPhone`));
  console.log();
});
