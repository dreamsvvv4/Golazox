/**
 * bdfutbol.js — BDFutbol squad scraper
 * ════════════════════════════════════════════════════════════
 * Spanish football specialist: historical squad data for
 * La Liga / Segunda División / Segunda B clubs.
 *
 * BDFutbol URL pattern:
 *   https://www.bdfutbol.com/es/t/t{YYYY}-{YY}{clubId}.html
 *   e.g. t1998-9916.html  = Getafe, season 1998-99
 *        t2023-2478.html  = Girona, season 2023-24
 * ════════════════════════════════════════════════════════════
 */

'use strict';

const cheerio = require('cheerio');
const FETCH_TIMEOUT = 8000;

// ─────────────────────────────────────────────────────────────
// Position codes used in BDFutbol HTML (Catalan + Spanish mix)
// ─────────────────────────────────────────────────────────────
const BDF_POS = {
  // Catalan-origin abbreviations (most common in BDFutbol)
  'por': 'GK',  // porter / portero
  'ltd': 'RB',  // lateral dret  / lateral derecho
  'lti': 'LB',  // lateral esquerra / lateral izquierdo
  'def': 'CB',  // defensor (generic)
  'cen': 'CB',  // central
  'mig': 'CM',  // migcampista (Catalan for midfielder)
  'dav': 'ST',  // davanter (Catalan for forward/striker)
  'dac': 'ST',  // davanter ala (flying forward / second striker)
  // Spanish-style abbreviations (used in some seasons / older pages)
  'dc':  'CB', 'dcd': 'CB', 'dci': 'CB',
  'mc':  'CM', 'mcd': 'DM', 'mco': 'AM',
  'mp':  'AM',
  'ed':  'RW', 'ei':  'LW',
  'del': 'ST', 'delc': 'ST', 'deld': 'ST',
  // Extra variants seen in practice
  'ld':  'RB', 'li': 'LB',
  'dm':  'DM', 'am': 'AM',
  'ex':  'RW',  // extremo (generic winger)
};

// ─────────────────────────────────────────────────────────────
// Spanish football club → BDFutbol numeric ID
// (IDs discovered by systematic URL scanning)
// ─────────────────────────────────────────────────────────────
const BDF_CLUBS = {
  'barcelona':                 1,
  'fc barcelona':              1,
  'barça':                     1,
  'barca':                     1,
  'real madrid':               2,
  'real madrid cf':            2,
  'real madrid castilla':      61,
  'alavés':                    3,
  'alaves':                    3,
  'deportivo alavés':          3,
  'albacete':                  4,
  'albacete balompié':         4,
  'rayo vallecano':            5,
  'rayo':                      5,
  'athletic club':             6,
  'athletic bilbao':           6,
  'athletic':                  6,
  'atlético de madrid':        7,
  'atletico de madrid':        7,
  'atlético madrid':           7,
  'atletico madrid':           7,
  'atleti':                    7,
  'betis':                     8,
  'real betis':                8,
  'real betis balompié':       8,
  'cádiz':                    10,
  'cadiz':                    10,
  'cádiz cf':                 10,
  'celta de vigo':            11,
  'celta vigo':               11,
  'rc celta':                 11,
  'celta':                    11,
  'compostela':               12,
  'sd compostela':            12,
  'deportivo de la coruña':   13,
  'deportivo la coruña':      13,
  'deportivo':                13,
  'rc deportivo':             13,
  'espanyol':                 14,
  'rcd espanyol':             14,
  'español':                  14,
  'extremadura':              15,
  'getafe':                   16,
  'getafe cf':                16,
  'nàstic':                   17,
  'gimnàstic':                17,
  'gimnastic de tarragona':   17,
  'hércules':                 18,
  'hercules':                 18,
  'hércules cf':              18,
  'las palmas':               19,
  'ud las palmas':            19,
  'levante':                  20,
  'levante ud':               20,
  'lleida':                   21,
  'ud lleida':                21,
  'logroñés':                 22,
  'logrono':                  22,
  'málaga':                   23,
  'malaga':                   23,
  'málaga cf':                23,
  'mallorca':                 24,
  'real mallorca':            24,
  'mérida':                   25,
  'merida':                   25,
  'numancia':                 26,
  'cd numancia':              26,
  'osasuna':                  27,
  'ca osasuna':               27,
  'oviedo':                   28,
  'real oviedo':              28,
  'racing santander':         29,
  'racing de santander':      29,
  'racing':                   29,
  'real sociedad':            30,
  'recreativo':               31,
  'recreativo de huelva':     31,
  'salamanca':                32,
  'ud salamanca':             32,
  'sevilla':                  33,
  'sevilla fc':               33,
  'sporting gijon':           34,
  'sporting de gijón':        34,
  'sporting gijón':           34,
  'tenerife':                 35,
  'cd tenerife':              35,
  'valencia':                 36,
  'valencia cf':              36,
  'valladolid':               37,
  'real valladolid':          37,
  'villarreal':               38,
  'villarreal cf':            38,
  'zaragoza':                 39,
  'real zaragoza':            39,
  'murcia':                   40,
  'real murcia':              40,
  'castellón':                41,
  'castellon':                41,
  'cd castellón':             41,
  'elche':                    42,
  'elche cf':                 42,
  'almería':                  43,
  'almeria':                  43,
  'ud almería':               43,
  'sabadell':                 44,
  'ce sabadell':              44,
  'badajoz':                  45,
  'cd badajoz':               45,
  'córdoba':                  46,
  'cordoba':                  46,
  'córdoba cf':               46,
  'eibar':                    47,
  'sd eibar':                 47,
  'jaén':                     49,
  'jaen':                     49,
  'real jaén':                49,
  'leganés':                  50,
  'leganes':                  50,
  'cd leganés':               50,
  'ponferradina':             62,
  'sd ponferradina':          62,
  'lugo':                     76,
  'cd lugo':                  76,
  'girona':                   78,
  'girona fc':                78,
  'huesca':                   79,
  'sd huesca':                79,
  'cultural leonesa':         84,
  'alcorcón':                107,
  'alcorcon':                107,
  'ad alcorcón':             107,
  'mirandés':                145,
  'mirandes':                145,
  'fuenlabrada':             165,
  'cf fuenlabrada':          165,
  'fc cartagena':            176,
  'cartagena':               176,
  'burgos cf':               380,
  'burgos':                  380,
  'granada':                  59,
  'granada cf':               59,
  'pontevedra':               58,
  'alcoyano':                 86,
};

