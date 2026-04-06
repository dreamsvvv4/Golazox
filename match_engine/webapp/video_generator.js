/**
 * video_generator.js — GolazOX TikTok Video Generator
 *
 * Graba una simulación de golazox.com con Puppeteer en formato 9:16 (TikTok/Reels).
 * El sitio ya tiene el UI — solo navegamos y grabamos.
 *
 * Usage:
 *   node video_generator.js                          → partido aleatorio
 *   node video_generator.js --type match             → partido histórico
 *   node video_generator.js --type ucl               → draw Champions
 *   node video_generator.js --type wc                → Mundial fase de grupos
 *   node video_generator.js --teamA "Real Madrid" --teamB "Barcelona" --eraA 2002 --eraB 2009
 *
 * Output: ./videos/golazox_YYYYMMDD_HHmmss.mp4
 *
 * Requirements:
 *   npm install puppeteer puppeteer-screen-recorder
 */

'use strict';

// Point fluent-ffmpeg at the bundled ffmpeg binary (no system install needed)
process.env.FFMPEG_PATH = require('ffmpeg-static');

const puppeteer               = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path  = require('path');
const fs    = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL   = process.env.GOLAZOX_URL || 'https://golazox.com';
const OUTPUT_DIR = path.join(__dirname, 'videos');
const WIDTH      = 1080;   // TikTok vertical 9:16
const HEIGHT     = 1920;

