const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // 1-2. Click preset + draw
  await page.click('[data-preset="ucl2026"]');
  await new Promise(r => setTimeout(r, 2000));
  
  const drawClicked = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-start-btn');
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log(`[1] Draw button clicked: ${drawClicked}`);
  
  // Wait for draw, checking status every 500ms
  console.log('[2] Monitoring draw status...');
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    
    const status = await page.evaluate(() => {
      const startBtn = document.querySelector('#ucl-start-btn');
      const simBtn = document.querySelector('#ucl-sim-btn');
      const drawRunning = startBtn && startBtn.textContent.includes('Sorteando');
      const simVisible = simBtn && simBtn.offsetParent !== null;
      
      return {
        startBtnText: startBtn ? startBtn.textContent.trim().substring(0, 30) : 'GONE',
        simBtnVisible: simVisible,
        drawRunning
      };
    });
    
    process.stdout.write(`[${i*0.5}s] Start: "${status.startBtnText}" | Sim visible: ${status.simBtnVisible}\r`);
    
    if (status.simBtnVisible) {
      console.log('\n✅ ucl-sim-btn appeared!');
      break;
    }
  }
  
  await browser.close();
})();
