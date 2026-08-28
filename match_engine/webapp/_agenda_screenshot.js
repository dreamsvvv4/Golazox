/**
 * _agenda_screenshot.js
 * Generates a 1080×1920 PNG and short MP4 showing the agenda for a date.
 * Usage: node _agenda_screenshot.js [YYYY-MM-DD]
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = __dirname;
const DATA = path.join(BASE, 'data', 'agenda.json');
const OUT_DIR = path.join(BASE, 'videos');
const FONTS_DIR = path.join(BASE, 'assets', 'fonts');
const PUBLIC_DIR = path.join(BASE, 'public');

function readAgenda() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return { events: [] }; }
}

function pickEventsFor(dateStr) {
  const raw = readAgenda();
  const events = (raw.events || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  // Exact same-day events
  const sameDay = events.filter(e => e.date === dateStr);

  // Gather fixtures from snapshot and TV guide cache for the same date
  const fixtures = readFixturesForDate(dateStr);
  let tvEvents = [];
  try {
    const tvCacheFile = path.join(BASE, 'data', '.cache', 'tvguide.json');
    const rawTv = JSON.parse(fs.readFileSync(tvCacheFile, 'utf8'));
    if (rawTv && rawTv.data && Array.isArray(rawTv.data.days) && rawTv.data.days.length) {
      // Find the tvguide day that matches the requested dateStr (e.g. '2026-08-28')
      const spanishMonths = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const dt = new Date(dateStr);
      const dayNum = String(dt.getDate());
      const monAbbr = spanishMonths[dt.getMonth()];
      const tvKey = `${dayNum} ${monAbbr}`; // e.g. '28 ago'

      // Try to find exact match first, then fallback to labels like 'Hoy'/'Mañana',
      // then fallback to any day that contains the day number.
      let chosenDay = rawTv.data.days.find(d => String(d.dateStr || '').toLowerCase() === tvKey);
      if (!chosenDay) {
        // If the requested date is today or tomorrow, try matching label
        const today = new Date();
        const diff = Math.floor((dt - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
        if (diff === 0) chosenDay = rawTv.data.days.find(d => String(d.label || '').toLowerCase().includes('hoy'));
        else if (diff === 1) chosenDay = rawTv.data.days.find(d => String(d.label || '').toLowerCase().includes('ma') || String(d.label || '').toLowerCase().includes('mañ')); // 'Mañana' variations
      }
      if (!chosenDay) {
        chosenDay = rawTv.data.days.find(d => (d.dateStr || '').toString().indexOf(dayNum) !== -1);
      }
          if (chosenDay && Array.isArray(chosenDay.events)) {
            tvEvents = chosenDay.events.map(e => ({ date: dateStr, time: e.time || '', icon: '📺', title: e.teams || (e.home && e.away ? `${e.home} - ${e.away}` : ''), comp: e.competition || e.competition || '', desc: '', tv: e.channel || '', __src: 'tv' }));
          }
    }
  } catch (e) { /* ignore missing cache */ }

  // Allow local manual overrides: data/agenda_manual.json with events array
  try {
    const manualFile = path.join(BASE, 'data', 'agenda_manual.json');
    if (fs.existsSync(manualFile)) {
      const rawManual = JSON.parse(fs.readFileSync(manualFile, 'utf8'));
      if (rawManual && Array.isArray(rawManual.events)) {
        const extra = rawManual.events.filter(e => e.date === dateStr).map(e => ({ date: dateStr, time: e.time || '', icon: e.icon || '📺', title: e.title || e.teams || '', comp: e.comp || '', desc: e.desc || '', tv: e.channel || '', __src: 'manual' }));
        if (extra.length) tvEvents = tvEvents.concat(extra);
      }
    }
  } catch (e) { /* ignore manual parse errors */ }

  // Merge: prefer tvEvents and fixtures ahead of curated agenda for coverage
  // Produce a stable canonical key for match titles.
  // Handles variants like 'Celta - Osasuna', 'Celta vs Osasuna', 'Osasuna v Celta'
  const canonicalTitle = (s) => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    // unify separators and common 'vs' markers
    .replace(/\b(vs\.?|v\.?|versus)\b/g, ' ')
    .replace(/[–—‑]/g, '-')
    // remove club type words
    .replace(/[^a-z0-9\-\s]/g, ' ')
    .replace(/\b(fc|cf|club|ca|rcd|rc|real|de|la|el)\b/g, ' ')
    // drop year numbers and common competition words to improve dedupe
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(champions|champion|liga|league|uefa|europa|conference|fase|fase de la|fase de)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // For matches like 'teamA - teamB', create a symmetric key by sorting team names
  const canonicalTeamName = (raw) => {
    if (!raw) return '';
    const s = raw.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    // remove punctuation, keep words
    const words = s.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const stop = new Set(['de','del','la','el','los','las','y','the','fc','cf','club','rc','rcd','cd','ca','ud','sd','ac','sc','the']);
    const filtered = words.filter(w => !stop.has(w));
    if (!filtered.length) return words.join(' ');
    // pick the most representative token (longest)
    let best = filtered[0];
    for (const w of filtered) if (w.length > best.length) best = w;
    return best;
  };

  const canonicalMatchKey = (s) => {
    if (!s) return '';
    // try splitting on common separators first
    const raw = (s || '').toString();
    const sepRegex = /\s*(?:-|–|—|\|)\s*/;
    let parts = raw.split(sepRegex).map(p => p.trim()).filter(Boolean);
    if (parts.length !== 2) {
      // fallback to vs/ v / versus variants
      const vsRegex = /\s+(?:vs?\.?|versus)\s+/i;
      parts = raw.split(vsRegex).map(p => p.trim()).filter(Boolean);
    }
    if (parts.length === 2) {
      const a = canonicalTeamName(parts[0]);
      const b = canonicalTeamName(parts[1]);
      const ordered = [a, b].sort();
      return ordered.join(' | ');
    }
    // otherwise, fallback to simple canonical title
    return canonicalTitle(s);
  };
  // DEBUG: helper para inspeccionar títulos y claves (se usará temporalmente)
  const inspectEntries = (label, arr) => {
    try {
      console.log(`--- ${label} (${arr.length}) ---`);
      for (const e of (arr || [])) {
        const t = e && e.title ? String(e.title) : JSON.stringify(e);
        const src = e && e.__src ? ` [${e.__src}]` : '';
        console.log(canonicalMatchKey(t), ' <-- ', t, src);
      }
    } catch (e) { /* ignore */ }
  };
  const mergedMap = new Map();
  const pushIfNew = (it) => {
    if (!it || !it.title) return;
    const key = canonicalMatchKey(it.title);
    if (!key) return;
    // If exact key exists, prefer agenda source to replace TV/fixtures
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      if (it.__src === 'agenda' && existing && existing.__src !== 'agenda') mergedMap.set(key, it);
      return;
    }
    // Prevent near-duplicate keys: if any existing key contains this key or viceversa
    for (const existingKey of Array.from(mergedMap.keys())) {
      if (!existingKey || !key) continue;
      if (existingKey.includes(key) || key.includes(existingKey)) {
        const existing = mergedMap.get(existingKey);
        // prefer explicit agenda entries when colliding
        if (it.__src === 'agenda' && existing && existing.__src !== 'agenda') {
          mergedMap.set(existingKey, it);
        }
        // otherwise keep the existing entry (do not add duplicate)
        return;
      }
    }
    mergedMap.set(key, it);
  };
  // attach source tags to fixtures and agenda entries for diagnostics
  const fixturesTagged = fixtures.map(f => ({ ...f, __src: f.__src || 'fixtures' }));
  const sameDayTagged = sameDay.map(s => ({ ...s, __src: s.__src || 'agenda' }));
  // Inspect inputs to debug duplicates
  inspectEntries('TV events', tvEvents);
  inspectEntries('Fixtures', fixturesTagged);
  inspectEntries('Agenda (sameDay)', sameDayTagged);

  tvEvents.forEach(pushIfNew);
  fixturesTagged.forEach(pushIfNew);
  sameDayTagged.forEach(pushIfNew);
  // diagnostics: which canonical keys exist across all sources but were not added to mergedMap?
  const allKeys = new Set();
  for (const it of [...tvEvents, ...fixturesTagged, ...sameDayTagged]) {
    try { const k = canonicalMatchKey(it.title); if (k) allKeys.add(k); } catch {}
  }
  // list any source items without title that would be dropped
  const missingTitles = [];
  for (const it of [...tvEvents, ...fixturesTagged, ...sameDayTagged]) if (!it.title) missingTitles.push(it);
  if (missingTitles.length) console.log('--- ITEMS WITHOUT TITLE (dropped):', missingTitles.length, JSON.stringify(missingTitles.slice(0,10)));
  const missing = [];
  for (const k of allKeys) if (!mergedMap.has(k)) missing.push(k);
  if (missing.length) console.log('--- MISSING after merge (keys present in sources but not merged):', missing);
  // Inspect merged results
  inspectEntries('MergedSameDay (after merge)', Array.from(mergedMap.values()));
  let mergedSameDay = Array.from(mergedMap.values());
  // For draw/sorteo entries, prefer TV competition label if it mentions Europa/Conference
  try {
    for (const e of mergedSameDay) {
      const key = canonicalMatchKey(e.title);
      if (!key) continue;
      const isDraw = (e && e.type === 'draw') || /sorteo|draw|fase de liga/i.test(String(e.title||''));
      if (!isDraw) continue;
      // find tv event with same canonical key
      const tvMatch = tvEvents.find(t => canonicalMatchKey(t.title) === key && t.comp);
      if (tvMatch && /europa|conference/i.test(String(tvMatch.comp||tvMatch.competition||''))) {
        e.comp = tvMatch.comp || tvMatch.competition || e.comp;
        // If agenda title incorrectly mentions Champions but TV labels it Europa/Conference,
        // adjust the visible title to avoid showing wrong competition.
        try {
          if (/champions/i.test(String(e.title||''))) {
            e.title = String(e.title).replace(/champions/ig, 'Europa League');
          }
        } catch (err) {}
      }
    }
  } catch (err) { /* ignore */ }
  // sort merged results: put draws/events without time at the end, otherwise by time asc
  const timeToMinutes = (t) => {
    if (!t) return Infinity;
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    if (!m) return Infinity;
    return parseInt(m[1],10)*60 + parseInt(m[2],10);
  };
  mergedSameDay.sort((a,b) => {
    const aIsDraw = (a && a.type === 'draw') || /sorteo|draw|final/.test((a && String(a.title||'')).toLowerCase());
    const bIsDraw = (b && b.type === 'draw') || /sorteo|draw|final/.test((b && String(b.title||'')).toLowerCase());
    if (aIsDraw && !bIsDraw) return 1;
    if (bIsDraw && !aIsDraw) return -1;
    const at = timeToMinutes(a && a.time);
    const bt = timeToMinutes(b && b.time);
    if (at !== bt) return at - bt;
    return 0;
  });
  if (mergedSameDay.length >= 1) return { date: dateStr, events: mergedSameDay };

  // If there's 1 or 2 events, include up to 3 upcoming events starting at dateStr
  const upcoming = events.filter(e => e.date >= dateStr);
  if (upcoming.length > 0) {
    const take = upcoming.slice(0, 3);
    // also append fixtures/tv for the target date if any and avoid duplicates
    const takeMap = new Map();
    take.forEach(t => takeMap.set(canonicalTitle(t.title || `${t.date}:${t.time||''}`), t));
    fixtures.forEach(f => { const k = canonicalTitle(f.title); if (!takeMap.has(k)) takeMap.set(k, f); });
    tvEvents.forEach(t => { const k = canonicalTitle(t.title); if (!takeMap.has(k)) takeMap.set(k, t); });
    return { date: dateStr, events: Array.from(takeMap.values()).slice(0, 3) };
  }

  // If no upcoming, fallback to latest available date (last day events)
  const sorted = events;
  const lastDate = sorted.length ? sorted[sorted.length-1].date : dateStr;
  return { date: lastDate, events: events.filter(e=>e.date===lastDate) };
}

