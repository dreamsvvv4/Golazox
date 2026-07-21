/**
 * _gen_today_videos.js — WC2026 Final · 3 TikTok Videos (19 Jul 2026)
 *
 * Genera 3 videos para hoy, día previo a la final:
 *   1. yamal_wc2026_TIMESTAMP.mp4    — Yamal: el jugador más decisivo
 *   2. scores_wc2026_TIMESTAMP.mp4   — Marcador exacto más probable
 *   3. sinmessi_wc2026_TIMESTAMP.mp4 — Argentina sin Messi
 *
 * Usage: node _gen_today_videos.js
 */

'use strict';

process.env.FFMPEG_PATH = require('ffmpeg-static');

const puppeteer               = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const http      = require('http');
const path      = require('path');
const fs        = require('fs');
const { execSync } = require('child_process');

const OUTPUT_DIR = path.join(__dirname, 'videos');
const BADGES_DIR = path.join(__dirname, 'public', 'img', 'badges');
const MUSIC_FILE = path.join(__dirname, 'assets', 'music_epic.mp3');
const WIDTH  = 1080;
const HEIGHT = 1920;
const FPS    = 30;
const N_SIMS = 1000;

// ── Pre-computed simulation data (1.000 sims, seeds i*7919+99991, isFinal:true) ──
// Resultado de _sim_final.js — mismos seeds = mismo resultado determinístico
function runSimulations() {
  console.log('[sims] Usando datos pre-calculados (1.000 sims, seeds fijos)...');
  return {
    pctA: '32.8', pctB: '39.9', pctD: '27.3',
    pctAmessi: '35.1', pctBmessi: '37.3', pctDmessi: '27.6',
    topScorers: [
      { name: 'Julián Álvarez',       count: 231, pct: '23.1' },
      { name: 'Lionel Messi',         count: 183, pct: '18.3' },
      { name: 'Lamine Yamal',         count: 169, pct: '16.9' },
      { name: 'Mikel Oyarzabal',      count: 163, pct: '16.3' },
      { name: 'Álex Baena',           count: 147, pct: '14.7' },
      { name: 'Enzo Fernández',       count: 132, pct: '13.2' },
      { name: 'Dani Olmo',            count: 117, pct: '11.7' },
      { name: 'Alexis Mac Allister',  count: 116, pct: '11.6' },
      { name: 'Rodrigo De Paul',      count: 111, pct: '11.1' },
    ],
    topScores: [
      { score: '0-1', count: 130, pct: '13.0' },
      { score: '1-1', count: 130, pct: '13.0' },
      { score: '1-0', count: 98,  pct: '9.8'  },
      { score: '0-0', count: 86,  pct: '8.6'  },
      { score: '2-1', count: 74,  pct: '7.4'  },
      { score: '0-2', count: 72,  pct: '7.2'  },
    ],
    yamalPct:      '15.1',
    yamalEspWin:   '58.9',
    yamalEspWinNo: '28.2',
    yamalCount:    151,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function badgeB64(slug) {
  const p = path.join(BADGES_DIR, `${slug}.png`);
  return fs.existsSync(p) ? 'data:image/png;base64,' + fs.readFileSync(p).toString('base64') : '';
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Video 1: Yamal ────────────────────────────────────────────────────────────
function buildYamalHTML(d) {
  const badgeA = badgeB64('spanien');
  const badgeB = badgeB64('argentinien');
  const yamalBadge = badgeA; // Spain badge for Yamal

  // Bar widths: scale so highest bar = 85%
  const maxWin = Math.max(parseFloat(d.yamalEspWin), parseFloat(d.yamalEspWinNo));
  const scl = 85 / (maxWin || 1);
  const bw1 = (parseFloat(d.yamalEspWin)   * scl).toFixed(1);
  const bw2 = (parseFloat(d.yamalEspWinNo) * scl).toFixed(1);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#07050f;font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 64px;opacity:0;transition:opacity .45s;z-index:1}
.scene.active{opacity:1}

/* S1 */
#s1{background:radial-gradient(ellipse 80% 55% at 50% 40%,#1c0835 0%,#07050f 65%)}
.s1-kicker{font-size:2.3rem;letter-spacing:.3em;color:#666;text-transform:uppercase;margin-bottom:2rem;opacity:0;animation:fadeUp .5s .3s forwards}
.s1-q{font-size:4.6rem;font-weight:900;text-align:center;line-height:1.2;opacity:0;animation:fadeUp .6s .7s forwards}
.s1-acc{color:#FFD700}
.s1-badge{width:130px;height:130px;object-fit:contain;filter:drop-shadow(0 0 24px rgba(255,215,0,.5));margin:2.5rem 0;opacity:0;animation:scaleIn .7s 1.1s cubic-bezier(.34,1.56,.64,1) forwards}
.s1-name{font-size:5.8rem;font-weight:900;background:linear-gradient(135deg,#FFD700,#FF6B35);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:0;animation:fadeUp .6s 1.5s forwards}
.s1-team{font-size:2.6rem;color:#888;margin-top:.8rem;opacity:0;animation:fadeUp .5s 1.8s forwards}

/* S2 */
#s2{background:radial-gradient(ellipse 80% 45% at 50% 15%,#0d0820 0%,#07050f 60%);justify-content:flex-start;padding-top:110px}
.s2-hed{font-size:3rem;font-weight:900;color:#FFD700;text-align:center;margin-bottom:.4rem}
.s2-sub{font-size:2.1rem;color:#556;text-align:center;margin-bottom:3.5rem}
.stat-block{width:100%;display:flex;flex-direction:column;gap:3.5rem;margin-top:1rem}
.stat-item{width:100%}
.stat-label{font-size:2.2rem;color:#aaa;margin-bottom:1.2rem}
.stat-label em{color:#fff;font-style:normal;font-weight:700}
.stat-bar-wrap{height:54px;background:rgba(255,255,255,.07);border-radius:27px;overflow:hidden;position:relative}
.stat-bar{height:100%;border-radius:27px;width:0%;transition:width .8s cubic-bezier(.4,0,.2,1)}
.stat-bar.bar-yes{background:linear-gradient(90deg,#FFD700aa,#FFD700)}
.stat-bar.bar-no {background:linear-gradient(90deg,#55448888,#554488)}
.stat-val{position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:2.8rem;font-weight:900;color:#fff}
.stat-note{font-size:1.9rem;color:#556;margin-top:.9rem}

.stat-solo{font-size:5.5rem;font-weight:900;color:#FFD700;text-align:center;margin-top:2.5rem;opacity:0;animation:scaleIn .7s .5s forwards}
.stat-solo-lbl{font-size:2.2rem;color:#aaa;text-align:center;margin-top:.6rem;opacity:0;animation:fadeUp .5s .9s forwards}

/* S3 */
#s3{background:radial-gradient(ellipse 70% 55% at 50% 45%,#1a0c00 0%,#07050f 65%)}
.s3-icon{font-size:6rem;opacity:0;animation:scaleIn .6s .3s forwards}
.s3-big{font-size:7rem;font-weight:900;color:#FFD700;filter:drop-shadow(0 0 20px rgba(255,215,0,.5));opacity:0;animation:scaleIn .75s .8s cubic-bezier(.34,1.56,.64,1) forwards;margin:.5rem 0}
.s3-lbl{font-size:2.6rem;text-align:center;color:#aaa;opacity:0;animation:fadeUp .5s 1.2s forwards}
.s3-lbl b{color:#fff}
.s3-arrow{font-size:4rem;margin:2.5rem 0;opacity:0;animation:fadeUp .5s 1.6s forwards}
.s3-impact{font-size:3.5rem;font-weight:700;text-align:center;line-height:1.3;opacity:0;animation:fadeUp .6s 2s forwards}
.s3-impact span{color:#00E676}

/* S4 */
#s4{background:radial-gradient(ellipse 80% 55% at 50% 60%,#1a0835 0%,#07050f 65%)}
.cta-q{font-size:3.8rem;font-weight:900;text-align:center;line-height:1.3;opacity:0;animation:fadeUp .6s .2s forwards}
.cta-acc{color:#FFD700}
.cta-box{border:4px solid #FFD700;border-radius:22px;padding:1.5rem 3.5rem;margin-top:3.5rem;opacity:0;animation:scaleIn .6s .8s cubic-bezier(.34,1.56,.64,1) forwards}
.cta-url{font-size:4.2rem;font-weight:900;color:#FFD700}
.cta-arr{font-size:4.8rem;display:block;text-align:center;margin-top:2.5rem;opacity:0;animation:fadeUp .4s 1.2s forwards,bounce 1.1s 1.2s infinite}
.cta-free{font-size:2.2rem;color:#556;margin-top:1.8rem;opacity:0;animation:fadeUp .5s 1.5s forwards}

@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
</style></head><body>
<canvas id="cv"></canvas>

<div class="scene" id="s1">
  <div class="s1-kicker">Motor Monte Carlo · IA</div>
  <div class="s1-q">¿Es<br><span class="s1-acc">Lamine Yamal</span><br>la CLAVE?</div>
  ${badgeA ? `<img class="s1-badge" src="${badgeA}"/>` : '<div style="font-size:5rem;margin:2.5rem 0">🇪🇸</div>'}
  <div class="s1-name">Lamine Yamal</div>
  <div class="s1-team">España 2026 · Final del Mundial</div>
</div>

<div class="scene" id="s2">
  <div class="s2-hed">⚽ Impacto de Yamal</div>
  <div class="s2-sub">Análisis de ${N_SIMS.toLocaleString('es-ES')} finales simuladas</div>
  <div class="stat-block">
    <div class="stat-item" id="stat1">
      <div class="stat-label"><em>SI Yamal marca</em> → España gana:</div>
      <div class="stat-bar-wrap">
        <div class="stat-bar bar-yes" id="bar1" data-w="${bw1}"></div>
        <div class="stat-val">${d.yamalEspWin}%</div>
      </div>
      <div class="stat-note">En ${d.yamalCount} de ${N_SIMS} finales, Yamal marcó</div>
    </div>
    <div class="stat-item" id="stat2">
      <div class="stat-label"><em>SI Yamal NO marca</em> → España gana:</div>
      <div class="stat-bar-wrap">
        <div class="stat-bar bar-no" id="bar2" data-w="${bw2}"></div>
        <div class="stat-val">${d.yamalEspWinNo}%</div>
      </div>
      <div class="stat-note">Diferencia: <b style="color:#FFD700">+${(parseFloat(d.yamalEspWin) - parseFloat(d.yamalEspWinNo)).toFixed(1)}%</b> cuando Yamal marca</div>
    </div>
    <div>
      <div class="stat-solo">${d.yamalPct}%</div>
      <div class="stat-solo-lbl">de las finales Yamal marca</div>
    </div>
  </div>
</div>

<div class="scene" id="s3">
  <div class="s3-icon">⚡</div>
  <div class="s3-big">${(parseFloat(d.yamalEspWin) - parseFloat(d.yamalEspWinNo)).toFixed(0)}%</div>
  <div class="s3-lbl">más probabilidad de ganar<br><b>cuando Yamal marca</b></div>
  <div class="s3-arrow">👇</div>
  <div class="s3-impact">Si marca mañana,<br>España tiene <span>${d.yamalEspWin}%</span><br>de ganar la final</div>
</div>

<div class="scene" id="s4">
  <div class="cta-q">¿Crees que<br><span class="cta-acc">Yamal marca</span><br>mañana?</div>
  <div class="cta-box"><div class="cta-url">golazox.com/final</div></div>
  <span class="cta-arr">👇</span>
  <div class="cta-free">Simúlalo · Gratis · Sin registro</div>
</div>

<script>
(function(){
  const cv=document.getElementById('cv'),cx=cv.getContext('2d');
  cv.width=${WIDTH};cv.height=${HEIGHT};
  const pts=Array.from({length:120},()=>({x:Math.random()*${WIDTH},y:Math.random()*${HEIGHT},vx:(Math.random()-.5)*.35,vy:-(Math.random()*.45+.1),r:Math.random()*2+.4,a:Math.random()*.3+.05,c:Math.random()<.5?'#FFD700':'#FF6B35'}));
  function dp(){cx.clearRect(0,0,${WIDTH},${HEIGHT});pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.y<-5)p.y=${HEIGHT}+5;if(p.x<0)p.x=${WIDTH};if(p.x>${WIDTH})p.x=0;cx.beginPath();cx.arc(p.x,p.y,p.r,0,Math.PI*2);cx.fillStyle=p.c;cx.globalAlpha=p.a;cx.fill()});cx.globalAlpha=1;requestAnimationFrame(dp);}
  dp();
})();
const SCENES=[{id:'s1',start:0,end:4},{id:'s2',start:4,end:16.5},{id:'s3',start:16.5,end:22},{id:'s4',start:22,end:27}];
let t0=null, barsAnimated=false;
function loop(ts){
  if(!t0)t0=ts;
  const e=(ts-t0)/1000;
  SCENES.forEach(s=>{const el=document.getElementById(s.id);if(el)el.classList.toggle('active',e>=s.start&&e<s.end)});
  if(e>=4&&!barsAnimated){
    barsAnimated=true;
    setTimeout(()=>{const b=document.getElementById('bar1');if(b){b.style.width=b.dataset.w+'%';}},400);
    setTimeout(()=>{const b=document.getElementById('bar2');if(b){b.style.width=b.dataset.w+'%';}},1800);
  }
  if(e<27)requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script></body></html>`;
}

// ── Video 2: Marcador exacto ──────────────────────────────────────────────────
function buildScoresHTML(d) {
  const badgeA = badgeB64('spanien');
  const badgeB = badgeB64('argentinien');

  const maxPct = parseFloat(d.topScores[0]?.pct || 1);
  const scl    = 82 / maxPct;

  const rowsHTML = d.topScores.map((s, i) => {
    const [ga, gb] = s.score.split('-').map(Number);
    const winner = ga > gb ? '🇪🇸 España gana' : gb > ga ? '🇦🇷 Argentina gana' : '⚖️ A penaltis';
    const clr    = ga > gb ? '#2196f3' : gb > ga ? '#F5C518' : '#00E676';
    const bw     = (parseFloat(s.pct) * scl).toFixed(1);
    const delay  = (3.5 + i * 0.7).toFixed(2);
    return `<div class="sc-row" id="scr-${i}" data-delay="${delay}">
      <div class="sc-rank">#${i+1}</div>
      <div class="sc-score">${s.score}</div>
      <div class="sc-bar-wrap">
        <div class="sc-bar" id="sbar-${i}" data-w="${bw}" style="background:linear-gradient(90deg,${clr}77,${clr})"></div>
      </div>
      <div class="sc-right">
        <div class="sc-pct">${s.pct}%</div>
        <div class="sc-win">${winner}</div>
      </div>
    </div>`;
  }).join('');

  const topScore = d.topScores[0];
  const [tga, tgb] = topScore ? topScore.score.split('-').map(Number) : [0, 1];
  const topWinner = tga > tgb ? '🇪🇸 España' : tgb > tga ? '🇦🇷 Argentina' : 'Penaltis';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#060c10;font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 64px;opacity:0;transition:opacity .45s;z-index:1}
.scene.active{opacity:1}

#s1{background:radial-gradient(ellipse 80% 55% at 50% 40%,#0a1c2a 0%,#060c10 65%)}
.s1-kicker{font-size:2.3rem;letter-spacing:.3em;color:#556;text-transform:uppercase;margin-bottom:2rem;opacity:0;animation:fadeUp .5s .3s forwards}
.s1-q{font-size:4.6rem;font-weight:900;text-align:center;line-height:1.2;opacity:0;animation:fadeUp .6s .7s forwards}
.s1-acc{color:#00E5FF}
.s1-bdgs{display:flex;align-items:center;gap:2.5rem;margin-top:2.5rem;opacity:0;animation:fadeUp .5s 1.3s forwards}
.s1-bdgs img{width:105px;height:105px;object-fit:contain;filter:drop-shadow(0 0 16px rgba(0,229,255,.35))}
.s1-vs{font-size:3.2rem;font-weight:900;color:#333}
.s1-n{font-size:2.2rem;color:#445;margin-top:2.5rem;opacity:0;animation:fadeUp .5s 1.7s forwards}

#s2{background:radial-gradient(ellipse 80% 40% at 50% 10%,#0a1c2a 0%,#060c10 55%);justify-content:flex-start;padding-top:100px}
.s2-hed{font-size:3rem;font-weight:900;color:#00E5FF;text-align:center;margin-bottom:.5rem}
.s2-sub{font-size:2rem;color:#445;text-align:center;margin-bottom:3rem}
.sc-rows{width:100%;display:flex;flex-direction:column;gap:2.4rem}
.sc-row{display:flex;align-items:center;gap:1.4rem;opacity:0;transform:translateX(50px)}
.sc-row.in{opacity:1;transform:translateX(0);transition:opacity .4s,transform .4s cubic-bezier(.2,0,.1,1)}
.sc-rank{font-size:2.4rem;font-weight:700;color:#445;width:3rem;text-align:center;flex-shrink:0}
.sc-score{font-size:4rem;font-weight:900;width:6.5rem;text-align:center;flex-shrink:0}
.sc-bar-wrap{flex:1;height:46px;background:rgba(255,255,255,.07);border-radius:23px;overflow:hidden}
.sc-bar{height:100%;border-radius:23px;width:0%;transition:width .7s ease}
.sc-right{flex-shrink:0;width:14rem;text-align:right}
.sc-pct{font-size:3rem;font-weight:900;color:#00E5FF}
.sc-win{font-size:1.7rem;color:#556;margin-top:.2rem}

#s3{background:radial-gradient(ellipse 70% 60% at 50% 50%,#0a1c2a 0%,#060c10 65%)}
.s3-tag{font-size:2.2rem;letter-spacing:.2em;color:#445;text-transform:uppercase;margin-bottom:2rem}
.s3-ball{font-size:6rem;opacity:0;animation:scaleIn .6s .3s forwards}
.s3-lbl{font-size:2.6rem;color:#888;margin-top:1.5rem;opacity:0;animation:fadeUp .5s .7s forwards}
.s3-score{font-size:9rem;font-weight:900;color:#fff;letter-spacing:.1em;filter:drop-shadow(0 0 24px rgba(0,229,255,.4));opacity:0;animation:scaleIn .8s 1s cubic-bezier(.34,1.56,.64,1) forwards}
.s3-winner{font-size:3.5rem;font-weight:700;margin-top:1rem;opacity:0;animation:fadeUp .5s 1.5s forwards}
.s3-pct{font-size:3rem;color:#00E5FF;margin-top:.8rem;opacity:0;animation:fadeUp .5s 1.8s forwards}

#s4{background:radial-gradient(ellipse 80% 55% at 50% 60%,#0a1c2a 0%,#060c10 65%)}
.cta-q{font-size:3.8rem;font-weight:900;text-align:center;line-height:1.3;opacity:0;animation:fadeUp .6s .2s forwards}
.cta-acc{color:#00E5FF}
.cta-box{border:4px solid #00E5FF;border-radius:22px;padding:1.5rem 3.5rem;margin-top:3.5rem;opacity:0;animation:scaleIn .6s .8s cubic-bezier(.34,1.56,.64,1) forwards}
.cta-url{font-size:4.2rem;font-weight:900;color:#00E5FF}
.cta-arr{font-size:4.8rem;display:block;text-align:center;margin-top:2.5rem;opacity:0;animation:fadeUp .4s 1.2s forwards,bounce 1.1s 1.2s infinite}
.cta-free{font-size:2.2rem;color:#445;margin-top:1.8rem;opacity:0;animation:fadeUp .5s 1.5s forwards}

@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
</style></head><body>
<canvas id="cv"></canvas>

<div class="scene" id="s1">
  <div class="s1-kicker">Motor Monte Carlo · IA</div>
  <div class="s1-q">¿Cuál será el<br>marcador <span class="s1-acc">exacto</span><br>de la Final?</div>
  <div class="s1-bdgs">
    ${badgeA ? `<img src="${badgeA}"/>` : '🇪🇸'}
    <span class="s1-vs">VS</span>
    ${badgeB ? `<img src="${badgeB}"/>` : '🇦🇷'}
  </div>
  <div class="s1-n">${N_SIMS.toLocaleString('es-ES')} finales simuladas</div>
</div>

<div class="scene" id="s2">
  <div class="s2-hed">🎯 Marcadores más probables</div>
  <div class="s2-sub">% de simulaciones con ese marcador</div>
  <div class="sc-rows">${rowsHTML}</div>
</div>

<div class="scene" id="s3">
  <div class="s3-tag">🥇 Más probable</div>
  <div class="s3-ball">⚽</div>
  <div class="s3-lbl">La IA dice que el marcador final será</div>
  <div class="s3-score">${topScore?.score || '0-1'}</div>
  <div class="s3-winner">${topWinner}</div>
  <div class="s3-pct">Probabilidad: ${topScore?.pct || '?'}%</div>
</div>

<div class="scene" id="s4">
  <div class="cta-q">¿Cuál es tu<br><span class="cta-acc">predicción</span>?<br>¡Comenta! ⬇️</div>
  <div class="cta-box"><div class="cta-url">golazox.com/final</div></div>
  <span class="cta-arr">👇</span>
  <div class="cta-free">Simúlalo · Gratis · Sin registro</div>
</div>

<script>
(function(){
  const cv=document.getElementById('cv'),cx=cv.getContext('2d');
  cv.width=${WIDTH};cv.height=${HEIGHT};
  const pts=Array.from({length:120},()=>({x:Math.random()*${WIDTH},y:Math.random()*${HEIGHT},vx:(Math.random()-.5)*.35,vy:-(Math.random()*.45+.1),r:Math.random()*2+.4,a:Math.random()*.3+.05,c:Math.random()<.5?'#00E5FF':'#0088AA'}));
  function dp(){cx.clearRect(0,0,${WIDTH},${HEIGHT});pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.y<-5)p.y=${HEIGHT}+5;if(p.x<0)p.x=${WIDTH};if(p.x>${WIDTH})p.x=0;cx.beginPath();cx.arc(p.x,p.y,p.r,0,Math.PI*2);cx.fillStyle=p.c;cx.globalAlpha=p.a;cx.fill()});cx.globalAlpha=1;requestAnimationFrame(dp);}
  dp();
})();
const SCENES=[{id:'s1',start:0,end:3.5},{id:'s2',start:3.5,end:16.5},{id:'s3',start:16.5,end:22},{id:'s4',start:22,end:27}];
let t0=null,s2done=false;
function loop(ts){
  if(!t0)t0=ts;
  const e=(ts-t0)/1000;
  SCENES.forEach(s=>{const el=document.getElementById(s.id);if(el)el.classList.toggle('active',e>=s.start&&e<s.end)});
  if(e>=3.5&&!s2done){
    s2done=true;
    document.querySelectorAll('.sc-row').forEach((row,i)=>{
      const delay=(parseFloat(row.dataset.delay)-3.5)*1000;
      setTimeout(()=>{
        row.classList.add('in');
        const bar=document.getElementById('sbar-'+i);
        if(bar) setTimeout(()=>{bar.style.width=bar.dataset.w+'%'},200);
      },Math.max(0,delay));
    });
  }
  if(e<27)requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script></body></html>`;
}

// ── Video 3: Sin Messi ────────────────────────────────────────────────────────
function buildSinMessiHTML(d) {
  const badgeA = badgeB64('spanien');
  const badgeB = badgeB64('argentinien');

  const maxVal = Math.max(parseFloat(d.pctA), parseFloat(d.pctB), parseFloat(d.pctAmessi), parseFloat(d.pctBmessi));
  const scl = 80 / (maxVal || 1);

  const bwA  = (parseFloat(d.pctA)      * scl).toFixed(1);
  const bwB  = (parseFloat(d.pctB)      * scl).toFixed(1);
  const bwAm = (parseFloat(d.pctAmessi) * scl).toFixed(1);
  const bwBm = (parseFloat(d.pctBmessi) * scl).toFixed(1);

  const diff = (parseFloat(d.pctBmessi) - parseFloat(d.pctB)).toFixed(1);
  const diffAbs = Math.abs(parseFloat(diff)).toFixed(1);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#060810;font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 64px;opacity:0;transition:opacity .45s;z-index:1}
.scene.active{opacity:1}

#s1{background:radial-gradient(ellipse 80% 55% at 50% 40%,#18040a 0%,#060810 65%)}
.s1-kicker{font-size:2.3rem;letter-spacing:.3em;color:#666;text-transform:uppercase;margin-bottom:2rem;opacity:0;animation:fadeUp .5s .3s forwards}
.s1-q{font-size:4.5rem;font-weight:900;text-align:center;line-height:1.2;opacity:0;animation:fadeUp .6s .7s forwards}
.s1-acc{color:#FF4444}
.s1-badge{width:130px;height:130px;object-fit:contain;filter:grayscale(1) opacity(.4);margin:2.5rem 0;opacity:0;animation:scaleIn .7s 1.1s forwards}
.s1-messi{font-size:5rem;font-weight:900;color:#888;text-decoration:line-through;opacity:0;animation:fadeUp .6s 1.5s forwards}
.s1-no{font-size:7rem;color:#FF4444;position:absolute;margin-top:-1rem;opacity:0;animation:scaleIn .5s 1.8s forwards}

#s2{background:radial-gradient(ellipse 80% 40% at 50% 10%,#18040a 0%,#060810 55%);justify-content:flex-start;padding-top:90px}
.s2-hed{font-size:2.8rem;font-weight:900;color:#FF4444;text-align:center;margin-bottom:.5rem}
.s2-sub{font-size:2rem;color:#445;text-align:center;margin-bottom:3rem}

.compare-block{width:100%;display:flex;flex-direction:column;gap:3.2rem}
.compare-section-title{font-size:2rem;font-weight:700;text-align:center;padding:.6rem 1.8rem;border-radius:8px;margin-bottom:.8rem}
.tit-con{background:rgba(255,255,255,.07);color:#aaa}
.tit-sin{background:rgba(255,68,68,.12);color:#FF4444}
.bar-row{display:flex;align-items:center;gap:1.5rem;margin-bottom:1.2rem}
.br-flag{font-size:2.8rem;flex-shrink:0;width:3.5rem;text-align:center}
.br-bar-wrap{flex:1;height:42px;background:rgba(255,255,255,.07);border-radius:21px;overflow:hidden}
.br-bar{height:100%;border-radius:21px;width:0%;transition:width .7s ease}
.bar-esp{background:linear-gradient(90deg,#2196f377,#2196f3)}
.bar-arg{background:linear-gradient(90deg,#F5C51877,#F5C518)}
.br-val{font-size:3rem;font-weight:900;flex-shrink:0;width:6.5rem;text-align:right}

#s3{background:radial-gradient(ellipse 70% 55% at 50% 45%,#18040a 0%,#060810 65%)}
.s3-tag{font-size:2.2rem;letter-spacing:.2em;color:#556;text-transform:uppercase;margin-bottom:2rem}
.s3-num{font-size:9rem;font-weight:900;color:#FF4444;filter:drop-shadow(0 0 20px rgba(255,68,68,.4));opacity:0;animation:scaleIn .75s .8s cubic-bezier(.34,1.56,.64,1) forwards;margin:1rem 0}
.s3-lbl{font-size:2.8rem;text-align:center;color:#aaa;opacity:0;animation:fadeUp .5s 1.3s forwards;line-height:1.4}
.s3-lbl b{color:#fff}
.s3-conclusion{font-size:3rem;font-weight:700;text-align:center;margin-top:2.5rem;line-height:1.35;opacity:0;animation:fadeUp .6s 1.8s forwards}
.s3-conclusion span{color:#00E676}

#s4{background:radial-gradient(ellipse 80% 55% at 50% 60%,#18040a 0%,#060810 65%)}
.cta-q{font-size:3.8rem;font-weight:900;text-align:center;line-height:1.3;opacity:0;animation:fadeUp .6s .2s forwards}
.cta-acc{color:#FF4444}
.cta-box{border:4px solid #FF4444;border-radius:22px;padding:1.5rem 3.5rem;margin-top:3.5rem;opacity:0;animation:scaleIn .6s .8s cubic-bezier(.34,1.56,.64,1) forwards}
.cta-url{font-size:4.2rem;font-weight:900;color:#FF4444}
.cta-arr{font-size:4.8rem;display:block;text-align:center;margin-top:2.5rem;opacity:0;animation:fadeUp .4s 1.2s forwards,bounce 1.1s 1.2s infinite}
.cta-free{font-size:2.2rem;color:#556;margin-top:1.8rem;opacity:0;animation:fadeUp .5s 1.5s forwards}

@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
</style></head><body>
<canvas id="cv"></canvas>

<div class="scene" id="s1">
  <div class="s1-kicker">Motor Monte Carlo · IA</div>
  <div class="s1-q">¿Qué pasa si<br>Messi <span class="s1-acc">NO juega</span><br>la Final?</div>
  ${badgeB ? `<img class="s1-badge" src="${badgeB}"/>` : '<div style="font-size:5rem;margin:2.5rem 0">🇦🇷</div>'}
  <div style="position:relative;display:flex;align-items:center;justify-content:center">
    <div class="s1-messi">Lionel Messi</div>
    <div class="s1-no">❌</div>
  </div>
</div>

<div class="scene" id="s2">
  <div class="s2-hed">📊 Con Messi vs Sin Messi</div>
  <div class="s2-sub">${N_SIMS.toLocaleString('es-ES')} finales por escenario</div>
  <div class="compare-block">
    <div>
      <div class="compare-section-title tit-con">✅ CON Messi</div>
      <div class="bar-row">
        <div class="br-flag">🇪🇸</div>
        <div class="br-bar-wrap"><div class="br-bar bar-esp" id="bA" data-w="${bwA}"></div></div>
        <div class="br-val" style="color:#2196f3">${d.pctA}%</div>
      </div>
      <div class="bar-row">
        <div class="br-flag">🇦🇷</div>
        <div class="br-bar-wrap"><div class="br-bar bar-arg" id="bB" data-w="${bwB}"></div></div>
        <div class="br-val" style="color:#F5C518">${d.pctB}%</div>
      </div>
    </div>
    <div>
      <div class="compare-section-title tit-sin">❌ SIN Messi</div>
      <div class="bar-row">
        <div class="br-flag">🇪🇸</div>
        <div class="br-bar-wrap"><div class="br-bar bar-esp" id="bAm" data-w="${bwAm}"></div></div>
        <div class="br-val" style="color:#2196f3">${d.pctAmessi}%</div>
      </div>
      <div class="bar-row">
        <div class="br-flag">🇦🇷</div>
        <div class="br-bar-wrap"><div class="br-bar bar-arg" id="bBm" data-w="${bwBm}"></div></div>
        <div class="br-val" style="color:#F5C518">${d.pctBmessi}%</div>
      </div>
    </div>
  </div>
</div>

<div class="scene" id="s3">
  <div class="s3-tag">⚡ La diferencia Messi</div>
  <div class="s3-num">${diffAbs}%</div>
  <div class="s3-lbl">menos probabilidades para Argentina<br><b>sin Lionel Messi</b></div>
  <div class="s3-conclusion">Argentina sigue siendo<br><span>favorita incluso sin él</span><br>¿Lo esperabas? 👀</div>
</div>

<div class="scene" id="s4">
  <div class="cta-q">¿Juega <span class="cta-acc">Messi</span><br>al 100%<br>mañana? 🤔</div>
  <div class="cta-box"><div class="cta-url">golazox.com/final</div></div>
  <span class="cta-arr">👇</span>
  <div class="cta-free">Simúlalo · Gratis · Sin registro</div>
</div>

<script>
(function(){
  const cv=document.getElementById('cv'),cx=cv.getContext('2d');
  cv.width=${WIDTH};cv.height=${HEIGHT};
  const pts=Array.from({length:120},()=>({x:Math.random()*${WIDTH},y:Math.random()*${HEIGHT},vx:(Math.random()-.5)*.35,vy:-(Math.random()*.45+.1),r:Math.random()*2+.4,a:Math.random()*.3+.05,c:Math.random()<.5?'#FF4444':'#AA2222'}));
  function dp(){cx.clearRect(0,0,${WIDTH},${HEIGHT});pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.y<-5)p.y=${HEIGHT}+5;if(p.x<0)p.x=${WIDTH};if(p.x>${WIDTH})p.x=0;cx.beginPath();cx.arc(p.x,p.y,p.r,0,Math.PI*2);cx.fillStyle=p.c;cx.globalAlpha=p.a;cx.fill()});cx.globalAlpha=1;requestAnimationFrame(dp);}
  dp();
})();
const SCENES=[{id:'s1',start:0,end:3.5},{id:'s2',start:3.5,end:17},{id:'s3',start:17,end:22.5},{id:'s4',start:22.5,end:27}];
let t0=null,s2done=false;
function loop(ts){
  if(!t0)t0=ts;
  const e=(ts-t0)/1000;
  SCENES.forEach(s=>{const el=document.getElementById(s.id);if(el)el.classList.toggle('active',e>=s.start&&e<s.end)});
  if(e>=3.5&&!s2done){
    s2done=true;
    setTimeout(()=>{['bA','bB','bAm','bBm'].forEach((id,i)=>{
      const b=document.getElementById(id);
      if(b) setTimeout(()=>{b.style.width=b.dataset.w+'%'},i*400);
    });},400);
  }
  if(e<27)requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script></body></html>`;
}

// ── Record video ──────────────────────────────────────────────────────────────
async function recordVideo(html, outPath, durationS, browser) {
  const port = 51000 + Math.floor(Math.random() * 8000);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise(r => server.listen(port, r));

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0' });

  const rawPath = outPath.replace(/\.mp4$/, '_raw.mp4');
  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: false, fps: FPS,
    videoFrame: { width: WIDTH, height: HEIGHT },
    videoCrf: 18, videoCodec: 'libx264',
    videoPreset: 'ultrafast', videoBitrate: 8000,
  });

  await recorder.start(rawPath);
  await new Promise(r => setTimeout(r, durationS * 1000 + 600));
  await recorder.stop();
  await page.close();
  server.close();

  const hasMusicFile = fs.existsSync(MUSIC_FILE);
  if (hasMusicFile) {
    try {
      const ff  = require('ffmpeg-static');
      const cmd = `"${ff}" -y -i "${rawPath}" -i "${MUSIC_FILE}" `
        + `-filter_complex "[1:a]volume=0.5,afade=t=in:st=0:d=1.5,afade=t=out:st=${durationS-2}:d=2[a]" `
        + `-map 0:v -map "[a]" -c:v copy -c:a aac -shortest "${outPath}"`;
      execSync(cmd, { stdio: 'pipe' });
      fs.unlinkSync(rawPath);
    } catch (e) {
      fs.renameSync(rawPath, outPath);
    }
  } else {
    fs.renameSync(rawPath, outPath);
  }
  console.log(`  ✅ ${path.basename(outPath)} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
  return outPath;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const data = runSimulations();
  console.log(`\n[data] Yamal: marca ${data.yamalPct}% | España gana si marca: ${data.yamalEspWin}%`);
  console.log(`[data] Top score: ${data.topScores[0]?.score} (${data.topScores[0]?.pct}%)`);
  console.log(`[data] Sin Messi: Argentina ${data.pctBmessi}% vs ${data.pctB}% con Messi\n`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox',`--window-size=${WIDTH},${HEIGHT}`,'--disable-web-security','--disable-gpu'],
  });

  try {
    console.log('[1/3] Generando video Yamal...');
    await recordVideo(buildYamalHTML(data),     path.join(OUTPUT_DIR, `yamal_wc2026_${ts}.mp4`),     27, browser);

    console.log('[2/3] Generando video marcadores exactos...');
    await recordVideo(buildScoresHTML(data),    path.join(OUTPUT_DIR, `scores_wc2026_${ts}.mp4`),    27, browser);

    console.log('[3/3] Generando video sin Messi...');
    await recordVideo(buildSinMessiHTML(data),  path.join(OUTPUT_DIR, `sinmessi_wc2026_${ts}.mp4`),  27, browser);
  } finally {
    await browser.close();
  }

  console.log('\n🎬 3 videos listos en ./videos/');
  console.log('   📱 Orden sugerido para publicar hoy:');
  console.log('   10:00 → scores_wc2026_   (marcador exacto — viral)');
  console.log('   18:00 → yamal_wc2026_    (Yamal — debate)');
  console.log('   22:00 → sinmessi_wc2026_ (sin Messi — polémico)');
}

main().catch(e => { console.error(e); process.exit(1); });
