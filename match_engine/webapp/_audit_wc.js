'use strict';
/**
 * Quick audit of WC squad data quality:
 * - How many eras are "copied" vs "real"
 * - Spot check: show 3 random squads
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SQUADS_DIR = path.join(__dirname, 'squads');

// Load editions
const edSrc = fs.readFileSync(path.join(__dirname, 'public/_wc_editions.js'), 'utf8')
  .replace('const _WC_EDITION_YEARS', 'var _WC_EDITION_YEARS')
  .replace('const _WC_EDITIONS',      'var _WC_EDITIONS');
const ctx = {}; vm.runInNewContext(edSrc, ctx);
const { _WC_EDITIONS, _WC_EDITION_YEARS } = ctx;

function isDirectCopy(squad, era) {
  const eraPlayers = squad.seasons?.[era]?.players || [];
  if (!eraPlayers.length) return false;
  const others = Object.keys(squad.seasons).filter(e => e !== String(era));
  return others.some(e2 => {
    const p2 = squad.seasons[e2].players || [];
    if (p2.length !== eraPlayers.length) return false;
    return p2.every((p, i) => p.name === eraPlayers[i]?.name && p.position === eraPlayers[i]?.position);
  });
}

let total = 0, copied = 0, missing = 0, ok = 0;
const copiedList = [];
const spotChecks = [];

for (const year of _WC_EDITION_YEARS) {
  const ed = _WC_EDITIONS[year];
  if (!ed || !ed.groups) continue;
  for (const grp of ed.groups) {
    for (const team of grp.teams) {
      const f = path.join(SQUADS_DIR, team.slug + '.json');
      if (!fs.existsSync(f)) { missing++; total++; continue; }
      const sq = JSON.parse(fs.readFileSync(f, 'utf8'));
      const era = team.era;
      total++;
      if (!sq.seasons?.[era]?.players?.length) { missing++; continue; }
      if (isDirectCopy(sq, era)) {
        copied++;
        copiedList.push(`${team.slug}:${era}`);
      } else {
        ok++;
        // Collect random spot checks
        if (Math.random() < 0.05) spotChecks.push({ slug: team.slug, era, players: sq.seasons[era].players.slice(0,3) });
      }
    }
  }
}

console.log(`\n═══════════════════════════════════`);
console.log(`Total eras: ${total} | Real: ${ok} | Copied: ${copied} | Missing: ${missing}`);
if (copiedList.length) {
  console.log(`\nCopied eras:`);
  copiedList.forEach(x => console.log(' -', x));
}

if (spotChecks.length) {
  console.log(`\nSpot checks (${spotChecks.length} random samples):`);
  spotChecks.forEach(({ slug, era, players }) => {
    console.log(`  ${slug}:${era} → ${players.map(p => p.name + '(' + p.rating + ')').join(', ')}...`);
  });
}
