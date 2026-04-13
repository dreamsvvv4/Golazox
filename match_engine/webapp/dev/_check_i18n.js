const fs = require('fs');
const src = fs.readFileSync('./public/app.js', 'utf8');

// Extract I18N block
const i18nStart = src.indexOf('const I18N = {');
const i18nEnd   = src.indexOf('\n};', i18nStart) + 3;
const i18nBlock = src.slice(i18nStart, i18nEnd);

function extractKeys(lang) {
  const marker = lang === 'es' ? 'es: {' : 'en: {';
  const start   = i18nBlock.indexOf(marker);
  const after   = i18nBlock.slice(start);
  let d = 0, sectionEnd = 0;
  for (let j = 0; j < after.length; j++) {
    if (after[j] === '{') d++;
    if (after[j] === '}') { d--; if (d === 0) { sectionEnd = j; break; } }
  }
  const section = after.slice(0, sectionEnd);
  const keys = new Set();
  const re = /'([^']+)'\s*:/g;
  let m;
  while ((m = re.exec(section)) !== null) keys.add(m[1]);
  return keys;
}

const esKeys = extractKeys('es');
const enKeys = extractKeys('en');

const missingInEn = [...esKeys].filter(k => !enKeys.has(k));
const missingInEs = [...enKeys].filter(k => !esKeys.has(k));

console.log('=== MISSING IN EN (' + missingInEn.length + ') ===');
missingInEn.forEach(k => console.log('  ' + k));
console.log('\n=== MISSING IN ES (' + missingInEs.length + ') ===');
missingInEs.forEach(k => console.log('  ' + k));

// Also check: all t('key') calls in code are in I18N.es
const codeAfterI18n = src.slice(i18nEnd);
const tCallRe = /\bt\('([^']+)'\)/g;
const calledKeys = new Set();
let m2;
while ((m2 = tCallRe.exec(codeAfterI18n)) !== null) calledKeys.add(m2[1]);

const notInEs = [...calledKeys].filter(k => !esKeys.has(k));
console.log('\n=== t() CALLS WITH NO ES KEY (' + notInEs.length + ') ===');
notInEs.forEach(k => console.log('  ' + k));

console.log('\nTotal ES keys:', esKeys.size, '| EN keys:', enKeys.size);
