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
const MUSIC_VOLUME = 0.75;  // 0–1: background music volume

// ── Premium font system ────────────────────────────────────────────────────────
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');

// Returns ffmpeg-compatible font path (forward slashes; single-quoted in filter strings)
function ffmpegFontPath(p) {
  return p.replace(/\\/g, '/');
}

// Returns { bold, main, reg } objects with ffmpeg-ready font paths.
//   bold → Bebas Neue: all-caps condensed display (scores, "GOL!", "VS")
//   main → Rajdhani Bold: team names, labels, years
//   reg  → Rajdhani Bold (smaller sizes): secondary / body text
function getFonts() {
  const rajBold = path.join(FONTS_DIR, 'Rajdhani-Bold.ttf');
  const bebas   = path.join(FONTS_DIR, 'BebasNeue-Regular.ttf');
  const hasRaj  = fs.existsSync(rajBold);
  const hasBeb  = fs.existsSync(bebas);
  return {
    bold: hasBeb ? ffmpegFontPath(bebas)   : 'C:/Windows/Fonts/impact.ttf',
    main: hasRaj ? ffmpegFontPath(rajBold) : 'C:/Windows/Fonts/arialbd.ttf',
    reg:  hasRaj ? ffmpegFontPath(rajBold) : 'C:/Windows/Fonts/arial.ttf',
  };
}

// Downloads Rajdhani Bold + Bebas Neue TTF from Google Fonts GitHub.
// Runs on first launch; subsequent runs skip existing files.
async function ensureFonts() {
  if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });
  const https = require('https');

  function dlFile(url, dest) {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(dest)) { resolve(); return; }
      const file = fs.createWriteStream(dest);
      const get  = (u) => https.get(u, { headers: { 'User-Agent': 'node/golazox-video' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.destroy(); get(res.headers.location); return;
        }
        if (res.statusCode !== 200) {
          file.destroy(); fs.unlink(dest, () => {}); reject(new Error(`HTTP ${res.statusCode}`)); return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error',  (e) => { fs.unlink(dest, () => {}); reject(e); });
      }).on('error', (e) => { file.destroy(); fs.unlink(dest, () => {}); reject(e); });
      get(url);
    });
  }

  const FONT_URLS = [
    {
      dest: path.join(FONTS_DIR, 'Rajdhani-Bold.ttf'),
      url:  'https://raw.githubusercontent.com/google/fonts/main/ofl/rajdhani/Rajdhani-Bold.ttf',
    },
    {
      dest: path.join(FONTS_DIR, 'BebasNeue-Regular.ttf'),
      url:  'https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf',
    },
  ];

  for (const { dest, url } of FONT_URLS) {
    if (fs.existsSync(dest)) { console.log('[fonts] ✓', path.basename(dest)); continue; }
    try {
      console.log('[fonts] Downloading', path.basename(dest), '...');
      await dlFile(url, dest);
      console.log('[fonts] ✓', path.basename(dest));
    } catch (e) {
      console.warn('[fonts] ✗', path.basename(dest), '—', e.message.slice(0, 80));
    }
  }
}

// Clásicos épicos para rotación automática
// Slugs MUST match the squad JSON filenames in squads/ and badge PNGs in public/img/badges/
const CLASICOS = [
  { teamA: 'real-madrid',          eraA: '2026', teamB: 'fc-bayern-munchen',    eraB: '2026',  stadiumId: 'bernabeu',    refereeId: 'collina',     weatherId: 'sunny' },
  { teamA: 'real-madrid',          eraA: '2002', teamB: 'fc-barcelona',         eraB: '2009',  stadiumId: 'bernabeu',    refereeId: 'collina',     weatherId: 'sunny' },
  { teamA: 'ac-mailand',           eraA: '1989', teamB: 'fc-liverpool',         eraB: '2005',  stadiumId: 'sansiro',     refereeId: 'webb',        weatherId: 'cloudy' },
  { teamA: 'brasilien',            eraA: '1970', teamB: 'argentinien',          eraB: '1986',  stadiumId: 'maracana',    refereeId: 'brych',       weatherId: 'heat' },
  { teamA: 'fc-barcelona',         eraA: '2011', teamB: 'fc-bayern-munchen',    eraB: '2013',  stadiumId: 'campnou',     refereeId: 'kuipers',     weatherId: 'cloudy' },
  { teamA: 'manchester-united',    eraA: '1999', teamB: 'fc-chelsea',           eraB: '2012',  stadiumId: 'wembley',     refereeId: 'webb',        weatherId: 'rain' },
  { teamA: 'juventus-turin',       eraA: '1997', teamB: 'real-madrid',          eraB: '2018',  stadiumId: 'bernabeu',    refereeId: 'merk',        weatherId: 'night' },
  { teamA: 'frankreich',           eraA: '1998', teamB: 'brasilien',            eraB: '2002',  stadiumId: 'maracana',    refereeId: 'brych',       weatherId: 'sunny' },
  { teamA: 'atletico-madrid',      eraA: '2016', teamB: 'real-madrid',          eraB: '2016',  stadiumId: 'bernabeu',    refereeId: 'collina',     weatherId: 'sunny' },
  { teamA: 'fc-liverpool',         eraA: '1984', teamB: 'as-rom',               eraB: '1984',  stadiumId: 'anfield',     refereeId: 'clattenburg', weatherId: 'rain' },
  { teamA: 'fc-paris-saint-germain', eraA: '2017', teamB: 'fc-barcelona',       eraB: '2017',  stadiumId: 'campnou',     refereeId: 'kuipers',     weatherId: 'night' },
];

// ── Rivalidades históricas (sync with HISTORIC_MATCHES in app.js) ──────────
// label=título ES · en=título EN · country · flag · desc · competition · round
const RIVALS_LIST = [
  { label: '¿Pelé o Maradona?',              en: 'Pelé vs Maradona',            category: 'Rivalidades', flag: '⚽',
    desc: 'Brasil \'70 · Argentina \'86',
    a: { slug: 'brasilien',                  era: '1970', stadium: 'maracana',  referee: 'collina',  weather: 'heat' },
    b: { slug: 'argentinien',                era: '1986' } },
  { label: 'Final EE.UU. 1994',              en: 'USA \'94 World Cup Final',     category: 'Final', flag: '🏆',
    desc: 'Brasil \'94 · Italia \'94',
    a: { slug: 'brasilien',                  era: '1994', stadium: 'maracana',  referee: 'collina',  weather: 'sunny' },
    b: { slug: 'italien',                    era: '1994' } },
  { label: 'MSN vs BBC',                     en: 'MSN vs BBC',                   category: 'El Clásico', flag: '🇪🇸',
    desc: 'Barcelona \'15 · Real Madrid \'15',
    a: { slug: 'fc-barcelona',               era: '2015', stadium: 'campnou',   referee: 'kuipers',  weather: 'sunny' },
    b: { slug: 'real-madrid',                era: '2015' } },
  { label: 'Mou vs Pep: El Clásico',         en: 'Mourinho vs Guardiola',        category: 'El Clásico', flag: '🇪🇸',
    desc: 'Real Madrid \'12 · Barcelona \'11',
    a: { slug: 'real-madrid',                era: '2012', stadium: 'bernabeu',  referee: 'collina',  weather: 'night' },
    b: { slug: 'fc-barcelona',               era: '2011' } },
  { label: 'Galácticos vs Los Invencibles',  en: 'Galacticos vs The Invincibles', category: 'Partido de Ensueño', flag: '✨',
    desc: 'Real Madrid \'02 · Arsenal \'04',
    a: { slug: 'real-madrid',                era: '2002', stadium: 'bernabeu',  referee: 'collina',  weather: 'sunny' },
    b: { slug: 'fc-arsenal',                 era: '2004' } },
  { label: 'La Final de Múnich 99',          en: 'Munich \'99 Final',            category: 'Final UCL', flag: '🏆',
    desc: 'Manchester United \'99 · Bayern \'99',
    a: { slug: 'manchester-united',          era: '1999', stadium: 'wembley',   referee: 'collina',  weather: 'night' },
    b: { slug: 'fc-bayern-munchen',          era: '1999' } },
  { label: 'El Milagro de Estambul',         en: 'The Istanbul Miracle',         category: 'Final UCL', flag: '🏆',
    desc: 'AC Milán \'03 · Liverpool \'05',
    a: { slug: 'ac-mailand',                 era: '2003', stadium: 'sansiro',   referee: 'webb',     weather: 'night' },
    b: { slug: 'fc-liverpool',               era: '2005' } },
  { label: 'Der Wembley-Klassiker',          en: 'The Wembley Klassiker',        category: 'Final UCL', flag: '🏆',
    desc: 'Bayern \'13 · Dortmund \'12',
    a: { slug: 'fc-bayern-munchen',          era: '2013', stadium: 'wembley',   referee: 'kuipers',  weather: 'night' },
    b: { slug: 'borussia-dortmund',          era: '2012' } },
  { label: 'Maradona vs Messi',              en: 'Maradona vs Messi',            category: 'Partido de Ensueño', flag: '✨',
    desc: 'Nápoles \'88 · Barcelona \'09',
    a: { slug: 'ssc-neapel',                 era: '1988', stadium: 'sansiro',   referee: 'collina',  weather: 'night' },
    b: { slug: 'fc-barcelona',               era: '2009' } },
  { label: 'Pep vs Jupp',                    en: 'Pep vs Jupp',                  category: 'Partido de Ensueño', flag: '✨',
    desc: 'Barcelona \'11 · Bayern \'13',
    a: { slug: 'fc-barcelona',               era: '2011', stadium: 'campnou',   referee: 'kuipers',  weather: 'cloudy' },
    b: { slug: 'fc-bayern-munchen',          era: '2013' } },
  { label: 'Francia 98 vs Brasil 98',        en: 'France \'98 vs Brazil \'98',   category: 'Final', flag: '🏆',
    desc: 'Francia \'98 · Brasil \'98',
    a: { slug: 'frankreich',                 era: '1998', stadium: 'maracana',  referee: 'collina',  weather: 'sunny' },
    b: { slug: 'brasilien',                  era: '1998' } },
  { label: 'El Séptimo Cielo',               en: 'The Seventh Heaven',           category: 'Final', flag: '🏆',
    desc: 'Alemania \'14 · Argentina \'14',
    a: { slug: 'deutschland',                era: '2014', stadium: 'maracana',  referee: 'brych',    weather: 'sunny' },
    b: { slug: 'argentinien',                era: '2014' } },
  { label: 'Ronaldo vs Ronaldo',             en: 'Ronaldo vs Ronaldo',           category: 'Partido de Ensueño', flag: '✨',
    desc: 'Brasil \'02 · Real Madrid \'17',
    a: { slug: 'brasilien',                  era: '2002', stadium: 'maracana',  referee: 'collina',  weather: 'sunny' },
    b: { slug: 'real-madrid',                era: '2017' } },
  { label: 'Di Stéfano vs el Dream Team',    en: 'Di Stéfano vs the Dream Team', category: 'Partido de Ensueño', flag: '✨',
    desc: 'Real Madrid \'60 · Barcelona \'92',
    a: { slug: 'real-madrid',                era: '1960', stadium: 'bernabeu',  referee: 'collina',  weather: 'sunny' },
    b: { slug: 'fc-barcelona',               era: '1992' } },
  { label: 'El Treble vs Los Invencibles',   en: 'Treble vs The Invincibles',    category: 'Partido de Ensueño', flag: '✨',
    desc: 'Manchester United \'99 · Arsenal \'04',
    a: { slug: 'manchester-united',          era: '1999', stadium: 'wembley',   referee: 'webb',     weather: 'rain' },
    b: { slug: 'fc-arsenal',                 era: '2004' } },
];

