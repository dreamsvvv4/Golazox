'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { postToTikTok } = require('./tiktok_poster');
const path = require('path');
const fs   = require('fs');

const VIDEOS_DIR = path.join(__dirname, 'videos');

const videos = [
  {
    file:    'scores_wc2026_2026-07-19T09-36-05.mp4',
    caption: '¿Cuál será el marcador EXACTO de la final? 🤖 La IA simuló 1.000 veces...',
    tags:    ['futbol','wc2026','argentina','espana','simulador','prediccion','mundial','final'],
  },
  {
    file:    'yamal_wc2026_2026-07-19T09-36-05.mp4',
    caption: 'Si Yamal marca, España gana el 59% de las finales 🔥 ¿Marca mañana?',
    tags:    ['lamineYamal','espana','wc2026','futbol','simulador','mundial','final'],
  },
  {
    file:    'sinmessi_wc2026_2026-07-19T09-36-05.mp4',
    caption: '¿Qué pasa si Messi NO juega la final? 😱 La IA tiene la respuesta',
    tags:    ['messi','argentina','wc2026','futbol','simulador','mundial','final'],
  },
];

const which = parseInt(process.argv[2] || '0', 10);
const v = videos[which];
if (!v) { console.error('Uso: node _post_tiktok.js [0|1|2]'); process.exit(1); }

const fullPath = path.join(VIDEOS_DIR, v.file);
if (!fs.existsSync(fullPath)) { console.error('Video no encontrado:', fullPath); process.exit(1); }

console.log(`[post] Subiendo vídeo ${which + 1}/3: ${v.file}`);
postToTikTok(fullPath, v.caption, v.tags)
  .then(r => { console.log('[post] ✅ Publicado:', JSON.stringify(r)); })
  .catch(e => { console.error('[post] ❌ Error:', e.message); process.exit(1); });
