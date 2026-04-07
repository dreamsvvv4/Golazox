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

// ── YouTube Shorts ────────────────────────────────────────────────────────────
// Auth: OAuth2 (run `node uploader.js --auth youtube` first)
// Docs: https://developers.google.com/youtube/v3/guides/uploading_a_video

async function uploadYouTube({ file, title, description, tags }) {
  console.log('[youtube] Uploading...');

  const oauth2 = new google.auth.OAuth2(
    env('YOUTUBE_CLIENT_ID'),
    env('YOUTUBE_CLIENT_SECRET'),
    'urn:ietf:wg:oauth:2.0:oob',
  );
  oauth2.setCredentials({
    refresh_token: env('YOUTUBE_REFRESH_TOKEN'),
  });

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description: description || `${title}\n\n${DEFAULT_DESCRIPTION}`,
        tags: tags || DEFAULT_TAGS,
        categoryId: '17',  // Sports
        defaultLanguage: 'es',
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

  console.log('[instagram] Step 1/2 — Creating container...');

  // Step 1: Upload video to Meta container
  const videoUrl = env('META_VIDEO_CDN_URL', false);
  if (!videoUrl) {
    console.warn('[instagram] ⚠ META_VIDEO_CDN_URL not set. Instagram Reels API requires the video to be hosted on a public HTTPS URL.');
    console.warn('[instagram]   Upload your video to a CDN/S3 bucket and set META_VIDEO_CDN_URL=https://...');
    throw new Error('META_VIDEO_CDN_URL required for Instagram (see .env.example)');
  }

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

  const videoUrl = env('META_VIDEO_CDN_URL', false);
  if (!videoUrl) {
    console.warn('[facebook] ⚠ META_VIDEO_CDN_URL required (same as Instagram). Skipping.');
    throw new Error('META_VIDEO_CDN_URL required for Facebook Reels');
  }

  console.log('[facebook] Uploading Reel...');

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

  // Post tweet
  const tweet = await client.v2.tweet({
    text: tweetText,
    media: { media_ids: [mediaId] },
  });

  console.log(`[x] ✓ https://x.com/i/status/${tweet.data.id}`);
  return tweet.data.id;
}

// ── TikTok ────────────────────────────────────────────────────────────────────
// Auth: TikTok Content Posting API (requires creator app approval)
// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
// NOTE: TikTok's API requires direct_post permission approved by TikTok.
//       For now this uses the "inbox upload" flow (draft) which works without approval.

async function uploadTikTok({ file, title }) {
  const accessToken = env('TIKTOK_ACCESS_TOKEN');

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
        title,
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
const DEFAULT_DESCRIPTION = 'Simulación generada por IA en golazox.com\nSimula partidos históricos con cualquier equipo y era 🔥';
const DEFAULT_TAGS        = ['futbol', 'champions league', 'simulacion', 'golazox', 'football', 'ucl', 'deportes'];
const DEFAULT_HASHTAGS    = '#Futbol #ChampionsLeague #Simulacion #GolazOX #Football #UCL #Deportes';
const DEFAULT_HASHTAGS_SHORT = '#Futbol #UCL #GolazOX #Football';

// ── Main upload orchestrator ──────────────────────────────────────────────────
async function uploadAll({ file, title, description, platforms }) {
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
        case 'youtube':   results.youtube   = await uploadYouTube({ file, title, description }); break;
        case 'instagram': results.instagram = await uploadInstagram({ file, title, description }); break;
        case 'facebook':  results.facebook  = await uploadFacebook({ file, title, description }); break;
        case 'x':
        case 'twitter':   results.x         = await uploadX({ file, title }); break;
        case 'tiktok':    results.tiktok     = await uploadTikTok({ file, title }); break;
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
  const oauth2 = new google.auth.OAuth2(
    env('YOUTUBE_CLIENT_ID'),
    env('YOUTUBE_CLIENT_SECRET'),
    'urn:ietf:wg:oauth:2.0:oob',
  );
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
  });
  console.log('\n[youtube] Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nPaste the code here and add it to .env as YOUTUBE_REFRESH_TOKEN after exchanging:\n');
  console.log('  node uploader.js --auth-exchange <CODE>');
}

async function authExchangeYouTube(code) {
  const oauth2 = new google.auth.OAuth2(
    env('YOUTUBE_CLIENT_ID'),
    env('YOUTUBE_CLIENT_SECRET'),
    'urn:ietf:wg:oauth:2.0:oob',
  );
  const { tokens } = await oauth2.getToken(code);
  console.log('\n[youtube] Add to your .env:\n');
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const has  = (flag) => args.includes(flag);

  if (has('--auth') && get('--auth') === 'youtube') {
    authYouTube().catch(e => { console.error(e.message); process.exit(1); });
  } else if (has('--auth-exchange')) {
    authExchangeYouTube(get('--auth-exchange')).catch(e => { console.error(e.message); process.exit(1); });
  } else {
    let file = get('--file');
    if (!file && has('--latest')) file = latestVideoFile();
    if (!file) { console.error('Usage: node uploader.js --file <path> --title "..." --platforms all'); process.exit(1); }
    if (!path.isAbsolute(file)) file = path.resolve(file);

    const title       = get('--title')       || 'Champions League 2025/26 Simulado — golazox.com';
    const description = get('--description') || DEFAULT_DESCRIPTION;
    const platforms   = get('--platforms')   || 'all';

    uploadAll({ file, title, description, platforms })
      .then(() => process.exit(0))
      .catch(e => { console.error('[upload] Fatal:', e.message); process.exit(1); });
  }
}

module.exports = { uploadAll, uploadYouTube, uploadInstagram, uploadFacebook, uploadX, uploadTikTok };