// ── Grandes Derbis mundiales (sync with WORLD_DERBIES in app.js) ─────────────
const DERBIES_LIST = [
  { label: 'El Clásico',           en: 'El Clásico',           country: 'España',      flag: '🇪🇸',
    desc: 'FC Barcelona vs Real Madrid',
    a: { slug: 'fc-barcelona',                era: '2025', stadium: 'campnou',  referee: 'lahoz',    weather: 'sunny' },
    b: { slug: 'real-madrid',                 era: '2025' } },
  { label: 'El Viejo Firm',        en: 'The Old Firm',          country: 'Escocia',     flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    desc: 'Celtic vs Rangers',
    a: { slug: 'celtic-glasgow',              era: '2025', stadium: 'wembley',  referee: 'clattenburg', weather: 'rain' },
    b: { slug: 'glasgow-rangers',             era: '2025' } },
  { label: 'Superclásico',         en: 'Superclásico',          country: 'Argentina',   flag: '🇦🇷',
    desc: 'Boca Juniors vs River Plate',
    a: { slug: 'club-atletico-boca-juniors',  era: '2025', stadium: 'maracana', referee: 'brych',    weather: 'sunny' },
    b: { slug: 'club-atletico-river-plate',   era: '2025' } },
  { label: 'Derby della Madonnina',en: 'Derby della Madonnina', country: 'Italia',      flag: '🇮🇹',
    desc: 'AC Milan vs Inter',
    a: { slug: 'ac-mailand',                  era: '2025', stadium: 'sansiro',  referee: 'collina',  weather: 'night' },
    b: { slug: 'inter-mailand',               era: '2025' } },
  { label: 'Der Klassiker',        en: 'Der Klassiker',         country: 'Alemania',    flag: '🇩🇪',
    desc: 'Bayern Munich vs Borussia Dortmund',
    a: { slug: 'fc-bayern-munchen',           era: '2025', stadium: 'wembley',  referee: 'brych',    weather: 'cloudy' },
    b: { slug: 'borussia-dortmund',           era: '2025' } },
  { label: 'Liverpool vs Man Utd', en: 'Liverpool vs Man Utd',  country: 'Inglaterra',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    desc: 'Liverpool vs Manchester United',
    a: { slug: 'fc-liverpool',                era: '2025', stadium: 'anfield',  referee: 'webb',     weather: 'rain' },
    b: { slug: 'manchester-united',           era: '2025' } },
  { label: 'Derby del Norte de Londres', en: 'North London Derby', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    desc: 'Arsenal vs Tottenham',
    a: { slug: 'fc-arsenal',                  era: '2025', stadium: 'wembley',  referee: 'clattenburg', weather: 'cloudy' },
    b: { slug: 'tottenham-hotspur',           era: '2025' } },
  { label: 'Le Classique',         en: 'Le Classique',          country: 'Francia',     flag: '🇫🇷',
    desc: 'Marseille vs PSG',
    a: { slug: 'olympique-marseille',         era: '2025', stadium: 'campnou',  referee: 'kuipers',  weather: 'sunny' },
    b: { slug: 'fc-paris-saint-germain',      era: '2025' } },
  { label: 'Derby de Madrid',      en: 'Madrid Derby',          country: 'España',      flag: '🇪🇸',
    desc: 'Atlético de Madrid vs Real Madrid',
    a: { slug: 'atletico-madrid',             era: '2025', stadium: 'bernabeu', referee: 'lahoz',    weather: 'sunny' },
    b: { slug: 'real-madrid',                 era: '2025' } },
  { label: 'Derby della Capitale', en: 'Derby della Capitale',  country: 'Italia',      flag: '🇮🇹',
    desc: 'Roma vs Lazio',
    a: { slug: 'as-rom',                      era: '2025', stadium: 'sansiro',  referee: 'collina',  weather: 'night' },
    b: { slug: 'lazio-rom',                   era: '2025' } },
  { label: 'Derby de Lisboa — Águias', en: 'Lisbon Derby — Eagles', country: 'Portugal', flag: '🇵🇹',
    desc: 'Benfica vs Sporting CP',
    a: { slug: 'benfica-lissabon',            era: '2025', stadium: 'wembley',  referee: 'merk',     weather: 'sunny' },
    b: { slug: 'sporting-cp',                 era: '2025' } },
  { label: 'Derby de Mánchester',   en: 'Manchester Derby',      country: 'Inglaterra',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    desc: 'Manchester United vs Manchester City',
    a: { slug: 'manchester-united',           era: '2025', stadium: 'wembley',  referee: 'webb',     weather: 'rain' },
    b: { slug: 'manchester-city',             era: '2025' } },
  { label: 'Merseyside Derby',      en: 'Merseyside Derby',       country: 'Inglaterra',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    desc: 'Liverpool vs Everton',
    a: { slug: 'fc-liverpool',                era: '2025', stadium: 'anfield',  referee: 'clattenburg', weather: 'rain' },
    b: { slug: 'fc-everton',                  era: '2025' } },
  { label: 'Fla-Flu',              en: 'Fla-Flu',               country: 'Brasil',      flag: '🇧🇷',
    desc: 'Flamengo vs Fluminense',
    a: { slug: 'flamengo',                    era: '2022', stadium: 'maracana', referee: 'brych',    weather: 'heat' },
    b: { slug: 'fluminense-rio-de-janeiro',   era: '2025' } },
  { label: 'Derby Sevillano',       en: 'Seville Derby',         country: 'España',      flag: '🇪🇸',
    desc: 'Sevilla vs Betis',
    a: { slug: 'fc-sevilla',                  era: '2025', stadium: 'bernabeu', referee: 'lahoz',    weather: 'heat' },
    b: { slug: 'real-betis-balompie',         era: '2025' } },
];

// Badge filename normalizer — squad slugs don't always match badge filenames 1:1
const BADGE_DIR = path.join(__dirname, 'public', 'img', 'badges');
function _badgeFile(slug) {
  const direct = path.join(BADGE_DIR, `${slug}.png`);
  if (fs.existsSync(direct)) return direct;
  return null;
}

// ── Display-name lookup ───────────────────────────────────────────────────────
// Load squads-meta.json with lowercase keys for case-insensitive lookup
const SQUADS_META = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads-meta.json'), 'utf8'));
    const map = {};
    for (const [k, v] of Object.entries(raw)) map[k.toLowerCase()] = v;
    return map;
  } catch { return {}; }
})();

// Hardcoded map for slugs that use German names (national teams + edge cases)
const SLUG_NAME_ES = {
  'frankreich':             'Francia',
  'brasilien':              'Brasil',
  'argentinien':            'Argentina',
  'deutschland':            'Alemania',
  'england':                'Inglaterra',
  'spanien':                'España',
  'italien':                'Italia',
  'portugal':               'Portugal',
  'niederlande':            'Países Bajos',
  'agypten':                'Egipto',
  'kamerun':                'Camerún',
  'marokko':                'Marruecos',
  'fc-paris-saint-germain': 'PSG',
  'juventus-turin':         'Juventus',
  'fc-bayern-munchen':      'Bayern Múnich',
  'ac-monza':               'Monza',
};

function slugToDisplayName(slug) {
  if (SLUG_NAME_ES[slug]) return SLUG_NAME_ES[slug];
  const meta = SQUADS_META[slug.toLowerCase()];
  if (meta?.nameEs) return meta.nameEs;
  // fallback: title-case
  return slug.replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bFc\b/g, 'FC').replace(/\bAs\b/g, 'AS').replace(/\bAc\b/g, 'AC');
}

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
 * createIntroVideo — generates a 5-second intro clip with branded images:
 *   • Dark navy background
 *   • golazox-coin.png  (top)
 *   • golazox-wordmark.png (middle)
 *   • trophy-ucl.png / trophy-wc.png (lower area)
 *   • "Champions League 2025/26" text
 *   • Global fade-in / fade-out
 *
 * All three PNGs are confirmed RGBA, so overlay is clean on the dark bg.
 */
function createIntroVideo(outFile, durationSec = 5, type = 'ucl') {
  const w = WIDTH, h = HEIGHT;
  const d = durationSec;

  const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
  const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');
  const trophyImg   = path.join(__dirname, 'public', 'img', type === 'wc' ? 'trophy-wc.png' : 'trophy-ucl.png');

  // Image layout for 1080×1920 physical pixels:
  //   coin     530×471 → scaled to 280px wide  → h≈250  → top y=110
  //   wordmark 1087×229 → scaled to 750px wide → h≈158  → top y=390
  //   trophy   403×619 → scaled to 420px wide  → h≈644  → top y=590
  //   text block at y=1340

  const imgs = [
    { file: coinImg,     scale: 280, y: 110 },
    { file: wordmarkImg, scale: 750, y: 390 },
    { file: trophyImg,   scale: 420, y: 590 },
  ].filter(i => fs.existsSync(i.file));

  // Background (dark navy radial gradient simulation via two color layers)
  const inputs = [
    '-f', 'lavfi', '-i', `color=c=0x0a1628:size=${w}x${h}:rate=30:duration=${d}`,
  ];
  imgs.forEach(i => inputs.push('-i', i.file));

  const filterParts = [];
  let lastLabel = '0:v';

  imgs.forEach((img, idx) => {
    const inputIdx   = idx + 1;
    const scaledLbl  = `img${idx}`;
    const compositeLbl = `c${idx}`;
    filterParts.push(`[${inputIdx}:v]scale=${img.scale}:-1,format=rgba[${scaledLbl}]`);
    filterParts.push(`[${lastLabel}][${scaledLbl}]overlay=(W-w)/2:${img.y}[${compositeLbl}]`);
    lastLabel = compositeLbl;
  });

  // Titles — use drawtext with alpha fade expressions
  // Windows Arial Black bold for punchy type
  // Type-specific title and subtitle
  const INTRO_LABELS = {
    ucl:   { title: 'UEFA Champions League', sub: '2025\/26' },
    wc:    { title: 'FIFA World Cup 2026',   sub: 'USA · Canada · Mexico' },
    match: { title: 'Cl\u00e1sicos Eternos',         sub: 'golazox.com' },
  };
  const labels    = INTRO_LABELS[type] || INTRO_LABELS.ucl;
  const titleText = labels.title;
  const yearText  = labels.sub;

  const { bold: fontAlt, main: fontBold, reg: fontReg } = getFonts();

  const fadeInExpr  = (start) => `if(lt(t,${start}),0,min(1,(t-${start})/0.6))`;
  const fadeOutExpr = (start, expr) => `min(${expr},if(gt(t,${d - 0.7}),max(0,(${d}-t)/0.7),1))`;
  const alpha = (start) => fadeOutExpr(d - 0.7, fadeInExpr(start));

  filterParts.push(
    `[${lastLabel}]` +
    `drawtext=fontfile='${fontBold}':text='${titleText}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=1350:shadowx=4:shadowy=4:shadowcolor=0x00000099:alpha='${alpha(1.4)}',` +
    `drawtext=fontfile='${fontAlt}':text='${yearText}':fontsize=120:fontcolor=FFD700:x=(w-text_w)/2:y=1460:shadowx=4:shadowy=4:shadowcolor=0x00000099:alpha='${alpha(1.7)}',` +
    `drawtext=fontfile='${fontBold}':text='golazox.com':fontsize=52:fontcolor=0xCCCCCC:x=(w-text_w)/2:y=1630:shadowx=2:shadowy=2:alpha='${alpha(2.0)}',` +
    `fade=t=in:st=0:d=0.8,fade=t=out:st=${d - 0.8}:d=0.8` +
    `[vout]`,
  );

  ffmpeg([
    '-y',
    ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '15',
    '-pix_fmt', 'yuv420p',
    '-an',
    '-t', String(d),
    outFile,
  ]);
}

