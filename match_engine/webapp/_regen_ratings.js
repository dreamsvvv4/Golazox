#!/usr/bin/env node
'use strict';
/**
 * _regen_ratings.js — Recomputa el campo `ratings` de cada temporada de cada
 * squad usando EXACTAMENTE la misma lógica que el motor en modo visual
 * (buildLineupFromCache → computeRatingsFromPlayers). Así los `ratings`
 * almacenados coinciden con lo que el motor calcula en runtime, y las
 * herramientas externas / fallbacks obtienen medias reales del XI.
 */
const path = require('path');
const fs   = require('fs');
const { buildLineupFromCache, computeRatingsFromPlayers } = require('./engine.js');

const dir   = path.join(__dirname, 'squads');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('.'));

let filesChanged = 0, seasonsUpdated = 0, seasonsSkipped = 0, parseFails = 0;
const samples = [];

for (const f of files) {
  const full = path.join(dir, f);
  let raw, data;
  try { raw = fs.readFileSync(full, 'utf8'); data = JSON.parse(raw); }
  catch (e) { console.error('PARSE FAIL', f, e.message); parseFails++; continue; }
  if (!data || !data.seasons || typeof data.seasons !== 'object') continue;

  let changed = false;
  for (const [sid, season] of Object.entries(data.seasons)) {
    if (!season || !Array.isArray(season.players) || season.players.length < 7) { seasonsSkipped++; continue; }
    let lineup;
    try { lineup = buildLineupFromCache(season); } catch (e) { seasonsSkipped++; continue; }
    if (!lineup || !Array.isArray(lineup.players) || !lineup.players.length) { seasonsSkipped++; continue; }
    const nr = computeRatingsFromPlayers(lineup.players);
    if (!nr) { seasonsSkipped++; continue; }
    const old = season.ratings || {};
    if (old.attack !== nr.attack || old.midfield !== nr.midfield ||
        old.defense !== nr.defense || old.goalkeeping !== nr.goalkeeping) {
      if (samples.length < 15) samples.push({ f, sid, old, nr });
      season.ratings = nr;
      changed = true; seasonsUpdated++;
    }
  }

  if (changed) {
    const out = JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : '');
    fs.writeFileSync(full, out, 'utf8');
    filesChanged++;
  }
}

console.log(`\n== REGEN RATINGS ==`);
console.log(`files changed:    ${filesChanged}/${files.length}`);
console.log(`seasons updated:  ${seasonsUpdated}`);
console.log(`seasons skipped:  ${seasonsSkipped}`);
console.log(`parse fails:      ${parseFails}`);
console.log(`\n-- samples --`);
samples.forEach(s => console.log(
  `${s.f} [${s.sid}]  OLD ${JSON.stringify(s.old)}  ->  NEW ${JSON.stringify(s.nr)}`
));
