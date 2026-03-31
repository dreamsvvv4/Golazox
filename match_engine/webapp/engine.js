/**
 * Simulador de Partidos de Fútbol — Motor de simulación
 * ════════════════════════════════════════════════════════════════
 * Funciones puras sin E/S ni red. Punto de entrada: simulateMatch()
 *
 * Flujo de simulación:
 *   1. buildLineup()      — construye el XI para cualquier equipo
 *   2. deriveRatings()    — calcula ATK/MID/DEF/GK desde la DB local
 *   3. calcXG()           — goles esperados por 90 min para cada equipo
 *   4. monteCarlo()       — 30 000 iteraciones Poisson
 *   5. pickScorers()      — selecciona goleadores con minuto de gol
 *   6. pickCards()        — simula tarjetas amarillas y rojas
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

const {
  getRefereeById,
  applyBigMatchPressure,
  calcCardRate,
  calcRedRate,
  calcPenaltyRate,
  calcFoulRate,
  calcPlayAdvantageXgBoost,
  buildRefereeStats,
  NEUTRAL_REFEREE,
} = require('./referee_logic');

// ── Weather effects lookup ─────────────────────────────────────
// goalMult applied to xgA/xgB; foulMult applied in buildStats.
const WEATHER_EFFECTS = {
  sunny:  { goalMult: 1.00, foulMult: 1.00 },
  cloudy: { goalMult: 0.97, foulMult: 1.00 },
  rain:   { goalMult: 0.88, foulMult: 1.10 },
  storm:  { goalMult: 0.76, foulMult: 1.18 },
  snow:   { goalMult: 0.82, foulMult: 1.07 },
  wind:   { goalMult: 0.93, foulMult: 1.04 },
  heat:   { goalMult: 0.91, foulMult: 1.10 },
  night:  { goalMult: 1.03, foulMult: 0.97 },  // artificial light, fast pitch, fewer fouls
};

// ── Deterministic PRNG (Mulberry32) ───────────────────────────
// Gives fully reproducible results for a given seed.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Poisson random variate ─────────────────────────────────────
// Knuth's exact algorithm for λ ≤ 30; normal approximation (Wilson-Hilferty)
// for λ > 30 to keep O(1) cost and avoid blocking the Event Loop.
// Hard cap at λ = 20 for game logic (no realistic football scenario exceeds this).
function poissonSample(lambda, rand) {
  if (lambda <= 0) return 0;
  const safeLambda = Math.min(lambda, 20); // hard cap — safety against runaway xG
  if (safeLambda > 15) {
    // Normal approximation: Poisson(λ) ≈ N(λ, λ) for large λ
    // Box-Muller transform with two PRNG draws
    const u1 = Math.max(1e-10, rand());
    const u2 = rand();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(safeLambda + z * Math.sqrt(safeLambda)));
  }
  const L = Math.exp(-safeLambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// ─────────────────────────────────────────────────────────────
// 1. LINEUP BUILDER
// ─────────────────────────────────────────────────────────────
// Positions for each formation row (GK + outfield 10)
const FORMATION_TEMPLATES = {
  '4-3-3': ['GK','RB','CB','CB','LB','DM','CM','CM','RW','ST','LW'],
  '4-4-2': ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
  '4-2-3-1':['GK','RB','CB','CB','LB','DM','DM','AM','RW','ST','LW'],
  '3-5-2': ['GK','CB','CB','CB','RM','CM','DM','CM','LM','ST','ST'],
  '3-4-3': ['GK','CB','CB','CB','RM','CM','DM','LM','RW','ST','LW'],
  '5-3-2': ['GK','RB','CB','CB','CB','LB','CM','CM','CM','ST','ST'],
  '4-5-1': ['GK','RB','CB','CB','LB','RM','CM','DM','CM','LM','ST'],
  '4-1-4-1':['GK','RB','CB','CB','LB','DM','RM','CM','CM','LM','ST'],
  // 5v5 (GK + 4 outfield)
  '1-2-1': ['GK','CB','CM','CM','ST'],
  '1-1-2': ['GK','CB','CM','RW','ST'],
  '2-1-1': ['GK','RB','LB','CM','ST'],
  // 3v3 (GK + 2 outfield)
  '1-1':   ['GK','CM','ST'],
  '1-2':   ['GK','AM','ST'],
};

const DEFAULT_FORMATION = '4-3-3';

// Generic player names pool (used when no real squad is known)
// Real-looking surnames so they read naturally in the event feed.
const GENERIC_NAMES = {
  GK:  ['García', 'Müller', 'Rossi'],
  RB:  ['Santos', 'Fernández', 'Becker'],
  CB:  ['Martínez', 'Silva', 'Wagner'],
  LB:  ['López', 'Costa', 'Fischer'],
  DM:  ['Rodríguez', 'Moreira', 'Schulz'],
  CM:  ['González', 'Ferreira', 'Schneider'],
  AM:  ['Hernández', 'Carvalho', 'Meyer'],
  RM:  ['Díaz', 'Oliveira', 'Braun'],
  LM:  ['Torres', 'Sousa', 'Klein'],
  RW:  ['Ramírez', 'Alves', 'Weber'],
  LW:  ['Flores', 'Pereira', 'Hartmann'],
  ST:  ['Sánchez', 'Lima', 'Hoffmann'],
};

// Squad database — loaded from squads.js (60+ historical & modern teams).
// Falls back to generic placeholder XI for unrecognised teams.
const { SQUADS: KNOWN_SQUADS } = require('./squads');
const { playerRating: _calcRating, getPlayerPosition: _getPos } = require('./player_ratings');

// Position affinity groups: which source positions can fill each template slot
const POS_AFFINITY = {
  GK:  ['GK'],
  RB:  ['RB','CB','DM'],
  CB:  ['CB','RB','LB','DM'],
  LB:  ['LB','CB','DM'],
  DM:  ['DM','CM','CB'],
  CM:  ['CM','DM','AM','RM','LM'],
  RM:  ['RM','CM','RW','AM'],
  LM:  ['LM','CM','LW','AM'],
  AM:  ['AM','CM','RW','LW'],
  RW:  ['RW','AM','ST','RM'],
  LW:  ['LW','AM','ST','LM'],
  ST:  ['ST','LW','RW','AM'],
};

/**
 * buildLineupFromCache(cached, formationOverride)
 * Converts a lookupTeam() result into the same shape as buildLineup().
 * For reduced modes (5v5, 3v3), selects players that best match the template
 * positions (GK first, then outfield by positional affinity).
 */
