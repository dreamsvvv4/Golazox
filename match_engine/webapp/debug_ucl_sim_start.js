const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // 1. Click preset
  const preset = await page.waitForSelector('[data-preset="ucl2026"]', { timeout: 10000 });
  await preset.click();
  console.log('[1] Clicked preset');
  await new Promise(r => setTimeout(r, 2000));
  
  // 2. Click draw  
  const drawBtn = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-start-btn');
    if (btn) btn.click();
    return true;
  });
  console.log('[2] Clicked draw button');
  
  // 3. Wait for draw (15 seconds should be enough)
  await new Promise(r => setTimeout(r, 16000));
  
  // 4. Click "Simular Champions"
  const simBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Simular'));
    if (btn) {
      console.log('Clicking Simular button...');
      btn.click();
      return btn.textContent.trim();
    }
    return null;
  });
  console.log(`[3] Clicked Simular: ${simBtn}`);
  
  // 5. After clicking Simular, wait and check what buttons appear
  console.log('[4] Waiting 5 seconds after clicking Simular...');
  await new Promise(r => setTimeout(r, 5000));
  
  const btns = await page.evaluate(() => {
    return [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ text: b.textContent.trim().substring(0, 50) }));
  });
  
  console.log('\n=== BUTTONS AFTER CLICKING SIMULAR ===');
  btns.forEach((b, i) => {
    console.log(`[${i}] "${b.text}"`);
  });
  
  // Check for any "Siguiente" or phase buttons
  const hasNextButton = btns.some(b => b.text.includes('Siguiente') || b.text.includes('→'));
  console.log(`\nHas "Siguiente" button: ${hasNextButton}`);
  
  await browser.close();
})();
