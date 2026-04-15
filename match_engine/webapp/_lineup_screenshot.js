/**
 * _lineup_screenshot.js
 * Generates a 1080×1920 PNG of the lineup card using Puppeteer + the actual web styles.
 * Called as a standalone script: node _lineup_screenshot.js <slug> <era> <outFile> [teamLabel]
 *
 * Can also be required: exports.screenshotLineup(slug, era, outFile, teamLabel?)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const __base      = __dirname;
const SQUADS_DIR  = path.join(__base, 'squads');
const FONTS_DIR   = path.join(__base, 'assets', 'fonts');
const PUBLIC_DIR  = path.join(__base, 'public');

// ── Jersey numbers & position sort (mirrors app.js) ──────────────────────────
const JERSEY_NUM = { GK:1, RB:2, CB:5, LB:3, DM:6, CM:8, RM:7, LM:11, AM:10, RW:7, LW:11, ST:9 };
const POS_SORT   = { GK:0, RB:1, CB:1, LB:1, DM:2, CM:3, RM:3, LM:3, AM:3.5, RW:4, LW:4, ST:4 };

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getLineup(slug, era) {
  try {
    const f = path.join(SQUADS_DIR, `${slug}.json`);
    if (!fs.existsSync(f)) return { formation:'4-4-2', players:[], name: slug };
    const d = JSON.parse(fs.readFileSync(f,'utf8'));
    const season = (d.seasons && d.seasons[era])
                || (d.seasons && d.seasons[String(parseInt(era)-1)])
                || null;
    if (!season) return { formation:'4-4-2', players:[], name: slug };
    const all    = [...season.players].sort((a,b) => b.rating - a.rating);
    const gk     = all.find(p => p.position === 'GK');
    const out    = all.filter(p => p.position !== 'GK').slice(0, 10);
    const lineup = gk ? [gk, ...out] : all.slice(0, 11);
    lineup.sort((a,b) => (POS_SORT[a.position]??3) - (POS_SORT[b.position]??3));
    return { formation: season.formation || '4-4-2', players: lineup.slice(0,11), name: slug };
  } catch(e) { return { formation:'4-4-2', players:[], name: slug }; }
}

function getKitColor(teamLabel) {
  // Hardcoded common kits — mirrors a subset of _TEAM_KIT_MAP from app.js
  const KIT = {
    'fc barcelona':'#a50044','barcelona':'#a50044',
    'real madrid':'#ffffff',
    'manchester united':'#da291c','man united':'#da291c',
    'manchester city':'#6cabdd',
    'liverpool':'#c8102e','fc liverpool':'#c8102e',
    'chelsea':'#034694',
    'arsenal':'#ef0107',
    'juventus':'#000000','juventus turin':'#000000',
    'ac milan':'#fb090b','ac mailand':'#fb090b',
    'inter milan':'#003399','inter mailand':'#003399',
    'fc barcelona':'#a50044',
    'atletico madrid':'#cb3524',
    'borussia dortmund':'#ffd700',
    'fc bayern münchen':'#dc052d','fc bayern munchen':'#dc052d','bayern':'#dc052d',
    'ajax':'#b51015','ajax amsterdam':'#b51015',
    'psg':'#004170','paris saint-germain':'#004170',
    'brazil':'#FFD700','brasil':'#FFD700',
    'argentina':'#74acdf',
    'france':'#003189',
    'germany':'#ffffff',
    'spain':'#c60b1e',
  };
  if (!teamLabel) return '#4488ff';
  const key = teamLabel.toLowerCase().replace(/\s+\d{4}(-\d{2,4})?$/, '').trim();
  return KIT[key] || KIT[key.replace(/\s+(fc|cf|ac|as|rc|sc|united|city|town|club)$/i,'').trim()] || '#4488ff';
}

// ── Build standalone HTML page ────────────────────────────────────────────────
function buildHtml(slug, era, teamLabel) {
  const { formation, players } = getLineup(slug, era);

  // Team display name
  let displayName = teamLabel || slug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const kitColor  = getKitColor(teamLabel || displayName);

  // Images as base64 data URIs (avoids file:// restrictions in Puppeteer setContent)
  const toDataUri = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    const buf  = fs.readFileSync(filePath);
    const ext  = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  };
  const badgeSrc = toDataUri(path.join(PUBLIC_DIR, 'img', 'badges', `${slug}.png`));
  const coinSrc  = toDataUri(path.join(PUBLIC_DIR, 'golazox-coin.png'));
  const wmSrc    = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));

  // Fonts as base64 data URIs
  const rajB64   = fs.readFileSync(path.join(FONTS_DIR, 'Rajdhani-Bold.ttf')).toString('base64');
  const bebasB64 = fs.readFileSync(path.join(FONTS_DIR, 'BebasNeue-Regular.ttf')).toString('base64');

  // Era display
  function displayEra(e) {
    if (!e || e === 'all-time') return '';
    const y = parseInt(e);
    if (!isNaN(y) && y > 1900) return `${y}-${String(y + 1).slice(-2)}`;
    return e;
  }
  const eraDisplay = displayEra(era);

  // Player rows
  const usedNums = new Set();
  const rowsHtml = players.map(p => {
    let num = JERSEY_NUM[p.position] ?? 1;
    while (usedNums.has(num)) num++;
    usedNums.add(num);

    const parts = p.name.trim().split(/\s+/);
    const last  = parts[parts.length - 1];
    const short = (last.length <= 3 && parts.length > 1)
      ? (parts[parts.length - 2] + ' ' + last).toUpperCase()
      : last.toUpperCase();

    const rating = p.rating;
    const tier   = rating >= 90 ? 'elite' : rating >= 82 ? 'gold' : rating >= 72 ? 'silver' : 'bronze';

    return `<div class="lk-jcard lk-jcard-${tier}" title="${escHtml(p.name)}">
      <span class="lk-jkit" style="background:${kitColor}"></span>
      <span class="lk-jovr">${rating}</span>
      <span class="lk-jnum">#${num}</span>
      <span class="lk-jname">${escHtml(short)}</span>
      <span class="lk-jpos">${escHtml(p.position)}</span>
    </div>`;
  }).join('\n');

  const headerHtml = `
    <div class="lk-header">
      <span class="lk-h-kit">Kit</span>
      <span class="lk-h-ovr">Media</span>
      <span class="lk-h-num">Dorsal</span>
      <span class="lk-h-name">Nombre</span>
      <span class="lk-h-pos">Pos</span>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080">
<style>
@font-face { font-family:'Rajdhani'; src:url('data:font/truetype;base64,${rajB64}'); font-weight:700; font-style:normal; }
@font-face { font-family:'BebasNeue'; src:url('data:font/truetype;base64,${bebasB64}'); font-weight:400; font-style:normal; }

*,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1080px; height:1920px; overflow:hidden; background:#0a0700; }

body {
  font-family:'Rajdhani',sans-serif;
  font-weight:700;
  color:rgba(255,255,255,.9);
  display:flex; flex-direction:column;
}

/* ── Accent top bar ───────────────────── */
.top-bar { width:100%; height:5px; background:${kitColor}; }

