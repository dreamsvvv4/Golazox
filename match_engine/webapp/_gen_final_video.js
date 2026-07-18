/**
 * _gen_final_video.js — WC2026 Final · TikTok Video Cinematic Generator
 *
 * Genera un video 9:16 de 26s con 6 escenas dramáticas para TikTok/Reels.
 * Usa Puppeteer para grabar una animación HTML local + FFmpeg para música.
 *
 * Usage:
 *   node _gen_final_video.js
 *   node _gen_final_video.js --lang en     (English version)
 *   node _gen_final_video.js --lang pt     (Portuguese version)
 *
 * Output: ./videos/final_YYYYMMDD_HHmmss.mp4
 *
 * Requirements (already in package.json):
 *   puppeteer, puppeteer-screen-recorder, ffmpeg-static, node-fetch
 *
 * Optional: drop assets/music_epic.mp3 for background music
 */

'use strict';

process.env.FFMPEG_PATH = require('ffmpeg-static');

const puppeteer               = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const { execSync } = require('child_process');

// ── Config ─────────────────────────────────────────────────────────────────
const OUTPUT_DIR  = path.join(__dirname, 'videos');
const ASSETS_DIR  = path.join(__dirname, 'assets');
const BADGES_DIR  = path.join(__dirname, 'public', 'img', 'badges');
const MUSIC_FILE  = path.join(ASSETS_DIR, 'music_epic.mp3');
const WIDTH  = 1080;
const HEIGHT = 1920;
const FPS    = 30;
const DURATION_S = 26;   // total video length in seconds

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const langArg = args[args.indexOf('--lang') + 1] || 'es';

// ── i18n ───────────────────────────────────────────────────────────────────
const I18N = {
  es: {
    hook1: 'La <span class="accent">IA</span> ha simulado',
    hook2: 'la Final del',
    hook3: '<span class="accent">Mundial 2026</span>',
    finalTag: '🏆 Final Copa del Mundo 2026',
    simulTag: 'Motor Monte Carlo · IA',
    counterLabel: 'Partidos simulados',
    counterSub: 'en tiempo real',
    probsTitle: 'En 1.000 simulaciones',
    winsA: (n) => `Gana ${n}`,
    draw: 'Empate',
    winsB: (n) => `Gana ${n}`,
    mvpLabel: 'MVP · Mejor jugador',
    resultLabel: 'Resultado más probable',
    ctaQ1: '¿Cuál es tu',
    ctaQ2: 'predicción',
    ctaQ3: '? Simúlalo tú mismo',
    ctaFree: 'Gratis · Sin registro',
    ctaUrl: 'golazox.com/final',
    penWins: (team, a, b) => `⚽ Empate · ${team} gana en penaltis (${a}-${b})`,
    wins: (team) => `🏆 Gana ${team}`,
  },
  en: {
    hook1: 'The <span class="accent">AI</span> has simulated',
    hook2: 'the World Cup',
    hook3: '<span class="accent">2026 Final</span>',
    finalTag: '🏆 World Cup Final 2026',
    simulTag: 'Monte Carlo Engine · AI',
    counterLabel: 'Matches simulated',
    counterSub: 'in real time',
    probsTitle: 'In 1,000 simulations',
    winsA: (n) => `${n} wins`,
    draw: 'Draw',
    winsB: (n) => `${n} wins`,
    mvpLabel: 'MVP · Best player',
    resultLabel: 'Most likely result',
    ctaQ1: "What's your",
    ctaQ2: 'prediction',
    ctaQ3: '? Simulate it yourself',
    ctaFree: 'Free · No sign-up',
    ctaUrl: 'golazox.com/final',
    penWins: (team, a, b) => `⚽ Draw · ${team} wins on penalties (${a}-${b})`,
    wins: (team) => `🏆 ${team} wins`,
  },
  pt: {
    hook1: 'A <span class="accent">IA</span> simulou',
    hook2: 'a Final da',
    hook3: '<span class="accent">Copa do Mundo 2026</span>',
    finalTag: '🏆 Final Copa do Mundo 2026',
    simulTag: 'Motor Monte Carlo · IA',
    counterLabel: 'Partidas simuladas',
    counterSub: 'em tempo real',
    probsTitle: 'Em 1.000 simulações',
    winsA: (n) => `${n} vence`,
    draw: 'Empate',
    winsB: (n) => `${n} vence`,
    mvpLabel: 'MVP · Melhor jogador',
    resultLabel: 'Resultado mais provável',
    ctaQ1: 'Qual é sua',
    ctaQ2: 'previsão',
    ctaQ3: '? Simule você mesmo',
    ctaFree: 'Grátis · Sem cadastro',
    ctaUrl: 'golazox.com/final',
    penWins: (team, a, b) => `⚽ Empate · ${team} vence nos pênaltis (${a}-${b})`,
    wins: (team) => `🏆 ${team} vence`,
  },
};

