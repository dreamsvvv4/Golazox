// fix-league-meta.js — one-shot patch for _LEAGUE_META tier fields
'use strict';
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'public', 'app.js');
let raw = fs.readFileSync(appPath, 'utf8');

// Locate the _LEAGUE_META block by finding the start/end markers
const startMarker = 'const _LEAGUE_META = {';
const endMarker   = '\n};';  // The closing }; on its own line after the block

const startIdx = raw.indexOf(startMarker);
if (startIdx === -1) { console.error('ERROR: _LEAGUE_META not found'); process.exit(1); }

// Find the closing }; after the start
let endIdx = raw.indexOf('\n};', startIdx);
if (endIdx === -1) { console.error('ERROR: closing }; not found'); process.exit(1); }
endIdx += 3; // include the closing }; itself

const oldBlock = raw.substring(startIdx, endIdx);
console.log('Old block length:', oldBlock.length);
console.log('Old block preview:', oldBlock.substring(0, 100));

// Build new block — add tier field to every entry.
// Strategy: regex-replace each line that has { name:... } with tier appended.
// Tier-2 leagues: La Liga 2, Championship, 2. Bundesliga, Serie B, Ligue 2
const TIER2_NAMES = ['La Liga 2', 'Championship', '2. Bundesliga', 'Serie B', 'Ligue 2'];

let newBlock = oldBlock.replace(
  /(\{ name:'([^']+)',\s+iso:'([^']*)'(\s*))\}/g,
  (match, prefix, nameVal, iso, sp) => {
    const tier = TIER2_NAMES.includes(nameVal) ? 2 : 1;
    return `${prefix}, tier:${tier} }`;
  }
).replace(
  /(\{ name:'([^']+)',\s+iso:null, svg:'([^']*)'\s*)\}/g,
  (match, prefix, nameVal) => {
    return `${prefix}, tier:1 }`;
  }
);

if (newBlock === oldBlock) {
  console.error('ERROR: no changes made — regex may not have matched. Checking...');
  // Print lines that have iso: to debug
  oldBlock.split('\n').filter(l => l.includes('iso:')).forEach(l => console.log('  |', l));
  process.exit(1);
}

raw = raw.substring(0, startIdx) + newBlock + raw.substring(endIdx);
fs.writeFileSync(appPath, raw, 'utf8');
console.log('Done. New block preview:');
console.log(newBlock.substring(0, 400));
