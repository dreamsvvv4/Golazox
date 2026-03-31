#!/usr/bin/env node
/**
 * audit_squads.js — Validador de plantillas GolazOX
 * Uso: node audit_squads.js [--fix-ratings] [--verbose]
 *
 * Comprueba todos los JSON en squads/ y emite:
 *   ✅  fichero correcto
 *   ⚠️  advertencia no bloqueante (encodings, ratings bajos, etc.)
 *   ❌  error que puede romper el catálogo o el motor
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const SQUADS_DIR  = path.join(__dirname, 'squads');
const META_PATH   = path.join(__dirname, 'squads-meta.json');
const VERBOSE     = process.argv.includes('--verbose');

// Load squads-meta.json overlay (used for badge path fallback)
let squadsMeta = {};
try { squadsMeta = JSON.parse(fs.readFileSync(META_PATH, 'utf8')); } catch (_) {}

// ---------------------------------------------------------------------------
const VALID_POSITIONS = new Set(['GK','CB','RB','LB','DM','CM','AM','CAM','RM','LM','RW','LW','ST','CF','SS']);
const MOJIBAKE_RE     = /Ã±|Ã¡|Ã©|Ã³|Ã\u00fa|Ã\u00fc|â€™|â€œ|â€|Â·/;  // UTF-8 bytes re-decoded as latin1
const MIN_PLAYERS     = 8;   // threshold for CATALOG inclusion
const MIN_RATED_PLAYERS = 11; // warn if playing-XI has fewer

let errors = 0, warnings = 0, ok = 0;
const report = [];

function err(file, msg)  { errors++;   report.push({ level: '❌', file, msg }); }
function warn(file, msg) { warnings++;  report.push({ level: '⚠️', file, msg }); }
function info(file, msg) { if (VERBOSE) report.push({ level: '✅', file, msg }); }

// ---------------------------------------------------------------------------
const files = fs.readdirSync(SQUADS_DIR)
  .filter(f => f.endsWith('.json') && f !== '.seed-progress.json')
  .sort();

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

  // 2. Empty stubs are OK — they just won't appear in the catalog
  if (seasonKeys.length === 0) {
    if (VERBOSE) info(fname, 'stub — no valid seasons, excluded from catalog');
    ok++;
    continue;
  }

  const latest     = seasonKeys[0];
  const season     = data.seasons[latest];
  const players    = season.players || [];
  const ratings    = season.ratings;
  const formation  = season.formation || '4-3-3';

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
    for (const k of keys) {
      const v = ratings[k];
      if (typeof v !== 'number' || v < 50 || v > 99) {
        err(fname, `season ${latest}: ratings.${k}=${v} out of range [50-99]`);
      }
    }
    const avg = (ratings.attack + ratings.midfield + ratings.defense + ratings.goalkeeping) / 4;
    if (avg < 58) {
      warn(fname, `season ${latest}: avg rating ${avg.toFixed(1)} suspiciously low (probable scrape artifact)`);
    }
  }

  // 5. Player positions
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

  // 6. GK check — first player in the XI should be GK for most uses
  const first11 = players.slice(0, 11);
  const gkCount = first11.filter(p => p.position === 'GK').length;
  // Only check GK layout for squads that already store exactly 11 players (true starting XI).
  // Larger squads (25-30 players) are naturally sorted by position group, so multiple GKs
  // appear in the first 11 — the engine handles this correctly via buildLineupFromCache.
  if (players.length <= 11) {
    if (gkCount === 0) {
      warn(fname, `season ${latest}: no GK in first 11 players — check ordering`);
    } else if (gkCount > 1) {
      warn(fname, `season ${latest}: ${gkCount} GKs in first 11 — check ordering`);
    }
  }

  // 7. Encoding
  if (MOJIBAKE_RE.test(raw)) {
    err(fname, `season ${latest}: mojibake detected in file (UTF-8 double-encoded)`);
  }

  // 8. Source attribution
  if (!season.source) {
    warn(fname, `season ${latest}: no source field`);
  }

  // 9. Badge path — check squad JSON first, then squads-meta.json overlay
  const slug  = fname.replace('.json', '');
  const badge = data.badgeLocalPath || (squadsMeta[slug] && squadsMeta[slug].badgeLocalPath);
  if (!badge) {
    warn(fname, 'no badgeLocalPath');
  } else {
    const badgeDisk = path.join(__dirname, 'public', badge.replace(/^\//, ''));
    if (!fs.existsSync(badgeDisk)) {
      err(fname, `badge file not found on disk: ${badge}`);
    }
  }

  // Detect wrong-squad contamination (source mentions different team)
  const slg = (data.slug || fname.replace('.json','')).toLowerCase();
  const src = (season.source || '').toLowerCase();
  // Flag obvious mismatches (simplified heuristic)
  const knownMismatches = [
    { slug: 'real-betis', sourceMust_not: 'benin' },
    { slug: 'inter-miami', sourceMust_not: 'myanmar' },
  ];
  for (const m of knownMismatches) {
    if (slg.includes(m.slug) && src.includes(m.sourceMust_not)) {
      err(fname, `season ${latest}: SOURCE MISMATCH — slug "${slg}" but source is "${season.source}"`);
    }
  }

  info(fname, `OK (${latest}, ${players.length} players, ratings=${JSON.stringify(ratings)})`);
  ok++;
}

// ---------------------------------------------------------------------------
// Summary
console.log('\n══════════════════════════════════════════');
console.log(' GOLAZOX SQUAD AUDIT RESULTS');
console.log('══════════════════════════════════════════');

// Print non-ok entries
const shown = report.filter(r => r.level !== '✅');
if (shown.length === 0 && !VERBOSE) {
  console.log('\n✅  All squads passed validation!');
} else {
  shown.forEach(r => console.log(`${r.level}  ${r.file}: ${r.msg}`));
}

if (VERBOSE) {
  report.filter(r => r.level === '✅').forEach(r => console.log(`${r.level}  ${r.file}: ${r.msg}`));
}

console.log('\n──────────────────────────────────────────');
console.log(`  Files scanned : ${files.length}`);
console.log(`  Errors        : ${errors}  ❌`);
console.log(`  Warnings      : ${warnings}  ⚠️`);
console.log(`  OK/stubs      : ${ok}  ✅`);
console.log('──────────────────────────────────────────');

if (errors > 0) process.exit(1);
