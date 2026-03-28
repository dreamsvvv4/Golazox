'use strict';
const fs = require('fs');
const w  = require('./wikipedia');

// Monkey-patch console.warn to capture warnings
const warns = [];
const origWarn = console.warn;
console.warn = (...a) => { warns.push(a.join(' ')); origWarn(...a); };

w.lookupWikipedia('Senegal', '2006').then(r => {
  let out = 'RESULT: ' + (r.found ? 'FOUND' : 'NOT FOUND') + '\n';
  if (r.found) {
    out += 'Source: ' + r.source + '\n';
    out += 'Players:\n' + (r.players||[]).map(p => '  ' + p.position + ' ' + p.name).join('\n');
  }
  out += '\n\nWARNS:\n' + warns.join('\n');
  fs.writeFileSync('C:/Users/vvvfb/match-engine/sn_result2.txt', out);
  console.log('Done');
}).catch(e => {
  fs.writeFileSync('C:/Users/vvvfb/match-engine/sn_result2.txt', 'ERR: ' + e.message + '\n' + warns.join('\n'));
  console.log('ERR: ' + e.message);
});
