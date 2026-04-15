'use strict';
/**
 * _download_wc_squads.js
 * Downloads real historical WC squad data from Wikipedia for every
 * team:era combination that currently has copied/stub data.
 *
 * Source: https://en.wikipedia.org/wiki/{YEAR}_FIFA_World_Cup_squads
 * These pages have tables per country with No./Pos./Player columns.
 *
 * Usage:
 *   node _download_wc_squads.js            # All missing eras
 *   node _download_wc_squads.js 1966       # Single year
 *   node _download_wc_squads.js 1966 1970  # Multiple years
 *   node _download_wc_squads.js --dry-run  # Preview only
 */

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const cheerio = require('cheerio');
const vm      = require('vm');

const SQUADS_DIR = path.join(__dirname, 'squads');
const DELAY_MS   = 1200;
const DRY_RUN    = process.argv.includes('--dry-run');
const DEBUG      = process.argv.includes('--debug');

// ── Load editions ──────────────────────────────────────────────
const edSrc = fs.readFileSync(path.join(__dirname, 'public/_wc_editions.js'), 'utf8')
  .replace('const _WC_EDITION_YEARS', 'var _WC_EDITION_YEARS')
  .replace('const _WC_EDITIONS',      'var _WC_EDITIONS');
const ctx = {}; vm.runInNewContext(edSrc, ctx);
const { _WC_EDITIONS, _WC_EDITION_YEARS } = ctx;

// ── Args: which years to process ──────────────────────────────
const yearArgs = process.argv.slice(2).filter(a => /^\d{4}$/.test(a)).map(Number);
const YEARS_TO_PROCESS = yearArgs.length > 0
  ? yearArgs
  : _WC_EDITION_YEARS.filter(y => _WC_EDITIONS[y].format !== 'cancelled' && _WC_EDITIONS[y].format !== 'wc2026');

// ── Helpers ────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'FootballSimulator/1.0 (educational)' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end',  () => resolve(data));
    }).on('error', reject);
  });
}

async function wpApi(params) {
  const qs = new URLSearchParams({ format: 'json', ...params }).toString();
  const raw = await httpsGet(`https://en.wikipedia.org/w/api.php?${qs}`);
  return JSON.parse(raw);
}

// ── Position mapping ───────────────────────────────────────────
const POS_MAP = {
  'gk':'GK','goalkeeper':'GK','portero':'GK','goleiro':'GK',
  'rb':'RB','right back':'RB','right-back':'RB',
  'lb':'LB','left back':'LB','left-back':'LB',
  'cb':'CB','centre-back':'CB','centre back':'CB','central':'CB',
  'df':'CB','def':'CB','defender':'CB','defensa':'CB','d':'CB',
  'dm':'DM','defensive mid':'DM','defensive midfielder':'DM',
  'am':'AM','attacking mid':'AM','attacking midfielder':'AM',
  'cm':'CM','midfielder':'CM','mid':'CM','mf':'CM','m':'CM',
  'rm':'RM','right mid':'RM','lm':'LM','left mid':'LM',
  'rw':'RW','right wing':'RW','right winger':'RW',
  'lw':'LW','left wing':'LW','left winger':'LW',
  'fw':'ST','st':'ST','striker':'ST','forward':'ST','cf':'ST',
  'centre forward':'ST','f':'ST',
};

function mapPos(raw) {
  if (!raw) return 'CM';
  const p = raw.toLowerCase().replace(/\./g,'').trim();
  if (POS_MAP[p]) return POS_MAP[p];
  if (p.startsWith('gk') || p.includes('goal'))       return 'GK';
  if (p.startsWith('rb') || p.includes('right b'))    return 'RB';
  if (p.startsWith('lb') || p.includes('left b'))     return 'LB';
  if (p.startsWith('cb') || p.includes('centr') || p.includes('defen')) return 'CB';
  if (p.startsWith('dm') || p.includes('defens mid')) return 'DM';
  if (p.startsWith('am') || p.includes('attack'))     return 'AM';
  if (p.startsWith('fw') || p.includes('forw') || p.includes('strik')) return 'ST';
  if (p.includes('mid')) return 'CM';
  return 'CM';
}

