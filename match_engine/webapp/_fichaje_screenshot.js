/**
 * _fichaje_screenshot.js
 * Genera un PNG y un MP4 corto destacando el fichaje más importante.
 * Usage: node _fichaje_screenshot.js
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = __dirname;
const OUT_DIR = path.join(BASE, 'videos');
const FONTS_DIR = path.join(BASE, 'assets', 'fonts');
const PUBLIC_DIR = path.join(BASE, 'public');

function loadFonts() {
  try {
    const raj = fs.readFileSync(path.join(FONTS_DIR, 'Rajdhani-Bold.ttf')).toString('base64');
    const bebas = fs.readFileSync(path.join(FONTS_DIR, 'BebasNeue-Regular.ttf')).toString('base64');
    return { raj, bebas };
  } catch { return {}; }
}

function toDataUri(fp) {
  try { const buf = fs.readFileSync(fp); const ext = path.extname(fp).slice(1).toLowerCase(); const mime = ext==='svg'?'image/svg+xml':`image/${ext==='jpg'?'jpeg':ext}`; return `data:${mime};base64,${buf.toString('base64')}`; } catch { return null; }
}

function buildHtml(item) {
  const fonts = loadFonts();
  const rajFace = fonts.raj ? `@font-face{font-family:Rajdhani;src:url(data:font/truetype;base64,${fonts.raj})}` : '';
  const bebasFace = fonts.bebas ? `@font-face{font-family:BebasNeue;src:url(data:font/truetype;base64,${fonts.bebas})}` : '';
  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));
  const fee = item.fee && item.fee.label ? item.fee.label : '';
  const from = (item.from && item.from.name) || '';
  const to = (item.to && item.to.name) || '';
  const position = item.position || '';
  const age = item.age ? `· ${item.age} años` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>${rajFace}${bebasFace}
    *{box-sizing:border-box}
    html,body{width:1080px;height:1920px;margin:0;padding:0;background:#070617;color:#fff;font-family:Rajdhani,Arial}
    .wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px}
    .player{font-family:BebasNeue,Arial;font-size:130px;letter-spacing:-2px;text-align:center}
    .meta{margin-top:20px;font-size:48px;color:#cfe8ff}
    .clubs{margin-top:36px;display:flex;gap:40px;align-items:center;font-size:56px}
    .arrow{font-size:72px;color:#ffd700}
    .fee{margin-top:36px;font-size:72px;color:#ffd700;font-weight:800}
    .footer{position:absolute;bottom:40px;font-size:24px;color:rgba(255,255,255,0.7)}
    .wm{position:absolute;top:40px;left:56px;width:360px;opacity:0.95}
  </style></head><body><div class="wrap">${wm?`<img class="wm" src="${wm}">`:''}<div class="player">${item.player}</div><div class="meta">${position}${age}</div><div class="clubs"><div class="from">${from}</div><div class="arrow">→</div><div class="to">${to}</div></div><div class="fee">${fee}</div><div class="footer">Más en golazox.com</div></div></body></html>`;
}

async function run() {
  const news = require('./news');
  const data = await news.getTransfers();
  const item = (data && data.top && data.top[0]) || (data && data.list && data.list[0]) || (data && data.latest && data.latest[0]) || null;
  if (!item) { console.error('No hay fichajes disponibles'); process.exit(1); }
  const html = buildHtml(item);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const pngOut = path.join(OUT_DIR, `fichaje_top.png`);
  const mp4Out = path.join(OUT_DIR, `fichaje_top.mp4`);

  const puppeteer = require('puppeteer');
  const ffmpeg = require('ffmpeg-static');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1080, height:1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: pngOut, type: 'png' });

    if (!ffmpeg) { console.log('ffmpeg-static no disponible; PNG creado en', pngOut); return; }
    const seg = path.join(OUT_DIR, `fichaje_seg.mp4`);
    const args = ['-y','-loop','1','-i',pngOut,'-c:v','libx264','-t','4.0','-pix_fmt','yuv420p','-vf','scale=1080:1920', seg];
    const r = spawnSync(ffmpeg, args, { stdio: 'inherit', timeout: 120000 });
    if (r.status !== 0) { console.error('ffmpeg falló'); process.exit(1); }
    // move segment to final
    fs.renameSync(seg, mp4Out);
    // cleanup png
    try { fs.unlinkSync(pngOut); } catch {}
    console.log('Created', mp4Out);
  } finally { await browser.close(); }
}

if (require.main === module) run().catch(e=>{ console.error(e); process.exit(1); });

module.exports = { run };