// ─────────────────────────────────────────────────────────────
// Convert user-supplied era string → "YYYY-YY" format
// ─────────────────────────────────────────────────────────────
function eraToSeason(era) {
  if (!era) return null;
  // Already formatted "1998-99" or "2000-01"
  if (/^\d{4}-\d{2}$/.test(era.trim())) return era.trim();
  // "1998-1999" style
  const range = era.match(/^(\d{4})[^\d](\d{4})$/);
  if (range) return `${range[1]}-${range[2].slice(-2)}`;
  // Plain year "1998" → treat as start of season
  const y = parseInt(era.match(/\d{4}/)?.[0]);
  if (!y) return null;
  const end = String(y + 1).slice(-2);
  return `${y}-${end}`;
}

// ─────────────────────────────────────────────────────────────
// Resolve club name → BDFutbol numeric ID
// ─────────────────────────────────────────────────────────────
function resolveClubId(teamName) {
  const key = teamName.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents for fuzzy
    .replace(/[\u0300-\u036f]/g, '');

  // Direct lookup (with accent stripping on keys too)
  for (const [k, id] of Object.entries(BDF_CLUBS)) {
    const normK = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normK === key) return id;
  }

  // Partial contains match (prefer longest key)
  let bestId = null, bestLen = 0;
  for (const [k, id] of Object.entries(BDF_CLUBS)) {
    const normK = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if ((key.includes(normK) || normK.includes(key)) && normK.length > bestLen) {
      bestId = id;
      bestLen = normK.length;
    }
  }
  return bestId;
}

// ─────────────────────────────────────────────────────────────
// Build a balanced XI from a raw player list
// ─────────────────────────────────────────────────────────────
function buildXI(raw) {
  const pool = {};
  for (const { name, position } of raw) {
    (pool[position] = pool[position] || []).push(name);
  }

  const xi = [];
  function take(pos, n, ...fallbacks) {
    let need = n;
    for (const src of [pos, ...fallbacks]) {
      while (need > 0 && pool[src]?.length > 0) {
        xi.push({ name: pool[src].shift(), position: pos });
        need--;
      }
      if (!need) break;
    }
  }

  // Count available positions to decide formation
  const gkCount  = (pool['GK']  || []).length;
  const defCount = (pool['CB']||[]).length + (pool['RB']||[]).length + (pool['LB']||[]).length;
  const midCount = (pool['CM']||[]).length + (pool['DM']||[]).length + (pool['AM']||[]).length;
  const attCount = (pool['ST']||[]).length + (pool['RW']||[]).length + (pool['LW']||[]).length;

  // Default to 4-4-2 if ≥2 strikers, else 4-3-3
  const useTwoUp = attCount >= 2 && midCount >= 4;

  take('GK', 1);
  take('RB', 1, 'CB');
  take('CB', 2, 'DM');
  take('LB', 1, 'CB');
  if (useTwoUp) {
    take('DM', 1, 'CM');
    take('CM', 3, 'AM', 'DM', 'RW', 'LW');
    take('ST', 2, 'RW', 'LW', 'AM');
  } else {
    take('DM', 1, 'CM');
    take('CM', 2, 'AM', 'DM');
    take('RW', 1, 'AM', 'CM');
    take('ST', 1, 'LW', 'AM', 'CM');
    take('LW', 1, 'AM', 'CM', 'ST');
  }

  return xi.slice(0, 11);
}