// ── Rating estimator based on position (placeholder until OVR system) ─
const POS_BASE = { GK:75, CB:74, RB:72, LB:72, DM:73, CM:74, RM:72, LM:72, AM:74, RW:74, LW:74, ST:75 };
const POS_VARIANCE = { GK:3, CB:3, RB:2, LB:2, DM:2, CM:3, RM:2, LM:2, AM:3, RW:3, LW:3, ST:3 };

function estimateRating(pos, playerIdx, totalPlayers, year) {
  const base = POS_BASE[pos] || 74;
  const variance = POS_VARIANCE[pos] || 3;
  // First 11 players tend to be starters, bonus for lower index
  const starterBonus = playerIdx < 11 ? Math.floor((10 - playerIdx) * 0.3) : -Math.floor((playerIdx - 11) * 0.5);
  // Era cap: older editions have lower max
  const eraCap = year <= 1938 ? 79 : year <= 1954 ? 81 : year <= 1970 ? 83 : year <= 1986 ? 85 : 88;
  const rating = Math.min(eraCap, base + variance + starterBonus);
  return Math.max(55, rating);
}

// ── Wikipedia squad page name → team section heading mapping ──
// Maps our team names to the section headings on Wikipedia
const SECTION_ALIASES = {
  // Our name → possible Wikipedia section headings
  'Argentina':         ['Argentina'],
  'Chile':             ['Chile'],
  'Francia':           ['France'],
  'México':            ['Mexico'],
  'Brasil':            ['Brazil', 'Brasil'],
  'Bolivia':           ['Bolivia'],
  'Yugoslavia':        ['Yugoslavia'],
  'Uruguay':           ['Uruguay'],
  'Rumania':           ['Romania', 'Rumania'],
  'Perú':              ['Peru'],
  'Estados Unidos':    ['United States', 'USA'],
  'Bélgica':           ['Belgium', 'Bélgica'],
  'Paraguay':          ['Paraguay'],
  'Italia':            ['Italy'],
  'España':            ['Spain'],
  'Austria':           ['Austria'],
  'Hungría':           ['Hungary'],
  'Egipto':            ['Egypt'],
  'Alemania Federal':  ['West Germany', 'Germany'],
  'Suecia':            ['Sweden'],
  'Checoslovaquia':    ['Czechoslovakia'],
  'Suiza':             ['Switzerland'],
  'Países Bajos':      ['Netherlands', 'Holland'],
  'Holanda':           ['Netherlands', 'Holland'],
  'Noruega':           ['Norway'],
  'Polonia':           ['Poland'],
  'Inglaterra':        ['England'],
  'Turquía':           ['Turkey'],
  'Corea del Sur':     ['South Korea'],
  'Escocia':           ['Scotland'],
  'Irlanda del Norte': ['Northern Ireland'],
  'Gales':             ['Wales'],
  'URSS':              ['Soviet Union', 'USSR'],
  'Colombia':          ['Colombia'],
  'Bulgaria':          ['Bulgaria'],
  'Corea del Norte':   ['North Korea'],
  'El Salvador':       ['El Salvador'],
  'Israel':            ['Israel'],
  'Australia':         ['Australia'],
  'RDA':               ['East Germany'],
  'Haití':             ['Haiti'],
  'Nueva Zelanda':     ['New Zealand'],
  'Honduras':          ['Honduras'],
  'Canadá':            ['Canada'],
  'Irak':              ['Iraq'],
  'Costa Rica':        ['Costa Rica'],
  'EAU':               ['United Arab Emirates', 'UAE'],
  'EE.UU.':            ['United States', 'USA'],
  'Irlanda':           ['Republic of Ireland', 'Ireland'],
  'Rusia':             ['Russia'],
  'Grecia':            ['Greece'],
  'Sudáfrica':         ['South Africa'],
  'Jamaica':           ['Jamaica'],
  'Eslovenia':         ['Slovenia'],
  'China':             ['China', 'China PR'],
  'Ecuador':           ['Ecuador'],
  'Trinidad y Tobago': ['Trinidad and Tobago'],
  'Costa de Marfil':   ['Ivory Coast', "Côte d'Ivoire"],
  'Serbia y Montenegro':['Serbia and Montenegro'],
  'Ghana':             ['Ghana'],
  'Ucrania':           ['Ukraine'],
  'Eslovaquia':        ['Slovakia'],
  'Bosnia':            ['Bosnia and Herzegovina', 'Bosnia'],
  'Arabia Saudí':      ['Saudi Arabia'],
  'Marruecos':         ['Morocco'],
  'Islandia':          ['Iceland'],
  'Panamá':            ['Panama'],
  'Catar':             ['Qatar'],
  'Dinamarca':         ['Denmark'],
  'Argelia':           ['Algeria'],
  'Portugal':          ['Portugal'],
  'Japón':             ['Japan'],
  'Croacia':           ['Croatia'],
  'Cuba':              ['Cuba'],
  'Indonesia':         ['Indonesia', 'Dutch East Indies'],
  'Alemania':          ['Germany'],
  'Senegal':           ['Senegal'],
  'Camerún':           ['Cameroon'],
  'Túnez':             ['Tunisia'],
};

