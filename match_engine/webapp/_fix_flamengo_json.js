const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'squads', 'flamengo-rio-de-janeiro.json');
let raw = fs.readFileSync(filePath, 'utf8');

console.log('File length:', raw.length);

// Find all occurrences of literal newline inside a JSON string
// This matches: "name": "SomeValue<NEWLINE> (missing closing quote before newline)
// Fix by adding the missing closing quote before the newline
let fixed = raw.replace(/"name":\s*"([^"\n]+),\n(\s+"position")/g, (match, name, rest) => {
  console.log('Fixing player name:', name);
  return `"name": "${name}",\n${rest}`;
});

if (fixed === raw) {
  console.log('No direct match found, trying broader fix...');
  // More general: find any string value that contains a literal unescaped newline
  // A string value in JSON starts with " and must end with "
  // If we see "...\n before the closing ", that's invalid
  // Strategy: process char by char with state machine
  let result = '';
  let inString = false;
  let i = 0;
  while (i < fixed.length) {
    const ch = fixed[i];
    if (!inString) {
      if (ch === '"') {
        inString = true;
        result += ch;
      } else {
        result += ch;
      }
    } else {
      if (ch === '\\') {
        // Escape sequence - keep both chars
        result += ch;
        i++;
        if (i < fixed.length) result += fixed[i];
      } else if (ch === '"') {
        // End of string
        inString = false;
        result += ch;
      } else if (ch === '\n' || ch === '\r') {
        // BAD: literal newline inside a string - close the string and add newline
        console.log('Found unescaped newline at position', i, 'near:', JSON.stringify(fixed.slice(Math.max(0, i-20), i+20)));
        result += '"'; // close the string prematurely
        inString = false;
        result += ch; // keep the newline outside
      } else {
        result += ch;
      }
    }
    i++;
  }
  fixed = result;
}

try {
  const parsed = JSON.parse(fixed);
  console.log('VALID JSON! Seasons:', Object.keys(parsed.seasons || {}));
  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
  console.log('File written successfully.');
} catch (e) {
  console.log('STILL INVALID:', e.message);
  const m = e.message.match(/position (\d+)/);
  if (m) {
    const pos = parseInt(m[1]);
    console.log('Context around pos', pos, ':', JSON.stringify(fixed.slice(Math.max(0, pos - 30), pos + 30)));
    console.log('Char codes:', [...fixed.slice(Math.max(0, pos - 10), pos + 10)].map(c => c.charCodeAt(0).toString(16)).join(' '));
  }
}
