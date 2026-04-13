'use strict';
/**
 * _build_final.js — Combina intro_preview.mp4 + video de partido + music_epic.mp3
 *
 * Uso:
 *   node _build_final.js                              → usa el video de partido más reciente
 *   node _build_final.js golazox_2026-04-07T0741.mp4  → especifica el video
 *
 * Salida: videos/golazox_TIMESTAMP_final.mp4
 */

process.env.FFMPEG_PATH = require('ffmpeg-static');

const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const VIDEOS_DIR = path.join(__dirname, 'videos');
const ASSETS_DIR = path.join(__dirname, 'assets');
const MUSIC_FILE = path.join(ASSETS_DIR, 'music_epic.mp3');
const INTRO_FILE = path.join(VIDEOS_DIR, 'intro_preview.mp4');
const MUSIC_VOLUME = 0.30;

function ffmpeg(args) {
  const bin = process.env.FFMPEG_PATH;
  const r = spawnSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error((r.stderr || '').toString().slice(-1500));
}

function latestMatch() {
  const files = fs.readdirSync(VIDEOS_DIR)
    .filter(f => f.match(/^golazox_[\dT-]+\.mp4$/) && !f.includes('final') && !f.includes('short'))
    .sort().reverse();
  if (!files.length) throw new Error('No hay videos de partido en videos/');
  return path.join(VIDEOS_DIR, files[0]);
}

// ── Resolve inputs ────────────────────────────────────────────────────────────
// ── CLI flags ─────────────────────────────────────────────────────────────────
// --with-intro   : prepend intro_preview.mp4 (solo si el video es grabación RAW
//                  sin postProcess). Los videos de video_generator.js YA incluyen
//                  la intro → NO uses este flag con ellos o tendrás doble intro.
// --with-music   : mezclar music_epic.mp3 de fondo (solo si el video no tiene música)
const args       = process.argv.slice(2);
const withIntro  = args.includes('--with-intro');
const withMusic  = args.includes('--with-music');
const fileArg    = args.find(a => !a.startsWith('--'));

const matchFile = fileArg ? path.resolve(VIDEOS_DIR, fileArg) : latestMatch();

if (!fs.existsSync(matchFile)) throw new Error(`Video no encontrado: ${matchFile}`);
if (withIntro && !fs.existsSync(INTRO_FILE)) throw new Error(`intro_preview.mp4 no encontrada en videos/`);
if (withMusic && !fs.existsSync(MUSIC_FILE)) throw new Error(`music_epic.mp3 no encontrada en assets/`);

const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
const outFile = path.join(VIDEOS_DIR, `golazox_${ts}_final.mp4`);

const tmp      = os.tmpdir();
const concat   = path.join(tmp, 'golazox_concat.mp4');
const listFile = path.join(tmp, 'golazox_list.txt');

console.log('[build] Partido:', path.basename(matchFile));
if (withIntro) console.log('[build] Intro:  ', path.basename(INTRO_FILE));
if (withMusic) console.log('[build] Música: ', path.basename(MUSIC_FILE));
console.log('[build] Salida: ', path.basename(outFile));
if (!withIntro && !withMusic) {
  console.log('[build] ℹ️  Solo copiando — usa --with-intro y/o --with-music si el video es grabación RAW');
}
console.log('');

const introNorm = path.join(tmp, 'golazox_intro_norm.mp4');
let workingFile = matchFile;

// ── Paso 1 (opcional): Añadir intro ──────────────────────────────────────────
if (withIntro) {
  console.log('[1] Normalizando intro...');
  ffmpeg([
    '-y', '-i', INTRO_FILE,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', '30',
    '-an',
    introNorm,
  ]);

  console.log('[2] Concatenando intro + partido...');
  const introLine = introNorm.replace(/\\/g, '/');
  const matchLine = matchFile.replace(/\\/g, '/');
  fs.writeFileSync(listFile, `file '${introLine}'\nfile '${matchLine}'`);
  ffmpeg([
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy',
    concat,
  ]);
  workingFile = concat;
}

// ── Paso 2 (opcional): Mezclar música ────────────────────────────────────────
if (withMusic) {
  console.log('[3] Mezclando música de fondo...');
  let musicMixed = false;
  try {
    ffmpeg([
      '-y',
      '-i', workingFile,
      '-stream_loop', '-1', '-i', MUSIC_FILE,
      '-filter_complex',
        `[1:a]volume=${MUSIC_VOLUME}[music];[0:a]anull[orig];[orig][music]amix=inputs=2:duration=first:dropout_transition=3[aout]`,
      '-map', '0:v', '-map', '[aout]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest',
      outFile,
    ]);
    musicMixed = true;
  } catch (e) {
    console.log('[3] Sin audio original, añadiendo solo música...');
  }
  if (!musicMixed) {
    ffmpeg([
      '-y',
      '-i', workingFile,
      '-stream_loop', '-1', '-i', MUSIC_FILE,
      '-filter_complex', `[1:a]volume=${MUSIC_VOLUME}[aout]`,
      '-map', '0:v', '-map', '[aout]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest',
      outFile,
    ]);
  }
} else {
  // Sin procesado extra: solo copiar con el nombre _final
  fs.copyFileSync(workingFile, outFile);
}

// ── Limpieza ──────────────────────────────────────────────────────────────────
[introNorm, concat, listFile].forEach(f => { try { fs.unlinkSync(f); } catch {} });

const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ Video listo → ${path.basename(outFile)} (${sizeMB} MB)`);
console.log(`\nPara subir a YouTube:`);
console.log(`  node uploader.js --file videos/${path.basename(outFile)} --platforms youtube`);
