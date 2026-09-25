#!/usr/bin/env node
'use strict';
const A = require('./_agenda_screenshot');
const dateStr = process.argv[2] || new Date().toISOString().slice(0,10);
(async ()=>{
  try {
    console.log('Generating intro variants for', dateStr);
    // Reels (optimal): 9s, tighter spacing
    console.log('> Reels (9s)');
    // Use static render (single PNG -> MP4) to avoid frame generation
    const ctxReels = A.pickEventsFor(dateStr);
    const htmlReels = A.buildHtml(ctxReels);
    await A.renderHtmlToPngMp4(htmlReels, `agenda_${dateStr}_intro_reels`, 9);
    console.log('> Done Reels');
    // TikTok: 15s, more leisurely
    console.log('> TikTok (15s)');
    const ctxTiktok = A.pickEventsFor(dateStr);
    const htmlTiktok = A.buildHtml(ctxTiktok);
    await A.renderHtmlToPngMp4(htmlTiktok, `agenda_${dateStr}_intro_tiktok`, 15);
    console.log('> Done TikTok');
    // Stories: 6s, compact
    console.log('> Stories (6s)');
    const ctxStories = A.pickEventsFor(dateStr);
    const htmlStories = A.buildHtml(ctxStories);
    await A.renderHtmlToPngMp4(htmlStories, `agenda_${dateStr}_intro_stories`, 6);
    console.log('> Done Stories');
    console.log('All variants generated.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
