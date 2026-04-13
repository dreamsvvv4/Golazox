'use strict';
/**
 * _preview_intro.js — Pre-renderiza intros por tipo y las guarda en videos/
 *
 * Uso:
 *   node _preview_intro.js           → renderiza los 3 tipos (ucl, wc, match)
 *   node _preview_intro.js --type ucl
 *   node _preview_intro.js --type wc
 *   node _preview_intro.js --type match
 *
 * Salida:
 *   videos/intro_ucl.mp4   → UEFA Champions League 2025/26
 *   videos/intro_wc.mp4    → FIFA World Cup 2026
 *   videos/intro_match.mp4 → Clásicos Eternos
 *   videos/intro_preview.mp4 → alias de intro_ucl.mp4 (compatibilidad)
 */
process.env.FFMPEG_PATH = require('ffmpeg-static');
const path    = require('path');
const fs      = require('fs');
const { spawnSync } = require('child_process');

const WIDTH = 1080, HEIGHT = 1920;

function ffmpeg(args) {
  const result = spawnSync(process.env.FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').toString().slice(-1200));
  }
}

const INTRO_CONFIGS = {
  ucl: {
    trophy:    'trophy-ucl.png',
    titleText: 'UEFA Champions League',
    yearText:  '2025\\/26',
    yearColor: 'FFD700',
  },
  wc: {
    trophy:    'trophy-wc.png',
    titleText: 'FIFA World Cup 2026',
    yearText:  'USA \\· Canada \\· Mexico',
    yearColor: 'FF6B35',
  },
  match: {
    trophy:    'trophy-ucl.png',   // usa UCL como decorativo
    titleText: 'Cl\\u00e1sicos Eternos',
    yearText:  'golazox.com',
    yearColor: '4FC3F7',
  },
};

function buildIntro(type) {
  const cfg = INTRO_CONFIGS[type];
  const w = WIDTH, h = HEIGHT, d = 5;

  const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
  const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');
  const trophyImg   = path.join(__dirname, 'public', 'img', cfg.trophy);

  const imgs = [
    { file: coinImg,     scale: 280, y: 110 },
    { file: wordmarkImg, scale: 750, y: 390 },
    { file: trophyImg,   scale: 420, y: 590 },
  ].filter(i => fs.existsSync(i.file));

  console.log(`[intro:${type}] Images:`, imgs.map(i => path.basename(i.file)));

  const inputs = [
    '-f', 'lavfi', '-i', `color=c=0x0a1628:size=${w}x${h}:rate=30:duration=${d}`,
  ];
  imgs.forEach(i => inputs.push('-i', i.file));

  const filterParts = [];
  let lastLabel = '0:v';

  imgs.forEach((img, idx) => {
    const scaledLbl    = `img${idx}`;
    const compositeLbl = `c${idx}`;
    filterParts.push(`[${idx + 1}:v]scale=${img.scale}:-1,format=rgba[${scaledLbl}]`);
    filterParts.push(`[${lastLabel}][${scaledLbl}]overlay=(W-w)/2:${img.y}[${compositeLbl}]`);
    lastLabel = compositeLbl;
  });

  const fontBold = 'C\\:/Windows/Fonts/arialbd.ttf';
  const fontReg  = 'C\\:/Windows/Fonts/arial.ttf';

  const fadeIn = (s) => `if(lt(t,${s}),0,min(1,(t-${s})/0.6))`;
  const alpha  = (s) => `min(${fadeIn(s)},if(gt(t,${d - 0.7}),max(0,(${d}-t)/0.7),1))`;

  filterParts.push(
    `[${lastLabel}]` +
    `drawtext=fontfile='${fontBold}':text='${cfg.titleText}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=1350:shadowx=4:shadowy=4:shadowcolor=0x00000099:alpha='${alpha(1.4)}',` +
    `drawtext=fontfile='${fontBold}':text='${cfg.yearText}':fontsize=96:fontcolor=${cfg.yearColor}:x=(w-text_w)/2:y=1470:shadowx=4:shadowy=4:shadowcolor=0x00000099:alpha='${alpha(1.7)}',` +
    `drawtext=fontfile='${fontReg}':text='golazox.com':fontsize=52:fontcolor=0xCCCCCC:x=(w-text_w)/2:y=1620:shadowx=2:shadowy=2:alpha='${alpha(2.0)}',` +
    `fade=t=in:st=0:d=0.8,fade=t=out:st=${d - 0.8}:d=0.8` +
    `[vout]`,
  );

  if (!fs.existsSync(path.join(__dirname, 'videos'))) fs.mkdirSync(path.join(__dirname, 'videos'));
  const outFile = path.join(__dirname, 'videos', `intro_${type}.mp4`);

  console.log(`[intro:${type}] Rendering → ${path.basename(outFile)}...`);
  ffmpeg([
    '-y', ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-an', '-t', String(d),
    outFile,
  ]);
  console.log(`[intro:${type}] ✓ Done → ${outFile}`);
  return outFile;
}

// ── CLI ────────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const typeArg  = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
const typesToBuild = typeArg ? [typeArg] : ['ucl', 'wc', 'match'];

for (const t of typesToBuild) {
  if (!INTRO_CONFIGS[t]) { console.error(`Unknown type: ${t}. Use ucl, wc or match`); continue; }
  try {
    buildIntro(t);
  } catch (e) {
    console.error(`[intro:${t}] ERROR:`, e.message.slice(0, 400));
  }
}

// Keep intro_preview.mp4 as alias of intro_ucl.mp4 for backward compatibility
const uclFile     = path.join(__dirname, 'videos', 'intro_ucl.mp4');
const previewFile = path.join(__dirname, 'videos', 'intro_preview.mp4');
if (fs.existsSync(uclFile) && (!typeArg || typeArg === 'ucl')) {
  fs.copyFileSync(uclFile, previewFile);
  console.log('[intro] intro_preview.mp4 actualizada (alias de intro_ucl.mp4)');
}
