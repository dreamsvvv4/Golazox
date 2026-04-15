/**
 * youtube_upload.js
 * Uploads a video file to YouTube using stored OAuth2 refresh token.
 *
 * Required .env keys:
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 *
 * Usage (standalone):
 *   node youtube_upload.js <videoPath> <title> [description] [tags]
 *
 * Usage (module):
 *   const { uploadToYouTube } = require('./youtube_upload');
 *   await uploadToYouTube({ videoPath, title, description, tags, categoryId });
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

/**
 * @param {object} opts
 * @param {string} opts.videoPath   - Absolute path to the .mp4 file
 * @param {string} opts.title       - YouTube video title (max 100 chars)
 * @param {string} [opts.description] - Video description
 * @param {string[]} [opts.tags]    - Array of tags
 * @param {string} [opts.categoryId] - YouTube category ID (17 = Sports)
 * @param {string} [opts.privacyStatus] - 'public' | 'unlisted' | 'private'
 * @param {string} [opts.thumbnail] - Absolute path to thumbnail image (optional)
 * @returns {Promise<{videoId: string, url: string}>}
 */
async function uploadToYouTube({
  videoPath,
  title,
  description = '',
  tags = [],
  categoryId = '17',
  privacyStatus = 'public',
  thumbnail = null,
}) {
  const clientId     = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('[youtube] Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN in .env');
  }
  if (!fs.existsSync(videoPath)) {
    throw new Error(`[youtube] Video file not found: ${videoPath}`);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  console.log(`[youtube] Uploading: ${path.basename(videoPath)}`);
  console.log(`[youtube] Title: ${title}`);

  const fileSize = fs.statSync(videoPath).size;

  const res = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title:       title.slice(0, 100),
          description,
          tags,
          categoryId,
          defaultLanguage: 'es',
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        mimeType: 'video/mp4',
        body:     fs.createReadStream(videoPath),
      },
    },
    {
      onUploadProgress: (evt) => {
        const pct = Math.round((evt.bytesRead / fileSize) * 100);
        process.stdout.write(`\r[youtube] Progress: ${pct}%   `);
      },
    }
  );

  process.stdout.write('\n');
  const videoId = res.data.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[youtube] ✅ Uploaded! ${url}`);

  // Optional: set thumbnail
  if (thumbnail && fs.existsSync(thumbnail)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: 'image/jpeg',
          body:     fs.createReadStream(thumbnail),
        },
      });
      console.log(`[youtube] ✅ Thumbnail set`);
    } catch (e) {
      console.warn(`[youtube] ⚠️  Thumbnail upload failed: ${e.message}`);
    }
  }

  return { videoId, url };
}

module.exports = { uploadToYouTube };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  const [,, videoPath, title, description, tagsStr] = process.argv;
  if (!videoPath || !title) {
    console.error('Usage: node youtube_upload.js <videoPath> <title> [description] [tags,csv]');
    process.exit(1);
  }
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
  uploadToYouTube({ videoPath, title, description: description || '', tags })
    .then(({ url }) => { console.log('Done:', url); process.exit(0); })
    .catch(err => { console.error('Error:', err.message); process.exit(1); });
}
