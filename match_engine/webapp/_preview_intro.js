'use strict';
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

const w = WIDTH, h = HEIGHT, d = 5;

const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');
const trophyImg   = path.join(__dirname, 'public', 'img', 'trophy-ucl.png');

const imgs = [
  { file: coinImg,     scale: 280, y: 110  },
  { file: wordmarkImg, scale: 750, y: 390  },
  { file: trophyImg,   scale: 420, y: 590  },
].filter(i => fs.existsSync(i.file));

console.log('[intro] Images found:', imgs.map(i => path.basename(i.file)));

const inputs = [
  '-f', 'lavfi', '-i', `color=c=0x0a1628:size=${w}x${h}:rate=30:duration=${d}`,
];
imgs.forEach(i => inputs.push('-i', i.file));

const filterParts = [];
let lastLabel = '0:v';

imgs.forEach((img, idx) => {
  const inputIdx     = idx + 1;
  const scaledLbl    = `img${idx}`;
  const compositeLbl = `c${idx}`;
  filterParts.push(`[${inputIdx}:v]scale=${img.scale}:-1,format=rgba[${scaledLbl}]`);
  filterParts.push(`[${lastLabel}][${scaledLbl}]overlay=(W-w)/2:${img.y}[${compositeLbl}]`);
  lastLabel = compositeLbl;
});

const fontBold = 'C\\:/Windows/Fonts/arialbd.ttf';
const fontReg  = 'C\\:/Windows/Fonts/arial.ttf';

const fadeIn = (s) => `if(lt(t,${s}),0,min(1,(t-${s})/0.6))`;
const alpha  = (s) => `min(${fadeIn(s)},if(gt(t,${d - 0.7}),max(0,(${d}-t)/0.7),1))`;

filterParts.push(
  `[${lastLabel}]` +
  `drawtext=fontfile='${fontBold}':text='UEFA Champions League':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=1350:shadowx=4:shadowy=4:shadowcolor=0x00000099:alpha='${alpha(1.4)}',` +
  `drawtext=fontfile='${fontBold}':text='2025\\/26':fontsize=104:fontcolor=FFD700:x=(w-text_w)/2:y=1470:shadowx=4:shadowy=4:shadowcolor=0x00000099:alpha='${alpha(1.7)}',` +
  `drawtext=fontfile='${fontReg}':text='golazox.com':fontsize=52:fontcolor=0xCCCCCC:x=(w-text_w)/2:y=1630:shadowx=2:shadowy=2:alpha='${alpha(2.0)}',` +
  `fade=t=in:st=0:d=0.8,fade=t=out:st=${d - 0.8}:d=0.8` +
  `[vout]`,
);

const outFile = path.join(__dirname, 'videos', 'intro_preview.mp4');
if (!fs.existsSync(path.join(__dirname, 'videos'))) fs.mkdirSync(path.join(__dirname, 'videos'));

console.log('[intro] Building intro_preview.mp4...');
try {
  ffmpeg([
    '-y',
    ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-an',
    '-t', String(d),
    outFile,
  ]);
  console.log('[intro] Done →', outFile);
} catch (e) {
  console.error('[intro] ERROR:\n', e.message);
}