function parseFixtureShortDate(short) {
  if (!short) return null;
  const s = String(short).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
  if (m) {
    const day = String(m[1]).padStart(2,'0');
    const mon = String(m[2]).padStart(2,'0');
    const year = m[3] || String(new Date().getFullYear());
    return `${year}-${mon}-${day}`;
  }
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0,10);
  return null;
}

function readFixturesForDate(dateStr) {
  try {
    const fp = path.join(BASE, 'data', 'fixtures_snapshot.json');
    if (!fs.existsSync(fp)) return [];
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8')) || {};
    const leagues = raw.leagues || raw || {};
    const out = [];
    for (const code of Object.keys(leagues)) {
      const L = leagues[code] || {};
      const rounds = L.fixtures || L.rounds || [];
      for (const rnd of rounds) {
        const matches = rnd.matches || (Array.isArray(rnd) ? rnd : []);
        for (const m of matches) {
          const d = parseFixtureShortDate(m.date);
          if (d === dateStr) {
            const home = (m.home && m.home.name) || m.home || '';
            const away = (m.away && m.away.name) || m.away || '';
            out.push({ date: dateStr, time: m.time || '', icon: '⚽', title: `${home} - ${away}`, comp: code, desc: m.score || '', __src: 'fixtures' });
          }
        }
      }
    }
    return out;
  } catch (e) {
    return [];
  }
}

