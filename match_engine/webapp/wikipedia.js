/**
 * wikipedia.js — Squad lookup via Wikipedia API + cheerio HTML parser
 * ═══════════════════════════════════════════════════════════════════
 * Covers virtually ANY club + season that has a Wikipedia article,
 * which includes most professional teams back to the 1990s.
 *
 * Strategy:
 *  1. Search Wikipedia for "{team} {year} season" (or just "{team}")
 *  2. Retrieve the article HTML
 *  3. Find the squad/players table (class "wikitable") and extract names + positions
 *  4. Map to internal { name, position } format
 *
 * No API key required. Rate limit: polite (1 req/s effectively via user-agent).
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const cheerio = require('cheerio');

const WP_API   = 'https://en.wikipedia.org/w/api.php';
const WP_FETCH = 7000; // ms timeout

// ─────────────────────────────────────────────────────────────
// Wikipedia API helpers
// ─────────────────────────────────────────────────────────────
async function wpFetch(params) {
  const url = `${WP_API}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(WP_FETCH),
    headers: { 'User-Agent': 'FootballSimulator/1.0 (educational project)' },
  });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Position mapper — Wikipedia labels vary per language/editor
// ─────────────────────────────────────────────────────────────
const POS_MAP = {
  'gk': 'GK', 'goalkeeper': 'GK', 'portero': 'GK', 'goleiro': 'GK',
  'rb': 'RB', 'right back': 'RB', 'right-back': 'RB',
  'lb': 'LB', 'left back': 'LB', 'left-back': 'LB',
  'cb': 'CB', 'centre-back': 'CB', 'centre back': 'CB', 'central defender': 'CB',
  'df': 'CB', 'def': 'CB', 'defender': 'CB', 'defensa': 'CB',
  'dm': 'DM', 'defensive mid': 'DM', 'defensive midfielder': 'DM', 'pivote': 'DM',
  'am': 'AM', 'attacking mid': 'AM', 'attacking midfielder': 'AM', 'mediapunta': 'AM',
  'cm': 'CM', 'midfielder': 'CM', 'mid': 'CM', 'mf': 'CM', 'centrocampista': 'CM',
  'rm': 'RM', 'right mid': 'RM', 'right midfielder': 'RM',
  'lm': 'LM', 'left mid': 'LM', 'left midfielder': 'LM',
  'rw': 'RW', 'right winger': 'RW', 'right wing': 'RW',
  'lw': 'LW', 'left winger': 'LW', 'left wing': 'LW',
  'fw': 'ST', 'st': 'ST', 'striker': 'ST', 'forward': 'ST', 'cf': 'ST',
  'centre forward': 'ST', 'delantero': 'ST', 'atacante': 'ST',
};

function mapWpPos(raw) {
  if (!raw) return 'CM';
  const p = raw.toLowerCase().replace(/\./g, '').trim();
  if (POS_MAP[p]) return POS_MAP[p];
  if (p.startsWith('gk') || p.includes('goal'))      return 'GK';
  if (p.startsWith('rb') || p.includes('right b'))   return 'RB';
  if (p.startsWith('lb') || p.includes('left b'))    return 'LB';
  if (p.startsWith('cb') || p.includes('centr'))     return 'CB';
  if (p.startsWith('df') || p.includes('defen'))     return 'CB';
  if (p.startsWith('dm') || p.includes('defens mid'))return 'DM';
  if (p.startsWith('am') || p.includes('attack mid'))return 'AM';
  if (p.startsWith('rm') || p.includes('right m'))   return 'RM';
  if (p.startsWith('lm') || p.includes('left m'))    return 'LM';
  if (p.startsWith('rw') || p.includes('right w'))   return 'RW';
  if (p.startsWith('lw') || p.includes('left w'))    return 'LW';
  if (p.startsWith('fw') || p.startsWith('st') || p.includes('forw') || p.includes('strik')) return 'ST';
  if (p.startsWith('m') || p.includes('mid'))        return 'CM';
  return 'CM';
}

// ─────────────────────────────────────────────────────────────
// Extract a balanced XI from a cheerio squad table
// ─────────────────────────────────────────────────────────────
const POS_ORDER = { GK:0, RB:1, CB:1, LB:1, DM:2, CM:3, RM:3, LM:3, AM:3.5, RW:4, LW:4, ST:4 };

function extractPlayersFromHtml(html, articleTitle) {
  const $ = cheerio.load(html);

  // Collect all candidates from ALL wikitables that look like squads
  const allCandidates = [];

  $('table.wikitable').each((_ti, table) => {
    const headers = [];
    $(table).find('tr').first().find('th').each((_hi, th) => {
      headers.push($(th).text().toLowerCase().trim());
    });

    // Only process tables that have a "name" or "player" column
    const nameIdx = headers.findIndex(h => h.includes('name') || h === 'player');
    if (nameIdx === -1) return;

    // Skip statistical tables (caps leaders, scorers rankings, etc.)
    if (headers.some(h => h === 'rank' || h === 'ranking' || h === 'ratio')) return;

    // Skip coaching-staff tables (headers like "position", "name" but no sporting pos column)
    // Those have "position" meaning "head coach / assistant" — not GK/DF/MF/FW
    const hasCapsCapsOrDob = headers.some(h => h.includes('caps') || h.includes('date of birth') || h.includes('dob') || h.includes('goals') || h === 'no.' || h === 'no');
    const isStaffTable = headers.some(h => h === 'position') && !hasCapsCapsOrDob;
    if (isStaffTable) return;

    const posIdx  = headers.findIndex(h =>
      h === 'pos' || h === 'pos.' || h === 'position' || h === 'posición' || h === 'posicao'
    );
    // Club column — cells here contain club names, never player names
    const clubIdx = headers.findIndex(h =>
      h === 'club' || h === 'current club' || h === 'club team' || h === 'clubs' || h === 'team'
    );

    // ── Helpers (defined once per table, capture $ and clubIdx) ──────────
    const isLikelyClubHref = (href) =>
      /_F\.C\.|_C\.F\.|_CF\b|_RFC\b|_AFC\b|_SC\b|_SK\b|football_club|_club\b/i.test(href);

    const isValidName = (txt) => {
      if (!txt || txt.length < 2) return false;
      if (/^\d/.test(txt)) return false;           // year/number links
      if (/^[A-Z]{2,3}$/.test(txt)) return false;  // nationality codes
      if (/\bF\.?C\.?\b|\bC\.?F\.?\b|\bS\.?C\.?\b|\bA\.?C\.?\b|\bS\.?K\.?\b|\bUnited\b|\bCity\b|\bAthletic\b|\bSporting\b|\bBorussia\b|\bDynamo\b|\bOlympique\b|\bOlympiacos\b|\bBenfica\b|\bFenerbahce\b|\bGalatasaray\b/i.test(txt)) return false;
      return true;
    };

    const extractLinkName = (cell) => {
      let found = '';
      $(cell).find('a[href]').each((_, a) => {
        const href = $(a).attr('href') || '';
        if (!/^\/wiki\//.test(href)) return true;
        if (/Special:|Help:|Wikipedia:|Category:|File:|Talk:|User:|Portal:/i.test(href)) return true;
        if (isLikelyClubHref(href)) return true;
        const txt = $(a).text().trim();
        if (!isValidName(txt)) return true;
        found = txt;
        return false;
      });
      return found;
    };

    $(table).find('tr').each((_ri, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return; // need at least 3 cells for a real player row

      // ── Step 0: player name in <th scope="row"> (Wikipedia squad tables) ──
      // Many Wikipedia squad tables use <th scope="row"> for the player name
      // instead of <td>. Check those first — they are unambiguously the player.
      let nameCell = '';
      $(row).find('th').each((_, th) => {
        if (nameCell) return false;
        nameCell = extractLinkName(th) || '';
      });

      // ── Step 1: find player name in <td> cells ───────────────
      if (!nameCell) {
        const nameCols = nameIdx >= 0
          ? [nameIdx, nameIdx + 1, nameIdx - 1].filter(i => i >= 0 && i < cells.length)
          : [];
        for (const ci of nameCols) {
          nameCell = extractLinkName(cells[ci]);
          if (nameCell) break;
        }
      }

      // Pass 2: scan all cells but skip the club column
      if (!nameCell) {
        cells.each((ci, cell) => {
          if (nameCell) return false;
          if (clubIdx >= 0 && Math.abs(ci - clubIdx) <= 1) return true; // skip club col
          nameCell = extractLinkName(cell);
        });
      }

      // ── Step 2: fallback — find name by text at offset-corrected index ──
      if (!nameCell) {
        // Try nameIdx and nameIdx+1 (to handle the extra flag cell offset)
        const tryIdxes = [nameIdx, nameIdx + 1, nameIdx - 1].filter(i => i >= 0 && i < cells.length);
        for (const idx of tryIdxes) {
          const txt = $(cells[idx]).text()
            .replace(/\[.*?\]/g, '')
            .replace(/\(\d{4}-\d{2}-\d{2}\)/g, '')
            .replace(/\d{1,2}\s+\w+\s+\d{4}/g, '')
            .replace(/\(age\s*\d+\)/gi, '')
            .replace(/\(.*?\)/g, '')
            .replace(/[♦★☆▪◆]/g, '')
            .trim();
          // Must look like a person name: letters, no leading digit, ≥3 chars
          if (txt.length >= 3 && !/^\d/.test(txt) && /[a-záéíóúàèìòùñçäöüß]/i.test(txt)
              && !/^(GK|DF|MF|FW|AM|CM|DM|ST|RW|LW|CB|RB|LB|RM|LM|pos|no\.)$/i.test(txt)) {
            nameCell = txt;
            break;
          }
        }
      }

      if (!nameCell || nameCell.length < 2) return;
      // Skip rows where the "name" is actually a header label
      if (/^(name|player|pos\.?|#|no\.?|número|jugador)/i.test(nameCell)) return;

      // ── Step 3: extract position ─────────────────────────────
      // Scan cells for a position-like value (GK/DF/MF/FW or full text)
      let posRaw = '';
      if (posIdx >= 0) {
        // Try posIdx and posIdx+1 for the same offset issue
        for (const idx of [posIdx, posIdx + 1, posIdx - 1].filter(i => i >= 0 && i < cells.length)) {
          const txt = $(cells[idx]).text().replace(/\[.*?\]/g, '').replace(/^\d+/, '').trim();
          if (txt.length > 0 && txt.length <= 30) { posRaw = txt; break; }
        }
      }
      if (!posRaw) posRaw = $(cells[0]).text().replace(/\[.*?\]/g, '').replace(/^\d+/, '').trim();

      allCandidates.push({ name: nameCell, position: mapWpPos(posRaw) });
    });
  });

  if (allCandidates.length === 0) return null;

  // Deduplicate by name
  const seen = new Set();
  const unique = allCandidates.filter(p => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });

  // Build a balanced 4-3-3 XI
  const pool = {};
  for (const p of unique) (pool[p.position] = pool[p.position] || []).push(p.name);

  const xi = [];
  function take(wantedPos, n, ...fallbacks) {
    let need = n;
    for (const src of [wantedPos, ...fallbacks]) {
      while (need > 0 && pool[src] && pool[src].length > 0) {
        xi.push({ name: pool[src].shift(), position: wantedPos });
        need--;
      }
      if (!need) break;
    }
  }

  take('GK', 1);
  take('RB', 1, 'CB');
  take('CB', 2, 'RB', 'LB', 'DM');
  take('LB', 1, 'CB');
  take('DM', 1, 'CM');
  take('CM', 2, 'AM', 'DM', 'RM', 'LM');
  take('RW', 1, 'RM', 'AM', 'ST');
  take('ST', 1, 'LW', 'RW', 'AM');
  take('LW', 1, 'LM', 'AM', 'ST');

  // If we haven't filled 11, grab any remaining
  if (xi.length < 11) {
    const remaining = unique.filter(p => !xi.some(x => x.name === p.name));
    for (const p of remaining) {
      if (xi.length >= 11) break;
      xi.push(p);
    }
  }

  return xi.length >= 8 ? xi.slice(0, 11) : null;
}

// ─────────────────────────────────────────────────────────────
// Main: search Wikipedia then fetch + parse article
// ─────────────────────────────────────────────────────────────
async function lookupWikipedia(teamName, era) {
  // Build search queries from most-specific to least-specific
  const year = era ? era.match(/\d{4}/)?.[0] : null;
  const queries = [];

  // Detect national teams: no club keywords present
  const isLikelyNational = !/\b(fc|cf|sc|ac|cd|ud|sd|bk|sk|united|city|town|athletic|club|hotspur|rovers|wanderers|dynamo|sporting|real|celtic|rangers|1\.?\s*fc)\b/i.test(teamName);

  if (isLikelyNational) {
    // National team queries — highest priority
    if (year) {
      const yr = parseInt(year);
      // FIFA World Cup years
      const WC_YEARS = [1930,1934,1938,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022,2026];
      const nearestWC = WC_YEARS.find(y => Math.abs(y - yr) <= 2);
      if (nearestWC) queries.push(`${teamName} at the ${nearestWC} FIFA World Cup`);
      // UEFA Euro years
      const EURO_YEARS = [1960,1964,1968,1972,1976,1980,1984,1988,1992,1996,2000,2004,2008,2012,2016,2020,2024];
      const nearestEuro = EURO_YEARS.find(y => Math.abs(y - yr) <= 2);
      if (nearestEuro) queries.push(`${teamName} at UEFA Euro ${nearestEuro}`);
      // Copa América years
      const CA_YEARS = [1916,1917,1919,1920,1921,1922,1923,1924,1925,1926,1927,1929,1935,1937,1939,1941,1942,1945,1946,1947,1949,1953,1955,1956,1957,1959,1963,1967,1975,1979,1983,1987,1989,1991,1993,1995,1997,1999,2001,2004,2007,2011,2015,2016,2019,2021,2024];
      const nearestCA = CA_YEARS.find(y => Math.abs(y - yr) <= 1);
      if (nearestCA) queries.push(`${teamName} at the ${nearestCA} Copa América`);
      queries.push(`${teamName} national football team ${yr}`);
    }
    queries.push(`${teamName} national football team`);
  }

  if (year) {
    const yr     = parseInt(year);
    const season = `${yr}-${String(yr + 1).slice(-2)}`; // e.g. 2000-01
    const prevSeason = `${yr - 1}-${String(yr).slice(-2)}`; // e.g. 1999-00
    // Year-first format is how Wikipedia titles most club season articles
    queries.push(`${prevSeason} ${teamName} season`); // "2025-26 FC Barcelona season"
    queries.push(`${season} ${teamName} season`);     // "2026-27 FC Barcelona season"
    queries.push(`${teamName} ${season} season`);
    queries.push(`${teamName} ${yr}-${yr + 1} season`);
    queries.push(`${teamName} ${prevSeason} season`);
    queries.push(`${teamName} ${yr - 1}-${yr} season`);
    queries.push(`${teamName} ${era}`);
    queries.push(`${teamName} ${yr}`);
  }
  if (!isLikelyNational) queries.push(`${teamName} F.C.`);
  queries.push(teamName);

  for (const query of queries) {
    try {
      // 1. Search
      const searchData = await wpFetch({
        action: 'opensearch',
        search: query,
        limit:  5,
        namespace: 0,
      });
      const titles = searchData[1]; // array of article titles
      if (!titles || titles.length === 0) continue;

      // 2. Pick best title (prefer national team / World Cup / season article, then club article)
      // Only include women's-team articles if the user explicitly asked for them
      const wantsWomen = /women|femeni|femenin|ladies|mujer/i.test(teamName);
      const isWomenTitle = (t) => !wantsWomen && /(femen[ií][oa]?n?|women'?s?|ladies|f[eé]minin)/i.test(t);

      const nationalTitle = isLikelyNational ? titles.find(t =>
        !isWomenTitle(t) &&
        /national football team|world cup|copa am[eé]rica|uefa euro|at the \d{4}/i.test(t) &&
        new RegExp(teamName.split(' ')[0], 'i').test(t)
      ) : null;
      const seasonTitle = titles.find(t =>
        !isWomenTitle(t) &&
        /season|temporada/i.test(t) &&
        new RegExp(teamName.split(' ').slice(0, 2).join('.{0,3}'), 'i').test(t) &&
        (year ? t.includes(year) || t.includes(`${parseInt(year)-1}`) : true)
      );
      const clubTitle = titles.find(t =>
        !isWomenTitle(t) &&
        new RegExp(teamName.split(' ')[0], 'i').test(t) &&
        !/(disambiguation|football association)/i.test(t)
      );
      let chosenTitle = nationalTitle || seasonTitle || clubTitle
        || titles.find(t => !isWomenTitle(t))
        || titles[0];

      // If the chosen article is the generic "X national football team" page (no year/tournament
      // in the title) but the requested year is historical (>2 years before now), skip it —
      // that article only contains the current squad and would return wrong players.
      if (chosenTitle && year && isLikelyNational) {
        const isGenericNational = /national football team/i.test(chosenTitle) &&
          !/world cup|copa am[eé]rica|uefa euro|at the \d{4}|\d{4}[-–]\d{2}/i.test(chosenTitle);
        const currentYear = new Date().getFullYear();
        const requestedYear = parseInt(year);
        if (isGenericNational && requestedYear < currentYear - 2) continue; // skip — year too old
      }

      // 3. Fetch article HTML
      const parseData = await wpFetch({
        action: 'parse',
        page:   chosenTitle,
        prop:   'text',
        section: 0,  // only intro first to check it's a football article
      });

      // Verify it's a football article
      const intro = parseData?.parse?.text?.['*'] || '';
      const isFootball = /football|soccer|fútbol|calcio|futebol/i.test(intro);
      if (!isFootball && year) continue; // skip non-football articles when searching with year
      if (!chosenTitle) continue;

      // 4. Fetch full article for squad tables
      const fullData = await wpFetch({
        action: 'parse',
        page:   chosenTitle,
        prop:   'text',
      });
      const fullHtml = fullData?.parse?.text?.['*'];
      if (!fullHtml) continue;

      const players = extractPlayersFromHtml(fullHtml, chosenTitle);
      if (!players) continue;

      return {
        found:      true,
        formation:  '4-3-3',
        players,
        ratings:    null,  // engine will use heuristic
        source:     `Wikipedia — "${chosenTitle}"`,
        teamLabel:  teamName + (era ? ` (${era})` : ''),
      };

    } catch (err) {
      // try next query
      console.warn(`[wikipedia] query "${query}" failed: ${err.message}`);
    }
  }

  return { found: false, source: null };
}

module.exports = { lookupWikipedia };