const T = I18N[langArg] || I18N.es;

// ── Simulation data (deterministic — same salt as /final-card) ──────────────
// Uses the same engine & salt as the production /final-card route so results match.
function getSimData() {
  try {
    // Run the actual simulation inline
    const { simulateMatch } = require('./engine.js');
    const { lookupTeam }    = require('./lookup.js');

    // Synchronous approach: use cached squads directly
    const spJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', 'spanien.json'),    'utf8'));
    const arJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', 'argentinien.json'),'utf8'));
    const spSeason = spJSON.seasons['2026'];
    const arSeason = arJSON.seasons['2026'];

    const salt = 'spanien2026argentinien2026final'
      .split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0) & 0x7fffffff;

    const sim = simulateMatch({
      teamA: 'España', teamB: 'Argentina',
      eraA: '2026', eraB: '2026',
      formationA: spSeason.formation || '4-3-3',
      formationB: arSeason.formation || '4-5-1',
      cachedLineupA: { ...spSeason, found: true },
      cachedLineupB: { ...arSeason, found: true },
      matchMode: '11v11', matchSalt: salt, isFinal: true,
    });

    const scoreA = sim.finalScore?.teamA ?? 1;
    const scoreB = sim.finalScore?.teamB ?? 1;
    const pA     = sim.probabilities?.teamA_win ?? 38.7;
    const pB     = sim.probabilities?.teamB_win ?? 35.0;
    const pD     = sim.probabilities?.draw       ?? 26.3;
    const mom    = sim.stats?.manOfMatch;

    let penWinner = null, penScoreA = null, penScoreB = null;
    if (scoreA === scoreB) {
      const penSim = simulateMatch({
        teamA: 'España', teamB: 'Argentina',
        eraA: '2026', eraB: '2026',
        formationA: spSeason.formation || '4-3-3',
        formationB: arSeason.formation || '4-5-1',
        cachedLineupA: { ...spSeason, found: true },
        cachedLineupB: { ...arSeason, found: true },
        matchMode: 'penalties', matchSalt: salt + 7919, isFinal: true,
      });
      const pen = penSim.finalScore?.penalties;
      if (pen) {
        penWinner  = pen.winner === 'A' ? 'España' : 'Argentina';
        penScoreA  = pen.scoreA;
        penScoreB  = pen.scoreB;
      }
    }

    return {
      nameA: 'España', nameB: 'Argentina',
      scoreA, scoreB, pA, pB, pD,
      penWinner, penScoreA, penScoreB,
      mvpName:   mom?.name     || 'Mikel Oyarzabal',
      mvpTeam:   mom?.teamName || 'España',
      mvpReason: mom?.reason?.type === 'goals'
        ? `${mom.reason.count} gol${mom.reason.count > 1 ? 'es' : ''}`
        : 'Mejor del campo',
    };
  } catch (err) {
    console.warn('[sim] Fallback to defaults:', err.message.slice(0, 60));
    return {
      nameA: 'España', nameB: 'Argentina',
      scoreA: 1, scoreB: 1,
      pA: 38.7, pB: 35.0, pD: 26.3,
      penWinner: 'España', penScoreA: 5, penScoreB: 4,
      mvpName: 'Mikel Oyarzabal', mvpTeam: 'España', mvpReason: '1 gol',
    };
  }
}

// ── Badge → base64 ─────────────────────────────────────────────────────────
function badgeB64(slug) {
  const p = path.join(BADGES_DIR, `${slug}.png`);
  if (!fs.existsSync(p)) return '';
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
}