/* ── Team header block ────────────────── */
.team-header {
  display:flex; flex-direction:column; align-items:center;
  padding: 12px 0 0;
  gap:0;
}
.hdr-coin   { width:42px; height:auto; }
.hdr-wm     { width:210px; height:auto; margin-top:7px; }
.hdr-badge-wrap { position:relative; width:120px; height:116px; display:flex; align-items:center; justify-content:center; margin-top:10px; }
.hdr-glow {
  position:absolute; inset:-25px;
  border-radius:50%;
  background:radial-gradient(circle, ${kitColor}55 0%, transparent 70%);
  filter:blur(14px);
}
.hdr-badge  { width:100px; height:auto; position:relative; z-index:1; }
.hdr-name {
  font-family:'BebasNeue',sans-serif;
  font-size:64px; line-height:1;
  color:#fff; letter-spacing:.04em;
  text-shadow: 0 3px 14px rgba(0,0,0,.7);
  margin-top:6px; text-align:center;
  max-width:960px;
}
.hdr-era {
  font-family:'BebasNeue',sans-serif;
  font-size:38px; line-height:1;
  color:${kitColor};
  margin-top:3px;
  letter-spacing:.06em;
  padding: 1px 12px 3px;
  border: 1px solid ${kitColor}44;
  border-radius:4px;
  background: ${kitColor}18;
}
.hdr-formation {
  font-size:26px; font-weight:700;
  color:rgba(255,255,255,.45);
  margin-top:4px; letter-spacing:.12em;
}

/* ── Player list ──────────────────────── */
.player-list {
  margin: 8px 16px 0;
  display:flex; flex-direction:column; gap:0;
  flex: 1;
}

/* ── Column headers ──────────────────── */
.lk-header {
  display:flex; flex-direction:row; align-items:center;
  gap:.4rem; padding: 4px 14px 4px 12px;
  border-bottom:1px solid rgba(255,255,255,.08);
  margin-bottom:2px;
  border-left:3px solid transparent;
}
.lk-h-kit  { width:18px; flex-shrink:0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:rgba(255,255,255,.22); text-align:center; overflow:hidden; }
.lk-h-ovr  { width:52px; flex-shrink:0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:rgba(255,255,255,.22); text-align:center; overflow:hidden; }
.lk-h-num  { width:52px; flex-shrink:0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:rgba(255,255,255,.22); text-align:center; overflow:hidden; }
.lk-h-name { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:rgba(255,255,255,.22); flex:1; }
.lk-h-pos  { width:54px; flex-shrink:0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:rgba(255,255,255,.22); text-align:center; overflow:hidden; }