// Clásicos épicos para rotación automática
const CLASICOS = [
  { teamA: 'real-madrid',    eraA: '2002', teamB: 'barcelona',       eraB: '2009' },
  { teamA: 'ac-mailand',     eraA: '1989', teamB: 'fc-liverpool',    eraB: '2005' },
  { teamA: 'brasil',         eraA: '1970', teamB: 'argentinien',     eraB: '1986' },
  { teamA: 'fc-barcelona',   eraA: '2011', teamB: 'fc-bayern',       eraB: '2013' },
  { teamA: 'manchester-utd', eraA: '1999', teamB: 'fc-chelsea',      eraB: '2012' },
  { teamA: 'juventus-turin', eraA: '1997', teamB: 'real-madrid',     eraB: '2018' },
  { teamA: 'frankreich',     eraA: '1998', teamB: 'brasilien',       eraB: '2002' },
  { teamA: 'atletico-madrid',eraA: '2016', teamB: 'real-madrid',     eraB: '2016' },
  { teamA: 'fc-liverpool',   eraA: '1984', teamB: 'as-rom',          eraB: '1984' },
  { teamA: 'psg',            eraA: '2017', teamB: 'fc-barcelona',    eraB: '2017' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeOutputPath() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  return path.join(OUTPUT_DIR, `golazox_${ts}.mp4`);
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main generator ────────────────────────────────────────────────────────────
async function generateVideo(opts = {}) {
  const type    = opts.type || process.env.VIDEO_TYPE || 'match';
  const outPath = opts.outPath || makeOutputPath();

  console.log(`[video] Generating type=${type} → ${outPath}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  // Hide scrollbars, set dark theme body bg for clean recording
  await page.evaluateOnNewDocument(() => {
    document.documentElement.style.overflow = 'hidden';
  });

  const recorder = new PuppeteerScreenRecorder(page, {
    fps: 30,
    videoFrame: { width: WIDTH, height: HEIGHT },
    videoCrf: 18,
    videoCodec: 'libx264',
    videoPreset: 'ultrafast',
    videoBitrate: 4000,
  });

  let videoTitle = 'GolazOX Simulación';

  try {
    if (type === 'match') {
      videoTitle = await recordMatch(page, recorder, outPath, opts);
    } else if (type === 'ucl') {
      videoTitle = await recordUCL(page, recorder, outPath);
    } else if (type === 'wc') {
      videoTitle = await recordWC(page, recorder, outPath);
    } else {
      videoTitle = await recordMatch(page, recorder, outPath, opts);
    }
  } finally {
    await browser.close();
  }

  console.log(`[video] Done → ${outPath}`);
  return { path: outPath, title: videoTitle };
}

// ── Record a single match ─────────────────────────────────────────────────────
async function recordMatch(page, recorder, outPath, opts = {}) {
  const clasico = opts.teamA ? {
    teamA: opts.teamA, eraA: opts.eraA || '',
    teamB: opts.teamB, eraB: opts.eraB || '',
  } : randomPick(CLASICOS);

  // Navigate to the partido SEO URL if it exists
  const url = `${BASE_URL}/?tab=match`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  await recorder.start(outPath);

  // Fill Team A
  await page.waitForSelector('#team-a-input', { timeout: 10000 });
  await page.click('#team-a-input', { clickCount: 3 });
  await page.type('#team-a-input', clasico.teamA, { delay: 30 });
  if (clasico.eraA) {
    await wait(500);
    // Pick era from dropdown if visible
    try {
      await page.waitForSelector('.suggestion-item', { timeout: 3000 });
      const items = await page.$$('.suggestion-item');
      for (const item of items) {
        const txt = await item.evaluate(el => el.textContent);
        if (txt.includes(clasico.eraA)) { await item.click(); break; }
        if (items.indexOf(item) === items.length - 1) await items[0].click();
      }
    } catch { /* no dropdown, continue */ }
  }

  await wait(400);

  // Fill Team B
  await page.click('#team-b-input', { clickCount: 3 });
  await page.type('#team-b-input', clasico.teamB, { delay: 30 });
  if (clasico.eraB) {
    await wait(500);
    try {
      await page.waitForSelector('.suggestion-item', { timeout: 3000 });
      const items = await page.$$('.suggestion-item');
      for (const item of items) {
        const txt = await item.evaluate(el => el.textContent);
        if (txt.includes(clasico.eraB)) { await item.click(); break; }
        if (items.indexOf(item) === items.length - 1) await items[0].click();
      }
    } catch { /* no dropdown */ }
  }

  await wait(600);

  // Click simulate
  await page.waitForSelector('#simulate-btn', { timeout: 10000 });
  await page.click('#simulate-btn');

  // Wait for result to appear (the score or timeline)
  await page.waitForSelector('.result-score, .match-result, #result-section', {
    timeout: 20000,
  });

  // Let the animations play
  await wait(8000);

  // Scroll down slowly to show timeline/events
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let y = 0;
      const max = document.body.scrollHeight - window.innerHeight;
      const step = () => {
        y = Math.min(y + 12, max);
        window.scrollTo(0, y);
        if (y < max) requestAnimationFrame(step);
        else setTimeout(resolve, 3000);
      };
      requestAnimationFrame(step);
    });
  });

  await wait(2000);

  // Scroll back to top for ending
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(2000);

  await recorder.stop();

  const titleA = clasico.teamA.replace(/-/g, ' ');
  const titleB = clasico.teamB.replace(/-/g, ' ');
  const eraStr = clasico.eraA && clasico.eraB ? ` (${clasico.eraA} vs ${clasico.eraB})` : '';
  return `${titleA} vs ${titleB}${eraStr} — golazox.com`;
}

// ── Record UCL tournament draw + all matches + final standings ────────────────
async function recordUCL(page, recorder, outPath) {
  await page.goto(`${BASE_URL}/?tab=trn`, { waitUntil: 'networkidle0', timeout: 30000 });
  await wait(1500);

  await recorder.start(outPath);

  // 1. Click UCL preset card (data-preset="ucl2026") to open the draw/edit panel
  await page.waitForSelector('[data-preset="ucl2026"]', { timeout: 10000 });
  await page.click('[data-preset="ucl2026"]');
  console.log('[ucl] Clicked preset card');
  await wait(2000);

  // 2. Click "⏳ Sorteando..." button (#ucl-start-btn) to start the draw
  const drewButton = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-start-btn');
    if (btn) { 
      btn.click();
      return { found: true, text: btn.textContent.trim() };
    }
    return { found: false };
  });
  
  if (drewButton.found) {
    console.log(`[ucl] Clicked draw button: "${drewButton.text}"`);
  }
  
  // 3. Wait for draw to complete (~15-20 seconds) — button will hide and #ucl-sim-btn will appear
  console.log('[ucl] Waiting for draw to complete...');
  let drawComplete = false;
  for (let i = 0; i < 50; i++) {
    await wait(400);
    const simBtnExists = await page.evaluate(() => {
      const simbtn = document.querySelector('#ucl-sim-btn');
      return simbtn && simbtn.offsetParent !== null;  // visible
    });
    if (simBtnExists) {
      console.log('[ucl] Draw complete — Simular button appeared');
      drawComplete = true;
      break;
    }
  }

  if (!drawComplete) {
    console.log('[ucl] Draw button still processing... continuing anyway');
  }

  await wait(1500);

  // 4. Click "#ucl-sim-btn" to start the tournament simulation
  const startSim = await page.evaluate(() => {
    const simBtn = document.querySelector('#ucl-sim-btn');
    if (simBtn && simBtn.offsetParent !== null) { 
      simBtn.click();
      return { found: true, text: simBtn.textContent.trim() };
    }
    return { found: false };
  });
  
  if (startSim.found) {
    console.log(`[ucl] Started tournament via ucl-sim-btn: "${startSim.text}"`);
    await wait(4000);
  } else {
    console.log('[ucl] Proceeding to find Siguiente buttons for phase simulation...');
    await wait(2000);
  }

  // 5. Simulate all matches — click "Siguiente →" or "Simular" buttons repeatedly
  for (let step = 0; step < 30; step++) {
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const btn = btns.find(b => {
        const t = b.textContent.trim();
        const visible = b.offsetParent !== null;
        // Look for "Siguiente", "Simular", arrow buttons
        return visible && (
          t.includes('Siguiente') || t.includes('Next') || t === '→' ||
          (t.includes('Simular') && !t.includes('Champions'))
        ) && !t.includes('Atrás') && !t.includes('Back');
      });
      if (btn) { 
        btn.click(); 
        return btn.textContent.trim(); 
      }
      return null;
    });
    
    if (clicked) {
      console.log(`[ucl] Round ${step + 1}: "${clicked.substring(0, 25)}..."`);
      await wait(3000);
      // Scroll slowly to show results
      await page.evaluate(() => {
        window.scrollBy(0, 200);
      });
      await wait(400);
    } else {
      console.log(`[ucl] Tournament complete at round ${step}`);
      break;
    }
  }

  // 6. Scroll down to show champion and cuadro de goleadores (top scorers)
  await wait(2000);
  console.log('[ucl] Scrolling to show champion & final standings...');
  
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let y = window.scrollY;
      const max = document.body.scrollHeight - window.innerHeight;
      const scrollStep = 28;
      
      const scroll = () => {
        y = Math.min(y + scrollStep, max);
        window.scrollTo(0, y);
        if (y < max) {
          setTimeout(scroll, 110);
        } else {
          // Hold at bottom to display champion and top scorers
          setTimeout(resolve, 7000);
        }
      };
      setTimeout(scroll, 600);
    });
  });

  // 7. Scroll back to top for clean ending
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(1500);

  await recorder.stop();

  return 'Champions League 2025/26 — Torneo Completo — golazox.com';
}

// ── Record World Cup simulation ───────────────────────────────────────────────
async function recordWC(page, recorder, outPath) {
  await page.goto(`${BASE_URL}/?tab=trn`, { waitUntil: 'networkidle0', timeout: 30000 });

  await recorder.start(outPath);

  // Click WC preset
  try {
    await page.waitForSelector('[data-preset="wc"], .trn-preset-wc, #btn-wc', { timeout: 8000 });
    await page.click('[data-preset="wc"], .trn-preset-wc, #btn-wc');
  } catch {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const btn = btns.find(b => b.textContent.includes('Mundial') || b.textContent.includes('World Cup') || b.textContent.includes('WC'));
      if (btn) btn.click();
    });
  }

  await wait(2000);

  // Start
  try {
    await page.waitForSelector('#trn-start-btn, .start-tournament', { timeout: 8000 });
    await page.click('#trn-start-btn, .start-tournament');
  } catch {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const btn = btns.find(b => b.textContent.includes('Simular') || b.textContent.includes('Start'));
      if (btn) btn.click();
    });
  }

  await wait(3000);

  // Scroll through
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let y = 0;
      const max = Math.min(document.body.scrollHeight - window.innerHeight, 8000);
      const step = () => {
        y = Math.min(y + 6, max);
        window.scrollTo(0, y);
        if (y < max) requestAnimationFrame(step);
        else setTimeout(resolve, 4000);
      };
      setTimeout(() => requestAnimationFrame(step), 500);
    });
  });

  await wait(2000);
  await recorder.stop();

  return 'World Cup 2026 Simulado — golazox.com';
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const opts = {
    type:  get('--type'),
    teamA: get('--teamA'),
    teamB: get('--teamB'),
    eraA:  get('--eraA'),
    eraB:  get('--eraB'),
  };

  generateVideo(opts)
    .then(({ path: p, title: t }) => {
      console.log(`\nVideo: ${p}\nTitle: ${t}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('[video] ERROR:', err.message);
      process.exit(1);
    });
}

module.exports = { generateVideo };
