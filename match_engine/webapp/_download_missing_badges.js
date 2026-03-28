'use strict';
/**
 * _download_missing_badges.js
 * Downloads correct badges for all squads using TheSportsDB API.
 * Resets wrong placeholder-swapped paths so they get re-downloaded correctly.
 * Usage: node _download_missing_badges.js [--delay 1200]
 */
const fs   = require('fs');
const path = require('path');
const { fetchTeamBadge } = require('./lookup');

const SQUADS_DIR = path.join(__dirname, 'squads');
const BADGE_DIR  = path.join(__dirname, 'public', 'img', 'badges');
const DELAY      = parseInt((process.argv[process.argv.indexOf('--delay') + 1] || '1200'), 10);
const sleep      = ms => new Promise(r => setTimeout(r, ms));

// Squads where we previously assigned a WRONG badge (approximation).
// These will be force-re-downloaded by name.
const WRONG_ASSIGNMENTS = new Set([
  'ca-chacarita-juniors',   // was mapped to fc-bologna-1909
  'como-1907',              // was mapped to nice
  'eidsvold-turn-fotball',  // was mapped to lille (wrong team entirely)
  'fc-stade-lausanne-ouchy',// was mapped to brest
  'fc-stade-payerne',       // was mapped to sport-club-freiburg
  'immigration-fc',         // was mapped to flamengo
  'juventud-de-las-piedras',// was mapped to caceres
  'real-betis-sevilla',     // was mapped to monterrey
  'sporting-lissabon',      // was mapped to braga (Sporting Lisboa ≠ Braga)
  'cd-mostoles-urjc',       // was mapped to fc-union-berlin
]);

async function main() {
  const files = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json'));

  // Build work list: teams without badges OR with known wrong assignments
  const todo = [];
  for (const file of files) {
    try {
      const d     = JSON.parse(fs.readFileSync(path.join(SQUADS_DIR, file), 'utf8'));
      const slug  = d.slug || file.replace('.json', '');
      const name  = d.name || slug;
      const seasons = Object.keys(d.seasons || {}).filter(k => {
        const p = d.seasons[k];
        return p && Array.isArray(p.players) && p.players.length >= 8;
      });
      if (!seasons.length) continue;

      const hasPath    = !!d.badgeLocalPath && !d.badgeLocalPath.includes('placeholder');
      const isWrong    = WRONG_ASSIGNMENTS.has(slug);
      const fileExists = hasPath && fs.existsSync(path.join(__dirname, 'public', d.badgeLocalPath));

      if (!hasPath || !fileExists || isWrong) {
        // Clear the wrong path so fetchTeamBadge will download fresh
        if (isWrong && d.badgeLocalPath) {
          d.badgeLocalPath = null;
          fs.writeFileSync(path.join(SQUADS_DIR, file), JSON.stringify(d, null, 2), 'utf8');
        }
        todo.push({ slug, name, file });
      }
    } catch (_) {}
  }

  if (!todo.length) {
    console.log('✅  All badges already present. Nothing to download.');
    return;
  }

  console.log(`\n🏟  Downloading ${todo.length} badge(s)  (delay: ${DELAY}ms)\n`);
  let ok = 0, failed = 0;

  for (let i = 0; i < todo.length; i++) {
    const { slug, name } = todo[i];
    const pfx = `[${String(i + 1).padStart(String(todo.length).length)}/${todo.length}]`;
    try {
      const localPath = await fetchTeamBadge(name);
      if (localPath) {
        console.log(`${pfx} ✅  ${name.padEnd(30)} → ${localPath}`);
        ok++;
      } else {
        console.log(`${pfx} ⚠️   ${name.padEnd(30)} — not found in TheSportsDB`);
        failed++;
      }
    } catch (err) {
      console.log(`${pfx} ❌  ${name.padEnd(30)} — ${err.message}`);
      failed++;
    }
    if (i < todo.length - 1) await sleep(DELAY);
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`  ✅ Downloaded : ${ok}`);
  console.log(`  ⚠️  Not found  : ${failed}`);
  console.log(`────────────────────────────────────────\n`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
