/**
 * _snapshot_extras.js — genera los snapshots de rumores y calendario de
 * Transfermarkt desde una IP residencial (que TM no bloquea) y escribe
 * `data/rumors_snapshot.json` y `data/fixtures_snapshot.json`. Luego se
 * commitean y despliegan para que producción (IP de datacenter bloqueada por
 * TM) los sirva cuando el scrape en vivo devuelve vacío.
 *
 * Uso:
 *   cd match_engine/webapp
 *   node _snapshot_extras.js
 *   git add match_engine/webapp/data/rumors_snapshot.json \
 *           match_engine/webapp/data/fixtures_snapshot.json
 *   git commit -m "chore: actualizar snapshots de rumores y calendario"
 */

'use strict';

const { snapshotRumors } = require('./news');
const { snapshotFixtures } = require('./standings');

(async () => {
  let ok = true;
  try {
    const r = await snapshotRumors();
    console.log(`✓ Rumores: ${r.list.length} → data/rumors_snapshot.json`);
  } catch (e) {
    ok = false;
    console.error('✗ Rumores:', e.message);
  }
  try {
    const f = await snapshotFixtures();
    console.log('✓ Calendario → data/fixtures_snapshot.json');
    for (const lg of f) console.log(`    ${lg.code} ${lg.fxSeason}: ${lg.rounds} jornadas`);
  } catch (e) {
    ok = false;
    console.error('✗ Calendario:', e.message);
  }
  process.exit(ok ? 0 : 1);
})();
