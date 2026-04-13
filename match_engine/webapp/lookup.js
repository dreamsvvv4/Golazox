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

const fs   = require('fs');
const path = require('path');
const { SQUADS }                    = require('./squads');
const { lookupWikipedia }           = require('./wikipedia');
const { fetchBdfutbolSquad }        = require('./bdfutbol');
const { fetchTransfermarktSquad, resolveClub, _loadTeamFile, _saveTeamFile,
        saveBadgeLocally, saveBadgePathToFile, getLocalBadgePath } = require('./transfermarkt');
const { buildXI, ELITE_NATIONALS, STRONG_NATIONALS } = require('./utils');

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
// Build XI from raw TheSportsDB player list
// Maps TheSportsDB format → internal codes, then delegates to shared buildXI
// ─────────────────────────────────────────────────────────────
function buildXIFromPlayers(rawPlayers) {
  // Normalize RM/LM → CM so shared buildXI's pool handles them
  const normalizePos = p => (p === 'RM' || p === 'LM') ? 'CM' : p;
  const raw = rawPlayers
    .filter(p => p.strPlayer && p.strPosition)
    .map(p => ({ name: p.strPlayer, position: normalizePos(mapPos(p.strPosition)) }));
  return buildXI(raw);
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

function ratingsFromLeague(strLeague = '', teamName = '') {
  const l = strLeague.toLowerCase();
  const t = (teamName || '').toLowerCase();

  if (ELITE_NATIONALS.some(n => t === n || t.startsWith(n + ' ') || t.endsWith(' ' + n))) {
    return { attack: 84, midfield: 84, defense: 83, goalkeeping: 82 };
  }
  if (STRONG_NATIONALS.some(n => t.includes(n))) {
    return { attack: 78, midfield: 78, defense: 77, goalkeeping: 76 };
  }
  if (LEAGUE_TIERS.tier1.some(t2 => l.includes(t2))) {
    // Modern football: attack attributes skew slightly higher than defensive ones
    return { attack: 81, midfield: 80, defense: 79, goalkeeping: 78 };
  }
  if (LEAGUE_TIERS.tier2.some(t2 => l.includes(t2))) {
    return { attack: 74, midfield: 73, defense: 73, goalkeeping: 72 };
  }
  return { attack: 69, midfield: 68, defense: 68, goalkeeping: 67 };
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

      // Map ALL players to internal format so the full squad is cached
      const allMapped = rawPlayers
        .filter(p => p.strPlayer && p.strPosition)
        .map(p => ({ name: p.strPlayer, position: mapPos(p.strPosition) }));
      const xi = buildXIFromPlayers(rawPlayers);
      if (xi.length < 8) continue;

      return {
        formation:  '4-3-3',
        players:    allMapped.length >= 11 ? allMapped : xi,
        ratings:    ratingsFromLeague(strLeague, teamName),
        source:     `TheSportsDB — ${teamLabel}${strLeague ? ` · ${strLeague}` : ''}${country ? ` (${country})` : ''}`,
        teamLabel,
        badgeUrl:   await (async () => {
          const extBadge = team.strBadge || team.strTeamBadge || null;
          if (!extBadge) return null;
          const slug = _resolveSlug(teamName);
          const local = await saveBadgeLocally(extBadge, slug);
          if (local) { saveBadgePathToFile(slug, local); return local; }
          return null;  // skip external URL — CSP would block it
        })(),
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
    'paris saint germain':  ['Paris SG', 'Paris Saint-Germain'],
    'paris saint-germain':  ['Paris SG', 'Paris Saint-Germain'],
    'tottenham':            ['Tottenham Hotspur'],
    'spurs':               ['Tottenham Hotspur'],
    'wolves':              ['Wolverhampton Wanderers'],
    'west ham':            ['West Ham United'],
    'newcastle':           ['Newcastle United'],
    'nottingham forest':   ['Nottingham Forest'],
    'brighton':            ['Brighton & Hove Albion'],
    'inter':               ['Internazionale'],
    'inter milan':         ['Internazionale'],
    'ac milan':            ['Milan'],
    'psv':                 ['PSV Eindhoven'],
    'atletico de madrid':  ['Atletico Madrid'],
    'girona':              ['Girona FC'],
    'osasuna':             ['CA Osasuna'],
    'malaga':              ['Málaga CF'],
    'deportivo':           ['Deportivo de La Coruña'],
    // Clubes europeos / resto del mundo
    'az alkmaar':          ['AZ', 'AZ Alkmaar'],
    'dynamo kyiv':         ['Dynamo Kyiv', 'Dynamo Kiev'],
    'red star belgrade':   ['Crvena Zvezda', 'Crvena zvezda', 'Red Star Belgrade', 'FK Crvena zvezda'],
    'zenit st petersburg': ['Zenit St Petersburg', 'FC Zenit', 'Zenit'],
    'spartak moscow':      ['Spartak Moscow', 'FC Spartak Moscow'],
    'cska moscow':         ['CSKA Moscow', 'PFC CSKA Moscow'],
    'steaua bucharest':    ['Steaua Bucharest', 'FCSB'],
    'rapid vienna':        ['SK Rapid Wien', 'Rapid Wien'],
    'galatasaray':         ['Galatasaray SK', 'Galatasaray'],
    'fenerbahce':          ['Fenerbahçe', 'Fenerbahce SK'],
    'besiktas':            ['Beşiktaş', 'Besiktas JK'],
    // Equipos sudamericanos
    'boca juniors':        ['Boca Juniors', 'Club Atletico Boca Juniors'],
    'river plate':         ['River Plate', 'Club Atletico River Plate'],
    'sao paulo fc':        ['São Paulo', 'Sao Paulo FC', 'São Paulo FC'],
    'gremio':              ['Grêmio', 'Gremio FBPA'],
    'peñarol':             ['Peñarol', 'Club Atletico Peñarol'],
    'nacional':            ['Nacional Montevideo', 'Club Nacional de Football'],
    'independiente':       ['Club Atletico Independiente'],
    // Selecciones nacionales (variantes TheSportsDB)
    'ivory coast':         ['Ivory Coast', "Côte d'Ivoire"],
    'bosnia':              ['Bosnia-Herzegovina', 'Bosnia and Herzegovina', 'Bosnia & Herzegovina'],
    'republic of ireland': ['Republic of Ireland', 'Ireland'],
    // México
    'club america':        ['Club América', 'America', 'Club America', 'CF América'],
    'guadalajara':         ['CD Guadalajara', 'Chivas', 'Deportivo Guadalajara'],
    'tigres uanl':         ['Tigres UANL', 'Tigres de la UANL', 'Tigres'],
    'monterrey':           ['CF Monterrey', 'Club de Fútbol Monterrey'],
    // Selecciones — variantes TheSportsDB
    'united states':       ['USA', 'United States of America'],
    'northern ireland':    ['Northern Ireland', 'Northern Ireland FA'],
    // Bundesliga adicional
    'hamburger sv':        ['Hamburger SV', 'Hamburger Sport-Verein', 'HSV Hamburg'],
    'union berlin':        ['1. FC Union Berlin', 'FC Union Berlin'],
    'mainz':               ['FSV Mainz 05', 'Mainz 05'],
    'mainz 05':            ['1. FSV Mainz 05', 'FSV Mainz 05'],
    'hertha berlin':       ['Hertha', 'Hertha BSC', 'Hertha Berlin SC'],
    'hannover 96':         ['Hannover 96'],
    'st. pauli':           ['FC St. Pauli', 'St Pauli'],
    'heidenheim':          ['FC Heidenheim', '1. FC Heidenheim 1846'],
    'darmstadt':           ['SV Darmstadt 98', 'Darmstadt 98'],
    // Ligue 1 adicional
    'saint-etienne':       ['St Etienne', 'AS Saint-Etienne', 'Saint Etienne'],
    'lens':                ['RC Lens', 'Racing Club de Lens'],
    'nice':                ['OGC Nice'],
    'rennes':              ['Stade Rennais', 'Stade Rennais FC'],
    'toulouse':            ['Toulouse FC'],
    'brest':               ['Stade Brestois 29', 'Stade Brest'],
    'montpellier':         ['Montpellier HSC'],
    'strasbourg':          ['RC Strasbourg', 'Racing Club de Strasbourg'],
    'stade reims':         ['Stade de Reims', 'Reims'],
    'angers':              ['SCO Angers', 'Angers SCO'],
    // Serie A adicional
    'bologna':             ['FC Bologna', 'Bologna FC 1909'],
    'genoa':               ['Genoa CFC'],
    'hellas verona':       ['Hellas Verona FC'],
    'verona':              ['Hellas Verona', 'AC ChievoVerona'],
    'udinese':             ['Udinese Calcio'],
    'lecce':               ['US Lecce'],
    'empoli':              ['FC Empoli'],
    'monza':               ['AC Monza'],
    'salernitana':         ['US Salernitana', 'Unione Sportiva Salernitana'],
    // UCL / Europa adicional
    'partizan':            ['FK Partizan', 'Partizan Belgrade', 'Partizan Beograd'],
    'brighton':            ['Brighton & Hove Albion', 'Brighton and Hove Albion'],
    'young boys':          ['BSC Young Boys', 'Young Boys Bern'],
    'red bull salzburg':   ['FC Salzburg', 'FC Red Bull Salzburg', 'RB Salzburg'],
    'shakhtar donetsk':    ['FC Shakhtar Donetsk', 'Shakhtar'],
    'fc copenhagen':       ['FC Kobenhavn', 'FC Copenhagen'],
    'rangers':             ['Rangers FC', 'Glasgow Rangers'],
    'club brugge':         ['Club Brugge KV', 'Club Brugge', 'Brugge'],
    'bournemouth':         ['AFC Bournemouth', 'Bournemouth FC'],
    'freiburg':            ['SC Freiburg', 'Sport-Club Freiburg'],
    'dinamo zagreb':       ['GNK Dinamo Zagreb', 'NK Dinamo Zagreb'],
    // Saudi Pro League
    'al-hilal':            ['Al-Hilal', 'Al Hilal', 'Al-Hilal Saudi FC', 'Al-Hilal SFC'],
    'al-nassr':            ['Al-Nassr', 'Al Nassr', 'Al-Nassr FC'],
    'al-ittihad':          ['Al-Ittihad', 'Al Ittihad', 'Ittihad FC'],
    'al-ahli':             ['Al-Ahli', 'Al Ahli', 'Al Ahli Saudi FC'],
    'al-shabab':           ['Al-Shabab', 'Al Shabab'],
    'al-fateh':            ['Al-Fateh', 'Al Fateh'],
    'al-ettifaq':          ['Al-Ettifaq', 'Al Ettifaq', 'Ettifaq FC'],
    'al-qadsiah':          ['Al-Qadsiah', 'Al Qadsiah'],
    // MLS
    'la galaxy':           ['Los Angeles Galaxy', 'LA Galaxy'],
    'lafc':                ['Los Angeles FC', 'LA FC'],
    'seattle sounders':    ['Seattle Sounders FC'],
    'portland timbers':    ['Portland Timbers FC'],
    'atlanta united':      ['Atlanta United FC'],
    'inter miami':         ['Inter Miami CF', 'CF Inter Miami'],
    'inter de miami':      ['Inter Miami CF', 'CF Inter Miami'],
    'inter de miami cf':   ['Inter Miami CF', 'CF Inter Miami'],
    'new york city fc':    ['NYCFC', 'NYC FC'],
    'new york red bulls':  ['New York Red Bulls', 'NY Red Bulls'],
    'columbus crew':       ['Columbus Crew SC'],
    'toronto fc':          ['Toronto FC'],
    'chicago fire':        ['Chicago Fire FC'],
    'sporting kansas city':['Sporting KC', 'Sporting Kansas City FC'],
    'new england revolution':['New England Revolution'],
    'real salt lake':      ['Real Salt Lake FC', 'RSL'],
    'vancouver whitecaps': ['Vancouver Whitecaps FC'],
    'cf montreal':         ['CF Montréal', 'Montreal Impact'],
    'austin fc':           ['Austin FC'],
    // Sudamérica adicional
    'atletico mineiro':    ['Atlético Mineiro', 'Atletico Mineiro'],
    'palmeiras':           ['SE Palmeiras', 'Sociedade Esportiva Palmeiras'],
    'flamengo':            ['CR Flamengo', 'Club de Regatas do Flamengo', 'Flamengo Rio'],
    'botafogo':            ['Botafogo FR', 'Botafogo de Futebol e Regatas'],
    'vasco da gama':       ['CR Vasco da Gama', 'Vasco'],
    'colo-colo':           ['Colo-Colo', 'Club Social y Deportivo Colo-Colo'],
    'racing club':         ['Racing Club', 'Racing Club de Avellaneda'],
  };
  const key = clean.toLowerCase();
  if (ALIASES[key]) variants.push(...ALIASES[key]);

  // Deduplicate preserving order
  return [...new Set(variants)];
}

// ─────────────────────────────────────────────────────────────
// Squads-dir cache: read/write scraped squads to squads/ folder
// Acts as layer 0 before any external scraper is called.
// Key: "<slug>__<saisonId>"  stored inside squads/<slug>.json
// ─────────────────────────────────────────────────────────────
const SQUADS_DIR = path.join(__dirname, 'squads');

/** Normalise team name to a filesystem-safe slug */
function _nameToSlug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Resolve the best slug for a team: prefer the Transfermarkt slug (which is
 * what transfermarkt.js uses when saving files) and fall back to the generic
 * normalised name slug.
 */
function _resolveSlug(teamName) {
  const tmClub = resolveClub(teamName);
  return (tmClub && tmClub.slug) ? tmClub.slug : _nameToSlug(teamName);
}

/**
 * Try to load a team file using both TM slug and generic slug.
 * Returns { teamFile, slug } for the first hit, or the generic one if neither exists.
 */
function _loadTeamFileAny(teamName) {
  const tmClub = resolveClub(teamName);
  const tmSlug = tmClub?.slug;
  const genSlug = _nameToSlug(teamName);

  // Try TM slug first (most common for scraped teams)
  if (tmSlug) {
    const tf = _loadTeamFile(tmSlug);
    if (tf.seasons && Object.keys(tf.seasons).length > 0) return { teamFile: tf, slug: tmSlug };
  }
  // Fallback to generic slug (used by BDFutbol / SportsDB / Wikipedia saves)
  const tf2 = _loadTeamFile(genSlug);
  return { teamFile: tf2, slug: genSlug };
}

/**
 * Look up a squad in the squads/ directory cache — EXACT year only.
 * For no-era queries returns the most recent cached season.
 * Returns the squad object or null.
 */
function lookupSquadsDir(teamName, era) {
  const { teamFile } = _loadTeamFileAny(teamName);
  if (!teamFile.seasons) return null;

  const localBadge = teamFile.badgeLocalPath || null;

  // Explicit 'all-time' key
  if (era === 'all-time' && teamFile.seasons['all-time']) {
    const s = teamFile.seasons['all-time'];
    return { ...s, badgeUrl: localBadge, source: `DB local — ${teamFile.name || teamName} (All Time)` };
  }

  const eraYear = era ? parseInt(String(era).match(/\d{4}/)?.[0]) : NaN;
  if (!isNaN(eraYear) && teamFile.seasons[String(eraYear)]) {
    const s = teamFile.seasons[String(eraYear)];
    return { ...s, badgeUrl: localBadge, source: `DB local — ${teamFile.name || teamName} (${eraYear})` };
  }

  // No-era: return the most recent season available (no network needed)
  if (isNaN(eraYear)) {
    const years = Object.keys(teamFile.seasons).map(Number).filter(n => !isNaN(n));
    if (years.length === 0) {
      // Fallback to 'all-time' if no numeric seasons exist
      if (teamFile.seasons['all-time']) {
        const s = teamFile.seasons['all-time'];
        return { ...s, badgeUrl: localBadge, source: `DB local — ${teamFile.name || teamName} (All Time)` };
      }
      return null;
    }
    const latest = String(Math.max(...years));
    const s = teamFile.seasons[latest];
    return { ...s, badgeUrl: localBadge, source: `DB local — ${teamFile.name || teamName} (${latest})` };
  }

  return null;
}

/**
 * Last-resort: find the closest cached season (±5 years).
 * Only called after ALL scrapers have failed for the exact year.
 */
function _lookupSquadsDirNearby(teamName, eraYear) {
  const { teamFile } = _loadTeamFileAny(teamName);
  if (!teamFile.seasons) return null;
  const years = Object.keys(teamFile.seasons).map(Number).filter(n => !isNaN(n));
  if (years.length === 0) return null;
  years.sort((a, b) => Math.abs(a - eraYear) - Math.abs(b - eraYear));
  const nearest = years[0];
  if (Math.abs(nearest - eraYear) <= 5) {
    const result = { ...teamFile.seasons[String(nearest)] };
    result.source = `DB local — ${teamFile.name || teamName} (${nearest} ≈${eraYear})`;
    return result;
  }
  return null;
}

/**
 * Persist a scraped squad result into squads/<slug>.json for future
 * requests. Only saves externally-fetched data (not Local DB entries).
 */
function saveToSquadsDir(teamName, era, squadData) {
  if (!squadData || squadData.source?.startsWith('Local DB')) return;
  if (!squadData.players || squadData.players.length < 8) return;

  // Guard: if the scraped teamLabel doesn't loosely match what we were searching for,
  // skip the save. Prevents "New England Revolution" from overwriting "England"
  // and "SC Internacional" from overwriting "Club Nacional" (word-boundary check).
  if (squadData.teamLabel) {
    // Preserve spaces so word boundaries work, strip only punctuation
    const normalizeWB = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const query = normalizeWB(teamName);
    const label = normalizeWB(squadData.teamLabel);
    // Whole-word boundary check: query must appear as a standalone word in label or vice versa
    const wb = (hay, needle) =>
      new RegExp('(?:^|\\s)' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '(?:\\s|$)').test(hay);
    if (!wb(label, query) && !wb(query, label)) {
      console.warn(`[squads] Skipping save: "${teamName}" doesn't match label "${squadData.teamLabel}"`);
      return;
    }
  }

  // Always use the canonical TM slug when the team is known, so all scrapers
  // (BDFutbol, SportsDB, Wikipedia, Transfermarkt) write to the same file.
  const slug     = _resolveSlug(teamName);
  const eraYear  = era ? (String(era).match(/\d{4}/)?.[0] || null) : null;
  const saisonId = eraYear || String(new Date().getFullYear());
  try {
    _saveTeamFile(slug, null, teamName, saisonId, squadData);
  } catch (_) { /* non-critical */ }
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
 *   0. squads/ directory cache  (any previously scraped result)
 *   1. Local curated DB  (squads.js)
 *   2. BDFutbol          (Spanish football specialist — era-accurate)
 *   3. Transfermarkt     (international clubs — era-accurate)
 *   4. Wikipedia         (broad historical fallback)
 *   5. Nearby-year scan  (±1…±5 via BDFutbol + Transfermarkt — labelled ≈year)
 *   6. TheSportsDB       (current squad, ignores era)
 *
 * Priority (no era / current):
 *   0. squads/ directory cache
 *   1. Local DB
 *   2. TheSportsDB
 *   3. Wikipedia (sometimes current)
 *
 * Any result from an external source (2–6) is persisted in squads/ so
 * future lookups for the same team+era are served from cache instantly.
 *
 * Returns:
 *   { found: true,  formation, players[], ratings?, source, teamLabel }
 *   { found: false, source: null }
 */
async function lookupTeam(teamName, era = '') {
  if (!teamName || !teamName.trim()) return { found: false, source: null };

  // OFFLINE_MODE=true → only use local data (squads/ + curated DB).
  // Recommended for production: no scraping, no external dependencies.
  // To regenerate squads offline: npm run seed
  const offlineOnly = process.env.OFFLINE_MODE === 'true';

  // 0. squads/ directory cache — serves any previously scraped result instantly
  const cached = lookupSquadsDir(teamName, era);
  if (cached && cached.players && cached.players.length >= 8) {
    return { found: true, ...cached };
  }

  // 1. Local curated DB (historical squads + current top clubs)
  const local = lookupLocal(teamName, era);
  // Exact / ±1-year match → return immediately.
  // Closest-year fallback (≈year) → defer until after live scrapers so
  // Transfermarkt/BDFutbol can provide the correct era-accurate data.
  if (local && !local.isFallback) return { found: true, ...local };

  // In offline mode, skip all scrapers and return local fallback or not-found
  if (offlineOnly) {
    if (local) return { found: true, ...local };
    return { found: false, source: null, offline: true };
  }

  const hasEra = Boolean(era && era.trim());

  if (hasEra) {
    // 2. BDFutbol — Spanish football specialist, era-accurate
    try {
      const bdf = await fetchBdfutbolSquad(teamName, era);
      if (bdf) {
        saveToSquadsDir(teamName, era, bdf);
        return { found: true, ...bdf };
      }
    } catch (err) {
      console.warn(`[lookup] BDFutbol failed for "${teamName}" ${era}: ${err.message}`);
    }

    // 3. Transfermarkt — international clubs, era-accurate
    // (already saves to squads/ internally in transfermarkt.js)
    try {
      const tm = await fetchTransfermarktSquad(teamName, era);
      if (tm) return { found: true, ...tm };
    } catch (err) {
      console.warn(`[lookup] Transfermarkt failed for "${teamName}" ${era}: ${err.message}`);
    }

    // 4. Wikipedia — broad historical fallback
    try {
      const wiki = await lookupWikipedia(teamName, era);
      if (wiki && wiki.found) {
        saveToSquadsDir(teamName, era, wiki);
        return wiki;
      }
    } catch (err) {
      console.warn(`[lookup] Wikipedia failed for "${teamName}" ${era}: ${err.message}`);
    }

    // 5. All exact-year scrapers failed. Try nearby years ±5 on Transfermarkt/BDFutbol
    //    (only reached when the exact season has no data anywhere).
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
            saveToSquadsDir(teamName, era, bdf);
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

      // 5b. All external scrapers failed — try nearby cached season as last resort
      const nearbyCache = _lookupSquadsDirNearby(teamName, requestedYear);
      if (nearbyCache && nearbyCache.players?.length >= 8) {
        return { found: true, ...nearbyCache };
      }
    }

    // 5c. Local DB closest-year fallback
    if (local) return { found: true, ...local };
  }

  // 6. TheSportsDB — current squad (era-insensitive)
  try {
    const api = await fetchFromSportsDB(teamName);
    if (api) {
      saveToSquadsDir(teamName, era, api);
      return { found: true, ...api };
    }
  } catch (err) {
    console.warn(`[lookup] TheSportsDB failed for "${teamName}": ${err.message}`);
  }

  // 7. Wikipedia fallback even without era (sometimes has current season articles)
  if (!hasEra) {
    try {
      const wiki = await lookupWikipedia(teamName, era);
      if (wiki && wiki.found) {
        saveToSquadsDir(teamName, era, wiki);
        return wiki;
      }
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
  const slug = _resolveSlug(teamName);

  // 1. Fast path: check if the image file already exists on disk
  const existing = getLocalBadgePath(slug);
  if (existing) {
    // Ensure the team file also records it (self-healing for migrated teams)
    const { teamFile } = _loadTeamFileAny(teamName);
    if (!teamFile.badgeLocalPath) saveBadgePathToFile(slug, existing);
    return existing;
  }

  // 2. Fetch badge URL from TheSportsDB
  const variants = makeVariants(teamName);
  for (const variant of variants.slice(0, 3)) {
    try {
      const data  = await sdbFetch(`${SPORTSDB_BASE}/searchteams.php?t=${encodeURIComponent(variant)}`);
      const teams = data.teams;
      if (!teams) continue;
      const team  = teams.find(t => !t.strSport || t.strSport.toLowerCase() === 'soccer') || teams[0];
      const badge = team?.strBadge || team?.strTeamBadge;
      if (!badge) continue;

      // 3. Download and cache locally
      const localPath = await saveBadgeLocally(badge, slug);
      if (localPath) {
        saveBadgePathToFile(slug, localPath);
        return localPath;
      }
      // Download failed — skip external URL (CSP img-src 'self' would block it)
    } catch (_) { continue; }
  }
  return null;
}

module.exports = { lookupTeam, fetchTeamBadge };
