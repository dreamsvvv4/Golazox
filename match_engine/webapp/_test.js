'use strict';
const l = require('./lookup');

async function run() {
  console.log('Testing Wikipedia player name fix...\n');
  const r = await l.lookupTeam('Senegal', '2002');
  if (!r || !r.players) { console.log('NULL result'); return; }
  console.log('Source:', r.source);
  r.players.forEach((p, i) => console.log(i+1, p.name, '|', p.position));

  console.log('\nTesting Paraguay...');
  const p = await l.lookupTeam('Paraguay', '2001');
  if (!p || !p.players) { console.log('NULL result'); return; }
  console.log('Source:', p.source);
  p.players.slice(0, 5).forEach((pl, i) => console.log(i+1, pl.name, '|', pl.position));

  console.log('\nTesting Getafe 1997 (not in registry, TM dynamic search)...');
  const g = await l.lookupTeam('Getafe', '1997');
  console.log(g ? `Source: ${g.source} | ${g.players?.[0]?.name}` : 'NULL');

  console.log('\nTesting CD Tondela 2018 (obscure Portuguese club)...');
  const t = await l.lookupTeam('Tondela', '2018');
  console.log(t ? `Source: ${t.source} | ${t.players?.[0]?.name}` : 'NULL - expected, obscure club');
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
