const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Click on UCL preset
  const preset = await page.waitForSelector('[data-preset="ucl2026"]', { timeout: 10000 });
  console.log('[1] Clicked UCL preset');
  await preset.click();
  await new Promise(r => setTimeout(r, 2000));
  
  // Click draw button
  const drawBtn = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-start-btn');
    if (btn) { 
      btn.click();
      return true;
    }
    return false;
  });
  console.log('[2] Clicked draw button');
  
  // Wait very long for draw + any computation
  console.log('[3] Waiting 15 seconds for draw + computation...');
  
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    
    const status = await page.evaluate(() => {
      const btn = document.querySelector('#ucl-start-btn');
      const state = btn ? btn.textContent.trim() : 'no button';
      const btns = [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent !== null)
        .filter(b => b.textContent.includes('Simular') || b.textContent.includes('Siguiente'));
      return { startBtn: state, simulateCount: btns.length };
    });
    
    process.stdout.write(`[${i*0.5}s] Start: "${status.startBtn}" | Simulate btns: ${status.simulateCount}\r`);
    
    if (status.startBtn && !status.startBtn.includes('Sorteando') && status.simulateCount > 0) {
      console.log('\n✅ Draw complete and simulate buttons found!');
      break;
    }
  }
  
  // Final button inspection
  const allBtns = await page.evaluate(() => {
    return [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ 
        text: b.textContent.trim().substring(0, 40)
      }));
  });
  
  console.log('\n=== FINAL BUTTON STATE ===');
  allBtns.forEach((btn, i) => {
    console.log(`[${i}] "${btn.text}"`);
  });
  
  await browser.close();
})();
