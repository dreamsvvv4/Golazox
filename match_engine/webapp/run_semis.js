/**
 * run_semis.js — Genera los 4 partidos de cuartos de Champions 25/26.
 * Uso: node run_semis.js
 * Para subir: ejecuta el comando node uploader.js que se imprime al final de cada partido.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const SEMIS = [
  {
    // Cuartos ida jugada ayer: Bayern ganó 2-1
    teamA: 'real-madrid',       eraA: '2025',
    teamB: 'fc-bayern-munchen', eraB: '2025',
    stadiumId: 'bernabeu', refereeId: 'collina', weatherId: 'night',
    title: '🏆 Real Madrid vs Bayern Munich | Cuartos Champions League 2025/26 | golazox.com',
  },
  {
    // Cuartos: Sporting Lisboa vs Arsenal (Arsenal ganó 1-0)
    teamA: 'sporting-lissabon', eraA: '2025',
    teamB: 'fc-arsenal',        eraB: '2025',
    stadiumId: 'anfield', refereeId: 'taylor', weatherId: 'rain',
    title: '🏆 Sporting Lisboa vs Arsenal | Cuartos Champions League 2025/26 | golazox.com',
  },
  {
    // Cuartos: FC Barcelona vs Atlético Madrid (hoy)
    teamA: 'fc-barcelona',    eraA: '2025',
    teamB: 'atletico-madrid', eraB: '2025',
    stadiumId: 'campnou', refereeId: 'kuipers', weatherId: 'cloudy',
    title: '🏆 FC Barcelona vs Atlético Madrid | Cuartos Champions League 2025/26 | golazox.com',
  },
  {
    // Cuartos: PSG vs Liverpool (hoy)
    teamA: 'fc-paris-saint-germain', eraA: '2025',
    teamB: 'fc-liverpool',           eraB: '2025',
    stadiumId: 'oldtrafford', refereeId: 'clattenburg', weatherId: 'wind',
    title: '🏆 PSG vs Liverpool | Cuartos Champions League 2025/26 | golazox.com',
  },
];

async function run() {
  for (let i = 0; i < SEMIS.length; i++) {
    const semi = SEMIS[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[semis] Partido ${i + 1}/4: ${semi.teamA} ${semi.eraA} vs ${semi.teamB} ${semi.eraB}`);
    console.log(`${'='.repeat(60)}\n`);

    // ── 1. Generar el video ──
    const genResult = spawnSync(process.execPath, [
      'video_generator.js',
      '--type', 'match',
      '--teamA', semi.teamA, '--eraA', semi.eraA,
      '--teamB', semi.teamB, '--eraB', semi.eraB,
      '--stadiumId', semi.stadiumId,
      '--refereeId', semi.refereeId,
      '--weatherId', semi.weatherId,
    ], {
      cwd: __dirname,
      stdio: 'inherit',
      timeout: 600000, // 10 min max
    });

    if (genResult.status !== 0) {
      console.error(`[semis] ✗ Generación fallida para partido ${i + 1}, estado: ${genResult.status}`);
      continue;
    }

    // ── 2. Buscar el video más reciente en la carpeta videos/ ──
    const videosDir = path.join(__dirname, 'videos');
    const files = fs.readdirSync(videosDir)
      .filter(f => f.startsWith('golazox_') && f.endsWith('.mp4'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(videosDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    if (!files.length) {
      console.error('[semis] ✗ No se encontró el video generado');
      continue;
    }

    const videoFile = path.join(videosDir, files[0].name);
    console.log(`\n[semis] ✓ Video listo: ${files[0].name}`);
    console.log(`[semis]   Para subir: node uploader.js --file "${videoFile}" --platforms youtube --type match --title "${semi.title}"`);}
  }

  console.log('\n[semis] ✓ Los 4 partidos han sido generados.');
  console.log('[semis]   Revisa los videos en la carpeta videos/ y sube manualmente los que quieras.');
}

run().catch(e => { console.error('[semis] Error fatal:', e); process.exit(1); });
