"use strict";
const fs   = require("fs");
const path = require("path");
const SQUADS_DIR = path.join(__dirname, "squads");

const GERMAN_FILES = new Set(["deutschland.json","fc-bayern-munchen.json","borussia-dortmund.json","borussia-monchengladbach.json","bayer-04-leverkusen.json","rasenballsport-leipzig.json","fc-schalke-04.json","1-fc-koln.json","1-fc-nurnberg.json","1-fsv-mainz-05.json","fc-augsburg.json","hamburger-sv.json","hertha-bsc.json","eintracht-frankfurt.json","hoffenheim.json","wolfsburg.json","werder-bremen.json","1-fc-union-berlin.json","1-fc-magdeburg.json","preussen-munster.json","fortuna-dusseldorf.json","greuther-furth.json","sc-freiburg.json","vfl-bochum.json","sv-darmstadt-98.json","1-fc-heidenheim.json","sc-paderborn-07.json","fortuna-sittard.json"]);

function fixName(name, file) {
  if (!name || !/[\uFFFD\x80-\x9F]/.test(name)) return name;
  let n = name;
  // \uFFFD~ -> S-cedilla
  n = n.replace(/\uFFFD~/g, "S\u0327".normalize("NFC") || "\u015E");
  // \uFFFD\r\u0013 -> Ö
  n = n.replace(/\uFFFD\u0013/g, "\xD6");
  // \uFFFD\u0019 or \u001c -> Ó
  n = n.replace(/\uFFFD[\u0019\u001c]/g, "\xD3");
  // \uFFFDS -> Ü (at start of Turkish names: Ümit, Ünüvar)
  n = n.replace(/\uFFFDS/g, "\xDC");
  // \uFFFD0 -> É
  n = n.replace(/\uFFFD0/g, "\xC9");
  // \uFFFD! end of word -> ć, start -> Ç
  n = n.replace(/\uFFFD!(?=\s|$)/g, "\u0107");
  n = n.replace(/\uFFFD!/g, "\u0107");
  // \uFFFDx: ş/ğ/ß
  n = n.replace(/\uFFFDx/g, function(m, offset) {
    const before2 = n.slice(Math.max(0, offset - 2), offset);
    const after2  = n.slice(offset + 2, offset + 4);
    const isGermanCtx = GERMAN_FILES.has(file) && /[aeiouäöü]$/i.test(before2) && !after2.includes('\u0131');
    if (isGermanCtx) return "\xDF"; // ß
    if (/i$/.test(before2) && /^it/.test(after2)) return "\u011F"; // Yiğit
    if (/o$/.test(before2) && /^(lu|la|an)/.test(after2)) return "\u011F"; // oğlu/Doğan
    if (/[Uu]$/.test(before2) && /^ur/.test(after2)) return "\u011F"; // Uğur
    return "\u015F"; // ş default
  });
  // Fix double-encoded UTF-8 sequences (Latin-1 bytes read wrong)
  const doubleEncoded = [
    ["\xC3\x81","\xC1"],["\xC3\x80","\xC0"],["\xC3\xA9","\xE9"],["\xC3\xA8","\xE8"],
    ["\xC3\xAA","\xEA"],["\xC3\xA1","\xE1"],["\xC3\xA0","\xE0"],["\xC3\xB3","\xF3"],
    ["\xC3\xB2","\xF2"],["\xC3\xAD","\xED"],["\xC3\xBA","\xFA"],["\xC3\xB9","\xF9"],
    ["\xC3\xA4","\xE4"],["\xC3\xB6","\xF6"],["\xC3\xBC","\xFC"],["\xC3\x9C","\xDC"],
    ["\xC3\x87","\xC7"],["\xC3\xA7","\xE7"],["\xC3\x93","\xD3"],["\xC3\x89","\xC9"]
  ];
  for (const [bad, good] of doubleEncoded) {
    if (n.includes(bad)) n = n.split(bad).join(good);
  }
  // Ã + control char -> fix
  n = n.replace(/\xC3([\x80-\x9F])/g, (m, c) => String.fromCharCode(0xC0 + (c.charCodeAt(0) - 0x80)));
  // Remove remaining replacement chars
  n = n.replace(/\uFFFD[\x00-\x1F]/g, "");
  n = n.replace(/\uFFFD/g, "");
  n = n.replace(/[\x00-\x08\x0B\x0E-\x1F]/g, "");
  return n;
}

let totalFiles = 0, totalFixed = 0;
fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith(".json")).forEach(file => {
  const fp = path.join(SQUADS_DIR, file);
  let d; try { d = JSON.parse(fs.readFileSync(fp, "utf8")); } catch(e) { return; }
  let changed = 0;
  Object.values(d.seasons || {}).forEach(s => {
    if (s.teamLabel) {
      const fixed = fixName(s.teamLabel, file);
      if (fixed !== s.teamLabel) { s.teamLabel = fixed; changed++; }
    }
    (s.players || []).forEach(p => {
      if (!p.name) return;
      const fixed = fixName(p.name, file);
      if (fixed !== p.name) { p.name = fixed; changed++; }
    });
  });
  if (changed > 0) {
    fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf8");
    console.log("  FIXED " + String(changed).padStart(3) + " names  " + file);
    totalFixed += changed; totalFiles++;
  }
});
console.log("\nDone: " + totalFixed + " names fixed across " + totalFiles + " files.");