// ── Build animation HTML ──────────────────────────────────────────────────
function buildHTML(d) {
  const badgeA = badgeB64('spanien');
  const badgeB = badgeB64('argentinien');
  const winnerColor = d.scoreA > d.scoreB ? '#c60b1e' : d.scoreB > d.scoreA ? '#74acdf' : '#f8c300';
  const resultText  = d.scoreA === d.scoreB
    ? T.penWins(d.penWinner, d.penScoreA, d.penScoreB)
    : T.wins(d.scoreA > d.scoreB ? d.nameA : d.nameB);

  return /* html */`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;
  background:#060a14;font-family:'Segoe UI',system-ui,sans-serif;color:#fff}

/* ── Particle canvas ── */
#cvs{position:absolute;inset:0;z-index:0;pointer-events:none}

/* ── Scene system ── */
.sc{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;z-index:1;
  opacity:0;transition:opacity 0.6s ease}
.sc.on{opacity:1}

/* ── Scene 1: Hook ── */
#s1{background:radial-gradient(ellipse at 50% 40%,#130829 0%,#060a14 70%)}
.gx-logo{font-size:34px;font-weight:900;letter-spacing:.2em;color:#7b2ff7;
  text-transform:uppercase;margin-bottom:48px}
.hook-text{font-size:58px;font-weight:900;text-align:center;line-height:1.15;
  padding:0 70px;text-shadow:0 4px 32px rgba(123,47,247,.6)}
.hook-text .accent{color:#f8c300}
.rec-dot{width:18px;height:18px;border-radius:50%;background:#f00;
  margin:36px auto 0;animation:blink 1.2s infinite}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}

/* ── Scene 2: Teams ── */
#s2{gap:0;padding:80px 0}
.badge-row{display:flex;align-items:center;justify-content:space-between;
  width:100%;padding:0 70px;gap:32px}
.t-block{display:flex;flex-direction:column;align-items:center;gap:28px;flex:1}
.t-badge{width:230px;height:230px;object-fit:contain;
  filter:drop-shadow(0 8px 40px rgba(0,0,0,.9))}
.t-name{font-size:50px;font-weight:900;text-align:center;line-height:1.1}
.vs-txt{font-size:80px;font-weight:900;color:#7b2ff7;flex-shrink:0}
.final-pill{font-size:28px;font-weight:800;letter-spacing:.12em;
  color:#f8c300;text-transform:uppercase;margin-top:64px;
  background:rgba(248,195,0,.1);border:1px solid rgba(248,195,0,.35);
  padding:18px 52px;border-radius:999px}
.simul-pill{font-size:24px;color:#475569;margin-top:24px;letter-spacing:.1em}

/* ── Scene 3: Counter ── */
#s3{gap:24px}
.cnt-label{font-size:40px;color:#64748b;letter-spacing:.1em;text-transform:uppercase}
.cnt-num{font-size:200px;font-weight:900;line-height:0.9;
  background:linear-gradient(135deg,#7b2ff7 30%,#00d4ff);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.cnt-sub{font-size:34px;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase}

/* ── Scene 4: Result ── */
#s4{padding:60px}
.res-card{width:100%;background:linear-gradient(160deg,#0d1528,#060a14,#0d0820);
  border:1px solid rgba(255,255,255,.1);border-radius:32px;padding:52px 44px;
  box-shadow:0 0 80px rgba(123,47,247,.3)}
.res-teams{display:flex;align-items:center;justify-content:space-between;gap:16px;
  margin-bottom:36px}
.res-team{display:flex;flex-direction:column;align-items:center;gap:20px;flex:1}
.res-badge{width:150px;height:150px;object-fit:contain}
.res-name{font-size:40px;font-weight:900;text-align:center}
.score-row{display:flex;align-items:center;gap:12px}
.score-n{font-size:130px;font-weight:900;line-height:1;
  background:linear-gradient(180deg,#fff,rgba(255,255,255,.7));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.score-sep{font-size:64px;font-weight:900;color:#1e293b;line-height:1}
.res-lbl{font-size:22px;color:#64748b;text-align:center;
  letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px}
.res-txt{font-size:36px;font-weight:900;color:${winnerColor};
  text-align:center;line-height:1.3;padding:0 16px}

/* ── Scene 5: Stats ── */
#s5{gap:36px;padding:60px}
.probs-title{font-size:30px;color:#475569;letter-spacing:.1em;text-transform:uppercase}
.probs-row{display:flex;gap:20px;width:100%}
.prob-card{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  border-radius:24px;padding:40px 16px;text-align:center}
.prob-val{font-size:68px;font-weight:900;color:#38bdf8;line-height:1}
.prob-lbl{font-size:20px;font-weight:700;color:#475569;margin-top:12px;
  text-transform:uppercase;letter-spacing:.05em;line-height:1.3}
.mvp-row{width:100%;background:linear-gradient(135deg,rgba(248,195,0,.1),rgba(248,195,0,.03));
  border:1px solid rgba(248,195,0,.3);border-radius:24px;
  padding:36px 40px;display:flex;align-items:center;gap:28px}
.mvp-star{font-size:60px}
.mvp-lbl{font-size:22px;font-weight:800;color:#f8c300;letter-spacing:.1em;
  text-transform:uppercase;margin-bottom:6px}
.mvp-name{font-size:48px;font-weight:900;color:#fff}
.mvp-sub{font-size:24px;color:#94a3b8;margin-top:6px}

/* ── Scene 6: CTA ── */
#s6{gap:36px;padding:80px 70px;
  background:radial-gradient(ellipse at 50% 40%,#130829 0%,#060a14 70%)}
.cta-arrow{font-size:90px;animation:bob 0.9s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-22px)}}
.cta-q{font-size:54px;font-weight:900;text-align:center;line-height:1.2}
.cta-q .accent{color:#00d4ff}
.cta-url{font-size:46px;font-weight:900;color:#a78bfa;letter-spacing:.02em;
  background:rgba(123,47,247,.15);border:2px solid rgba(123,47,247,.5);
  padding:24px 64px;border-radius:20px;margin-top:8px}
.cta-free{font-size:28px;color:#475569}

/* ── Flash overlay ── */
#flash{position:fixed;inset:0;background:#fff;opacity:0;
  pointer-events:none;z-index:999;transition:opacity 0.4s}

/* ── Global glow ── */
.glow{position:absolute;width:700px;height:700px;border-radius:50%;
  background:radial-gradient(circle,rgba(123,47,247,.18),transparent 70%);
  top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;
  animation:gpulse 3s ease-in-out infinite;z-index:0}
@keyframes gpulse{0%,100%{opacity:.4;transform:translate(-50%,-50%) scale(1)}
  50%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}}
</style>
</head>
<body>

<canvas id="cvs"></canvas>
<div id="flash"></div>

<!-- S1: Hook (0-3.5s) -->
<div class="sc" id="s1">
  <div class="glow"></div>
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center">
    <div class="gx-logo">⚽ GolazoX</div>
    <div class="hook-text">${T.hook1}<br/>${T.hook2}<br/>${T.hook3}</div>
    <div class="rec-dot"></div>
  </div>
</div>

<!-- S2: Teams (3.5-7s) -->
<div class="sc" id="s2">
  <div class="glow" style="background:radial-gradient(circle,rgba(248,195,0,.12),transparent 70%)"></div>
  <div class="badge-row" style="position:relative;z-index:1">
    <div class="t-block">
      ${badgeA ? `<img class="t-badge" src="${badgeA}"/>` : `<div style="width:230px;height:230px;background:rgba(255,255,255,.05);border-radius:50%"></div>`}
      <div class="t-name">${d.nameA}</div>
    </div>
    <div class="vs-txt">VS</div>
    <div class="t-block">
      ${badgeB ? `<img class="t-badge" src="${badgeB}"/>` : `<div style="width:230px;height:230px;background:rgba(255,255,255,.05);border-radius:50%"></div>`}
      <div class="t-name">${d.nameB}</div>
    </div>
  </div>
  <div class="final-pill" style="position:relative;z-index:1">${T.finalTag}</div>
  <div class="simul-pill" style="position:relative;z-index:1">${T.simulTag}</div>
</div>

<!-- S3: Counter (7-10.5s) -->
<div class="sc" id="s3">
  <div class="glow" style="background:radial-gradient(circle,rgba(0,212,255,.12),transparent 70%)"></div>
  <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:20px">
    <div class="cnt-label">${T.counterLabel}</div>
    <div class="cnt-num" id="cnt">0</div>
    <div class="cnt-sub">${T.counterSub}</div>
  </div>
</div>

<!-- S4: Result (10.5-17s) -->
<div class="sc" id="s4">
  <div class="res-card">
    <div class="res-teams">
      <div class="res-team">
        ${badgeA ? `<img class="res-badge" src="${badgeA}"/>` : ''}
        <div class="res-name">${d.nameA}</div>
      </div>
      <div>
        <div class="score-row">
          <div class="score-n">${d.scoreA}</div>
          <div class="score-sep">-</div>
          <div class="score-n">${d.scoreB}</div>
        </div>
      </div>
      <div class="res-team">
        ${badgeB ? `<img class="res-badge" src="${badgeB}"/>` : ''}
        <div class="res-name">${d.nameB}</div>
      </div>
    </div>
    <div class="res-lbl">${T.resultLabel}</div>
    <div class="res-txt">${resultText}</div>
  </div>
</div>

<!-- S5: Stats + MVP (17-22.5s) -->
<div class="sc" id="s5">
  <div class="probs-title">${T.probsTitle}</div>
  <div class="probs-row">
    <div class="prob-card">
      <div class="prob-val">${d.pA}%</div>
      <div class="prob-lbl">${T.winsA(d.nameA)}</div>
    </div>
    <div class="prob-card">
      <div class="prob-val">${d.pD}%</div>
      <div class="prob-lbl">${T.draw}</div>
    </div>
    <div class="prob-card">
      <div class="prob-val">${d.pB}%</div>
      <div class="prob-lbl">${T.winsB(d.nameB)}</div>
    </div>
  </div>
  <div class="mvp-row">
    <div class="mvp-star">⭐</div>
    <div>
      <div class="mvp-lbl">${T.mvpLabel}</div>
      <div class="mvp-name">${d.mvpName}</div>
      <div class="mvp-sub">${d.mvpTeam} · ${d.mvpReason}</div>
    </div>
  </div>
</div>

<!-- S6: CTA (22.5-26s) -->
<div class="sc" id="s6">
  <div class="cta-arrow">👇</div>
  <div class="cta-q">${T.ctaQ1} <span class="accent">${T.ctaQ2}</span>${T.ctaQ3}</div>
  <div class="cta-url">${T.ctaUrl}</div>
  <div class="cta-free">${T.ctaFree}</div>
</div>

<script>
// ── Particle system ────────────────────────────────────────────────────────
(function() {
  const cvs = document.getElementById('cvs');
  const ctx = cvs.getContext('2d');
  cvs.width = ${WIDTH}; cvs.height = ${HEIGHT};
  const pts = Array.from({length:100}, () => ({
    x: Math.random()*${WIDTH}, y: Math.random()*${HEIGHT},
    r: Math.random()*2+.5,
    vx: (Math.random()-.5)*.6, vy: (Math.random()-.5)*.6,
    a: Math.random()*.5+.05,
    hue: Math.random() > .6 ? 260 : 200,
  }));
  function draw() {
    ctx.clearRect(0,0,${WIDTH},${HEIGHT});
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='hsla('+p.hue+',80%,65%,'+p.a+')';
      ctx.fill();
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0||p.x>${WIDTH}) p.vx*=-1;
      if(p.y<0||p.y>${HEIGHT}) p.vy*=-1;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Scene timings (ms) ─────────────────────────────────────────────────────
//  S1: 0      → Hook/título
//  S2: 3500   → Equipos + badges
//  S3: 7000   → Contador 1.000
//  S4: 10500  → Resultado (con flash)
//  S5: 17000  → Probabilidades + MVP
//  S6: 22500  → CTA
const TIMINGS = [0, 3500, 7000, 10500, 17000, 22500];
const IDS     = ['s1','s2','s3','s4','s5','s6'];
let cur = -1;

function showScene(i) {
  if (i === cur) return;
  IDS.forEach((id, j) => {
    const el = document.getElementById(id);
    if(el) el.classList.toggle('on', j===i);
  });
  // Flash burst on result reveal
  if (i === 3) {
    const fl = document.getElementById('flash');
    fl.style.transition = 'none';
    fl.style.opacity = '1';
    setTimeout(() => { fl.style.transition='opacity 0.5s'; fl.style.opacity='0'; }, 40);
  }
  cur = i;
  if (i === 2) startCounter();
}

// Counting animation (ease-out quad) 0 → 1000 in 3s
function startCounter() {
  const el = document.getElementById('cnt');
  if (!el) return;
  const t0 = performance.now();
  const dur = 3000;
  function tick(now) {
    const p = Math.min((now-t0)/dur, 1);
    const e = 1-(1-p)*(1-p); // ease-out quad
    el.textContent = Math.round(e*1000).toLocaleString('es-ES');
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Timeline loop
const t0 = performance.now();
function loop() {
  const elapsed = performance.now()-t0;
  let next=0;
  for(let i=TIMINGS.length-1;i>=0;i--){if(elapsed>=TIMINGS[i]){next=i;break;}}
  showScene(next);
  requestAnimationFrame(loop);
}
showScene(0);
requestAnimationFrame(loop);
</script>
</body>
</html>`;
}

