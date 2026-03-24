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

// ── Poisson random variate via Knuth's algorithm ──────────────
function poissonSample(lambda, rand) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
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
// Named with football-flavoured generic identifiers to make output readable.
const GENERIC_NAMES = {
  GK:  ['Keeper', 'Portero', 'Goleiro'],
  RB:  ['Right-Back', 'Lateral D', 'Terzino D'],
  CB:  ['Stopper', 'Centre-Back', 'Difensore'],
  LB:  ['Left-Back', 'Lateral I', 'Terzino S'],
  DM:  ['Anchor', 'Mediano', 'Pivote'],
  CM:  ['Midfielder', 'Centrocampista', 'Milieu'],
  AM:  ['Trequartista', 'Mediapunta', 'Enganche'],
  RM:  ['Right-Mid', 'Interior D', 'Carrilero D'],
  LM:  ['Left-Mid', 'Interior I', 'Carrilero I'],
  RW:  ['Right-Wing', 'Extremo D', 'Ala D'],
  LW:  ['Left-Wing', 'Extremo I', 'Ala I'],
  ST:  ['Striker', 'Delantero', 'Centravanti'],
};

// Squad database — loaded from squads.js (60+ historical & modern teams).
// Falls back to generic placeholder XI for unrecognised teams.
const { SQUADS: KNOWN_SQUADS } = require('./squads');

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

  // Build a mutable pool of available players (scraper order is meaningful —
  // Transfermarkt/BDFutbol list main squad first within each position group)
  const pool = cached.players.map(p => ({ ...p, used: false }));

  const pickPlayerFor = (wantedPos) => {
    const affinities = POS_AFFINITY[wantedPos] || [wantedPos, 'CM'];
    for (const affPos of affinities) {
      const idx = pool.findIndex(p => !p.used && p.position === affPos);
      if (idx !== -1) { pool[idx].used = true; return pool[idx]; }
    }
    // Fallback: first unused player
    const idx = pool.findIndex(p => !p.used);
    if (idx !== -1) { pool[idx].used = true; return pool[idx]; }
    return null;
  };

  const players = template.map((pos, i) => {
    const p = pickPlayerFor(pos);
    return p
      ? { name: p.name, position: pos }
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
 */
function buildBench(teamInput, eraInput, knownSquadMatch, maxSize = 7) {
  const bench = [];
  // If the squad has more than 11 players defined, use extras first
  if (knownSquadMatch && knownSquadMatch.players.length > 11) {
    const extras = knownSquadMatch.players.slice(11);
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
  { tokens: ['juventus','milan','ac milan','inter','liverpool',
             'manchester city','city','chelsea','atletico'], atk: 5 },
  { tokens: ['arsenal','borussia dortmund','porto','napoli','bayer'], atk: 3 },
  { tokens: ['1970','1974','1982','1986','1994','1998','2002'], atk: 4 },
  // ── Defense elite ─────────────────────────────────────────
  { tokens: ['ac milan','milan','juventus','atletico','atletico madrid',
             'inter','chelsea','münchen','munich'], def: 6 },
  { tokens: ['manchester united','arsenal','porto','lyon'], def: 3 },
  { tokens: ['1989','1990','1994','2004','2006','2016'], def: 4 },
  // ── Midfield elite ────────────────────────────────────────
  { tokens: ['barcelona','barça','manchester city','city','ajax',
             'liverpool','real madrid'], mid: 6 },
  { tokens: ['juventus','münchen','munich','dortmund','chelsea'], mid: 3 },
  // ── Goalkeeping elite ─────────────────────────────────────
  { tokens: ['italy','italia','spain','españa','germany','deutschland',
             'france','frankreich'], gk: 4 },
  { tokens: ['real madrid','juventus','manchester united','milan','ac milan',
             'liverpool','arsenal'], gk: 3 },
  // ── Star player era tokens ─────────────────────────────────
  { tokens: ['zidane','guardiola','cruyff','ronaldo','messi','pelé','pele',
             'van basten','basten'], mid: 3, atk: 4 },
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

  // 2. Use scraper-provided ratings, boosted by half-strength prestige hints
  // so elite clubs are differentiated within the same league tier.
  if (scraperRatings) {
    let { attack: atk, midfield: mid, defense: def, goalkeeping: gk } = scraperRatings;
    for (const hint of RATING_HINTS) {
      for (const tok of hint.tokens) {
        if (hay.includes(tok)) {
          if (hint.atk) atk = Math.min(97, atk + Math.ceil(hint.atk / 2));
          if (hint.mid) mid = Math.min(97, mid + Math.ceil(hint.mid / 2));
          if (hint.def) def = Math.min(97, def + Math.ceil(hint.def / 2));
          if (hint.gk)  gk  = Math.min(97, gk  + Math.ceil(hint.gk  / 2));
        }
      }
    }
    const clamp = (v) => Math.max(60, Math.min(97, v));
    return { attack: clamp(atk), midfield: clamp(mid), defense: clamp(def), goalkeeping: clamp(gk) };
  }

  // 3. Heuristic fallback for unrecognised teams.
  let atk = 74, mid = 74, def = 74, gk = 72;

  for (const hint of RATING_HINTS) {
    for (const tok of hint.tokens) {
      if (hay.includes(tok)) {
        if (hint.atk) atk = Math.min(97, atk + hint.atk);
        if (hint.mid) mid = Math.min(97, mid + hint.mid);
        if (hint.def) def = Math.min(97, def + hint.def);
        if (hint.gk)  gk  = Math.min(97, gk  + hint.gk);
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
// 4. MONTE CARLO SIMULATOR
// ─────────────────────────────────────────────────────────────
const N_ITERATIONS = 30_000;

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
 */
function pickScorers(players, nGoals, rand) {
  if (nGoals === 0) return [];
  const pool    = players.filter(p => (SCORER_WEIGHTS[p.position] || 0) > 0);
  if (!pool.length) return [];
  const weights = pool.map(p => SCORER_WEIGHTS[p.position] || 0);
  const total   = weights.reduce((a, b) => a + b, 0);
  const result  = [];
  const usedMins = new Set();
  for (let g = 0; g < nGoals; g++) {
    let r = rand() * total;
    let scorer = pool[pool.length - 1];
    for (let j = 0; j < pool.length; j++) {
      r -= weights[j];
      if (r <= 0) { scorer = pool[j]; break; }
    }
    // Unique goal minute (1–95, including stoppage time)
    // Safety: if all 95 slots are taken just allow a duplicate rather than looping forever
    let minute;
    let _attempts = 0;
    do { minute = 1 + Math.floor(rand() * 95); _attempts++; } while (usedMins.has(minute) && _attempts < 95);
    usedMins.add(minute);
    result.push({ name: scorer.name, minute });
  }
  return result.sort((a, b) => a.minute - b.minute);
}

// ─────────────────────────────────────────────────────────────
// 6. CARD SIMULATOR
// ─────────────────────────────────────────────────────────────
// Position weights for yellow cards (DM/CB highest; GK lowest)
const YELLOW_WEIGHTS = { GK:0.3, RB:2.0, CB:2.5, LB:2.0, DM:3.0, CM:1.8, RM:1.5, LM:1.5, AM:1.2, RW:1.0, LW:1.0, ST:1.5 };
// Position weights for red cards (CB/DM highest; GK/wide lowest)
const RED_WEIGHTS    = { GK:0.1, RB:0.8, CB:1.8, LB:0.8, DM:1.5, CM:0.8, RM:0.4, LM:0.4, AM:0.6, RW:0.3, LW:0.3, ST:1.2 };

/**
 * Simulates yellow and red cards for one team.
 * Returns { yellow: [{name, minute}], red: [{name, minute}] }
 */
function pickCards(players, rand) {
  const nYellow = poissonSample(1.2,  rand);   // avg ~1.2 yellows per team per match
  const nRed    = poissonSample(0.10, rand);   // avg ~0.1 reds per team (~1 per 10 games)

  function pickWeighted(weightArr, n) {
    const total = weightArr.reduce((a, b) => a + b, 0);
    if (total === 0 || n === 0) return [];
    const result    = [];
    const usedNames = new Set();
    let safety = 0;
    while (result.length < n && safety++ < n * 20) {
      let r = rand() * total;
      for (let i = 0; i < players.length; i++) {
        r -= weightArr[i];
        if (r <= 0) {
          const p = players[i];
          if (!usedNames.has(p.name)) {
            usedNames.add(p.name);
            result.push({ name: p.name, minute: 1 + Math.floor(rand() * 90) });
          }
          break;
        }
      }
    }
    return result.sort((a, b) => a.minute - b.minute);
  }

  return {
    yellow: pickWeighted(players.map(p => YELLOW_WEIGHTS[p.position] || 0), nYellow),
    red:    pickWeighted(players.map(p => RED_WEIGHTS[p.position]    || 0), nRed),
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
function pickMatchPenalties(lineupA, lineupB, seed) {
  const rand = mulberry32(seed + 19);
  const nPen = poissonSample(0.42, rand);  // ~1 penalty every 2.5 games total
  const result = [];
  for (let i = 0; i < Math.min(nPen, 2); i++) {
    const side   = rand() < 0.5 ? 'A' : 'B';
    const lineup = side === 'A' ? lineupA : lineupB;
    const best   = lineup.players.filter(p => ['ST','AM','RW','LW','CM'].includes(p.position));
    const taker  = best.length ? best[Math.floor(rand() * best.length)] : lineup.players[Math.floor(rand() * lineup.players.length)];
    // Always scored=false: penalty misses are the only events worth showing
    // independently. Goals from penalty are already in scorersA/B.
    result.push({
      side,
      minute: 5 + Math.floor(rand() * 85),
      taker:  taker.name,
      scored: false,
    });
  }
  return result.sort((a, b) => a.minute - b.minute);
}

// ─────────────────────────────────────────────────────────────
// 7. PENALTY SHOOTOUT SIMULATOR
// ─────────────────────────────────────────────────────────────
// Kicker selection weights by position (best penalty takers first)
const PENALTY_KICK_WEIGHTS = { ST:5, AM:4, RW:4, LW:4, CM:3, RM:3, LM:3, DM:2, RB:1.5, LB:1.5, CB:1, GK:0.3 };

function simulatePenalties(lineupA, lineupB, ratingsA, ratingsB, seed) {
  const rand = mulberry32(seed + 13);

  // Conversion rate: base 76%, adjusted by attacker quality and opposing GK
  const convA = Math.min(0.88, Math.max(0.58, 0.76 + (ratingsA.attack      - 75) / 150 - (ratingsB.goalkeeping - 72) / 90));
  const convB = Math.min(0.88, Math.max(0.58, 0.76 + (ratingsB.attack      - 75) / 150 - (ratingsA.goalkeeping - 72) / 90));

  // Sort players by penalty-taking priority
  const byWeight = p => PENALTY_KICK_WEIGHTS[p.position] || 0;
  const kickersA = [...lineupA.players].sort((a, b) => byWeight(b) - byWeight(a));
  const kickersB = [...lineupB.players].sort((a, b) => byWeight(b) - byWeight(a));

  const shotsA = [], shotsB = [];
  let scoreA = 0, scoreB = 0;

  // Regulation 5 kicks
  for (let r = 0; r < 5; r++) {
    const goA = rand() < convA;
    const goB = rand() < convB;
    shotsA.push({ name: kickersA[r].name, scored: goA });
    shotsB.push({ name: kickersB[r].name, scored: goB });
    if (goA) scoreA++;
    if (goB) scoreB++;
    // Early finish: mathematically impossible to catch up
    const left = 4 - r;
    if (scoreA - scoreB > left || scoreB - scoreA > left) break;
  }

  // Sudden death
  let sd = 5, safety = 0;
  while (scoreA === scoreB && safety++ < 30) {
    const goA = rand() < convA;
    const goB = rand() < convB;
    shotsA.push({ name: kickersA[sd % kickersA.length].name, scored: goA });
    shotsB.push({ name: kickersB[sd % kickersB.length].name, scored: goB });
    if (goA) scoreA++;
    if (goB) scoreB++;
    if (goA !== goB) break;   // one scored and the other missed → winner decided
    sd++;
  }

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
                         cachedLineupA = null, cachedLineupB = null, matchMode = '11v11', matchSalt = 0 }) {
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
  const benchA = buildBench(teamA, eraA, cachedLineupA, benchSize);
  const benchB = buildBench(teamB, eraB, cachedLineupB, benchSize);

  // 2. Derive ratings — priority: known squads DB → scraper data → heuristic
  const ratingsA = deriveRatings(teamA, eraA, cachedLineupA?.ratings);
  const ratingsB = deriveRatings(teamB, eraB, cachedLineupB?.ratings);

  // 3. Deterministic seed from team names; saltedSeed varies per play for result variety
  const seed       = [...(teamA + teamB + eraA + eraB)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 17);
  const saltedSeed = (seed ^ ((matchSalt | 0) >>> 0)) >>> 0;

  // 4. Per-match form/luck variance — uses saltedSeed so each play differs
  const randForm = mulberry32(saltedSeed ^ 0xA3C5F1B7);
  const formA = 0.82 + randForm() * 0.36;   // multiplier 0.82–1.18
  const formB = 0.82 + randForm() * 0.36;

  // 5. Calculate xG (base formula × per-match form)
  const rawXgA = calcXG(ratingsA.attack, ratingsB.defense, ratingsA.midfield, ratingsB.goalkeeping);
  const rawXgB = calcXG(ratingsB.attack, ratingsA.defense, ratingsB.midfield, ratingsA.goalkeeping);
  const xgA = +Math.max(0.25, rawXgA * formA * modeGoalMult).toFixed(3);
  const xgB = +Math.max(0.25, rawXgB * formB * modeGoalMult).toFixed(3);

  // 6. Monte Carlo
  const sim = monteCarlo(xgA, xgB, seed);

  // 7. Final score — salted Poisson sample changes each simulation
  const singleRand = mulberry32(saltedSeed + 3);
  const fa = poissonSample(xgA, singleRand);
  const fb = poissonSample(xgB, singleRand);
  const rand     = mulberry32(saltedSeed + 1);
  const scorersA = pickScorers(lineupA.players, fa, rand);
  const scorersB = pickScorers(lineupB.players, fb, rand);
  const cardsA        = pickCards(lineupA.players, mulberry32(saltedSeed + 5));
  const cardsB        = pickCards(lineupB.players, mulberry32(saltedSeed + 7));
  const injuriesA     = pickInjuries(lineupA.players, mulberry32(saltedSeed + 11));
  const injuriesB     = pickInjuries(lineupB.players, mulberry32(saltedSeed + 13));
  const matchPenalties = pickMatchPenalties(lineupA, lineupB, saltedSeed);
  const penalties      = (fa === fb) ? simulatePenalties(lineupA, lineupB, ratingsA, ratingsB, saltedSeed) : null;

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
    stats:      buildStats(teamA, teamB, ratingsA, ratingsB, scorersA, scorersB, lineupA, lineupB, xgA, xgB, fa, fb, saltedSeed),
  };
}

// ─────────────────────────────────────────────────────────────
// 7. STATS BUILDER (possession, shots, man of match)
// ─────────────────────────────────────────────────────────────
function buildStats(teamA, teamB, ratingsA, ratingsB, scorersA, scorersB, lineupA, lineupB, xgA, xgB, fa, fb, seed) {
  const possA     = Math.round(ratingsA.midfield / (ratingsA.midfield + ratingsB.midfield) * 100);
  const shotsRand = mulberry32(seed + 9);
  const shotsA    = Math.max(fa, Math.round(xgA * 5.5 + shotsRand() * 3.5));
  const shotsB    = Math.max(fb, Math.round(xgB * 5.5 + shotsRand() * 3.5));

  const extraRand = mulberry32(seed + 15);
  const cornersA  = Math.max(1, Math.round(shotsA * 0.4 + extraRand() * 3));
  const cornersB  = Math.max(1, Math.round(shotsB * 0.4 + extraRand() * 3));
  const foulsA    = Math.max(3, Math.round(8 + (75 - ratingsA.defense) * 0.14 + extraRand() * 4));
  const foulsB    = Math.max(3, Math.round(8 + (75 - ratingsB.defense) * 0.14 + extraRand() * 4));
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
                   reason: top.count === 1 ? '1 gol' : `${top.count} goles` };
  } else {
    const domSide   = (ratingsA.attack + ratingsA.midfield) >= (ratingsB.attack + ratingsB.midfield) ? 'A' : 'B';
    const domLineup = domSide === 'A' ? lineupA : lineupB;
    const domName   = domSide === 'A' ? teamA : teamB;
    const keyPos    = ['AM', 'ST', 'CM', 'RW', 'LW', 'DM'];
    const cands     = domLineup.players.filter(p => keyPos.includes(p.position));
    const momR      = mulberry32(seed + 11);
    const picked    = cands[Math.floor(momR() * cands.length)] || domLineup.players[6];
    manOfMatch = { name: picked.name, team: domSide, teamName: domName, reason: 'Mejor en el campo' };
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

module.exports = { simulateMatch, buildLineupFromCache };
