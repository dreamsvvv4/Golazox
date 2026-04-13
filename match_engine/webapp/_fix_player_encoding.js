/**
 * _fix_player_encoding.js
 * Fixes corrupted player names in squad JSON files:
 *  - \uFFFDx  → ş (Turkish/Bosnian) or ğ (Turkish, in oğlu/doğan context) or ß (German)
 *  - \uFFFD!  → ć (end of word, Croatian/Serbian) or Ç (start of word, Turkish)
 *  - \uFFFD0  → É (French/Spanish É at word start)
 *  - \uFFFDS  → Ü (Turkish Ü at word start)
 *  - \uFFFD\u0013 → Ö
 *  - \uFFFD\u001c or \u0019 → Ó
 *  - \uFFFD~  → Ş
 *  - \uFFFD\n → nothing (strip)
 *  - ÃX pairs → undo double-UTF8 encoding
 *  - \u0081, \u0082... control chars after Ã → fix double encoding
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const SQUADS_DIR = path.join(__dirname, 'squads');

// ── Double-encoded UTF-8 fix ──────────────────────────────────────────────
// If a Latin-1 file was re-read as UTF-8, chars like á,é,ó,ú,ü etc got doubled.
// e.g., á = U+00E1 = UTF-8: C3 A1.  Reading those bytes as Latin-1: "Ã¡".
// We fix these common sequences:
const DOUBLE_ENCODED = [
  // Format: [bad, good]  — double-encoded UTF-8 read as Latin-1
  // These are strings where UTF-8 bytes were mistakenly treated as Latin-1 chars
  ['\xC3\x81', '\xC1'],  // Ã + \x81 → Á
  ['\xC3\x80', '\xC0'],  // Ã + \x80 → À
  ['\xC3\xA9', '\xE9'],  // Ã© → é
  ['\xC3\xA8', '\xE8'],  // Ã¨ → è
  ['\xC3\xAA', '\xEA'],  // Ãª → ê
  ['\xC3\xA1', '\xE1'],  // Ã¡ → á
  ['\xC3\xA0', '\xE0'],  // Ã  → à
  ['\xC3\xB3', '\xF3'],  // Ã³ → ó
  ['\xC3\xB2', '\xF2'],  // Ã² → ò
  ['\xC3\xAD', '\xED'],  // Ã­ → í
  ['\xC3\xBA', '\xFA'],  // Ãº → ú
  ['\xC3\xB9', '\xF9'],  // Ã¹ → ù
  ['\xC3\xA4', '\xE4'],  // Ã¤ → ä
  ['\xC3\xB6', '\xF6'],  // Ã¶ → ö
  ['\xC3\xBC', '\xFC'],  // Ã¼ → ü
  ['\xC3\x9C', '\xDC'],  // Ã\x9C → Ü
  ['\xC3\x87', '\xC7'],  // Ã\x87 → Ç
  ['\xC3\xA7', '\xE7'],  // Ã§ → ç
  ['\xC3\x93', '\xD3'],  // Ã\x93 → Ó
  ['\xC3\x89', '\xC9'],  // Ã\x89 → É
];

// ── Context-based \uFFFD fix ──────────────────────────────────────────────
function fixName(name, filePath) {
  if (!name || !/[\uFFFD\x80-\x9F]/.test(name)) return name;

  let n = name;

  // ── \uFFFD followed by specific char ─────────────────────────────────
  // Handle multi-char patterns first (longest match wins)

  // \uFFFD~  → Ş  (Turkish Ş, as in Şener)
  n = n.replace(/\uFFFD~/g, 'Ş');

  // \uFFFD\u0013 → Ö
  n = n.replace(/\uFFFD\u0013/g, 'Ö');

  // \uFFFD\u0019 → Ó (Ó - used in Spanish Óscar, Ólafur)
  n = n.replace(/\uFFFD\u0019/g, 'Ó');

  // \uFFFD\u001c → Ó (also Ó - Óscar etc.)
  n = n.replace(/\uFFFD\u001c/g, 'Ó');

  // \uFFFDS → Ü (Turkish Ü at start of name, as in Ümit, Ünüvar)
  n = n.replace(/\uFFFDS(?=[a-zğşıöüç])/g, 'Ü');
  // \uFFFDS in other contexts (also Ü)
  n = n.replace(/\uFFFDS/g, 'Ü');

  // \uFFFD0 → É (French/Spanish É: Éder, Édouard, Érick, etc.)
  n = n.replace(/\uFFFD0/g, 'É');

  // \uFFFD! at end of name or before space → ć (Croatian/Serbian -ić ending)
  n = n.replace(/\uFFFD!(?=\s|$)/g, 'ć');

  // \uFFFD! before lowercase letter at start of word → Ç (Turkish Çubukçu, Çakır...)
  n = n.replace(/\uFFFD!(?=[a-zğşıöüçA-Z])/g, (m, offset) => {
    // If the next char is lowercase, it's Ç or Č based on context
    // Turkish context: before a, e, i, u, o → Ç
    const after = n.slice(offset + 2);  // not quite right, but handled below
    return 'Ç';
  });

  // \uFFFD! anywhere remaining → ć (fallback)
  n = n.replace(/\uFFFD!/g, 'ć');

  // \uFFFDx → ş / ğ / ß depending on context
  // Rule: 
  //   - German context (Häßler, etc.) → ß
  //   - After 'o' before 'lu' or 'lan' or 'la' → ğ (oğlu ending)
  //   - After 'o' before 'an' or 'uz' → ğ (Doğan, Erdoğan)
  //   - Otherwise → ş
  n = n.replace(/\uFFFDx/g, (m, offset) => {
    const before2 = n.slice(Math.max(0, offset - 2), offset).toLowerCase();
    const after3  = n.slice(offset + 2, offset + 5).toLowerCase();

    // German ß: typically after 'ä', 'a', 'u', 'e' in German names, before consonants
    // Known German context: Häßler, Heßler, Weiße, etc.
    if (/ä/.test(before2) && /l|e|i/.test(after3[0])) return 'ß';
    if (/[a-zäöü]ß/.test(before2 + 'ß' + after3)) return 'ß'; // heuristic

    // oğlu / oğlan → ğ (common Turkish patronymic)
    if (before2.endsWith('o') && /^lu|^la|^ul/.test(after3)) return 'ğ';

    // Doğan, Erdoğan, Çağan → ğ
    if (before2.endsWith('o') && /^an/.test(after3)) return 'ğ';
    if (before2.endsWith('a') && /^an/.test(after3)) return 'ğ'; // Çağan? Check

    // Uğur, Uğurcan → ğ (not Uşur)
    if (/\bU$|\bu$/.test(before2) && /^ur|^uc/.test(after3)) return 'ğ';
    if (before2.endsWith('u') && /^ur|^uc/.test(after3)) return 'ğ';

    // Yi\uFFFDxit → Yiğit (common Turkish name)
    if (before2.endsWith('i') && /^it/.test(after3)) return 'ğ';

    // Yaka\uFFFDxçı, Ta\uFFFDxk → ş
    // Default: ş
    return 'ş';
  });

  // ── Double-encoded control chars (from latin-1 re-encoded as utf-8) ──
  // Ã followed by a control char 0x80-0x9F → U+00C0+n
  n = n.replace(/Ã([\x80-\x9F])/g, (m, c) => {
    const codePoint = 0x00C0 + (c.charCodeAt(0) - 0x80);
    return String.fromCharCode(codePoint);
  });

  // Apply common double-encoded sequences
  for (const [bad, good] of DOUBLE_ENCODED) {
    if (n.includes(bad)) n = n.split(bad).join(good);
  }

  // ── Remaining replacement chars → strip cleanly ───────────────────────
  // Any remaining \uFFFD with next char: remove the pair
  // (last resort — shouldn't hit these often)
  n = n.replace(/\uFFFD[\x00-\x1F]/g, '');  // strip uFFFD + control char
  n = n.replace(/\uFFFD/g, '');              // strip any remaining replacement chars

  // ── Strip leftover control chars from source field contamination ──────
  n = n.replace(/[\x00-\x08\x0B\x0E-\x1F]/g, '');

  return n;
}

// ── Process all squad files ───────────────────────────────────────────────
let totalFiles = 0;
let totalFixed = 0;
const warnings = [];

fs.readdirSync(SQUADS_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(file => {
    const fp = path.join(SQUADS_DIR, file);
    let raw;
    try { raw = fs.readFileSync(fp, 'utf8'); } catch(e) { return; }

    let d;
    try { d = JSON.parse(raw); } catch(e) { warnings.push('PARSE_ERR: ' + file); return; }

    let changed = 0;

    const seasons = d.seasons || {};
    Object.keys(seasons).forEach(yr => {
      const s = seasons[yr];
      (s.players || []).forEach(p => {
        if (!p.name) return;
        const orig = p.name;
        const fixed = fixName(orig, file);
        if (fixed !== orig) {
          p.name = fixed;
          changed++;
        }
      });
    });

    if (changed > 0) {
      fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8');
      console.log(`  FIXED ${changed.toString().padStart(3)} names  ${file}`);
      totalFixed += changed;
      totalFiles++;
    }
  });

console.log(`\nDone: ${totalFixed} names fixed across ${totalFiles} files.`);
if (warnings.length) console.log('Warnings:', warnings.join(', '));
