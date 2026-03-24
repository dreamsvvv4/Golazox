/**
 * Football Match Simulator — Express Backend
 * ─────────────────────────────────────────────
 * Start:  node server.js
 * API:    POST /simulate
 */

const express = require('express');
const path    = require('path');
const { simulateMatch, buildLineupFromCache } = require('./engine');
const { lookupTeam, fetchTeamBadge } = require('./lookup');
const { SQUADS }        = require('./squads');

const app  = express();
const PORT = process.env.PORT || 3000;

// Pre-build autocomplete list from local squad DB (capitalised, sorted)
const SQUAD_SUGGESTIONS = [...new Set(
  Object.keys(SQUADS).map(k => k.replace(/\b\w/g, c => c.toUpperCase()))
)].sort();

// ── Middleware ────────────────────────────────
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https://upload.wikimedia.org https://commons.wikimedia.org https://www.thesportsdb.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
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
    if (slot.n > max) return res.status(429).json({ error: 'Too many requests. Please wait.' });
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
// Query: ?q=bar  → returns up to 15 matching squad names for autocomplete
app.get('/suggest', (req, res) => {
  const q = String(req.query.q || '').replace(/[<>]/g, '').trim().toLowerCase().slice(0, 40);
  const matches = q.length < 1
    ? SQUAD_SUGGESTIONS.slice(0, 20)
    : SQUAD_SUGGESTIONS.filter(s => s.toLowerCase().includes(q)).slice(0, 15);
  res.json(matches);
});

// ── GET /lookup ──────────────────────────────
// Query: ?team=Arsenal&era=2004
// Returns live squad data from local DB or TheSportsDB API
app.get('/lookup', async (req, res) => {
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
      const sanitiseFormation = (s) => {
        const f = String(s || '').replace(/[^0-9\-]/g, '').trim();
        return _VALID_FORMATIONS && _VALID_FORMATIONS.has(f) ? f : s;
      };
      const formationOverride = String(req.query.formation || '').replace(/[^0-9\-]/g, '').trim();
      const lineup = buildLineupFromCache(result, formationOverride || '');
      displayResult = { ...result, ...lineup };
    }
    res.json({ ...displayResult, badgeUrl });
  } catch (err) {
    console.error('[/lookup error]', err);
    res.status(500).json({ found: false, error: 'Lookup failed.' });
  }
});

// ── POST /simulate ────────────────────────────
// Body: { teamA, teamB, eraA, eraB, formationA, formationB }
// Returns: { lineups, ratings, probabilities, finalScore, scorers, altScores, narrative }
app.post('/simulate', _rateLimit(15, 60000), async (req, res) => {
  try {
    const { teamA, teamB, eraA = '', eraB = '', formationA = '', formationB = '', matchMode = '11v11', matchSalt = 0 } = req.body;

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

    const params = {
      teamA:      sTeamA,
      teamB:      sTeamB,
      eraA:       sEraA,
      eraB:       sEraB,
      formationA:    sanitiseFormation(formationA) || (luA.found ? luA.formation : ''),
      formationB:    sanitiseFormation(formationB) || (luB.found ? luB.formation : ''),
      cachedLineupA: luA.found ? luA : null,
      cachedLineupB: luB.found ? luB : null,
      matchMode:     ['11v11','5v5','3v3'].includes(matchMode) ? matchMode : '11v11',
      matchSalt:     (Math.trunc(Number(matchSalt || 0)) || 0) & 0x7fffffff,
    };

    const [badgeA, badgeB] = await Promise.all([
      luA.badgeUrl ? Promise.resolve(luA.badgeUrl) : badgeRaceA,
      luB.badgeUrl ? Promise.resolve(luB.badgeUrl) : badgeRaceB,
    ]);

    const result = { ...simulateMatch(params), badgeA, badgeB };
    res.json(result);

  } catch (err) {
    console.error('[/simulate error]', err);
    res.status(500).json({ error: 'Simulation failed. Check server logs.' });
  }
});

// ── GET /img-proxy  ─────────────────────────────────────────────────────────
// Proxies images from Wikimedia Commons (follows Special:FilePath redirects).
// Only allows wikimedia.org domains to prevent SSRF.
app.get('/img-proxy', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();
  if (!/^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org)\//.test(rawUrl)) {
    return res.status(400).send('Forbidden');
  }
  try {
    const r = await fetch(rawUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'FootballSimBot/1.0 (educational project; contact: localhost)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return res.status(r.status).send('Image not found');
    const ct = r.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    console.warn('[img-proxy]', e.message);
    res.status(502).send('Image fetch failed');
  }
});

// ── Serve index.html for all other routes ─────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ⚽  Football Simulator running at http://localhost:${PORT}\n`);
});
