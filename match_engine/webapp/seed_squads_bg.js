#!/usr/bin/env node
/**
 * seed_squads_bg.js — Worker en segundo plano para descargas automáticas
 * ════════════════════════════════════════════════════════════════════════
 * Escanea continuamente qué combinaciones equipo+año faltan en el disco,
 * las descarga de Transfermarkt con throttling humano, y después descarga
 * los escudos que también falten.
 *
 * USO:
 *   node seed_squads_bg.js               # Loop infinito (ideal bajo PM2)
 *   node seed_squads_bg.js --once        # Un solo ciclo, luego sale
 *   node seed_squads_bg.js --dry-run     # Muestra lo que descargaría, sin red
 *   node seed_squads_bg.js --badges-only # Solo descarga escudos faltantes
 *   node seed_squads_bg.js --delay 3000  # Delay entre peticiones (ms, default 2800)
 *   node seed_squads_bg.js --cycle 7200  # Intervalo entre ciclos en segundos (default 3600)
 *   node seed_squads_bg.js --limit 50    # Máx. descargas nuevas por ciclo
 *   node seed_squads_bg.js --batch clubs # Filtra: clubs | national | winners | wc2026 | all
 *
 * Archivos que escribe:
 *   squads/.seed-progress.json   → estado del ciclo actual (leído por el servidor?)
 *   logs/seed_bg.log             → log histórico de descargas
 *
 * Integración PM2 (ecosystem.config.js): añade esta entrada al array apps:
 *   {
 *     name: 'seed-bg',
 *     script: 'seed_squads_bg.js',
 *     args: '--cycle 3600 --limit 30 --delay 2800',
 *     cron_restart: '0 4 * * *',   // reinicia limpio a las 4am
 *     autorestart: true,
 *     watch: false,
 *   }
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const { fetchTransfermarktSquad, resolveClub, _loadTeamFile } = require('./transfermarkt');
const { fetchTeamBadge } = require('./lookup');

// ── Parseo de argumentos ──────────────────────────────────────
const args      = process.argv.slice(2);
const getArg    = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null; };
const hasFlag   = (f) => args.includes(f);

const DRY_RUN     = hasFlag('--dry-run');
const ONCE        = hasFlag('--once');
const BADGES_ONLY = hasFlag('--badges-only');
const DELAY       = parseInt(getArg('--delay')  || '2800', 10);
const CYCLE_SEC   = parseInt(getArg('--cycle')  || '3600', 10);
const MAX_DL      = parseInt(getArg('--limit')  || '999',  10);
const BATCH       = getArg('--batch') || 'all';

const SQUADS_DIR   = path.join(__dirname, 'squads');
const LOGS_DIR     = path.join(__dirname, 'logs');
const PROGRESS_FILE= path.join(SQUADS_DIR, '.seed-progress.json');
const LOG_FILE     = path.join(LOGS_DIR, 'seed_bg.log');
const NODE_BIN     = process.execPath;

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

// ── Logging ───────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n', 'utf8'); } catch (_) {}
}

// ── Catalog: reuse the same lists as seed_squads.js ───────────
// We spawn seed_squads.js as a subprocess to reuse its full catalog
// and avoid duplicating all the registry data.
// The --only-new flag makes it skip already-cached items instantly.

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Status file ───────────────────────────────────────────────
function writeCycleStatus(status) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
      ...status,
      updatedAt: new Date().toISOString(),
      pid: process.pid,
    }, null, 2), 'utf8');
  } catch (_) {}
}

// ── Single download cycle ─────────────────────────────────────
async function runSquadCycle() {
  log(`▶ Iniciando ciclo de descarga de squads (batch=${BATCH}, limit=${MAX_DL}, delay=${DELAY}ms)`);

  writeCycleStatus({
    phase: 'squads',
    status: 'running',
    batch: BATCH,
  });

  if (DRY_RUN) {
    // Delegate dry-run display to seed_squads.js
    const r = spawnSync(NODE_BIN, [
      'seed_squads.js',
      '--dry-run',
      '--batch', BATCH,
    ], { cwd: __dirname, stdio: 'inherit' });
    log(`↩ dry-run completado (exit ${r.status})`);
    return { downloaded: 0, failed: 0 };
  }

  // Run seed_squads.js --only-new in a child process with inherited stdio
  // so all its pretty output appears in the pm2 log too.
  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, [
      'seed_squads.js',
      '--batch',     BATCH,
      '--only-new',
      '--delay',     String(DELAY),
    ], { cwd: __dirname, stdio: 'inherit' });

    child.on('close', (code) => {
      log(`↩ seed_squads.js salió con código ${code}`);
      resolve({ downloaded: -1 /* unknown from child*/, failed: code !== 0 ? 1 : 0 });
    });
    child.on('error', (e) => {
      log(`✗ Error al lanzar seed_squads.js: ${e.message}`);
      resolve({ downloaded: 0, failed: 1 });
    });
  });
}

// ── Badge download cycle ──────────────────────────────────────
async function runBadgeCycle() {
  log('🎨 Iniciando ciclo de descarga de escudos faltantes…');

  writeCycleStatus({ phase: 'badges', status: 'running' });

  if (DRY_RUN) {
    const r = spawnSync(NODE_BIN, ['download_badges.js', '--dry-run'], {
      cwd: __dirname, stdio: 'inherit',
    });
    log(`↩ badge dry-run completado (exit ${r.status})`);
    return;
  }

  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, ['download_badges.js'], {
      cwd: __dirname, stdio: 'inherit',
    });
    child.on('close', (code) => {
      log(`↩ download_badges.js salió con código ${code}`);
      resolve();
    });
    child.on('error', (e) => {
      log(`✗ Error al lanzar download_badges.js: ${e.message}`);
      resolve();
    });
  });
}

