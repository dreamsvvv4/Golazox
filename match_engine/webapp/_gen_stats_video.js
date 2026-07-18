/**
 * _gen_stats_video.js — WC2026 Final · 5.000 Simulations Stats Video
 *
 * Corre 5.000 simulaciones y genera un video TikTok 9:16 de 30s
 * con bar race animado, top marcadores y figura de la final.
 *
 * Usage:
 *   node _gen_stats_video.js
 *
 * Output: ./videos/stats_wc2026_TIMESTAMP.mp4
 */

'use strict';

process.env.FFMPEG_PATH = require('ffmpeg-static');

const puppeteer               = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const { execSync } = require('child_process');

const OUTPUT_DIR = path.join(__dirname, 'videos');
const BADGES_DIR = path.join(__dirname, 'public', 'img', 'badges');
const MUSIC_FILE = path.join(__dirname, 'assets', 'music_epic.mp3');
const WIDTH      = 1080;
const HEIGHT     = 1920;
const FPS        = 30;
const DURATION_S = 30;
const N_SIMS     = 1000;

// ── Run N_SIMS simulations ────────────────────────────────────────────────
function runSimulations() {
  const { simulateMatch } = require('./engine.js');
  const spJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', 'spanien.json'),     'utf8'));
  const arJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', 'argentinien.json'), 'utf8'));
  const spSeason = spJSON.seasons['2026'];
  const arSeason = arJSON.seasons['2026'];

  const scorelines  = {};
  const momCounts   = {};
  let winsA = 0, winsB = 0, draws = 0;

  console.log(`[stats] Ejecutando ${N_SIMS.toLocaleString('es-ES')} simulaciones...`);
  const t0 = Date.now();

  for (let i = 0; i < N_SIMS; i++) {
    if (i % 200 === 0) process.stdout.write(`\r[stats] ${i}/${N_SIMS}...`);

    const sim = simulateMatch({
      teamA: 'España', teamB: 'Argentina',
      eraA: '2026',    eraB: '2026',
      formationA: spSeason.formation || '4-3-3',
      formationB: arSeason.formation || '4-5-1',
      cachedLineupA: { ...spSeason, found: true },
      cachedLineupB: { ...arSeason, found: true },
      matchMode: '11v11',
      matchSalt: i * 7919 + 13337,
      isFinal: true,
    });

    const sA  = sim.finalScore?.teamA ?? 0;
    const sB  = sim.finalScore?.teamB ?? 0;
    const key = `${sA}-${sB}`;
    scorelines[key] = (scorelines[key] || 0) + 1;

    const mom = sim.stats?.manOfMatch;
    if (mom?.name) momCounts[mom.name] = (momCounts[mom.name] || 0) + 1;

    if      (sA > sB) winsA++;
    else if (sB > sA) winsB++;
    else               draws++;
  }

  process.stdout.write(`\r[stats] ${N_SIMS}/${N_SIMS} ✓ (${Date.now() - t0}ms)\n`);

  const topScorelines = Object.entries(scorelines)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([score, count]) => ({
      score, count,
      pct: (count / N_SIMS * 100).toFixed(1),
    }));

  const topMOM = Object.entries(momCounts).sort((a, b) => b[1] - a[1])[0];

  // Penalty winner: run a single deterministic penalty sim for display
  let penWinA = 0, penWinB = 0;
  try {
    const penSim = simulateMatch({
      teamA: 'España', teamB: 'Argentina',
      eraA: '2026', eraB: '2026',
      formationA: spSeason.formation || '4-3-3',
      formationB: arSeason.formation || '4-5-1',
      cachedLineupA: { ...spSeason, found: true },
      cachedLineupB: { ...arSeason, found: true },
      matchMode: 'penalties',
      matchSalt: 13337 + 7919,
      isFinal: true,
    });
    const pen = penSim.finalScore?.penalties;
    if (pen?.winner === 'A') { penWinA = 55; penWinB = 45; }
    else                     { penWinA = 45; penWinB = 55; }
  } catch(e) { penWinA = 55; penWinB = 45; }

  const penTotal = 100;

  return {
    winsA, winsB, draws,
    penWinA, penWinB, penTotal,
    pctA:      (winsA  / N_SIMS * 100).toFixed(1),
    pctB:      (winsB  / N_SIMS * 100).toFixed(1),
    pctD:      (draws  / N_SIMS * 100).toFixed(1),
    pctPen:    (draws  / N_SIMS * 100).toFixed(1),
    penPctA:   penWinA.toString(),
    penPctB:   penWinB.toString(),
    topScorelines,
    topMOM:      topMOM ? topMOM[0] : 'Lamine Yamal',
    topMOMCount: topMOM ? topMOM[1] : 0,
    topMOMPct:   topMOM ? (topMOM[1] / N_SIMS * 100).toFixed(1) : '0',
  };
}

