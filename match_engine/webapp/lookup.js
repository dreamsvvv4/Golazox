/**
 * lookup.js — Live squad lookup
 * ═══════════════════════════════════════════════════════════════
 * Priority:
 *   1. Local squads.js DB  (historical + curated data)
 *   2. TheSportsDB free API (current rosters, no API key needed)
 *   3. Returns null → engine falls back to generic placeholder XI
 *
 * TheSportsDB API v1 (free key "3"), no auth:
 *   https://www.thesportsdb.com/api/v1/json/3/
 * Rate limit: ~20 req/s; well within typical usage.
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const { SQUADS }                    = require('./squads');
const { lookupWikipedia }           = require('./wikipedia');
const { fetchBdfutbolSquad }        = require('./bdfutbol');
const { fetchTransfermarktSquad }   = require('./transfermarkt');

const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const FETCH_TIMEOUT = 12000; // ms

// ─────────────────────────────────────────────────────────────
// Position mapper: TheSportsDB → internal codes
// ─────────────────────────────────────────────────────────────
const POS_EXACT = {
  'goalkeeper':           'GK',
  'centre-back':          'CB',
  'centre back':          'CB',
  'right back':           'RB',
  'right-back':           'RB',
  'left back':            'LB',
  'left-back':            'LB',
  'defensive midfielder': 'DM',
  'central midfielder':   'CM',
  'attacking midfielder': 'AM',
  'right midfielder':     'RM',
  'left midfielder':      'LM',
  'right winger':         'RW',
  'left winger':          'LW',
  'centre forward':       'ST',
  'striker':              'ST',
  'forward':              'ST',
  'midfielder':           'CM',
  'defender':             'CB',
};

function mapPos(raw) {
  if (!raw) return 'CM';
  const p = raw.toLowerCase().trim();
  if (POS_EXACT[p]) return POS_EXACT[p];
  if (p.includes('goal'))                              return 'GK';
  if (p.includes('right back') || p === 'rb')          return 'RB';
  if (p.includes('left back')  || p === 'lb')          return 'LB';
  if (p.includes('centre back') || p.includes('center back') || p.includes('centreback')) return 'CB';
  if (p.includes('right wing'))                        return 'RW';
  if (p.includes('left wing'))                         return 'LW';
  if (p.includes('attack'))                            return 'AM';
  if (p.includes('defens'))                            return 'CB';
  if (p.includes('right mid'))                         return 'RM';
  if (p.includes('left mid'))                          return 'LM';
  if (p.includes('mid'))                               return 'CM';
  if (p.includes('forw') || p.includes('strik'))       return 'ST';
  return 'CM';
}

// ─────────────────────────────────────────────────────────────
// Build a balanced 4-3-3 XI from a raw TheSportsDB player list
// ─────────────────────────────────────────────────────────────
function buildXIFromPlayers(rawPlayers) {
  // Map every player to { name, position }
  const mapped = rawPlayers
    .filter(p => p.strPlayer && p.strPosition)
    .map(p => ({ name: p.strPlayer, pos: mapPos(p.strPosition) }));

  // Group by internal position code
  const pool = {};
  for (const { name, pos } of mapped) {
    (pool[pos] = pool[pos] || []).push(name);
  }

  const xi = [];

  // take(wantedPos, n, ...fallbacks): picks n players from pool
  function take(wantedPos, n, ...fallbacks) {
    let need = n;
    for (const src of [wantedPos, ...fallbacks]) {
      while (need > 0 && pool[src] && pool[src].length > 0) {
        xi.push({ name: pool[src].shift(), position: wantedPos });
        need--;
      }
      if (need === 0) break;
    }
  }

  // 4-3-3 blueprint
  take('GK', 1);
  take('RB', 1, 'CB');
  take('CB', 2, 'RB', 'DM');
  take('LB', 1, 'CB');
  take('DM', 1, 'CM');
  take('CM', 2, 'AM', 'DM', 'RM', 'LM');
  take('RW', 1, 'AM', 'RM', 'ST');
  take('ST', 1, 'LW', 'RW', 'AM');
  take('LW', 1, 'AM', 'LM', 'ST');

  return xi.slice(0, 11);
}

// ─────────────────────────────────────────────────────────────
// Estimate ratings from league tier
// ─────────────────────────────────────────────────────────────
const LEAGUE_TIERS = {
  tier1: ['english premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1'],
  tier2: ['championship', 'la liga 2', '2. bundesliga', 'serie b', 'ligue 2',
          'eredivisie', 'primeira liga', 'super lig', 'scottish premiership',
          'pro league', 'saudi professional league'],
};

function ratingsFromLeague(strLeague = '') {
  const l = strLeague.toLowerCase();
  if (LEAGUE_TIERS.tier1.some(t => l.includes(t))) {
    return { attack: 80, midfield: 80, defense: 80, goalkeeping: 80 };
  }
  if (LEAGUE_TIERS.tier2.some(t => l.includes(t))) {
    return { attack: 73, midfield: 73, defense: 73, goalkeeping: 73 };
  }
  return { attack: 68, midfield: 68, defense: 68, goalkeeping: 68 };
}

// ─────────────────────────────────────────────────────────────
// TheSportsDB API calls
// ─────────────────────────────────────────────────────────────
async function sdbFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`TheSportsDB HTTP ${res.status}`);
  return res.json();
}

async function fetchFromSportsDB(teamName) {
  // Generate name variants to maximise match rate
  const variants = makeVariants(teamName);

  for (const variant of variants) {
    try {
      const searchData = await sdbFetch(
        `${SPORTSDB_BASE}/searchteams.php?t=${encodeURIComponent(variant)}`
      );
      const teams = searchData.teams;
      if (!teams || teams.length === 0) continue;

      // Prefer football/soccer team
      const team = teams.find(t =>
        !t.strSport || t.strSport.toLowerCase() === 'soccer'
      ) || teams[0];

      const teamId    = team.idTeam;
      const teamLabel = team.strTeam;
      const strLeague = team.strLeague || '';
      const country   = team.strCountry || '';

      const playersData = await sdbFetch(
        `${SPORTSDB_BASE}/lookup_all_players.php?id=${teamId}`
      );
      const rawPlayers = playersData.player;
      if (!rawPlayers || rawPlayers.length === 0) continue;

      const xi = buildXIFromPlayers(rawPlayers);
      if (xi.length < 8) continue;

      return {
        formation:  '4-3-3',
        players:    xi,
        ratings:    ratingsFromLeague(strLeague),
        source:     `TheSportsDB — ${teamLabel}${strLeague ? ` · ${strLeague}` : ''}${country ? ` (${country})` : ''}`,
        teamLabel,
        badgeUrl:   team.strBadge || team.strTeamBadge || null,
      };
    } catch (_) {
      // try next variant
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Generate name variants for fuzzy matching
// ─────────────────────────────────────────────────────────────

// Spanish/Portuguese/colloquial national team names → English TheSportsDB names
const NATIONAL_NAME_MAP = {
  'alemania':        'Germany',
  'holanda':         'Netherlands',
  'países bajos':    'Netherlands',
  'paises bajos':    'Netherlands',
  'holanda (países bajos)': 'Netherlands',
  'francia':         'France',
  'españa':          'Spain',
  'espana':          'Spain',
  'brasil':          'Brazil',
  'dinamarca':       'Denmark',
  'bélgica':         'Belgium',
  'belgica':         'Belgium',
  'suecia':          'Sweden',
  'noruega':         'Norway',
  'suiza':           'Switzerland',
  'japón':           'Japan',
  'japon':           'Japan',
  'corea del sur':   'South Korea',
  'corea':           'South Korea',
  'costa rica':      'Costa Rica',
  'estados unidos':  'United States',
  'eeuu':            'United States',
  'ee.uu.':          'United States',
  'usa':             'United States',
  'méxico':          'Mexico',
  'peru':            'Peru',
  'perú':            'Peru',
  'república checa': 'Czech Republic',
  'republica checa': 'Czech Republic',
  'escocia':         'Scotland',
  'irlanda':         'Republic of Ireland',
  'irlanda del norte': 'Northern Ireland',
  'gales':           'Wales',
  'hungría':         'Hungary',
  'hungria':         'Hungary',
  'rumania':         'Romania',
  'rumanía':         'Romania',
  'eslovenia':       'Slovenia',
  'eslovaquia':      'Slovakia',
  'croacia':         'Croatia',
  'turquía':         'Turkey',
  'turquia':         'Turkey',
  'grecia':          'Greece',
  'austria':         'Austria',
  'italia':          'Italy',
  'rusia':           'Russia',
  'ucrania':         'Ukraine',
  'serbia':          'Serbia',
  'polonia':         'Poland',
  'portugal':        'Portugal',
  'egipto':          'Egypt',
  'marruecos':       'Morocco',
  'senegal':         'Senegal',
  'camerún':         'Cameroon',
  'camerun':         'Cameroon',
  'ghana':           'Ghana',
  'túnez':           'Tunisia',
  'tunez':           'Tunisia',
  'nigeria':         'Nigeria',
  'costa de marfil': 'Ivory Coast',
  'sudáfrica':       'South Africa',
  'sudafrica':       'South Africa',
  'argentina':       'Argentina',
  'uruguay':         'Uruguay',
  'colombia':        'Colombia',
  'chile':           'Chile',
  'ecuador':         'Ecuador',
  'paraguay':        'Paraguay',
  'venezuela':       'Venezuela',
  'australia':       'Australia',
  'arabia saudí':    'Saudi Arabia',
  'arabia saudi':    'Saudi Arabia',
  'irán':            'Iran',
  'iran':            'Iran',
};

function makeVariants(name) {
  const clean = name.trim();

  // National team Spanish→English translation — put English name FIRST so
  // TheSportsDB finds nationals quickly without wasting time on unknown variants
  const mapped = NATIONAL_NAME_MAP[clean.toLowerCase()];
  const variants = (mapped && mapped !== clean) ? [mapped, clean] : [clean];

  // Strip common suffixes / prefixes
  const stripped = clean
    .replace(/\s+(CF|FC|SC|AC|FK|SK|BK|AS|SD|UD|RC|RCD|CD|US|SS)\b/gi, '')
    .replace(/\b(FC|CF|SC|AC|FK|SK|BK|AS|SD|UD|RC|RCD|CD|US|SS)\s+/gi, '')
    .replace(/\s+de\s+/gi, ' ')
    .trim();
  if (stripped && stripped !== clean) variants.push(stripped);

  // "Real X" → "X" and vice-versa
  if (/^real\s+/i.test(clean))       variants.push(clean.replace(/^real\s+/i, ''));
  if (/^atletico\s+/i.test(clean))    variants.push(clean.replace(/^atletico\s+/i, 'Atlético '));
  if (/^athletic\s+/i.test(clean))    variants.push(clean.replace(/^athletic\s+/i, 'Athletic '));

  // Spanish accent variants: Atletico ↔ Atlético
  if (clean.includes('Atletico'))     variants.push(clean.replace('Atletico', 'Atlético'));
  if (clean.includes('Atlético'))     variants.push(clean.replace('Atlético', 'Atletico'));

  // Common full/short aliases
  const ALIASES = {
    'sevilla':             ['Sevilla FC'],
    'valencia':            ['Valencia CF'],
    'villarreal':          ['Villarreal CF'],
    'betis':               ['Real Betis'],
    'real betis':          ['Real Betis Balompié'],
    'celta':               ['Celta Vigo'],
    'atletico madrid':     ['Atletico Madrid', 'Club Atlético de Madrid'],
    'bayer leverkusen':    ['Bayer 04 Leverkusen'],
    'rb leipzig':          ['RasenBallsport Leipzig'],
    'paris saint germain': ['Paris Saint-Germain'],
    'tottenham':           ['Tottenham Hotspur'],
    'spurs':               ['Tottenham Hotspur'],
    'wolves':              ['Wolverhampton Wanderers'],
    'west ham':            ['West Ham United'],
    'newcastle':           ['Newcastle United'],
    'nottingham forest':   ['Nottingham Forest'],
    'brighton':            ['Brighton & Hove Albion'],
    'inter':               ['Internazionale'],
    'inter milan':         ['Internazionale'],
    'ac milan':            ['Milan'],
    'atletico de madrid':  ['Atletico Madrid'],
    'girona':              ['Girona FC'],
    'osasuna':             ['CA Osasuna'],
    'malaga':              ['Málaga CF'],
    'deportivo':           ['Deportivo de La Coruña'],
  };
  const key = clean.toLowerCase();
  if (ALIASES[key]) variants.push(...ALIASES[key]);

  // Deduplicate preserving order
  return [...new Set(variants)];
}

// ─────────────────────────────────────────────────────────────
// Local DB lookup (wraps squads.js with alias matching)
// ─────────────────────────────────────────────────────────────
function lookupLocal(teamName, era) {
  const searchKey = `${teamName} ${era}`.toLowerCase().trim();
  const teamOnly  = teamName.toLowerCase().trim();

  // Extract the requested year, if any
  const eraYear = era ? parseInt(era.match(/\d{4}/)?.[0]) : NaN;
  const hasEra  = !isNaN(eraYear);

  let bestMatch = null, bestKey = '';

  for (const key of Object.keys(SQUADS)) {
    const squad      = SQUADS[key];
    const candidates = [key, ...(squad.aliases || [])];
    for (const cand of candidates) {
      const nameMatch = searchKey.includes(cand) || teamOnly.includes(cand);
      if (!nameMatch || cand.length <= bestKey.length) continue;

      if (hasEra) {
        // When era is specified, only match local entries that have a year
        // close (±1) to the requested era. Era-less entries (e.g. "real madrid"
        // with current players) must NOT match — let the live scrapers handle it.
        const candYear = parseInt(cand.match(/\d{4}/)?.[0]);
        if (isNaN(candYear)) continue;            // skip era-less entries
        if (Math.abs(candYear - eraYear) > 1) continue; // skip wrong era
      }

      bestKey   = cand;
      bestMatch = squad;
    }
  }

  if (!bestMatch && hasEra) {
    // ── Closest-year fallback ─────────────────────────────────
    // If no exact era match, find the DB entry for the same nation
    // that is nearest in time (within 25 years). Useful for years
    // not specifically covered (e.g. "Germany 1980" → "alemania 1974").
    let closestDist = Infinity;
    for (const key of Object.keys(SQUADS)) {
      const squad      = SQUADS[key];
      // Only use the primary key (not aliases) for year-proximity matching.
      // Aliases like "brasil alemania 2006" would cause false matches when
      // searching for a single team (e.g. "brasil alemania".includes("alemania") = true).
      const candidates = [key];
      for (const cand of candidates) {
        // Strip year to get base nation name from the candidate
        const candBase = cand.replace(/\s*\d{4}.*/, '').trim();
        if (!candBase || candBase.length < 3) continue;
        // The input base: strip year from teamOnly too (handles "France 1994" in team field)
        const inputBase = teamOnly.replace(/\s*\d{4}\s*/, '').trim();
        // Word-boundary match so "alemania" doesn't match inside "brasil alemania"
        const _wb = (h, n) => new RegExp('(?:^|\\s)' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)', 'i').test(h);
        const baseMatch = inputBase === candBase || _wb(candBase, inputBase) || _wb(inputBase, candBase);
        if (!baseMatch) continue;

        const candYear = parseInt(cand.match(/\d{4}/)?.[0]);
        if (isNaN(candYear)) continue;
        const dist = Math.abs(candYear - eraYear);
        if (dist < closestDist && dist <= 25) {
          closestDist = dist;
          bestKey     = cand + ` (≈${eraYear})`;
          bestMatch   = squad;
        }
      }
    }
  }

  if (!bestMatch) return null;

  return {
    formation:   bestMatch.formation,
    players:     bestMatch.players,
    ratings:     bestMatch.ratings || null,
    source:      `Local DB — "${bestKey}"`,
    teamLabel:   teamName + (era ? ` (${era})` : ''),
    // isFallback: true means the year match is approximate (closest-year scan).
    // lookupTeam will try live scrapers before committing to this result.
    isFallback:  bestKey.includes('(≈'),
  };
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────
/**
 * lookupTeam(teamName, era)
 *
 * Priority (era given):
 *   1. Local curated DB  (squads.js)
 *   2. BDFutbol          (Spanish football specialist — era-accurate)
 *   3. Transfermarkt     (international clubs — era-accurate)
 *   4. Wikipedia         (broad historical fallback)
 *   5. Nearby-year scan  (±1…±5 via BDFutbol + Transfermarkt — labelled ≈year)
 *   6. TheSportsDB       (current squad, ignores era)
 *
 * Priority (no era / current):
 *   1. Local DB
 *   2. TheSportsDB
 *   3. Wikipedia (sometimes current)
 *
 * Returns:
 *   { found: true,  formation, players[], ratings?, source, teamLabel }
 *   { found: false, source: null }
 */
