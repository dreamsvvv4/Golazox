/**
 * social_scheduler.js — GolazOX Auto-Poster
 *
 * Genera y publica videos automáticamente en TikTok.
 * Se ejecuta como proceso PM2 con cron_restart (ver ecosystem.config.js).
 *
 * Ciclo diario: elige tipo → graba → sube → logea
 *
 * Variables de entorno necesarias (hPanel → Node.js → Environment Variables):
 *   TIKTOK_ACCESS_TOKEN   → token OAuth de la cuenta TikTok
 *   TIKTOK_OPEN_ID        → open_id del usuario TikTok
 *   GOLAZOX_URL           → https://golazox.com (default)
 *   SOCIAL_DRY_RUN        → si = '1', genera video pero NO sube (para testing)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env.social') });

const { generateVideo }       = require('./video_generator');
const { postToTikTok  }       = require('./tiktok_poster');
const { getDailyMatchVideo }  = require('./daily_matches');
const fs   = require('fs');
const path = require('path');

// ── Log ───────────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'logs', 'social.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* non-fatal */ }
}

// ── Type rotation — evita repetir el mismo tipo dos veces seguidas ────────────
const STATE_FILE = path.join(__dirname, 'logs', 'social_state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastType: null, count: 0 };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* non-fatal */ }
}

function pickType(lastType) {
  // Rotación: daily → epic → ucl → daily → epic → wc → topical → epic
  // 'epic' uses RIVALS_LIST+DERBIES_LIST with premium rivalry intro cards
  // 'topical' always picks from current UCL/Champions matches (highest topical relevance)
  const rotation = ['daily', 'epic', 'ucl', 'daily', 'epic', 'wc', 'topical', 'epic'];
  const state = loadState();
  const idx = (state.count || 0) % rotation.length;
  const type = rotation[idx];
  saveState({ lastType: type, count: (state.count || 0) + 1 });
  return type;
}

// ── Hashtags por tipo ─────────────────────────────────────────────────────────
const HASHTAGS = {
  match:   ['futbol', 'football', 'simulador', 'golazox', 'clasico', 'futbolhistorico', 'simulator'],
  epic:    ['futbol', 'football', 'simulador', 'golazox', 'clasico', 'futbolhistorico', 'derbi'],
  topical: ['championsleague', 'ucl', 'futbol', 'golazox', 'simulador', 'arsenal', 'realmadrid'],
  ucl:     ['championsleague', 'ucl', 'futbol', 'golazox', 'simulador', 'champions', 'football'],
  wc:      ['mundial', 'worldcup', 'futbol', 'golazox', 'simulador', 'wc2026', 'football'],
  daily:   ['futbol', 'partidodehoy', 'football', 'golazox', 'simulador', 'jornada'],
};

// Build match-specific hashtags from matchMeta (team slugs → readable tags)
function buildMatchHashtags(type, matchMeta) {
  const base = HASHTAGS[type] || HASHTAGS.match;
  if (!matchMeta) return base;
  const teamTags = [matchMeta.teamA, matchMeta.teamB]
    .map(s => (s || '').replace(/^fc-|[^a-z0-9]/g, '').toLowerCase())
    .filter(Boolean);
  // Add rivalry label tag if present
  const labelTag = matchMeta.rivalry?.label
    ? matchMeta.rivalry.label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    : null;
  const extra = [...teamTags, labelTag].filter(Boolean);
  // Deduplicate and cap at 8 total hashtags (TikTok sweet spot)
  const all = [...new Set([...base, ...extra])].slice(0, 8);
  return all;
}

// ── Clean up old videos (keep last 5) ────────────────────────────────────────
function cleanOldVideos() {
  const dir = path.join(__dirname, 'videos');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.mp4'))
    .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  files.slice(5).forEach(f => {
    try { fs.unlinkSync(path.join(dir, f.name)); log(`Cleaned: ${f.name}`); } catch { /* ok */ }
  });
}

// ── Lock file — prevents double execution if PM2 restarts while running ──────
const LOCK_FILE = path.join(__dirname, 'logs', 'social.lock');

function acquireLock() {
  try {
    // Check if a lock already exists and is fresh (< 30 min old)
    if (fs.existsSync(LOCK_FILE)) {
      const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      if (age < 30 * 60 * 1000) {
        log(`ABORTED — another instance is running (lock age: ${Math.round(age/1000)}s). Exiting.`);
        process.exit(0);
      }
      log('Stale lock found (> 30 min), overwriting.');
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  } catch { return true; } // non-fatal if lock can't be written
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch { /* ok */ }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('=== Social scheduler starting ===');
  acquireLock();

  const dryRun = process.env.SOCIAL_DRY_RUN === '1';
  const type   = pickType();

  log(`Type: ${type} | DryRun: ${dryRun}`);

  // 1. Generate video
  let videoPath, title, matchMeta;
  try {
    if (type === 'daily') {
      // Try today's real match first, fall back to 'epic' if not available
      const daily = await getDailyMatchVideo({ dryRun: false });
      if (daily) {
        videoPath = daily.path;
        title     = daily.title;
        matchMeta = daily.matchMeta;
        log(`Video diario generado: ${videoPath} | ${title}`);
      } else {
        log('No hay partido del día disponible, usando epic de fallback.');
        const result = await generateVideo({ type: 'epic' });
        videoPath = result.path;
        title     = result.title;
        matchMeta = result.matchMeta;
      }
    } else {
      const result = await generateVideo({ type });
      videoPath = result.path;
      title     = result.title;
      matchMeta = result.matchMeta;
    }
    log(`Video generado: ${videoPath}`);
  } catch (err) {
    log(`ERROR generating video: ${err.message}`);
    process.exit(1);
  }

  if (dryRun) {
    log(`DRY RUN — would post: "${title}" from ${videoPath}`);
    log('Set SOCIAL_DRY_RUN=0 to enable real posting.');
    cleanOldVideos();
    releaseLock();
    return;
  }

  // 2. Post to TikTok
  try {
    const tags = buildMatchHashtags(type, matchMeta);
    log(`Hashtags: ${tags.join(', ')}`);
    const result = await postToTikTok(videoPath, title, tags);
    log(`TikTok posted: publish_id=${result.publishId}`);
  } catch (err) {
    log(`ERROR posting to TikTok: ${err.message}`);
    // Don't exit 1 — video was generated, just posting failed
  }

  // 3. Cleanup
  cleanOldVideos();
  releaseLock();
  log('=== Done ===');
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  releaseLock();
  process.exit(1);
});
