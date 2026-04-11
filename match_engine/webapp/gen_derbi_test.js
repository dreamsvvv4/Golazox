/**
 * gen_derbi_test.js — Preview de 20s para verificar calidad visual
 * Genera solo el intro card (10s) + CTA card (10s) del Derbi Catalán.
 * Sin Puppeteer, sin partido completo — rápido para chequear encuadre y calidad.
 *
 * Uso: node gen_derbi_test.js
 */
'use strict';

require('dotenv').config();
const path  = require('path');
const fs    = require('fs');
const os    = require('os');
const { spawnSync } = require('child_process');
const { createMatchIntroVideo, createCtaCard } = require('./video_generator');

const outDir  = path.join(__dirname, 'videos');
const outFile = path.join(outDir, 'derbi_test_preview.mp4');
const tmpIntro = path.join(os.tmpdir(), 'derbi_intro_10s.mp4');
const tmpCta   = path.join(os.tmpdir(), 'derbi_cta_10s.mp4');
const listFile = path.join(os.tmpdir(), 'derbi_test_list.txt');

fs.mkdirSync(outDir, { recursive: true });

const ffmpegBin = process.env.FFMPEG_PATH || require('ffmpeg-static');

function ffmpeg(args) {
  const r = spawnSync(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').toString();
    throw new Error('ffmpeg error: ' + err.slice(-800));
  }
}

console.log('\n🎬 TEST 20s — Derbi Catalán: FC Barcelona 2025 vs Espanyol 2025');
console.log('   Intro 10s + CTA 10s — sin partido completo\n');

console.log('[test] Generando intro card (10s)...');
createMatchIntroVideo(
  'fc-barcelona', '',
  'espanyol-barcelona', '',
  tmpIntro,
  10,                          // 10 segundos
  'DERBI CATALÁN',
  'La Liga · 11 Abril 2026',
);
console.log('[test] ✓ Intro OK');

console.log('[test] Generando CTA card (10s)...');
createCtaCard(tmpCta, 10);
console.log('[test] ✓ CTA OK');

console.log('[test] Concatenando...');
fs.writeFileSync(listFile,
  `file '${tmpIntro.replace(/\\/g, '/')}'\n` +
  `file '${tmpCta.replace(/\\/g, '/')}'\n`
);
ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile]);

// Cleanup
[tmpIntro, tmpCta, listFile].forEach(f => { try { fs.unlinkSync(f); } catch {} });

console.log(`\n✅ Preview guardado: ${outFile}`);
console.log('   Abre el archivo y verifica encuadre, badges, textos y calidad.');