function toDataUri(fp) {
  try { const buf = fs.readFileSync(fp); const ext = path.extname(fp).slice(1).toLowerCase(); const mime = ext==='svg'?'image/svg+xml':`image/${ext==='jpg'?'jpeg':ext}`; return `data:${mime};base64,${buf.toString('base64')}`; } catch { return null; }
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadFonts() {
  try {
    const raj = fs.readFileSync(path.join(FONTS_DIR, 'Rajdhani-Bold.ttf')).toString('base64');
    const bebas = fs.readFileSync(path.join(FONTS_DIR, 'BebasNeue-Regular.ttf')).toString('base64');
    return { raj, bebas };
  } catch { return {}; }
}

function buildHtml(context) {
  const { date, events } = context;
  const eventCount = (events && events.length) || 0;
  // Allow callers to force homogeneous sizing across multiple pages by
  // providing `context.sizingMax` (the max events on any page). If present
  // use that value for sizing decisions instead of the current page count.
  const sizingCount = (context && typeof context.sizingMax === 'number') ? context.sizingMax : eventCount;
  let titleSize = 64, compSize = 36, listGap = 12, titleBigSize = 120;
  if (sizingCount > 8) { titleSize = 40; compSize = 20; listGap = 8; titleBigSize = 90; }
  else if (sizingCount > 5) { titleSize = 48; compSize = 26; listGap = 10; titleBigSize = 102; }
  const fonts = loadFonts();
  const coin = toDataUri(path.join(PUBLIC_DIR, 'golazox-coin.png'));
  const wm = toDataUri(path.join(PUBLIC_DIR, 'golazox-wordmark.png'));

  const rajFace = fonts.raj ? `@font-face{font-family:Rajdhani;src:url(data:font/truetype;base64,${fonts.raj})}` : '';
  const bebasFace = fonts.bebas ? `@font-face{font-family:BebasNeue;src:url(data:font/truetype;base64,${fonts.bebas})}` : '';
  // slightly larger hero title for the intro cover
  const introTitleBig = Math.round(titleBigSize * 1.3);

  const isIntro = !events || events.length === 0;
  const itemsHtml = events.map(ev => {
    const time = ev.time ? `<div class="time">${escHtml(ev.time)}</div>` : '';
    const tv = ev.tv ? `<div class="tv">${escHtml(ev.tv)}</div>` : '';
    const icon = ev.icon ? `<div class="icon">${escHtml(ev.icon)}</div>` : '';
    return `<div class="event"><div class="left">${icon}<div class="date">${escHtml(ev.date)}</div></div><div class="body"><div class="title">${escHtml(ev.title)}</div><div class="comp">${escHtml(ev.comp || '')}</div><div class="desc">${escHtml(ev.desc || '')}</div><div class="meta">${time}${tv}</div></div></div>`;
  }).join('\n');

  // Header differs for intro (no events) to center title and logos
  const headerHtml = isIntro ?
    `${wm?`<img class="wm" src="${wm}">`:''}<div class="titlebig">Agenda del día</div><div class="date">${date}</div>` :
    `${wm?`<img class="wm" src="${wm}">`:''}<div style="margin-left:auto;text-align:right"><div class="titlebig">Agenda del día</div><div class="date">${date}</div></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><style>${rajFace}${bebasFace}
  *{box-sizing:border-box}
  html,body{width:1080px;height:1920px;margin:0;padding:0;background:radial-gradient(1200px 1200px at 20% 20%, #051425 0%, #071029 38%, #020316 100%);color:#fff;font-family:Rajdhani,Arial}
  .wrap{display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;padding:44px;position:relative}
  .wrap.has-events{padding:88px 44px 44px;justify-content:flex-start}
  .wrap.intro .footer{position:absolute;bottom:28px;width:100%;text-align:center}
  .hdr{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
  .coin{width:48px;opacity:0.95;display:none}
  .wm{width:260px;opacity:0.95;display:none}
  /* show wordmark on the intro/cover view */
  .wrap.intro .wm{display:block;width:360px;margin-bottom:10px;opacity:1}
  .wrap.intro .titlebig{font-family:BebasNeue,Arial;font-size:${introTitleBig}px;color:#FFDD00;letter-spacing:0.02em;text-shadow:0 18px 48px rgba(0,0,0,0.7)}
  .wrap.intro .date{font-size:56px;color:#cfe8ff;letter-spacing:0.06em;text-shadow:0 8px 20px rgba(0,0,0,0.5);margin-top:6px}
  .list{margin-top:22px;display:flex;flex-direction:column;gap:${listGap}px;overflow:auto;width:100%;max-width:920px}
  .event{display:flex;gap:12px;background:rgba(255,255,255,0.02);padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.03)}
  .left{width:160px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .badge{width:64px;height:64px;object-fit:contain;border-radius:8px;margin-right:10px}
  .icon{font-size:44px}
  .body{flex:1}
  .title{font-size:${titleSize}px;font-weight:800;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
  .comp{font-size:${compSize}px;color:#ffdca8;margin-top:8px;font-weight:800}
  .desc{font-size:30px;color:#cfe8ff;margin-top:10px}
  .meta{margin-top:10px;display:flex;gap:10px;align-items:center;justify-content:flex-end}
  .time{display:inline-block;padding:8px 12px;background:#0e2540;border-radius:12px;margin-right:8px;font-size:34px;font-weight:800;color:#fff}
  .tv{display:inline-block;padding:8px 12px;background:#10231a;border-radius:12px;font-size:34px;font-weight:800;color:#fff}
  .footer{margin-top:auto;text-align:center;font-size:18px;color:rgba(255,255,255,0.12);padding-bottom:28px}
  .cta{margin-top:14px;text-align:center;font-size:26px;color:#fff;font-weight:700;letter-spacing:.05em;background:linear-gradient(90deg,#0b1220,rgba(255,255,255,0.02));padding:8px 14px;border-radius:8px;display:inline-block}
  /* stronger hero background accent for intro */
  .wrap.intro{background:radial-gradient(900px 900px at 30% 12%, rgba(12,55,96,0.65), rgba(3,6,18,0.92)), linear-gradient(180deg,#041e2b 0%, #021022 100%)}
  .cta .site{color:#FFD700;margin-left:8px}
  </style></head><body><div class="wrap ${events && events.length? 'has-events':'intro'}"><div class="hdr">${headerHtml}</div><div class="list">${itemsHtml}</div><div class="footer">golazox.com</div></div></body></html>`;
}

async function run(targetDateArg) {
  const target = targetDateArg || new Date().toISOString().slice(0,10);
  const ctx = pickEventsFor(target);
  const html = buildHtml(ctx);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const pngOut = path.join(OUT_DIR, `agenda_${ctx.date}.png`);
  const mp4Out = path.join(OUT_DIR, `agenda_${ctx.date}.mp4`);

  const puppeteer = require('puppeteer');
  const ffmpeg = require('ffmpeg-static');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1080, height:1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: pngOut, type: 'png' });

    if (ffmpeg) {
      const args = ['-y','-loop','1','-i',pngOut,'-c:v','libx264','-t','6','-pix_fmt','yuv420p','-vf','scale=1080:1920', mp4Out];
      const r = spawnSync(ffmpeg, args, { stdio: 'inherit', timeout: 120000 });
      if (r.status === 0) console.log('Created', mp4Out);
      else console.error('ffmpeg failed to create MP4');
      // remove intermediate PNG if mp4 was created
      if (r.status === 0) {
        try { fs.unlinkSync(pngOut); } catch (e) {}
      }
    } else {
      console.log('ffmpeg not available — PNG created at', pngOut);
    }
  } finally {
    await browser.close();
  }
}