// ─────────────────────────────────────────────────────────────
// Ratings from page title + team-specific hash variation
// Same tier clubs get distinct attributes (Barça ≠ Getafe in Primera)
// ─────────────────────────────────────────────────────────────
function ratingsFromTitle(rawTitle, teamName = '') {
  const t = rawTitle.toLowerCase();
  const clamp = (v) => Math.max(60, Math.min(90, Math.round(v)));

  // Deterministic per-team variation within tier: ±6 ATK/MID/DEF, ±4 GK
  const h = [...teamName.toLowerCase()].reduce((a, c) => (a * 13 + c.charCodeAt(0)) >>> 0, 7);
  const dA = ((h & 0x0F) % 13) - 6;
  const dM = (((h >> 4) & 0x0F) % 13) - 6;
  const dD = (((h >> 8) & 0x0F) % 13) - 6;
  const dG = (((h >> 12) & 0x07) % 9) - 4;

  let base;
  if (/primera divisi/i.test(t) || /la liga/i.test(t)) {
    base = { attack: 75, midfield: 75, defense: 75, goalkeeping: 73 };
  } else if (/segunda divisi[oó]n/i.test(t) && !/segunda b/i.test(t)) {
    base = { attack: 68, midfield: 68, defense: 68, goalkeeping: 66 };
  } else {
    base = { attack: 62, midfield: 62, defense: 62, goalkeeping: 61 };
  }

  return {
    attack:     clamp(base.attack + dA),
    midfield:   clamp(base.midfield + dM),
    defense:    clamp(base.defense + dD),
    goalkeeping:clamp(base.goalkeeping + dG),
  };
}

// ─────────────────────────────────────────────────────────────
// Main export: fetch squad from BDFutbol
// ─────────────────────────────────────────────────────────────
async function fetchBdfutbolSquad(teamName, era) {
  const clubId = resolveClubId(teamName);
  if (!clubId) return null;

  const season = eraToSeason(era);
  if (!season) return null;

  const url = `https://www.bdfutbol.com/es/t/t${season}${clubId}.html`;

  let html;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    html = await res.text();
    if (html.includes('Error 404') || html.length < 5000) return null;
  } catch (_) {
    return null;
  }

  const $ = cheerio.load(html);

  // Find squad table dynamically: first table containing position <div class="fit ...">
  let $table = null;
  $('table').each((_, tbl) => {
    if ($(tbl).find('div[class^="fit"]').length > 5) {
      $table = $(tbl);
      return false; // break
    }
  });
  if (!$table) return null;

  // Extract team label from page title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const rawTitle = (titleMatch?.[1] || '')
    .replace('| BDFutbol', '')
    .replace(/Plantilla de[l]? /, '')
    .trim();

  // Parse players
  const rawPlayers = [];
  $table.find('tr').each((_, row) => {
    // Position: <div class="fit {posCode}"> in the position cell
    let posCode = '';
    $(row).find('td').each((ci, td) => {
      const div = $(td).find('div[class^="fit"]').first();
      if (div.length) {
        const cls = div.attr('class') || '';
        posCode = cls.replace(/\bfit\b/, '').trim();
        return false; // found it
      }
    });

    const position = BDF_POS[posCode];
    if (!position) return; // skip header / spacer rows

    // Name: prefer common/display name (font-weight-bold), fallback to full legal name (d-none)
    const fullName = $(row).find('span.font-weight-bold').text().trim()
      || $(row).find('span.d-none').text().trim();
    if (!fullName) return;

    rawPlayers.push({ name: fullName, position });
  });

  if (rawPlayers.length < 8) return null;

  // Build a representative XI just to derive formation string
  const xi = buildXI(rawPlayers);
  const fwdCount = xi.filter(p => ['ST','RW','LW'].includes(p.position)).length;
  const midFull  = xi.filter(p => ['CM','DM','AM','RM','LM'].includes(p.position)).length;
  const defFull  = xi.filter(p => ['CB','RB','LB'].includes(p.position)).length;
  const formation = `${defFull}-${midFull}-${fwdCount}`;

  const ratings = ratingsFromTitle(rawTitle, teamName);

  return {
    formation,
    players: rawPlayers,   // full squad — engine picks best 11 per formation
    ratings,
    source:    `BDFutbol — ${rawTitle}`,
    teamLabel: rawTitle,
  };
}

module.exports = { fetchBdfutbolSquad };