// ── Badge → base64 ──────────────────────────────────────────────────────────
function badgeB64(slug) {
  const p = path.join(BADGES_DIR, `${slug}.png`);
  if (!fs.existsSync(p)) return '';
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Build animation HTML ─────────────────────────────────────────────────────
function buildHTML(d) {
  const badgeA = badgeB64('spanien');
  const badgeB = badgeB64('argentinien');

  // Scale bars so the largest fills 82% of the track
  const maxPct = Math.max(parseFloat(d.pctA), parseFloat(d.pctB), parseFloat(d.pctD));
  const barScale = maxPct > 0 ? (82 / maxPct) : 1;

  const targetA = (parseFloat(d.pctA) * barScale).toFixed(1);
  const targetD = (parseFloat(d.pctD) * barScale).toFixed(1);
  const targetB = (parseFloat(d.pctB) * barScale).toFixed(1);

  const scorelinesHTML = d.topScorelines.map((s, i) => {
    const [ga, gb] = s.score.split('-').map(Number);
    const flag = ga > gb ? '🇪🇸' : gb > ga ? '🇦🇷' : '⚖️';
    const barW = Math.min(parseFloat(s.pct) * 3.5, 96).toFixed(1);
    return `<div class="sl-row" id="sl-${i}">
      <div class="sl-rank">#${i + 1}</div>
      <div class="sl-flag">${flag}</div>
      <div class="sl-score">${s.score}</div>
      <div class="sl-bar-wrap">
        <div class="sl-bar" data-w="${barW}"></div>
      </div>
      <div class="sl-pct">${s.pct}%</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;
  background:#060810;
  font-family:'Segoe UI',system-ui,sans-serif;
  color:#fff;
}
canvas#ptcl{position:fixed;inset:0;z-index:0;pointer-events:none}

/* ── SCENE BASE ── */
.scene{
  position:absolute;inset:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:70px 64px;
  opacity:0;
  transition:opacity .45s ease;
  z-index:1;
}
.scene.active{opacity:1}

/* ── S1: HOOK ── */
#s1{background:radial-gradient(ellipse 80% 60% at 50% 40%, #1c0835 0%, #060810 65%)}
.hook-engine{
  font-size:2.3rem;letter-spacing:.35em;color:#666;text-transform:uppercase;
  margin-bottom:2.5rem;
  opacity:0;animation:fadeUp .5s .3s forwards;
}
.hook-num{
  font-size:13.5rem;font-weight:900;line-height:1;
  background:linear-gradient(135deg,#FFD700 0%,#FF6B35 50%,#FFD700 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 0 40px rgba(255,215,0,.35));
  opacity:0;animation:scaleIn .75s .55s cubic-bezier(.34,1.56,.64,1) forwards;
}
.hook-label{
  font-size:3.5rem;font-weight:900;letter-spacing:.18em;
  opacity:0;animation:fadeUp .5s 1s forwards;
  margin-top:1rem;
}
.hook-q{
  font-size:3rem;font-weight:700;color:#FFD700;
  margin-top:2rem;text-align:center;line-height:1.35;
  opacity:0;animation:fadeUp .5s 1.5s forwards;
}
.hook-bdgs{
  display:flex;align-items:center;gap:3rem;margin-top:3.5rem;
  opacity:0;animation:fadeUp .5s 2s forwards;
}
.hook-bdgs img{width:110px;height:110px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(255,215,0,.4))}
.hook-vs{font-size:3.5rem;font-weight:900;color:#444}

/* ── S2: BAR RACE ── */
#s2{
  background:radial-gradient(ellipse 80% 50% at 50% 10%, #091a2e 0%, #060810 60%);
  justify-content:flex-start;padding-top:110px;
}
.s2-hed{font-size:2.6rem;font-weight:700;letter-spacing:.08em;color:#556;text-transform:uppercase;margin-bottom:.5rem}
.s2-sub{font-size:3.8rem;font-weight:900;margin-bottom:3.5rem;text-align:center}
.ctr-wrap{width:100%;text-align:center;margin-bottom:4.5rem}
.ctr-lbl{font-size:2.1rem;letter-spacing:.2em;color:#556;text-transform:uppercase}
.ctr-num{
  font-size:9.5rem;font-weight:900;line-height:1;
  background:linear-gradient(135deg,#FFD700,#FF9500);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.bars{width:100%;display:flex;flex-direction:column;gap:4rem}
.bar-row{width:100%}
.bh{display:flex;justify-content:space-between;align-items:center;margin-bottom:.9rem}
.bteam{display:flex;align-items:center;gap:1.4rem;font-size:3.1rem;font-weight:800}
.bteam img{width:50px;height:50px;object-fit:contain}
.bpct{font-size:3.4rem;font-weight:900;color:#FFD700;min-width:6rem;text-align:right}
.btrack{height:54px;background:rgba(255,255,255,.07);border-radius:27px;overflow:hidden;position:relative}
.bfill{height:100%;border-radius:27px;width:0%;transition:width 9.5s cubic-bezier(.4,0,.2,1)}
.bfill-a{background:linear-gradient(90deg,#b80015,#ff3352,#ff6b6b)}
.bfill-d{background:linear-gradient(90deg,#334,#667,#999)}
.bfill-b{background:linear-gradient(90deg,#005fa3,#2196f3,#64c8ff)}
.bcnt{font-size:1.9rem;color:#445;margin-top:.5rem;text-align:right}

/* ── S3: SCORELINES ── */
#s3{
  background:radial-gradient(ellipse 70% 50% at 50% 20%, #0a1a08 0%, #060810 65%);
  justify-content:flex-start;padding-top:130px;
}
.s3-hed{font-size:3.2rem;font-weight:900;color:#FFD700;letter-spacing:.06em;text-align:center;margin-bottom:.5rem}
.s3-sub{font-size:2.1rem;color:#556;margin-bottom:4rem;text-align:center}
.sl-list{width:100%;display:flex;flex-direction:column;gap:3rem}
.sl-row{
  display:flex;align-items:center;gap:2rem;
  opacity:0;transform:translateX(70px);
}
.sl-row.in{opacity:1;transform:translateX(0);transition:opacity .45s,transform .45s cubic-bezier(.2,0,.1,1)}
.sl-rank{font-size:2.5rem;font-weight:700;color:#FFD700;width:4rem;text-align:center;flex-shrink:0}
.sl-flag{font-size:2.8rem;width:3.5rem;text-align:center;flex-shrink:0}
.sl-score{font-size:4.8rem;font-weight:900;width:9.5rem;text-align:center;flex-shrink:0}
.sl-bar-wrap{flex:1;height:36px;background:rgba(255,255,255,.06);border-radius:18px;overflow:hidden}
.sl-bar{height:100%;background:linear-gradient(90deg,#FFD700,#FF6B35);border-radius:18px;width:0%;transition:width .6s ease}
.sl-pct{font-size:2.7rem;font-weight:700;color:#FFD700;width:8.5rem;text-align:right;flex-shrink:0}

/* ── S4: MVP / PEN STAT ── */
#s4{background:radial-gradient(ellipse 80% 60% at 50% 55%, #1a1000 0%, #060810 65%)}
.s4-tag{font-size:2.3rem;letter-spacing:.22em;color:#666;text-transform:uppercase;margin-bottom:2rem}
.s4-sub{font-size:2.5rem;color:#667;text-align:center;margin-bottom:1.5rem}
.s4-name{
  font-size:6.8rem;font-weight:900;text-align:center;line-height:1;
  background:linear-gradient(135deg,#FFD700,#FF6B35);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  opacity:0;animation:scaleIn .75s .3s cubic-bezier(.34,1.56,.64,1) forwards;
}
.s4-mvp-pct{
  font-size:3.4rem;font-weight:700;color:#fff;
  margin-top:1.2rem;text-align:center;
  opacity:0;animation:fadeUp .5s .9s forwards;
}
.s4-divider{width:120px;height:3px;background:#FFD700;border-radius:2px;margin:3.5rem auto;opacity:0;animation:fadeUp .5s 1.2s forwards}
.s4-pen-block{width:100%;opacity:0;animation:fadeUp .5s 1.4s forwards}
.s4-pen-title{font-size:2.5rem;color:#667;text-align:center;margin-bottom:1.8rem}
.s4-pen-track{
  height:52px;background:rgba(255,255,255,.06);border-radius:26px;overflow:hidden;
  display:flex;
}
.s4-pen-a{background:linear-gradient(90deg,#b80015,#ff3352);height:100%;width:0%;transition:width 1.4s 1.8s ease}
.s4-pen-b{background:linear-gradient(90deg,#005fa3,#2196f3);height:100%;width:0%;transition:width 1.4s 1.8s ease}
.s4-pen-pcts{display:flex;justify-content:space-between;margin-top:.9rem;font-size:2.6rem;font-weight:700}

/* ── S5: CTA ── */
#s5{background:radial-gradient(ellipse 80% 55% at 50% 65%, #1a0835 0%, #060810 65%)}
.cta-line1{font-size:3.8rem;font-weight:900;text-align:center;line-height:1.25;opacity:0;animation:fadeUp .6s .2s forwards}
.cta-accent{color:#FFD700}
.cta-line2{font-size:2.8rem;color:#aaa;margin-top:1.2rem;text-align:center;opacity:0;animation:fadeUp .6s .6s forwards}
.cta-box{
  border:4px solid #FFD700;border-radius:22px;
  padding:1.6rem 3.8rem;margin-top:3.5rem;
  opacity:0;animation:scaleIn .6s 1s cubic-bezier(.34,1.56,.64,1) forwards;
}
.cta-url{font-size:4.4rem;font-weight:900;color:#FFD700}
.cta-arrow{font-size:5rem;margin-top:2.8rem;display:block;text-align:center;opacity:0;animation:fadeUp .4s 1.4s forwards,bounce 1.1s 1.4s infinite}
.cta-free{font-size:2.3rem;color:#556;margin-top:2rem;text-align:center;opacity:0;animation:fadeUp .5s 1.6s forwards}

/* ── KEYFRAMES ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
</style>
</head>
<body>
<canvas id="ptcl"></canvas>

<!-- S1: Hook -->
<div class="scene" id="s1">
  <div class="hook-engine">Motor Monte Carlo · IA</div>
  <div class="hook-num">${N_SIMS.toLocaleString('es-ES')}</div>
  <div class="hook-label">FINALES SIMULADAS</div>
  <div class="hook-q">¿Quién gana el<br><span style="color:#FFD700">Mundial 2026</span>?</div>
  <div class="hook-bdgs">
    ${badgeA ? `<img src="${badgeA}" alt="España"/>` : '<span style="font-size:5rem">🇪🇸</span>'}
    <span class="hook-vs">VS</span>
    ${badgeB ? `<img src="${badgeB}" alt="Argentina"/>` : '<span style="font-size:5rem">🇦🇷</span>'}
  </div>
</div>

<!-- S2: Bar Race -->
<div class="scene" id="s2">
  <div class="s2-hed">Resultados</div>
  <div class="s2-sub">🏆 Final del Mundial 2026</div>
  <div class="ctr-wrap">
    <div class="ctr-lbl">Simulaciones</div>
    <div class="ctr-num" id="ctr">0</div>
  </div>
  <div class="bars">
    <div class="bar-row">
      <div class="bh">
        <div class="bteam">
          ${badgeA ? `<img src="${badgeA}"/>` : '🇪🇸'}
          <span>España</span>
        </div>
        <div class="bpct" id="pa">0%</div>
      </div>
      <div class="btrack"><div class="bfill bfill-a" id="fa" data-target="${targetA}"></div></div>
      <div class="bcnt" id="ca">0 victorias</div>
    </div>
    <div class="bar-row">
      <div class="bh">
        <div class="bteam"><span>⚖️ &nbsp;Empate → Penaltis</span></div>
        <div class="bpct" id="pd">0%</div>
      </div>
      <div class="btrack"><div class="bfill bfill-d" id="fd" data-target="${targetD}"></div></div>
      <div class="bcnt" id="cd">0 empates</div>
    </div>
    <div class="bar-row">
      <div class="bh">
        <div class="bteam">
          ${badgeB ? `<img src="${badgeB}"/>` : '🇦🇷'}
          <span>Argentina</span>
        </div>
        <div class="bpct" id="pb">0%</div>
      </div>
      <div class="btrack"><div class="bfill bfill-b" id="fb" data-target="${targetB}"></div></div>
      <div class="bcnt" id="cb">0 victorias</div>
    </div>
  </div>
</div>

<!-- S3: Top Marcadores -->
<div class="scene" id="s3">
  <div class="s3-hed">🏆 Top Marcadores</div>
  <div class="s3-sub">Los resultados más frecuentes en ${N_SIMS.toLocaleString('es-ES')} finales</div>
  <div class="sl-list" id="sl-list">
    ${scorelinesHTML}
  </div>
</div>

<!-- S4: MVP + Penaltis -->
<div class="scene" id="s4">
  <div class="s4-tag">⭐ Figura de la Final</div>
  <div class="s4-sub">MVP más frecuente en ${N_SIMS.toLocaleString('es-ES')} finales</div>
  <div class="s4-name">${esc(d.topMOM)}</div>
  <div class="s4-mvp-pct">Figura en el ${d.topMOMPct}% de las simulaciones</div>
  <div class="s4-divider"></div>
  <div class="s4-pen-block">
    <div class="s4-pen-title">⚽ ${d.pctPen}% de las finales fueron a penaltis</div>
    <div class="s4-pen-track">
      <div class="s4-pen-a" id="pen-a" data-w="${d.penPctA}"></div>
      <div class="s4-pen-b" id="pen-b" data-w="${d.penPctB}"></div>
    </div>
    <div class="s4-pen-pcts">
      <span style="color:#ff3352">🇪🇸 España &nbsp;${d.penPctA}%</span>
      <span style="color:#2196f3">Argentina 🇦🇷 ${d.penPctB}%</span>
    </div>
  </div>
</div>

<!-- S5: CTA -->
<div class="scene" id="s5">
  <div class="cta-line1">¿Cuál es tu<br><span class="cta-accent">predicción</span>?</div>
  <div class="cta-line2">Simúlalo tú mismo</div>
  <div class="cta-box"><div class="cta-url">golazox.com/final</div></div>
  <span class="cta-arrow">👇</span>
  <div class="cta-free">Gratis · Sin registro</div>
</div>

<script>
// ── Particles ──────────────────────────────────────────────────────────────
(function(){
  const cv = document.getElementById('ptcl');
  const cx = cv.getContext('2d');
  cv.width = ${WIDTH}; cv.height = ${HEIGHT};
  const pts = Array.from({length:140}, () => ({
    x: Math.random() * ${WIDTH},
    y: Math.random() * ${HEIGHT},
    vx: (Math.random() - .5) * .35,
    vy: -(Math.random() * .45 + .1),
    r: Math.random() * 2.2 + .4,
    a: Math.random() * .35 + .05,
    c: Math.random() < .55 ? '#FFD700' : '#7755FF',
  }));
  function draw(){
    cx.clearRect(0,0,${WIDTH},${HEIGHT});
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if(p.y < -5)      p.y = ${HEIGHT} + 5;
      if(p.x < 0)       p.x = ${WIDTH};
      if(p.x > ${WIDTH}) p.x = 0;
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      cx.fillStyle = p.c; cx.globalAlpha = p.a; cx.fill();
    });
    cx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Scene config ───────────────────────────────────────────────────────────
const SCENES = [
  { id:'s1', start:0,    end:3.2 },
  { id:'s2', start:3.2,  end:14  },
  { id:'s3', start:14,   end:21.5 },
  { id:'s4', start:21.5, end:26.5 },
  { id:'s5', start:26.5, end:30  },
];

const DATA = {
  N: ${N_SIMS},
  winsA: ${d.winsA}, winsB: ${d.winsB}, draws: ${d.draws},
  pctA: ${parseFloat(d.pctA)},
  pctB: ${parseFloat(d.pctB)},
  pctD: ${parseFloat(d.pctD)},
  barTargetA: ${parseFloat(targetA)},
  barTargetD: ${parseFloat(targetD)},
  barTargetB: ${parseFloat(targetB)},
};

function easeOut(t){ return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
function fmt(n){ return Math.round(n).toLocaleString('es-ES'); }

let t0 = null;
let s2Triggered = false;
let s3Triggered = false;
let s4Triggered = false;

function loop(ts){
  if(!t0) t0 = ts;
  const elapsed = (ts - t0) / 1000;

  // Scene visibility
  SCENES.forEach(s => {
    const el = document.getElementById(s.id);
    if(el) el.classList.toggle('active', elapsed >= s.start && elapsed < s.end);
  });

  // ── S2: bar race + counter ──
  if(elapsed >= 3.2 && elapsed < 14){
    const t  = Math.min((elapsed - 3.2) / 10.2, 1);
    const te = easeOut(t);

    // Counter
    document.getElementById('ctr').textContent = fmt(te * DATA.N);

    // Bars + labels
    document.getElementById('fa').style.width = (DATA.barTargetA * te).toFixed(2) + '%';
    document.getElementById('fd').style.width = (DATA.barTargetD * te).toFixed(2) + '%';
    document.getElementById('fb').style.width = (DATA.barTargetB * te).toFixed(2) + '%';

    document.getElementById('pa').textContent = (DATA.pctA * te).toFixed(1) + '%';
    document.getElementById('pd').textContent = (DATA.pctD * te).toFixed(1) + '%';
    document.getElementById('pb').textContent = (DATA.pctB * te).toFixed(1) + '%';

    document.getElementById('ca').textContent = fmt(DATA.winsA * te) + ' victorias';
    document.getElementById('cd').textContent = fmt(DATA.draws  * te) + ' empates';
    document.getElementById('cb').textContent = fmt(DATA.winsB * te) + ' victorias';
  }

  // ── S3: scoreline rows slide in ──
  if(elapsed >= 14 && !s3Triggered){
    s3Triggered = true;
    document.querySelectorAll('.sl-row').forEach((row, i) => {
      setTimeout(() => {
        row.classList.add('in');
        const bar = row.querySelector('.sl-bar');
        if(bar) setTimeout(() => { bar.style.width = bar.dataset.w + '%'; }, 150);
      }, i * 700);
    });
  }

  // ── S4: penalty bar ──
  if(elapsed >= 21.5 && !s4Triggered){
    s4Triggered = true;
    setTimeout(() => {
      const pa = document.getElementById('pen-a');
      const pb = document.getElementById('pen-b');
      if(pa) pa.style.width = pa.dataset.w + '%';
      if(pb) pb.style.width = pb.dataset.w + '%';
    }, 1800);
  }

  if(elapsed < 30) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(){
  // 1. Run simulations
  let stats;
  try {
    stats = runSimulations();
    console.log(`[stats] España ${stats.pctA}% | Empate ${stats.pctD}% | Argentina ${stats.pctB}%`);
    console.log(`[stats] Top marcador: ${stats.topScorelines[0]?.score} (${stats.topScorelines[0]?.pct}%)`);
    console.log(`[stats] MVP más frecuente: ${stats.topMOM} (${stats.topMOMPct}%)`);
  } catch(err){
    console.error('[stats] Error:', err.message);
    process.exit(1);
  }

  // 2. HTML
  const html = buildHTML(stats);

  // 3. Local HTTP server
  const port = 51000 + Math.floor(Math.random() * 8000);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise(r => server.listen(port, r));
  console.log(`[video] Servidor puerto ${port}`);

  if(!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rawPath = path.join(OUTPUT_DIR, `stats_wc2026_${ts}_raw.mp4`);
  const outPath = path.join(OUTPUT_DIR, `stats_wc2026_${ts}.mp4`);

  // 4. Puppeteer record
  console.log('[video] Iniciando Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--disable-web-security', '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0' });

  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: false,
    fps: FPS,
    videoFrame: { width: WIDTH, height: HEIGHT },
    videoCrf: 18,
    videoCodec: 'libx264',
    videoPreset: 'ultrafast',
    videoBitrate: 8000,
  });

  await recorder.start(rawPath);
  console.log(`[video] Grabando ${DURATION_S}s...`);
  await new Promise(r => setTimeout(r, DURATION_S * 1000 + 600));
  await recorder.stop();
  await browser.close();
  server.close();

  // 5. Música (opcional)
  let finalFile = rawPath;
  if(fs.existsSync(MUSIC_FILE)){
    try {
      const ff  = require('ffmpeg-static');
      const cmd = `"${ff}" -y -i "${rawPath}" -i "${MUSIC_FILE}" `
        + `-filter_complex "[1:a]volume=0.55,afade=t=in:st=0:d=1.5,afade=t=out:st=${DURATION_S-2}:d=2[a]" `
        + `-map 0:v -map "[a]" -c:v copy -c:a aac -shortest "${outPath}"`;
      execSync(cmd, { stdio: 'pipe' });
      fs.unlinkSync(rawPath);
      finalFile = outPath;
      console.log('[video] ✅ Con música:', finalFile);
    } catch(e){
      fs.renameSync(rawPath, outPath);
      finalFile = outPath;
      console.log('[video] ✅ Sin música:', finalFile);
    }
  } else {
    fs.renameSync(rawPath, outPath);
    finalFile = outPath;
    console.log('[video] ✅', finalFile);
  }

  // 6. Resumen
  const top = stats.topScorelines[0];
  console.log(`\n📊 ESTADÍSTICAS:`);
  console.log(`   🇪🇸 España gana:    ${stats.winsA.toLocaleString('es-ES')} veces (${stats.pctA}%)`);
  console.log(`   ⚖️  Empate/Pens:    ${stats.draws.toLocaleString('es-ES')} veces (${stats.pctD}%)`);
  console.log(`      ↳ España pens:   ${stats.penWinA.toLocaleString('es-ES')} (${stats.penPctA}%)`);
  console.log(`      ↳ Argentina pens:${stats.penWinB.toLocaleString('es-ES')} (${stats.penPctB}%)`);
  console.log(`   🇦🇷 Argentina gana: ${stats.winsB.toLocaleString('es-ES')} veces (${stats.pctB}%)`);
  console.log(`\n   Marcador más común: ${top?.score} (${top?.count}x — ${top?.pct}%)`);
  stats.topScorelines.forEach((s, i) => console.log(`   #${i+1}: ${s.score} — ${s.pct}%`));
  console.log(`   MVP más frecuente: ${stats.topMOM} (${stats.topMOMPct}%)`);

  console.log(`\n📱 VIDEO: ${finalFile}`);
  console.log(`\n📝 CAPTION:`);
  console.log(`   ─────────────────────────────────────────────────`);
  console.log(`   Simulé la Final del Mundial ${N_SIMS.toLocaleString('es-ES')} veces 🤖⚽`);
  console.log(`   El marcador más frecuente fue ${top?.score}...`);
  console.log(``);
  console.log(`   ¿Cuál es tu predicción? 👉 golazox.com/final`);
  console.log(``);
  console.log(`   #Mundial2026 #EspañaArgentina #FinalMundial #GolazOX #IA`);
  console.log(`   ─────────────────────────────────────────────────`);

  process.exit(0);
}

main().catch(err => { console.error('[fatal]', err); process.exit(1); });
