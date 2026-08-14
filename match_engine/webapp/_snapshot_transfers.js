/**
 * _snapshot_transfers.js — genera el snapshot de fichajes de Transfermarkt
 * ════════════════════════════════════════════════════════════════════
 * Transfermarkt bloquea las IP de datacenter (el server de producción recibe
 * 403/429), así que el scrape en vivo solo funciona desde una IP residencial.
 * Este script se ejecuta DESDE TU PC (o un cron local), captura el mercado real
 * y escribe `data/transfers_snapshot.json`. Luego se commitea y despliega para
 * que producción lo sirva cuando el scrape en vivo falle.
 *
 * Uso:
 *   node _snapshot_transfers.js
 *
 * Después:
 *   git add match_engine/webapp/data/transfers_snapshot.json \
 *           match_engine/webapp/data/transfers_db.json
 *   git commit -m "chore: actualizar snapshot de fichajes"
 *   git push && (deploy)
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const { snapshotTransfers } = require('./news');

(async () => {
  try {
    const d = await snapshotTransfers();
    console.log('✓ Snapshot generado:');
    console.log(`  · más caros (top):   ${d.top.length}`);
    console.log(`  · lista completa:    ${d.list.length}`);
    console.log(`  · recién cerrados:   ${d.latest.length}`);
    console.log(`  · histórico total:   ${d.historyTotal}`);
    console.log(`  · actualizado:       ${new Date(d.updated).toISOString()}`);
    console.log('\nArchivo: data/transfers_snapshot.json');
    console.log('Recuerda: git add + commit + push + deploy.');
    process.exit(0);
  } catch (e) {
    console.error('✗ No se pudo generar el snapshot:', e.message);
    console.error('  (Si dice "IP bloqueada", ejecútalo desde tu red doméstica, no un VPS.)');
    process.exit(1);
  }
})();