function buildLineupFromCache(cached, formationOverride) {
  const formation = formationOverride && FORMATION_TEMPLATES[formationOverride]
    ? formationOverride
    : cached.formation;
  const template = FORMATION_TEMPLATES[formation] || FORMATION_TEMPLATES[DEFAULT_FORMATION];

  // Build a mutable pool with fresh ratings; apply known-player position overrides
  // so e.g. Baresi stays CB even when BDFutbol lists all defenders as CB/def.
  const pool = cached.players
    .map(p => ({
      ...p,
      used: false,
      position: _getPos(p.name) || p.position,
      rating: (p.rating && p.rating > 0) ? p.rating : (_calcRating(p.name, p.marketValue) ?? p.rating),
    }));

  // Count how many players of each position the template needs
  const needed = {};
  for (const pos of template) needed[pos] = (needed[pos] || 0) + 1;

  // Pre-reserve the best exact-match players for each position so that a
  // world-class CB (e.g. Baresi) is never consumed to fill an RB slot.
  // Quality floor: only reserve if the player's rating is ≥ 63; below that,
  // the position falls through to the affinity fallback which can find a
  // better-rated player from an adjacent role (e.g. CM fills LM over a 55-rated LM).
  const RESERVE_MIN_RATING = 63;
  const reservedByPos = {};
  const reservedIdx   = new Set();
  for (const [pos, count] of Object.entries(needed)) {
    const exact = pool
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !reservedIdx.has(i) && p.position === pos && (p.rating || 0) >= RESERVE_MIN_RATING)
      .sort((a, b) => (b.p.rating || 0) - (a.p.rating || 0))
      .slice(0, count);
    reservedByPos[pos] = exact.map(({ i }) => i);
    exact.forEach(({ i }) => reservedIdx.add(i));
  }

  const pickPlayerFor = (wantedPos) => {
    // Use pre-reserved exact-match players first
    if (reservedByPos[wantedPos]?.length > 0) {
      const idx = reservedByPos[wantedPos].shift();
      pool[idx].used = true;
      return pool[idx];
    }
    // Fallback step 1: any exact-position player not yet reserved (e.g. GKs with no market value)
    // This prevents high-rated outfield players being grabbed for wrong positions (e.g. Míchel→GK)
    const exactUnreserved = pool
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !p.used && !reservedIdx.has(i) && p.position === wantedPos)
      .sort((a, b) => (b.p.rating || 0) - (a.p.rating || 0)); // DESC — best available for this pos
    if (exactUnreserved.length > 0) {
      pool[exactUnreserved[0].i].used = true;
      return pool[exactUnreserved[0].i];
    }
    // Fallback step 2: affinity chain; prefer LOWEST-rated to preserve stars for their natural slot
    const affinities = POS_AFFINITY[wantedPos] || [wantedPos, 'CM'];
    for (const affPos of affinities.slice(1)) {
      const candidates = pool
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => !p.used && !reservedIdx.has(i) && p.position === affPos)
        .sort((a, b) => (a.p.rating || 0) - (b.p.rating || 0)); // ASC — save best for natural pos
      if (candidates.length > 0) {
        reservedIdx.delete(candidates[0].i); // no longer reserved — consumed here
        pool[candidates[0].i].used = true;
        return pool[candidates[0].i];
      }
    }
    // Last resort: highest-rated unused, skip reserved unless it's all that's left
    const remaining = pool
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !p.used && !reservedIdx.has(i))
      .sort((a, b) => (b.p.rating || 0) - (a.p.rating || 0));
    if (remaining.length > 0) { pool[remaining[0].i].used = true; return pool[remaining[0].i]; }
    // Absolute last resort: take from reserved if nothing else is available
    const anyLeft = pool.map((p,i)=>({p,i})).filter(({p})=>!p.used)
      .sort((a,b)=>(b.p.rating||0)-(a.p.rating||0));
    if (anyLeft.length > 0) { pool[anyLeft[0].i].used = true; return pool[anyLeft[0].i]; }
    return null;
  };

  const players = template.map((pos, i) => {
    const p = pickPlayerFor(pos);
    return p
      ? { name: p.name, position: pos, rating: p.rating || undefined }
      : { name: 'Player ' + (i + 1), position: pos };
  });

  return {
    teamLabel: cached.teamLabel,
    formation,
    players,
    source: cached.source || 'External DB',
  };
}

/**
 * buildLineup(teamInput, eraInput, formationOverride)
 * Returns { teamLabel, formation, players[], source }
 */
function buildLineup(teamInput, eraInput, formationOverride) {
  const searchKey  = `${teamInput} ${eraInput}`.toLowerCase().trim();
  const teamOnly   = teamInput.toLowerCase().trim();

  // Try longest-match lookup in KNOWN_SQUADS (keys + aliases)
  let match = null;
  let matchKey = '';
  for (const key of Object.keys(KNOWN_SQUADS)) {
    const squad = KNOWN_SQUADS[key];
    const candidates = [key, ...(squad.aliases || [])];
    for (const cand of candidates) {
      if (searchKey.includes(cand) || teamOnly.includes(cand)) {
        if (cand.length > matchKey.length) { matchKey = key; match = squad; }
      }
    }
  }

  const formation = formationOverride && FORMATION_TEMPLATES[formationOverride]
    ? formationOverride
    : (match ? match.formation : DEFAULT_FORMATION);

  const template = FORMATION_TEMPLATES[formation] || FORMATION_TEMPLATES[DEFAULT_FORMATION];

  let players;
  let source;

  if (match) {
    // Use known squad — pick by positional affinity so 5v5/3v3 gets correct roles
    const pool2 = match.players.map(p => ({ ...p, used: false }));
    const pick2 = (wPos) => {
      const aff = POS_AFFINITY[wPos] || [wPos, 'CM'];
      for (const ap of aff) {
        const idx = pool2.findIndex(p => !p.used && p.position === ap);
        if (idx !== -1) { pool2[idx].used = true; return pool2[idx]; }
      }
      const idx = pool2.findIndex(p => !p.used);
      if (idx !== -1) { pool2[idx].used = true; return pool2[idx]; }
      return null;
    };
    players = template.map((pos, i) => {
      const p = pick2(pos);
      return p ? { name: p.name, position: pos } : { name: `Player ${i+1}`, position: pos };
    });
    source = `Known squad: "${matchKey}"`;
  } else {
    // Generate generic placeholder XI matching the formation template
    const positionCounters = {};
    players = template.map((pos) => {
      positionCounters[pos] = (positionCounters[pos] || 0) + 1;
      const namePool = GENERIC_NAMES[pos] || GENERIC_NAMES['CM'];
      const name = namePool[(positionCounters[pos] - 1) % namePool.length]
                 + ` ${positionCounters[pos] > 1 ? positionCounters[pos] : ''}`.trimEnd();
      return { name, position: pos };
    });
    source = `Generated placeholder XI (team "${teamInput}" not in known-squad database)`;
  }

  return {
    teamLabel: eraInput ? `${teamInput} (${eraInput})` : teamInput,
    formation,
    players,
    source,
  };
}

// ─────────────────────────────────────────────────────────────
// 1b. BENCH BUILDER
// ─────────────────────────────────────────────────────────────
// Typical bench: 1 GK + 2 defenders + 2 midfielders + 2 forwards
const BENCH_TEMPLATE = ['GK', 'CB', 'LB', 'DM', 'CM', 'AM', 'ST'];

/**
 * Builds a 7-player bench from the squad's extra players (if available),
 * or generates generic names matching BENCH_TEMPLATE positions.
 * starterNames: Set of player names already in the starting 11, to avoid duplicates.
 */
