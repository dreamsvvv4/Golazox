/**
 * Football Match Simulator — Express Backend
 * ─────────────────────────────────────────────
 * Start:  node server.js
 * API:    POST /simulate
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { simulateMatch, buildLineupFromCache } = require('./engine');
const { describeTimeline }                      = require('./narrator');
const { lookupTeam, fetchTeamBadge } = require('./lookup');
const { SQUADS }        = require('./squads');
const { REFEREES }      = require('./referee_logic');

const app  = express();
app.set('trust proxy', 1); // Correct req.ip behind nginx/Cloudflare
app.disable('x-powered-by');  // Don't expose server fingerprint
const PORT = process.env.PORT || 3000;

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

function _badgeFor(teamName) {
  if (!teamName) return BADGE_PLACEHOLDER;
  return _badgeMap.get(teamName.toLowerCase())
      || _badgeMap.get(teamName.toLowerCase().replace(/^(fc|ac|as|rc|sc|cd|ud|cf|ss|sk)\s+/i, ''))
      || BADGE_PLACEHOLDER;
}

// ── Middleware ────────────────────────────────
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Shared JS modules — served from webapp root (used by both Node.js and browser)
app.get('/player_ratings.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'player_ratings.js'));
});

// Security headers
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  // HSTS: only sent over HTTPS; harmless on HTTP (ignored by browsers then)
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Simple in-memory rate limiter (per IP)
const _rlBuckets = new Map();
function _rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key  = req.ip || 'unknown';
    const now  = Date.now();
    const slot = _rlBuckets.get(key) || { n: 0, reset: now + windowMs };
    if (now > slot.reset) { slot.n = 0; slot.reset = now + windowMs; }
    slot.n++;
    _rlBuckets.set(key, slot);
    if (slot.n > max) {
      res.set('Retry-After', Math.ceil((slot.reset - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }
    // Prune expired buckets to prevent unbounded memory growth
    if (_rlBuckets.size > 500) {
      for (const [k, v] of _rlBuckets) { if (now > v.reset) _rlBuckets.delete(k); }
    }
    next();
  };
}

// Whitelist of accepted formations (+ empty = auto)
const _VALID_FORMATIONS = new Set([
  '','4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2','4-5-1','4-1-4-1',
  '4-1-2-1-2','1-2-1','1-1-2','2-1-1','1-1','1-2','2-1','3-2','2-3',
]);

// ── GET /suggest ─────────────────────────────
// Query: ?q=bar  → returns up to 15 matching {name, badge} objects for autocomplete
app.get('/suggest', _rateLimit(60, 60000), (req, res) => {
  const q = String(req.query.q || '').replace(/[<>]/g, '').trim().toLowerCase().slice(0, 40);
  const matches = q.length < 1
    ? SQUAD_SUGGESTIONS.slice(0, 20)
    : SQUAD_SUGGESTIONS.filter(s => s.toLowerCase().includes(q)).slice(0, 15);
  const result = matches.map(name => ({ name, badge: _badgeFor(name) }));
  res.set('Cache-Control', 'no-store');
  res.json(result);
});

// ── GET /badges ───────────────────────────────
// Gallery page: returns all known teams with badges as HTML
app.get('/badges', _rateLimit(30, 60000), (_req, res) => {
  const rows = _allTeams.map(t =>
    `<div class="bg-card">`+
    `<img src="${t.badge.replace(/"/g,'&quot;')}" alt="" onerror="this.src='/img/badges/_placeholder.svg'">` +
    `<div class="bg-name">${t.name.replace(/</g,'&lt;')}</div>`+
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
app.get('/lookup', _rateLimit(30, 60000), async (req, res) => {
  try {
    const sanitise = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 80);
    const team = sanitise(req.query.team);
    const era  = sanitise(req.query.era);

    if (!team) return res.status(400).json({ found: false, error: 'team param required' });

    const result  = await lookupTeam(team, era);
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
      displayResult = { ...result, ...lineup };
    }
    res.set('Cache-Control', 'no-store');
    res.json({ ...displayResult, badgeUrl });
  } catch (err) {
    console.error('[/lookup error]', err.message);
    res.status(500).json({ found: false, error: 'Lookup failed.' });
  }
});

// ── POST /simulate ────────────────────────────
// Body: { teamA, teamB, eraA, eraB, formationA, formationB }
// Returns: { lineups, ratings, probabilities, finalScore, scorers, altScores, narrative }
app.post('/simulate', _rateLimit(15, 60000), async (req, res) => {
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

    // Fetch real lineups for both teams in parallel
    // Start badge fetches immediately (in parallel with team lookups)
    const mkBadgeRace = name => Promise.race([
      fetchTeamBadge(name),
      new Promise(r => setTimeout(() => r(null), 7000)),
    ]).catch(() => null);
    const badgeRaceA = mkBadgeRace(sTeamA);
    const badgeRaceB = mkBadgeRace(sTeamB);

    const [luA, luB] = await Promise.all([
      lookupTeam(sTeamA, sEraA),
      lookupTeam(sTeamB, sEraB),
    ]);

    // Reject simulation if either team was not found anywhere
    if (!luA.found) {
      return res.status(404).json({ error: `¡Equipo no encontrado: "${sTeamA}"${sEraA ? ' (' + sEraA + ')' : ''}¡ Prueba sin año o con el nombre en inglés.` });
    }
    if (!luB.found) {
      return res.status(404).json({ error: `¡Equipo no encontrado: "${sTeamB}"${sEraB ? ' (' + sEraB + ')' : ''}¡ Prueba sin año o con el nombre en inglés.` });
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
      teamA:      sTeamA,
      teamB:      sTeamB,
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
    const lang = reqLang === 'en' ? 'en' : 'es';
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

// ── GET /referees ─────────────────────────────────────────────────────────
// Returns the full list of available referees (id, name, multipliers).
// Used by the client to populate the referee picker.
app.get('/referees', _rateLimit(30, 60000), (_req, res) => {
  res.json(REFEREES);
});

// Images are served as static files from public/img/ — no proxy needed.

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
