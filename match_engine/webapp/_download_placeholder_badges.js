/**
 * _download_placeholder_badges.js
 * Downloads badges for all squads that currently have _placeholder.svg
 * Run: node _download_placeholder_badges.js
 */
'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { fetchTeamBadge } = require('./lookup');

const SQUADS_DIR  = path.join(__dirname, 'squads');
const BADGES_DIR  = path.join(__dirname, 'public', 'img', 'badges');
const DELAY_MS    = 1200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // 1. Find all squads using _placeholder
  const files = fs.readdirSync(SQUADS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'));

  const targets = [];
  for (const file of files) {
    const raw  = fs.readFileSync(path.join(SQUADS_DIR, file), 'utf8');
    const bom  = raw.charCodeAt(0) === 0xFEFF;
    const data = JSON.parse(bom ? raw.slice(1) : raw);
    const bp   = data.badgeLocalPath || '';
    if (bp.includes('_placeholder')) {
      targets.push({ file, slug: data.slug || file.replace('.json',''), name: data.name || data.slug, bom });
    }
  }

  console.log(`\n🔍 Found ${targets.length} squads with placeholder badge\n`);

  let ok = 0, failed = 0;
  for (let i = 0; i < targets.length; i++) {
    const { file, slug, name, bom } = targets[i];
    const prefix = `[${String(i+1).padStart(String(targets.length).length)}/${targets.length}]`;

    // Check if PNG already exists on disk (from a previous run or manual copy)
    const pngPath = path.join(BADGES_DIR, slug + '.png');
    const jpgPath = path.join(BADGES_DIR, slug + '.jpg');
    if (fs.existsSync(pngPath) || fs.existsSync(jpgPath)) {
      const localPath = fs.existsSync(pngPath) ? `/img/badges/${slug}.png` : `/img/badges/${slug}.jpg`;
      // Update the JSON to point to the real file
      const raw  = fs.readFileSync(path.join(SQUADS_DIR, file), 'utf8');
      const bom2 = raw.charCodeAt(0) === 0xFEFF;
      const data = JSON.parse(bom2 ? raw.slice(1) : raw);
      data.badgeLocalPath = localPath;
      if (data.seasons) {
        Object.values(data.seasons).forEach(s => { if (s.badgeUrl) s.badgeUrl = localPath; });
      }
      fs.writeFileSync(path.join(SQUADS_DIR, file), (bom2 ? '\uFEFF' : '') + JSON.stringify(data, null, 2));
      console.log(`${prefix} ✅ (disk) ${slug} → ${localPath}`);
      ok++;
      continue;
    }

    // Try to download from TheSportsDB
    try {
      const localPath = await fetchTeamBadge(name);
      if (localPath) {
        // Update JSON with the real path
        const raw2  = fs.readFileSync(path.join(SQUADS_DIR, file), 'utf8');
        const bom3  = raw2.charCodeAt(0) === 0xFEFF;
        const data2 = JSON.parse(bom3 ? raw2.slice(1) : raw2);
        data2.badgeLocalPath = localPath;
        if (data2.seasons) {
          Object.values(data2.seasons).forEach(s => { if (s.badgeUrl) s.badgeUrl = localPath; });
        }
        fs.writeFileSync(path.join(SQUADS_DIR, file), (bom3 ? '\uFEFF' : '') + JSON.stringify(data2, null, 2));
        console.log(`${prefix} ✅  ${slug} (${name}) → ${localPath}`);
        ok++;
      } else {
        console.log(`${prefix} ⚠️  ${slug} (${name}) — not found in TheSportsDB`);
        failed++;
      }
    } catch (err) {
      console.log(`${prefix} ❌  ${slug} — ${err.message}`);
      failed++;
    }

    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Downloaded: ${ok} | Not found: ${failed}`);
  console.log(`All remaining squads keep _placeholder.svg (shown as generic shield)`);
}

main().catch(e => { console.error(e); process.exit(1); });
