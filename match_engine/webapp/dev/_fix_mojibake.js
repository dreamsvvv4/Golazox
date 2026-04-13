'use strict';
const fs = require('fs');

const fixes = [
  ['\u00c3\u00b1', '\u00f1'],  // Ã± → ñ
  ['\u00c3\u00a1', '\u00e1'],  // Ã¡ → á
  ['\u00c3\u00a9', '\u00e9'],  // Ã© → é
  ['\u00c3\u00b3', '\u00f3'],  // Ã³ → ó
  ['\u00c3\u00ba', '\u00fa'],  // Ãº → ú
  ['\u00c3\u00bc', '\u00fc'],  // Ã¼ → ü
  ['\u00c3\u00b6', '\u00f6'],  // Ã¶ → ö
  ['\u00c3\u00a4', '\u00e4'],  // Ã¤ → ä
  ['\u00c3\u00bb', '\u00fb'],  // Ã» → û
  ['\u00e2\u20ac\u201c', '\u2014'],  // â€" → —
  ['\u00e2\u20ac\u2122', '\u2019'],  // â€™ → '
  ['\u00e2\u20ac\u0153', '\u201c'],  // â€œ → "
  ['\u00e2\u20ac\u009d', '\u201d'],  // â€ → "
  ['\u00c2\u00b7', '\u00b7'],        // Â· → ·
];

['norwegen.json', 'spanien.json'].forEach(file => {
  let content = fs.readFileSync('squads/' + file, 'utf8');
  const before = content;
  for (const [bad, good] of fixes) {
    content = content.split(bad).join(good);
  }
  if (content !== before) {
    fs.writeFileSync('squads/' + file, content, 'utf8');
    try { JSON.parse(content); console.log(file + ': FIXED, JSON valid'); }
    catch (e) { console.log(file + ': FIXED but JSON INVALID:', e.message); }
  } else {
    console.log(file + ': no changes needed');
  }
});
