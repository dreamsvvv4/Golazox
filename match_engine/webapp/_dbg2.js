const fs = require('fs');
const raw = fs.readFileSync('public/app.js', 'utf8');
const idx = raw.indexOf('_LEAGUE_META');
const block = raw.slice(idx, idx + 2000);
const lines = block.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Asia') || l.includes('Otros') || l.includes('Sur')) {
    const codes = [...l.slice(0, 30)].map(c => 'U+' + c.codePointAt(0).toString(16)).join(' ');
    console.log('Line', i, ':', JSON.stringify(l.slice(0, 60)));
    console.log('  Codes:', codes);
  }
});
