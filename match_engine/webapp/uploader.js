/**
 * uploader.js — GolazOX Social Media Uploader
 *
 * Uploads a video to: YouTube Shorts, Instagram Reels, Facebook Reels, X (Twitter), TikTok
 *
 * Usage:
 *   node uploader.js --file videos/golazox_XXX.mp4 --title "Champions League 2025/26" --platforms youtube,instagram,facebook,x,tiktok
 *   node uploader.js --file videos/golazox_XXX.mp4 --platforms youtube   ← single platform
 *   node uploader.js --latest --platforms all                             ← most recent video
 *
 * Setup: copy .env.example → .env and fill in your credentials
 */

'use strict';

require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const http     = require('http');
const { execSync, spawnSync } = require('child_process');

const { google }        = require('googleapis');
const { TwitterApi }    = require('twitter-api-v2');
const FormData          = require('form-data');
const fetch             = require('node-fetch');

const VIDEOS_DIR = path.join(__dirname, 'videos');

// ── Helpers ───────────────────────────────────────────────────────────────────
function env(key, required = true) {
  const v = process.env[key];
  if (!v && required) throw new Error(`Missing env var: ${key}. Check your .env file.`);
  return v;
}

function latestVideoFile() {
  const files = fs.readdirSync(VIDEOS_DIR)
    .filter(f => f.endsWith('.mp4') && !f.includes('intro_preview') && !f.includes('short'))
    .map(f => ({ f, t: fs.statSync(path.join(VIDEOS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error('No MP4 files found in videos/');
  return path.join(VIDEOS_DIR, files[0].f);
}

// ── Chapter timestamps per video type ────────────────────────────────────────
const CHAPTERS = {
  ucl: [
    '00:00 Intro — GolazOX',
    '00:05 Sorteo Champions League',
    '00:55 Fase de Grupos',
    '01:40 Octavos de Final',
    '02:10 Cuartos de Final',
    '02:35 Semifinales',
    '02:55 FINAL',
    '03:20 🏆 Campeón',
  ].join('\n'),
  wc: [
    '00:00 Intro — GolazOX',
    '00:05 Sorteo Mundial 2026',
    '00:55 Fase de Grupos',
    '01:50 Octavos de Final',
    '02:20 Cuartos de Final',
    '02:45 Semifinales',
    '03:05 FINAL',
    '03:30 🏆 Campeón del Mundo',
  ].join('\n'),
  match: [
    '00:00 Intro — GolazOX',
    '00:05 Presentación del partido',
    '00:20 ¡Comienza el partido!',
    '01:10 Goles y jugadas clave',
    '02:00 Resultado final',
  ].join('\n'),
};

// ── YouTube Shorts ────────────────────────────────────────────────────────────
// Auth: OAuth2 (run `node uploader.js --auth youtube` first)
// Docs: https://developers.google.com/youtube/v3/guides/uploading_a_video

async function uploadYouTube({ file, title, description, tags, type }) {
  console.log('[youtube] Uploading...');

  // Guard: prevent uploading the same file twice within 10 minutes
  const lockFile = path.join(__dirname, 'logs', `yt_${path.basename(file)}.lock`);
  try {
    if (fs.existsSync(lockFile)) {
      const age = Date.now() - fs.statSync(lockFile).mtimeMs;
      if (age < 10 * 60 * 1000) {
        console.warn(`[youtube] SKIPPED — already uploaded this file ${Math.round(age/1000)}s ago (lock: ${lockFile})`);
        return null;
      }
    }
    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    fs.writeFileSync(lockFile, String(Date.now()));
  } catch { /* non-fatal */ }

  const oauth2 = new google.auth.OAuth2(
    env('YOUTUBE_CLIENT_ID'),
    env('YOUTUBE_CLIENT_SECRET'),
    'http://localhost:8085',
  );
  oauth2.setCredentials({
    refresh_token: env('YOUTUBE_REFRESH_TOKEN'),
  });

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  const chapters = CHAPTERS[type] || (type === 'rival' ? CHAPTERS.match : CHAPTERS.ucl);
  const typeDesc  = DESCRIPTIONS[type] || DESCRIPTIONS.ucl;
  const fullDescription = description ||
    `${typeDesc}\n\n${title}\n\n${chapters}\n\n${DEFAULT_HASHTAGS}`;

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description: fullDescription,
        tags: tags || DEFAULT_TAGS,
        categoryId: '17',  // Sports
        defaultLanguage: 'es',
        defaultAudioLanguage: 'es',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(file),
    },
  });

  const videoId = res.data.id;
  console.log(`[youtube] ✓ https://youtube.com/shorts/${videoId}`);
  return videoId;
}

// ── Instagram Reels ───────────────────────────────────────────────────────────
// Auth: Meta Graph API — Business/Creator account required
// Docs: https://developers.facebook.com/docs/instagram-api/guides/reels-publishing

async function uploadInstagram({ file, title, description }) {
  const accessToken = env('META_ACCESS_TOKEN');
  const igUserId    = env('INSTAGRAM_USER_ID');
  const caption     = `${title}\n\n${description || DEFAULT_DESCRIPTION}\n\n${DEFAULT_HASHTAGS}`;

  // Build CDN URL from golazox.com/videos/ (server.js serves this path statically)
  const videoUrl = env('META_VIDEO_CDN_URL', false) || `https://golazox.com/videos/${path.basename(file)}`;
  console.log(`[instagram] Step 1/2 — Creating container (video: ${videoUrl})...`);

  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        access_token: accessToken,
      }),
    },
  );
  const createData = await createRes.json();
  if (createData.error) throw new Error(`Instagram create: ${createData.error.message}`);

  const containerId = createData.id;
  console.log(`[instagram] Container created: ${containerId}, waiting for processing...`);

  // Poll until container is ready (FINISHED)
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    const statusData = await statusRes.json();
    if (statusData.status_code === 'FINISHED') break;
    if (statusData.status_code === 'ERROR') throw new Error('Instagram video processing failed');
    console.log(`[instagram] Status: ${statusData.status_code}...`);
  }

  // Step 2: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    },
  );
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`Instagram publish: ${publishData.error.message}`);

  console.log(`[instagram] ✓ Post ID: ${publishData.id}`);
  return publishData.id;
}

