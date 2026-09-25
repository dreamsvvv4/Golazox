#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = __dirname;
const OUT_DIR = path.join(BASE, 'videos');
const PUBLIC_DIR = path.join(BASE, 'public');
const DATA_FILE = path.join(BASE, 'data', 'rumors_snapshot.json');

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
    return `data:image/png;base64,${buf.toString('base64')}`;
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

async function readRumorsLive() {
  try {
    const cacheFile = path.join(BASE, 'data', '.cache', 'rumors.json');
    try { fs.unlinkSync(cacheFile); } catch {}
    const news = require('./news');
    const data = await news.getRumors();
    const list = Array.isArray(data.list) ? data.list : [];
    const filtered = list.filter((r) => typeof r.prob === 'number').sort((a, b) => b.prob - a.prob);
    return filtered;
  } catch {
    return readRumors();
  }
}

function introHtml({ wm }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>
    *{box-sizing:border-box}html,body{width:1080px;height:1920px;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:radial-gradient(circle at 20% 0%,#2f0f0f,#120d1a 45%,#06070d);color:#fff;overflow:hidden}
    .bg1{position:absolute;width:900px;height:900px;border-radius:50%;left:-260px;top:-200px;background:rgba(255,120,60,.18);filter:blur(20px)}
    .bg2{position:absolute;width:780px;height:780px;border-radius:50%;right:-220px;bottom:-180px;background:rgba(0,186,255,.16);filter:blur(24px)}
    .wrap{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:90px 64px;text-align:center}
    .kicker{font-size:40px;font-weight:900;letter-spacing:2px;border:2px solid #ffd452;border-radius:999px;padding:10px 16px;background:rgba(255,183,0,.14)}
    .h1{margin-top:26px;font-size:160px;line-height:.9;font-weight:900;text-transform:uppercase;text-shadow:0 8px 28px rgba(0,0,0,.55)}
    .h2{font-size:68px;line-height:.95;font-weight:900;text-transform:uppercase;color:#ffd452}
    .sub{margin-top:26px;font-size:40px;font-weight:700;color:#d8e8ff}
    .wm{position:absolute;left:54px;bottom:42px;width:320px;opacity:.95}
  </style></head><body><div class="bg1"></div><div class="bg2"></div><div class="wrap"><div class="kicker">GOLAZOX · DEADLINE DAY</div><div class="h1">TOP 10</div><div class="h2">RUMORES CALIENTES</div><div class="sub">Equipos punteros y operaciones top</div></div>${wm ? `<img class="wm" src="${wm}">` : ''}</body></html>`;
}

async function rumorCardHtml(r, idx) {
  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));
  const fromBadge = await badgeDataUri(r.from && r.from.badge);
  const toBadge = await badgeDataUri(r.to && r.to.badge);
  const prob = Math.max(1, Math.min(100, Number(r.prob || 0)));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>
    *{box-sizing:border-box}html,body{width:1080px;height:1920px;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:linear-gradient(180deg,#0c1022,#0a0c12 45%,#070710);color:#fff}
    .wrap{display:flex;flex-direction:column;height:100%;padding:52px 58px}
    .wm{width:320px;opacity:.95}
    .tag{margin-top:20px;align-self:flex-start;padding:8px 16px;border-radius:999px;font-weight:900;letter-spacing:1px;font-size:34px;background:#ff3c2e}
    .rank{margin-top:16px;font-size:44px;font-weight:900;color:#ffd54a}
    .title{margin-top:10px;font-size:92px;line-height:.92;font-weight:900;text-transform:uppercase}
    .clubs{margin-top:38px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .club{width:42%;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
    .club img{width:150px;height:150px;object-fit:contain;border-radius:16px;background:rgba(255,255,255,.03)}
    .club .name{font-size:38px;line-height:1.05;font-weight:800}
    .arrow{font-size:84px;color:#ffd54a;font-weight:900}
    .prob{margin-top:30px}
    .prob .lbl{font-size:36px;font-weight:700;color:#d6e8ff;margin-bottom:12px}
    .bar{height:36px;border-radius:999px;background:#1c2436;overflow:hidden;border:1px solid rgba(255,255,255,.14)}
    .fill{height:100%;width:${prob}%;background:linear-gradient(90deg,#ff5a3d,#ff9f1a,#ffd21a)}
    .pct{margin-top:10px;font-size:70px;font-weight:900;color:#ffd54a}
  </style></head><body><div class="wrap">${wm ? `<img class="wm" src="${wm}">` : ''}<div class="tag">RUMOR CALIENTE</div><div class="rank">#${idx}</div><div class="title">${r.player}</div><div class="clubs"><div class="club">${fromBadge ? `<img src="${fromBadge}">` : ''}<div class="name">${r.from?.name || ''}</div></div><div class="arrow">-></div><div class="club">${toBadge ? `<img src="${toBadge}">` : ''}<div class="name">${r.to?.name || ''}</div></div></div><div class="prob"><div class="lbl">Probabilidad de traspaso</div><div class="bar"><div class="fill"></div></div><div class="pct">${prob}%</div></div></div></body></html>`;
}

async function renderHtmlToPngMp4(html, outBase, seconds) {
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
    await page.screenshot({ path: png, type: 'png' });
    const tmp = path.join(OUT_DIR, `${outBase}_seg.mp4`);
    const r = spawnSync(ffmpeg, ['-y', '-loop', '1', '-i', png, '-c:v', 'libx264', '-t', String(seconds), '-pix_fmt', 'yuv420p', '-vf', 'scale=1080:1920', tmp], { stdio: 'inherit', timeout: 120000 });
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${outBase}`);
    fs.renameSync(tmp, mp4);
    return { png, mp4 };
  } finally {
    await browser.close();
  }
}

function concat(parts, outPath) {
  const ffmpeg = require('ffmpeg-static');
  const listFile = path.join(OUT_DIR, `_${path.basename(outPath, '.mp4')}_list.txt`);
  const lines = parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, lines, 'utf8');
  const r = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath], { stdio: 'inherit', timeout: 120000 });
  try { fs.unlinkSync(listFile); } catch {}
  if (r.status !== 0) throw new Error('concat failed');
}

async function main() {
  const args = process.argv.slice(2);
  const topIdx = args.indexOf('--top');
  const topN = Math.max(1, parseInt(topIdx >= 0 ? args[topIdx + 1] : '10', 10) || 10);
  const dateIdx = args.indexOf('--date');
  const dateArg = dateIdx >= 0 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);
  const useLive = args.includes('--live');

  const rumors = (useLive ? await readRumorsLive() : readRumors()).slice(0, topN);
  if (!rumors.length) throw new Error('No hay rumores con probabilidad para generar el video');

  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));
  const suffix = useLive ? '_live' : '_top10';
  const intro = await renderHtmlToPngMp4(introHtml({ wm }), `rumores_${dateArg}${suffix}_intro`, 2.2);

  const parts = [intro.mp4];
  for (let i = 0; i < rumors.length; i++) {
    const r = rumors[i];
    const outBase = `rumor_top_${dateArg}_${String(i + 1).padStart(2, '0')}_${slug(r.player)}`;
    const card = await renderHtmlToPngMp4(await rumorCardHtml(r, i + 1), outBase, 3.6);
    parts.push(card.mp4);
  }

  const out = path.join(OUT_DIR, `rumores_${dateArg}${suffix}.mp4`);
  concat(parts, out);
  console.log('OK', out);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
}
