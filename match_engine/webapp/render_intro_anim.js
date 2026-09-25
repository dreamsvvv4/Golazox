#!/usr/bin/env node
'use strict';
const A = require('./_agenda_screenshot');
const dateStr = process.argv[2] || new Date().toISOString().slice(0,10);
(async ()=>{
  try {
    console.log('Rendering animated intro for', dateStr);
    const r = await A.renderAnimatedIntro(dateStr, `agenda_${dateStr}_intro_anim`, 6, 30);
    console.log('Done:', r);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
