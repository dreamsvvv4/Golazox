/**
 * _fichajes_cerrados_diarios.js
 * Genera clips MP4 para los fichajes cerrados más destacados de una fecha.
 * Usage: node _fichajes_cerrados_diarios.js [YYYY-MM-DD] [N]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = __dirname;
const DB_FILE = path.join(BASE, 'data', 'transfers_db.json');
const OUT_DIR = path.join(BASE, 'videos');
const PUBLIC_DIR = path.join(BASE, 'public');

const BIG_CLUB_RE = /(real madrid|barcelona|atletico|athletic club|athletic bilbao|manchester city|manchester united|liverpool|arsenal|chelsea|tottenham|newcastle|bayern|dortmund|leverkusen|inter|ac milan|juventus|napoli|roma|psg|paris saint-germain|galatasaray|fenerbahce|benfica|porto|ajax|al-hilal|al-ahli|al-nassr|al-ittihad)/i;

const newsModule = require('./news');

function dateFor(ts) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function slug(s) {
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
}

function isBigClubTransfer(it) {
  const from = (it && it.from && it.from.name) ? String(it.from.name) : '';
  const to = (it && it.to && it.to.name) ? String(it.to.name) : '';
  return BIG_CLUB_RE.test(`${from} ${to}`);
}

function toDataUri(fp) {
  try { const buf = fs.readFileSync(fp); const ext = path.extname(fp).slice(1).toLowerCase(); const mime = ext==='svg'?'image/svg+xml':`image/${ext==='jpg'?'jpeg':ext}`; return `data:${mime};base64,${buf.toString('base64')}`; } catch { return null; }
}

async function badgeDataUri(badgePath) {
  try {
    if (!badgePath) return null;
    const m = String(badgePath).match(/\/(?:tmbadge)\/(\d+)/);
    const id = m ? m[1] : null;
    if (!id) return null;
    const fetch = require('node-fetch');
    const url = `https://tmssl.akamaized.net/images/wappen/head/${id}.png`;
    const r = await fetch(url, { headers: { Referer: 'https://www.transfermarkt.es/', 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const base = buf.toString('base64');
    return `data:image/png;base64,${base}`;
  } catch (e) { return null; }
}

async function buildHtml(item) {
  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));
  const fromBadge = await badgeDataUri(item.from && item.from.badge);
  const toBadge = await badgeDataUri(item.to && item.to.badge);
  const fee = item.fee && item.fee.label ? item.fee.label : '';
  const from = (item.from && item.from.name) || '';
  const to = (item.to && item.to.name) || '';
  const position = item.position || '';
  const age = item.age ? `· ${item.age} años` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>
    *{box-sizing:border-box}
    html,body{width:1080px;height:1920px;margin:0;padding:0;background:#070617;color:#fff;font-family:Rajdhani,Arial}
    .wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px}
    .player{font-family:Arial Black,Arial;font-size:110px;letter-spacing:-1px;text-align:center}
    .meta{margin-top:12px;font-size:40px;color:#cfe8ff}
    .clubs{margin-top:36px;display:flex;gap:120px;align-items:center;justify-content:center;width:100%}
    .team{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
    .team img{width:140px;height:140px;object-fit:contain;border-radius:14px}
    .team .name{font-size:44px;text-align:center}
    .arrow{font-size:72px;color:#ffd700}
    .fee{margin-top:30px;font-size:66px;color:#ffd700;font-weight:800}
    .footer{position:absolute;bottom:40px;font-size:20px;color:rgba(255,255,255,0.7)}
    .wm{position:absolute;top:40px;left:56px;width:320px;opacity:0.95}
  </style></head><body><div class="wrap">${wm?`<img class="wm" src="${wm}">`:''}<div class="player">${item.player}</div><div class="meta">${position}${age}</div><div class="clubs"><div class="team from">${fromBadge?`<img src="${fromBadge}">`:''}<div class="name">${from}</div></div><div class="arrow">→</div><div class="team to">${toBadge?`<img src="${toBadge}">`:''}<div class="name">${to}</div></div></div><div class="fee">${fee}</div><div class="footer">Más en golazox.com</div></div></body></html>`;
}

async function buildIntroHtml(dateArg, count) {
  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));
  const d = new Date(dateArg);
  const label = d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>
    html,body{width:1080px;height:1920px;margin:0;padding:0;background:#070617;color:#fff;font-family:Rajdhani,Arial}
    /* Asegurar que no haya rotaciones inesperadas */
    html,body,.box{transform:none;transform-origin:center center}
    .box{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center}
    .title{font-size:110px;font-weight:800;letter-spacing:1px;line-height:1}
    .subtitle{margin-top:18px;font-size:40px;color:#cfe8ff}
    .wm{width:360px;opacity:0.95;margin-bottom:40px}
  </style></head><body><div class="box">${wm?`<img class="wm" src="${wm}">`:''}<div class="title">Fichajes cerrados</div><div class="subtitle">${label} · Top ${count}</div></div></body></html>`;
}

async function renderIntro(dateArg, count, outBase) {
  const puppeteer = require('puppeteer');
  const ffmpeg = require('ffmpeg-static');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = await buildIntroHtml(dateArg, count);
  const png = path.join(OUT_DIR, `${outBase}.png`);
  const mp4 = path.join(OUT_DIR, `${outBase}.mp4`);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1080, height:1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: png, type: 'png' });
    if (!ffmpeg) { console.log('ffmpeg no disponible; PNG:', png); return; }
    const tmp = path.join(OUT_DIR, `${outBase}_seg.mp4`);
    const args = ['-y','-loop','1','-i',png,'-c:v','libx264','-t','2.8','-pix_fmt','yuv420p','-vf','scale=1080:1920', tmp];
    const r = spawnSync(ffmpeg, args, { stdio: 'inherit', timeout: 120000 });
    if (r.status !== 0) throw new Error('ffmpeg failed');
    fs.renameSync(tmp, mp4);
    try { fs.unlinkSync(png); } catch {}
    console.log('Created intro', mp4);
    return mp4;
  } finally { await browser.close(); }
}

async function renderItem(item, outBase) {
  const puppeteer = require('puppeteer');
  const ffmpeg = require('ffmpeg-static');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = await buildHtml(item);
  const png = path.join(OUT_DIR, `${outBase}.png`);
  const mp4 = path.join(OUT_DIR, `${outBase}.mp4`);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1080, height:1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: png, type: 'png' });
    if (!ffmpeg) { console.log('ffmpeg no disponible; PNG:', png); return; }
    const tmp = path.join(OUT_DIR, `${outBase}_seg.mp4`);
    const args = ['-y','-loop','1','-i',png,'-c:v','libx264','-t','4.0','-pix_fmt','yuv420p','-vf','scale=1080:1920', tmp];
    const r = spawnSync(ffmpeg, args, { stdio: 'inherit', timeout: 120000 });
    if (r.status !== 0) throw new Error('ffmpeg failed');
    fs.renameSync(tmp, mp4);
    try { fs.unlinkSync(png); } catch {}
    console.log('Created', mp4);
  } finally { await browser.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  const dateArg = args[0] || dateFor(Date.now());
  const topN = parseInt(args[1] || '6', 10) || 6;
  const onlyBigClubs = args.includes('--big-clubs');
  const pinIdx = args.indexOf('--pin-player');
  const pinPlayer = pinIdx >= 0 ? String(args[pinIdx + 1] || '').trim().toLowerCase() : '';
  if (!fs.existsSync(DB_FILE)) { console.error('DB file not found:', DB_FILE); process.exit(1); }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const items = (db.items || []).map(it => ({...it}));
  // Intent: prefer fichajes que Transfermarkt marca como "latest" (recién cerrados)
  const latestData = await newsModule.getTransfers().catch(() => null);
  const norm = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ').trim();
  const transferKey = (it) => `${norm(it.player)}|${norm(it.from && it.from.name)}|${norm(it.to && it.to.name)}`;
  const latestKeys = new Set();
  if (latestData && Array.isArray(latestData.latest)) {
    for (const t of latestData.latest) latestKeys.add(`${norm(t.player)}|${norm(t.from && t.from.name)}|${norm(t.to && t.to.name)}`);
  }

  const byDate = items.filter(it => dateFor(it.firstSeen) === dateArg);
  if (!byDate.length) { console.log('No hay fichajes para', dateArg); return; }
  byDate.sort((a,b) => (b.fee?.value||0) - (a.fee?.value||0));

  const pool = onlyBigClubs ? byDate.filter(isBigClubTransfer) : byDate;
  if (onlyBigClubs && !pool.length) {
    console.log(`No hay fichajes de equipos punteros para ${dateArg}.`);
    return;
  }

  // Preferir los que aparecen en 'latest' (cerrados). Si no hay, usar byDate como fallback.
  const closed = pool.filter(it => latestKeys.has(transferKey(it)));
  let selected = [];
  if (closed.length > 0) {
    selected = closed.slice(0, topN);
    if (selected.length < topN) {
      const remaining = pool.filter(it => !selected.includes(it)).slice(0, topN - selected.length);
      selected = selected.concat(remaining);
    }
    console.log(`Seleccionando ${selected.length} fichajes${onlyBigClubs ? ' de equipos punteros' : ''}; ${closed.length} coinciden con 'latest' (cerrados).`);
  } else {
    selected = pool.slice(0, topN);
    console.log(`Ningún fichaje${onlyBigClubs ? ' de equipos punteros' : ''} de la fecha aparece en 'latest'. Usando por 'firstSeen' como fallback.`);
  }

  // Prioriza un jugador concreto en el primer slot sin romper el tamaño final.
  if (pinPlayer) {
    const idx = selected.findIndex((it) => String(it.player || '').toLowerCase().includes(pinPlayer));
    if (idx > 0) {
      const [hit] = selected.splice(idx, 1);
      selected.unshift(hit);
      console.log(`Jugador fijado al #1: ${hit.player}`);
    } else if (idx === -1) {
      const extra = pool.find((it) => String(it.player || '').toLowerCase().includes(pinPlayer));
      if (extra) {
        selected.unshift(extra);
        selected = selected.slice(0, topN);
        console.log(`Jugador inyectado al #1: ${extra.player}`);
      }
    }
  }
  for (let i=0;i<selected.length;i++) {
    const it = selected[i];
    const slugName = slug(it.player + '-' + (it.to && it.to.name));
    const outBase = `fichaje_${dateArg}_${String(i+1).padStart(2,'0')}_${slugName}`;
    await renderItem(it, outBase);
    selected[i]._mp4 = path.join(OUT_DIR, `${outBase}.mp4`);
  }
  // Render intro and concatenate segments into single MP4
  const ffmpeg = require('ffmpeg-static');
  const suffix = onlyBigClubs ? '_bigclubs' : '';
  const introMp4 = await renderIntro(dateArg, selected.length, `fichajes_${dateArg}${suffix}_intro`).catch(()=>null);
  const segs = [introMp4].concat(selected.map((s) => s._mp4)).filter(Boolean);
  if (segs.length) {
    const listFile = path.join(OUT_DIR, `fichajes_${dateArg}${suffix}_list.txt`);
    const lines = segs.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFile, lines, 'utf8');
    const outAll = path.join(OUT_DIR, `fichajes_${dateArg}${suffix}.mp4`);
    const args = ['-y','-f','concat','-safe','0','-i',listFile,'-c','copy', outAll];
    const r = spawnSync(ffmpeg, args, { stdio: 'inherit', timeout: 120000 });
    if (r.status !== 0) { console.error('ffmpeg concat failed'); } else { console.log('Created', outAll); }
    try { fs.unlinkSync(listFile); } catch {};
  }
}

if (require.main === module) main().catch(e=>{ console.error(e); process.exit(1); });

module.exports = { main, renderIntro };
