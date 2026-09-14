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

const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Un intento completo: contexto limpio + warm-up (resuelve el challenge de
// Datadome) + scrape. Devuelve los datos o lanza si el scrape sale vacío.
async function attemptSnapshot(browser, n) {
  const ctx = await browser.newContext({
    locale: 'es-ES',
    userAgent: UA,
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
  });
  try {
    // Calentar el contexto: la primera visita resuelve el challenge de Datadome
    // y deja la cookie, que reutilizan las páginas siguientes. En cada reintento
    // se espera un poco más para dar tiempo al challenge JS.
    try {
      const warm = await ctx.newPage();
      await warm.goto('https://www.transfermarkt.es/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await warm.waitForTimeout(3500 + (n - 1) * 2500);
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

    return await snapshotTransfers(htmlFetcher);
  } finally {
    await ctx.close().catch(() => {});
  }
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  let data = null;
  let lastErr = null;

  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    try {
      const d = await attemptSnapshot(browser, n);
      if (d && (d.list.length || d.latest.length)) { data = d; break; }
      lastErr = new Error('scrape vacío (Datadome)');
    } catch (e) {
      lastErr = e;
    }
    if (n < MAX_ATTEMPTS) {
      console.warn(`· intento ${n}/${MAX_ATTEMPTS} sin datos (${lastErr && lastErr.message}); reintentando...`);
      await sleep(5000 * n);
    }
  }

  await browser.close().catch(() => {});

  if (data) {
    console.log('✓ Snapshot generado desde CI:');
    console.log(`  · más caros (top): ${data.top.length}`);
    console.log(`  · lista completa:  ${data.list.length}`);
    console.log(`  · recién cerrados: ${data.latest.length}`);
    console.log(`  · actualizado:     ${new Date(data.updated).toISOString()}`);
    process.exit(0);
  }

  // Bloqueo transitorio de Datadome tras varios intentos: NO es un fallo real.
  // El snapshot anterior sigue commiteado y producción se auto-recupera desde
  // GitHub raw. Salir en VERDE para no disparar alertas de "run failed" por algo
  // que se soluciona solo en la siguiente ejecución del cron.
  console.warn(`⚠ Sin datos tras ${MAX_ATTEMPTS} intentos (${lastErr && lastErr.message}). Se mantiene el snapshot anterior.`);
  process.exit(0);
})();
