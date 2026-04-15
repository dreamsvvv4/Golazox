/**
 * _subscribe_screenshot.js
 * Generates a 1080×1920 PNG subscribe/like CTA slide.
 * Called as: node _subscribe_screenshot.js <outFile> [channelUrl]
 *
 * Can also be required: exports.screenshotSubscribe(outFile, channelUrl?)
 */

'use strict';
const fs    = require('fs');
const path  = require('path');

const __base     = __dirname;
const FONTS_DIR  = path.join(__base, 'assets', 'fonts');
const PUBLIC_DIR = path.join(__base, 'public');

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildHtml(channelUrl) {
  const toDataUri = (fp) => {
    if (!fs.existsSync(fp)) return null;
    const buf  = fs.readFileSync(fp);
    const ext  = path.extname(fp).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  };

  const coinSrc = toDataUri(path.join(PUBLIC_DIR, 'golazox-coin.png'));
  const wmSrc   = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));

  const rajB64   = fs.readFileSync(path.join(FONTS_DIR, 'Rajdhani-Bold.ttf')).toString('base64');
  const bebasB64 = fs.readFileSync(path.join(FONTS_DIR, 'BebasNeue-Regular.ttf')).toString('base64');

  const url = channelUrl || 'golazox.com';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080">
<style>
@font-face { font-family:'Rajdhani';  src:url('data:font/truetype;base64,${rajB64}');   font-weight:700; font-style:normal; }
@font-face { font-family:'BebasNeue'; src:url('data:font/truetype;base64,${bebasB64}'); font-weight:400; font-style:normal; }

*,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1080px; height:1920px; overflow:hidden; background:#050609; }

body {
  display:flex; flex-direction:column;
  align-items:center;
  position:relative;
}

/* Background radial glow */
.bg-glow {
  position:absolute;
  top:50%; left:50%;
  transform:translate(-50%,-50%);
  width:900px; height:900px;
  border-radius:50%;
  background:radial-gradient(circle, rgba(255,215,0,.06) 0%, transparent 70%);
  filter:blur(40px);
  pointer-events:none;
}

/* Top accent */
.top-bar {
  width:100%; height:4px; flex-shrink:0;
  background:linear-gradient(90deg,transparent,#FFD700 50%,transparent);
}

/* Header */
.header {
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center;
  padding:40px 0 0; gap:10px; flex-shrink:0;
}
.hdr-coin { width:50px; height:auto; }
.hdr-wm   { width:240px; height:auto; }

/* Spacer top */
.spacer-top { flex:1; min-height:60px; }

/* Main CTA block */
.cta-block {
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center;
  width:100%; padding:0 60px;
  gap:0; flex-shrink:0;
}

/* Bell + "Si te gustó" */
.pre-label {
  font-family:'Rajdhani',sans-serif; font-weight:700;
  font-size:44px; color:rgba(255,255,255,.55);
  letter-spacing:.04em; text-align:center;
  line-height:1.1;
}

/* Big action line */
.big-action {
  font-family:'BebasNeue',sans-serif;
  font-size:120px; line-height:1;
  text-align:center; letter-spacing:.02em;
  color:#FFD700;
  text-shadow:0 0 40px rgba(255,215,0,.35), 0 4px 16px rgba(0,0,0,.7);
  margin-top:6px;
}

/* Separator */
.sep {
  width:70%; height:1px; margin:38px auto;
  background:linear-gradient(90deg,transparent,rgba(255,215,0,.35) 30%,rgba(255,215,0,.55) 50%,rgba(255,215,0,.35) 80%,transparent);
  flex-shrink:0; position:relative; z-index:2;
}

/* Middle text block */
.mid-block {
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center;
  width:100%; padding:0 56px;
  gap:14px; flex-shrink:0;
}

.simulate-label {
  font-family:'Rajdhani',sans-serif; font-weight:700;
  font-size:42px; color:rgba(255,255,255,.60);
  text-align:center; letter-spacing:.03em; line-height:1.4;
}

.simulate-label span {
  display:block;
  font-family:'BebasNeue',sans-serif;
  font-size:110px; line-height:1;
  color:#FFD700;
  text-shadow:0 0 30px rgba(255,215,0,.45);
  letter-spacing:.01em;
}

/* URL block */
.url-wrap { display:none; }

/* Spacer */
.spacer { flex:1; }

/* Action pills row */
.pills-row {
  position:relative; z-index:2;
  display:flex; flex-direction:row; align-items:center; justify-content:center;
  gap:28px; flex-shrink:0;
  padding:0 40px 60px;
}
.pill {
  display:flex; flex-direction:column; align-items:center;
  gap:6px;
}
.pill-icon {
  width:110px; height:110px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:52px; line-height:1;
  border:2px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.05);
}
.pill-icon-like   { background:rgba(255,50,50,.12); border-color:rgba(255,80,80,.3); }
.pill-icon-sub    { background:rgba(255,0,0,.15);   border-color:rgba(255,0,0,.4); }
.pill-icon-share  { background:rgba(255,215,0,.10); border-color:rgba(255,215,0,.30); }
.pill-label {
  font-family:'Rajdhani',sans-serif; font-size:30px; font-weight:700;
  color:rgba(255,255,255,.50); letter-spacing:.04em; text-align:center;
}

