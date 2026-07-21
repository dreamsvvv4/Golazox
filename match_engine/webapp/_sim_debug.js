'use strict';
const { simulateMatch } = require('./engine');
const fs = require('fs');

const spJSON = JSON.parse(fs.readFileSync('./squads/spanien.json', 'utf8'));
const arJSON = JSON.parse(fs.readFileSync('./squads/argentinien.json', 'utf8'));
const spSeason = spJSON.seasons['2026'];
const arSeason = arJSON.seasons['2026'];

let winsA = 0, winsB = 0, draws = 0;
const scorerCount = {};
const minuteBuckets = new Array(9).fill(0);
const N = 1000;

for (let i = 0; i < N; i++) {
  const res = simulateMatch({
    teamA: 'España', teamB: 'Argentina',
    eraA: '2026', eraB: '2026',
    formationA: spSeason.formation || '4-3-3',
    formationB: arSeason.formation || '4-5-1',
    cachedLineupA: { ...spSeason, found: true },
    cachedLineupB: { ...arSeason, found: true },
    matchMode: '11v11', matchSalt: i * 7919 + 99991, isFinal: true,
  });
  const sA = res.finalScore?.teamA ?? 0;
  const sB = res.finalScore?.teamB ?? 0;
  if (sA > sB) winsA++;
  else if (sB > sA) winsB++;
  else draws++;

  // Scorers from finalScore.scorersA/B
  for (const sc of (res.finalScore?.scorersA || [])) {
    const name = sc.name || 'Unknown';
    scorerCount[name] = (scorerCount[name] || 0) + 1;
    minuteBuckets[Math.min(8, Math.floor((sc.minute || 0) / 10))]++;
  }
  for (const sc of (res.finalScore?.scorersB || [])) {
    const name = sc.name || 'Unknown';
    scorerCount[name] = (scorerCount[name] || 0) + 1;
    minuteBuckets[Math.min(8, Math.floor((sc.minute || 0) / 10))]++;
  }
  if (i % 100 === 0) process.stderr.write(i + '...');
}
process.stderr.write('done\n');

console.log('=== RESULTADOS (1,000 sims) ===');
console.log('España:   ', (winsA / N * 100).toFixed(1) + '%');
console.log('Empate:   ', (draws / N * 100).toFixed(1) + '%');
console.log('Argentina:', (winsB / N * 100).toFixed(1) + '%');
console.log('');
const sorted = Object.entries(scorerCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('=== TOP GOLEADORES ===');
for (const [name, cnt] of sorted) console.log(name.padEnd(28), (cnt / N * 100).toFixed(1) + '%');
console.log('');
console.log('=== MINUTOS ===');
const labels = ["0-9'", "10-19'", "20-29'", "30-39'", "40-49'", "50-59'", "60-69'", "70-79'", "80+'"];
const total = minuteBuckets.reduce((a, b) => a + b, 0);
for (let i = 0; i < 9; i++) {
  const pct = (minuteBuckets[i] / total * 100).toFixed(1);
  const bar = '|'.repeat(Math.round(minuteBuckets[i] / total * 40));
  console.log(labels[i].padEnd(8), bar.padEnd(42), pct + '%  (' + minuteBuckets[i] + ')');
}
console.log('Total goles:', total, '| avg:', (total / N).toFixed(2));
