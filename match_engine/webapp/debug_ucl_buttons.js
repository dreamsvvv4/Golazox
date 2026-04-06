const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Click on UCL preset
  const preset = await page.waitForSelector('[data-preset="ucl2026"]', { timeout: 10000 });
  console.log('[debug] Found UCL preset button');
  await preset.click();
  
  // Wait for buttons to appear
  await page.waitForTimeout(3000);
  
  // Inspect what buttons exist
  const btns = await page.evaluate(() => {
    return [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)  // visible only
      .map(b => ({ 
        id: b.id || 'none', 
        text: b.textContent.trim().substring(0, 60), 
        classes: b.className.substring(0, 60)
      }));
  });
  
  console.log('\n=== ALL VISIBLE BUTTONS ===');
  btns.forEach((btn, i) => {
    console.log(`[${i}] ID: "${btn.id}" | Text: "${btn.text}" | Classes: "${btn.classes}"`);
  });
  
  // Also check for modal/dialog
  const modal = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    const m = document.querySelector('.modal.active');
    const c = document.querySelector('[class*="preset"]');
    return {
      dialogOpen: !!d,
      modalActive: !!m,
      presetEl: !!c
    };
  });
  console.log('\n=== MODAL STATE ===');
  console.log(JSON.stringify(modal, null, 2));
  
  await browser.close();
})();