/* Bottom bar */
.bottom-bar {
  width:100%; height:4px; flex-shrink:0;
  background:linear-gradient(90deg,transparent,#FFD700 50%,transparent);
}
/* ── App description */
.app-desc {
  position:relative; z-index:2;
  padding:22px 48px 0;
  text-align:center; flex-shrink:0;
}
.app-desc-tags {
  font-family:'Rajdhani',sans-serif; font-weight:700;
  font-size:30px; line-height:1.6;
  color:rgba(255,255,255,.30);
  letter-spacing:.06em;
  text-transform:uppercase;
}
.app-desc-tags span {
  color:rgba(255,215,0,.45);
  margin:0 4px;
}</style>
</head>
<body>

<div class="bg-glow"></div>
<div class="top-bar"></div>

<div class="header">
  ${coinSrc ? `<img class="hdr-coin" src="${coinSrc}" alt="">` : ''}
  ${wmSrc   ? `<img class="hdr-wm"   src="${wmSrc}"   alt="">` : ''}
</div>

<div class="spacer-top"></div>

<div class="cta-block">
  <div class="pre-label">¿Te ha gustado la simulación?</div>
  <div class="big-action">¡LIKE Y SUSCRÍBETE!</div>
</div>

<div class="sep"></div>

<div class="mid-block">
  <div class="simulate-label">
    Simúlalo tú mismo gratis en<br>
    <span>golazox.com</span>
  </div>
</div>

<div class="spacer"></div>

<div class="pills-row">
  <div class="pill">
    <div class="pill-icon pill-icon-like">👍</div>
    <div class="pill-label">DAR LIKE</div>
  </div>
  <div class="pill">
    <div class="pill-icon pill-icon-sub">🔔</div>
    <div class="pill-label">SUSCRÍBETE</div>
  </div>
  <div class="pill">
    <div class="pill-icon pill-icon-share">📤</div>
    <div class="pill-label">COMPARTIR</div>
  </div>
</div>

<div class="app-desc">
  <div class="app-desc-tags">
    Simulador de fútbol<span>·</span>Cualquier era<span>·</span>Cualquier partido<br>
    Torneos<span>·</span>Tandas de penaltis<span>·</span>100% gratis
  </div>
</div>

<div class="bottom-bar"></div>

</body>
</html>`;
}

async function screenshotSubscribe(outFile, channelUrl) {
  const puppeteer = require('puppeteer');
  const html = buildHtml(channelUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

if (require.main === module) {
  const [,, outFile, channelUrl] = process.argv;
  if (!outFile) { console.error('Usage: node _subscribe_screenshot.js <outFile> [channelUrl]'); process.exit(1); }
  screenshotSubscribe(outFile, channelUrl).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { screenshotSubscribe };
