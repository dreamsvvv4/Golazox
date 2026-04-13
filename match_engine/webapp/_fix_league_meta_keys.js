const fs = require('fs');

// 1. Move persib-bandung from Asia → Otros in squads-meta
const metaRaw = fs.readFileSync('squads-meta.json', 'utf8').replace(/^\uFEFF/, '');
const meta = JSON.parse(metaRaw);
if (!meta['persib-bandung']) meta['persib-bandung'] = {};
meta['persib-bandung'].group = '🌍 Otros';
fs.writeFileSync('squads-meta.json', JSON.stringify(meta, null, 2), 'utf8');
console.log('✓ persib-bandung → Otros');

// 2. Fix _LEAGUE_META keys in app.js
let app = fs.readFileSync('public/app.js', 'utf8');

// Fix '\uFFFD Asia' → '🌏 Asia'
const badAsiaKey = '\uFFFD Asia';
const goodAsiaKey = '🌏 Asia';
if (app.includes(badAsiaKey)) {
  app = app.replace("'" + badAsiaKey + "':", "'" + goodAsiaKey + "':");
  console.log('✓ Fixed Asia key in _LEAGUE_META');
} else {
  console.log('Asia key: already OK or not found');
}

// Fix '\uFFFD🌍 Otros' → '🌍 Otros'
const badOtrosKey = '\uFFFD🌍 Otros';
const goodOtrosKey = '🌍 Otros';
if (app.includes(badOtrosKey)) {
  app = app.replace("'" + badOtrosKey + "':", "'" + goodOtrosKey + "':");
  console.log('✓ Fixed Otros key in _LEAGUE_META');
} else {
  console.log('Otros key: already OK or not found');
}

fs.writeFileSync('public/app.js', app, 'utf8');
console.log('✓ app.js saved');

// Verify
const app2 = fs.readFileSync('public/app.js', 'utf8');
const metaIdx = app2.indexOf('_LEAGUE_META');
const block = app2.slice(metaIdx, metaIdx + 2000);
const otrosOK = block.includes("'🌍 Otros':");
const asiaOK = block.includes("'🌏 Asia':");
console.log('\nVerify - Otros key OK:', otrosOK, '| Asia key OK:', asiaOK);
