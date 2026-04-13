'use strict';
/**
 * _fix_badges_redownload.js
 * Fix invalid HTML badges for cd-tenerife and persib-bandung by deleting
 * the corrupt files and re-downloading from TheSportsDB.
 */
const fs   = require('fs');
const path = require('path');
const { fetchTeamBadge } = require('./lookup');

const BADGES_DIR = path.join(__dirname, 'public', 'img', 'badges');
const TEAMS = [
  { slug: 'cd-tenerife',    name: 'CD Tenerife' },
  { slug: 'persib-bandung', name: 'Persib Bandung' },
];

async function isValidImage(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 8) return false;
    // PNG magic: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
    // JPEG magic: FF D8
    if (buf[0] === 0xFF && buf[1] === 0xD8) return true;
    // GIF magic: GIF8
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
    // WebP magic: RIFF....WEBP
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
    // SVG: starts with < (0x3C) but should have <svg or <?xml
    if (buf[0] === 0x3C) {
      const text = buf.slice(0, 200).toString('utf8');
      if (text.includes('<svg') || text.includes('<?xml')) return true;
      // HTML DOCTYPE → invalid
      return false;
    }
    return false;
  } catch { return false; }
}

async function main() {
  for (const { slug, name } of TEAMS) {
    const badgePath = path.join(BADGES_DIR, `${slug}.png`);
    if (fs.existsSync(badgePath)) {
      const valid = await isValidImage(badgePath);
      if (!valid) {
        console.log(`🗑️  Deleting corrupt badge: ${slug}.png`);
        fs.unlinkSync(badgePath);
      } else {
        console.log(`✅  Badge already valid: ${slug}.png`);
        continue;
      }
    }

    console.log(`⬇️  Downloading badge for ${name}...`);
    try {
      const localPath = await fetchTeamBadge(name);
      if (localPath) {
        console.log(`   ✅ Saved: ${localPath}`);
      } else {
        console.log(`   ⚠️  Not found in TheSportsDB for: ${name}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }
  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