// ── Facebook Reels ────────────────────────────────────────────────────────────
// Auth: Meta Graph API — Same token, different endpoint (Page token)
// Docs: https://developers.facebook.com/docs/video-api/guides/reels-publishing

async function uploadFacebook({ file, title, description }) {
  const accessToken = env('META_ACCESS_TOKEN');
  const pageId      = env('FACEBOOK_PAGE_ID');
  const caption     = `${title}\n\n${description || DEFAULT_DESCRIPTION}\n\n${DEFAULT_HASHTAGS}`;

  const videoUrl = env('META_VIDEO_CDN_URL', false) || `https://golazox.com/videos/${path.basename(file)}`;
  console.log(`[facebook] Uploading Reel (video: ${videoUrl})...`);

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'start',
        access_token: accessToken,
      }),
    },
  );
  const initData = await res.json();
  if (initData.error) throw new Error(`Facebook init: ${initData.error.message}`);

  const videoId = initData.video_id;

  // Finish phase with CDN URL
  const finishRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: videoId,
        video_url: videoUrl,
        description: caption,
        published: true,
        access_token: accessToken,
      }),
    },
  );
  const finishData = await finishRes.json();
  if (finishData.error) throw new Error(`Facebook finish: ${finishData.error.message}`);

  console.log(`[facebook] ✓ Video ID: ${videoId}`);
  return videoId;
}

// ── X (Twitter) ───────────────────────────────────────────────────────────────
// Auth: Twitter API v2 — OAuth 1.0a (app tokens)
// Docs: https://developer.twitter.com/en/docs/twitter-api/media/uploading-media

async function uploadX({ file, title }) {
  console.log('[x] Uploading media...');

  const client = new TwitterApi({
    appKey:            env('X_API_KEY'),
    appSecret:         env('X_API_SECRET'),
    accessToken:       env('X_ACCESS_TOKEN'),
    accessSecret:      env('X_ACCESS_SECRET'),
  });

  const tweetText = `${title}\n\n${DEFAULT_HASHTAGS_SHORT}\n\n🌐 golazox.com`;

  // Upload video (chunked upload, handled by twitter-api-v2)
  const mediaId = await client.v1.uploadMedia(file, {
    mimeType: 'video/mp4',
    longVideo: true,
  });
  console.log(`[x] Media uploaded: ${mediaId}`);

  // Post tweet via v1.1 (compatible with Pay Per Use plan)
  const tweet = await client.v1.tweet(tweetText, { media_ids: mediaId });

  console.log(`[x] ✓ https://x.com/i/status/${tweet.id_str}`);
  return tweet.id_str;
}

