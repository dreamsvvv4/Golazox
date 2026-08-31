/**
 * _snapshot_ci.js — genera el snapshot de fichajes desde GitHub Actions
 * ════════════════════════════════════════════════════════════════════
 * Transfermarkt (Datadome) bloquea las IP de datacenter con un challenge JS:
 * un `curl` / `node-fetch` recibe HTTP 202 con cuerpo vacío, tanto desde el
 * VPS de producción como desde los runners de GitHub. Un NAVEGADOR REAL headless
 * (Playwright + Chromium) sí resuelve el challenge y obtiene el HTML de verdad.
 *
 * Este script se ejecuta en el workflow `.github/workflows/snapshot-transfers.yml`
 * (cron cada pocas horas). Usa Playwright como `htmlFetcher` inyectado en
 * news.js -> snapshotTransfers(), reutilizando TODO el parseo/persistencia ya
 * existente. Escribe `data/transfers_snapshot.json`, que luego se commitea y
 * despliega para que producción lo sirva. Así el mercado se actualiza solo, sin
 * depender de ninguna PC encendida.
 *
 * Uso (en el runner): node _snapshot_ci.js
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const { chromium } = require('playwright');
const { snapshotTransfers } = require('./news');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    locale: 'es-ES',
    userAgent: UA,
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
  });

  // Calentar el contexto: la primera visita resuelve el challenge de Datadome y
  // deja la cookie en el contexto, que reutilizan las páginas siguientes.
  try {
    const warm = await ctx.newPage();
    await warm.goto('https://www.transfermarkt.es/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await warm.waitForTimeout(3500);
    await warm.close();
  } catch (_) { /* si falla el warm-up, cada fetch resuelve su propio challenge */ }

  // htmlFetcher inyectado: una página nueva por URL (soporta las llamadas en
  // paralelo de _scrapeLive sin pisarse). Espera a la tabla de datos real.
  const htmlFetcher = async (url) => {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      try {
        await page.waitForSelector('table.items tbody tr', { timeout: 25000 });
      } catch (_) {
        await page.waitForTimeout(6000); // fallback: dar tiempo al challenge JS
      }
      return await page.content();
    } finally {
      await page.close();
    }
  };

  try {
    const d = await snapshotTransfers(htmlFetcher);
    console.log('✓ Snapshot generado desde CI:');
    console.log(`  · más caros (top): ${d.top.length}`);
    console.log(`  · lista completa:  ${d.list.length}`);
    console.log(`  · recién cerrados: ${d.latest.length}`);
    console.log(`  · actualizado:     ${new Date(d.updated).toISOString()}`);
    await browser.close();
    if (!d.list.length && !d.latest.length) process.exit(1);
    process.exit(0);
  } catch (e) {
    console.error('✗ No se pudo generar el snapshot en CI:', e.message);
    await browser.close().catch(() => {});
    process.exit(1);
  }
})();
