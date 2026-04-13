/**
 * tiktok_poster.js — GolazOX TikTok Uploader
 *
 * Sube un video MP4 a TikTok usando la Content Posting API v2.
 * Documentación: https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
 *
 * Setup (una sola vez):
 *   1. Crear app en https://developers.tiktok.com/
 *   2. Activar "Content Posting API" scope
 *   3. Generar access_token (flow OAuth 2.0 — ver instrucciones abajo)
 *   4. Poner en .env o variables de entorno del servidor:
 *        TIKTOK_ACCESS_TOKEN=...
 *        TIKTOK_OPEN_ID=...  (User's open_id, obtenido durante OAuth)
 *
 * Usage:
 *   const { postToTikTok } = require('./tiktok_poster');
 *   await postToTikTok('/path/to/video.mp4', 'Real Madrid vs Barça 2002 · golazox.com', ['futbol','simulacion']);
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ── TikTok API constants ──────────────────────────────────────────────────────
const TIKTOK_API  = 'open.tiktokapis.com';
const INIT_PATH   = '/v2/post/publish/video/init/';
const STATUS_PATH = '/v2/post/publish/status/fetch/';

// ── Default hashtags ──────────────────────────────────────────────────────────
const DEFAULT_HASHTAGS = ['futbol', 'simulador', 'golazox', 'football', 'champions'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCredentials() {
  const token  = process.env.TIKTOK_ACCESS_TOKEN;
  const openId = process.env.TIKTOK_OPEN_ID;
  if (!token)  throw new Error('Missing TIKTOK_ACCESS_TOKEN env variable');
  if (!openId) throw new Error('Missing TIKTOK_OPEN_ID env variable');
  return { token, openId };
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error && json.error.code !== 'ok') {
            reject(new Error(`TikTok API error: ${json.error.code} — ${json.error.message}`));
          } else {
            resolve(json);
          }
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function uploadChunk(uploadUrl, videoBuffer, offset, chunkSize) {
  return new Promise((resolve, reject) => {
    const chunk = videoBuffer.slice(offset, offset + chunkSize);
    const urlObj = new URL(uploadUrl);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${offset}-${offset + chunk.length - 1}/${videoBuffer.length}`,
        'Content-Length': chunk.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(chunk);
    req.end();
  });
}

// ── Main upload function ──────────────────────────────────────────────────────
async function postToTikTok(videoPath, title, hashtags = DEFAULT_HASHTAGS) {
  const { token, openId } = getCredentials();

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const videoBuffer = fs.readFileSync(videoPath);
  const videoSize   = videoBuffer.length;
  const CHUNK_SIZE  = 10 * 1024 * 1024; // 10 MB chunks

  console.log(`[tiktok] Uploading ${path.basename(videoPath)} (${(videoSize / 1024 / 1024).toFixed(1)} MB)`);

  // Build caption with hashtags
  const hashtagStr = hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ');
  const caption    = `${title}\n${hashtagStr}\ngolazox.com`;

  // 1. Init upload
  const initBody = {
    post_info: {
      title:         caption.slice(0, 2200),
      privacy_level: 'SELF_ONLY', // ← cambiar a 'PUBLIC_TO_EVERYONE' cuando esté listo
      disable_duet:  false,
      disable_stitch: false,
      disable_comment: false,
    },
    source_info: {
      source:          'FILE_UPLOAD',
      video_size:      videoSize,
      chunk_size:      CHUNK_SIZE,
      total_chunk_count: Math.ceil(videoSize / CHUNK_SIZE),
    },
  };

  const initResp = await httpsRequest({
    hostname: TIKTOK_API,
    path:     INIT_PATH,
    method:   'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json; charset=UTF-8',
    },
  }, initBody);

  const publishId = initResp.data?.publish_id;
  const uploadUrl = initResp.data?.upload_url;

  if (!publishId || !uploadUrl) {
    throw new Error(`[tiktok] Init failed: ${JSON.stringify(initResp)}`);
  }

  console.log(`[tiktok] publish_id=${publishId}, uploading ${Math.ceil(videoSize / CHUNK_SIZE)} chunks...`);

  // 2. Upload chunks
  let offset = 0;
  let chunkIdx = 0;
  while (offset < videoSize) {
    const status = await uploadChunk(uploadUrl, videoBuffer, offset, CHUNK_SIZE);
    console.log(`[tiktok]   chunk ${chunkIdx + 1} → HTTP ${status}`);
    offset += CHUNK_SIZE;
    chunkIdx++;
  }

  // 3. Poll status
  console.log('[tiktok] Waiting for processing...');
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 5000));
    const statusResp = await httpsRequest({
      hostname: TIKTOK_API,
      path:     STATUS_PATH,
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json; charset=UTF-8',
      },
    }, { publish_id: publishId });

    const st = statusResp.data?.status;
    console.log(`[tiktok]   status=${st}`);

    if (st === 'PUBLISH_COMPLETE') {
      console.log(`[tiktok] Published! publish_id=${publishId}`);
      return { publishId, status: 'published' };
    }
    if (st === 'FAILED') {
      throw new Error(`[tiktok] Publish failed: ${JSON.stringify(statusResp)}`);
    }
    attempts++;
  }

  throw new Error('[tiktok] Timed out waiting for publish status');
}

// ── CLI test ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const videoPath = process.argv[2];
  const title     = process.argv[3] || 'Simulación GolazOX ⚽';
  if (!videoPath) {
    console.error('Usage: node tiktok_poster.js <video.mp4> [title]');
    process.exit(1);
  }
  postToTikTok(videoPath, title)
    .then(r => { console.log('Done:', r); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { postToTikTok };