async function lookupTeam(teamName, era = '') {
  if (!teamName || !teamName.trim()) return { found: false, source: null };

  // 1. Local curated DB (historical squads + current top clubs)
  const local = lookupLocal(teamName, era);
  // Exact / ±1-year match → return immediately.
  // Closest-year fallback (≈year) → defer until after live scrapers so
  // Transfermarkt/BDFutbol can provide the correct era-accurate data.
  if (local && !local.isFallback) return { found: true, ...local };

  const hasEra = Boolean(era && era.trim());

  if (hasEra) {
    // 2. BDFutbol — Spanish football specialist, era-accurate
    try {
      const bdf = await fetchBdfutbolSquad(teamName, era);
      if (bdf) return { found: true, ...bdf };
    } catch (err) {
      console.warn(`[lookup] BDFutbol failed for "${teamName}" ${era}: ${err.message}`);
    }

    // 3. Transfermarkt — international clubs, era-accurate
    try {
      const tm = await fetchTransfermarktSquad(teamName, era);
      if (tm) return { found: true, ...tm };
    } catch (err) {
      console.warn(`[lookup] Transfermarkt failed for "${teamName}" ${era}: ${err.message}`);
    }

    // 4. Wikipedia — broad historical fallback
    try {
      const wiki = await lookupWikipedia(teamName, era);
      if (wiki && wiki.found) return wiki;
    } catch (err) {
      console.warn(`[lookup] Wikipedia failed for "${teamName}" ${era}: ${err.message}`);
    }

    // 5. Progressive year expansion — try ±1 … ±5 around the requested era.
    //    Useful when the exact season has no scraped data (e.g. small clubs, old eras).
    //    Tries alternating offsets: +1, -1, +2, -2, … and stops on first hit.
    const requestedYear = parseInt(era.match(/\d{4}/)?.[0]);
    if (!isNaN(requestedYear)) {
      const MAX_DIST = 5;
      const offsets  = [];
      for (let d = 1; d <= MAX_DIST; d++) { offsets.push(d); offsets.push(-d); }

      for (const offset of offsets) {
        const tryYear = String(requestedYear + offset);
        try {
          const bdf = await fetchBdfutbolSquad(teamName, tryYear);
          if (bdf) {
            bdf.source += ` (≈${era})`;
            console.log(`[lookup] Nearby-year hit: BDFutbol ${teamName} ${tryYear} (requested ${era})`);
            return { found: true, ...bdf };
          }
        } catch (_) { /* continue */ }
        try {
          const tm = await fetchTransfermarktSquad(teamName, tryYear);
          if (tm) {
            tm.source += ` (≈${era})`;
            console.log(`[lookup] Nearby-year hit: Transfermarkt ${teamName} ${tryYear} (requested ${era})`);
            return { found: true, ...tm };
          }
        } catch (_) { /* continue */ }
      }
    }

    // 5b. Local DB closest-year fallback — use if all live scrapers failed
    if (local) return { found: true, ...local };
  }

  // 6. TheSportsDB — current squad (era-insensitive)
  try {
    const api = await fetchFromSportsDB(teamName);
    if (api) return { found: true, ...api };
  } catch (err) {
    console.warn(`[lookup] TheSportsDB failed for "${teamName}": ${err.message}`);
  }

  // 7. Wikipedia fallback even without era (sometimes has current season articles)
  if (!hasEra) {
    try {
      const wiki = await lookupWikipedia(teamName, era);
      if (wiki && wiki.found) return wiki;
    } catch (err) {
      console.warn(`[lookup] Wikipedia (no-era) failed for "${teamName}": ${err.message}`);
    }
  }

  return { found: false, source: null };
}

// ─────────────────────────────────────────────────────────────
// Lightweight badge-only lookup (no player data, fast)
// ─────────────────────────────────────────────────────────────
async function fetchTeamBadge(teamName) {
  const variants = makeVariants(teamName);
  for (const variant of variants.slice(0, 3)) {
    try {
      const data  = await sdbFetch(`${SPORTSDB_BASE}/searchteams.php?t=${encodeURIComponent(variant)}`);
      const teams = data.teams;
      if (!teams) continue;
      const team  = teams.find(t => !t.strSport || t.strSport.toLowerCase() === 'soccer') || teams[0];
      const badge = team?.strBadge || team?.strTeamBadge;
      if (badge) return badge;
    } catch (_) { continue; }
  }
  return null;
}

module.exports = { lookupTeam, fetchTeamBadge };
