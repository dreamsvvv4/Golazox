/**
 * _check_year_era_gap.js
 * Finds HISTORIC_MATCHES entries where the era used differs from the match year,
 * and checks if the exact era exists in the squad JSON.
 */
const fs = require('fs'), path = require('path');

const src   = fs.readFileSync('./public/app.js', 'utf8');
const start = src.indexOf('const HISTORIC_MATCHES = [');
const end   = src.indexOf('];', start);
const block = src.slice(start, end);

// Parse each entry: label, year, a.slug, a.era, b.slug, b.era
const entryRe = /\{\s*label:\s*'([^']+)'[\s\S]*?year:\s*'(\d+)'[\s\S]*?a:\s*\{[^}]*slug:\s*'([\w-]+)'[^}]*era:\s*'(\d+)'[^}]*\}[\s\S]*?b:\s*\{[^}]*slug:\s*'([\w-]+)'[^}]*era:\s*'(\d+)'[^}]*\}/g;

let m;
const gaps = [];
while ((m = entryRe.exec(block)) !== null) {
  const [, label, year, slugA, eraA, slugB, eraB] = m;
  const yr = year.slice(0, 4); // just the start year for matching

  const checkEra = (slug, era, side) => {
    const file = path.join('./squads', slug + '.json');
    if (!fs.existsSync(file)) return `MISSING FILE: ${slug}`;
    const d = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    const eras = Object.keys(d.seasons || {});
    if (era !== yr && !eras.includes(yr)) {
      return `NEED DOWNLOAD: ${slug} era=${yr} (has: ${eras.join(',')})`;
    }
    if (era !== yr && eras.includes(yr)) {
      return `CAN FIX NOW: ${slug} era=${era} → ${yr} (available)`;
    }
    return null;
  };

  const issueA = checkEra(slugA, eraA, 'A');
  const issueB = checkEra(slugB, eraB, 'B');
  if (issueA || issueB) {
    gaps.push({ label, year, slugA, eraA, slugB, eraB, issueA, issueB });
  }
}

console.log(`Found ${gaps.length} entries with year/era mismatches:\n`);
gaps.forEach(g => {
  console.log(`"${g.label}" (${g.year})`);
  if (g.issueA) console.log(`  A: ${g.issueA}`);
  if (g.issueB) console.log(`  B: ${g.issueB}`);
});
