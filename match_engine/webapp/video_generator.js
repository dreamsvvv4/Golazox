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
      '--window-size=720,1280',   // logical viewport — DPR 1.5 scales to 1080x1920 physical
    ],
  });

  const page = await browser.newPage();
  // deviceScaleFactor:1.5 → browser renders at 720×1280 CSS px (large text)
  // but produces 1080×1920 physical pixels — no black bars, no distortion
  await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 1.5 });

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

// ── Record UCL tournament: draw → server simulation (~32s) → show champion + tabs ──
async function recordUCL(page, recorder, outPath) {
  await page.goto(`${BASE_URL}/?tab=trn`, { waitUntil: 'networkidle0', timeout: 30000 });
  await wait(1500);

  await recorder.start(outPath);

  // 1. Click UCL preset card to open the draw panel
  await page.waitForSelector('[data-preset="ucl2026"]', { timeout: 10000 });
  await page.click('[data-preset="ucl2026"]');
  console.log('[ucl] Preset opened');
  await wait(2000);

  // 2. Click SORTEAR (#ucl-start-btn) to run the animated draw
  await page.evaluate(() => document.querySelector('#ucl-start-btn')?.click());
  console.log('[ucl] Draw started...');

  // 3. Wait for draw animation to complete (~6s) — #ucl-sim-btn appears when done
  for (let i = 0; i < 30; i++) {
    await wait(400);
    const simVisible = await page.evaluate(() => {
      const btn = document.querySelector('#ucl-sim-btn');
      return btn && btn.offsetParent !== null;
    });
    if (simVisible) { console.log(`[ucl] Draw complete at ${(i * 0.4).toFixed(1)}s`); break; }
  }
  await wait(1000);  // Brief pause to show the draw result on screen

  // 4. Click "⚽ Simular Champions" (#ucl-sim-btn) — triggers server-side simulation
  const simText = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-sim-btn');
    if (btn) { btn.click(); return btn.textContent.trim(); }
    return null;
  });
  console.log(`[ucl] Simulation launched: "${simText}". Waiting for results (~30s)...`);

  // 5. Wait for server simulation to complete — poll until spinner gone + content loaded
  // The simulation calls /simulate-bulk multiple times and takes ~32 seconds
  const simStart = Date.now();
  for (let i = 0; i < 60; i++) {
    await wait(2000);
    const done = await page.evaluate(() => {
      const spinner = document.querySelector('.trn-spinner');
      const spinnerVisible = spinner && spinner.offsetParent !== null;
      const textLen = document.body.innerText.length;
      // Simulation done when spinner gone and content is rich (> 2000 chars)
      return !spinnerVisible && textLen > 2000;
    });
    const elapsed = Math.round((Date.now() - simStart) / 1000);
    if (done) {
      console.log(`[ucl] Simulation complete at ${elapsed}s`);
      break;
    }
    if (elapsed > 90) { console.log('[ucl] Timeout — proceeding anyway'); break; }
  }

  await wait(1500);

  // 6. Scroll slowly from top to show the champion banner
  console.log('[ucl] Scrolling to champion...');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(500);
  // Slow scroll down to reveal champion + path to title
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let y = 0;
      const target = Math.min(document.body.scrollHeight * 0.35, 1200);
      const step = () => {
        y = Math.min(y + 18, target);
        window.scrollTo(0, y);
        if (y < target) setTimeout(step, 80);
        else setTimeout(resolve, 3000);  // Pause on champion
      };
      step();
    });
  });

  // Helper: click a tab by keyword, scroll vertically + horizontal for Cuadro bracket
  const showTab = async (keyword) => {
    const found = await page.evaluate((kw) => {
      const tabs = [...document.querySelectorAll('button, [role="tab"]')];
      const tab = tabs.find(t => t.offsetParent !== null && t.textContent.includes(kw));
      if (tab) { tab.click(); return tab.textContent.trim(); }
      return null;
    }, keyword);
    if (found) {
      console.log(`[ucl] Tab → "${found}"`);
      await wait(800);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await wait(300);

      // Cuadro (bracket): scroll down to see PLAY-IN section, then scroll right to reveal KO rounds
      if (keyword === 'Cuadro') {
        // First: scroll vertically to show the PLAY-IN / octavos section
        await page.evaluate(async () => {
          await new Promise(resolve => {
            let y = 0;
            const target = Math.min(document.body.scrollHeight * 0.4, 800);
            const step = () => {
              y = Math.min(y + 14, target);
              window.scrollTo(0, y);
              if (y < target) setTimeout(step, 80);
              else setTimeout(resolve, 1500);
            };
            step();
          });
        });
        // Then: scroll the bracket container RIGHT to reveal cuartos → semis → final
        await page.evaluate(async () => {
          await new Promise(resolve => {
            const el = document.querySelector('#trn-tab-bracket');
            if (!el) return resolve();
            let x = 0;
            const max = el.scrollWidth - el.clientWidth;
            if (max <= 0) return setTimeout(resolve, 4000);
            const step = () => {
              x = Math.min(x + 14, max);
              el.scrollLeft = x;
              if (x < max) setTimeout(step, 100);
              else setTimeout(resolve, 4000);  // Pause on the final
            };
            setTimeout(step, 500);
          });
        });
      } else {
        // All other tabs: normal vertical scroll
        await page.evaluate(async () => {
          await new Promise(resolve => {
            let y = 0;
            const max = document.body.scrollHeight - window.innerHeight;
            const step = () => {
              y = Math.min(y + 20, max);
              window.scrollTo(0, y);
              if (y < max) setTimeout(step, 80);
              else setTimeout(resolve, 3500);
            };
            step();
          });
        });
      }
    }
    return !!found;
  };

  // 7. Recorre las 4 tabs en orden: Resumen → Cuadro → Calendario → Estadísticas
  await showTab('Resumen', 'Resumen');
  await showTab('Cuadro', 'Cuadro');
  await showTab('Calendario', 'Calendario');
  await showTab('Estadística', 'Estadísticas');

  // 8. Scroll back to top for clean ending
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
