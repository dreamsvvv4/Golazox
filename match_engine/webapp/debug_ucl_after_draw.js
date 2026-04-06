const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Click on UCL preset
  const preset = await page.waitForSelector('[data-preset="ucl2026"]', { timeout: 10000 });
  console.log('[step 1] Clicked UCL preset card');
  await preset.click();
  await new Promise(r => setTimeout(r, 2000));
  
  // Click draw button
  const drawBtn = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-start-btn');
    if (btn) { 
      btn.click();
      return btn.textContent.trim();
    }
    return null;
  });
  console.log(`[step 2] Clicked draw button: "${drawBtn}"`);
  
  // Wait for draw to complete
  console.log('[step 3] Waiting for draw to complete...');
  await new Promise(r => setTimeout(r, 6000));
  
  // Check button status
  const btns = await page.evaluate(() => {
    return [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ 
        id: b.id || 'none', 
        text: b.textContent.trim().substring(0, 60)
      }));
  });
  
  console.log('\n=== VISIBLE BUTTONS AFTER DRAW ===');
  btns.forEach((btn, i) => {
    console.log(`[${i}] ID: "${btn.id}" | Text: "${btn.text}"`);
  });
  
  await browser.close();
})();
