'use strict';
const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  let audioUrl = null;

  page.on('response', async (resp) => {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (ct.includes('audio') || url.includes('bensound.com') && (url.includes('.mp3') || url.includes('.m4a') || url.includes('/audio/'))) {
      console.log('[net]', ct.padEnd(25), url.substring(0, 200));
      if (!audioUrl && (url.includes('.mp3') || url.includes('.m4a') || ct.includes('audio'))) audioUrl = url;
    }
  });

  // Log ALL CDN audio requests
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('cdn2.bensound') || url.includes('/audio/')) {
      console.log('[req]', url.substring(0, 200));
    }
  });

  console.log('[1] Navigating to Bensound Epic track...');
  await page.goto('https://www.bensound.com/royalty-free-music/track/epic', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  console.log('[2] Looking for play button...');
  const played = await page.evaluate(() => {
    const selectors = [
      'button[aria-label*="play" i]',
      'button[class*="play" i]',
      '[class*="PlayButton"]',
      '[class*="playButton"]',
      '[data-testid*="play"]',
      '.player-play',
      '#play-btn',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return sel; }
    }
    const btns = [...document.querySelectorAll('button')];
    const playBtn = btns.find(b => {
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      return label.includes('play') || label.includes('reproducir');
    });
    if (playBtn) { playBtn.click(); return 'aria-label'; }
    // Try clicking the first button near an audio element
    const audio = document.querySelector('audio');
    if (audio) { const parent = audio.closest('div'); if (parent) { const btn = parent.querySelector('button'); if (btn) { btn.click(); return 'audio-parent'; } } }
    return null;
  });
  console.log('[2] Play clicked via:', played);

  await new Promise(r => setTimeout(r, 6000));

  // Check for audio element source
  const audioSrcs = await page.evaluate(() => {
    const all = [...document.querySelectorAll('audio, source')];
    return all.map(el => el.src || el.currentSrc || el.getAttribute('src')).filter(Boolean);
  });
  console.log('[audio elements found]', audioSrcs);
  
  // Also check page source for cdn2.bensound.com audio URLs
  const srcInPage = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script')].map(s => s.textContent).join('');
    const html = document.documentElement.innerHTML;
    const matches = html.match(/https?:\/\/cdn\d?\.bensound\.com\/[^"'\s]+\.mp3/g);
    return matches || [];
  });
  console.log('[CDN URLs in page HTML]', srcInPage);

  if (!audioUrl && audioSrcs.length > 0) audioUrl = audioSrcs[0];
  if (!audioUrl && srcInPage.length > 0) audioUrl = srcInPage[0];

  await browser.close();

  if (!audioUrl) {
    console.error('[ERROR] Could not capture audio URL from Pixabay');
    process.exit(1);
  }

  console.log('[3] Downloading:', audioUrl);
  if (!fs.existsSync('assets')) fs.mkdirSync('assets');
  const outFile = path.join('assets', 'music_epic.mp3');
  const file = fs.createWriteStream(outFile);
  const protocol = audioUrl.startsWith('https') ? https : http;
  protocol.get(audioUrl, (res) => {
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      const size = fs.statSync(outFile).size;
      console.log(`[4] Saved → ${outFile} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    });
  }).on('error', err => {
    console.error('[download error]', err.message);
    fs.unlink(outFile, () => {});
    process.exit(1);
  });
})();