// ── Serve HTML locally ─────────────────────────────────────────────────────
function startServer(html) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({ url: `http://127.0.0.1:${port}/`, srv });
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[T:.]/g,'-').slice(0,19);
  const rawPath = path.join(OUTPUT_DIR, `_final_raw_${stamp}.mp4`);
  const outPath = path.join(OUTPUT_DIR, `final_wc2026_${langArg}_${stamp}.mp4`);

  console.log('[video] Calculando simulación...');
  const data = getSimData();
  const resultSummary = data.scoreA === data.scoreB
    ? `Empate ${data.scoreA}-${data.scoreB} → ${data.penWinner} penaltis (${data.penScoreA}-${data.penScoreB})`
    : `${data.scoreA > data.scoreB ? data.nameA : data.nameB} ${data.scoreA}-${data.scoreB}`;
  console.log(`[video] Resultado: ${resultSummary}`);
  console.log(`[video] Probabilidades: España ${data.pA}% | Empate ${data.pD}% | Argentina ${data.pB}%`);
  console.log(`[video] MVP: ${data.mvpName} (${data.mvpTeam})`);

  const html = buildHTML(data);
  const { url, srv } = await startServer(html);

  console.log('[video] Iniciando Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-web-security', '--allow-file-access-from-files',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--force-device-scale-factor=1',
      '--disable-gpu',
    ],
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: false,
    fps: FPS,
    videoFrame: { width: WIDTH, height: HEIGHT },
    aspectRatio: '9:16',
    videoCodec: 'libx264',
    videoCrf: 18,
  });

  console.log('[video] Grabando...');
  await recorder.start(rawPath);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, (DURATION_S + 1) * 1000));
  await recorder.stop();
  await browser.close();
  srv.close();

  // ── FFmpeg: añadir música (fade in/out) ────────────────────────────────
  const ffmpeg      = process.env.FFMPEG_PATH;
  const hasMusicFile = fs.existsSync(MUSIC_FILE);

  if (hasMusicFile) {
    console.log('[video] Mezclando música...');
    const MUSIC_VOL = 0.55;
    const cmd = [
      `"${ffmpeg}" -y`,
      `-i "${rawPath}"`,
      `-stream_loop -1 -i "${MUSIC_FILE}"`,
      `-filter_complex`,
      `"[1:a]volume=${MUSIC_VOL},afade=t=in:st=0:d=1,afade=t=out:st=${DURATION_S - 2}:d=2[mu];`,
      `[0:a][mu]amix=inputs=2:duration=first[out_a]"`,
      `-map 0:v -map "[out_a]"`,
      `-c:v copy -c:a aac -b:a 192k -shortest`,
      `"${outPath}"`,
    ].join(' ');
    try {
      execSync(cmd, { stdio: 'pipe' });
      fs.unlinkSync(rawPath);
      console.log(`[video] ✅ Con música: ${outPath}`);
    } catch (e) {
      fs.renameSync(rawPath, outPath);
      console.log(`[video] ✅ Sin música (FFmpeg error): ${outPath}`);
    }
  } else {
    fs.renameSync(rawPath, outPath);
    console.log(`[video] ✅ Listo: ${outPath}`);
    console.log('[video] 💡 Tip: añade assets/music_epic.mp3 para música automática');
  }

  console.log('\n📱 INSTRUCCIONES PARA TIKTOK:');
  console.log(`   1. Abre el video: ${outPath}`);
  console.log('   2. Sube a TikTok con este texto:');
  console.log('   ─────────────────────────────────────────────────');
  const tiktokCaption = langArg === 'en'
    ? `AI simulated the World Cup Final 1,000 times 🤖⚽\nThe result will surprise you...\n\nSimulate it yourself 👉 golazox.com/final\n\n#WorldCup2026 #SpainArgentina #FinalMundial #AIFootball`
    : `La IA simuló la Final del Mundial 1.000 veces 🤖⚽\nEl resultado te va a sorprender...\n\nSimúlalo tú mismo 👉 golazox.com/final\n\n#Mundial2026 #EspañaArgentina #FinalMundial #GolazOX`;
  console.log(`   ${tiktokCaption}`);
  console.log('   ─────────────────────────────────────────────────');
}

main().catch(err => {
  console.error('[video] ❌ Error:', err.message);
  process.exit(1);
});