// ── X text-only tweet via OAuth 2.0 (free plan compatible) ───────────────────
async function tweetYouTubeLink({ title, ytUrl }) {
  console.log('[x] Posting tweet with YouTube link...');

  const clientId     = env('X_OAUTH2_CLIENT_ID');
  const clientSecret = env('X_OAUTH2_CLIENT_SECRET');
  const refreshToken = env('X_OAUTH2_REFRESH_TOKEN');

  // Exchange refresh token → new access token
  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`X OAuth2 token refresh failed: ${err}`);
  }
  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;
  const newRefresh  = tokens.refresh_token;

  // Persist updated refresh token to .env
  if (newRefresh && newRefresh !== refreshToken) {
    const envPath = require('path').join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/X_OAUTH2_REFRESH_TOKEN=.*/, `X_OAUTH2_REFRESH_TOKEN=${newRefresh}`);
    fs.writeFileSync(envPath, envContent);
  }

  // Post tweet
  const tweetText = `${title}\n\n▶️ ${ytUrl}\n\n${DEFAULT_HASHTAGS_SHORT}\n\n🌐 golazox.com`;
  const tweetRes = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text: tweetText }),
  });
  if (!tweetRes.ok) {
    const err = await tweetRes.text();
    throw new Error(`X tweet failed (${tweetRes.status}): ${err}`);
  }
  const tweet = await tweetRes.json();
  const tweetId = tweet.data.id;
  console.log(`[x] ✓ https://x.com/i/status/${tweetId}`);
  return tweetId;
}

// ── X OAuth 2.0 auth setup (run once: node uploader.js --auth x) ─────────────
async function authX() {
  const http   = require('http');
  const crypto = require('crypto');
  const { exec } = require('child_process');

  const clientId   = env('X_OAUTH2_CLIENT_ID');
  const REDIRECT   = 'http://localhost:8086';
  const codeVerifier  = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(8).toString('hex');

  const authUrl = `https://x.com/i/oauth2/authorize?` +
    `response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
    `&scope=${encodeURIComponent('tweet.write tweet.read users.read offline.access')}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  console.log('\n[x] Opening browser for X OAuth 2.0 authorization...');
  const openCmd = `start "" "${authUrl}"`;
  exec(openCmd);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url  = new URL(req.url, REDIRECT);
      const code = url.searchParams.get('code');
      if (!code) { res.end('<h2>Waiting...</h2>'); return; }

      res.end('<h2 style="font-family:sans-serif;color:green">✓ Autorizado. Puedes cerrar esta ventana.</h2>');
      server.close();

      try {
        const clientSecret = env('X_OAUTH2_CLIENT_SECRET');
        const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
          },
          body: new URLSearchParams({
            code,
            grant_type:    'authorization_code',
            redirect_uri:  REDIRECT,
            code_verifier: codeVerifier,
          }),
        });
        const tokens = await tokenRes.json();
        if (!tokens.refresh_token) throw new Error('No refresh_token in response: ' + JSON.stringify(tokens));

        const envPath = require('path').join(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/X_OAUTH2_REFRESH_TOKEN=.*/, `X_OAUTH2_REFRESH_TOKEN=${tokens.refresh_token}`);
        fs.writeFileSync(envPath, envContent);

        console.log('\n[x] ✓ X OAuth 2.0 configurado correctamente!');
        console.log('[x] Test: node uploader.js --auth-test-x');
        resolve(tokens);
      } catch (e) { reject(e); }
    });
    server.listen(8086, '127.0.0.1', () => console.log('[x] Esperando autorización en http://localhost:8086 ...'));
    server.on('error', reject);
  });
}


// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
// NOTE: Uses Direct Post (video.publish) with PUBLIC_TO_EVERYONE — approved in TikTok developer portal.