// ── Fetch and parse a WC squads Wikipedia page ────────────────
async function fetchWCSquadsPage(year) {
  const pageName = `${year}_FIFA_World_Cup_squads`;
  console.log(`\nFetching: ${pageName}`);

  try {
    const data = await wpApi({ action: 'parse', page: pageName, prop: 'text', disableeditsection: 1 });
    if (!data.parse) {
      console.log(`  Page not found: ${pageName}`);
      return null;
    }
    return data.parse.text['*'];
  } catch (e) {
    console.log(`  Error fetching ${pageName}: ${e.message}`);
    return null;
  }
}

// ── Parse a country's squad from HTML ─────────────────────────
function parseTeamFromPage($, countryHeadings) {
  // Find the heading for this country
  let targetEl = null;
  for (const heading of countryHeadings) {
    $('h2, h3').each((i, el) => {
      const text = $(el).text().replace(/\[.*?\]/g,'').trim();
      if (text === heading || text.toLowerCase() === heading.toLowerCase()) {
        targetEl = el;
      }
    });
    if (targetEl) break;
  }

  if (!targetEl) { if(DEBUG) console.log('    [DBG] targetEl NOT FOUND for', countryHeadings); return null; }

  // The heading may be inside a wrapper div (mw-heading3 etc.)
  // Walk up to find the wrapper, then look for siblings
  let searchFrom = $(targetEl);
  const parent = $(targetEl).parent();
  if(DEBUG) console.log('    [DBG] parent tag:', parent[0].name, '| class:', parent.attr('class'), '| is div?', parent.is('div'), '| hasClass mw-heading?', parent.hasClass('mw-heading'));
  if (parent.is('div') && (parent.hasClass('mw-heading') || parent.hasClass('mw-heading3') || parent.hasClass('mw-heading2'))) {
    searchFrom = parent;
    if(DEBUG) console.log('    [DBG] using parent as searchFrom');
  }

  // Find the wikitable that follows (check siblings and their children)
  let table = null;
  let next = searchFrom.next();
  for (let i = 0; i < 8 && next.length; i++) {
    if(DEBUG) console.log(`    [DBG] sibling[${i}]: ${next[0].name} | class: ${(next.attr('class')||'').substring(0,60)} | wikitable:${next.is('table.wikitable')} sortable:${next.is('table.sortable')}`);
    if (next.is('table.wikitable') || next.is('table.sortable')) {
      table = next;
      break;
    }
    const inner = next.find('table.wikitable, table.sortable').first();
    if (inner.length) {
      table = inner;
      break;
    }
    // Stop if we hit another heading (new country)
    if (next.is('div.mw-heading') || next.is('h2') || next.is('h3')) break;
    next = next.next();
  }

  if (!table || !table.length) return null;

  const players = [];
  table.find('tr').each((i, row) => {
    if (i === 0) return; // skip header
    const ths = $(row).find('th');
    const tds = $(row).find('td');

    let name, pos;

    if (ths.length >= 1 && tds.length >= 1) {
      // Modern Wikipedia format: th = player name, td[0]=No, td[1]=Pos (e.g. "1GK")
      name = ths.first().text().replace(/\[.*?\]/g,'').trim();
      // Position cell may be "1GK", "2DF", "3MF" — strip leading integer
      const posRaw = tds.eq(tds.length >= 2 ? 1 : 0).text().trim().replace(/^\d+/, '');
      pos = mapPos(posRaw);
    } else if (tds.length >= 3) {
      // Legacy format: td[0]=No, td[1]=Pos, td[2]=Name
      pos  = mapPos(tds.eq(1).text().trim());
      name = tds.eq(2).text().replace(/\[.*?\]/g,'').trim();
    } else {
      return;
    }

    if (!name) return;
    // Clean: remove (c) captain, trailing birth info, extra spaces
    name = name
      .replace(/\s*\(c\)\s*/gi,'')
      .replace(/\s*\(.*?\)\s*$/,'')
      .replace(/\s+/g,' ')
      .trim();

    if (!name || name.length < 2 || /^\d+$/.test(name)) return;
    players.push({ name, pos });
  });

  return players.length >= 5 ? players : null;
}

