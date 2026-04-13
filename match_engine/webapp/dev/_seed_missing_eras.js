'use strict';
/**
 * _seed_missing_eras.js — Descarga las eras históricas exactas que faltan
 * en HISTORIC_MATCHES pero no están en el catálogo de seed_squads.js.
 *
 * USO:
 *   node _seed_missing_eras.js              # descarga todo
 *   node _seed_missing_eras.js --dry-run    # solo lista, sin descargar
 *   node _seed_missing_eras.js --delay 3000 # delay entre peticiones
 */

const { fetchTransfermarktSquad } = require('./transfermarkt');

const args    = process.argv.slice(2);
const getArg  = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const hasFlag = (f) => args.includes(f);

const DRY_RUN = hasFlag('--dry-run');
const DELAY   = parseInt(getArg('--delay') || '3000', 10);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Lista de eras históricas que faltan ───────────────────────
// Ordenadas de más probable a menos probable que TM tenga datos
const MISSING = [
  // ── Clubes modernos (TM tiene datos desde ~1995) ──────────────
  { team: 'AC Milan',           year: 2005 }, // Istanbul Miracle UCL 04-05
  { team: 'Barcelona',          year: 2017 }, // La Remontada vs PSG
  { team: 'Barcelona',          year: 2019 }, // Anfield Liverpool
  { team: 'Barcelona',          year: 2020 }, // Bayern 8-2
  { team: 'PSG',                year: 2017 }, // La Remontada vs Barça
  { team: 'Atletico Madrid',    year: 2014 }, // La Décima UCL final
  { team: 'Real Madrid',        year: 2011 }, // Semi UCL vs Barcelona
  { team: 'Real Madrid',        year: 2018 }, // Final Kiev vs Liverpool
  { team: 'Manchester United',  year: 2009 }, // UCL Final vs Barcelona
  { team: 'Manchester United',  year: 2011 }, // UCL Final vs Barcelona
  { team: 'Borussia Dortmund',  year: 2013 }, // Semi UCL vs Real Madrid
  { team: 'Liverpool',          year: 2007 }, // Final Atenas vs AC Milan
  { team: 'Liverpool',          year: 2018 }, // Final Kiev vs Real Madrid
  { team: 'Boca Juniors',       year: 2015 }, // Copa Libertadores 2015
  { team: 'Boca Juniors',       year: 2018 }, // Copa Libertadores 2018
  { team: 'AS Monaco',          year: 2004 }, // UCL Final vs Porto
  { team: 'Bayern Munich',      year: 2010 }, // UCL Final vs Inter
  { team: 'Benfica',            year: 1988 }, // UCL Final vs PSV
  { team: 'Inter Milan',        year: 1967 }, // Los Leones de Lisboa (Celtic)

  // ── Selecciones nacionales ─────────────────────────────────────
  { team: 'England',            year: 2018 }, // Croatia vs England Semi
  { team: 'Uruguay',            year: 2010 }, // Ghana vs Uruguay 2010
  { team: 'Uruguay',            year: 2018 }, // Uruguay vs Portugal 2018
  { team: 'South Korea',        year: 2002 }, // South Korea vs Italy 2002
  { team: 'Morocco',            year: 2022 }, // Morocco vs Portugal Semi 2022
  { team: 'Ghana',              year: 2010 }, // Ghana vs Uruguay 2010

  // ── Posiblemente sin datos en TM (históricas muy antiguas) ────
  { team: 'Cameroon',           year: 1990 }, // Cameroon vs Argentina 1990
  { team: 'England',            year: 1986 }, // Mano de Dios
  { team: 'Eintracht Frankfurt', year: 1960 }, // La Gran Final Copa Europa
  { team: 'Inter Milan',        year: 1967 }, // (duplicado, ya arriba)
  { team: 'Germany',            year: 1954 }, // El Milagro de Berna
  { team: 'Hungary',            year: 1954 }, // El Milagro de Berna
  { team: 'Uruguay',            year: 1950 }, // El Maracanazo
  { team: 'Brazil',             year: 1950 }, // El Maracanazo
];

// Eliminar duplicados (por si acaso)
const seen = new Set();
const QUEUE = MISSING.filter(({ team, year }) => {
  const key = `${team}|${year}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     ⚽  Seed Missing Eras — Eras históricas exactas      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Total a descargar: ${QUEUE.length}  |  Delay: ${DELAY}ms  |  Dry-run: ${DRY_RUN}`);
  console.log('─'.repeat(62));

  if (DRY_RUN) {
    for (const { team, year } of QUEUE) {
      console.log(`  📋  ${team.padEnd(25)} ${year}`);
    }
    return;
  }

  let downloaded = 0, noData = 0, errored = 0;

  for (let i = 0; i < QUEUE.length; i++) {
    const { team, year } = QUEUE[i];
    const num = String(i + 1).padStart(2);
    try {
      const t0     = Date.now();
      const result = await fetchTransfermarktSquad(team, String(year));
      const ms     = Date.now() - t0;

      if (!result) {
        console.log(`  [${num}/${QUEUE.length}]  ⬛  ${team.padEnd(25)} ${year}  — sin datos en TM`);
        noData++;
        await sleep(800);
      } else {
        const gk     = result.players.find(p => p.position === 'GK');
        const gkName = gk ? gk.name : '(sin GK?)';
        console.log(`  [${num}/${QUEUE.length}]  ⬇️   ${team.padEnd(25)} ${year}  ✅  ${result.formation}  ${result.players.length}j  GK: ${gkName}  (${ms}ms)`);
        downloaded++;
        if (i < QUEUE.length - 1) await sleep(DELAY);
      }
    } catch (e) {
      console.log(`  [${num}/${QUEUE.length}]  ❌  ${team.padEnd(25)} ${year}  ERROR: ${e.message}`);
      errored++;
      await sleep(DELAY);
    }
  }

  console.log('\n' + '═'.repeat(62));
  console.log(`  ✅  Completado`);
  console.log(`  ⬇️   Descargados:  ${downloaded}`);
  console.log(`  ⬛  Sin datos TM:  ${noData}`);
  console.log(`  ❌  Errores:       ${errored}`);
  console.log('\n  Ahora corre: node _check_year_era_gap.js');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