const TIKTOK_HASHTAGS = {
  ucl:   '#Futbol #ChampionsLeague #UCL #Simulacion #GolazOX #Football #IA #Deportes',
  wc:    '#Futbol #Mundial2026 #WorldCup #Simulacion #GolazOX #Football #IA #Deportes',
  match: '#Futbol #Simulacion #GolazOX #Football #IA #Deportes #FutbolIA',
};

async function uploadTikTok({ file, title, type }) {
  const accessToken = env('TIKTOK_ACCESS_TOKEN');

  const hashtags = TIKTOK_HASHTAGS[type] || TIKTOK_HASHTAGS.ucl;
  const caption = `${title}\n\n⚽ Simúlalo TÚ en golazox.com 👆\n\n${hashtags}`;
  console.log('[tiktok] Caption:', caption);
  console.log('[tiktok] Initializing upload...');

  const fileSize = fs.statSync(file).size;

  // Step 1: Initialize upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: fileSize,
        chunk_size: fileSize,
        total_chunk_count: 1,
      },
    }),
  });
  const initData = await initRes.json();
  if (initData.error?.code !== 'ok') throw new Error(`TikTok init: ${JSON.stringify(initData.error)}`);

  const { upload_url, publish_id } = initData.data;
  console.log(`[tiktok] publish_id: ${publish_id}, uploading file...`);

  // Step 2: Upload binary
  const videoBuffer = fs.readFileSync(file);
  await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
    },
    body: videoBuffer,
  });

  // Step 3: Poll status
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publish_id }),
    });
    const statusData = await statusRes.json();
    const status = statusData.data?.status;
    console.log(`[tiktok] Status: ${status}`);
    if (status === 'PUBLISH_COMPLETE') {
      console.log(`[tiktok] ✓ Published (publish_id: ${publish_id})`);
      return publish_id;
    }
    if (status === 'FAILED') throw new Error(`TikTok publish failed: ${JSON.stringify(statusData)}`);
  }

  throw new Error('TikTok upload timed out');
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const DESCRIPTIONS = {
  ucl: [
    '🌐 https://golazox.com — Simula tu propio torneo',
    '',
    '⚽ ¿Quién ganará la Champions League 2025/26? Lo simulamos con inteligencia artificial.',
    'Sorteo, fase de grupos, eliminatorias y final — todo simulado con datos reales.',
  ].join('\n'),
  wc: [
    '🌐 https://golazox.com — Simula tu propio Mundial',
    '',
    '⚽ ¿Quién ganará el Mundial 2026? Lo simulamos con inteligencia artificial.',
    'Sorteo, fase de grupos, eliminatorias y final — todo simulado con datos reales.',
  ].join('\n'),
  rival: [
    '🌐 https://golazox.com — Simula tu propio partido',
    '',
    '⚽ ¿Quién ganará este partido histórico? Lo simulamos con inteligencia artificial.',
    'Partido simulado con datos reales de los mejores jugadores.',
  ].join('\n'),
  match: [
    '🌐 https://golazox.com — Simula el partido de hoy',
    '',
    '⚽ ¿Quién ganará hoy? Simulamos el partido del día con inteligencia artificial.',
    'Alineaciones reales, estadísticas actualizadas y resultado sorprendente.',
  ].join('\n'),
  daily: [
    '🌐 https://golazox.com — Simula el partido de hoy',
    '',
    '⚽ ¿Quién ganará hoy? Simulamos el partido del día con inteligencia artificial.',
    'Alineaciones reales, estadísticas actualizadas y resultado sorprendente.',
  ].join('\n'),
};
const DEFAULT_DESCRIPTION = DESCRIPTIONS.ucl;
const DEFAULT_TAGS        = [
  'futbol', 'champions league', 'simulacion', 'golazox', 'football',
  'ucl', 'deportes', 'futbol historico', 'inteligencia artificial',
  'real madrid', 'barcelona', 'simulador futbol', 'partido historico',
];
const DEFAULT_HASHTAGS    = '#Futbol #ChampionsLeague #Simulacion #GolazOX #Football #UCL #Deportes #FutbolHistorico #IA';
const DEFAULT_HASHTAGS_SHORT = '#Futbol #UCL #GolazOX #Football';