// ── Determine if a season is a copy of another era ────────────
function isDirectCopy(squad, era) {
  const eraPlayers = squad.seasons?.[era]?.players || [];
  if (!eraPlayers.length) return false;
  const otherEras = Object.keys(squad.seasons).filter(e => e !== String(era));
  return otherEras.some(e2 => {
    const p2 = squad.seasons[e2].players || [];
    if (p2.length !== eraPlayers.length) return false;
    return p2.every((p, i) => p.name === eraPlayers[i]?.name && p.position === eraPlayers[i]?.position);
  });
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  let totalUpdated = 0;
  let totalFailed  = 0;

  for (const year of YEARS_TO_PROCESS) {
    const ed = _WC_EDITIONS[year];
    if (!ed || !ed.groups) continue;

    // Fetch the Wikipedia page for this edition
    const html = await fetchWCSquadsPage(year);
    await sleep(DELAY_MS);

    if (!html) {
      console.log(`  Skipping ${year} — no Wikipedia page`);
      continue;
    }

    const $ = cheerio.load(html);

    // For each team in this edition
    for (const group of ed.groups) {
      for (const team of group.teams) {
        const squadFile = path.join(SQUADS_DIR, team.slug + '.json');
        if (!fs.existsSync(squadFile)) continue;

        const squad = JSON.parse(fs.readFileSync(squadFile, 'utf8'));
        const era   = team.era;

        // Skip if we already have real (non-copied) data for this era
        if (squad.seasons?.[era] && !isDirectCopy(squad, era)) {
          console.log(`  ${team.slug}:${era} — already has real data, skipping`);
          continue;
        }

        // Get possible section headings for this team
        const headings = SECTION_ALIASES[team.name] || [team.name];
        const rawPlayers = parseTeamFromPage($, headings);

        if (!rawPlayers || rawPlayers.length < 5) {
          console.log(`  ✗ ${team.slug}:${era} [${team.name}] — not found on page (tried: ${headings.join(', ')})`);
          totalFailed++;
          continue;
        }

        // Build player list with estimated ratings
        const players = rawPlayers.slice(0, 23).map((p, idx) => ({
          name:     p.name,
          position: p.pos,
          rating:   estimateRating(p.pos, idx, rawPlayers.length, year),
        }));

        if (DRY_RUN) {
          console.log(`  [DRY] ${team.slug}:${era} [${team.name}] — ${players.length} players: ${players.slice(0,3).map(p=>p.name).join(', ')}...`);
          totalUpdated++;
          continue;
        }

        squad.seasons[String(era)] = { players };
        fs.writeFileSync(squadFile, JSON.stringify(squad, null, 2), 'utf8');
        console.log(`  ✓ ${team.slug}:${era} [${team.name}] — ${players.length} players (${players[0].name}, ${players[1]?.name}...)`);
        totalUpdated++;
      }
    }

    console.log(`  Year ${year} done.`);
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`Updated: ${totalUpdated} | Failed: ${totalFailed}`);
  if (DRY_RUN) console.log('(DRY RUN — nothing written)');
}

main().catch(console.error);
