'use strict';
/**
 * _fill_wc_eras2.js
 * Fills missing historical WC era seasons for all teams in _WC_EDITIONS.
 * For each missing era, copies the closest existing season and adjusts
 * ratings with a per-era cap to reflect historical level.
 *
 * Run: node _fill_wc_eras2.js
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Load editions ──────────────────────────────────────────────
const edSrc = fs.readFileSync(path.join(__dirname, 'public/_wc_editions.js'), 'utf8')
  .replace('const _WC_EDITION_YEARS', 'var _WC_EDITION_YEARS')
  .replace('const _WC_EDITIONS',      'var _WC_EDITIONS');
const ctx = {};
vm.runInNewContext(edSrc, ctx);
const { _WC_EDITIONS } = ctx;

const SQUADS_DIR = path.join(__dirname, 'squads');

// Era-based rating cap (avoid inflating old editions)
function eraCap(year) {
  if (year <= 1938) return 79;
  if (year <= 1950) return 80;
  if (year <= 1966) return 82;
  if (year <= 1974) return 83;
  if (year <= 1982) return 84;
  return 86; // 1986+ we usually have real data; cap mostly unused
}

// Build map: slug -> Set of needed eras
const needed = {}; // slug -> string[]
Object.values(_WC_EDITIONS).forEach(ed => {
  if (!ed.groups) return;
  ed.groups.forEach(g => {
    g.teams.forEach(t => {
      const f = path.join(SQUADS_DIR, t.slug + '.json');
      if (!fs.existsSync(f)) return;
      const squad = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!squad.seasons) squad.seasons = {};
      if (!squad.seasons[t.era]) {
        if (!needed[t.slug]) needed[t.slug] = new Set();
        needed[t.slug].add(t.era);
      }
    });
  });
});

let totalAdded = 0;
const slugs = Object.keys(needed).sort();

slugs.forEach(slug => {
  const f = path.join(SQUADS_DIR, slug + '.json');
  const squad = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!squad.seasons) squad.seasons = {};

  const existingYears = Object.keys(squad.seasons).map(Number).sort((a, b) => a - b);
  const missingEras   = [...needed[slug]].map(Number).sort((a, b) => a - b);

  missingEras.forEach(era => {
    // Find closest existing season
    let closest = existingYears.reduce((best, y) => {
      return Math.abs(y - era) < Math.abs(best - era) ? y : best;
    }, existingYears[0]);

    const src = squad.seasons[String(closest)];
    if (!src || !src.players) {
      // Create minimal stub
      squad.seasons[String(era)] = { players: _stubPlayers(era) };
    } else {
      // Deep-copy and apply era cap
      const cap = eraCap(era);
      const players = src.players.map(p => ({
        ...p,
        rating: Math.min(p.rating, cap)
      }));
      squad.seasons[String(era)] = { players };
    }
    totalAdded++;
  });

  fs.writeFileSync(f, JSON.stringify(squad, null, 2), 'utf8');
  console.log(slug + ': added eras [' + missingEras.join(', ') + ']');
});

function _stubPlayers(era) {
  const cap = eraCap(era);
  const base = Math.max(60, cap - 12);
  return [
    { name: 'GK', position: 'GK', rating: base + 8 },
    { name: 'RB', position: 'RB', rating: base + 4 },
    { name: 'CB', position: 'CB', rating: base + 6 },
    { name: 'CB', position: 'CB', rating: base + 5 },
    { name: 'LB', position: 'LB', rating: base + 4 },
    { name: 'CM', position: 'CM', rating: base + 7 },
    { name: 'CM', position: 'CM', rating: base + 5 },
    { name: 'CM', position: 'CM', rating: base + 4 },
    { name: 'RW', position: 'RW', rating: base + 6 },
    { name: 'ST', position: 'ST', rating: base + 8 },
    { name: 'LW', position: 'LW', rating: base + 5 },
  ];
}

console.log('\nDone. Added ' + totalAdded + ' era stubs across ' + slugs.length + ' squads.');
