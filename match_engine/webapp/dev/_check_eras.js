const fs = require('fs'), path = require('path');
const appJs = fs.readFileSync('./public/app.js', 'utf8');
const squadsDir = './squads';

// Extract the HISTORIC_MATCHES block (between const HISTORIC_MATCHES = [ and the first ]; after it)
const startIdx = appJs.indexOf('const HISTORIC_MATCHES = [');
const endIdx   = appJs.indexOf('];', startIdx);
const block    = appJs.slice(startIdx, endIdx);

// Find all slug+'era' pairs
const re = /slug:\s*'([^']+)'[^}]*?era:\s*'([^']+)'/g;
const seen = new Set();
const unique = [];
let m;
while ((m = re.exec(block)) !== null) {
  const key = m[1] + '@' + m[2];
  if (!seen.has(key)) { seen.add(key); unique.push({ slug: m[1], era: m[2] }); }
}

const errors = [];
for (const { slug, era } of unique) {
  const file = path.join(squadsDir, slug + '.json');
  if (!fs.existsSync(file)) { errors.push('MISSING FILE: ' + slug); continue; }
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const d = JSON.parse(raw);
  const eras = Object.keys(d.seasons || {});
  if (!eras.includes(era)) {
    errors.push(`BAD ERA: ${slug}  era=${era}  (available: ${eras.join(', ')})`);
  }
}

if (errors.length) errors.forEach(e => console.log(e));
else console.log('All OK - no era mismatches found');