function buildBench(teamInput, eraInput, knownSquadMatch, maxSize = 7, starterNames = new Set()) {
  const bench = [];
  // If the squad JSON already has an explicit bench array, prefer those players
  const explicitBench = knownSquadMatch?.bench || [];
  if (explicitBench.length > 0) {
    explicitBench
      .filter(p => !starterNames.has(p.name))
      .slice(0, maxSize)
      .forEach((p, i) => {
        bench.push({ name: p.name, position: p.position || BENCH_TEMPLATE[i] || 'CM',
                     rating: p.rating || undefined, isReal: true });
      });
  } else if (knownSquadMatch) {
    // Fall back to extra players from the full squad when available (scraped/override squads)
    const pool = (knownSquadMatch.allPlayers || knownSquadMatch.players || []);
    const extras = pool
      .filter(p => !starterNames.has(p.name))
      .slice(0, maxSize);
    extras.forEach((p, i) => {
      bench.push({ name: p.name, position: p.position || BENCH_TEMPLATE[i] || 'CM', isReal: true });
    });
  }
  // Fill remaining slots with generic names
  const positionCounters = {};
  for (let i = bench.length; i < Math.min(BENCH_TEMPLATE.length, maxSize); i++) {
    const pos = BENCH_TEMPLATE[i];
    positionCounters[pos] = (positionCounters[pos] || 0) + 1;
    const namePool = GENERIC_NAMES[pos] || GENERIC_NAMES['CM'];
    const suffix   = positionCounters[pos] > 1 ? ` ${positionCounters[pos]}` : '';
    // Hash surname from team+era for light variety
    const h = [...(teamInput + eraInput + pos + i)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
    const name = namePool[h % namePool.length] + suffix;
    bench.push({ name, position: pos, isReal: false });
  }
  return bench.slice(0, maxSize);
}

// ─────────────────────────────────────────────────────────────
// 2. RATING DERIVER
// ─────────────────────────────────────────────────────────────
// Heuristics based on name tokens.  Pure function, no lookups.

const RATING_HINTS = [
  // ── Attack elite clubs/nations ────────────────────────────
  { tokens: ['real madrid','barcelona','barça','fc barcelona','brazil','brasil',
             'münchen','munich','ajax','psg'], atk: 7, mid: 6 },
  // Note: 'milan' removed — bare token ambiguous (AC Milan vs Inter Milan).
  // Use 'ac milan' or 'inter' explicitly in each hint.
  { tokens: ['juventus','ac milan','inter','liverpool',
             'manchester city','city','chelsea','atletico'], atk: 5 },
  { tokens: ['arsenal','borussia dortmund','porto','napoli','bayer',
             'marseille','olympique de marseille','benfica','sevilla',
             'boca juniors','river plate','flamengo'], atk: 3 },
  { tokens: ['celtic','galatasaray','fenerbahce','red star','crvena zvezda'], atk: 2 },
  { tokens: ['1970','1974','1982','1986','1994','1998','2002'], atk: 4 },
  // ── Defense elite ─────────────────────────────────────────
  { tokens: ['ac milan','milan','juventus','atletico','atletico madrid',
             'inter','chelsea','münchen','munich'], def: 6 },
  { tokens: ['manchester united','arsenal','porto','lyon','rangers'], def: 3 },
  { tokens: ['1989','1990','1994','2004','2006','2016'], def: 4 },
  // ── Midfield elite ────────────────────────────────────────
  { tokens: ['barcelona','barça','manchester city','city','ajax',
             'liverpool','real madrid'], mid: 6 },
  { tokens: ['juventus','münchen','munich','dortmund','chelsea',
             'benfica','marseille','celtic'], mid: 3 },
  // ── Goalkeeping elite ─────────────────────────────────────
  { tokens: ['italy','italia','spain','españa','germany','deutschland',
             'france','frankreich'], gk: 4 },
  { tokens: ['real madrid','juventus','manchester united','ac milan',
             'liverpool','arsenal'], gk: 3 },
  // ── Star player era tokens ─────────────────────────────────
  { tokens: ['zidane','guardiola','cruyff','ronaldo','messi','pelé','pele',
             'van basten','basten'], mid: 3, atk: 4 },
  { tokens: ['ronaldinho','ronaldinho gaucho'], mid: 3, atk: 3 },
  { tokens: ['mbappe','mbappé','kylian mbappe'], atk: 5 },
  { tokens: ['neymar','neymar jr'], atk: 4, mid: 2 },
  { tokens: ['lewandowski'], atk: 4 },
  { tokens: ['ibrahimovic','ibrahimović','zlatan'], atk: 4 },
  { tokens: ['henry','thierry henry'], atk: 4 },
  { tokens: ['de bruyne','kevin de bruyne'], mid: 5, atk: 2 },
  { tokens: ['xavi hernandez','xavi hernández'], mid: 4 },
  { tokens: ['iniesta','andrés iniesta'], mid: 4 },
  { tokens: ['modric','modrić'], mid: 4 },
  { tokens: ['pirlo','andrea pirlo'], mid: 4, def: 1 },
  { tokens: ['kaka','kaká'], mid: 3, atk: 2 },
  { tokens: ['figo','luís figo'], atk: 2, mid: 3 },
  { tokens: ['beckham','david beckham'], mid: 2, atk: 2 },
  { tokens: ['del piero','alessandro del piero'], atk: 3 },
  { tokens: ['shevchenko'], atk: 3 },
  { tokens: ['rooney','wayne rooney'], atk: 3 },
  { tokens: ['gerrard','steven gerrard'], mid: 3 },
  { tokens: ['lampard','frank lampard'], mid: 3 },
];

function deriveRatings(teamInput, eraInput, scraperRatings = null) {
  const hay = `${teamInput} ${eraInput}`.toLowerCase();

  // 1. If a known squad has explicit per-team ratings, use them directly.
  for (const key of Object.keys(KNOWN_SQUADS)) {
    const squad = KNOWN_SQUADS[key];
    const candidates = [key, ...(squad.aliases || [])];
    if (candidates.some(c => hay.includes(c)) && squad.ratings) {
      // Apply tiny hash micro-variation (±1) so identical teams aren't tied
      const hash = [...(teamInput + eraInput)].reduce((acc, c) => acc ^ c.charCodeAt(0), 0);
      const clamp = (v, lo=60, hi=97) => Math.max(lo, Math.min(hi, v));
      return {
        attack:     clamp(squad.ratings.attack     + ((hash & 0x03) - 1)),
        midfield:   clamp(squad.ratings.midfield   + (((hash >> 2) & 0x03) - 1)),
        defense:    clamp(squad.ratings.defense    + (((hash >> 4) & 0x03) - 1)),
        goalkeeping:clamp(squad.ratings.goalkeeping+ (((hash >> 6) & 0x03) - 1)),
      };
    }
  }

  // 2. Use scraper-provided ratings, boosted by prestige hints.
  // Suspicious ratings (avg < 70) indicate a bad league-context read during scraping;
  // floor them to a reasonable tier-2 baseline so elite clubs aren't under-rated.
  if (scraperRatings) {
    const avgSR = (scraperRatings.attack + scraperRatings.midfield +
                   scraperRatings.defense + scraperRatings.goalkeeping) / 4;
    const base  = avgSR >= 70
      ? scraperRatings
      : { attack: 73, midfield: 73, defense: 73, goalkeeping: 71 };
    let { attack: atk, midfield: mid, defense: def, goalkeeping: gk } = base;
    // Apply hints at 70% strength (was 50%) — better differentiation between elite / average
    for (const hint of RATING_HINTS) {
      for (const tok of hint.tokens) {
        if (hay.includes(tok)) {
          if (hint.atk) atk = Math.min(97, atk + Math.round(hint.atk * 0.7));
          if (hint.mid) mid = Math.min(97, mid + Math.round(hint.mid * 0.7));
          if (hint.def) def = Math.min(97, def + Math.round(hint.def * 0.7));
          if (hint.gk)  gk  = Math.min(97, gk  + Math.round(hint.gk  * 0.7));
          break; // apply each hint at most once
        }
      }
    }
    const clamp = (v) => Math.max(60, Math.min(97, v));
    return { attack: clamp(atk), midfield: clamp(mid), defense: clamp(def), goalkeeping: clamp(gk) };
  }

  // 3. Heuristic fallback for unrecognised teams.
  let atk = 74, mid = 74, def = 74, gk = 72;

  for (const hint of RATING_HINTS) {
    // Apply each hint at most once — break on first matching token to avoid double-bonus
    // when multiple tokens in the same hint match (e.g. "ac milan" matching both "ac milan" and "milan")
    for (const tok of hint.tokens) {
      if (hay.includes(tok)) {
        if (hint.atk) atk = Math.min(97, atk + hint.atk);
        if (hint.mid) mid = Math.min(97, mid + hint.mid);
        if (hint.def) def = Math.min(97, def + hint.def);
        if (hint.gk)  gk  = Math.min(97, gk  + hint.gk);
        break; // only apply each hint entry once
      }
    }
  }

  const hash = [...(teamInput + eraInput)].reduce((acc, c) => acc ^ c.charCodeAt(0), 0);
  atk += (hash & 0x07) - 3;
  mid += ((hash >> 3) & 0x07) - 3;
  def += ((hash >> 6) & 0x07) - 3;
  gk  += ((hash >> 9) & 0x03) - 1;

  const clamp = (v, lo=60, hi=97) => Math.max(lo, Math.min(hi, v));
  return { attack: clamp(atk), midfield: clamp(mid), defense: clamp(def), goalkeeping: clamp(gk) };
}

// ─────────────────────────────────────────────────────────────
// 3. xG CALCULATOR
// ─────────────────────────────────────────────────────────────
/**
 * Expected goals per 90 min.
 * Larger multipliers so rating differentials produce meaningful xG spread:
 *   - Equal teams (75 vs 75) → xG ≈ 1.15 each (varied by form factor)
 *   - Elite vs weak (95 vs 65) → xG ≈ 1.95 vs 0.35
 */
function calcXG(atkOwn, defOpp, midOwn, gkOpp) {
  const atkAdv = (atkOwn - defOpp) / 100;    // positive when attack > opponent defense
  const midAdv = (midOwn - 68)     / 100;    // midfield advantage over "average" tier
  const gkAdj  = (gkOpp  - 70)     / 100;    // positive = strong GK (suppresses goals)
  const base   = 1.15;
  const raw    = base + atkAdv * 2.2 + midAdv * 0.75 - gkAdj * 0.65;
  return Math.max(0.30, Math.min(3.5, raw));
}

// ─────────────────────────────────────────────────────────────
// 3b. DYNAMIC MATCH MODIFIERS
// ─────────────────────────────────────────────────────────────

/**
 * Returns a defense-effectiveness multiplier for minute-based stamina.
 * After minute 70, teams tire: defensive coverage weakens → attacking teams benefit.
 * Decay rate differs by play style:
 *   catenaccio → most disciplined (least decay, 0.6% per min over 70)
 *   posesion   → moderate decay (0.8% per min) — controlled but tired legs
 *   directo    → fastest decay (1.2% per min) — high-intensity pressing exhausts
 * Returns 1.0 before min 70, falling to a floor of 0.75.
 */
function staminaDecay(minute, playStyle = 'directo') {
  if (minute <= 70) return 1.0;
  const excess = minute - 70;
  const rate = { posesion: 0.008, directo: 0.012, catenaccio: 0.006 }[playStyle] || 0.010;
  return Math.max(0.75, 1.0 - excess * rate);
}

/**
 * Returns a scorer-weight multiplier for clutch players in pressure situations.
 * Requires player.isClutch === true, losing/drawing, and minute ≥ 80.
 */
function clutchModifier(isClutch, scoreDiff, minute) {
  return (isClutch && minute >= 80 && scoreDiff <= 0) ? 1.15 : 1.0;
}

/**
 * refereeModifier kept for backward compatibility (used nowhere internally anymore —
 * replaced by the calcCardRate / calcRedRate / calcPenaltyRate helpers in referee_logic).
 * @deprecated — use referee_logic helpers instead.
 */
function refereeModifier(strictness = 0.5, eventType) {
  const delta = strictness - 0.5;
  if (eventType === 'yellow')  return Math.max(0.4, 1.0 + delta * 0.60);
  if (eventType === 'red')     return Math.max(0.2, 1.0 + delta * 0.80);
  if (eventType === 'penalty') return Math.max(0.4, 1.0 + delta * 0.50);
  return 1.0;
}

/**
 * Picks a goal minute biased toward late minutes when play style promotes fatigue.
 * directo teams press intensely → higher late-goal probability;
 * catenaccio teams stay disciplined → more even distribution.
 */
function _staminaBiasedMinute(rand, playStyle = 'directo') {
  const lateExtra = { posesion: 0.18, directo: 0.32, catenaccio: 0.08 }[playStyle] || 0.22;
  const earlyW = 70;
  const lateW  = 25 * (1 + lateExtra);
  const r      = rand() * (earlyW + lateW);
  if (r < earlyW) return 1 + Math.floor(r);
  return 71 + Math.floor((r - earlyW) / lateW * 25);
}

// ─────────────────────────────────────────────────────────────
// 4. MONTE CARLO SIMULATOR
// ─────────────────────────────────────────────────────────────
const N_ITERATIONS = 10_000;

/**
 * monteCarlo(xgA, xgB, seed)
 * Returns { probA, probDraw, probB, topScores[], rawCounts{} }
 */
function monteCarlo(xgA, xgB, seed = 42) {
  const rand    = mulberry32(seed);
  let winsA = 0, winsB = 0, draws = 0;
  const scoreDist = {};

  for (let i = 0; i < N_ITERATIONS; i++) {
    const goalsA = poissonSample(xgA, rand);
    const goalsB = poissonSample(xgB, rand);
    const key    = `${goalsA}-${goalsB}`;
    scoreDist[key] = (scoreDist[key] || 0) + 1;

    if (goalsA > goalsB) winsA++;
    else if (goalsB > goalsA) winsB++;
    else draws++;
  }

  const top5 = Object.entries(scoreDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([score, count]) => ({
      score,
      probability: +((count / N_ITERATIONS) * 100).toFixed(2),
    }));

  return {
    probA:    +((winsA  / N_ITERATIONS) * 100).toFixed(1),
    probDraw: +((draws  / N_ITERATIONS) * 100).toFixed(1),
    probB:    +((winsB  / N_ITERATIONS) * 100).toFixed(1),
    topScores: top5,
    iterations: N_ITERATIONS,
  };
}

// ─────────────────────────────────────────────────────────────
// 5. SCORER PICKER
// ─────────────────────────────────────────────────────────────
const SCORER_WEIGHTS = { ST: 4, LW: 3, RW: 3, AM: 2, CM: 1, RM: 1, LM: 1, DM: 0.3, CB: 0.2, RB: 0.1, LB: 0.1, GK: 0 };

/**
 * Returns [{name, minute}] sorted by minute.
 * opts.playStyle  — enables stamina-biased minute selection (more late goals).
 * opts.scoreDiff  — final goals diff for this team (negative = losing); unlocks clutch bonus.
 */
function pickScorers(players, nGoals, rand, opts = {}) {
  if (nGoals === 0) return [];
  const pool     = players.filter(p => (SCORER_WEIGHTS[p.position] || 0) > 0);
  if (!pool.length) return [];
  const result   = [];
  const usedMins = new Set();

  for (let g = 0; g < nGoals; g++) {
    // ── 1. Assign minute (stamina-biased when playStyle is provided) ──
    let minute, _att = 0;
    if (opts.playStyle) {
      do { minute = _staminaBiasedMinute(rand, opts.playStyle); _att++; }
      while (usedMins.has(minute) && _att < 95);
    } else {
      do { minute = 1 + Math.floor(rand() * 95); _att++; }
      while (usedMins.has(minute) && _att < 95);
    }
    usedMins.add(minute);

    // ── 2. Apply clutch bonus: isClutch players get +15% weight when late & losing ──
    const weights = pool.map(p => {
      const base = SCORER_WEIGHTS[p.position] || 0;
      return base * clutchModifier(!!p.isClutch, opts.scoreDiff ?? 0, minute);
    });
    const total = weights.reduce((a, b) => a + b, 0);

    // ── 3. Weighted random scorer pick ──
    let r = rand() * total;
    let scorer = pool[pool.length - 1];
    for (let j = 0; j < pool.length; j++) {
      r -= weights[j];
      if (r <= 0) { scorer = pool[j]; break; }
    }
    result.push({ name: scorer.name, minute });
  }
  return result.sort((a, b) => a.minute - b.minute);
}

// ─────────────────────────────────────────────────────────────
// 6. CARD SIMULATOR
// ── Fix: reassign goals scored by expelled players ───────────
function _fixRedCardScorers(scorers, reds, players, rand) {
  if (!reds || !reds.length) return scorers;
  const redAt = {};
  reds.forEach(r => { redAt[r.name] = r.minute; });
  return scorers.map(g => {
    const expelled = redAt[g.name];
    if (expelled !== undefined && expelled <= g.minute) {
      const pool = players.filter(p =>
        (SCORER_WEIGHTS[p.position] || 0) > 0 &&
        p.name !== g.name &&
        (!redAt[p.name] || redAt[p.name] > g.minute)
      );
      if (pool.length) {
        return { ...g, name: pool[Math.floor(rand() * pool.length)].name };
      }
    }
    return g;
  });
}

// ─────────────────────────────────────────────────────────────
// Position weights for yellow cards (DM/CB highest; GK lowest)
const YELLOW_WEIGHTS = { GK:0.3, RB:2.0, CB:2.5, LB:2.0, DM:3.0, CM:1.8, RM:1.5, LM:1.5, AM:1.2, RW:1.0, LW:1.0, ST:1.5 };
// Position weights for red cards (CB/DM highest; GK/wide lowest)
const RED_WEIGHTS    = { GK:0.1, RB:0.8, CB:1.8, LB:0.8, DM:1.5, CM:0.8, RM:0.4, LM:0.4, AM:0.6, RW:0.3, LW:0.3, ST:1.2 };

/**
 * Simulates yellow and red cards for one team.
 * referee: full referee object from referee_logic.  Multipliers applied directly:
 *   P(yellow) = 1.2  × referee.strictness
 *   P(red)    = 0.10 × referee.red_card_bias
 * Returns { yellow: [{name, minute}], red: [{name, minute}] }
 */
function pickCards(players, rand, referee = NEUTRAL_REFEREE) {
  // Cap at players.length − 1 so we never request more unique cards than available players
  const maxCards = Math.max(0, players.length - 1);
  // play_advantage > 1.0 → ref lets play flow → fewer interruptions → fewer cards
  // Divide base rates by play_advantage so a lenient ref (1.15) gives ~13% fewer cards
  const pa = referee.play_advantage || 1.0;
  const nYellow  = Math.min(maxCards, poissonSample(calcCardRate(1.2  / pa, referee), rand));
  const nRed     = Math.min(maxCards - nYellow, poissonSample(calcRedRate(0.10 / pa, referee), rand));

  // Correct weighted sampling without replacement: rebuild eligible pool each pick
  function pickWeighted(weightMap, n) {
    if (n === 0) return [];
    const result  = [];
    const pool    = players.map((p, i) => ({ p, w: weightMap[p.position] || 0, i }))
                           .filter(x => x.w > 0);
    let remaining = [...pool];
    while (result.length < n && remaining.length > 0) {
      const total = remaining.reduce((s, x) => s + x.w, 0);
      if (total === 0) break;
      let r = rand() * total;
      let chosen = remaining[remaining.length - 1];
      for (const x of remaining) { r -= x.w; if (r <= 0) { chosen = x; break; } }
      result.push({ name: chosen.p.name, minute: 1 + Math.floor(rand() * 90) });
      remaining = remaining.filter(x => x.i !== chosen.i);
    }
    return result.sort((a, b) => a.minute - b.minute);
  }

  return {
    yellow: pickWeighted(YELLOW_WEIGHTS, nYellow),
    red:    pickWeighted(RED_WEIGHTS, nRed),
  };
}

// ─────────────────────────────────────────────────────────────
// 6b. INJURY SIMULATOR
// ─────────────────────────────────────────────────────────────
const INJURY_WEIGHTS = {
  ST:2.2, RW:2.0, LW:2.0, AM:1.8, CM:1.5, RM:1.5, LM:1.5,
  DM:1.2, RB:1.0, LB:1.0, CB:0.8, GK:0.05,
};
function pickInjuries(players, rand) {
  const result = [], used = new Set();
  for (let i = 0; i < 2; i++) {
    if (rand() > 0.28) continue;   // ~28% chance per attempt → avg ~0.56 injuries/team/match
    const avail = players.filter(p => !used.has(p.name));
    if (!avail.length) continue;
    const weights = avail.map(p => INJURY_WEIGHTS[p.position] || 1);
    const total   = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total, player = avail[avail.length - 1];
    for (let j = 0; j < avail.length; j++) { r -= weights[j]; if (r <= 0) { player = avail[j]; break; } }
    used.add(player.name);
    result.push({ name: player.name, minute: 12 + Math.floor(rand() * 72) }); // 12'–84'
  }
  return result.sort((a, b) => a.minute - b.minute);
}

// ─────────────────────────────────────────────────────────────
// 6c. IN-MATCH PENALTY EVENTS (not shootout)
// ─────────────────────────────────────────────────────────────
// Only missed penalties are generated as standalone events.
// Scored penalties are already reflected in scorersA/B via pickScorers,
// so showing a second ⚽ here would mismatch the final score.
function pickMatchPenalties(lineupA, lineupB, seed, referee = NEUTRAL_REFEREE, excludedA = new Set(), excludedB = new Set()) {
  const rand   = mulberry32(seed + 19);
  // P(penalty) = 0.42 × referee.penalty_rate
  const nPen   = poissonSample(calcPenaltyRate(0.42, referee), rand);  // base: ~1 penalty every 2.5 games
  const result = [];
  for (let i = 0; i < Math.min(nPen, 2); i++) {
    const side     = rand() < 0.5 ? 'A' : 'B';
    const lineup   = side === 'A' ? lineupA : lineupB;
    const excluded = side === 'A' ? excludedA : excludedB;
    const best   = lineup.players.filter(p => !excluded.has(p.name) && ['ST','AM','RW','LW','CM'].includes(p.position));
    const any    = lineup.players.filter(p => !excluded.has(p.name));
    const pool   = best.length ? best : any;
    const taker  = pool.length ? pool[Math.floor(rand() * pool.length)] : lineup.players[0];
    // Always scored=false: penalty misses are the only events worth showing
    // independently. Goals from penalty are already in scorersA/B.
    result.push({
      side,
      minute:      5 + Math.floor(rand() * 85),
      taker:       taker.name,
      scored:      false,
      refereeId:   referee.id,
      refereeName: referee.name,
    });
  }
  return result.sort((a, b) => a.minute - b.minute);
}

// ─────────────────────────────────────────────────────────────
// 7. PENALTY SHOOTOUT SIMULATOR
// ─────────────────────────────────────────────────────────────
// Kicker selection weights by position (best penalty takers first)
const PENALTY_KICK_WEIGHTS = { ST:5, AM:4, RW:4, LW:4, CM:3, RM:3, LM:3, DM:2, RB:1.5, LB:1.5, CB:1, GK:0.3 };

function simulatePenalties(lineupA, lineupB, ratingsA, ratingsB, seed, excludedA = new Set(), excludedB = new Set()) {
  const rand = mulberry32(seed + 13);

  // Conversion rate: base 76%, adjusted by attacker quality and opposing GK
  const convA = Math.min(0.88, Math.max(0.58, 0.76 + (ratingsA.attack      - 75) / 150 - (ratingsB.goalkeeping - 72) / 90));
  const convB = Math.min(0.88, Math.max(0.58, 0.76 + (ratingsB.attack      - 75) / 150 - (ratingsA.goalkeeping - 72) / 90));

  // Sort players by penalty-taking priority — exclude red-carded and injured players
  const byWeight = p => PENALTY_KICK_WEIGHTS[p.position] || 0;
  const kickersA = [...lineupA.players].filter(p => !excludedA.has(p.name)).sort((a, b) => byWeight(b) - byWeight(a));
  const kickersB = [...lineupB.players].filter(p => !excludedB.has(p.name)).sort((a, b) => byWeight(b) - byWeight(a));
  // Safety: if all players excluded (shouldn't happen), fall back to full squad minus GK
  const safeA = kickersA.length ? kickersA : lineupA.players.filter(p => p.position !== 'GK');
  const safeB = kickersB.length ? kickersB : lineupB.players.filter(p => p.position !== 'GK');

  const shotsA = [], shotsB = [];
  let scoreA = 0, scoreB = 0;

  // Regulation 5 kicks
  for (let r = 0; r < 5; r++) {
    const goA = rand() < convA;
    const goB = rand() < convB;
    shotsA.push({ name: safeA[r % safeA.length].name, scored: goA });
    shotsB.push({ name: safeB[r % safeB.length].name, scored: goB });
    if (goA) scoreA++;
    if (goB) scoreB++;
    // Early finish: mathematically impossible to catch up
    const left = 4 - r;
    if (scoreA - scoreB > left || scoreB - scoreA > left) break;
  }

  // Sudden death — max 20 extra rounds (40 kicks), statistically impossible to exhaust
  let sd = 5;
  for (let round = 0; round < 20 && scoreA === scoreB; round++) {
    const goA = rand() < convA;
    const goB = rand() < convB;
    shotsA.push({ name: safeA[sd % safeA.length].name, scored: goA });
    shotsB.push({ name: safeB[sd % safeB.length].name, scored: goB });
    if (goA) scoreA++;
    if (goB) scoreB++;
    if (goA !== goB) break; // one scored and the other missed → winner decided
    sd++;
  }
  // If still level after max rounds (P ≈ 0), break the tie by coin-toss using PRNG
  if (scoreA === scoreB) { if (rand() < 0.5) scoreA++; else scoreB++; }

  return {
    winner:      scoreA > scoreB ? 'A' : 'B',
    scoreA,
    scoreB,
    shotsA,
    shotsB,
    suddenDeath: shotsA.length > 5,
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT: simulateMatch(params) → result
// ─────────────────────────────────────────────────────────────
/**
 * Called by the Express route POST /simulate.
 * params: { teamA, teamB, eraA, eraB, formationA, formationB }
 */
function simulateMatch({ teamA, teamB, eraA = '', eraB = '', formationA = '', formationB = '',
                         cachedLineupA = null, cachedLineupB = null, matchMode = '11v11', matchSalt = 0,
                         mode = 'visual', refereeStrictness = 0.5,
                         refereeId = null, isFinal = false,
                         weatherId = null,
                         playStyleA = null, playStyleB = null }) {
  // Fast path: analysis mode skips lineup/event building entirely
  if (mode === 'analysis') {
    return analyzeMatch(teamA, teamB, eraA, eraB, cachedLineupA, cachedLineupB, matchMode, matchSalt);
  }
  // Fast path: penalties-only shootout — no 90-min match simulated
  if (matchMode === 'penalties') {
    const lineupA  = cachedLineupA ? buildLineupFromCache(cachedLineupA, '') : buildLineup(teamA, eraA, '');
    const lineupB  = cachedLineupB ? buildLineupFromCache(cachedLineupB, '') : buildLineup(teamB, eraB, '');
    const ratingsA = deriveRatings(teamA, eraA, cachedLineupA?.ratings);
    const ratingsB = deriveRatings(teamB, eraB, cachedLineupB?.ratings);
    const seed       = [...(teamA + teamB + eraA + eraB)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 17);
    const saltedSeed = (seed ^ ((matchSalt | 0) >>> 0)) >>> 0;
    const penalties  = simulatePenalties(lineupA, lineupB, ratingsA, ratingsB, saltedSeed);
    return {
      lineups: {
        teamA: { ...lineupA, xg: 0, bench: [] },
        teamB: { ...lineupB, xg: 0, bench: [] },
      },
      ratings: { teamA: ratingsA, teamB: ratingsB },
      probabilities: { teamA_win: 0.5, draw: 0, teamB_win: 0.5 },
      finalScore: {
        teamA: 0, teamB: 0, score: '0-0',
        scorersA: [], scorersB: [],
        cardsA: { yellow: [], red: [] },
        cardsB: { yellow: [], red: [] },
        matchPenalties: [], penalties,
        injuriesA: [], injuriesB: [],
      },
      altScores: [],
      simulation: { iterations: 0, xgA: 0, xgB: 0 },
      matchMode: 'penalties',
      timeline: [],
      stats: {
        possession: { teamA: 50, teamB: 50 },
        shots: { teamA: 0, teamB: 0 }, shotsOnTarget: { teamA: 0, teamB: 0 },
        corners: { teamA: 0, teamB: 0 }, fouls: { teamA: 0, teamB: 0 },
        yellowCards: 0, redCards: 0, saves: { teamA: 0, teamB: 0 },
        man_of_match: null, notableEvents: [],
      },
      referee_stats: { fouls: 0, yellow_cards: 0, red_cards: 0, penalties_awarded: penalties.shotsA.length + penalties.shotsB.length },
      referee: { id: null, name: null },
      weather: null,
      playStyle: { teamA: 'directo', teamB: 'directo' },
    };
  }
  // Resolve default formation per mode when caller didn't specify one
  const defaultFormByMode = { '5v5': '1-2-1', '3v3': '1-1', '11v11': '' };
  const smallSidedForms   = new Set(['1-2-1','1-1-2','2-1-1','1-1','1-2']);
  const defForm = defaultFormByMode[matchMode] || '';
  const isSmall = matchMode !== '11v11';
  // In small-sided modes, ignore 11v11 formation overrides from server fallback
  const fA = (isSmall && !smallSidedForms.has(formationA)) ? defForm : (formationA || defForm);
  const fB = (isSmall && !smallSidedForms.has(formationB)) ? defForm : (formationB || defForm);

  // Goals-per-match multiplier for small-sided games (fewer defenders → more goals)
  const modeGoalMult = matchMode === '5v5' ? 1.6 : matchMode === '3v3' ? 2.2 : 1.0;

  // 1. Build lineups — use pre-fetched API data when available
  const lineupA = cachedLineupA
    ? buildLineupFromCache(cachedLineupA, fA)
    : buildLineup(teamA, eraA, fA);
  const lineupB = cachedLineupB
    ? buildLineupFromCache(cachedLineupB, fB)
    : buildLineup(teamB, eraB, fB);

  // 1b. Build bench (7 subs for 11v11, fewer for small-sided)
  const benchSize = matchMode === '3v3' ? 2 : matchMode === '5v5' ? 3 : 7;
  const starterNamesA = new Set(lineupA.players.map(p => p.name));
  const starterNamesB = new Set(lineupB.players.map(p => p.name));
  const benchA = buildBench(teamA, eraA, cachedLineupA, benchSize, starterNamesA);
  const benchB = buildBench(teamB, eraB, cachedLineupB, benchSize, starterNamesB);

  // 2. Derive ratings — priority: known squads DB → scraper data → heuristic
  const ratingsA = deriveRatings(teamA, eraA, cachedLineupA?.ratings);
  const ratingsB = deriveRatings(teamB, eraB, cachedLineupB?.ratings);

  // 2b. Resolve play styles: explicit param > cached lineup metadata > sensible default
  const pStyleA = playStyleA || cachedLineupA?.playStyle || 'directo';
  const pStyleB = playStyleB || cachedLineupB?.playStyle || 'directo';

  // 3. Deterministic seed from team names; saltedSeed varies per play for result variety
  const seed       = [...(teamA + teamB + eraA + eraB)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 17);
  const saltedSeed = (seed ^ ((matchSalt | 0) >>> 0)) >>> 0;

  // 3b. Resolve referee — use seeded PRNG for big-match-pressure variance
  const randRef  = mulberry32(saltedSeed ^ 0xBEEF7A91);
  const baseRef  = getRefereeById(refereeId);
  const referee  = applyBigMatchPressure(baseRef, !!isFinal, randRef);

  // 4. Per-match form/luck variance — uses saltedSeed so each play differs
  const randForm = mulberry32(saltedSeed ^ 0xA3C5F1B7);
  const formA = 0.82 + randForm() * 0.36;   // multiplier 0.82–1.18
  const formB = 0.82 + randForm() * 0.36;

  // 5. Calculate xG (base formula × per-match form)
  const rawXgA = calcXG(ratingsA.attack, ratingsB.defense, ratingsA.midfield, ratingsB.goalkeeping);
  const rawXgB = calcXG(ratingsB.attack, ratingsA.defense, ratingsB.midfield, ratingsA.goalkeeping);
  const weatherFx  = WEATHER_EFFECTS[weatherId] || WEATHER_EFFECTS.sunny;
  const paXgBoost  = calcPlayAdvantageXgBoost(referee); // play_advantage > 1 → ref lets play flow → more open play
  const xgA = +Math.max(0.25, rawXgA * formA * modeGoalMult * weatherFx.goalMult * paXgBoost).toFixed(3);
  const xgB = +Math.max(0.25, rawXgB * formB * modeGoalMult * weatherFx.goalMult * paXgBoost).toFixed(3);

  // 6. Monte Carlo
  const sim = monteCarlo(xgA, xgB, seed);

  // 7. Final score — salted Poisson sample changes each simulation
  const singleRand = mulberry32(saltedSeed + 3);
  const fa = poissonSample(xgA, singleRand);
  const fb = poissonSample(xgB, singleRand);
  const rand     = mulberry32(saltedSeed + 1);
  // scoreDiff passed so clutchModifier can activate for late-match, losing situations
  let scorersA = pickScorers(lineupA.players, fa, rand, { playStyle: pStyleA, scoreDiff: fa - fb });
  let scorersB = pickScorers(lineupB.players, fb, rand, { playStyle: pStyleB, scoreDiff: fb - fa });
  const cardsA        = pickCards(lineupA.players, mulberry32(saltedSeed + 5), referee);
  const cardsB        = pickCards(lineupB.players, mulberry32(saltedSeed + 7), referee);
  // Red-carded players cannot score after their expulsion minute — reassign to a different player
  const fixRand = mulberry32(saltedSeed + 99);
  scorersA = _fixRedCardScorers(scorersA, cardsA.red, lineupA.players, fixRand);
  scorersB = _fixRedCardScorers(scorersB, cardsB.red, lineupB.players, fixRand);
  const injuriesA     = pickInjuries(lineupA.players, mulberry32(saltedSeed + 11));
  const injuriesB     = pickInjuries(lineupB.players, mulberry32(saltedSeed + 13));
  // Build excluded-player sets (red cards + injuries) before picking penalties
  const excludedA = new Set([
    ...(cardsA.red    || []).map(c => c.name),
    ...(injuriesA     || []).map(i => i.name),
  ]);
  const excludedB = new Set([
    ...(cardsB.red    || []).map(c => c.name),
    ...(injuriesB     || []).map(i => i.name),
  ]);
  const matchPenalties = pickMatchPenalties(lineupA, lineupB, saltedSeed, referee, excludedA, excludedB);
  const penalties      = (fa === fb) ? simulatePenalties(lineupA, lineupB, ratingsA, ratingsB, saltedSeed, excludedA, excludedB) : null;

  return {
    lineups: {
      teamA: { ...lineupA, xg: xgA, bench: benchA },
      teamB: { ...lineupB, xg: xgB, bench: benchB },
    },
    ratings: { teamA: ratingsA, teamB: ratingsB },
    probabilities: {
      teamA_win: sim.probA,
      draw:      sim.probDraw,
      teamB_win: sim.probB,
    },
    finalScore: {
      teamA:    fa,
      teamB:    fb,
      score:    `${fa}-${fb}`,
      scorersA,
      scorersB,
      cardsA,
      cardsB,
      matchPenalties,
      penalties,
      injuriesA,
      injuriesB,
    },
    altScores:  sim.topScores.slice(0, 4),
    simulation: { iterations: sim.iterations, xgA, xgB },
    // Referee identity exposed to client + narrator
    referee: { id: referee.id, name: referee.name },
    weather:  weatherId ? { id: weatherId, goalMult: weatherFx.goalMult, foulMult: weatherFx.foulMult } : null,
    ...(()=>{
      const stats    = buildStats(teamA, teamB, ratingsA, ratingsB, scorersA, scorersB, lineupA, lineupB, xgA, xgB, fa, fb, saltedSeed, { referee, weatherFoulMult: weatherFx.foulMult });
      const timeline = buildTimeline(scorersA, scorersB, cardsA, cardsB, injuriesA, injuriesB, matchPenalties, stats.notableEvents, referee, ratingsA, ratingsB, benchA, benchB);
      const referee_stats = buildRefereeStats(timeline, stats, matchPenalties);
      return { stats, timeline, referee_stats };
    })(),
    playStyle: { teamA: pStyleA, teamB: pStyleB },
  };
}

// ─────────────────────────────────────────────────────────────
// 7. STATS BUILDER (possession, shots, man of match)
// ─────────────────────────────────────────────────────────────
function buildStats(teamA, teamB, ratingsA, ratingsB, scorersA, scorersB, lineupA, lineupB, xgA, xgB, fa, fb, seed, args = {}) {
  const possA     = Math.round(ratingsA.midfield / (ratingsA.midfield + ratingsB.midfield) * 100);
  const shotsRand = mulberry32(seed + 9);
  const shotsA    = Math.max(fa, Math.round(xgA * 5.5 + shotsRand() * 3.5));
  const shotsB    = Math.max(fb, Math.round(xgB * 5.5 + shotsRand() * 3.5));

  const extraRand = mulberry32(seed + 15);
  const cornersA  = Math.max(1, Math.round(shotsA * 0.4 + extraRand() * 3));
  const cornersB  = Math.max(1, Math.round(shotsB * 0.4 + extraRand() * 3));
  // P(foul) = base_foul_rate × (2.0 − referee.foul_tolerance) — lenient refs call fewer fouls
  const wFoul     = args.weatherFoulMult || 1.0;
  const foulBase  = referee => Math.max(3, Math.round(8 + (75 - (referee || 74)) * 0.14 + extraRand() * 4));
  const foulsA    = Math.max(2, Math.round(calcFoulRate(foulBase(ratingsA.defense), args.referee || NEUTRAL_REFEREE) * wFoul));
  const foulsB    = Math.max(2, Math.round(calcFoulRate(foulBase(ratingsB.defense), args.referee || NEUTRAL_REFEREE) * wFoul));
  const savesA    = Math.max(0, shotsB - fb);
  const savesB    = Math.max(0, shotsA - fa);

  // Notable corner + dangerous free kick events for the timeline Chronicle
  const evRand = mulberry32(seed + 21);
  const notableEvents = [];
  // up to 2 corner events per team (proportional to total)
  const nCornerEvA = Math.min(2, Math.floor(cornersA / 3));
  const nCornerEvB = Math.min(2, Math.floor(cornersB / 3));
  for (let i = 0; i < nCornerEvA; i++) notableEvents.push({ type: 'corner',   side: 'A', minute: 3  + Math.floor(evRand() * 87) });
  for (let i = 0; i < nCornerEvB; i++) notableEvents.push({ type: 'corner',   side: 'B', minute: 3  + Math.floor(evRand() * 87) });
  // 1 dangerous free kick per team
  const fkA = lineupA.players.filter(p => ['AM','CM','RW','LW','DM'].includes(p.position));
  const fkB = lineupB.players.filter(p => ['AM','CM','RW','LW','DM'].includes(p.position));
  if (fkA.length) notableEvents.push({ type: 'freekick', side: 'A', minute: 5  + Math.floor(evRand() * 85), name: fkA[Math.floor(evRand() * fkA.length)].name });
  if (fkB.length) notableEvents.push({ type: 'freekick', side: 'B', minute: 5  + Math.floor(evRand() * 85), name: fkB[Math.floor(evRand() * fkB.length)].name });

  // Man of the match — top scorer or best field player from dominant team
  const allGoals = [
    ...scorersA.map(s => ({ ...s, side: 'A', teamName: teamA })),
    ...scorersB.map(s => ({ ...s, side: 'B', teamName: teamB })),
  ];
  let manOfMatch;
  if (allGoals.length) {
    const counts = {};
    allGoals.forEach(g => { counts[g.name] = counts[g.name] || { ...g, count: 0 }; counts[g.name].count++; });
    const top = Object.values(counts).sort((a, b) => b.count - a.count)[0];
    manOfMatch = { name: top.name, team: top.side, teamName: top.teamName,
                   reason: { type: 'goals', count: top.count } };
  } else {
    const domSide   = (ratingsA.attack + ratingsA.midfield) >= (ratingsB.attack + ratingsB.midfield) ? 'A' : 'B';
    const domLineup = domSide === 'A' ? lineupA : lineupB;
    const domName   = domSide === 'A' ? teamA : teamB;
    const keyPos    = ['AM', 'ST', 'CM', 'RW', 'LW', 'DM'];
    const cands     = domLineup.players.filter(p => keyPos.includes(p.position));
    const momR      = mulberry32(seed + 11);
    const picked    = cands[Math.floor(momR() * cands.length)] || domLineup.players[6];
    manOfMatch = { name: picked.name, team: domSide, teamName: domName, reason: { type: 'best_field' } };
  }

  return {
    possession:    { teamA: possA,    teamB: 100 - possA },
    shots:         { teamA: shotsA,   teamB: shotsB   },
    corners:       { teamA: cornersA, teamB: cornersB },
    fouls:         { teamA: foulsA,   teamB: foulsB   },
    saves:         { teamA: savesA,   teamB: savesB   },
    notableEvents,
    manOfMatch,
  };
}

// ─────────────────────────────────────────────────────────────
// 8. TIMELINE BUILDER
// ─────────────────────────────────────────────────────────────
/**
 * Merges all match events into a single chronological array with a running score
 * attached to each event.  Used by visual-mode clients to animate the match
 * minute-by-minute (1 real second = 1 match minute).
 *
 * @returns {Array<{minute, type, side, player, scoreA, scoreB}>}
 */
function buildTimeline(scorersA, scorersB, cardsA, cardsB, injuriesA, injuriesB, matchPenalties, notableEvents, referee = null, ratingsA = null, ratingsB = null, benchA = [], benchB = []) {
  const all = [];

  // Each card/penalty event carries referee identity so the narrator can personalise phrases.
  const refTag = referee
    ? { refereeId: referee.id, refereeName: referee.name }
    : {};

  // Player rating proxy: use team-level ratings so the narrator can pick elite/good/average phrases.
  // Scorers inherit team attack rating; card recipients inherit team defense rating.
  const atkA = ratingsA?.attack     || 75;
  const atkB = ratingsB?.attack     || 75;
  const defA = ratingsA?.defense    || 75;
  const defB = ratingsB?.defense    || 75;

  (scorersA     || []).forEach(e => all.push({ minute: e.minute, type: 'goal',   side: 'A', player: e.name, playerRating: atkA }));
  (scorersB     || []).forEach(e => all.push({ minute: e.minute, type: 'goal',   side: 'B', player: e.name, playerRating: atkB }));
  (cardsA?.yellow || []).forEach(e => all.push({ minute: e.minute, type: 'yellow', side: 'A', player: e.name, playerRating: defA, ...refTag }));
  (cardsB?.yellow || []).forEach(e => all.push({ minute: e.minute, type: 'yellow', side: 'B', player: e.name, playerRating: defB, ...refTag }));
  (cardsA?.red    || []).forEach(e => all.push({ minute: e.minute, type: 'red',    side: 'A', player: e.name, playerRating: defA, ...refTag }));
  (cardsB?.red    || []).forEach(e => all.push({ minute: e.minute, type: 'red',    side: 'B', player: e.name, playerRating: defB, ...refTag }));

  // Injuries + automatic substitution: pick a bench player of the same/similar position
  const _posGroup = p => {
    if (!p) return 'out';
    if (p === 'GK') return 'GK';
    if (['CB','RB','LB'].includes(p)) return 'DEF';
    if (['DM','CM','RM','LM'].includes(p)) return 'MID';
    return 'ATT'; // AM, RW, LW, ST
  };
  const _pickSub = (injuredPos, usedSubs, bench) => {
    if (!bench || !bench.length) return null;
    const group = _posGroup(injuredPos);
    // Only real bench players; never use GK to replace an outfield player
    const real = bench.filter(p => p.isReal === true && !usedSubs.has(p.name));
    const pool = group !== 'GK' ? real.filter(p => p.position !== 'GK') : real;
    if (!pool.length) return null;
    const sameGroup = pool.filter(p => _posGroup(p.position) === group);
    return sameGroup[0] || pool[0];
  };
  const usedSubsA = new Set(), usedSubsB = new Set();
  const injAList  = injuriesA || [];
  const injBList  = injuriesB || [];
  const _findStarterPos = (players, name) => (players || []).find(p => p.name === name)?.position;

  // Collect starter lists for position lookup
  // (injuriesA/B only carry name+minute — position must be looked up from scorersA/B context or bench)
  // We approximate: flag the injury event and attach sub info
  injAList.forEach(e => {
    all.push({ minute: e.minute, type: 'injury', side: 'A', player: e.name, playerRating: atkA });
    const sub = _pickSub(e.position, usedSubsA, benchA);
    if (sub) {
      usedSubsA.add(sub.name);
      all.push({ minute: e.minute + 1, type: 'sub', side: 'A', playerOut: e.name, playerIn: sub.name });
    }
  });
  injBList.forEach(e => {
    all.push({ minute: e.minute, type: 'injury', side: 'B', player: e.name, playerRating: atkB });
    const sub = _pickSub(e.position, usedSubsB, benchB);
    if (sub) {
      usedSubsB.add(sub.name);
      all.push({ minute: e.minute + 1, type: 'sub', side: 'B', playerOut: e.name, playerIn: sub.name });
    }
  });
  (matchPenalties || []).forEach(e =>
    all.push({ minute: e.minute, type: e.scored ? 'penalty' : 'penalty_miss', side: e.side, player: e.taker,
               playerRating: e.side === 'A' ? atkA : atkB,
               refereeId: e.refereeId || refTag.refereeId, refereeName: e.refereeName || refTag.refereeName }));
  (notableEvents || []).filter(e => e.type === 'corner' || e.type === 'freekick')
    .forEach(e => all.push({ minute: e.minute, type: e.type, side: e.side, player: e.name || null }));

  all.sort((a, b) => a.minute - b.minute);

  // Attach running score at each event
  let sA = 0, sB = 0;
  for (const ev of all) {
    if (ev.type === 'goal') { ev.side === 'A' ? sA++ : sB++; }
    ev.scoreA = sA;
    ev.scoreB = sB;
  }
  return all;
}

// ─────────────────────────────────────────────────────────────
// 9. ANALYSIS MODE (10 000-iteration fast path)
// ─────────────────────────────────────────────────────────────
/**
 * Skips lineup building and event generation.
 * Returns only win/draw/loss percentages and top scorelines from 10,000 simulations.
 */
function analyzeMatch(teamA, teamB, eraA, eraB, cachedLineupA, cachedLineupB, matchMode, matchSalt) {
  const N            = 10_000;
  const modeGoalMult = matchMode === '5v5' ? 1.6 : matchMode === '3v3' ? 2.2 : 1.0;
  const ratingsA     = deriveRatings(teamA, eraA, cachedLineupA?.ratings);
  const ratingsB     = deriveRatings(teamB, eraB, cachedLineupB?.ratings);
  const rawXgA       = calcXG(ratingsA.attack, ratingsB.defense,  ratingsA.midfield, ratingsB.goalkeeping);
  const rawXgB       = calcXG(ratingsB.attack, ratingsA.defense,  ratingsB.midfield, ratingsA.goalkeeping);
  const seed         = [...(teamA + teamB + eraA + eraB)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);
  const rand         = mulberry32((seed ^ ((matchSalt | 0) >>> 0)) >>> 0);

  let winsA = 0, draws = 0, winsB = 0;
  const scoreDist = {};
  for (let i = 0; i < N; i++) {
    const formA = 0.82 + rand() * 0.36;
    const formB = 0.82 + rand() * 0.36;
    const ga    = poissonSample(Math.max(0.25, rawXgA * formA * modeGoalMult), rand);
    const gb    = poissonSample(Math.max(0.25, rawXgB * formB * modeGoalMult), rand);
    const key   = `${ga}-${gb}`;
    scoreDist[key] = (scoreDist[key] || 0) + 1;
    if (ga > gb) winsA++;
    else if (gb > ga) winsB++;
    else draws++;
  }

  const topScores = Object.entries(scoreDist)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([score, count]) => ({ score, probability: +((count / N) * 100).toFixed(2) }));

  return {
    mode: 'analysis',
    iterations: N,
    ratings:  { teamA: ratingsA, teamB: ratingsB },
    xg:       { teamA: +rawXgA.toFixed(3), teamB: +rawXgB.toFixed(3) },
    probabilities: {
      teamA_win: +((winsA / N) * 100).toFixed(1),
      draw:      +((draws / N) * 100).toFixed(1),
      teamB_win: +((winsB / N) * 100).toFixed(1),
    },
    topScores,
  };
}

module.exports = { simulateMatch, analyzeMatch, buildLineupFromCache, deriveRatings };
