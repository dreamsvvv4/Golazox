'use strict';
const fs = require('fs');
const w = require('./wikipedia');
async function main() {
  const result = await w.lookupWikipedia('FC Barcelona', '2026');
  const out = result.found
    ? 'OK: ' + result.source + '\nPlayers: ' + result.players.length + '\nGK: ' + (result.players.find(p=>p.position==='GK')||{name:'?'}).name
    : 'NOT FOUND';
  fs.writeFileSync('C:/Users/vvvfb/match-engine/wp_test.txt', out);
}
main().catch(e => fs.writeFileSync('C:/Users/vvvfb/match-engine/wp_test.txt', 'ERR: ' + e.message));
