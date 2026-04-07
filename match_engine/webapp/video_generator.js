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
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { execSync, spawnSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL   = process.env.GOLAZOX_URL || 'https://golazox.com';
const OUTPUT_DIR = path.join(__dirname, 'videos');
const ASSETS_DIR = path.join(__dirname, 'assets');
const WIDTH      = 1080;   // TikTok vertical 9:16
const HEIGHT     = 1920;
const MUSIC_FILE = path.join(ASSETS_DIR, 'music_epic.mp3');
const MUSIC_VOLUME = 0.30;  // 0–1: background music level (30% so UI sounds stay audible)

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

// ── ffmpeg helper ─────────────────────────────────────────────────────────────
function ffmpeg(args) {
  const ffmpegBin = process.env.FFMPEG_PATH;
  const result = spawnSync(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    const errMsg = (result.stderr || '').toString().slice(-800);
    throw new Error(`ffmpeg error (${result.status}):\n${errMsg}`);
  }
  return result;
}

/**
 * createIntroVideo — generates a 5-second intro clip with:
 *   • Dark gradient background
 *   • "UEFA Champions League 2025/26" text fading in
 *   • "golazox.com" subtitle
 */
function createIntroVideo(outFile, durationSec = 5) {
  const w = WIDTH, h = HEIGHT;
  const d = durationSec;
  // lavfi: color + drawtext (two lines), fade-in 0→1s, fade-out last 0.5s
  const vf = [
    // Background gradient (dark blue → black)
    `[0:v]scale=${w}:${h}[bg]`,
    // Title text
    `[bg]drawtext=text='UEFA Champions League':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h/2-120:alpha='if(lt(t,1),t,if(gt(t,${d-0.5}),${d}-t,1))':shadowx=3:shadowy=3:shadowcolor=0x00000080`,
    // Subtitle text
    `drawtext=text='2025/26':fontsize=100:fontcolor=gold:x=(w-text_w)/2:y=h/2+20:alpha='if(lt(t,1.2),max(0,t-0.2),if(gt(t,${d-0.5}),${d}-t,1))':shadowx=3:shadowy=3:shadowcolor=0x00000080`,
    // Site text
    `drawtext=text='golazox.com':fontsize=55:fontcolor=0xCCCCCC:x=(w-text_w)/2:y=h/2+180:alpha='if(lt(t,1.5),max(0,t-0.5),if(gt(t,${d-0.5}),${d}-t,1))':shadowx=2:shadowy=2`,
  ].join(',');

  ffmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=0x0a1628:size=${w}x${h}:rate=30:duration=${d}`,
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-an',
    outFile,
  ]);
}

/**
 * postProcess — runs after Puppeteer recording:
 *   1. Creates a 5s intro clip
 *   2. Concatenates intro + main recording
 *   3. Mixes looped background music at MUSIC_VOLUME
 *
 * Returns the final output path (overwrites outPath).
 */
async function postProcess(outPath, type) {
  if (!fs.existsSync(MUSIC_FILE)) {
    console.log('[post] No music file found at', MUSIC_FILE, '— skipping audio mix');
    return outPath;
  }

  const tmp = os.tmpdir();
  const introPath  = path.join(tmp, 'golazox_intro.mp4');
  const concatPath = path.join(tmp, 'golazox_concat.mp4');
  const listFile   = path.join(tmp, 'golazox_list.txt');
  const finalPath  = outPath.replace('.mp4', '_final.mp4');

  console.log('[post] Creating intro clip...');
  try {
    createIntroVideo(introPath, 5);
  } catch (e) {
    console.warn('[post] Intro creation failed:', e.message.slice(0, 200), '— skipping intro');
    // Fall through to just add music without intro
  }

  const hasIntro = fs.existsSync(introPath);

  if (hasIntro) {
    console.log('[post] Concatenating intro + main...');
    fs.writeFileSync(listFile, `file '${introPath.replace(/\\/g, '/')}'\nfile '${outPath.replace(/\\/g, '/')}'`);
    try {
      ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', concatPath]);
    } catch (e) {
      console.warn('[post] Concat failed:', e.message.slice(0, 200), '— using main only');
      fs.copyFileSync(outPath, concatPath);
    }
  } else {
    fs.copyFileSync(outPath, concatPath);
  }

  console.log('[post] Mixing background music...');
  try {
    ffmpeg([
      '-y',
      '-i', concatPath,
      '-stream_loop', '-1', '-i', MUSIC_FILE,
      '-filter_complex',
        `[1:a]volume=${MUSIC_VOLUME}[music];[0:a]anull[orig];[orig][music]amix=inputs=2:duration=first:dropout_transition=3[aout]`,
      '-map', '0:v', '-map', '[aout]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest',
      finalPath,
    ]);
    // Replace original with final
    fs.renameSync(finalPath, outPath);
    console.log('[post] Done — music mixed into', outPath);
  } catch (e) {
    // If video has no audio track, try without [orig]
    console.warn('[post] amix failed (no source audio?), trying video-only mix...');
    try {
      ffmpeg([
        '-y',
        '-i', concatPath,
        '-stream_loop', '-1', '-i', MUSIC_FILE,
        '-filter_complex', `[1:a]volume=${MUSIC_VOLUME}[aout]`,
        '-map', '0:v', '-map', '[aout]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest',
        finalPath,
      ]);
      fs.renameSync(finalPath, outPath);
      console.log('[post] Done — music added (no source audio) →', outPath);
    } catch (e2) {
      console.warn('[post] Music mix failed entirely:', e2.message.slice(0, 200));
    }
  }

  // Cleanup temp files
  [introPath, concatPath, listFile].forEach(f => { try { fs.unlinkSync(f); } catch {} });

  return outPath;
}

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

  // Disable scroll anchoring globally — prevents browser from jumping to maintain visual position
  // when tab content changes height. Also hide scrollbars.
  await page.evaluateOnNewDocument(() => {
    const s = document.createElement('style');
    s.textContent = '* { overflow-anchor: none !important; scroll-behavior: auto !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
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

  // Post-process: add intro card + background music
  await postProcess(outPath, type);

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

  // 6. Already on Resumen after simulation — reset to top and prepare for tab scrolls
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(500);

  // Reset ALL scroll positions — window + every scrollable container
  const resetAllScroll = () => page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll('*').forEach(el => {
      if (el.scrollTop !== 0) el.scrollTop = 0;
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
    });
  });

  // showTab: click tab → wait for render → single hard-reset → pause → scroll down once
  const showTab = async (keyword) => {
    const found = await page.evaluate((kw) => {
      const tabs = [...document.querySelectorAll('button, [role="tab"]')];
      const tab = tabs.find(t => t.offsetParent !== null && t.textContent.includes(kw));
      if (tab) { tab.click(); return tab.textContent.trim(); }
      return null;
    }, keyword);
    if (!found) return false;

    console.log(`[ucl] Tab → "${found}"`);

    // Wait for tab content to fully render, then single reset
    await wait(600);
    await resetAllScroll();
    await wait(700);  // Hold at top so viewer sees the tab heading

    if (keyword === 'Cuadro') {
      // Scroll down to show PLAY-IN section
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let y = 0;
          const target = Math.min(document.body.scrollHeight * 0.4, 800);
          const step = () => {
            y = Math.min(y + 15, target);
            window.scrollTo(0, y);
            if (y < target) setTimeout(step, 80);
            else setTimeout(resolve, 1500);
          };
          step();
        });
      });
      // Scroll bracket container RIGHT to reveal KO rounds, with a mid-scroll pause
      await page.evaluate(async () => {
        await new Promise(resolve => {
          const el = document.querySelector('#trn-tab-bracket');
          if (!el) return resolve();
          let x = 0;
          const max = el.scrollWidth - el.clientWidth;
          if (max <= 0) return setTimeout(resolve, 4000);
          const MID = max / 2;  // pause briefly at the midpoint
          let pausedAtMid = false;
          const step = () => {
            x = Math.min(x + 12, max);
            el.scrollLeft = x;
            if (x >= max) { setTimeout(resolve, 3500); return; }
            // Pause at midpoint so viewer can read the left half of the bracket
            if (!pausedAtMid && x >= MID) {
              pausedAtMid = true;
              setTimeout(step, 1200);
            } else {
              setTimeout(step, 100);
            }
          };
          setTimeout(step, 500);
        });
      });
    } else {
      // Scroll slowly from top to bottom with reading pauses every ~350px
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let y = 0;
          let lastPause = 0;
          const PAUSE_EVERY = 350;   // px between reading pauses
          const PAUSE_MS    = 1200;  // ms to hold still
          const max = document.body.scrollHeight - window.innerHeight;
          if (max <= 0) return setTimeout(resolve, 3000);
          const step = () => {
            y = Math.min(y + 15, max);
            window.scrollTo(0, y);
            if (y >= max) { setTimeout(resolve, 3500); return; }
            // Insert a reading pause when we've scrolled another PAUSE_EVERY px
            if (y - lastPause >= PAUSE_EVERY) {
              lastPause = y;
              setTimeout(step, PAUSE_MS);  // hold still so viewer can read
            } else {
              setTimeout(step, 80);
            }
          };
          step();
        });
      });
    }
    return true;
  };

  // 7. Resumen (already active — scroll without re-clicking) → Cuadro → Calendario → Estadísticas
  console.log('[ucl] Tab → "Resumen" (already active)');
  await wait(700);  // Hold at top so viewer sees the tab heading
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let y = 0;
      let lastPause = 0;
      const PAUSE_EVERY = 350;
      const PAUSE_MS    = 1200;
      const max = document.body.scrollHeight - window.innerHeight;
      if (max <= 0) return setTimeout(resolve, 3000);
      const step = () => {
        y = Math.min(y + 15, max);
        window.scrollTo(0, y);
        if (y >= max) { setTimeout(resolve, 3500); return; }
        if (y - lastPause >= PAUSE_EVERY) {
          lastPause = y;
          setTimeout(step, PAUSE_MS);
        } else {
          setTimeout(step, 80);
        }
      };
      step();
    });
  });
  await showTab('Cuadro');
  await showTab('Calendario');
  await showTab('Estadística');

  // 8. Clean ending
  await page.evaluate(() => window.scrollTo(0, 0));
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