// ── Main upload orchestrator ──────────────────────────────────────────────────
async function uploadAll({ file, title, description, platforms, type }) {
  const active = platforms === 'all'
    ? ['youtube', 'instagram', 'facebook', 'x', 'tiktok']
    : platforms.split(',').map(p => p.trim().toLowerCase());

  console.log(`\n[upload] File: ${path.basename(file)}`);
  console.log(`[upload] Title: ${title}`);
  console.log(`[upload] Platforms: ${active.join(', ')}\n`);

  const results = {};

  for (const platform of active) {
    try {
      switch (platform) {
        case 'youtube':   results.youtube   = await uploadYouTube({ file, title, description, type }); break;
        case 'instagram': results.instagram = await uploadInstagram({ file, title, description }); break;
        case 'facebook':  results.facebook  = await uploadFacebook({ file, title, description }); break;
        case 'x':
        case 'twitter':   results.x         = await uploadX({ file, title }); break;
        case 'tiktok':    results.tiktok     = await uploadTikTok({ file, title, type }); break;
        default: console.warn(`[upload] Unknown platform: ${platform}`);
      }
    } catch (e) {
      console.error(`[${platform}] ✗ ERROR: ${e.message}`);
      results[platform] = { error: e.message };
    }
  }

  console.log('\n[upload] Summary:', results);
  return results;
}

// ── OAuth setup helper (YouTube) ──────────────────────────────────────────────
async function authYouTube() {
  const http = require('http');
  const { exec } = require('child_process');

  const REDIRECT = 'http://localhost:8085';

  const oauth2 = new google.auth.OAuth2(
    env('YOUTUBE_CLIENT_ID'),
    env('YOUTUBE_CLIENT_SECRET'),
    REDIRECT,
  );
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    prompt: 'consent',
  });

  console.log('\n[youtube] Opening browser for authorization...');

  // Open browser automatically
  const openCmd = process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`;
  exec(openCmd);

  // Spin up a temporary local HTTP server to capture the auth code
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, REDIRECT);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.end('<h2>Error: ' + error + '</h2>');
        server.close();
        return reject(new Error('Auth denied: ' + error));
      }

      if (!code) {
        res.end('<h2>Waiting...</h2>');
        return;
      }

      res.end('<h2 style="font-family:sans-serif;color:green">✓ Autorizado correctamente. Puedes cerrar esta ventana.</h2>');
      server.close();

      try {
        const { tokens } = await oauth2.getToken(code);
        console.log('\n[youtube] ✓ Got refresh token — saving to .env...');

        // Write YOUTUBE_REFRESH_TOKEN into .env
        const envPath = require('path').join(__dirname, '.env');
        let envContent = require('fs').readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/YOUTUBE_REFRESH_TOKEN=.*/, `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
        require('fs').writeFileSync(envPath, envContent);

        console.log('[youtube] ✓ .env updated — YouTube is ready!');
        console.log('[youtube] Test: node uploader.js --latest --platforms youtube');
        resolve(tokens);
      } catch (e) {
        reject(e);
      }
    });

    server.listen(8085, '127.0.0.1', () => {
      console.log('[youtube] Waiting for browser authorization on http://localhost:8085 ...');
    });

    server.on('error', reject);
  });
}

async function authExchangeYouTube(code) {
  const oauth2 = new google.auth.OAuth2(
    env('YOUTUBE_CLIENT_ID'),
    env('YOUTUBE_CLIENT_SECRET'),
    'http://localhost:8085',
  );
  const { tokens } = await oauth2.getToken(code);
  console.log('\n[youtube] Add to your .env:\n');
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
}

// ── OAuth setup helper (TikTok) ───────────────────────────────────────────────
// Docs: https://developers.tiktok.com/doc/oauth-user-access-token-management
async function authTikTok() {
  const { exec } = require('child_process');
  const crypto = require('crypto');

  const clientKey    = env('TIKTOK_CLIENT_KEY');
  const REDIRECT     = 'https://golazox.com/tiktok-callback';
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(8).toString('hex');

  // Save codeVerifier temporarily so auth-exchange-tiktok can use it
  const verifierFile = require('path').join(__dirname, '.tiktok_verifier');
  require('fs').writeFileSync(verifierFile, JSON.stringify({ codeVerifier, state }));

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?` +
    `client_key=${clientKey}` +
    `&scope=user.info.basic,video.publish,video.upload` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  console.log('\n[tiktok] Opening browser for authorization...');
  console.log('[tiktok] Auth URL:', authUrl);
  console.log('[tiktok] After authorizing, copy the code from golazox.com/tiktok-callback');
  console.log('[tiktok] Then run: node uploader.js --auth-exchange-tiktok YOUR_CODE\n');
  const openCmd = process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`;
  exec(openCmd);
}

