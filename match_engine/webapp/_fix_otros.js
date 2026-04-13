/**
 * _fix_otros.js
 * 
 * Problema: en 🌍 Otros aparecen equipos árabes y argentinos duplicados.
 * Solución:
 *   1. Ocultar slugs duplicados (quitar badgeLocalPath → caen a placeholder → picker los oculta)
 *   2. Mover equipos brasileños reales (no en Brasileirão 2025-26) → 🌎 América del Sur
 *
 * Run: node _fix_otros.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const META_FILE = path.join(__dirname, 'squads-meta.json');
const raw = fs.readFileSync(META_FILE, 'utf8').replace(/^\uFEFF/, '');
const meta = JSON.parse(raw);

let hidden = 0;
let moved = 0;

// ── 1. Ocultar duplicados (quitando badgeLocalPath) ──────────────────────────
// El picker filtra equipos sin badge real: !c.badge.includes('_placeholder')
// Al quitar badgeLocalPath en meta Y en el squad JSON, cae al placeholder → invisible.

const HIDE = [
  // Saudi Pro League — slugs viejos / alias duplicados
  'abha',
  'al-ahli-dschidda',       // alias de al-ahli
  'al-ittihad-dschidda',    // alias de al-ittihad
  'al-nasr-riad',           // alias de al-nassr
  'al-shabab-riad',         // alias de al-shabab
  'al-raed',                // eliminado 2025-26
  'al-faisaly',             // eliminado 2025-26
  'al-wehda',               // eliminado 2025-26
  'al-qadsiah',             // alias de al-qadisiyah-fc
  // Argentina — slugs viejos con nombre completo (canonical: boca-juniors, river-plate, etc.)
  'club-atletico-boca-juniors',
  'club-atletico-river-plate',
  'club-estudiantes-de-la-plata',
  // Brasil — slugs viejos / duplicados (canonical: corinthians, flamengo, etc.)
  'corinthians-sao-paulo',
  'flamengo-rio-de-janeiro',
  'fluminense-rio-de-janeiro',
  'sao-paulo-fc',
  'se-palmeiras-sao-paulo',
];

console.log('\n🙈 Ocultando duplicados (quitar badgeLocalPath):');
for (const slug of HIDE) {
  if (!meta[slug]) meta[slug] = { group: '🌍 Otros' };
  if (meta[slug].badgeLocalPath) {
    delete meta[slug].badgeLocalPath;
    console.log(`  ${slug} → badge eliminado`);
    hidden++;
  }
  // También quitar del squad JSON para que el badge caiga al placeholder
  const squadFile = path.join(__dirname, 'squads', `${slug}.json`);
  if (fs.existsSync(squadFile)) {
    try {
      const d = JSON.parse(fs.readFileSync(squadFile, 'utf8'));
      if (d.badgeLocalPath) {
        delete d.badgeLocalPath;
        fs.writeFileSync(squadFile, JSON.stringify(d, null, 2), 'utf8');
      }
    } catch {}
  }
}
console.log(`  → ${hidden} badges eliminados`);

// ── 2. Mover equipos brasileños reales → 🌎 América del Sur ─────────────────
// Estos son clubs reales que no están en el Brasileirão 2025-26 pero sí existen.
const TO_AMERICA = [
  'athletico-paranaense',  // wait, this IS in Brasileirão 2025-26 - skip
  // Actually these were moved to Otros by _fix_groups.js but shouldn't be hidden
  'atletico-goianiense',   // Brazilian club, real
  'criciuma',              // Brazilian club, real
  'cuiaba',                // Brazilian club, real
  'fortaleza',             // Brazilian club, real
  'juventude',             // Brazilian club, real
  // Also keep these other Latam teams properly in América del Sur
  'palmeiras',             // alias of se-palmeiras → hide instead
];

// Remove palmeiras from TO_AMERICA (it's a duplicate of se-palmeiras)
const toAmericaFiltered = ['atletico-goianiense','criciuma','cuiaba','fortaleza','juventude'];

console.log('\n🌎 Moviendo brasileños reales → América del Sur:');
for (const slug of toAmericaFiltered) {
  if (!meta[slug]) meta[slug] = {};
  const before = meta[slug].group;
  meta[slug].group = '🌎 América del Sur';
  console.log(`  ${slug}: "${before||'(squad json)'}" → "🌎 América del Sur"`);
  moved++;
}
console.log(`  → ${moved} equipos movidos`);

// ── 3. También ocultar el palmeiras alias ────────────────────────────────────
console.log('\n🙈 Ocultar alias palmeiras (se-palmeiras es el canonical):');
if (meta['palmeiras']) {
  delete meta['palmeiras'].badgeLocalPath;
  meta['palmeiras'].group = '🌍 Otros';
  console.log('  palmeiras → badge eliminado');
}
const palmeirasFile = path.join(__dirname, 'squads', 'palmeiras.json');
if (fs.existsSync(palmeirasFile)) {
  try {
    const d = JSON.parse(fs.readFileSync(palmeirasFile, 'utf8'));
    if (d.badgeLocalPath) { delete d.badgeLocalPath; fs.writeFileSync(palmeirasFile, JSON.stringify(d, null, 2), 'utf8'); }
  } catch {}
}

// ── Save ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
console.log(`\n✅ Done — ${hidden} ocultos, ${moved} movidos a América del Sur\n`);
