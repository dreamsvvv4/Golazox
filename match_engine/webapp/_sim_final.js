'use strict';
const { simulateMatch } = require('./engine');
const fs = require('fs');

const spJSON = JSON.parse(fs.readFileSync('./squads/spanien.json', 'utf8'));
const arJSON = JSON.parse(fs.readFileSync('./squads/argentinien.json', 'utf8'));
const spSeason = spJSON.seasons['2026'];
const arSeason = arJSON.seasons['2026'];

const N = 1000;

function runSims(seasonA, seasonB, label) {
  let wA = 0, wB = 0, dr = 0;
  const scorerCount = {};
  const scoreCounts = {};
  const yamal = { scored: 0, espWhenYamal: 0, espWhenNoYamal: 0, noYamalTotal: 0 };
  let totalGoals = 0;

  for (let i = 0; i < N; i++) {
    const res = simulateMatch({
      teamA: 'España', teamB: 'Argentina',
      eraA: '2026', eraB: '2026',
      formationA: seasonA.formation || '4-3-3',
      formationB: seasonB.formation || '4-5-1',
      cachedLineupA: { ...seasonA, found: true },
      cachedLineupB: { ...seasonB, found: true },
      matchMode: '11v11', matchSalt: i * 7919 + 99991, isFinal: true,
    });
    const sA = res.finalScore?.teamA ?? 0;
    const sB = res.finalScore?.teamB ?? 0;
    if (sA > sB) wA++;
    else if (sB > sA) wB++;
    else dr++;

    const key = `${sA}-${sB}`;
    scoreCounts[key] = (scoreCounts[key] || 0) + 1;

    let yamalScored = false;
    for (const sc of (res.finalScore?.scorersA || [])) {
      const name = sc.name || 'Unknown';
      scorerCount[name] = (scorerCount[name] || 0) + 1;
      totalGoals++;
      if (name === 'Lamine Yamal') yamalScored = true;
    }
    for (const sc of (res.finalScore?.scorersB || [])) {
      const name = sc.name || 'Unknown';
      scorerCount[name] = (scorerCount[name] || 0) + 1;
      totalGoals++;
    }

    if (yamalScored) {
      yamal.scored++;
      if (sA > sB) yamal.espWhenYamal++;
    } else {
      yamal.noYamalTotal++;
      if (sA > sB) yamal.espWhenNoYamal++;
    }

    if (i % 200 === 0) process.stderr.write(`[${label}] ${i}...\n`);
  }

  return { wA, wB, dr, scorerCount, scoreCounts, yamal, totalGoals };
}

// ─── SIM 1: Standard ───
const std = runSims(spSeason, arSeason, 'STANDARD');

// ─── SIM 2: Sin Messi ───
const arSinMessi = {
  ...arSeason,
  players: arSeason.players.filter(p => p.name !== 'Lionel Messi'),
};
const sinM = runSims(spSeason, arSinMessi, 'SIN_MESSI');

// ─── OUTPUT ───
console.log('\n========================================');
console.log('  SIMULACIÓN FINAL · España vs Argentina');
console.log('  WC2026 · 1.000 partidos · Motor GolazoX');
console.log('========================================\n');

console.log('─── CON PLANTILLAS COMPLETAS ───');
console.log(`España:    ${(std.wA / N * 100).toFixed(1)}%`);
console.log(`Empate:    ${(std.dr / N * 100).toFixed(1)}%`);
console.log(`Argentina: ${(std.wB / N * 100).toFixed(1)}%`);
console.log(`Avg goles: ${(std.totalGoals / N).toFixed(2)}`);

console.log('\n─── TOP GOLEADORES ───');
const topS = Object.entries(std.scorerCount).sort((a,b) => b[1]-a[1]).slice(0, 12);
for (const [n, c] of topS) console.log(n.padEnd(28), (c/N*100).toFixed(1)+'%');

console.log('\n─── LAMINE YAMAL ───');
const yPct = (std.yamal.scored / N * 100).toFixed(1);
const espWhenY = (std.yamal.espWhenYamal / std.yamal.scored * 100).toFixed(1);
const espNoY   = (std.yamal.espWhenNoYamal / std.yamal.noYamalTotal * 100).toFixed(1);
console.log(`Partidos donde Yamal marca: ${std.yamal.scored} (${yPct}%)`);
console.log(`España gana SI Yamal marca: ${espWhenY}%`);
console.log(`España gana SI Yamal NO marca: ${espNoY}%`);

console.log('\n─── TOP MARCADORES EXACTOS ───');
const topSc = Object.entries(std.scoreCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
for (const [sc, c] of topSc) console.log(sc.padEnd(8), (c/N*100).toFixed(1)+'%', ' ('+c+')');

console.log('\n─── ARGENTINA SIN MESSI ───');
console.log(`España:    ${(sinM.wA / N * 100).toFixed(1)}%  (vs ${(std.wA/N*100).toFixed(1)}% con Messi)`);
console.log(`Empate:    ${(sinM.dr / N * 100).toFixed(1)}%  (vs ${(std.dr/N*100).toFixed(1)}% con Messi)`);
console.log(`Argentina: ${(sinM.wB / N * 100).toFixed(1)}%  (vs ${(std.wB/N*100).toFixed(1)}% con Messi)`);

console.log('\n─── TOP GOLEADORES SIN MESSI ───');
const topSM = Object.entries(sinM.scorerCount).sort((a,b) => b[1]-a[1]).slice(0, 8);
for (const [n, c] of topSM) console.log(n.padEnd(28), (c/N*100).toFixed(1)+'%');