// Render HTML string to PNG and optionally MP4 (returns paths)
async function renderHtmlToPngMp4(html, outBase, duration = 6) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const pngOut = path.join(OUT_DIR, `${outBase}.png`);
  const mp4Out = path.join(OUT_DIR, `${outBase}.mp4`);
  const puppeteer = require('puppeteer');
  const ffmpeg = require('ffmpeg-static');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1080, height:1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: pngOut, type: 'png' });
    if (ffmpeg) {
      const args = ['-y','-loop','1','-i',pngOut,'-c:v','libx264','-t',String(duration),'-pix_fmt','yuv420p','-vf','scale=1080:1920', mp4Out];
      const r = spawnSync(ffmpeg, args, { stdio: 'inherit', timeout: 120000 });
      if (r.status !== 0) throw new Error('ffmpeg failed');
      // remove intermediate PNG if mp4 was created
      try { fs.unlinkSync(pngOut); } catch (e) {}
      return { mp4: mp4Out };
    }
    return { png: pngOut };
  } finally { await browser.close(); }
}

// Render an HTML string to a PNG file (returns png path)
async function renderHtmlToPng(html, outPath) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1080, height:1920, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: outPath, type: 'png' });
    return outPath;
  } finally {
    await browser.close();
  }
}

// Lightweight animated intro: render two PNGs (initial/final) and use ffmpeg xfade
async function renderIntroXfade(dateStr, outBase = `agenda_${dateStr}_intro_xfade`, opts = {}) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const ffmpeg = require('ffmpeg-static');
  const pngA = path.join(OUT_DIR, `${outBase}_a.png`);
  const pngB = path.join(OUT_DIR, `${outBase}_b.png`);
  const outMp4 = path.join(OUT_DIR, `${outBase}.mp4`);

  // Build two HTML variants for the portada (intro): use an explicit intro context
  const ctxIntro = { date: dateStr, events: [] };
  const fonts = loadFonts();
  // create a wrapper that injects small CSS tweaks for initial/final states
  const buildVariant = (initial) => {
    const html = buildHtml(ctxIntro);
    if (initial) {
      // hide/move down titlebig and date for initial frame
      return html.replace('</style></head>', `.wrap.intro .titlebig{opacity:0;transform:translateY(40px)}.wrap.intro .date{opacity:0;transform:translateY(30px)} </style></head>`);
    }
    // final state uses the default styles already in buildHtml
    return html;
  };

  const htmlA = buildVariant(true);
  const htmlB = buildVariant(false);

  // render both PNGs
  await renderHtmlToPng(htmlA, pngA);
  await renderHtmlToPng(htmlB, pngB);

  // timing: show A for preMs, transition td, show B for postMs (seconds)
  const totalSec = typeof opts.durationSec === 'number' ? opts.durationSec : 3;
  const td = typeof opts.transitionSec === 'number' ? opts.transitionSec : 0.8;
  const pre = typeof opts.preSec === 'number' ? opts.preSec : Math.max(0.4, (totalSec - td) * 0.33);
  const post = Math.max(0.6, totalSec - pre - td);

  if (!ffmpeg) throw new Error('ffmpeg-static not available');

  const filter = `[0:v]scale=1080:1920,setsar=1[v0];[1:v]scale=1080:1920,setsar=1[v1];[v0][v1]xfade=transition=slideleft:duration=${td}:offset=${pre},format=yuv420p`;
  const args = [
    '-y',
    '-loop','1','-t',String(pre + td),'-i',pngA,
    '-loop','1','-t',String(post + td),'-i',pngB,
    '-filter_complex', filter,
    '-c:v','libx264','-pix_fmt','yuv420p', outMp4
  ];

  const r = spawnSync(ffmpeg, args, { stdio: 'inherit', timeout: 120000 });
  if (r.status !== 0) throw new Error('ffmpeg xfade failed');

  // cleanup pnGs on success
  try { fs.unlinkSync(pngA); } catch (e) {}
  try { fs.unlinkSync(pngB); } catch (e) {}
  return { mp4: outMp4 };
}

module.exports.renderIntroXfade = renderIntroXfade;

if (require.main === module) {
  const arg = process.argv[2];
  run(arg).then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
}

module.exports = { run, pickEventsFor, buildHtml, renderHtmlToPngMp4, renderIntroXfade, renderHtmlToPng };
