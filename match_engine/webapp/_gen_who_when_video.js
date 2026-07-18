/**
 * _gen_who_when_video.js — WC2026 Final · 2 TikTok Videos
 *
 * Corre 1.000 simulaciones una vez y genera:
 *   1. scorer_wc2026_TIMESTAMP.mp4  — "¿Quién marcará en la Final?"
 *   2. minutes_wc2026_TIMESTAMP.mp4 — "¿A qué minuto caerá el gol?"
 *
 * Usage: node _gen_who_when_video.js
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
const N_SIMS     = 1000;

// ── Run 1.000 simulations, collect scorers + minute distribution ──────────
function runSimulations() {
  const { simulateMatch } = require('./engine.js');
  const sp = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', 'spanien.json'),     'utf8')).seasons['2026'];
  const ar = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', 'argentinien.json'), 'utf8')).seasons['2026'];

  const scorerMap    = {};           // name → { count, team }
  const minuteBuckets = new Array(10).fill(0); // 10-min slots: 0-9, 10-19 … 90+
  let totalGoals = 0;

  console.log(`[sims] Ejecutando ${N_SIMS.toLocaleString('es-ES')} simulaciones...`);
  const t0 = Date.now();

  for (let i = 0; i < N_SIMS; i++) {
    if (i % 200 === 0) process.stdout.write(`\r[sims] ${i}/${N_SIMS}...`);

    const sim = simulateMatch({
      teamA: 'España', teamB: 'Argentina',
      eraA: '2026',    eraB: '2026',
      formationA: sp.formation || '4-3-3',
      formationB: ar.formation || '4-5-1',
      cachedLineupA: { ...sp, found: true },
      cachedLineupB: { ...ar, found: true },
      matchMode: '11v11',
      matchSalt: i * 7919 + 99991,
      isFinal: true,
    });

    const sA = sim.finalScore?.scorersA || [];
    const sB = sim.finalScore?.scorersB || [];

    for (const g of sA) {
      if (!scorerMap[g.name]) scorerMap[g.name] = { count: 0, team: 'España' };
      scorerMap[g.name].count++;
      minuteBuckets[Math.min(Math.floor((g.minute || 45) / 10), 9)]++;
      totalGoals++;
    }
    for (const g of sB) {
      if (!scorerMap[g.name]) scorerMap[g.name] = { count: 0, team: 'Argentina' };
      scorerMap[g.name].count++;
      minuteBuckets[Math.min(Math.floor((g.minute || 45) / 10), 9)]++;
      totalGoals++;
    }
  }

  process.stdout.write(`\r[sims] ${N_SIMS}/${N_SIMS} ✓  (${Date.now() - t0}ms)\n`);

  const topScorers = Object.entries(scorerMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 9)
    .map(([name, d]) => ({
      name, count: d.count, team: d.team,
      pct: (d.count / N_SIMS * 100).toFixed(1),
    }));

  const maxBucket     = minuteBuckets.indexOf(Math.max(...minuteBuckets));
  const bucketLabels  = ["0'","10'","20'","30'","40'","50'","60'","70'","80'","90+'"];

  return { topScorers, minuteBuckets, bucketLabels, maxBucket, totalGoals };
}

// ── Badge → base64 ──────────────────────────────────────────────────────────
function badgeB64(slug) {
  const p = path.join(BADGES_DIR, `${slug}.png`);
  if (!fs.existsSync(p)) return '';
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── HTML: Video 1 — Scorer chart ─────────────────────────────────────────
function buildScorerHTML(d) {
  const badgeA = badgeB64('spanien');
  const badgeB = badgeB64('argentinien');

  const maxCount = d.topScorers[0]?.count || 1;
  const barScale = 84 / (d.topScorers[0]?.pct || 30);   // top scorer fills 84% of track

  const rowsHTML = d.topScorers.map((p, i) => {
    const isSpain = p.team === 'España';
    const flag    = isSpain ? '🇪🇸' : '🇦🇷';
    const barW    = (parseFloat(p.pct) * barScale).toFixed(1);
    const clr     = isSpain ? '#ff3352' : '#2196f3';
    const delay   = (3.4 + i * 0.55).toFixed(2);
    return `<div class="sc-row" id="scr-${i}" data-delay="${delay}">
      <div class="sc-flag">${flag}</div>
      <div class="sc-name">${esc(p.name)}</div>
      <div class="sc-bar-wrap">
        <div class="sc-bar" data-w="${barW}" style="background:linear-gradient(90deg,${clr}88,${clr})"></div>
      </div>
      <div class="sc-pct">${p.pct}%</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#07050f;font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
canvas{position:fixed;inset:0;z-index:0;pointer-events:none}

.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px;opacity:0;transition:opacity .4s;z-index:1}
.scene.active{opacity:1}

/* S1 */
#s1{background:radial-gradient(ellipse 80% 55% at 50% 40%,#1c0835 0%,#07050f 65%)}
.h-kicker{font-size:2.4rem;letter-spacing:.3em;color:#666;text-transform:uppercase;margin-bottom:2rem;opacity:0;animation:fadeUp .5s .3s forwards}
.h-q{font-size:5rem;font-weight:900;text-align:center;line-height:1.15;opacity:0;animation:fadeUp .6s .6s forwards}
.h-accent{color:#FFD700}
.h-badges{display:flex;align-items:center;gap:2.5rem;margin-top:3rem;opacity:0;animation:fadeUp .5s 1.2s forwards}
.h-badges img{width:100px;height:100px;object-fit:contain;filter:drop-shadow(0 0 16px rgba(255,215,0,.4))}
.h-vs{font-size:3.2rem;font-weight:900;color:#333}
.h-n{font-size:2.2rem;color:#556;margin-top:2.5rem;opacity:0;animation:fadeUp .5s 1.6s forwards}

/* S2 — Scorer bars */
#s2{background:radial-gradient(ellipse 80% 45% at 50% 10%,#0a0818 0%,#07050f 60%);justify-content:flex-start;padding-top:100px}
.s2-hed{font-size:2.8rem;font-weight:900;color:#FFD700;text-align:center;margin-bottom:.5rem}
.s2-sub{font-size:2rem;color:#556;text-align:center;margin-bottom:3.5rem}
.sc-rows{width:100%;display:flex;flex-direction:column;gap:2.2rem}
.sc-row{
  display:flex;align-items:center;gap:1.8rem;
  opacity:0;transform:translateX(60px);
}
.sc-row.in{opacity:1;transform:translateX(0);transition:opacity .4s,transform .4s cubic-bezier(.2,0,.1,1)}
.sc-flag{font-size:2.8rem;flex-shrink:0;width:3.2rem;text-align:center}
.sc-name{font-size:2.6rem;font-weight:700;flex:0 0 auto;width:28rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-bar-wrap{flex:1;height:40px;background:rgba(255,255,255,.07);border-radius:20px;overflow:hidden}
.sc-bar{height:100%;border-radius:20px;width:0%;transition:width .6s ease}
.sc-pct{font-size:2.8rem;font-weight:700;color:#FFD700;flex-shrink:0;width:7rem;text-align:right}

/* S3 — Spotlight */
#s3{background:radial-gradient(ellipse 70% 60% at 50% 50%,#1a0c00 0%,#07050f 65%)}
.sp-tag{font-size:2.2rem;letter-spacing:.22em;color:#666;text-transform:uppercase;margin-bottom:2.5rem}
.sp-star{font-size:5rem;opacity:0;animation:scaleIn .6s .3s forwards}
.sp-name{
  font-size:6.5rem;font-weight:900;text-align:center;line-height:1;
  background:linear-gradient(135deg,#FFD700,#FF6B35);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  opacity:0;animation:scaleIn .7s .7s cubic-bezier(.34,1.56,.64,1) forwards;
}
.sp-team{font-size:3rem;color:#aaa;margin-top:1.2rem;opacity:0;animation:fadeUp .5s 1.1s forwards}
.sp-stat{font-size:3.5rem;font-weight:700;color:#fff;margin-top:1.5rem;opacity:0;animation:fadeUp .5s 1.4s forwards}
.sp-stat span{color:#FFD700}
.sp-sim{font-size:2.2rem;color:#556;margin-top:1rem;opacity:0;animation:fadeUp .5s 1.7s forwards}

/* S4 — CTA */
#s4{background:radial-gradient(ellipse 80% 55% at 50% 60%,#1a0835 0%,#07050f 65%)}
.cta-q{font-size:3.8rem;font-weight:900;text-align:center;line-height:1.25;opacity:0;animation:fadeUp .6s .2s forwards}
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

<!-- S1 -->
<div class="scene" id="s1">
  <div class="h-kicker">Motor Monte Carlo · IA</div>
  <div class="h-q">¿Quién<br>marcará en la<br><span class="h-accent">Final?</span></div>
  <div class="h-badges">
    ${badgeA ? `<img src="${badgeA}"/>` : '🇪🇸'}
    <span class="h-vs">VS</span>
    ${badgeB ? `<img src="${badgeB}"/>` : '🇦🇷'}
  </div>
  <div class="h-n">${N_SIMS.toLocaleString('es-ES')} finales simuladas</div>
</div>

<!-- S2 -->
<div class="scene" id="s2">
  <div class="s2-hed">⚽ Probabilidad de Gol</div>
  <div class="s2-sub">% de simulaciones en las que marcó</div>
  <div class="sc-rows">${rowsHTML}</div>
</div>

<!-- S3 -->
<div class="scene" id="s3">
  <div class="sp-tag">⭐ Jugador Más Decisivo</div>
  <div class="sp-star">⚽</div>
  <div class="sp-name">${esc(d.topScorers[0]?.name || 'Lamine Yamal')}</div>
  <div class="sp-team">${esc(d.topScorers[0]?.team || 'España')}</div>
  <div class="sp-stat">Marcó en el <span>${d.topScorers[0]?.pct || '0'}%</span> de las finales</div>
  <div class="sp-sim">En ${Math.round(parseFloat(d.topScorers[0]?.pct || 0) * N_SIMS / 100).toLocaleString('es-ES')} de ${N_SIMS.toLocaleString('es-ES')} partidos</div>
</div>

<!-- S4 -->
<div class="scene" id="s4">
  <div class="cta-q">¿Cuál es tu<br><span class="cta-acc">predicción</span>?</div>
  <div class="cta-box"><div class="cta-url">golazox.com/final</div></div>
  <span class="cta-arr">👇</span>
  <div class="cta-free">Gratis · Sin registro</div>
</div>

<script>
(function(){
  const cv=document.getElementById('cv'),cx=cv.getContext('2d');
  cv.width=${WIDTH};cv.height=${HEIGHT};
  const pts=Array.from({length:120},()=>({x:Math.random()*${WIDTH},y:Math.random()*${HEIGHT},vx:(Math.random()-.5)*.35,vy:-(Math.random()*.45+.1),r:Math.random()*2+.4,a:Math.random()*.3+.05,c:Math.random()<.5?'#FFD700':'#7755FF'}));
  function drawPts(){cx.clearRect(0,0,${WIDTH},${HEIGHT});pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.y<-5)p.y=${HEIGHT}+5;if(p.x<0)p.x=${WIDTH};if(p.x>${WIDTH})p.x=0;cx.beginPath();cx.arc(p.x,p.y,p.r,0,Math.PI*2);cx.fillStyle=p.c;cx.globalAlpha=p.a;cx.fill()});cx.globalAlpha=1;requestAnimationFrame(drawPts);}
  drawPts();
})();

const SCENES = [{id:'s1',start:0,end:3.5},{id:'s2',start:3.5,end:17},{id:'s3',start:17,end:22.5},{id:'s4',start:22.5,end:26}];
const DATA = { topScorers: ${JSON.stringify(d.topScorers)} };

let t0=null, s2done=false;
function loop(ts){
  if(!t0)t0=ts;
  const e=(ts-t0)/1000;
  SCENES.forEach(s=>{const el=document.getElementById(s.id);if(el)el.classList.toggle('active',e>=s.start&&e<s.end)});

  if(e>=3.5&&!s2done){
    s2done=true;
    document.querySelectorAll('.sc-row').forEach((row,i)=>{
      const d=parseFloat(row.dataset.delay)-3.5;
      setTimeout(()=>{
        row.classList.add('in');
        const bar=row.querySelector('.sc-bar');
        if(bar) setTimeout(()=>{bar.style.width=bar.dataset.w+'%'},200);
      }, Math.max(0,d*1000));
    });
  }
  if(e<26)requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script></body></html>`;
}

// ── HTML: Video 2 — Minute histogram (dynamic clock version) ─────────────
function buildMinutesHTML(d) {
  const badgeA = badgeB64('spanien');
  const badgeB = badgeB64('argentinien');

  const maxCount = Math.max(...d.minuteBuckets, 1);
  const maxBarH  = 720;
  const barW     = 76;
  const gapW     = 14;

  const sortedCounts = [...d.minuteBuckets].sort((a, b) => b - a);
  const top3Threshold = sortedCounts[2] || 0;

  const barsHTML = d.minuteBuckets.map((cnt, i) => {
    const h      = Math.round(cnt / maxCount * maxBarH);
    const isBest = i === d.maxBucket;
    const isTop  = cnt >= top3Threshold && !isBest;
    const pct    = (cnt / d.totalGoals * 100).toFixed(1);
    return `<div class="hcol">
      <div class="hbar-wrap">
        <div class="hbar ${isBest ? 'hbar-best' : isTop ? 'hbar-top' : ''}"
             id="hbar-${i}" data-h="${h}" data-cnt="${cnt}" style="height:0px">
          <div class="hbar-cnt" id="hcnt-${i}"></div>
          ${isBest ? `<div class="hbar-pct">${pct}%</div>` : ''}
        </div>
      </div>
      <div class="hlabel ${isBest ? 'hlabel-best' : ''}">${d.bucketLabels[i]}</div>
    </div>`;
  }).join('');

  const dangerMinute = d.bucketLabels[d.maxBucket];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#050d07;font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px;opacity:0;transition:opacity .4s;z-index:1}
.scene.active{opacity:1}

/* S1 */
#s1{background:radial-gradient(ellipse 80% 55% at 50% 40%,#041a06 0%,#050d07 65%)}
.h1-kicker{font-size:2.4rem;letter-spacing:.3em;color:#556;text-transform:uppercase;margin-bottom:2rem;opacity:0;animation:fadeUp .5s .3s forwards}
.h1-q{font-size:5.2rem;font-weight:900;text-align:center;line-height:1.15;opacity:0;animation:fadeUp .6s .6s forwards}
.h1-acc{color:#00E676}
.h1-n{font-size:2.2rem;color:#445;margin-top:2.5rem;opacity:0;animation:fadeUp .5s 1.2s forwards}
.h1-bdgs{display:flex;gap:2.5rem;align-items:center;margin-top:2.5rem;opacity:0;animation:fadeUp .5s 1.6s forwards}
.h1-bdgs img{width:90px;height:90px;object-fit:contain;filter:drop-shadow(0 0 14px rgba(0,230,118,.3))}
.h1-vs{font-size:2.8rem;font-weight:900;color:#333}

/* S2 — Histogram */
#s2{background:radial-gradient(ellipse 80% 45% at 50% 15%,#041a06 0%,#050d07 60%);justify-content:flex-start;padding-top:80px}
.s2-hed{font-size:2.8rem;font-weight:900;color:#00E676;text-align:center;margin-bottom:.5rem}
.s2-sub{font-size:2rem;color:#445;text-align:center;margin-bottom:2rem}
/* Match clock + goal tally row */
.s2-hud{display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:2rem;padding:0 0.5rem}
.hud-clock{display:flex;align-items:center;gap:1rem}
.hud-clock-icon{font-size:3.5rem}
.hud-clock-val{font-size:5rem;font-weight:900;color:#fff;min-width:5rem;font-variant-numeric:tabular-nums}
.hud-goals{display:flex;align-items:center;gap:1rem}
.hud-goals-icon{font-size:3.5rem}
.hud-goals-val{font-size:4.5rem;font-weight:900;color:#00E676;min-width:4rem;text-align:right;font-variant-numeric:tabular-nums}
.hud-goals-lbl{font-size:2rem;color:#445}
/* Histogram */
.hist{
  width:100%;display:flex;align-items:flex-end;justify-content:center;
  gap:${gapW}px;height:${maxBarH + 70}px;
}
.hcol{display:flex;flex-direction:column;align-items:center;width:${barW}px;flex-shrink:0}
.hbar-wrap{display:flex;align-items:flex-end;height:${maxBarH}px;width:100%}
.hbar{
  width:100%;border-radius:6px 6px 0 0;
  background:rgba(255,255,255,.12);
  position:relative;overflow:visible;
}
.hbar-top{background:linear-gradient(0deg,#005500,#00CC44)}
.hbar-best{background:linear-gradient(0deg,#c87000,#FFD700);box-shadow:0 0 24px rgba(255,215,0,.55)}
@keyframes flashBar{0%{filter:brightness(2.5) drop-shadow(0 0 18px #fff)}100%{filter:brightness(1) drop-shadow(0 0 0px transparent)}}
.hbar-flash{animation:flashBar .7s ease-out forwards}
.hbar-cnt{
  position:absolute;top:-3.2rem;left:50%;transform:translateX(-50%);
  font-size:1.9rem;font-weight:900;color:#888;white-space:nowrap;
  opacity:0;transition:opacity .3s;
}
.hbar-cnt.show{opacity:1}
.hbar-pct{
  position:absolute;top:-6.5rem;left:50%;transform:translateX(-50%);
  font-size:2.2rem;font-weight:900;color:#FFD700;white-space:nowrap;
}
.hlabel{font-size:1.75rem;color:#445;margin-top:.8rem;text-align:center;white-space:nowrap}
.hlabel-best{color:#FFD700;font-weight:900}

/* S3 — Key stat */
#s3{background:radial-gradient(ellipse 70% 60% at 50% 50%,#0a1400 0%,#050d07 65%)}
.st-tag{font-size:2.2rem;letter-spacing:.2em;color:#556;text-transform:uppercase;margin-bottom:2.5rem}
.st-clock{font-size:6rem;opacity:0;animation:scaleIn .6s .3s forwards}
.st-label{font-size:2.8rem;color:#888;text-align:center;margin-bottom:1rem;opacity:0;animation:fadeUp .5s .7s forwards}
.st-minute{
  font-size:8rem;font-weight:900;
  color:#FFD700;filter:drop-shadow(0 0 20px rgba(255,215,0,.5));
  opacity:0;animation:scaleIn .75s 1s cubic-bezier(.34,1.56,.64,1) forwards;
}
.st-desc{font-size:2.8rem;font-weight:700;text-align:center;margin-top:1.5rem;opacity:0;animation:fadeUp .5s 1.5s forwards}
.st-desc span{color:#00E676}
.st-sub{font-size:2.2rem;color:#556;margin-top:1.2rem;opacity:0;animation:fadeUp .5s 1.9s forwards}

/* S4 */
#s4{background:radial-gradient(ellipse 80% 55% at 50% 60%,#041a06 0%,#050d07 65%)}
.cta-q{font-size:3.8rem;font-weight:900;text-align:center;line-height:1.25;opacity:0;animation:fadeUp .6s .2s forwards}
.cta-acc{color:#00E676}
.cta-box{border:4px solid #00E676;border-radius:22px;padding:1.5rem 3.5rem;margin-top:3.5rem;opacity:0;animation:scaleIn .6s .8s cubic-bezier(.34,1.56,.64,1) forwards}
.cta-url{font-size:4.2rem;font-weight:900;color:#00E676}
.cta-arr{font-size:4.8rem;display:block;text-align:center;margin-top:2.5rem;opacity:0;animation:fadeUp .4s 1.2s forwards,bounce 1.1s 1.2s infinite}
.cta-free{font-size:2.2rem;color:#445;margin-top:1.8rem;opacity:0;animation:fadeUp .5s 1.5s forwards}

@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
</style></head><body>
<canvas id="cv"></canvas>

<!-- S1 -->
<div class="scene" id="s1">
  <div class="h1-kicker">Motor Monte Carlo · IA</div>
  <div class="h1-q">¿A qué<br>minuto cae<br>el <span class="h1-acc">gol?</span></div>
  <div class="h1-n">${N_SIMS.toLocaleString('es-ES')} finales · ${d.totalGoals.toLocaleString('es-ES')} goles</div>
  <div class="h1-bdgs">
    ${badgeA ? `<img src="${badgeA}"/>` : '🇪🇸'}
    <span class="h1-vs">VS</span>
    ${badgeB ? `<img src="${badgeB}"/>` : '🇦🇷'}
  </div>
</div>

<!-- S2 -->
<div class="scene" id="s2">
  <div class="s2-hed">⚽ Goles por franja — ${N_SIMS.toLocaleString('es-ES')} finales</div>
  <div class="s2-sub">${d.totalGoals.toLocaleString('es-ES')} goles analizados</div>
  <div class="s2-hud">
    <div class="hud-clock">
      <span class="hud-clock-icon">⏱️</span>
      <span class="hud-clock-val" id="mclock">0'</span>
    </div>
    <div class="hud-goals">
      <span class="hud-goals-val" id="gctr">0</span>
      <span class="hud-goals-lbl">goles</span>
      <span class="hud-goals-icon">⚽</span>
    </div>
  </div>
  <div class="hist">
    ${barsHTML}
  </div>
</div>

<!-- S3 -->
<div class="scene" id="s3">
  <div class="st-tag">⚡ Minuto Más Peligroso</div>
  <div class="st-clock">⏱️</div>
  <div class="st-label">La franja con más goles en ${N_SIMS.toLocaleString('es-ES')} finales</div>
  <div class="st-minute">${dangerMinute}</div>
  <div class="st-desc"><span>${d.minuteBuckets[d.maxBucket].toLocaleString('es-ES')}</span> goles en esta franja</div>
  <div class="st-sub">${(d.minuteBuckets[d.maxBucket] / d.totalGoals * 100).toFixed(1)}% de todos los goles de la final</div>
</div>

<!-- S4 -->
<div class="scene" id="s4">
  <div class="cta-q">Simúlalo<br><span class="cta-acc">tú mismo</span></div>
  <div class="cta-box"><div class="cta-url">golazox.com/final</div></div>
  <span class="cta-arr">👇</span>
  <div class="cta-free">Gratis · Sin registro</div>
</div>

<script>
(function(){
  const cv=document.getElementById('cv'),cx=cv.getContext('2d');
  cv.width=${WIDTH};cv.height=${HEIGHT};
  const pts=Array.from({length:120},()=>({x:Math.random()*${WIDTH},y:Math.random()*${HEIGHT},vx:(Math.random()-.5)*.35,vy:-(Math.random()*.45+.1),r:Math.random()*2+.4,a:Math.random()*.3+.05,c:Math.random()<.6?'#00E676':'#00CC44'}));
  function dp(){cx.clearRect(0,0,${WIDTH},${HEIGHT});pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.y<-5)p.y=${HEIGHT}+5;if(p.x<0)p.x=${WIDTH};if(p.x>${WIDTH})p.x=0;cx.beginPath();cx.arc(p.x,p.y,p.r,0,Math.PI*2);cx.fillStyle=p.c;cx.globalAlpha=p.a;cx.fill()});cx.globalAlpha=1;requestAnimationFrame(dp);}
  dp();
})();

const SCENES=[{id:'s1',start:0,end:3.5},{id:'s2',start:3.5,end:17},{id:'s3',start:17,end:22.5},{id:'s4',start:22.5,end:26}];
const BUCKETS=[${d.minuteBuckets.join(',')}];
const BUCKET_LABELS=[${d.bucketLabels.map(l=>`'${l}'`).join(',')}];
// Each bar reveals every 1.05s → 10 bars over ~10.5s (3.5→14s)
const REVEAL_EVERY=1.05;
let t0=null,lastBar=-1,accumulated=0;

function loop(ts){
  if(!t0)t0=ts;
  const e=(ts-t0)/1000;
  SCENES.forEach(s=>{const el=document.getElementById(s.id);if(el)el.classList.toggle('active',e>=s.start&&e<s.end)});

  // ── S2: clock-driven bar reveal ──
  if(e>=3.5&&e<17){
    const elapsed=e-3.5;
    // Clock: 0'→90+' over 10.5s
    const minute=Math.min(Math.floor(elapsed/10.5*95),95);
    const clockEl=document.getElementById('mclock');
    if(clockEl) clockEl.textContent=(minute>=90?'90+\'':minute+'\'');

    // Reveal bars sequentially
    const barIdx=Math.min(Math.floor(elapsed/REVEAL_EVERY),9);
    if(barIdx>lastBar){
      for(let b=lastBar+1;b<=barIdx;b++){
        const bar=document.getElementById('hbar-'+b);
        if(bar){
          bar.style.transition='height 0.85s cubic-bezier(0.34,1.1,0.64,1)';
          bar.style.height=bar.dataset.h+'px';
          bar.classList.add('hbar-flash');
          setTimeout(()=>bar.classList.remove('hbar-flash'),800);
          // Show count label
          const cntEl=document.getElementById('hcnt-'+b);
          if(cntEl){setTimeout(()=>{cntEl.textContent=BUCKETS[b];cntEl.classList.add('show');},600);}
          accumulated+=BUCKETS[b];
        }
      }
      lastBar=barIdx;
      const gEl=document.getElementById('gctr');
      if(gEl) gEl.textContent=accumulated.toLocaleString('es-ES');
    }
  }
  if(e<26)requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script></body></html>`;
}

// ── Record a video from HTML ──────────────────────────────────────────────
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

  // Mix music
  const hasMusicFile = fs.existsSync(MUSIC_FILE);
  let finalPath = rawPath;
  if (hasMusicFile) {
    try {
      const ff  = require('ffmpeg-static');
      const cmd = `"${ff}" -y -i "${rawPath}" -i "${MUSIC_FILE}" `
        + `-filter_complex "[1:a]volume=0.5,afade=t=in:st=0:d=1.5,afade=t=out:st=${durationS-2}:d=2[a]" `
        + `-map 0:v -map "[a]" -c:v copy -c:a aac -shortest "${outPath}"`;
      execSync(cmd, { stdio: 'pipe' });
      fs.unlinkSync(rawPath);
      finalPath = outPath;
    } catch (e) {
      fs.renameSync(rawPath, outPath);
      finalPath = outPath;
    }
  } else {
    fs.renameSync(rawPath, outPath);
    finalPath = outPath;
  }
  return finalPath;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Simulations (shared)
  const data = runSimulations();

  console.log(`[data] Top scorer: ${data.topScorers[0]?.name} (${data.topScorers[0]?.pct}%)`);
  console.log(`[data] Total goles: ${data.totalGoals}`);
  console.log(`[data] Minuto más peligroso: ${data.bucketLabels[data.maxBucket]} (${data.minuteBuckets[data.maxBucket]} goles)`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // 2. Launch shared browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox',`--window-size=${WIDTH},${HEIGHT}`,'--disable-web-security','--disable-gpu'],
  });

  // 3. Video 1 — Scorer chart
  console.log('[video 1/2] Iniciando scorer video...');
  const scorerPath = path.join(OUTPUT_DIR, `scorer_wc2026_${ts}.mp4`);
  await recordVideo(buildScorerHTML(data), scorerPath, 26, browser);
  console.log('[video 1/2] ✅', scorerPath);

  // 4. Video 2 — Minutes histogram
  console.log('[video 2/2] Iniciando minutes video...');
  const minutesPath = path.join(OUTPUT_DIR, `minutes_wc2026_${ts}.mp4`);
  await recordVideo(buildMinutesHTML(data), minutesPath, 26, browser);
  console.log('[video 2/2] ✅', minutesPath);

  await browser.close();

  // 5. Summary
  console.log('\n📊 RESULTADOS:');
  console.log('   Top goleadores:');
  data.topScorers.forEach((p, i) =>
    console.log(`   #${i+1}: ${p.name} (${p.team}) — ${p.pct}%`)
  );
  console.log(`\n   Minutos más peligrosos:`);
  const sorted = [...data.minuteBuckets].map((c,i)=>({i,c})).sort((a,b)=>b.c-a.c).slice(0,3);
  sorted.forEach(b => console.log(`   ${data.bucketLabels[b.i]}: ${b.c} goles (${(b.c/data.totalGoals*100).toFixed(1)}%)`));

  console.log(`\n📱 VIDEOS:`);
  console.log(`   ${scorerPath}`);
  console.log(`   ${minutesPath}`);

  console.log(`\n📝 CAPTIONS:`);
  console.log(`\n   VIDEO 1 (¿Quién marca?):`);
  console.log(`   ─────────────────────────────────────────────────`);
  console.log(`   Simulé la Final del Mundial ${N_SIMS.toLocaleString('es-ES')} veces 🤖⚽`);
  console.log(`   ${data.topScorers[0]?.name} marcó en el ${data.topScorers[0]?.pct}% de los partidos...`);
  console.log(`   Simúlalo tú mismo 👉 golazox.com/final`);
  console.log(`   #Mundial2026 #EspañaArgentina #FinalMundial #LamineYamal #GolazOX`);
  console.log(`   ─────────────────────────────────────────────────`);
  console.log(`\n   VIDEO 2 (¿A qué minuto?):`);
  console.log(`   ─────────────────────────────────────────────────`);
  console.log(`   Analicé ${data.totalGoals.toLocaleString('es-ES')} goles de la Final del Mundial 🤖⚽`);
  console.log(`   El minuto más peligroso es... ${data.bucketLabels[data.maxBucket]}`);
  console.log(`   Simúlalo tú mismo 👉 golazox.com/final`);
  console.log(`   #Mundial2026 #EspañaArgentina #FinalMundial #GolazOX #IA`);
  console.log(`   ─────────────────────────────────────────────────`);

  process.exit(0);
}

main().catch(err => { console.error('[fatal]', err); process.exit(1); });
