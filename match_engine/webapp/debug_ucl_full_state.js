const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Intercept console logs and debug messages
  page.on('console', msg => {
    if (msg.type() !== 'log') console.log(`[browser] ${msg.type()}: ${msg.text()}`);
  });
  
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // 1. Click preset
  await page.click('[data-preset="ucl2026"]');
  console.log('[1] Clicked preset');
  await new Promise(r => setTimeout(r, 2000));
  
  // 2. Click draw
  await page.evaluate(() => {
    const btn = document.querySelector('#ucl-start-btn');
    if (btn) btn.click();
  });
  console.log('[2] Clicked draw');
  
  // 3. Wait for draw to complete
  console.log('[3] Waiting 16s for draw...');
  await new Promise(r => setTimeout(r, 16000));
  
  // 4. Click Simular
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Simular'));
    if (btn) btn.click();
  });
  console.log('[4] Clicked Simular tournaments');
  
  // Wait for page to update
  await new Promise(r => setTimeout(r, 3000));
  
  // Detailed DOM inspection
  const info = await page.evaluate(() => {
    return {
      // Check main containers
      title: document.title,
      bodyClasses: document.body.className,
      
      // Look for UCL-specific elements
      uclContainer: !!document.querySelector('[class*="ucl"], [id*="ucl"]'),
      torneoContainer: !!document.querySelector('[class*="torneo"], [id*="torneo"]'),
      
      // Look for match/round display elements
      matchElements: document.querySelectorAll('[class*="match"], [class*="round"]').length,
      
      // All visible text content (first 500 chars)
      textContent: document.body.innerText.substring(0, 500),
      
      // All button texts
      buttons: [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent !== null)
        .map(b => b.textContent.trim().substring(0, 40))
    };
  });
  
  console.log('\n=== PAGE STATE AFTER SIMULAR ===');
  console.log(`Title: "${info.title}"`);
  console.log(`Body classes: "${info.bodyClasses}"`);
  console.log(`Has UCL container: ${info.uclContainer}`);
  console.log(`Has Torneo container: ${info.torneoContainer}`);
  console.log(`Match/Round elements: ${info.matchElements}`);
  console.log(`\nButtons:`);
  info.buttons.forEach((b, i) => {
    console.log(`  [${i}] "${b}"`);
  });
  console.log(`\nFirst 500 chars of page text:\n${info.textContent}\n...`);
  
  await browser.close();
})();
