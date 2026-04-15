/**
 * _outro_screenshot.js
 * Generates a 1080×1920 PNG outro card: score + scorers + stats + CTA.
 * Called as: node _outro_screenshot.js <outFile> <dataJsonFile>
 *
 * dataJsonFile format:
 * {
 *   teamA, teamB, eraA, eraB,
 *   scoreA, scoreB,
 *   scorersA: [{name, minute}],
 *   scorersB: [{name, minute}],
 *   stats: { possession:{teamA,teamB}, shots:{teamA,teamB}, corners:{teamA,teamB} }
 * }
 *
 * Can also be required: exports.screenshotOutro(data, outFile)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const __base    = __dirname;
const FONTS_DIR = path.join(__base, 'assets', 'fonts');
const PUBLIC_DIR = path.join(__base, 'public');

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function slugToName(slug) {
  return (slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function displayEra(era) {
  if (!era || era === 'all-time') return '';
  const y = parseInt(era);
  if (!isNaN(y) && y > 1900) return `${y}-${String(y + 1).slice(-2)}`;
  return era;
}

function buildHtml(data) {
  const {
    teamA, teamB, eraA, eraB,
    scoreA = 0, scoreB = 0,
    scorersA = [], scorersB = [],
    stats = {},
  } = data;

  const nameA    = slugToName(teamA);
  const nameB    = slugToName(teamB);
  const eraDispA = displayEra(eraA);
  const eraDispB = displayEra(eraB);

  const toDataUri = (fp) => {
    if (!fs.existsSync(fp)) return null;
    const buf  = fs.readFileSync(fp);
    const ext  = path.extname(fp).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  };

  const badgeASrc = toDataUri(path.join(PUBLIC_DIR, 'img', 'badges', `${teamA}.png`));
  const badgeBSrc = toDataUri(path.join(PUBLIC_DIR, 'img', 'badges', `${teamB}.png`));
  const coinSrc   = toDataUri(path.join(PUBLIC_DIR, 'golazox-coin.png'));
  const wmSrc     = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));

  const rajB64   = fs.readFileSync(path.join(FONTS_DIR, 'Rajdhani-Bold.ttf')).toString('base64');
  const bebasB64 = fs.readFileSync(path.join(FONTS_DIR, 'BebasNeue-Regular.ttf')).toString('base64');

  // ── Scorer rows ────────────────────────────────────────────────────────────
  const maxRows = Math.max(scorersA.length, scorersB.length);
  const scorerRowsHtml = maxRows === 0
    ? '<div class="sc-empty">—</div>'
    : Array.from({ length: maxRows }, (_, i) => {
        const sA = scorersA[i];
        const sB = scorersB[i];
        return `<div class="scorer-row">
      <div class="sc-a">${sA ? `<span class="sc-ball">⚽</span><span class="sc-nm">${escHtml(sA.name)}</span><span class="sc-mn">${sA.minute}'</span>` : ''}</div>
      <div class="sc-b">${sB ? `<span class="sc-mn">${sB.minute}'</span><span class="sc-nm">${escHtml(sB.name)}</span><span class="sc-ball">⚽</span>` : ''}</div>
    </div>`;
      }).join('\n');

  // ── Stat rows ──────────────────────────────────────────────────────────────
  const poss  = stats.possession || { teamA: 50, teamB: 50 };
  const shots = stats.shots      || null;
  const cors  = stats.corners    || null;

  const mkStatRow = (label, vA, vB, suffix = '') => {
    const tA = vA || 0, tB = vB || 0;
    const total = (tA + tB) || 1;
    const pctA = Math.round(tA / total * 100);
    const pctB = 100 - pctA;
    const winA = tA >= tB;
    const winB = tB > tA;
    return `<div class="stat-row">
      <div class="stv stv-a${winA ? ' stv-win' : ''}">${tA}${suffix}</div>
      <div class="st-track st-track-a"><div class="st-fill-a" style="width:${pctA}%"></div></div>
      <div class="st-label">${escHtml(label)}</div>
      <div class="st-track st-track-b"><div class="st-fill-b" style="width:${pctB}%"></div></div>
      <div class="stv stv-b${winB ? ' stv-win' : ''}">${tB}${suffix}</div>
    </div>`;
  };

  const statsHtml = [
    mkStatRow('POSESIÓN', poss.teamA, poss.teamB, '%'),
    shots ? mkStatRow('TIROS', shots.teamA, shots.teamB) : '',
    cors  ? mkStatRow('CÓRNERS', cors.teamA, cors.teamB) : '',
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080">
<style>
@font-face { font-family:'Rajdhani'; src:url('data:font/truetype;base64,${rajB64}'); font-weight:700; font-style:normal; }
@font-face { font-family:'BebasNeue'; src:url('data:font/truetype;base64,${bebasB64}'); font-weight:400; font-style:normal; }

*,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1080px; height:1920px; overflow:hidden; }
body {
  font-family:'Rajdhani',sans-serif; font-weight:700;
  background:#080a14; color:#fff;
  display:flex; flex-direction:column;
}

/* ── Top accent bar ──────────────────────────────────────────── */
.top-bar {
  width:100%; height:6px;
  background:linear-gradient(90deg,#c8921a 0%,#FFD700 50%,#c8921a 100%);
  flex-shrink:0;
}

/* ── Header: coin + wordmark ─────────────────────────────────── */
.header {
  display:flex; flex-direction:column; align-items:center;
  padding:22px 0 10px; gap:6px; flex-shrink:0;
}
.hdr-coin { width:48px; height:auto; }
.hdr-wm   { width:250px; height:auto; }

/* ── "RESULTADO FINAL" label ─────────────────────────────────── */
.res-label {
  font-family:'BebasNeue',sans-serif;
  font-size:40px; letter-spacing:.10em; color:#FFD700;
  text-align:center; padding:10px 0 6px;
  text-shadow:0 0 20px rgba(255,215,0,.35);
  flex-shrink:0;
}

/* ── Score block ─────────────────────────────────────────────── */
.score-block {
  display:flex; flex-direction:row; align-items:center;
  justify-content:space-between; padding:0 24px;
  gap:8px; flex-shrink:0;
}
.sb-team {
  display:flex; flex-direction:column; align-items:center;
  flex:1; gap:6px;
}
.sb-badge-wrap {
  position:relative; width:120px; height:116px;
  display:flex; align-items:center; justify-content:center;
}
.sb-glow {
  position:absolute; inset:-18px; border-radius:50%;
  background:radial-gradient(circle, rgba(255,215,0,.10) 0%, transparent 70%);
  filter:blur(10px);
}
.sb-badge { width:100px; height:auto; position:relative; z-index:1; }
.sb-name {
  font-family:'BebasNeue',sans-serif;
  font-size:48px; line-height:1.05; letter-spacing:.03em;
  color:#fff; text-align:center; max-width:260px;
  text-shadow:0 2px 10px rgba(0,0,0,.6);
}
.sb-era {
  font-family:'BebasNeue',sans-serif;
  font-size:30px; color:#FFD700; letter-spacing:.06em;
  padding:1px 10px 2px;
  border:1px solid rgba(255,215,0,.30);
  border-radius:4px; background:rgba(255,215,0,.08);
}
.sb-center {
  display:flex; flex-direction:column; align-items:center;
  flex-shrink:0; gap:0;
}
.sb-score-row {
  display:flex; flex-direction:row; align-items:center; gap:0;
}
.sb-score {
  font-family:'BebasNeue',sans-serif;
  font-size:170px; line-height:1;
  color:#fff; text-align:center;
  text-shadow:0 4px 24px rgba(0,0,0,.7);
  padding:0 6px;
}
.sb-dash {
  font-family:'BebasNeue',sans-serif;
  font-size:80px; color:rgba(255,255,255,.18);
  padding:0 2px; align-self:center;
}

/* ── Separator ───────────────────────────────────────────────── */
.sep {
  width:84%; height:1px;
  background:linear-gradient(90deg,transparent 0%,rgba(255,215,0,.28) 20%,rgba(255,215,0,.48) 50%,rgba(255,215,0,.28) 80%,transparent 100%);
  margin:10px auto; flex-shrink:0;
}

/* ── Section title ───────────────────────────────────────────── */
.sec-title {
  font-family:'BebasNeue',sans-serif;
  font-size:32px; letter-spacing:.14em;
  color:rgba(255,215,0,.55); text-align:center;
  padding:6px 0 6px; flex-shrink:0;
}

/* ── Scorers ─────────────────────────────────────────────────── */
.scorers-section { padding:0 28px; flex-shrink:0; }
.scorer-row {
  display:flex; flex-direction:row;
  padding:4px 0;
}
.sc-a, .sc-b {
  flex:1; display:flex; align-items:center; gap:7px;
  font-size:32px; font-family:'Rajdhani',sans-serif;
}
.sc-a { justify-content:flex-start; }
.sc-b { justify-content:flex-end; }
.sc-ball { font-size:24px; flex-shrink:0; line-height:1; }
.sc-nm   { color:rgba(255,255,255,.9); font-weight:700; letter-spacing:.01em; }
.sc-mn   { color:rgba(255,215,0,.60); font-size:24px; flex-shrink:0; }
.sc-empty { text-align:center; color:rgba(255,255,255,.2); font-size:28px; padding:8px 0; }

/* ── Stats ───────────────────────────────────────────────────── */
.stats-section { padding:0 28px; flex-shrink:0; }
.stat-row {
  display:flex; flex-direction:row; align-items:center;
  padding:9px 0; gap:8px;
}
.stv {
  width:74px; flex-shrink:0;
  font-family:'Rajdhani',sans-serif; font-size:30px;
  color:rgba(255,255,255,.45);
}
.stv-a   { text-align:right; }
.stv-b   { text-align:left; }
.stv-win { color:#FFD700; text-shadow:0 0 10px rgba(255,215,0,.35); }
.st-track {
  flex:1; height:12px; border-radius:6px;
  background:rgba(255,255,255,.07); overflow:hidden;
}
.st-track-a { display:flex; justify-content:flex-end; border-radius:6px 0 0 6px; }
.st-track-b { display:flex; justify-content:flex-start; border-radius:0 6px 6px 0; }
.st-fill-a {
  height:100%; background:linear-gradient(to left,#FFD700,#c8921a);
  border-radius:6px 0 0 6px;
}
.st-fill-b {
  height:100%; background:rgba(255,255,255,.28);
  border-radius:0 6px 6px 0;
}
.st-label {
  width:120px; flex-shrink:0; text-align:center;
  font-family:'BebasNeue',sans-serif; font-size:24px;
  color:rgba(255,255,255,.32); letter-spacing:.06em;
}

/* ── CTA ─────────────────────────────────────────────────────── */
.cta-section {
  flex:1; display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  padding:0 32px 28px; gap:8px;
}
.cta-q {
  font-family:'BebasNeue',sans-serif;
  font-size:60px; letter-spacing:.03em;
  color:#fff; text-align:center; line-height:1.05;
  text-shadow:0 2px 12px rgba(0,0,0,.5);
}
.cta-url {
  font-family:'BebasNeue',sans-serif;
  font-size:118px; color:#FFD700; line-height:1;
  text-shadow:0 0 28px rgba(255,215,0,.40);
  letter-spacing:.005em;
}
.cta-follow {
  font-family:'Rajdhani',sans-serif; font-size:34px;
  color:rgba(255,255,255,.30); text-align:center;
  letter-spacing:.05em;
}
</style>
</head>
<body>

<div class="top-bar"></div>

<div class="header">
  ${coinSrc ? `<img class="hdr-coin" src="${coinSrc}" alt="">` : ''}
  ${wmSrc   ? `<img class="hdr-wm"   src="${wmSrc}"   alt="">` : ''}
</div>

<div class="res-label">RESULTADO FINAL</div>

<div class="score-block">
  <div class="sb-team">
    <div class="sb-badge-wrap">
      <div class="sb-glow"></div>
      ${badgeASrc ? `<img class="sb-badge" src="${badgeASrc}" alt="">` : ''}
    </div>
    <div class="sb-name">${escHtml(nameA.toUpperCase())}</div>
    ${eraDispA ? `<div class="sb-era">${escHtml(eraDispA)}</div>` : ''}
  </div>
  <div class="sb-center">
    <div class="sb-score-row">
      <div class="sb-score">${scoreA}</div>
      <div class="sb-dash">–</div>
      <div class="sb-score">${scoreB}</div>
    </div>
  </div>
  <div class="sb-team">
    <div class="sb-badge-wrap">
      <div class="sb-glow"></div>
      ${badgeBSrc ? `<img class="sb-badge" src="${badgeBSrc}" alt="">` : ''}
    </div>
    <div class="sb-name">${escHtml(nameB.toUpperCase())}</div>
    ${eraDispB ? `<div class="sb-era">${escHtml(eraDispB)}</div>` : ''}
  </div>
</div>

<div class="sep"></div>
<div class="sec-title">G O L E A D O R E S</div>
<div class="scorers-section">
  ${scorerRowsHtml}
</div>

<div class="sep"></div>
<div class="sec-title">E S T A D Í S T I C A S</div>
<div class="stats-section">
  ${statsHtml}
</div>

<div class="sep"></div>

<div class="cta-section">
  <div class="cta-q">¿QUIÉN SERÁ EL PRÓXIMO?</div>
  <div class="cta-url">golazox.com</div>
  <div class="cta-follow">SÍGUENOS PARA NO PERDERTE NINGUNO</div>
</div>

</body>
</html>`;
}

// ── Main screenshot function ──────────────────────────────────────────────────
async function screenshotOutro(data, outFile) {
  const puppeteer = require('puppeteer');
  const html = buildHtml(data);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: outFile, type: 'png' });
  } finally {
    await browser.close();
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const [,, outFile, dataFile] = process.argv;
  if (!outFile || !dataFile) {
    console.error('Usage: node _outro_screenshot.js <outFile> <dataJsonFile>');
    process.exit(1);
  }
  let data;
  try { data = JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
  catch (e) { console.error('Failed to parse data file:', e.message); process.exit(1); }

  screenshotOutro(data, outFile).then(() => {
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { screenshotOutro };
