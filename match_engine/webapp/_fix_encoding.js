/**
 * Fix cp1252 mojibake in server.js
 * UTF-8 bytes were misread as Windows-1252 and re-saved as UTF-8
 */
const fs = require('fs');
const path = require('path');

const cp1252Extras = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
};

function charToCp1252Byte(c) {
  const cp = c.charCodeAt(0);
  if (cp <= 0xFF) return cp;
  const b = cp1252Extras[cp];
  return b !== undefined ? b : null;
}

function fixMojibake(text) {
  const chars = [...text];
  const result = [];
  let i = 0;
  while (i < chars.length) {
    const cp = chars[i].charCodeAt(0);
    if (cp < 0x80) { result.push(chars[i]); i++; continue; }
    const firstByte = charToCp1252Byte(chars[i]);
    if (firstByte === null) { result.push(chars[i]); i++; continue; }
    let length;
    if (firstByte >= 0xC2 && firstByte <= 0xDF) length = 2;
    else if (firstByte >= 0xE0 && firstByte <= 0xEF) length = 3;
    else if (firstByte >= 0xF0 && firstByte <= 0xF7) length = 4;
    else { result.push(chars[i]); i++; continue; }

    if (i + length <= chars.length) {
      const bytes = [firstByte];
      let valid = true;
      for (let j = 1; j < length; j++) {
        const b = charToCp1252Byte(chars[i + j]);
        if (b === null || b < 0x80 || b > 0xBF) { valid = false; break; }
        bytes.push(b);
      }
      if (valid) {
        try {
          const decoded = Buffer.from(bytes).toString('utf-8');
          if (!decoded.includes('\uFFFD')) {
            result.push(decoded);
            i += length;
            continue;
          }
        } catch (e) { /* fall through */ }
      }
    }
    result.push(chars[i]);
    i++;
  }
  return result.join('');
}

// Quick sanity checks
const checks = [
  ['Pol\u00C3\u00ADtica', 'Pol\u00EDtica'],
  ['\u00E2\u20AC\u201D GolazoX', '\u2014 GolazoX'],
  ['P\u00C3\u00A1ginas legales', 'P\u00E1ginas legales'],
  ['diagn\u00C3\u00B3stico t\u00C3\u00A9cnico', 'diagn\u00F3stico t\u00E9cnico'],
];
let allOk = true;
for (const [input, expected] of checks) {
  const got = fixMojibake(input);
  const ok = got === expected;
  console.log(ok ? 'OK' : 'FAIL', JSON.stringify(input), '->', JSON.stringify(got), ok ? '' : '(expected ' + JSON.stringify(expected) + ')');
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error('Sanity checks failed, aborting.');
  process.exit(1);
}

const filePath = path.join(__dirname, 'server.js');
const original = fs.readFileSync(filePath, 'utf-8');
const fixed = fixMojibake(original);

// Count changes
let diffCount = 0;
for (let i = 0; i < Math.max(original.length, fixed.length); i++) {
  if (original[i] !== fixed[i]) diffCount++;
}
console.log(`\nChanges: ${diffCount} chars modified`);
console.log(`Original length: ${original.length}, Fixed length: ${fixed.length}`);

// Show a sample diff around the privacy policy
const privacyIdx = fixed.indexOf('Política de Privacidad');
if (privacyIdx > 0) {
  console.log('\nSample from fixed file:', JSON.stringify(fixed.slice(privacyIdx, privacyIdx + 80)));
}

fs.writeFileSync(filePath, fixed, 'utf-8');
console.log('\nserver.js fixed successfully!');
