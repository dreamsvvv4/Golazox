#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = __dirname;
const OUT_DIR = path.join(BASE, 'videos');
const DATA_FILE = path.join(BASE, 'data', 'rumors_snapshot.json');
const PUBLIC_DIR = path.join(BASE, 'public');

function slug(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function toDataUri(fp) {
  try {
    const buf = fs.readFileSync(fp);
    const ext = path.extname(fp).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function badgeDataUri(badgePath) {
  try {
    if (!badgePath) return null;
    const m = String(badgePath).match(/\/(?:tmbadge)\/(\d+)/);
    const id = m ? m[1] : null;
    if (!id) return null;
    const fetch = require('node-fetch');
    const r = await fetch(`https://tmssl.akamaized.net/images/wappen/head/${id}.png`, {
      headers: { Referer: 'https://www.transfermarkt.es/', 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function readRumors() {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const list = Array.isArray(raw.list) ? raw.list : [];
  return list.filter((r) => typeof r.prob === 'number').sort((a, b) => b.prob - a.prob);
}

function pickRumor(list, playerQuery) {
  if (!playerQuery) return list[0] || null;
  const q = playerQuery.toLowerCase();
  return list.find((r) => String(r.player || '').toLowerCase().includes(q)) || null;
}

async function renderStillToMp4(html, outBase, sec) {
  const puppeteer = require('puppeteer');
  const ffmpeg = require('ffmpeg-static');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const png = path.join(OUT_DIR, `${outBase}.png`);
  const mp4 = path.join(OUT_DIR, `${outBase}.mp4`);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: png, type: 'png' });
    if (!ffmpeg) return { png, mp4: null };
    const tmp = path.join(OUT_DIR, `${outBase}_seg.mp4`);
    const r = spawnSync(ffmpeg, ['-y', '-loop', '1', '-i', png, '-c:v', 'libx264', '-t', String(sec), '-pix_fmt', 'yuv420p', '-vf', 'scale=1080:1920', tmp], { stdio: 'inherit', timeout: 120000 });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${outBase}`);
    fs.renameSync(tmp, mp4);
    return { png, mp4 };
  } finally {
    await browser.close();
  }
}

function coverHtml({ wm, mode, rumor }) {
  const lines = {
    bomb: ['RUMOR BOMBA', `${rumor.player}`],
    watch: ['ULTIMA HORA', `${rumor.from?.name || ''} -> ${rumor.to?.name || ''}`],
    heat: ['RUMOR CALIENTE', `${rumor.prob}% DE PROBABILIDAD`],
  };
  const [h1, h2] = lines[mode] || lines.heat;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>
    *{box-sizing:border-box}html,body{width:1080px;height:1920px;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:radial-gradient(circle at 10% 20%,#241a00,#0b0b14 60%,#000);color:#fff;overflow:hidden}
    .grain{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0,rgba(255,255,255,.03) 1px,transparent 1px,transparent 3px);opacity:.25}
    .bar{position:absolute;top:0;left:0;right:0;height:20px;background:linear-gradient(90deg,#f33,#fa0,#ff0)}
    .wrap{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:80px 64px;gap:20px}
    .pill{font-weight:900;letter-spacing:2px;font-size:44px;padding:10px 18px;border:2px solid #ffd54a;border-radius:999px;background:rgba(255,187,0,.13)}
    .h1{font-size:116px;line-height:.93;font-weight:900;text-transform:uppercase;text-shadow:0 8px 32px rgba(0,0,0,.45)}
    .h2{font-size:56px;line-height:1.08;color:#e8f2ff;font-weight:800}
    .meta{margin-top:10px;font-size:40px;font-weight:700;color:#ffd54a}
    .wm{position:absolute;bottom:48px;left:56px;width:320px;opacity:.95}
    .cta{position:absolute;bottom:54px;right:56px;font-size:30px;font-weight:800;color:#9dd6ff}
  </style></head><body>
    <div class="grain"></div><div class="bar"></div>
    <div class="wrap">
      <div class="pill">DEADLINE DAY</div>
      <div class="h1">${h1}</div>
      <div class="h2">${h2}</div>
      <div class="meta">${rumor.from?.name || ''} -> ${rumor.to?.name || ''}</div>
    </div>
    ${wm ? `<img class="wm" src="${wm}">` : ''}
    <div class="cta">golazox.com</div>
  </body></html>`;
}

async function rumorCardHtml(rumor) {
  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));
  const fromBadge = await badgeDataUri(rumor.from && rumor.from.badge);
  const toBadge = await badgeDataUri(rumor.to && rumor.to.badge);
  const prob = Math.max(1, Math.min(100, Number(rumor.prob || 0)));
  const hotLabel = prob >= 70 ? 'MUY CALIENTE' : prob >= 50 ? 'CALIENTE' : 'A SEGUIR';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>
    *{box-sizing:border-box}html,body{width:1080px;height:1920px;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:linear-gradient(180deg,#0c1022,#0a0c12 45%,#070710);color:#fff}
    .wrap{display:flex;flex-direction:column;height:100%;padding:52px 58px}
    .wm{width:320px;opacity:.95}
    .tag{margin-top:20px;align-self:flex-start;padding:8px 16px;border-radius:999px;font-weight:900;letter-spacing:1px;font-size:34px;background:#ff3c2e}
    .title{margin-top:18px;font-size:102px;line-height:.92;font-weight:900;text-transform:uppercase}
    .clubs{margin-top:42px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .club{width:42%;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
    .club img{width:150px;height:150px;object-fit:contain;border-radius:16px;background:rgba(255,255,255,.03)}
    .club .name{font-size:42px;line-height:1.05;font-weight:800}
    .arrow{font-size:84px;color:#ffd54a;font-weight:900}
    .prob{margin-top:34px}
    .prob .lbl{font-size:38px;font-weight:700;color:#d6e8ff;margin-bottom:12px}
    .bar{height:36px;border-radius:999px;background:#1c2436;overflow:hidden;border:1px solid rgba(255,255,255,.14)}
    .fill{height:100%;width:${prob}%;background:linear-gradient(90deg,#ff5a3d,#ff9f1a,#ffd21a)}
    .pct{margin-top:10px;font-size:72px;font-weight:900;color:#ffd54a}
    .extra{margin-top:auto;font-size:30px;color:#9bd3ff;font-weight:700}
  </style></head><body>
    <div class="wrap">
      ${wm ? `<img class="wm" src="${wm}">` : ''}
      <div class="tag">RUMOR ${hotLabel}</div>
      <div class="title">${rumor.player}</div>
      <div class="clubs">
        <div class="club">${fromBadge ? `<img src="${fromBadge}">` : ''}<div class="name">${rumor.from?.name || ''}</div></div>
        <div class="arrow">-></div>
        <div class="club">${toBadge ? `<img src="${toBadge}">` : ''}<div class="name">${rumor.to?.name || ''}</div></div>
      </div>
      <div class="prob"><div class="lbl">Probabilidad de traspaso</div><div class="bar"><div class="fill"></div></div><div class="pct">${prob}%</div></div>
      <div class="extra">Comenta: se cierra hoy o se cae?</div>
    </div>
  </body></html>`;
}

function concatMp4(parts, outPath) {
  const ffmpeg = require('ffmpeg-static');
  const listFile = path.join(OUT_DIR, `_${path.basename(outPath, '.mp4')}_list.txt`);
  const lines = parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, lines, 'utf8');
  const r = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath], { stdio: 'inherit', timeout: 120000 });
  try { fs.unlinkSync(listFile); } catch {}
  if (r.status !== 0) throw new Error('ffmpeg concat failed');
}

async function main() {
  const args = process.argv.slice(2);
  const qIdx = args.indexOf('--player');
  const playerQuery = qIdx >= 0 ? args[qIdx + 1] : '';
  const dateIdx = args.indexOf('--date');
  const dateArg = dateIdx >= 0 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);

  const list = readRumors();
  if (!list.length) throw new Error('No hay rumores con probabilidad en data/rumors_snapshot.json');
  const rumor = pickRumor(list, playerQuery);
  if (!rumor) throw new Error(`No encuentro rumor para query: ${playerQuery}`);

  const rumorSlug = slug(`${rumor.player}-${rumor.to?.name || 'destino'}`);
  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));

  const cover1 = await renderStillToMp4(coverHtml({ wm, mode: 'bomb', rumor }), `cover_${dateArg}_rumor_${rumorSlug}_bomb`, 2.0);
  const cover2 = await renderStillToMp4(coverHtml({ wm, mode: 'watch', rumor }), `cover_${dateArg}_rumor_${rumorSlug}_watch`, 2.0);
  const cover3 = await renderStillToMp4(coverHtml({ wm, mode: 'heat', rumor }), `cover_${dateArg}_rumor_${rumorSlug}_heat`, 2.0);

  const card = await renderStillToMp4(await rumorCardHtml(rumor), `rumor_${dateArg}_${rumorSlug}`, 6.0);
  const outVideo = path.join(OUT_DIR, `rumor_hot_${dateArg}_${rumorSlug}.mp4`);
  concatMp4([cover1.mp4, card.mp4], outVideo);

  console.log('OK rumor hot video:', outVideo);
  console.log('Portadas:');
  console.log(' -', cover1.png);
  console.log(' -', cover2.png);
  console.log(' -', cover3.png);
  console.log('Rumor elegido:', `${rumor.player} | ${rumor.from?.name || '?'} -> ${rumor.to?.name || '?'} | ${rumor.prob}%`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
}
