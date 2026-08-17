/**
 * _intro_screenshot.js
 * Generates a 1080×1920 PNG intro/badge-clash card using Puppeteer.
 * Called as: node _intro_screenshot.js <dataJsonFile> <outFile>
 *
 * dataJsonFile format:
 * {
 *   teamA, teamB, eraA, eraB,
 *   hookText,   // e.g. "¿HABRÁ REMONTADA?"
 *   matchDesc,  // e.g. "Ida: Atlético 2-0 FC Barcelona"  (optional)
 *   subLabel,   // e.g. "Metropolitano · Madrid · 21:00h" (optional)
 *   kitColorA,  // CSS colour for team A glow/accent (optional)
 *   kitColorB,  // CSS colour for team B glow/accent (optional)
 * }
 *
 * Can also be required: exports.screenshotIntro(data, outFile)
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

// Proper display names for German-slugged national teams and common edge cases
const SLUG_NAMES = {
  'frankreich': 'Francia', 'brasilien': 'Brasil', 'argentinien': 'Argentina',
  'deutschland': 'Alemania', 'england': 'Inglaterra', 'spanien': 'España',
  'italien': 'Italia', 'portugal': 'Portugal', 'niederlande': 'Países Bajos',
  'agypten': 'Egipto', 'kamerun': 'Camerún', 'marokko': 'Marruecos',
  'fc-paris-saint-germain': 'PSG', 'juventus-turin': 'Juventus',
  'fc-bayern-munchen': 'Bayern Múnich', 'ac-mailand': 'AC Milán',
  'inter-mailand': 'Inter de Milán', 'as-rom': 'AS Roma', 'lazio-rom': 'Lazio',
  'fc-liverpool': 'Liverpool', 'fc-arsenal': 'Arsenal', 'fc-chelsea': 'Chelsea',
  'fc-barcelona': 'Barcelona', 'real-madrid': 'Real Madrid',
  'atletico-madrid': 'Atlético', 'manchester-united': 'Man. United',
  'manchester-city': 'Man. City', 'borussia-dortmund': 'Dortmund',
  'ssc-neapel': 'Nápoles', 'ajax-amsterdam': 'Ajax',
  'celtic-glasgow': 'Celtic', 'glasgow-rangers': 'Rangers',
  'benfica-lissabon': 'Benfica', 'sporting-cp': 'Sporting CP',
  'club-atletico-boca-juniors': 'Boca Juniors',
  'club-atletico-river-plate': 'River Plate',
  'fluminense-rio-de-janeiro': 'Fluminense',
  'olympique-marseille': 'Marsella',
};
function slugToName(slug) {
  if (SLUG_NAMES[slug]) return SLUG_NAMES[slug];
  // Try squads-meta.json if available
  try {
    const metaPath = path.join(__base, 'squads-meta.json');
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
      const entry = meta[slug] || meta[slug.toLowerCase()];
      if (entry && entry.nameEs) return entry.nameEs;
    }
  } catch (_) {}
  return (slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function displayEra(era) {
  if (!era || era === 'all-time') return '';
  const y = parseInt(era);
  if (!isNaN(y) && y > 1900) return `${y}-${String(y + 1).slice(-2)}`;
  return era;
}

// Kit colour map matching the existing _lineup_screenshot.js
const KIT_MAP = {
  'fc barcelona': '#a50044', 'barcelona': '#a50044',
  'real madrid': '#ffffff',
  'manchester united': '#da291c', 'man united': '#da291c',
  'manchester city': '#6cabdd',
  'liverpool': '#c8102e',
  'chelsea': '#034694',
  'arsenal': '#ef0107',
  'juventus': '#000000',
  'ac milan': '#fb090b',
  'inter milan': '#003399',
  'atletico madrid': '#cb3524', 'atletico de madrid': '#cb3524',
  'borussia dortmund': '#ffd700',
  'fc bayern münchen': '#dc052d', 'bayern': '#dc052d',
  'ajax': '#b51015',
  'psg': '#004170', 'paris saint-germain': '#004170',
  'brazil': '#FFD700', 'brasil': '#FFD700',
  'argentina': '#74acdf',
  'france': '#003189',
  'germany': '#ffffff',
  'spain': '#c60b1e',
};

function getKitColor(slug, fallback) {
  if (fallback && fallback !== '#4488ff') return fallback;
  const key = slugToName(slug).toLowerCase();
  return KIT_MAP[key] || KIT_MAP[key.replace(/\s+(fc|cf|ac|as|rc|sc|united|city|town|club)$/i, '').trim()] || '#4488ff';
}

function buildHtml(data) {
  const {
    teamA, teamB,
    eraA = '', eraB = '',
    hookText = 'EL DEBATE DEFINITIVO',
    matchDesc = null,
    subLabel = null,
    competition = null,
    trophy = null,
    kitColorA: rawKA = null,
    kitColorB: rawKB = null,
  } = data;

  const nameA    = slugToName(teamA);
  const nameB    = slugToName(teamB);
  // When both eras belong to the same football season (consecutive years, e.g. 2011 + 2012),
  // show a single combined label "11/12" for both teams instead of two conflicting years.
  const [eraDispA, eraDispB] = (() => {
    const dA = displayEra(eraA);
    const dB = displayEra(eraB);
    const yA = parseInt(eraA), yB = parseInt(eraB);
    if (dA && dB && !isNaN(yA) && !isNaN(yB) && yA !== yB && Math.abs(yA - yB) === 1) {
      const start    = Math.min(yA, yB);
      const end      = Math.max(yA, yB);
      const combined = `${String(start).slice(-2)}/${String(end).slice(-2)}`;
      return [combined, combined];
    }
    return [dA, dB];
  })();
  const kA       = getKitColor(teamA, rawKA);
  const kB       = getKitColor(teamB, rawKB);

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
  const trophySrc = trophy ? toDataUri(path.join(PUBLIC_DIR, 'img', `trophy-${trophy}.png`)) : null;

  const rajB64   = fs.readFileSync(path.join(FONTS_DIR, 'Rajdhani-Bold.ttf')).toString('base64');
  const bebasB64 = fs.readFileSync(path.join(FONTS_DIR, 'BebasNeue-Regular.ttf')).toString('base64');

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
  font-family:'Rajdhani',sans-serif;
  font-weight:700;
  color:#fff;
}

/* ── Split background panels ───────────────────────────── */
.bg-left {
  position:absolute; left:0; top:0; width:540px; height:100%;
  background:linear-gradient(135deg,#1e0f00 0%,#241808 60%,#1a1200 100%);
  z-index:0;
}
.bg-right {
  position:absolute; right:0; top:0; width:540px; height:100%;
  background:linear-gradient(225deg,#000d20 0%,#071628 60%,#050c1a 100%);
  z-index:0;
}
/* Vertical center divider glow */
.bg-divider {
  position:absolute; left:50%; top:0; width:2px; height:100%;
  transform:translateX(-50%);
  background:linear-gradient(to bottom,transparent 0%,rgba(255,215,0,.18) 20%,rgba(255,215,0,.28) 50%,rgba(255,215,0,.18) 80%,transparent 100%);
  z-index:1;
}

/* ── Top accent bar ─────────────────────────────────────── */
.top-bar {
  width:100%; height:4px; flex-shrink:0;
  background:linear-gradient(90deg,${kA} 0%,#FFD700 50%,${kB} 100%);
  position:relative; z-index:2;
}

/* ── Header: coin + wordmark ────────────────────────────── */
.header {
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center;
  padding:22px 0 14px;
  gap:8px; flex-shrink:0;
}
.hdr-coin { width:44px; height:auto; }
.hdr-wm   { width:220px; height:auto; }

/* ── Teams row ──────────────────────────────────────────── */
.teams-row {
  position:relative; z-index:2;
  display:flex; flex-direction:row; align-items:flex-start;
  width:100%; flex-shrink:0;
  padding:0;
  margin-top:10px;
}

/* Individual team block */
.team {
  flex:1; display:flex; flex-direction:column; align-items:center;
  padding:0 16px;
}

/* Badge */
.badge-wrap {
  position:relative;
  width:240px; height:240px;
  display:flex; align-items:center; justify-content:center;
}
.badge-glow {
  position:absolute; inset:-30px;
  border-radius:50%;
  filter:blur(22px);
}
.glow-a { background:radial-gradient(circle,${kA}66 0%,transparent 70%); }
.glow-b { background:radial-gradient(circle,${kB}66 0%,transparent 70%); }
.badge {
  width:210px; height:auto;
  position:relative; z-index:1;
  filter:drop-shadow(0 6px 18px rgba(0,0,0,.6));
}

/* Team name */
.team-name {
  font-family:'BebasNeue',sans-serif;
  font-size:72px; line-height:1;
  text-align:center;
  letter-spacing:.03em;
  margin-top:12px;
  max-width:480px;
  text-shadow:0 3px 16px rgba(0,0,0,.75);
}
.team-a .team-name { color:#F0E4CB; }
.team-b .team-name { color:#D6ECFF; }

/* Era pill */
.era-pill {
  font-family:'BebasNeue',sans-serif;
  font-size:42px; line-height:1;
  margin-top:10px;
  padding:2px 18px 4px;
  border-radius:4px;
  letter-spacing:.06em;
}
.era-a {
  color:${kA};
  border:1px solid ${kA}55;
  background:${kA}22;
}
.era-b {
  color:${kB === '#ffffff' ? '#88aaff' : kB};
  border:1px solid ${kB === '#ffffff' ? '#88aaff55' : kB + '55'};
  background:${kB === '#ffffff' ? '#88aaff22' : kB + '22'};
}

/* VS block */
.vs-block {
  flex-shrink:0; width:120px;
  display:flex; align-items:center; justify-content:center;
  padding-top:80px;
}
.vs-text {
  font-family:'BebasNeue',sans-serif;
  font-size:100px; line-height:1;
  color:rgba(255,215,0,.18);
  text-shadow:0 0 30px rgba(255,215,0,.12);
  letter-spacing:.04em;
}

/* ── Center trophy ──────────────────────────────────────── */
.trophy-center {
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  flex:1;
  padding:10px 0 0;
}
.trophy-img {
  width:480px; height:auto;
  filter:
    drop-shadow(0 0 40px rgba(255,215,0,.55))
    drop-shadow(0 0 80px rgba(255,215,0,.25))
    drop-shadow(0 8px 24px rgba(0,0,0,.8));
}

/* ── Separator ──────────────────────────────────────────── */
.sep {
  width:84%; height:1px;
  background:linear-gradient(90deg,transparent 0%,rgba(255,215,0,.28) 20%,rgba(255,215,0,.48) 50%,rgba(255,215,0,.28) 80%,transparent 100%);
  flex-shrink:0;
  margin:0 auto;
}

/* ── Content block (hook + desc + subLabel) ─────────────── */
.content-block {
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center;
  width:100%; flex-shrink:0;
  padding:36px 40px 0;
  gap:0;
}

.hook-text {
  font-family:'BebasNeue',sans-serif;
  font-size:116px; line-height:1.05;
  color:#FFD700;
  text-align:center;
  letter-spacing:.02em;
  text-shadow:0 0 32px rgba(255,215,0,.35), 0 4px 12px rgba(0,0,0,.6);
  padding:0 8px;
}

.match-desc {
  font-family:'BebasNeue',sans-serif;
  font-size:62px; line-height:1;
  color:#FFB700;
  text-align:center;
  letter-spacing:.03em;
  margin-top:18px;
  opacity:.92;
  text-shadow:0 2px 8px rgba(0,0,0,.5);
}

.sub-label {
  font-family:'Rajdhani',sans-serif; font-weight:700;
  font-size:44px; line-height:1;
  color:rgba(200,200,200,.75);
  text-align:center;
  letter-spacing:.05em;
  text-transform:uppercase;
  margin-top:14px;
}

/* ── Competition label ──────────────────────────────────── */
.competition-block {
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center;
  width:100%; flex-shrink:0;
  padding:0 32px 0;
  gap:14px;
  margin-top:48px;
}
.competition-label {
  font-family:'BebasNeue',sans-serif;
  font-size:58px; line-height:1;
  color:rgba(255,255,255,.70);
  text-align:center;
  letter-spacing:.06em;
  text-shadow:0 2px 10px rgba(0,0,0,.5);
}
.competition-line {
  width:60%; height:1px;
  background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.18) 30%,rgba(255,255,255,.28) 50%,rgba(255,255,255,.18) 80%,transparent 100%);
}

/* ── Spacers ────────────────────────────────────────────── */
.spacer-top { flex:1; }
.spacer     { flex:1; }

/* ── Footer ─────────────────────────────────────────────── */
.footer {
  position:relative; z-index:2;
  padding:0 0 24px;
  font-family:'Rajdhani',sans-serif; font-size:28px;
  color:rgba(255,255,255,.10); letter-spacing:.06em;
  text-align:center; flex-shrink:0;
}
</style>
</head>
<body>

<div class="bg-left"></div>
<div class="bg-right"></div>
<div class="bg-divider"></div>

<div class="top-bar"></div>

<div class="header">
  ${coinSrc ? `<img class="hdr-coin" src="${coinSrc}" alt="">` : ''}
  ${wmSrc   ? `<img class="hdr-wm"   src="${wmSrc}"   alt="">` : ''}
</div>

<div class="teams-row">
  <div class="team team-a">
    <div class="badge-wrap">
      <div class="badge-glow glow-a"></div>
      ${badgeASrc ? `<img class="badge" src="${badgeASrc}" alt="">` : ''}
    </div>
    <div class="team-name">${escHtml(nameA.toUpperCase())}</div>
    ${eraDispA ? `<div class="era-pill era-a">${escHtml(eraDispA)}</div>` : ''}
  </div>

  <div class="vs-block">
    <span class="vs-text">VS</span>
  </div>

  <div class="team team-b">
    <div class="badge-wrap">
      <div class="badge-glow glow-b"></div>
      ${badgeBSrc ? `<img class="badge" src="${badgeBSrc}" alt="">` : ''}
    </div>
    <div class="team-name">${escHtml(nameB.toUpperCase())}</div>
    ${eraDispB ? `<div class="era-pill era-b">${escHtml(eraDispB)}</div>` : ''}
  </div>
</div>

<div style="margin-top:36px; width:100%; position:relative; z-index:2;">
  <div class="sep"></div>
</div>

${trophySrc ? `
<div class="trophy-center">
  <img class="trophy-img" src="${trophySrc}" alt="">
</div>
` : coinSrc ? `
<div class="trophy-center" style="padding-top:20px;padding-bottom:10px;">
  <img src="${coinSrc}" style="width:160px;height:160px;object-fit:contain;filter:drop-shadow(0 0 40px rgba(255,215,0,.5)) drop-shadow(0 0 80px rgba(255,215,0,.2));opacity:.9;" alt="">
</div>
` : '<div class="spacer-top"></div>'}

<div class="content-block">
  <div class="hook-text">${escHtml(hookText.toUpperCase())}</div>
  ${matchDesc ? `<div class="match-desc">${escHtml(matchDesc)}</div>` : ''}
  ${subLabel  ? `<div class="sub-label">${escHtml(subLabel)}</div>` : ''}
</div>

${competition ? (() => {
  // competition may be an array (contextLines) — show only the category label (first item)
  const compLabel = Array.isArray(competition)
    ? (competition[0] || '')
    : String(competition || '');
  return compLabel ? `
<div class="competition-block">
  <div class="competition-line"></div>
  <div class="competition-label">${escHtml(compLabel.toUpperCase())}</div>
  <div class="competition-line"></div>
</div>` : '';
})() : ''}

<div class="spacer"></div>

<div class="footer">golazox.com</div>

</body>
</html>`;
}

// ── Main screenshot function ──────────────────────────────────────────────────
async function screenshotIntro(data, outFile) {
  const puppeteer = require('puppeteer');
  const html = buildHtml(data);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: (() => {
      try {
        const pup = require('puppeteer');
        return pup.executablePath();
      } catch { return undefined; }
    })(),
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

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const [,, dataJsonFile, outFile] = process.argv;
  if (!dataJsonFile || !outFile) {
    console.error('Usage: node _intro_screenshot.js <dataJsonFile> <outFile>');
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataJsonFile, 'utf8'));
  } catch (e) {
    console.error('Failed to parse data JSON:', e.message);
    process.exit(1);
  }
  screenshotIntro(data, outFile).then(() => {
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { screenshotIntro };
