#!/usr/bin/env node
/**
 * audit_squads.js — Validador de plantillas GolazOX
 *
 * USO:
 *   node audit_squads.js                     # Resumen básico
 *   node audit_squads.js --verbose            # Muestra también los OK
 *   node audit_squads.js --check-names        # Activa detección de jugadores erróneos
 *   node audit_squads.js --check-clones       # Detecta squads clonados/duplicados
 *   node audit_squads.js --check-names --check-clones --verbose  # Auditoría completa
 *
 * Checks:
 *   ❌ JSON parse error
 *   ❌ Menos de 8 jugadores
 *   ❌ Rating fuera de rango [50-99]
 *   ❌ Mojibake (UTF-8 doble-codificado)
 *   ❌ Badge no encontrado en disco
 *   ❌ Jugador famoso en equipo equivocado (--check-names)
 *   ⚠️  Ratings uniformes (todos iguales = probable heurística por defecto)
 *   ⚠️  Squad clonado: mismo set de jugadores en otro equipo/año (--check-clones)
 *   ⚠️  Patron de nombre sospechoso en selección nacional (--check-names)
 *   ⚠️  Media muy baja (<58) — posible artefacto de scraping
 *   ⚠️  Sin fuente (source)
 *   ⚠️  Sin badge
 *   ⚠️  Squad desactualizado (último año > 2 años atrás)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const SQUADS_DIR  = path.join(__dirname, 'squads');
const META_PATH   = path.join(__dirname, 'squads-meta.json');
const VERBOSE      = process.argv.includes('--verbose');
const CHECK_NAMES  = process.argv.includes('--check-names');
const CHECK_CLONES = process.argv.includes('--check-clones');

// Load squads-meta.json overlay (used for badge path fallback)
let squadsMeta = {};
try { squadsMeta = JSON.parse(fs.readFileSync(META_PATH, 'utf8')); } catch (_) {}

// ═══════════════════════════════════════════════════════════════════════════
// FAMOUS PLAYERS dictionary — full name (normalized) → [ expected squad slugs ]
// Used to catch obvious data contamination (e.g. Thomas Müller in brasilien.json)
// Only iconic/unmistakable players are listed to avoid false positives.
// ═══════════════════════════════════════════════════════════════════════════
const FAMOUS_PLAYERS = {
  // Germany
  'thomas muller':        ['deutschland'],
  'thomas müller':        ['deutschland'],
  'manuel neuer':         ['deutschland', 'fc-bayern-munchen'],
  'miroslav klose':       ['deutschland'],
  'oliver kahn':          ['deutschland', 'fc-bayern-munchen'],
  'lothar matthaus':      ['deutschland'],
  'lothar matthäus':      ['deutschland'],
  'franz beckenbauer':    ['deutschland'],
  'gerd muller':          ['deutschland'],
  'gerd müller':          ['deutschland'],
  'sepp maier':           ['deutschland'],
  'karl-heinz rummenigge':['deutschland'],
  'jurgen klinsmann':     ['deutschland'],
  'jürgen klinsmann':     ['deutschland'],
  'bastian schweinsteiger':['deutschland'],
  'philipp lahm':         ['deutschland'],
  'michael ballack':      ['deutschland'],
  // Argentina
  'lionel messi':         ['argentinien'],
  'diego maradona':       ['argentinien'],
  'gabriel batistuta':    ['argentinien'],
  'hernan crespo':        ['argentinien'],
  'hernán crespo':        ['argentinien'],
  'javier zanetti':       ['argentinien'],
  'juan roman riquelme':  ['argentinien'],
  'pablo aimar':          ['argentinien'],
  // Brazil
  'neymar':               ['brasilien'],
  'ronaldo nazario':      ['brasilien'],
  'ronaldo nazário':      ['brasilien'],
  'ronaldinho':           ['brasilien'],
  'pele':                 ['brasilien'],
  'pelé':                 ['brasilien'],
  'kaka':                 ['brasilien'],
  'kaká':                 ['brasilien'],
  'zico':                 ['brasilien'],
  'socrates':             ['brasilien'],
  'sócrates':             ['brasilien'],
  'romario':              ['brasilien'],
  'romário':              ['brasilien'],
  'rivaldo':              ['brasilien'],
  'cafu':                 ['brasilien'],
  'roberto carlos':       ['brasilien'],
  // France
  'zinedine zidane':      ['frankreich'],
  'thierry henry':        ['frankreich'],
  'eric cantona':         ['frankreich'],
  'michel platini':       ['frankreich'],
  'didier deschamps':     ['frankreich'],
  'kylian mbappe':        ['frankreich'],
  'kylian mbappé':        ['frankreich'],
  // Spain
  'iker casillas':        ['spanien'],
  'xavi hernandez':       ['spanien'],
  'xavi hernández':       ['spanien'],
  'andres iniesta':       ['spanien'],
  'andrés iniesta':       ['spanien'],
  'david villa':          ['spanien'],
  'fernando torres':      ['spanien'],
  'sergio ramos':         ['spanien'],
  'raul gonzalez':        ['spanien'],
  'raúl González':        ['spanien'],
  // England
  'david beckham':        ['england'],
  'wayne rooney':         ['england'],
  'steven gerrard':       ['england'],
  'frank lampard':        ['england'],
  'peter schmeichel':     ['daenemark'],
  // Portugal
  'cristiano ronaldo':    ['portugal'],
  'luis figo':            ['portugal'],
  'luís figo':            ['portugal'],
  'rui costa':            ['portugal'],
  'eusebio da silva ferreira': ['portugal'],
  'eusébio da silva ferreira': ['portugal'],
  // Netherlands
  'johan cruyff':         ['niederlande'],
  'marco van basten':     ['niederlande'],
  'ruud gullit':          ['niederlande'],
  'frank rijkaard':       ['niederlande'],
  'dennis bergkamp':      ['niederlande'],
  'arjen robben':         ['niederlande'],
  // Italy
  'roberto baggio':       ['italien'],
  'franco baresi':        ['italien'],
  'paolo maldini':        ['italien'],
  'gianluigi buffon':     ['italien'],
  // Russia / Soviet Union / Yugoslavia
  'lev yashin':           ['udssr', 'russland'],
};

// Normalize a name for lookup
function normName(n) {
  return (n || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ä/g,'a').replace(/ß/g,'ss')
    .replace(/\s+/g,' ').trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// NATIONAL TEAM SLUG detection — which squad files are national teams
// ═══════════════════════════════════════════════════════════════════════════
const NATIONAL_SLUGS = new Set([
  'albanien','algerien','argentinien','australien','belgien','bosnien',
  'brasilien','bulgarien','chile','colombia','costa-rica','daenemark',
  'deutschland','ecuador','england','finnland','frankreich','ghana',
  'griechenland','irland','island','israel','italien','japan','kamerun',
  'kanada','kolumbien','kroatien','marokko','mexiko','neuseeland',
  'niederlande','nigeria','nordirland','norwegen','oesterreich','paraguay',
  'peru','polen','portugal','rumaenien','russland','saudi-arabien','schottland',
  'schweden','schweiz','serbien','senegal','slowakei','slowenien','spanien',
  'suedkorea','tschechien','tunesien','tuerkei','udssr','ukraine','ungarn',
  'uruguay','usa','venezuela','wales',
  // common alternative spellings
  'argentina','australia','belgica','brasil','colombia','croatia','denmark',
  'ecuador','france','germany','ghana','greece','hungary','iran',
  'italy','japan','mexico','morocco','netherlands','norway','peru',
  'poland','portugal','russia','scotland','senegal','serbia','spain',
  'sweden','switzerland','turkey','ukraine','england','usa',
]);

// Characters/patterns highly specific to certain languages — for national team name check
// (Used ONLY on national team slugs to reduce false positives)
const GERMAN_CHARS_RE    = /[äöüÄÖÜß]/u;
const GERMAN_SURNAMES    = new Set(['müller','schmidt','schneider','meyer','fischer','weber',
  'wagner','becker','schulz','hoffmann','koch','richter','bauer','klein','wolf',
  'schäfer','neuer','klose','özil','kroos','rummenigge','beckenbauer','maier',
  'lahm','schweinsteiger','ballack','klinsmann','bierhoff','matthäus','matthaeus']);

// ═══════════════════════════════════════════════════════════════════════════

const VALID_POSITIONS   = new Set(['GK','CB','RB','LB','DM','CM','AM','CAM','RM','LM','RW','LW','ST','CF','SS']);
const MOJIBAKE_RE       = /Ã±|Ã¡|Ã©|Ã³|Ã\u00fa|Ã\u00fc|â€™|â€œ|â€|Â·/;
const MIN_PLAYERS       = 8;
const MIN_RATED_PLAYERS = 11;
const CURRENT_YEAR      = new Date().getFullYear();

let errors = 0, warnings = 0, ok = 0;
const report = [];

function err(file, msg)  { errors++;   report.push({ level: '❌', file, msg }); }
function warn(file, msg) { warnings++;  report.push({ level: '⚠️', file, msg }); }
function note(file, msg) { if (VERBOSE) report.push({ level: '✅', file, msg }); }

// ── Load all files for cross-squad analysis ────────────────────
const files = fs.readdirSync(SQUADS_DIR)
  .filter(f => f.endsWith('.json') && f !== '.seed-progress.json')
  .sort();

// For clone detection: build a map of canonical player-set fingerprint → list of (file,year)
// fingerprint = sorted player names joined (first 11)
const cloneMap = {};   // fingerprint → [{ file, year }]

// ── Per-file validation loop ───────────────────────────────────
for (const fname of files) {
  const fpath = path.join(SQUADS_DIR, fname);
  let raw, data;

  // 1. JSON parse
  try {
    raw  = fs.readFileSync(fpath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    err(fname, `JSON parse error: ${e.message}`);
    continue;
  }

  const seasonKeys = Object.keys(data.seasons || {})
    .filter(s => /^(19[5-9]\d|20[0-2]\d)$/.test(s))
    .sort((a, b) => Number(b) - Number(a));

  // 2. Empty stubs are OK
  if (seasonKeys.length === 0) {
    note(fname, 'stub — no valid seasons, excluded from catalog');
    ok++;
    continue;
  }

  const slug    = fname.replace('.json', '');
  const isNatl  = NATIONAL_SLUGS.has(slug);
  const latest  = seasonKeys[0];
  const season  = data.seasons[latest];
  const players = season.players || [];
  const ratings = season.ratings;

  // 3. Player count
  if (players.length < MIN_PLAYERS) {
    err(fname, `season ${latest}: only ${players.length} players (min ${MIN_PLAYERS} to appear in catalog)`);
  } else if (players.length < MIN_RATED_PLAYERS) {
    warn(fname, `season ${latest}: ${players.length} players — top-11 may be incomplete`);
  }

  // 4. Ratings
  if (!ratings) {
    warn(fname, `season ${latest}: ratings=null — engine will fall back to heuristic`);
  } else {
    const keys = ['attack','midfield','defense','goalkeeping'];
    let allSame = true;
    const firstVal = ratings[keys[0]];
    for (const k of keys) {
      const v = ratings[k];
      if (typeof v !== 'number' || v < 50 || v > 99) {
        err(fname, `season ${latest}: ratings.${k}=${v} out of range [50-99]`);
      }
      if (v !== firstVal) allSame = false;
    }
    const avg = (ratings.attack + ratings.midfield + ratings.defense + ratings.goalkeeping) / 4;
    if (avg < 58) {
      warn(fname, `season ${latest}: avg rating ${avg.toFixed(1)} suspiciously low`);
    }
    // NEW: all 4 ratings identical → probably a default/heuristic, not real data
    if (allSame && typeof firstVal === 'number') {
      warn(fname, `season ${latest}: all 4 ratings = ${firstVal} (identical values suggest auto-generated defaults)`);
    }
  }

  // 5. Player positions & duplicates
  const posCounts = {};
  const names     = new Set();
  for (const p of players) {
    if (!VALID_POSITIONS.has(p.position)) {
      warn(fname, `season ${latest}: player "${p.name}" has unknown position "${p.position}"`);
    }
    if (names.has(p.name)) {
      warn(fname, `season ${latest}: duplicate player name "${p.name}"`);
    }
    names.add(p.name);
    posCounts[p.position] = (posCounts[p.position] || 0) + 1;
  }

  // 6. GK check
  const first11 = players.slice(0, 11);
  const gkCount = first11.filter(p => p.position === 'GK').length;
  if (players.length <= 11) {
    if (gkCount === 0)  warn(fname, `season ${latest}: no GK in first 11 players — check ordering`);
    else if (gkCount > 1) warn(fname, `season ${latest}: ${gkCount} GKs in first 11 — check ordering`);
  }

  // 7. Encoding
  if (MOJIBAKE_RE.test(raw)) {
    err(fname, `season ${latest}: mojibake detected in file (UTF-8 double-encoded)`);
  }

  // 8. Source attribution
  if (!season.source) {
    warn(fname, `season ${latest}: no source field`);
  }

  // 9. Badge path
  const badge = data.badgeLocalPath || (squadsMeta[slug] && squadsMeta[slug].badgeLocalPath);
  if (!badge) {
    warn(fname, 'no badgeLocalPath');
  } else {
    const badgeDisk = path.join(__dirname, 'public', badge.replace(/^\//, ''));
    if (!fs.existsSync(badgeDisk)) {
      err(fname, `badge file not found on disk: ${badge}`);
    }
  }

  // 10. NEW — Stale squad: no season newer than (currentYear - 2)
  const maxYear = Math.max(...seasonKeys.map(Number));
  if (maxYear < CURRENT_YEAR - 2) {
    note(fname, `possibly stale — newest season is ${maxYear} (current: ${CURRENT_YEAR})`);
  }

  // 11. NEW — Famous player cross-check (national teams only, all seasons)
  if (CHECK_NAMES && isNatl) {
    for (const yr of seasonKeys) {
      const s = data.seasons[yr];
      for (const p of (s.players || [])) {
        const norm = normName(p.name);
        const expected = FAMOUS_PLAYERS[norm];
        if (expected && !expected.includes(slug)) {
          err(fname, `season ${yr}: "${p.name}" is a well-known player for [${expected.join('|')}] — wrong squad?`);
        }
      }
    }

    // 12. NEW — German name patterns in non-German national teams
    if (isNatl && slug !== 'deutschland' && slug !== 'oesterreich' && slug !== 'schweiz') {
      for (const yr of seasonKeys) {
        const s = data.seasons[yr];
        const suspicious = (s.players || []).filter(p => {
          const parts = p.name.toLowerCase().split(/\s+/);
          const surname = parts[parts.length - 1];
          return GERMAN_CHARS_RE.test(p.name) && GERMAN_SURNAMES.has(surname);
        });
        if (suspicious.length > 0) {
          warn(fname, `season ${yr}: players with typical German surnames in national team: ${suspicious.map(p => p.name).join(', ')}`);
        }
      }
    }
  }

  // 13. NEW — Clone fingerprint (for CHECK_CLONES pass)
  if (CHECK_CLONES) {
    for (const yr of seasonKeys) {
      const s = data.seasons[yr];
      const ps = (s.players || []).slice(0, 15);
      if (ps.length >= 8) {
        const fp = ps.map(p => normName(p.name)).sort().join('|');
        (cloneMap[fp] = cloneMap[fp] || []).push({ file: fname, year: yr });
      }
    }
  }

  note(fname, `OK (${latest}, ${players.length} players, ratings=${JSON.stringify(ratings)})`);
  ok++;
}

// ── Clone detection pass ───────────────────────────────────────
if (CHECK_CLONES) {
  for (const [fp, entries] of Object.entries(cloneMap)) {
    if (entries.length > 1) {
      // Check if any two entries are different files (not same team, different years)
      const byFile = {};
      for (const e of entries) (byFile[e.file] = byFile[e.file] || []).push(e.year);
      const fileList = Object.keys(byFile);
      if (fileList.length > 1) {
        // Multiple distinct files share same player fingerprint → probable clone
        const detail = fileList.map(f => `${f}(${byFile[f].join(',')})`).join(' ≈ ');
        warn('CLONE', `Idéntica alineación en múltiples equipos: ${detail}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log(' GOLAZOX SQUAD AUDIT');
console.log(`  Flags: ${[
  CHECK_NAMES  ? '--check-names'  : '',
  CHECK_CLONES ? '--check-clones' : '',
  VERBOSE      ? '--verbose'      : '',
].filter(Boolean).join(' ') || '(standard)'}`);
console.log('══════════════════════════════════════════════════════');

const shown = report.filter(r => r.level !== '✅');
if (shown.length === 0 && !VERBOSE) {
  console.log('\n✅  All squads passed validation!');
} else {
  shown.forEach(r => console.log(`${r.level}  ${r.file}: ${r.msg}`));
}

if (VERBOSE) {
  report.filter(r => r.level === '✅').forEach(r => console.log(`${r.level}  ${r.file}: ${r.msg}`));
}

console.log('\n──────────────────────────────────────────────────────');
console.log(`  Files scanned : ${files.length}`);
console.log(`  Errors        : ${errors}  ❌`);
console.log(`  Warnings      : ${warnings}  ⚠️`);
console.log(`  OK/stubs      : ${ok}  ✅`);
console.log('──────────────────────────────────────────────────────');
console.log('  Tips:');
console.log('    --check-names   → detecta jugadores en selección incorrecta');
console.log('    --check-clones  → detecta plantillas clonadas entre equipos');
console.log('    --verbose       → muestra también los OK');
console.log('──────────────────────────────────────────────────────');

if (errors > 0) process.exit(1);