// ── Post-cycle audit ──────────────────────────────────────────
async function runAudit() {
  log('🔍 Ejecutando auditoría rápida de plantillas…');
  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, ['audit_squads.js', '--check-names', '--check-clones'], {
      cwd: __dirname, stdio: 'inherit',
    });
    child.on('close', (code) => {
      log(`↩ audit_squads.js salió con código ${code}${code !== 0 ? ' (warnings/errors encontrados)' : ' ✅'}`);
      resolve(code);
    });
    child.on('error', (e) => {
      log(`✗ Error al lanzar audit_squads.js: ${e.message}`);
      resolve(1);
    });
  });
}

// ── Missing badge scan (fast, no network) ────────────────────
function scanMissingBadges() {
  let missing = 0;
  let total   = 0;
  const squadFiles = fs.readdirSync(SQUADS_DIR)
    .filter(f => f.endsWith('.json') && f !== '.seed-progress.json');

  let metaObj = {};
  try { metaObj = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads-meta.json'), 'utf8')); } catch (_) {}

  for (const fname of squadFiles) {
    const slug = fname.replace('.json', '');
    try {
      const d = JSON.parse(fs.readFileSync(path.join(SQUADS_DIR, fname), 'utf8'));
      const badge = d.badgeLocalPath || (metaObj[slug] && metaObj[slug].badgeLocalPath);
      if (!badge) { missing++; total++; continue; }
      const disk  = path.join(__dirname, 'public', badge.replace(/^\//, ''));
      if (!fs.existsSync(disk)) missing++;
      total++;
    } catch (_) {}
  }
  return { missing, total };
}

// ── Count cached squads ───────────────────────────────────────
function countCachedSquads() {
  const files = fs.readdirSync(SQUADS_DIR)
    .filter(f => f.endsWith('.json') && f !== '.seed-progress.json');
  let totalSeasons = 0;
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(SQUADS_DIR, f), 'utf8'));
      totalSeasons += Object.keys(d.seasons || {}).length;
    } catch (_) {}
  }
  return { squads: files.length, seasons: totalSeasons };
}

// ── Main loop ─────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════════════════════');
  log(' GolazOX Background Seeder arrancado');
  log(`  PID: ${process.pid}  |  once=${ONCE}  |  dry=${DRY_RUN}  |  badges-only=${BADGES_ONLY}`);
  log(`  batch=${BATCH}  |  delay=${DELAY}ms  |  cycle=${CYCLE_SEC}s  |  limit=${MAX_DL}`);
  log('═══════════════════════════════════════════════════════');

  let cycle = 0;
  while (true) {
    cycle++;
    log(`\n── Ciclo #${cycle} ──────────────────────────────────────`);

    const { squads: squadsBefore, seasons: seasonsBefore } = countCachedSquads();
    log(`📦 Estado actual: ${squadsBefore} archivos de equipo, ${seasonsBefore} temporadas en disco`);

    const { missing: missBefore, total: missTotal } = scanMissingBadges();
    log(`🎨 Escudos: ${missTotal - missBefore}/${missTotal} OK, ${missBefore} faltan`);

    writeCycleStatus({
      cycle,
      phase: 'idle',
      status: 'starting',
      squadFiles: squadsBefore,
      totalSeasons: seasonsBefore,
      missingBadges: missBefore,
    });

    // 1. Squad downloads
    if (!BADGES_ONLY) {
      await runSquadCycle();
    }

    // 2. Badge downloads (after squads so new teams get their badge too)
    if (!DRY_RUN) {
      await runBadgeCycle();
    }

    // 3. Audit
    if (!DRY_RUN) {
      await runAudit();
    }

    // 4. Summary
    const { squads: squadsAfter, seasons: seasonsAfter } = countCachedSquads();
    const newSquads  = squadsAfter  - squadsBefore;
    const newSeasons = seasonsAfter - seasonsBefore;
    const { missing: missAfter } = scanMissingBadges();
    const newBadges  = missBefore - missAfter;

    log(`\n✅ Ciclo #${cycle} completado:`);
    log(`   +${newSquads} equipos nuevos, +${newSeasons} temporadas nuevas, +${newBadges} escudos descargados`);
    log(`   Total: ${squadsAfter} equipos, ${seasonsAfter} temporadas, ${missTotal - missAfter}/${missTotal} escudos OK`);

    writeCycleStatus({
      cycle,
      phase: 'done',
      status: 'idle',
      squadFiles:    squadsAfter,
      totalSeasons:  seasonsAfter,
      missingBadges: missAfter,
      lastCycleNewSquads:   newSquads,
      lastCycleNewSeasons:  newSeasons,
      lastCycleNewBadges:   newBadges,
      nextCycleIn: `${CYCLE_SEC}s`,
    });

    if (ONCE || DRY_RUN) {
      log('🏁 Modo --once / --dry-run: saliendo.');
      break;
    }

    log(`\n💤 Próximo ciclo en ${CYCLE_SEC}s (${new Date(Date.now() + CYCLE_SEC * 1000).toLocaleTimeString()})`);
    await sleep(CYCLE_SEC * 1000);
  }
}

// Graceful shutdown
process.on('SIGINT',  () => { log('🛑 SIGINT recibido — parando.'); process.exit(0); });
process.on('SIGTERM', () => { log('🛑 SIGTERM recibido — parando.'); process.exit(0); });

main().catch(e => {
  log(`💥 Error fatal: ${e.message}`);
  console.error(e);
  process.exit(1);
});