/* ── Player row ──────────────────────── */
.lk-jcard {
  display:flex; flex-direction:row; align-items:center;
  gap:.5rem;
  border-radius:4px;
  padding: 11px 14px 11px 12px;
  background:rgba(255,255,255,.025);
  border:1px solid rgba(255,255,255,.06);
  border-left:4px solid rgba(255,255,255,.1);
  width:100%;
  flex: 1;
}
.lk-jkit {
  width:18px; height:36px;
  border-radius:3px 3px 2px 2px; flex-shrink:0;
  border:1px solid rgba(255,255,255,.20);
  box-shadow: inset 0 -3px 0 rgba(0,0,0,.28);
}
.lk-jovr {
  font-family:'Rajdhani',monospace; font-size:28px; font-weight:900; line-height:1;
  color:rgba(255,255,255,.9);
  width:52px; flex-shrink:0; text-align:center;
  display:flex; align-items:center; justify-content:center;
}
.lk-jnum {
  font-size:20px; font-weight:700; color:rgba(255,255,255,.28);
  width:52px; flex-shrink:0; text-align:center;
  font-family:'Rajdhani',monospace;
}
.lk-jname {
  font-size:34px; color:rgba(255,255,255,.92); font-weight:700; flex:1;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  letter-spacing:.015em;
}
.lk-jpos {
  font-size:17px; font-weight:900; letter-spacing:.07em;
  color:rgba(255,255,255,.5); text-align:center; flex-shrink:0;
  width:54px; min-width:48px;
  background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.10);
  border-radius:3px;
  padding: 3px 4px;
}

/* Tier accents */
.lk-jcard-elite  { border-left-color:#39ff9f; background:rgba(57,255,159,.06); }
.lk-jcard-elite  .lk-jovr { color:#39ff9f; text-shadow:0 0 12px rgba(57,255,159,.6); }
.lk-jcard-elite  .lk-jpos { color:rgba(57,255,159,.80); border-color:rgba(57,255,159,.30); background:rgba(57,255,159,.10); }

.lk-jcard-gold   { border-left-color:#c8921a; background:rgba(200,146,26,.05); }
.lk-jcard-gold   .lk-jovr { color:#e8a820; text-shadow:0 0 10px rgba(245,184,39,.55); }
.lk-jcard-gold   .lk-jpos { color:rgba(218,165,32,.65); }

.lk-jcard-silver { border-left-color:#8899bb; background:rgba(136,153,187,.04); }
.lk-jcard-silver .lk-jovr { color:#9ab0cc; text-shadow:0 0 8px rgba(138,174,200,.4); }
.lk-jcard-silver .lk-jpos { color:rgba(160,176,210,.55); }

.lk-jcard-bronze { border-left-color:#8a5530; }
.lk-jcard-bronze .lk-jovr { color:#aa6832; }
.lk-jcard-bronze .lk-jpos { color:rgba(160,105,55,.6); }

/* ── Footer ──────────────────────────── */
.footer { padding: 14px 0 18px; text-align:center; font-size:24px; color:rgba(255,255,255,.10); letter-spacing:.06em; }
</style>
</head>
<body>
<div class="top-bar"></div>
<div class="team-header">
  ${coinSrc ? `<img class="hdr-coin" src="${coinSrc}" alt="">` : ''}
  ${wmSrc   ? `<img class="hdr-wm"   src="${wmSrc}"   alt="">` : ''}
  <div class="hdr-badge-wrap">
    <div class="hdr-glow"></div>
    ${badgeSrc ? `<img class="hdr-badge" src="${badgeSrc}" alt="">` : ''}
  </div>
  <div class="hdr-name">${escHtml(displayName.toUpperCase())}</div>
  ${eraDisplay ? `<div class="hdr-era">${escHtml(eraDisplay)}</div>` : ''}
  <div class="hdr-formation">${escHtml(formation)}</div>
</div>
<div class="player-list">
  ${headerHtml}
  ${rowsHtml}
</div>
<div class="footer">golazox.com</div>
</body>
</html>`;
}

// ── Main screenshot function ──────────────────────────────────────────────────
async function screenshotLineup(slug, era, outFile, teamLabel) {
  const puppeteer = require('puppeteer');
  const html = buildHtml(slug, era, teamLabel);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Wait for fonts to actually render
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: outFile, type: 'png' });
  } finally {
    await browser.close();
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const [,, slug, era, outFile, teamLabel] = process.argv;
  if (!slug || !era || !outFile) {
    console.error('Usage: node _lineup_screenshot.js <slug> <era> <outFile> [teamLabel]');
    process.exit(1);
  }
  screenshotLineup(slug, era, outFile, teamLabel).then(() => {
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { screenshotLineup };