async function authExchangeTikTok(code) {
  const clientKey    = env('TIKTOK_CLIENT_KEY');
  const clientSecret = env('TIKTOK_CLIENT_SECRET');
  const REDIRECT     = 'https://golazox.com/tiktok-callback';

  const verifierFile = path.join(__dirname, '.tiktok_verifier');
  let codeVerifier = '';
  try {
    codeVerifier = JSON.parse(fs.readFileSync(verifierFile, 'utf8')).codeVerifier;
  } catch { throw new Error('Run --auth tiktok first to generate a code verifier'); }

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey, client_secret: clientSecret,
      code, grant_type: 'authorization_code',
      redirect_uri: REDIRECT, code_verifier: codeVerifier,
    }).toString(),
  });
  const rawBody = await tokenRes.text();
  console.log('[tiktok] Token response:', rawBody);
  const tokenData = JSON.parse(rawBody);
  if (tokenData.error) throw new Error(`TikTok token error: ${tokenData.error} — ${tokenData.error_description}`);

  const { access_token, refresh_token, open_id } = tokenData;
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent
    .replace(/TIKTOK_ACCESS_TOKEN=.*/, `TIKTOK_ACCESS_TOKEN=${access_token}`)
    .replace(/TIKTOK_REFRESH_TOKEN=.*/, `TIKTOK_REFRESH_TOKEN=${refresh_token || ''}`);
  fs.writeFileSync(envPath, envContent);
  try { fs.unlinkSync(verifierFile); } catch {}
  console.log('\n[tiktok] ✓ Access token saved to .env!');
  console.log(`[tiktok] open_id: ${open_id}`);
  console.log('[tiktok] Test: node uploader.js --latest --platforms tiktok');
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const has  = (flag) => args.includes(flag);

  if (has('--auth') && get('--auth') === 'youtube') {
    authYouTube().catch(e => { console.error(e.message); process.exit(1); });
  } else if (has('--auth') && get('--auth') === 'x') {
    authX().catch(e => { console.error(e.message); process.exit(1); });
  } else if (has('--auth') && get('--auth') === 'tiktok') {
    authTikTok().catch(e => { console.error(e.message); process.exit(1); });
  } else if (has('--auth-exchange')) {
    authExchangeYouTube(get('--auth-exchange')).catch(e => { console.error(e.message); process.exit(1); });
  } else if (has('--auth-exchange-tiktok')) {
    authExchangeTikTok(get('--auth-exchange-tiktok')).catch(e => { console.error(e.message); process.exit(1); });
  } else {
    let file = get('--file');
    if (!file && has('--latest')) file = latestVideoFile();
    if (!file) { console.error('Usage: node uploader.js --file <path> --title "..." --platforms all'); process.exit(1); }
    if (!path.isAbsolute(file)) file = path.resolve(file);

    const type        = get('--type')        || 'ucl';
    const DEFAULT_TITLES = {
      ucl:   'Champions League 2025/26 Simulado por IA · golazox.com',
      wc:    'FIFA World Cup 2026 Simulado por IA · golazox.com',
      match: 'Partido Histórico Simulado por IA · golazox.com',
      rival: 'Partido Histórico Simulado por IA · golazox.com',
    };
    const title       = get('--title')       || DEFAULT_TITLES[type] || DEFAULT_TITLES.ucl;
    const description = get('--description') || undefined;
    const platforms   = get('--platforms')   || 'all';

    uploadAll({ file, title, description, platforms, type })
      .then(() => process.exit(0))
      .catch(e => { console.error('[upload] Fatal:', e.message); process.exit(1); });
  }
}

module.exports = { uploadAll, uploadYouTube, uploadInstagram, uploadFacebook, uploadX, uploadTikTok };

