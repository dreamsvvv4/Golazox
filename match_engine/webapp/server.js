/**
 * Football Match Simulator — Express Backend
 * ─────────────────────────────────────────────
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

const app    = express();
app.set('trust proxy', 1); // Correct req.ip behind nginx/Cloudflare
app.disable('x-powered-by');  // Don't expose server fingerprint
const PORT = process.env.PORT || 3000;

// Auto-create logs/ dir (used by PM2 ecosystem config)
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Pre-build autocomplete list from local squad DB (capitalised, sorted)
const SQUAD_SUGGESTIONS = [...new Set(
  Object.keys(SQUADS).map(k => k.replace(/\b\w/g, c => c.toUpperCase()))
)].sort();

// Badge map: lowercased name → local path (built from squads/ at startup)
// Falls back to placeholder when nothing is found.
const BADGE_PLACEHOLDER = '/img/badges/_placeholder.svg';
const _squadFiles = fs.readdirSync(path.join(__dirname, 'squads'))
  .filter(f => f.endsWith('.json') && !f.startsWith('.'));
const _badgeMap = new Map();  // name.lc → localPath
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

// ── League/group mapping: slug → display group ───────────────
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
  '🇸🇦 Saudi Pro League', '🇺🇸 MLS', '🌎 América del Sur', '🌍 Otros',
];
// group, nameEn, nameEs: stored in each squad JSON, with squads-meta.json as overlay.
// squads-meta.json maps slug → { group, nameEn, nameEs } and overrides per-file values.
// This allows correct metadata even for squad files that are gitignored (seeded on server).
const _SQUADS_META = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'squads-meta.json'), 'utf8')); }
  catch (_) { return {}; }
})();


// Catalog: name + slug + available seasons (only teams with ≥1 season)
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
    const group = _meta.group || d.group || '🌍 Otros';
    const nameEn = _meta.nameEn || d.nameEn || d.name || slug;
    const nameEs = _meta.nameEs || d.nameEs || d.nameEn || d.name || slug;
    const badge = d.badgeLocalPath || BADGE_PLACEHOLDER;
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

// Resolve a display name / slug / localized label → canonical squad slug
// Used by /simulate so picker-submitted slugs and typed names both work.
const _catalogNameMap = (() => {
  const m = new Map();
  for (const e of CATALOG) {
    m.set(e.slug.toLowerCase(), e.slug);
    if (e.nameEn) m.set(e.nameEn.toLowerCase(), e.slug);
    if (e.nameEs) m.set(e.nameEs.toLowerCase(), e.slug);
  }
  return m;
})();
function _resolveTeamSlug(input) {
  return _catalogNameMap.get(input.trim().toLowerCase()) || input.trim();
}

// ── Middleware ────────────────────────────────
// Gzip/Brotli compression for all text responses (HTML, CSS, JS, JSON).
// Reduces bandwidth ~70-80% — essential for mobile performance and hosting costs.
app.use(compress({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '32kb' }));

// ── Per-request timeout: 25 s hard cap ───────────────────────────────────
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
const _siteIsHttps = (process.env.SITE_URL || '').startsWith('https://');

app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-DNS-Prefetch-Control', 'off');  // Prevent DNS prefetch leaking browsed URLs
  res.set('Content-Security-Policy',
    "default-src 'self'; " +
    "img-src 'self' data: blob: https://www.thesportsdb.com https://media.api-sports.io https://flagcdn.com; " +
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

// ── Dynamic index.html (injects og:url + canonical from SITE_URL env var) ──
// Must come before express.static so the route wins over the static file handler.
app.get('/', (_req, res) => {
  const cleanUrl = (process.env.SITE_URL || 'https://tudominio.com').replace(/[\\"'<>]/g, '').replace(/\/$/, '');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  // Inject og:url and canonical just after the og:type meta tag
  const injected = html.replace(
    '<meta property="og:type" content="website" />',
    `<meta property="og:type" content="website" />\n  <meta property="og:url" content="${cleanUrl}/" />\n  <link rel="canonical" href="${cleanUrl}/" />`
  );
  res.set('Cache-Control', 'no-cache').type('text/html').send(injected);
});

// Fuentes auto-alojadas: cache inmutable 1 año
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), {
  maxAge: '1y',
  immutable: true,
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

// Versioned assets (app.js?v=N, style.css?v=N) — always serve fresh, never cached.
// The version query string already busts any CDN or browser cache.
app.get('/app.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'app.js'));
});
app.get('/style.css', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Shared JS modules — served from webapp root (used by both Node.js and browser)
app.get('/player_ratings.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'player_ratings.js'));
});

// ── Config endpoint: injects site URL into the frontend ──────────────────────
// Loaded as /config.js — exposes only safe, non-secret config to the client.
app.get('/config.js', (_req, res) => {
  const safeUrl = SITE_URL.replace(/[\\"'<>]/g, '');
  res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').send(
    `window.GOLAZOX_CONFIG=${JSON.stringify({ siteUrl: safeUrl, version: '2.0' })};`
  );
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

// ════════════════════════════════════════════════════════════════════════════
// CAPA DE SEGURIDAD ANTI-DDOS / ANTI-SCRAPING / ANTI-BRUTEFORCE
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Bloqueo de bots y clientes automatizados (API endpoints) ──────────
// Regla: si el UA está vacío o coincide con herramientas CLI/scraping, devuelve
// 403. Los navegadores reales siempre envían un UA con "Mozilla/". Los crawlers
// SEO legítimos (Googlebot, Bingbot) nunca deberían llamar a los endpoints de
// la API, pero si lo hacen no se les bloquea para no romper indexación.
const _BLOCKED_UA_RE = /^(curl|wget|python[\s\-/]|scrapy|go-http-client|java\/|okhttp\/|axios\/|node-fetch|got\/|libwww|libcurl|perl\/|ruby\/|php\/|nikto|sqlmap|masscan|nmap|zgrab|nuclei[/ ]|dirbuster|gobuster|wfuzz|ffuf|hydra[/ ]|acunetix|nessus|burp|zap\/)/i;

const _apiBotBlock = (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || _BLOCKED_UA_RE.test(ua)) {
    console.warn(`[security:bot] BLOCKED IP=${req.ip} UA="${ua.slice(0, 120)}" ${req.method} ${req.path}`);
    return res.status(403).set('Retry-After', '3600').json({ error: 'Forbidden' });
  }
  next();
};
// Sólo se aplica a los endpoints de datos — NO a ficheros estáticos ni HTML
app.use(['/simulate', '/simulate-bulk', '/lookup', '/catalog', '/suggest', '/referees'], _apiBotBlock);

// ── 2. Presupuesto global de peticiones: 200 req / 5 min por IP ──────────
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
    console.warn(`[security:global-rl] IP=${req.ip} ${req.method} ${req.path} → HTTP 429`);
    res.status(options.statusCode)
       .set('Retry-After', String(Math.ceil(options.windowMs / 1000)))
       .json(options.message);
  },
}));

// ── 3. Slow-down progresivo en /simulate ─────────────────────────────────
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

// ── 4. Validación de Content-Type en /simulate ───────────────────────────
// Rechaza payloads que no sean JSON plano (bloquea formularios HTML y ataques
// de tipo content-type confusion que intentan bypassar parsers).
const _requireJSON = (req, res, next) => {
  const ct = req.headers['content-type'] || '';
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

// ── GET /catalog ──────────────────────────────
// Returns the full catalog of local teams + their available seasons.
// Cached for 5 min (re-run seed to update).
// Rate: 8/5min per IP (1.6/min) — it's a ~150 kB JSON payload with all 471 teams;
// a legitimate client loads it once at startup and caches it for 5 minutes.
app.get('/catalog', _rateLimit(8, 5 * 60000), (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(CATALOG);
});

// ── GET /suggest ─────────────────────────────
// Query: ?q=bar  → returns up to 15 matching {name, slug, badge} objects for autocomplete
// Rate: 40/min — fast autocomplete, pero con margen para que un bot necesite más.
app.get('/suggest', _rateLimit(40, 60000), (req, res) => {
  const q = String(req.query.q || '').replace(/[<>]/g, '').trim().toLowerCase().slice(0, 40);
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

// ── GET /badges ───────────────────────────────
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
<h1>⚽ Badge Gallery &nbsp;<small style="font-size:.7rem;color:#94a3b8">${_allTeams.length} equipos</small></h1>
<input id="f" placeholder="Filtrar…" oninput="document.querySelectorAll('.bg-card').forEach(c=>c.style.display=this.value&&!c.querySelector('.bg-name').textContent.toLowerCase().includes(this.value.toLowerCase())?'none':'')">
<div class="bg-grid">${rows}</div></body></html>`);
});

// ── GET /lookup ──────────────────────────────
// Query: ?team=Arsenal&era=2004
// Returns live squad data from local DB or TheSportsDB API
// Rate: 15/min — cada lookup puede llegar a hacer una llamada externa; 15 es
// más que suficiente para uso interactivo y inhibe el harvesting automatizado.
app.get('/lookup', _rateLimit(15, 60000), async (req, res) => {
  try {
    const sanitise = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 80);
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
      const formationOverride = String(req.query.formation || '').replace(/[^0-9\-]/g, '').trim();
      const lineup = buildLineupFromCache(result, formationOverride || '');
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

// ── POST /simulate ────────────────────────────
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
      const f = String(s || '').replace(/[^0-9\-]/g, '').trim();
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
      return res.status(404).json({ error: `¡Equipo no encontrado: "${dispA}"${sEraA ? ' (' + sEraA + ')' : ''}¡ Prueba sin año o con el nombre en inglés.` });
    }
    if (!luB.found) {
      return res.status(404).json({ error: `¡Equipo no encontrado: "${dispB}"${sEraB ? ' (' + sEraB + ')' : ''}¡ Prueba sin año o con el nombre en inglés.` });
    }

    // Apply pre-match player overrides (from user substitutions in the pre-match screen).
    // Sanitise each player: strip HTML, limit name to 60 chars, validate position code.
    const VALID_POSITIONS = new Set(['GK','RB','CB','LB','DM','CM','RM','LM','AM','RW','LW','ST']);
    const sanitisePlayers = (arr) => {
      if (!Array.isArray(arr) || arr.length < 8) return null;
      const cleaned = arr.slice(0, 25).map(p => ({
        name:     String(p.name || '').replace(/[<>]/g, '').trim().slice(0, 60),
        position: VALID_POSITIONS.has(String(p.position || '').toUpperCase()) ? String(p.position).toUpperCase() : null,
      })).filter(p => p.name.length > 0 && p.position);
      return cleaned.length >= 8 ? cleaned : null;
    };
    const cleanOverrideA = sanitisePlayers(playersOverrideA);
    const cleanOverrideB = sanitisePlayers(playersOverrideB);
    if (cleanOverrideA) luA.players = cleanOverrideA;
    if (cleanOverrideB) luB.players = cleanOverrideB;

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

// ── POST /simulate-bulk ───────────────────────────────────────────────────
// Batch simulator for tournaments. Accepts up to 50 match pairs, returns
// minimal results (score + optional penalties) — no narrative, no badges.
// Rate limit: 3 calls per minute per IP (each call can have up to 50 matches).
app.post('/simulate-bulk', _requireJSON, _apiBotBlock, _rateLimit(15, 60000), async (req, res) => {
  try {
    const { matches, lang: reqLang = 'es' } = req.body;
    const lang = reqLang === 'en' ? 'en' : 'es';

    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ error: 'matches array required' });
    }
    if (matches.length > 50) {
      return res.status(400).json({ error: 'max 50 matches per bulk call' });
    }

    const sanitise = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 80);

    // Build pairs and collect unique team lookup keys
    const _clampOvr = (v) => (v != null) ? Math.max(60, Math.min(99, Math.trunc(Number(v)) || 0)) || null : null;
    const teamPairs = matches.map((m, i) => ({
      slugA:    _resolveTeamSlug(sanitise(m.teamA)),
      slugB:    _resolveTeamSlug(sanitise(m.teamB)),
      eraA:     sanitise(m.eraA || ''),
      eraB:     sanitise(m.eraB || ''),
      salt:     (Math.trunc(Number(m.salt || i)) || 0) & 0x7fffffff,
      penalties: !!m.penalties,
      isFinal:  !!m.isFinal,
      ovrA:     _clampOvr(m.ovrA),
      ovrB:     _clampOvr(m.ovrB),
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
        formationA: effLuA.formation || '', formationB: effLuB.formation || '',
        cachedLineupA: effLuA, cachedLineupB: effLuB,
        matchMode: '11v11',
        matchSalt: pair.salt,
        refereeId: null, isFinal: pair.isFinal, weatherId: null,
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

// ── GET /referees ─────────────────────────────────────────────────────────
// Returns the full list of available referees (id, name, multipliers).
// Used by the client to populate the referee picker.
app.get('/referees', _rateLimit(30, 60000), (_req, res) => {
  res.json(REFEREES);
});

// Images are served as static files from public/img/ — no proxy needed.
// ── HTML escape helper (XSS prevention) ───────────────────
const _esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// ── Language helper — reads cookie or ?lang= param ────────
const _lang = (req) => {
  const q = req.query && req.query.lang;
  if (q === 'en' || q === 'es') return q;
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)golazox_lang=([^;]+)/);
  if (m && (m[1] === 'en' || m[1] === 'es')) return m[1];
  return 'es';
};
// ── Páginas legales (LSSI-CE / RGPD) ─────────────────────
const LEGAL_HTML = (title, body) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — GolazoX</title>
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

// ── Nodemailer transporter (optional — only active when EMAIL_PASS is set) ──
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
    else     console.log('[mail] SMTP ready → will email', OWNER_EMAIL);
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
      subject: `[GolazoX] ${subject || 'Nuevo mensaje de contacto'} – ${name}`,
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

// ── Contact form ────────────────────────────────────────────────────────────
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
  const honeypot = String(req.body.url || '').trim();
  if (honeypot.length > 0) {
    // Silent reject — return success to not hint to bots
    return res.type('text/html').send(LEGAL_HTML(lang === 'en' ? 'Message sent' : 'Mensaje enviado', `
      <h1>${lang === 'en' ? 'Message received ✓' : 'Mensaje recibido ✓'}</h1>
      <p><a href="/">${lang === 'en' ? 'Back to simulator' : 'Volver al simulador'}</a></p>`, lang));
  }
  const name    = String(req.body.name    || '').slice(0, 120).trim();
  const email   = String(req.body.email   || '').slice(0, 120).trim();
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  const message = String(req.body.message || '').slice(0, 2000).trim();

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

// ── Serve index.html for all other routes ─────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Process crash guards ─────────────────────
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
  console.log(`\n  ⚽  Football Simulator running at:`);
  console.log(`       http://localhost:${PORT}`);
  localIPs.forEach(ip => console.log(`       http://${ip}:${PORT}  ← use this on your iPhone`));
  console.log();
});
