const fs = require('fs');
const buf = fs.readFileSync('./squads/america-xi.json');
const txt = buf.toString('utf8');
const idx = txt.indexOf('\uFFFD0der');
console.log('idx:', idx);
if (idx >= 0) {
  const raw = buf.slice(Math.max(0, idx-2), idx+8);
  console.log('hex:', [...raw].map(b => b.toString(16).padStart(2,'0')).join(' '));
}
// Also show the galatasaray bad char
const buf2 = fs.readFileSync('./squads/galatasaray-istanbul.json');
const txt2 = buf2.toString('utf8');
const idx2 = txt2.indexOf('\uFFFDx');
const raw2 = buf2.slice(Math.max(0, idx2-2), idx2+5);
console.log('gala hex:', [...raw2].map(b => b.toString(16).padStart(2,'0')).join(' '));