/**
 * createMatchIntroVideo — 5-second intro specific to a clásico.
 * Shows both team badges (from local /img/badges/ cache), team names, eras,
 * a big "VS", the golazox coin + wordmark. Falls back to text-only if badge missing.
 */
function createMatchIntroVideo(teamA, eraA, teamB, eraB, outFile, durationSec = 5) {
  const w = WIDTH, h = HEIGHT, d = durationSec;
  const { bold: fontAlt, main: fontBold, reg: fontReg } = getFonts();

  const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
  const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');
  const badgeAFile  = _badgeFile(teamA);
  const badgeBFile  = _badgeFile(teamB);

  // Escape text for ffmpeg drawtext
  const esc = (s) => s.replace(/'/g, '').replace(/:/g, '\\:').replace(/%/g, '%%');

  const nameA = slugToDisplayName(teamA);
  const nameB = slugToDisplayName(teamB);

  const inputs = [
    '-f', 'lavfi', '-i', `color=c=0x000000:size=${w}x${h}:rate=30:duration=${d}`,
  ];

  const imgDefs = [];
  if (fs.existsSync(coinImg))  imgDefs.push({ file: coinImg,    key: 'coin' });
  if (fs.existsSync(wordmarkImg)) imgDefs.push({ file: wordmarkImg, key: 'wm' });
  if (badgeAFile)              imgDefs.push({ file: badgeAFile, key: 'ba' });
  if (badgeBFile)              imgDefs.push({ file: badgeBFile, key: 'bb' });
  imgDefs.forEach(i => inputs.push('-i', i.file));

  const filterParts = [];
  let lastLabel = '0:v';
  let inputIdx  = 1;

  const overlay = (key, scaleW, x, y, outLbl) => {
    filterParts.push(`[${inputIdx}:v]scale=${scaleW}:-1,format=rgba[${key}]`);
    filterParts.push(`[${lastLabel}][${key}]overlay=${x}:${y}[${outLbl}]`);
    lastLabel = outLbl;
    inputIdx++;
  };

  if (imgDefs.find(i => i.key === 'coin')) overlay('coin', 165, '(W-w)/2', 100, 'lc');
  if (imgDefs.find(i => i.key === 'wm'))   overlay('wm',   510, '(W-w)/2', 290, 'lwm');
  if (badgeAFile) overlay('ba', 310, '245-w/2', 580, 'lba');
  if (badgeBFile) overlay('bb', 310, '835-w/2', 580, 'lbb');

  const fadeIn = (s) => `if(lt(t,${s}),0,min(1,(t-${s})/0.5))`;
  const alpha  = (s) => `min(${fadeIn(s)},if(gt(t,${d - 0.6}),max(0,(${d}-t)/0.6),1))`;

  const texts = [
    // Thin gold separator lines above/below VS
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=28:fontcolor=FFD700:x=(w-text_w)/2:y=640:alpha='${alpha(0.3)}'`,
    `drawtext=fontfile='${fontAlt}':text='VS':fontsize=175:fontcolor=white:x=(w-text_w)/2:y=648:shadowx=0:shadowy=0:shadowcolor=0x00000000:alpha='${alpha(0.4)}'`,
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=28:fontcolor=FFD700:x=(w-text_w)/2:y=810:alpha='${alpha(0.3)}'`,
    // Team names in uppercase
    `drawtext=fontfile='${fontBold}':text='${esc(nameA.toUpperCase())}':fontsize=52:fontcolor=white:x=245-text_w/2:y=925:alpha='${alpha(0.8)}'`,
    ...(eraA ? [`drawtext=fontfile='${fontBold}':text='${esc(eraA)}':fontsize=44:fontcolor=FFD700:x=245-text_w/2:y=990:alpha='${alpha(1.0)}'`] : []),
    `drawtext=fontfile='${fontBold}':text='${esc(nameB.toUpperCase())}':fontsize=52:fontcolor=white:x=835-text_w/2:y=925:alpha='${alpha(0.8)}'`,
    ...(eraB ? [`drawtext=fontfile='${fontBold}':text='${esc(eraB)}':fontsize=44:fontcolor=FFD700:x=835-text_w/2:y=990:alpha='${alpha(1.0)}'`] : []),
    // Label
    `drawtext=fontfile='${fontBold}':text='CL\u00c1SICOS ETERNOS':fontsize=54:fontcolor=FFD700:x=(w-text_w)/2:y=1120:alpha='${alpha(1.3)}'`,
    // URL footer
    `drawtext=fontfile='${fontReg}':text='golazox.com':fontsize=46:fontcolor=0x888888:x=(w-text_w)/2:y=1810:alpha='${alpha(1.8)}'`,
  ];

  filterParts.push(
    `[${lastLabel}]` + texts.join(',') +
    `,fade=t=in:st=0:d=0.7,fade=t=out:st=${d - 0.7}:d=0.7[vout]`,
  );

  ffmpeg([
    '-y', ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '15',
    '-pix_fmt', 'yuv420p', '-an', '-t', String(d),
    outFile,
  ]);
}

/**
 * createShortClip — produces a ≤58s vertical clip from a full video.
 * Strategy: take the LAST 53s of the main recording (champion reveal + results)
 * and prepend the 5s intro → total ≤58s, perfect for Shorts/Reels.
 *
 * Output: <originalName>_short.mp4 in same folder.
 */
function createShortClip(fullVideoPath, type = 'ucl') {
  const shortPath = fullVideoPath.replace('.mp4', '_short.mp4');
  const tmp       = os.tmpdir();
  const introPath = path.join(tmp, 'golazox_intro_short.mp4');
  const trimPath  = path.join(tmp, 'golazox_trim.mp4');
  const listFile  = path.join(tmp, 'golazox_short_list.txt');

  console.log('[short] Creating intro...');
  createIntroVideo(introPath, 5, type);

  // Get total duration of the full video via ffprobe
  const ffprobeBin = process.env.FFMPEG_PATH.replace('ffmpeg', 'ffprobe').replace(/ffmpeg\.exe$/, 'ffprobe.exe');
  let duration = 60;
  if (fs.existsSync(ffprobeBin)) {
    const probe = spawnSync(ffprobeBin, [
      '-v', 'quiet', '-print_format', 'json', '-show_format', fullVideoPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const info = JSON.parse((probe.stdout || '').toString());
      duration = parseFloat(info.format.duration);
    } catch {}
  }

  // Trim: last 53s of full video (champion banner + tabs)
  const trimStart = Math.max(0, duration - 53);
  console.log(`[short] Trimming last 53s (start=${trimStart.toFixed(1)}s) of ${duration.toFixed(1)}s video...`);
  ffmpeg([
    '-y', '-ss', String(trimStart), '-i', fullVideoPath,
    '-t', '53', '-c', 'copy', trimPath,
  ]);

  // Concat intro + trim
  fs.writeFileSync(listFile, `file '${introPath.replace(/\\/g, '/')}'\nfile '${trimPath.replace(/\\/g, '/')}'`);
  ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', shortPath]);

  // Cleanup temps
  [introPath, trimPath, listFile].forEach(f => { try { fs.unlinkSync(f); } catch {} });

  console.log(`[short] ✓ Short clip (58s) → ${shortPath}`);
  return shortPath;
}

/**
 * postProcess — runs after Puppeteer recording:
 *   1. Creates a 5s intro clip
 *   2. Concatenates intro + main recording
 *   3. Appends a 4s CTA card ("Juega en golazox.com")
 *   4. Mixes looped background music at MUSIC_VOLUME
 *
 * Returns the final output path (overwrites outPath).
 */

function createCtaCard(outFile, durationSec = 5) {
  const w = WIDTH, h = HEIGHT, d = durationSec;
  const { bold: fontAlt, main: fontBold, reg: fontReg } = getFonts();
  const fadeIn = (s) => `if(lt(t,${s}),0,min(1,(t-${s})/0.5))`;
  const alpha  = (s) => `min(${fadeIn(s)},if(gt(t,${d-0.6}),max(0,(${d}-t)/0.6),1))`;

  const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
  const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');
  const inputs = [
    '-f', 'lavfi', '-i', `color=c=0x1a2060:size=${w}x${h}:rate=30:duration=${d}`,
    '-f', 'lavfi', '-i', `color=c=0x060912:size=${w}x${h}:rate=30:duration=${d}`,
  ];
  const imgDefs = [];
  if (fs.existsSync(coinImg))     imgDefs.push({ file: coinImg,     key: 'ctacoin' });
  if (fs.existsSync(wordmarkImg)) imgDefs.push({ file: wordmarkImg, key: 'ctawm'   });
  imgDefs.forEach(i => inputs.push('-i', i.file));

  const filterParts = [];
  let lastLabel = '0:v';
  let inputIdx  = 2; // 0 and 1 are the gradient color inputs

  // Top-to-bottom gradient: navy (top) → near-black (bottom)
  filterParts.push(`[0:v][1:v]blend=all_expr='A*(1-Y/H) + B*(Y/H)'[ctabg]`);
  lastLabel = 'ctabg';

  if (imgDefs.find(i => i.key === 'ctacoin')) {
    filterParts.push(`[${inputIdx}:v]scale=200:-1,format=rgba[ctac]`);
    filterParts.push(`[${lastLabel}][ctac]overlay=(W-w)/2:110[ctal1]`);
    lastLabel = 'ctal1'; inputIdx++;
  }
  if (imgDefs.find(i => i.key === 'ctawm')) {
    filterParts.push(`[${inputIdx}:v]scale=560:-1,format=rgba[ctawm2]`);
    filterParts.push(`[${lastLabel}][ctawm2]overlay=(W-w)/2:345[ctal2]`);
    lastLabel = 'ctal2'; inputIdx++;
  }

  filterParts.push(
    `[${lastLabel}]` +
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=26:fontcolor=FFD700:x=(w-text_w)/2:y=640:alpha='${alpha(0.2)}',` +
    `drawtext=fontfile='${fontBold}':text='\u00bfY si lo jugases t\u00fa?':fontsize=70:fontcolor=white:x=(w-text_w)/2:y=680:alpha='${alpha(0.3)}',` +
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=26:fontcolor=FFD700:x=(w-text_w)/2:y=773:alpha='${alpha(0.4)}',` +
    `drawtext=fontfile='${fontAlt}':text='golazox.com':fontsize=145:fontcolor=FFD700:x=(w-text_w)/2:y=810:alpha='${alpha(0.55)}',` +
    `drawtext=fontfile='${fontBold}':text='Simula cualquier cl\u00e1sico gratis':fontsize=52:fontcolor=0xAAAAAA:x=(w-text_w)/2:y=1010:alpha='${alpha(1.0)}',` +
    `fade=t=in:st=0:d=0.6,fade=t=out:st=${d-0.6}:d=0.6` +
    `[ctaout]`,
  );

  ffmpeg([
    '-y', ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[ctaout]',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-an', '-t', String(d),
    outFile,
  ]);
}

/**
 * createHookCard — 3-second TikTok hook: shows the FINAL SCORE before anything else.
 * Reveals the result instantly so viewers stay to find out HOW it happened.
 * Layout: coin · wordmark · "RESULTADO FINAL" · badges · names + eras · HUGE score
 */
function createHookCard(scoreA, scoreB, teamA, teamB, eraA, eraB, outFile, durationSec = 3) {
  const w = WIDTH, h = HEIGHT, d = durationSec;
  const { bold: fontAlt, main: fontBold, reg: fontReg } = getFonts();
  const esc = (s) => String(s).replace(/['\\]/g, '').replace(/:/g, '\\:').replace(/%/g, '%%');

  const nameA = slugToDisplayName(teamA);
  const nameB = slugToDisplayName(teamB);
  const badgeAFile  = _badgeFile(teamA);
  const badgeBFile  = _badgeFile(teamB);
  const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
  const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');

  const inputs = [
    '-f', 'lavfi', '-i', `color=c=0x1a2060:size=${w}x${h}:rate=30:duration=${d}`,
    '-f', 'lavfi', '-i', `color=c=0x060912:size=${w}x${h}:rate=30:duration=${d}`,
  ];
  const imgDefs = [];
  if (fs.existsSync(coinImg))     imgDefs.push({ file: coinImg,     key: 'hkcoin' });
  if (fs.existsSync(wordmarkImg)) imgDefs.push({ file: wordmarkImg, key: 'hkwm'   });
  if (badgeAFile)                 imgDefs.push({ file: badgeAFile,  key: 'hkba'   });
  if (badgeBFile)                 imgDefs.push({ file: badgeBFile,  key: 'hkbb'   });
  imgDefs.forEach(i => inputs.push('-i', i.file));

  const filterParts = [];
  let lastLabel = '0:v';
  let inputIdx  = 2; // 0 and 1 are the gradient color inputs

  // Top-to-bottom gradient: navy (top) → near-black (bottom)
  filterParts.push(`[0:v][1:v]blend=all_expr='A*(1-Y/H) + B*(Y/H)'[hkbg]`);
  lastLabel = 'hkbg';

  const overlay = (key, scaleW, x, y, outLbl) => {
    filterParts.push(`[${inputIdx}:v]scale=${scaleW}:-1,format=rgba[${key}]`);
    filterParts.push(`[${lastLabel}][${key}]overlay=${x}:${y}[${outLbl}]`);
    lastLabel = outLbl; inputIdx++;
  };

  if (imgDefs.find(i => i.key === 'hkcoin')) overlay('hkcoin', 130, '(W-w)/2', 55,  'hkl0');
  if (imgDefs.find(i => i.key === 'hkwm'))  overlay('hkwm',   460, '(W-w)/2', 198, 'hkl1');
  if (badgeAFile) overlay('hkba', 220, '220-w/2', 430, 'hkl2');
  if (badgeBFile) overlay('hkbb', 220, '860-w/2', 430, 'hkl3');

  const fadeIn = (s) => `if(lt(t,${s}),0,min(1,(t-${s})/0.25))`;
  const alpha  = (s) => `min(${fadeIn(s)},if(gt(t,${d-0.35}),max(0,(${d}-t)/0.35),1))`;

  const texts = [
    `drawtext=fontfile='${fontBold}':text='RESULTADO FINAL':fontsize=58:fontcolor=FFD700:x=(w-text_w)/2:y=374:alpha='${alpha(0.05)}'`,
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=22:fontcolor=FFD700@0.5:x=(w-text_w)/2:y=445:alpha='${alpha(0.05)}'`,
    `drawtext=fontfile='${fontBold}':text='${esc(nameA.toUpperCase())}':fontsize=48:fontcolor=white:x=220-text_w/2:y=682:alpha='${alpha(0.1)}'`,
    ...(eraA ? [`drawtext=fontfile='${fontBold}':text='${esc(eraA)}':fontsize=38:fontcolor=FFD700:x=220-text_w/2:y=742:alpha='${alpha(0.1)}'`] : []),
    `drawtext=fontfile='${fontBold}':text='${esc(nameB.toUpperCase())}':fontsize=48:fontcolor=white:x=860-text_w/2:y=682:alpha='${alpha(0.1)}'`,
    ...(eraB ? [`drawtext=fontfile='${fontBold}':text='${esc(eraB)}':fontsize=38:fontcolor=FFD700:x=860-text_w/2:y=742:alpha='${alpha(0.1)}'`] : []),
    // Giant score with Bebas Neue
    `drawtext=fontfile='${fontAlt}':text='${scoreA}':fontsize=320:fontcolor=white:x=220-text_w/2:y=795:alpha='${alpha(0.0)}'`,
    `drawtext=fontfile='${fontBold}':text='-':fontsize=160:fontcolor=0x555555:x=(w-text_w)/2:y=870:alpha='${alpha(0.0)}'`,
    `drawtext=fontfile='${fontAlt}':text='${scoreB}':fontsize=320:fontcolor=white:x=860-text_w/2:y=795:alpha='${alpha(0.0)}'`,
    `drawtext=fontfile='${fontReg}':text='golazox.com':fontsize=46:fontcolor=0x555555:x=(w-text_w)/2:y=1175:alpha='${alpha(0.4)}'`,
  ];

  filterParts.push(
    `[${lastLabel}]` + texts.join(',') +
    `,fade=t=in:st=0:d=0.4,fade=t=out:st=${d-0.4}:d=0.4[hkout]`,
  );

  ffmpeg([
    '-y', ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[hkout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '15',
    '-pix_fmt', 'yuv420p', '-an', '-t', String(d),
    outFile,
  ]);
}

/**
 * applyGoalOverlays — burns "GOL! X-Y" flash overlays at each goal timestamp.
 * Uses Bebas Neue for maximum impact. Each goal shows for 4 seconds.
 */
function applyGoalOverlays(videoPath, goalEvents) {
  if (!goalEvents || goalEvents.length === 0) return;
  const { bold: fontAlt } = getFonts();
  const outPath = videoPath + '.goaled.mp4';

  // Build a chained drawtext filter for every goal (one filter expression per goal × 2 lines)
  const overlayFilters = goalEvents.map((g) => {
    const t    = g.videoSec.toFixed(3);
    const tEnd = (g.videoSec + 4).toFixed(3);
    const tFi  = (g.videoSec + 0.35).toFixed(3);   // fade-in done
    const tFos = (g.videoSec + 3.65).toFixed(3);   // fade-out starts
    const score = `${g.scoreA} - ${g.scoreB}`;
    const alphaExpr =
      `if(lt(t,${t}),0,if(lt(t,${tFi}),(t-${t})/0.35,if(lt(t,${tFos}),1,(${tEnd}-t)/0.35)))`;
    return [
      // "GOL!" header with red box
      `drawtext=fontfile='${fontAlt}':text='GOL\\!':fontsize=155:fontcolor=white:` +
      `box=1:boxcolor=0xCC0000C0:boxborderw=28:` +
      `x=(w-text_w)/2:y=h/2-text_h-14:` +
      `enable='between(t,${t},${tEnd})':alpha='${alphaExpr}'`,
      // Score below
      `drawtext=fontfile='${fontAlt}':text='${score}':fontsize=118:fontcolor=white:` +
      `box=1:boxcolor=0x000000B0:boxborderw=22:` +
      `x=(w-text_w)/2:y=h/2+18:` +
      `enable='between(t,${t},${tEnd})':alpha='${alphaExpr}'`,
    ].join(',');
  }).join(',');

  try {
    ffmpeg([
      '-y', '-i', videoPath,
      '-vf', overlayFilters,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
      '-pix_fmt', 'yuv420p', '-r', '30', '-an',
      outPath,
    ]);
    fs.renameSync(outPath, videoPath);
    console.log(`[goals] Applied ${goalEvents.length} goal overlay(s)`);
  } catch (e) {
    console.warn('[goals] Goal overlay failed:', e.message.slice(0, 200));
    try { fs.unlinkSync(outPath); } catch {}
  }
}

/**
 * createRivalryIntroVideo — premium intro for Rivals / Derbis videos.
 */
function createRivalryIntroVideo(rivalry, outFile, durationSec = 5) {
  const w = WIDTH, h = HEIGHT, d = durationSec;
  const { bold: fontAlt, main: fontBold, reg: fontReg } = getFonts();
  const esc = (s) => String(s || '').replace(/['\\]/g, '').replace(/:/g, '\\:').replace(/%/g, '%%');

  const nameA = slugToDisplayName(rivalry.a.slug);
  const nameB = slugToDisplayName(rivalry.b.slug);
  const eraA  = rivalry.a.era || '';
  const eraB  = rivalry.b.era || '';
  const badgeAFile  = _badgeFile(rivalry.a.slug);
  const badgeBFile  = _badgeFile(rivalry.b.slug);
  const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
  const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');

  const inputs = [
    '-f', 'lavfi', '-i', `color=c=0x0d1a2e:size=${w}x${h}:rate=30:duration=${d}`,
    '-f', 'lavfi', '-i', `color=c=0x060912:size=${w}x${h}:rate=30:duration=${d}`,
  ];
  const imgDefs = [];
  if (fs.existsSync(coinImg))     imgDefs.push({ file: coinImg,     key: 'rvcoin' });
  if (badgeAFile)                 imgDefs.push({ file: badgeAFile,  key: 'rvba'   });
  if (badgeBFile)                 imgDefs.push({ file: badgeBFile,  key: 'rvbb'   });
  if (fs.existsSync(wordmarkImg)) imgDefs.push({ file: wordmarkImg, key: 'rvwm'   });
  imgDefs.forEach(i => inputs.push('-i', i.file));

  const filterParts = [];
  let lastLabel = '0:v';
  let inputIdx  = 2;

  filterParts.push(`[0:v][1:v]blend=all_expr='A*(1-Y/H) + B*(Y/H)'[rvbg]`);
  lastLabel = 'rvbg';

  const overlay = (key, scaleW, x, y, lbl) => {
    filterParts.push(`[${inputIdx}:v]scale=${scaleW}:-1,format=rgba[${key}]`);
    filterParts.push(`[${lastLabel}][${key}]overlay=${x}:${y}[${lbl}]`);
    lastLabel = lbl; inputIdx++;
  };

  if (imgDefs.find(i => i.key === 'rvcoin')) overlay('rvcoin', 120, '(W-w)/2', 80,  'rvl0');
  if (badgeAFile)                            overlay('rvba',   280, '200-w/2', 570, 'rvl1');
  if (badgeBFile)                            overlay('rvbb',   280, '880-w/2', 570, 'rvl2');
  if (imgDefs.find(i => i.key === 'rvwm'))   overlay('rvwm',   500, '(W-w)/2', 1630, 'rvl3');

  const fadeIn = (s) => `if(lt(t,${s}),0,min(1,(t-${s})/0.4))`;
  const alpha  = (s) => `min(${fadeIn(s)},if(gt(t,${d-0.5}),max(0,(${d}-t)/0.5),1))`;

  // Title size adapts to length
  const titleText = esc((rivalry.label || rivalry.en || '').toUpperCase());
  const titleSize = titleText.length > 18 ? 88 : titleText.length > 12 ? 110 : 132;

  // Context line: country (for derbies) or category (for rivalries) — no emoji (not supported)
  const contextText = esc(rivalry.country || rivalry.category || '');
  // Desc line: descriptive subtitle
  const descText    = esc(rivalry.desc || '');

  const texts = [
    // Top separator
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=22:fontcolor=FFD700@0.5:x=(w-text_w)/2:y=248:alpha='${alpha(0.0)}'`,
    // Big title
    `drawtext=fontfile='${fontAlt}':text='${titleText}':fontsize=${titleSize}:fontcolor=FFD700:x=(w-text_w)/2:y=272:alpha='${alpha(0.05)}'`,
    // Context (country or category) — centered, subtle
    `drawtext=fontfile='${fontBold}':text='${contextText}':fontsize=52:fontcolor=white@0.8:x=(w-text_w)/2:y=436:alpha='${alpha(0.18)}'`,
    // Mid separator
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=22:fontcolor=FFD700@0.35:x=(w-text_w)/2:y=506:alpha='${alpha(0.2)}'`,
    // VS (centered between badges)
    `drawtext=fontfile='${fontAlt}':text='VS':fontsize=120:fontcolor=white@0.9:x=(w-text_w)/2:y=658:alpha='${alpha(0.3)}'`,
    // Team names
    `drawtext=fontfile='${fontBold}':text='${esc(nameA.toUpperCase())}':fontsize=44:fontcolor=white:x=200-text_w/2:y=896:alpha='${alpha(0.55)}'`,
    `drawtext=fontfile='${fontBold}':text='${esc(nameB.toUpperCase())}':fontsize=44:fontcolor=white:x=880-text_w/2:y=896:alpha='${alpha(0.55)}'`,
    // Eras in Bebas
    ...(eraA ? [`drawtext=fontfile='${fontAlt}':text='${esc(eraA)}':fontsize=72:fontcolor=FFD700:x=200-text_w/2:y=952:alpha='${alpha(0.65)}'`] : []),
    ...(eraB ? [`drawtext=fontfile='${fontAlt}':text='${esc(eraB)}':fontsize=72:fontcolor=FFD700:x=880-text_w/2:y=952:alpha='${alpha(0.65)}'`] : []),
    // Bottom separator
    `drawtext=fontfile='${fontReg}':text='\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501':fontsize=22:fontcolor=FFD700@0.35:x=(w-text_w)/2:y=1062:alpha='${alpha(0.7)}'`,
    // Desc
    ...(descText ? [`drawtext=fontfile='${fontBold}':text='${descText}':fontsize=46:fontcolor=0xCCCCCC:x=(w-text_w)/2:y=1092:alpha='${alpha(0.8)}'`] : []),
    // Tagline below wordmark
    `drawtext=fontfile='${fontBold}':text='Simula tu versi\u00f3n':fontsize=44:fontcolor=0x666666:x=(w-text_w)/2:y=1790:alpha='${alpha(1.4)}'`,
  ];

  filterParts.push(
    `[${lastLabel}]` + texts.join(',') +
    `,fade=t=in:st=0:d=0.6,fade=t=out:st=${d-0.6}:d=0.6[rvout]`,
  );

  ffmpeg([
    '-y', ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[rvout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '15',
    '-pix_fmt', 'yuv420p', '-an', '-t', String(d),
    outFile,
  ]);
}

async function postProcess(outPath, type, speedSegments = [], matchMeta = null) {
  if (!fs.existsSync(MUSIC_FILE)) {
    console.log('[post] No music file found at', MUSIC_FILE, '— skipping audio mix');
    return outPath;
  }

  const tmp = os.tmpdir();
  const scaledPath  = path.join(tmp, 'golazox_scaled.mp4');

  // Crop the black right margin only when the OS DPI scaling produced a wider-than-1080 capture.
  // At 100% DPI (VPS / most Linux) the capture is already 1080×1920 — no crop needed.
  // At 138% DPI (Windows dev machine) the captured frame is ~1486×1920 — crop to 1080.
  console.log('[post] Crop + upscale to 1080×1920...');
  try {
    // Probe actual video width so we never over-crop
    let capturedWidth = 0;
    const ffprobeBin2 = process.env.FFMPEG_PATH.replace('ffmpeg', 'ffprobe').replace(/ffmpeg\.exe$/, 'ffprobe.exe');
    if (fs.existsSync(ffprobeBin2)) {
      const wProbe = spawnSync(ffprobeBin2, [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        outPath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      capturedWidth = parseInt((wProbe.stdout || '').toString().trim()) || 0;
    }
    const needsCrop = capturedWidth > 0 && capturedWidth > WIDTH + 50;
    const vfFilter  = needsCrop
      ? `crop=iw*${(WIDTH / capturedWidth).toFixed(4)}:ih:0:0,scale=${WIDTH}:${HEIGHT}:flags=lanczos`
      : `scale=${WIDTH}:${HEIGHT}:flags=lanczos`;
    console.log(`[post] capturedWidth=${capturedWidth}, needsCrop=${needsCrop}, filter: ${vfFilter.slice(0, 60)}`);
    ffmpeg(['-y', '-i', outPath,
      '-vf', vfFilter,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30', '-an',
      scaledPath,
    ]);
    fs.renameSync(scaledPath, outPath);
    console.log('[post] Crop + upscale done');
  } catch (scaleErr) {
    console.warn('[post] Upscale failed, using original:', scaleErr.message.slice(0, 150));
  }

  const introPath   = path.join(tmp, 'golazox_intro.mp4');
  const hookPath    = path.join(tmp, 'golazox_hook.mp4');
  const speededPath = path.join(tmp, 'golazox_speeded.mp4');
  const concatPath  = path.join(tmp, 'golazox_concat.mp4');
  const ctaPath     = path.join(tmp, 'golazox_cta.mp4');
  const listFile    = path.join(tmp, 'golazox_list.txt');

  // Apply 3x speedup on simulation waiting segments before concat
  let mainPath = outPath;
  if (speedSegments.length > 0) {
    console.log('[post] Applying 3x speedup to simulation segment(s)...');
    try {
      const seg = speedSegments[0]; // {start, end} in seconds from recording start
      const s = seg.start.toFixed(3);
      const e = seg.end.toFixed(3);
      ffmpeg([
        '-y', '-i', outPath,
        '-filter_complex',
          `[0:v]trim=0:${s},setpts=PTS-STARTPTS[v1];` +
          `[0:v]trim=${s}:${e},setpts=(PTS-STARTPTS)/8[v2];` +
          `[0:v]trim=${e},setpts=PTS-STARTPTS[v3];` +
          `[v1][v2][v3]concat=n=3:v=1:a=0[outv]`,
        '-map', '[outv]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
        '-pix_fmt', 'yuv420p', '-r', '30', '-an',
        speededPath,
      ]);
      mainPath = speededPath;
      console.log('[post] Speedup applied (8x)');
    } catch (e2) {
      console.warn('[post] Speedup failed:', e2.message.slice(0, 200), '— using original');
    }
  }
  const finalPath  = outPath.replace('.mp4', '_final.mp4');

  // For match type: always generate a dynamic intro with team badges + names.
  // For rivalry/derby type: generate a rivalry-specific intro.
  // For ucl/wc: use pre-rendered file or generate from scratch.
  if ((type === 'match' || type === 'rivalry' || type === 'derby') && matchMeta) {
    if (matchMeta.rivalry) {
      // Rivalry/Derby — premium title intro
      console.log(`[post] Generating rivalry intro: ${matchMeta.rivalry.label}...`);
      try {
        createRivalryIntroVideo(matchMeta.rivalry, introPath);
      } catch (e) {
        console.warn('[post] Rivalry intro failed:', e.message.slice(0, 200));
      }
    } else {
      console.log(`[post] Generating match intro: ${matchMeta.teamA} vs ${matchMeta.teamB}...`);
      try {
        createMatchIntroVideo(matchMeta.teamA, matchMeta.eraA || '', matchMeta.teamB, matchMeta.eraB || '', introPath);
      } catch (e) {
        console.warn('[post] Match intro failed:', e.message.slice(0, 200));
      }
    }
  } else {
    // Look for a pre-rendered type-specific intro first (fastest, guaranteed quality)
    const candidateIntros = [
      path.join(OUTPUT_DIR, `intro_${type}.mp4`),
      path.join(OUTPUT_DIR, 'intro_preview.mp4'),
    ];
    const preRenderedIntro = candidateIntros.find(f => fs.existsSync(f));

    if (preRenderedIntro) {
      console.log(`[post] Using pre-rendered intro: ${path.basename(preRenderedIntro)}`);
      try {
        ffmpeg([
          '-y', '-i', preRenderedIntro,
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
          '-pix_fmt', 'yuv420p', '-r', '30', '-an',
          introPath,
        ]);
      } catch (e) {
        console.warn('[post] Re-encode intro failed:', e.message.slice(0, 200));
        fs.copyFileSync(preRenderedIntro, introPath);
      }
    } else {
      console.log(`[post] Generating ${type} intro from scratch...`);
      try {
        createIntroVideo(introPath, 5, type);
      } catch (e) {
        console.warn('[post] Intro creation failed:', e.message.slice(0, 200), '— skipping intro');
      }
    }
  }

  const hasIntro = fs.existsSync(introPath);

  // Build CTA card
  let hasCta = false;
  try {
    createCtaCard(ctaPath, 4);
    hasCta = fs.existsSync(ctaPath);
    if (hasCta) console.log('[post] CTA card created');
  } catch (e) {
    console.warn('[post] CTA card failed:', e.message.slice(0, 150));
  }

  // Hook card (3s — shows final score FIRST to hook viewers: "How did this happen?")
  let hasHook = false;
  if (type === 'match' && matchMeta?.finalScore) {
    try {
      console.log('[post] Generating hook card...');
      createHookCard(
        matchMeta.finalScore.scoreA,
        matchMeta.finalScore.scoreB,
        matchMeta.teamA, matchMeta.teamB,
        matchMeta.eraA,  matchMeta.eraB,
        hookPath,
      );
      hasHook = fs.existsSync(hookPath);
      if (hasHook) console.log('[post] Hook card created');
    } catch (e) {
      console.warn('[post] Hook card failed:', e.message.slice(0, 200));
    }
  }

  // Concat: [hook] + intro + main + CTA
  console.log('[post] Concatenating parts...');
  const parts = [];
  if (hasHook)  parts.push(hookPath.replace(/\\/g, '/'));
  if (hasIntro) parts.push(introPath.replace(/\\/g, '/'));
  parts.push(mainPath.replace(/\\/g, '/'));
  if (hasCta)   parts.push(ctaPath.replace(/\\/g, '/'));
  fs.writeFileSync(listFile, parts.map(p => `file '${p}'`).join('\n'));
  try {
    ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', concatPath]);
  } catch (e) {
    console.warn('[post] Concat failed:', e.message.slice(0, 200), '— using main only');
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
  [hookPath, introPath, concatPath, ctaPath, listFile].forEach(f => { try { fs.unlinkSync(f); } catch {} });

  // Short clip generation disabled — use full video
  if (false) {
    try {
      createShortClip(outPath, type);
    } catch (e) {
      console.warn('[post] Short clip failed:', e.message.slice(0, 150));
    }
  }

  return outPath;
}

// ── Main generator ────────────────────────────────────────────────────────────
async function generateVideo(opts = {}) {
  const type    = opts.type || process.env.VIDEO_TYPE || 'match';
  const outPath = opts.outPath || makeOutputPath();

  console.log(`[video] Generating type=${type} → ${outPath}`);
  await ensureFonts(); // downloads Rajdhani + Bebas Neue on first run

  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 300000, // 5 min — prevents timeout on long stats scroll
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=360,640',
      '--force-device-scale-factor=3', // 3× physical DPI → screencast at 1080×1920 (3× CSS viewport)
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });

  const page = await browser.newPage();
  // DPR=3: CSS viewport stays 360×640 (mobile layout, all breakpoints fire normally).
  // Physical render = 1080×1920 → screencast captures at 1080×1920 → crop+scale only 1.38×.
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3 });

  // Full-width CSS override: remove ALL horizontal padding/margin so content fills 360px.
  // Uses highest-specificity selectors so they beat every @media override.
  await page.evaluateOnNewDocument(() => {
    const s = document.createElement('style');
    s.textContent = [
      '* { overflow-anchor: none !important; }',
      '::-webkit-scrollbar { display: none !important; }',
      // Kill ALL smooth scrolls — prevents trembling when renderResult() calls scrollIntoView
      'html, * { scroll-behavior: auto !important; }',

      // Header: strip horizontal padding so the full-width bar looks clean
      'html body .site-header { padding-left: 0 !important; padding-right: 0 !important; }',
      'html body .header-inner { padding-left: .6rem !important; padding-right: .6rem !important; max-width: none !important; }',
      // Main layout: zero out all horizontal padding & margin
      'html body .main-wrap { padding: 0 !important; margin: .4rem 0 !important; gap: .55rem !important; max-width: none !important; }',
      'html body #main-match-wrap { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }',
      'html body .input-panel { padding: .8rem .55rem .7rem !important; }',
      'html body .glass-card { border-radius: 10px !important; }',
      'html body .live-viewer { padding-left: .3rem !important; padding-right: .3rem !important; }',
      // Live match: full-width column layout
      'html body .live-body { display: flex !important; flex-direction: column !important; width: 100% !important; }',
      'html body .live-pitch-wrap { width: 100% !important; max-height: 220px !important; }',
      'html body .live-pitch-svg { width: 100% !important; max-width: 100% !important; height: 185px !important; flex: 1 !important; }',
      // Pickers: ensure they scroll horizontally cleanly
      'html body .stadium-picker-section, html body .referee-picker-section, html body .weather-picker-section { padding: 0 .3rem !important; }',
      // Hide PWA install sheet during recording
      '.pwa-sheet, .pwa-sheet--visible { display: none !important; }',
    ].join('\n');
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
  });

  const recorder = new PuppeteerScreenRecorder(page, {
    fps: 30,
    // DPR=3 → physical 1080×1920 capture. videoFrame at 1080×1920 means no scaling
    // before encode — full native quality. postProcess then crop+scale is only 1.38×.
    videoFrame: { width: 1080, height: 1920 },
    videoCrf: 18,
    videoCodec: 'libx264',
    videoPreset: 'fast',
    videoBitrate: 6000,
  });

  let videoTitle = 'GolazOX Simulación';

  let speedSegments = [];
  let matchMeta = null;
  try {
    if (type === 'match') {
      ({ title: videoTitle, speedSegments, matchMeta } = await recordMatch(page, recorder, outPath, opts));
    } else if (type === 'rivalry') {
      opts._list = RIVALS_LIST;
      ({ title: videoTitle, speedSegments, matchMeta } = await recordMatch(page, recorder, outPath, opts));
    } else if (type === 'derby') {
      opts._list = DERBIES_LIST;
      ({ title: videoTitle, speedSegments, matchMeta } = await recordMatch(page, recorder, outPath, opts));
    } else if (type === 'ucl') {
      ({ title: videoTitle, speedSegments } = await recordUCL(page, recorder, outPath));
    } else if (type === 'wc') {
      ({ title: videoTitle, speedSegments } = await recordWC(page, recorder, outPath));
    } else {
      ({ title: videoTitle, speedSegments, matchMeta } = await recordMatch(page, recorder, outPath, opts));
    }
  } finally {
    await browser.close();
  }

  // Post-process: add intro card + background music (+ optional speedup)
  await postProcess(outPath, type, speedSegments, matchMeta);

  console.log(`[video] Done → ${outPath}`);
  return { path: outPath, title: videoTitle, matchMeta };
}

// ── Record a single match ─────────────────────────────────────────────────────
async function recordMatch(page, recorder, outPath, opts = {}) {
  // Source list: RIVALS_LIST, DERBIES_LIST, or CLASICOS for plain 'match'
  const sourceList = opts._list || CLASICOS;

  let clasico;
  let rivalry = null; // set if picked from RIVALS_LIST or DERBIES_LIST

  if (opts.teamA) {
    // Explicit teams from CLI args
    clasico = {
      teamA: opts.teamA, eraA: opts.eraA || '',
      teamB: opts.teamB, eraB: opts.eraB || '',
      stadiumId: opts.stadiumId || null,
      refereeId: opts.refereeId || null,
      weatherId: opts.weatherId || null,
    };
  } else {
    // Pick random from source list
    const picked = randomPick(sourceList);
    rivalry = (sourceList === RIVALS_LIST || sourceList === DERBIES_LIST) ? picked : null;
    clasico = {
      teamA:     picked.a.slug,
      eraA:      picked.a.era   || '',
      teamB:     picked.b.slug,
      eraB:      picked.b.era   || '',
      stadiumId: picked.a.stadium || null,
      refereeId: picked.a.referee || null,
      weatherId: picked.a.weather || null,
    };
  }

  // Navigate with team slugs in the URL so _deepLinkRestore() sets the input values.
  const eraPartA = clasico.eraA ? `:${clasico.eraA}` : '';
  const eraPartB = clasico.eraB ? `:${clasico.eraB}` : '';
  const url = `${BASE_URL}/?tab=match&a=${encodeURIComponent(clasico.teamA + eraPartA)}&b=${encodeURIComponent(clasico.teamB + eraPartB)}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await wait(2000); // give _deepLinkRestore() time to populate inputs

  await recorder.start(outPath);

  // ── Goal event tracking ───────────────────────────────────────────────────
  const recStartMs = Date.now();
  const goalEvents = [];
  try {
    await page.exposeFunction('_videoGoalCallback', (a, b, side) => {
      const sec = (Date.now() - recStartMs) / 1000;
      goalEvents.push({ videoSec: sec, scoreA: a, scoreB: b, side });
      console.log(`[match] ⚽ Goal at ${sec.toFixed(1)}s — ${side}: ${a}-${b}`);
    });
  } catch (_) {} // already exposed if page was reused

  // --preview: cut recording at 20s so we can quickly verify layout/flow
  if (opts.preview) {
    setTimeout(async () => {
      try { await recorder.stop(); } catch {}
      console.log('[preview] 20s cut — video ready at', outPath);
      process.exit(0);
    }, 20000);
  }

  // Install speedup for short timers (≤500ms) — covers the 400ms prematch→live fade
  await page.evaluate(() => {
    const origST = window.setTimeout;
    const origSI = window.setInterval;
    window._fastTransition = true;
    window.setTimeout  = function(fn, ms, ...a) {
      if (window._fastTransition && ms > 0 && ms <= 500)
        return origST(fn, Math.max(1, Math.round(ms / 10)), ...a);
      return origST(fn, ms, ...a);
    };
    window.setInterval = function(fn, ms, ...a) {
      if (window._fastTransition && ms > 0 && ms <= 500)
        return origSI(fn, Math.max(1, Math.round(ms / 10)), ...a);
      return origSI(fn, ms, ...a);
    };
  });

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(800);

  // ── STEP 1: Click lookup A — show team A lineup ──
  console.log(`[match] Looking up team A: ${clasico.teamA} ${clasico.eraA}`);
  await page.evaluate(() => {
    const btn = document.getElementById('lookupA');
    btn.disabled = false;
    btn.click();
  });
  await page.waitForFunction(
    () => !document.getElementById('preview-A')?.classList.contains('hidden'),
    { timeout: 30000 },
  );
  console.log('[match] Lineup A loaded');
  // Smooth scroll to show the full lineup A (label is visible above it)
  await page.evaluate(() => document.getElementById('col-a').scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await wait(400);
  await page.evaluate(() => document.getElementById('preview-A').scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await wait(2800);  // viewers read the lineup

  // ── STEP 2: Click lookup B — show team B lineup ──
  console.log(`[match] Looking up team B: ${clasico.teamB} ${clasico.eraB}`);
  await page.evaluate(() => {
    const btn = document.getElementById('lookupB');
    btn.disabled = false;
    btn.click();
  });
  await page.waitForFunction(
    () => !document.getElementById('preview-B')?.classList.contains('hidden'),
    { timeout: 30000 },
  );
  console.log('[match] Lineup B loaded');
  await page.evaluate(() => document.getElementById('col-b').scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await wait(400);
  await page.evaluate(() => document.getElementById('preview-B').scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await wait(2800);  // viewers read the lineup

  // ── STEP 3: Stadium picker — scroll to section, select card, then scroll picker row to show it ──
  if (clasico.stadiumId) {
    await page.evaluate(() => {
      const el = document.querySelector('.stadium-picker-section') || document.getElementById('stadium-picker-row');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    await wait(1000);
    await page.evaluate((id) => {
      window.selectStadium(id);
      // Scroll horizontal picker row so selected card is fully visible
      setTimeout(() => {
        const card = document.querySelector(`.spk-card[data-id="${id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 150);
    }, clasico.stadiumId);
    console.log(`[match] Stadium: ${clasico.stadiumId}`);
    await wait(2000);  // show the selected card highlighted
  }

  // ── STEP 4: Referee picker ──
  if (clasico.refereeId) {
    await page.evaluate(() => {
      const el = document.querySelector('.referee-picker-section') || document.getElementById('referee-picker-row');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    await wait(1000);
    await page.evaluate((id) => {
      window.selectReferee(id);
      setTimeout(() => {
        const card = document.querySelector(`.ref-card[data-id="${id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 150);
    }, clasico.refereeId);
    console.log(`[match] Referee: ${clasico.refereeId}`);
    await wait(2000);
  }

  // ── STEP 5: Weather picker ──
  if (clasico.weatherId) {
    await page.evaluate(() => {
      const el = document.querySelector('.weather-picker-section') || document.getElementById('weather-picker-row');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    await wait(1000);
    await page.evaluate((id) => {
      window.selectWeather(id);
      setTimeout(() => {
        const card = document.querySelector(`.wth-card[data-id="${id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 150);
    }, clasico.weatherId);
    console.log(`[match] Weather: ${clasico.weatherId}`);
    await wait(2000);
  }

  // ── STEP 6: Brief scroll back up to show VS button, then click ──
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForFunction(
    () => document.querySelector('#vs-clash')?.classList.contains('vs-ready'),
    { timeout: 10000 },
  );
  console.log(`[match] Teams ready: ${clasico.teamA} vs ${clasico.teamB}`);
  await wait(700);

  console.log('[match] Clicking #vs-clash...');
  await page.evaluate(() => document.getElementById('vs-clash').click());
  await page.waitForFunction(
    () => !document.getElementById('prematch-screen')?.classList.contains('hidden'),
    { timeout: 15000 },
  );

  // Show prematch for 1.5s (both lineups side by side), then start immediately
  console.log('[match] Pre-match screen — starting simulation directly');
  await wait(1500);

  // Select normal speed and start
  await page.evaluate(() => {
    document.querySelector('.pm-speed-pill[data-tick="667"]')?.click();
  });
  await wait(100);
  await page.evaluate(() => document.getElementById('pm-start-btn').click());

  // Wait for live viewer — transition fires in ~40ms with speedup active
  await page.waitForFunction(
    () => !document.getElementById('live-viewer')?.classList.contains('hidden'),
    { timeout: 5000 },
  );

  // Install goal tracker: MutationObserver watches score elements for changes
  await page.evaluate(() => {
    const elA = document.getElementById('live-score-a');
    const elB = document.getElementById('live-score-b');
    if (!elA || !elB || !window._videoGoalCallback) return;
    let tA = 0, tB = 0;
    new MutationObserver(() => {
      const a = parseInt(elA.textContent) || 0;
      const b = parseInt(elB.textContent) || 0;
      if (a > tA) { tA = a; window._videoGoalCallback(a, b, 'A').catch(() => {}); }
      if (b > tB) { tB = b; window._videoGoalCallback(a, b, 'B').catch(() => {}); }
    }).observe(
      document.getElementById('live-viewer'),
      { childList: true, subtree: true, characterData: true },
    );
  }).catch(() => {});
  // Disable transition speedup — live match events play at real speed (667ms/tick)
  await page.evaluate(() => { window._fastTransition = false; });
  console.log('[match] Live viewer — match running at normal speed (~60s)');

  // ── STEP 7: Wait for results ──
  await page.waitForFunction(
    () => !document.getElementById('results')?.classList.contains('hidden'),
    { timeout: 120000 },
  );
  console.log('[match] Results revealed');

  // scroll-behavior:auto (injected via CSS) ensures renderResult's scrollIntoView is instant.
  // Hold 2.5s on the score (slightly faster than before), then scroll down through stats.
  await wait(2500);

  // ── STEP 8: Cinematic scroll down through stats (slightly faster) ──
  await page.evaluate(async () => {
    await new Promise(resolve => {
      const totalH = Math.max(0, document.body.scrollHeight - window.innerHeight);
      const startY = window.scrollY;
      const remaining = totalH - startY;
      if (remaining <= 0) { resolve(); return; }
      let y = startY;
      let pauseTicks = 0;
      // Pause zones as fractions of remaining distance below start
      const PAUSE_FRACS = [0.25, 0.55, 0.80];
      const pausedSet   = new Set();
      const SPEED       = 9; // px/tick ≈ 270px/s (was 7)

      const timer = setInterval(() => {
        if (pauseTicks > 0) { pauseTicks--; return; }
        const frac = remaining > 0 ? (y - startY) / remaining : 1;
        for (const pf of PAUSE_FRACS) {
          if (!pausedSet.has(pf) && frac >= pf - 0.012) {
            pausedSet.add(pf);
            pauseTicks = 24; // ~0.8s pause at each zone (was 35)
            return;
          }
        }
        y = Math.min(y + SPEED, totalH);
        window.scrollTo(0, y);
        if (y >= totalH) {
          clearInterval(timer);
          setTimeout(resolve, 1500); // was 2000
        }
      }, 33);
    });
  });

  await recorder.stop();

  // Read final score from live-score elements (still visible after results appear)
  const finalScore = await page.evaluate(() => ({
    scoreA: parseInt(document.getElementById('live-score-a')?.textContent) || 0,
    scoreB: parseInt(document.getElementById('live-score-b')?.textContent) || 0,
  })).catch(() => ({ scoreA: 0, scoreB: 0 }));
  console.log(`[match] Final: ${finalScore.scoreA}-${finalScore.scoreB}, ${goalEvents.length} goal(s) tracked`);

  const titleA = clasico.teamA.replace(/-/g, ' ');
  const titleB = clasico.teamB.replace(/-/g, ' ');
  const eraStr = clasico.eraA && clasico.eraB ? ` (${clasico.eraA} vs ${clasico.eraB})` : '';
  const titleLabel = rivalry ? (rivalry.label || rivalry.en) : `${titleA} vs ${titleB}`;
  return {
    title: `${titleLabel}${eraStr} — golazox.com`,
    speedSegments: [],
    matchMeta: {
      teamA: clasico.teamA, eraA: clasico.eraA,
      teamB: clasico.teamB, eraB: clasico.eraB,
      finalScore,
      goalEvents,
      rivalry,
    },
  };
}

// ── Record UCL tournament: draw → server simulation (~32s) → show champion + tabs ──
async function recordUCL(page, recorder, outPath) {
  await page.goto(`${BASE_URL}/?tab=trn`, { waitUntil: 'networkidle0', timeout: 30000 });
  // Lock scroll for UCL/WC — prevents browser jumps during animated draw/results
  await page.evaluate(() => { document.documentElement.style.overflow = 'hidden'; });
  await wait(1500);

  await recorder.start(outPath);
  const recStartMs = Date.now();

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
  const simSegStart = (Date.now() - recStartMs) / 1000;

  // Inject speed overlay during simulation wait
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = '__speed-overlay';
    el.innerHTML = `
      <div style="
        position:fixed; bottom:48px; right:24px; z-index:99999;
        background:rgba(0,0,0,.72); border:2px solid #FFD700;
        border-radius:14px; padding:10px 18px;
        display:flex; align-items:center; gap:10px;
        font-family:system-ui,sans-serif; pointer-events:none;
      ">
        <span style="font-size:1.6rem; line-height:1;">⚡</span>
        <div>
          <div style="color:#FFD700; font-weight:800; font-size:1.05rem; letter-spacing:.04em;">IA × 100</div>
          <div style="color:rgba(255,255,255,.7); font-size:.72rem; margin-top:2px;">Simulando partidos...</div>
        </div>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes __pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(.96)} }
      #__speed-overlay > div { animation: __pulse 1.4s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);
  });

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

  // Remove overlay
  await page.evaluate(() => document.getElementById('__speed-overlay')?.remove());
  const simSegEnd = (Date.now() - recStartMs) / 1000;
  console.log(`[ucl] Sim segment: ${simSegStart.toFixed(1)}s – ${simSegEnd.toFixed(1)}s (will speed 3x)`);

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

  // Calendario — scroll rápido por fase de grupos, luego click en la Final
  await showTab('Calendario');
  // Scroll fast through group stage
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let y = 0;
      const step = () => {
        y = Math.min(y + 25, document.body.scrollHeight - window.innerHeight);
        window.scrollTo(0, y);
        const atBottom = y >= document.body.scrollHeight - window.innerHeight - 10;
        if (!atBottom) setTimeout(step, 30);
        else setTimeout(resolve, 800);
      };
      step();
    });
  });
  // Click the Final match — find the <details> whose summary contains 'Final'
  const finalClicked = await page.evaluate(() => {
    const summaries = [...document.querySelectorAll('.trn-cal-jornada > summary')];
    const finalSummary = summaries.find(s => /\bfinal\b/i.test(s.textContent));
    if (!finalSummary) return 'not found';
    const details = finalSummary.closest('details');
    if (details && !details.open) details.open = true;
    const match = details?.querySelector('[data-match-idx]');
    if (!match) return 'no match in details';
    match.scrollIntoView({ behavior: 'instant', block: 'center' });
    match.click();
    return finalSummary.textContent.trim();
  });
  console.log(`[ucl] Final match click: ${finalClicked}`);
  await wait(5000);
  await page.keyboard.press('Escape');
  await wait(800);
  await resetAllScroll();

  await showTab('Estadística');

  // 8. Clean ending
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(1500);

  await recorder.stop();

  return {
    title: 'Champions League 2025/26 — Torneo Completo — golazox.com',
    speedSegments: [{ start: simSegStart, end: simSegEnd }],
  };
}

// ── Record World Cup simulation ───────────────────────────────────────────────
async function recordWC(page, recorder, outPath) {
  await page.goto(`${BASE_URL}/?tab=trn`, { waitUntil: 'networkidle0', timeout: 30000 });
  // Lock scroll for WC — prevents browser jumps during groups/results display
  await page.evaluate(() => { document.documentElement.style.overflow = 'hidden'; });
  await wait(1500);

  await recorder.start(outPath);
  const recStartMs = Date.now();

  // 1. Click WC preset card → opens groups preview modal
  await page.waitForSelector('[data-preset="wc2026"]', { timeout: 10000 });
  await page.click('[data-preset="wc2026"]');
  console.log('[wc] Preset opened');
  await wait(2500);

  // 2. All 12 groups are visible without scrolling — just hold 3s so viewer can read them
  await wait(3000);

  // 3. Click "▶ Simular Mundial 2026" (#preset-confirm-run)
  await page.waitForSelector('#preset-confirm-run', { timeout: 8000 });
  await page.click('#preset-confirm-run');
  console.log('[wc] Simulation launched, waiting for results (~45s)...');
  const simSegStart = (Date.now() - recStartMs) / 1000;

  // Inject speed overlay — pulsing "⚡ IA × 100" badge shown during simulation wait
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = '__speed-overlay';
    el.innerHTML = `
      <div style="
        position:fixed; bottom:48px; right:24px; z-index:99999;
        background:rgba(0,0,0,.72); border:2px solid #FFD700;
        border-radius:14px; padding:10px 18px;
        display:flex; align-items:center; gap:10px;
        font-family:system-ui,sans-serif; pointer-events:none;
      ">
        <span style="font-size:1.6rem; line-height:1;">⚡</span>
        <div>
          <div style="color:#FFD700; font-weight:800; font-size:1.05rem; letter-spacing:.04em;">IA × 100</div>
          <div style="color:rgba(255,255,255,.7); font-size:.72rem; margin-top:2px;">Simulando 64 partidos...</div>
        </div>
      </div>`;
    // Pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes __pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(.96)} }
      #__speed-overlay > div { animation: __pulse 1.4s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);
  });

  // 4. Wait for simulation to finish — spinner disappears + trn-champion-reveal visible
  const simStart = Date.now();
  for (let i = 0; i < 60; i++) {
    await wait(2000);
    const done = await page.evaluate(() => {
      const spinner = document.querySelector('.trn-spinner');
      const spinnerVisible = spinner && spinner.offsetParent !== null;
      const champion = document.querySelector('#trn-champion-reveal');
      return !spinnerVisible && !!champion;
    });
    const elapsed = Math.round((Date.now() - simStart) / 1000);
    if (done) { console.log(`[wc] Simulation complete at ${elapsed}s`); break; }
    if (elapsed > 100) { console.log('[wc] Timeout — proceeding anyway'); break; }
  }

  // Remove speed overlay once simulation is done
  await page.evaluate(() => document.getElementById('__speed-overlay')?.remove());
  const simSegEnd = (Date.now() - recStartMs) / 1000;
  console.log(`[wc] Sim segment: ${simSegStart.toFixed(1)}s – ${simSegEnd.toFixed(1)}s (will speed 3x)`);

  await wait(2000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(800);

  const resetAllScroll = () => page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll('*').forEach(el => {
      if (el.scrollTop !== 0) el.scrollTop = 0;
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
    });
  });

  // Click tab by data-tab attribute (reliable, no text matching)
  const switchTab = async (tabId) => {
    const found = await page.evaluate((id) => {
      const btn = document.querySelector(`.trn-dash-tab[data-tab="${id}"]`);
      if (btn && btn.offsetParent !== null) { btn.click(); return btn.textContent.trim(); }
      return null;
    }, tabId);
    if (!found) { console.log(`[wc] Tab "${tabId}" not found`); return false; }
    console.log(`[wc] Tab → "${found}" (${tabId})`);
    await wait(700);
    await resetAllScroll();
    await wait(600);
    return true;
  };

  const slowScroll = async (maxPx = 4000, speed = 8, holdMs = 3000) => {
    await page.evaluate(async (max, spd, hold) => {
      await new Promise(resolve => {
        let y = 0;
        const step = () => {
          y = Math.min(y + spd, max, document.body.scrollHeight - window.innerHeight);
          window.scrollTo(0, y);
          const atBottom = y >= document.body.scrollHeight - window.innerHeight - 10;
          if (y < max && !atBottom) setTimeout(step, 40);
          else setTimeout(resolve, hold);
        };
        step();
      });
    }, maxPx, speed, holdMs);
  };

  // 5. Resumen (summary) — champion reveal + top scorers
  await switchTab('summary');
  await slowScroll(6000, 7, 3500);
  await wait(1000);
  await resetAllScroll();
  await wait(500);

  // 6. Cuadro (bracket) — KO bracket, scroll right to show all rounds
  const cuadroShown = await switchTab('bracket');
  if (cuadroShown) {
    await slowScroll(800, 12, 1500);
    await page.evaluate(async () => {
      await new Promise(resolve => {
        const el = document.querySelector('#trn-tab-bracket, .trn-bkt-scroll');
        if (!el) return setTimeout(resolve, 3000);
        let x = 0;
        const max = el.scrollWidth - el.clientWidth;
        if (max <= 0) return setTimeout(resolve, 3000);
        const step = () => {
          x = Math.min(x + 10, max);
          el.scrollLeft = x;
          if (x < max) setTimeout(step, 40);
          else setTimeout(resolve, 2500);
        };
        step();
      });
    });
    await wait(1000);
    await resetAllScroll();
  }

  // 7. Calendario — scroll fast through group matches, then slow to show the FINAL
  const calShown = await switchTab('calendar');
  if (calShown) {
    // Scroll quickly through group stage, stop mid-page where KO section starts
    await slowScroll(12000, 20, 800);
    // KO section rendered in reverse: Final is first, so scroll back up to find it
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await wait(600);

    // Click the Final match — find the <details> whose summary contains 'Final'
    const clicked = await page.evaluate(() => {
      const summaries = [...document.querySelectorAll('.trn-cal-jornada > summary')];
      const finalSummary = summaries.find(s => /\bfinal\b/i.test(s.textContent));
      if (!finalSummary) return 'not found';
      const details = finalSummary.closest('details');
      if (details && !details.open) details.open = true;
      const match = details?.querySelector('[data-match-idx]');
      if (!match) return 'no match in details';
      match.scrollIntoView({ behavior: 'instant', block: 'center' });
      match.click();
      return finalSummary.textContent.trim();
    });
    console.log(`[wc] Final match click: ${clicked}`);

    // Wait for modal to appear and show result
    await wait(5000);

    // Close modal with Escape key
    await page.keyboard.press('Escape');
    await wait(800);
    await resetAllScroll();
  }

  // 8. Stats — goleadores (top scorers)
  const statsShown = await switchTab('stats');
  if (statsShown) {
    await wait(500);
    // Scroll slowly through top scorers list
    await slowScroll(5000, 6, 3500);
    await wait(800);
  }

  await wait(1500);
  await recorder.stop();

  return {
    title: 'FIFA World Cup 2026 Simulado por IA · golazox.com',
    speedSegments: [{ start: simSegStart, end: simSegEnd }],
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  // --rivalry and --derby are shorthand for --type rivalry/derby
  let type = get('--type');
  if (!type && args.includes('--rivalry')) type = 'rivalry';
  if (!type && args.includes('--derby'))   type = 'derby';

  const count     = parseInt(get('--count') || '1', 10);
  const doUpload  = args.includes('--upload');
  const platforms = get('--platforms') || 'youtube';

  const opts = {
    type:      type,
    teamA:     get('--teamA'),
    teamB:     get('--teamB'),
    eraA:      get('--eraA'),
    eraB:      get('--eraB'),
    stadiumId: get('--stadiumId') || get('--stadium'),
    refereeId: get('--refereeId') || get('--referee'),
    weatherId: get('--weatherId') || get('--weather'),
    preview:   args.includes('--preview'),
  };

  (async () => {
    const total = Math.max(1, Math.min(count, 50)); // cap at 50 to avoid accidents
    console.log(`[batch] Generating ${total} video(s) — type=${type || 'match'}`);
    for (let i = 0; i < total; i++) {
      if (total > 1) console.log(`\n[batch] ──── Video ${i + 1} / ${total} ────`);
      try {
        const { path: p, title: t, matchMeta } = await generateVideo({ ...opts });
        console.log(`[batch] ✓ ${i + 1}/${total} → ${p}\n  ${t}`);
        if (doUpload) {
          try {
            const { uploadAll } = require('./uploader.js');
            const { title: uTitle, description, tags } = buildUploadMeta(t, matchMeta, type || 'match');
            console.log(`[batch] 📤 Uploading to ${platforms}: ${uTitle}`);
            await uploadAll({ file: p, title: uTitle, description, tags, platforms, type: type || 'match' });
          } catch (upErr) {
            console.error(`[batch] ✗ Upload error: ${upErr.message}`);
          }
        }
      } catch (err) {
        console.error(`[batch] ✗ ${i + 1}/${total} ERROR:`, err.message);
      }
    }
    if (total > 1) console.log(`\n[batch] Done — ${total} videos generated in ${process.uptime().toFixed(0)}s`);
    process.exit(0);
  })();
}

// ── Build title / description / tags for upload ─────────────────────────────
function buildUploadMeta(videoTitle, matchMeta, type) {
  if (!matchMeta) {
    return {
      title: videoTitle,
      description: '⚽ Simulación generada por IA — golazox.com\n\n🌐 https://golazox.com\n\n#Futbol #Simulacion #GolazOX #Football #IA',
      tags: ['futbol', 'simulacion', 'golazox', 'football', 'inteligencia artificial'],
    };
  }

  const nameA = slugToDisplayName(matchMeta.teamA || '');
  const nameB = slugToDisplayName(matchMeta.teamB || '');
  const eraA  = matchMeta.eraA ? ` (${matchMeta.eraA})` : '';
  const eraB  = matchMeta.eraB ? ` (${matchMeta.eraB})` : '';
  const sA    = matchMeta.finalScore?.scoreA ?? '';
  const sB    = matchMeta.finalScore?.scoreB ?? '';
  const scoreStr = (sA !== '' && sB !== '') ? `${sA}-${sB}` : '';
  const isRivalry = type === 'rivalry' || type === 'derby';
  const rivalry   = matchMeta.rivalry;

  // Title: compact, punchy, TikTok/Short-friendly
  let title;
  if (isRivalry && rivalry?.label) {
    const labelEs = rivalry.label || rivalry.en || '';
    title = scoreStr
      ? `${labelEs}: ${nameA} vs ${nameB} — ${scoreStr} | GolazOX`
      : `${labelEs}: ${nameA} vs ${nameB} | GolazOX`;
  } else {
    title = scoreStr
      ? `${nameA}${eraA} vs ${nameB}${eraB} — ${scoreStr} | GolazOX`
      : `${nameA}${eraA} vs ${nameB}${eraB} | GolazOX`;
  }
  // YouTube title max 100 chars
  if (title.length > 98) title = title.slice(0, 95) + '...';

  // Slug → simple tag (no dash)
  const slugTag = (s) => (s || '').replace(/-/g, '');
  const teamTagA = slugTag(matchMeta.teamA);
  const teamTagB = slugTag(matchMeta.teamB);

  // Hashtags
  const baseHashtags = '#Futbol #FutbolHistorico #Simulacion #GolazOX #Football #IA #Deportes';
  const teamHashtags = `#${teamTagA} #${teamTagB}`;
  const rivalryHashtag = isRivalry ? '#Clasico #Derbi #Rivalidad' : '#PartidoHistorico';
  const allHashtags = `${baseHashtags} ${teamHashtags} ${rivalryHashtag}`;

  // Description body
  const matchLine = isRivalry && rivalry?.desc
    ? `${rivalry.desc} — Simulado con jugadores históricos`
    : `${nameA}${eraA} vs ${nameB}${eraB} — Partido histórico simulado con jugadores reales`;
  const resultLine = scoreStr ? `\n\nResultado final: ${nameA} ${sA} – ${sB} ${nameB}` : '';
  const description = [
    `⚽ ${matchLine}${resultLine}`,
    '',
    '🎮 Simula tu propia versión en golazox.com',
    '👇 Elige equipos históricos, estadio, árbitro y clima',
    '',
    allHashtags,
  ].join('\n');

  const tags = [
    'futbol', 'futbol historico', 'simulacion', 'golazox', 'football',
    'inteligencia artificial', 'ia futbol', 'deportes',
    nameA.toLowerCase(), nameB.toLowerCase(),
    ...(isRivalry ? ['clasico', 'derbi', 'rivalidad futbol'] : ['partido historico']),
  ].filter((v, i, a) => v && a.indexOf(v) === i); // unique, non-empty

  return { title, description, tags };
}

module.exports = { generateVideo, buildUploadMeta };
