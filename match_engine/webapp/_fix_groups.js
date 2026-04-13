/**
 * _fix_groups.js
 * Fixes all group assignment issues in squads-meta.json:
 *  1. Fantasy XI / Continentes Históricos — wrong emoji prefix (🌍 vs ⭐/🌐)
 *  2. Saudi Pro League — 9 old/duplicate squads still showing as Saudi
 *  3. América del Sur — Brazilian/Argentine duplicates and wrong assignments
 *  4. real-betis-sevilla — wrongly in América del Sur (should be La Liga)
 *
 * Run: node _fix_groups.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const META_FILE = path.join(__dirname, 'squads-meta.json');
const raw = fs.readFileSync(META_FILE, 'utf8').replace(/^\uFEFF/, '');
const meta = JSON.parse(raw);

let changed = 0;
function set(slug, group, extras = {}) {
  if (!meta[slug]) meta[slug] = {};
  const before = meta[slug].group;
  meta[slug] = { ...meta[slug], ...extras, group };
  if (before !== group) {
    console.log(`  ${slug}: "${before || '(none)'}" → "${group}"`);
    changed++;
  }
}

// ── 1. Fantasy XI → ⭐ Fantasy XI ─────────────────────────────────────────
console.log('\n📝 Fantasy XI / Continentes Históricos:');
[
  ['best-xi-history',           '⭐ Fantasy XI'],
  ['america-xi',                '⭐ Fantasy XI'],
  ['europa-xi',                 '⭐ Fantasy XI'],
  ['resto-mundo',               '⭐ Fantasy XI'],
  ['best-xi-2025',              '⭐ Fantasy XI'],
  ['africa-historica',          '🌐 Continentes Históricos'],
  ['america-historica',         '🌐 Continentes Históricos'],
  ['asia-oceania-historica',    '🌐 Continentes Históricos'],
  ['europa-historica',          '🌐 Continentes Históricos'],
].forEach(([s, g]) => set(s, g));

// ── 2. Saudi duplicates/old → 🌍 Otros ────────────────────────────────────
console.log('\n📝 Saudi Pro League — old squads:');
[
  'abha',             // removed from 2025-26
  'al-ahli-dschidda', // old slug, canonical = al-ahli
  'al-ittihad-dschidda', // old slug, canonical = al-ittihad
  'al-nasr-riad',     // old slug, canonical = al-nassr
  'al-shabab-riad',   // old slug, canonical = al-shabab
  'al-raed',          // removed from 2025-26
  'al-faisaly',       // removed from 2025-26
  'al-wehda',         // removed from 2025-26
  'al-qadsiah',       // old slug / different spelling
].forEach(s => set(s, '🌍 Otros'));

// ── 3. América del Sur cleanup ─────────────────────────────────────────────
console.log('\n📝 América del Sur — duplicates/wrong to 🌍 Otros:');
// Old/duplicate Brazilian slugs (canonical ones are already in 🇧🇷 Brasileirão)
[
  'corinthians-sao-paulo',    // old slug, canonical = corinthians
  'flamengo-rio-de-janeiro',  // old slug, canonical = flamengo
  'fluminense-rio-de-janeiro',// old slug, canonical = fluminense
  'sao-paulo-fc',             // old slug, canonical = fc-sao-paulo
  'se-palmeiras-sao-paulo',   // old slug, canonical = se-palmeiras
  'atletico-goianiense',      // not in 2025-26 Brasileirão
  'criciuma',                 // not in 2025-26 Brasileirão
  'cuiaba',                   // not in 2025-26 Brasileirão
  'fortaleza',                // not in 2025-26 Brasileirão
  'juventude',                // not in 2025-26 Brasileirão
].forEach(s => set(s, '🌍 Otros'));

// Old/duplicate Argentine slugs (canonical ones are in 🌎 Argentina Primera)
[
  'club-atletico-boca-juniors',   // old slug, canonical = boca-juniors
  'club-atletico-river-plate',    // old slug, canonical = river-plate
  'club-estudiantes-de-la-plata', // old slug, canonical = estudiantes
].forEach(s => set(s, '🌍 Otros'));

// ── 4. real-betis-sevilla → 🇪🇸 La Liga ───────────────────────────────────
console.log('\n📝 Wrong country fix:');
set('real-betis-sevilla', '🇪🇸 La Liga');

// ── 5. Ensure canonical Brasileirão/Argentina teams keep their groups ───────
// (Belt-and-suspenders: if they already have correct group, no change logged)
console.log('\n📝 Verify Brasileirão canonical:');
const BRASILEIRAO = ['athletico-paranaense','clube-atletico-mineiro','bahia','botafogo',
  'chapecoense','corinthians','coritiba','flamengo','vasco-da-gama','cruzeiro','fluminense',
  'gremio','mirassol','se-palmeiras','red-bull-bragantino','remo','fc-sao-paulo','santos',
  'sc-internacional','vitoria'];
BRASILEIRAO.forEach(s => set(s, '🇧🇷 Brasileirão'));

console.log('\n📝 Verify Argentina Primera canonical:');
const ARGENTINA = ['river-plate','boca-juniors','racing-club','independiente','san-lorenzo',
  'velez-sarsfield','estudiantes','talleres-cordoba','huracan','newells-old-boys','rosario-central',
  'lanus','defensa-y-justicia','belgrano','tigre','banfield','godoy-cruz','platense',
  'argentinos-juniors','union-santa-fe','atletico-tucuman','sarmiento','central-cordoba',
  'deportivo-riestra','instituto','gimnasia-mendoza'];
ARGENTINA.forEach(s => set(s, '🌎 Argentina Primera'));

// ── Save ───────────────────────────────────────────────────────────────────
fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
console.log(`\n✅ Done — ${changed} changes saved to squads-meta.json\n`);
