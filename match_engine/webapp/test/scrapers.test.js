/**
 * scrapers.test.js — Smoke-tests de los scrapers (Transfermarkt + RSS).
 * ════════════════════════════════════════════════════════════════════
 * Los parsers se rompen SOLOS cuando la web fuente cambia su HTML (ya
 * pasó con los rumores → 0 resultados). Estos tests golpean las fuentes
 * reales y verifican que cada scraper devuelve datos con la forma correcta.
 *
 * NO son tests unitarios puros: dependen de la red y de las webs externas.
 * Sirven como monitorización: ejecútalos manualmente o por cron y, si algo
 * devuelve 0 o pierde campos, es que la fuente cambió y hay que arreglar el
 * parser correspondiente en news.js.
 *
 *   node --test test/            (o:  npm test)
 * ════════════════════════════════════════════════════════════════════
 */
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const news   = require('../news');

// Las fuentes externas pueden tardar; damos margen por test.
const TIMEOUT = 30_000;

test('getNews devuelve titulares con {title, link, source}', { timeout: TIMEOUT }, async () => {
  const r = await news.getNews();
  const all = [...(r.fichajes || []), ...(r.general || [])];
  assert.ok(all.length > 0, 'getNews no devolvió ningún titular (¿RSS caído o cambiado?)');
  for (const it of all.slice(0, 5)) {
    assert.ok(it.title && it.title.length > 3, 'titular sin título');
    assert.match(it.link || '', /^https?:\/\//, 'titular sin enlace válido');
    assert.ok(it.source, 'titular sin fuente');
  }
});

test('getTransfers devuelve fichajes con jugador, clubes e importe', { timeout: TIMEOUT }, async () => {
  const r = await news.getTransfers();
  assert.ok(Array.isArray(r.list) && r.list.length > 0, 'getTransfers devolvió 0 fichajes (¿cambió Transfermarkt?)');
  const t = r.list[0];
  assert.ok(t.player, 'fichaje sin jugador');
  assert.ok(t.from && t.to, 'fichaje sin clubes origen/destino');
  assert.ok(t.fee && typeof t.fee.value === 'number', 'fichaje sin importe numérico');
});

test('getValues devuelve jugadores más valiosos con valor numérico', { timeout: TIMEOUT }, async () => {
  const r = await news.getValues();
  assert.ok(Array.isArray(r.list) && r.list.length > 0, 'getValues devolvió 0 jugadores');
  const p = r.list[0];
  assert.ok(p.player, 'jugador sin nombre');
  assert.ok(typeof p.value === 'number' && p.value > 0, 'jugador sin valor de mercado');
});

test('getStats devuelve goleadores y asistentes con goles/asistencias', { timeout: TIMEOUT }, async () => {
  const r = await news.getStats();
  assert.ok(Array.isArray(r.scorers) && r.scorers.length > 0, 'getStats devolvió 0 goleadores');
  const s = r.scorers[0];
  assert.ok(s.player, 'goleador sin nombre');
  assert.ok(typeof s.goals === 'number', 'goleador sin nº de goles');
});

test('getRumors devuelve rumores (algunos con probabilidad %)', { timeout: TIMEOUT }, async () => {
  const r = await news.getRumors();
  assert.ok(Array.isArray(r.list) && r.list.length > 0, 'getRumors devolvió 0 rumores (¿cambió el HTML de Transfermarkt?)');
  const rr = r.list[0];
  assert.ok(rr.player, 'rumor sin jugador');
  const withProb = r.list.filter(x => typeof x.prob === 'number');
  assert.ok(withProb.length > 0, 'ningún rumor trae probabilidad de traspaso');
});

test('getStatus refleja el estado de las fuentes consultadas', () => {
  const st = news.getStatus();
  assert.ok(typeof st.ok === 'boolean', 'getStatus.ok debe ser booleano');
  assert.ok(Array.isArray(st.sources), 'getStatus.sources debe ser un array');
});
