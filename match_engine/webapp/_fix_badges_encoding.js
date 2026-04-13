/**
 * _fix_badges_encoding.js
 *
 * Fixes two issues:
 *  1. Mojibake group strings in squads-meta.json (UTF-8→CP1252→UTF-8 double-encoding)
 *  2. Missing badgeLocalPath in squad JSON files for new Saudi/Brazil/Argentina teams
 *
 * Run: node _fix_badges_encoding.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const META_FILE   = path.join(__dirname, 'squads-meta.json');
const SQUADS_DIR  = path.join(__dirname, 'squads');
const BADGES_DIR  = path.join(__dirname, 'public', 'img', 'badges');

// ── 1. Fix mojibake in squads-meta.json ─────────────────────────────────────
// The file was saved with UTF-8 bytes read as CP1252 then re-encoded as UTF-8.
// Reverse: decode UTF-8 string → re-interpret codepoints as CP1252 bytes → parse as UTF-8.

// CP1252 extra mappings for 0x80–0x9F range
const CP1252_UNICODE = {
  0x80:0x20AC, 0x82:0x201A, 0x83:0x0192, 0x84:0x201E, 0x85:0x2026,
  0x86:0x2020, 0x87:0x2021, 0x88:0x02C6, 0x89:0x2030, 0x8A:0x0160,
  0x8B:0x2039, 0x8C:0x0152, 0x8E:0x017D, 0x91:0x2018, 0x92:0x2019,
  0x93:0x201C, 0x94:0x201D, 0x95:0x2022, 0x96:0x2013, 0x97:0x2014,
  0x98:0x02DC, 0x99:0x2122, 0x9A:0x0161, 0x9B:0x203A, 0x9C:0x0153,
  0x9E:0x017E, 0x9F:0x0178,
};
// Reverse map: Unicode codepoint → CP1252 byte
const UNICODE_CP1252 = {};
for (const [b, u] of Object.entries(CP1252_UNICODE)) UNICODE_CP1252[u] = Number(b);

function undoMojibake(str) {
  const bytes = [];
  for (const ch of str) {  // iterates by code-point (handles surrogates)
    const cp = ch.codePointAt(0);
    if (cp <= 0x7F) {
      bytes.push(cp);
    } else if (cp >= 0xA0 && cp <= 0xFF) {
      bytes.push(cp);  // Latin-1 range: byte == codepoint
    } else if (UNICODE_CP1252[cp] !== undefined) {
      bytes.push(UNICODE_CP1252[cp]);
    } else if (cp >= 0x80 && cp <= 0x9F) {
      // CP1252-undefined bytes (0x81, 0x8D, 0x8F, 0x90, 0x9D) kept as Latin-1 identity
      bytes.push(cp);
    } else {
      return null;  // cannot map → leave string unchanged
    }
  }
  try {
    return Buffer.from(new Uint8Array(bytes)).toString('utf8');
  } catch {
    return null;
  }
}

// undoMojibake handles all group strings automatically — no need for static map.

console.log('\n📝 Fixing squads-meta.json encoding...');
let metaRaw = fs.readFileSync(META_FILE, 'utf8').replace(/^\uFEFF/, ''); // strip BOM
const meta = JSON.parse(metaRaw);
let metaFixed = 0;

for (const [slug, entry] of Object.entries(meta)) {
  if (!entry || typeof entry !== 'object') continue;
  if (typeof entry.group === 'string') {
    const fixed = undoMojibake(entry.group);
    if (fixed && fixed !== entry.group) {
      console.log(`  ${slug}: "${entry.group}" → "${fixed}"`);
      entry.group = fixed;
      metaFixed++;
    }
  }
}
console.log(`  ✅ Fixed ${metaFixed} group strings`);

// ── 2. Add badgeLocalPath to squad JSONs and squads-meta.json ───────────────
// Slug → badge filename mapping (where filenames differ from slug)
const BADGE_OVERRIDES = {
  'al-akhdood':       'al-okhdood.png',
  'al-riyadh':        'al-riyadh-fc.png',
  'damac':            'damac-fc.png',
  'neom':             'neom.png',
  'abha':             'abha-fc.png',
  'fc-sao-paulo':     'sao-paulo-fc.png',
  'se-palmeiras':     'se-palmeiras-sao-paulo.png',
  'coritiba':         'coritiba-fc.png',
  'gimmnasia-mendoza':'gimnasia-y-esgrima-mendoza.png',
  'gimnasia-mendoza': 'gimnasia-y-esgrima-mendoza.png',
  // Extra aliases for old-style squad files if any
  'atletico-madrid':  'atletico-madrid.png',
  'fc-arsenal':       'fc-arsenal.png',
  'fc-liverpool':     'fc-liverpool.png',
  'fc-barcelona':     'fc-barcelona.png',
  'real-madrid':      'real-madrid.png',
};

function getBadgePath(slug) {
  const override = BADGE_OVERRIDES[slug];
  if (override) {
    const full = path.join(BADGES_DIR, override);
    return fs.existsSync(full) ? `/img/badges/${override}` : null;
  }
  const direct = path.join(BADGES_DIR, `${slug}.png`);
  if (fs.existsSync(direct)) return `/img/badges/${slug}.png`;
  return null;
}

console.log('\n📝 Adding badgeLocalPath to squad JSONs...');
const squadFiles = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json'));
let badgesAdded = 0;

for (const file of squadFiles) {
  const slug     = file.replace('.json', '');
  const filePath = path.join(SQUADS_DIR, file);
  let d;
  try { d = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { continue; }

  if (d.badgeLocalPath) continue;  // already has badge

  const badgePath = getBadgePath(slug);
  if (!badgePath) continue;  // no matching PNG

  d.badgeLocalPath = badgePath;
  fs.writeFileSync(filePath, JSON.stringify(d, null, 2), 'utf8');
  console.log(`  ${slug} → ${badgePath}`);
  badgesAdded++;
}
console.log(`  ✅ Added badgeLocalPath to ${badgesAdded} squad files`);

// Also ensure squads-meta.json has badgeLocalPath for any team that has the PNG
// (belt-and-suspenders: meta overrides squad JSON)
console.log('\n📝 Syncing badgeLocalPath to squads-meta.json...');
let metaBadgesAdded = 0;
for (const [slug, entry] of Object.entries(meta)) {
  if (!entry || typeof entry !== 'object') continue;
  if (entry.badgeLocalPath) continue;  // already set

  const badgePath = getBadgePath(slug);
  if (!badgePath) continue;

  entry.badgeLocalPath = badgePath;
  metaBadgesAdded++;
}
console.log(`  ✅ Added ${metaBadgesAdded} badgeLocalPath entries to meta`);

// ── 3. Save updated squads-meta.json ────────────────────────────────────────
fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
console.log('\n✅ squads-meta.json saved.\n');
