const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
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
  
  // 3. Wait for draw
  await new Promise(r => setTimeout(r, 20000));
  console.log('[3] Draw should be done');
  
  // 4. Click simulator button
  const simFound = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-sim-btn');
    if (btn && btn.offsetParent !== null) {
      console.log('Found and clicking ucl-sim-btn');
      btn.click();
      return true;
    }
    return false;
  });
  
  if (simFound) {
    console.log('[4] Clicked ucl-sim-btn');
  } else {
    console.log('[4] ucl-sim-btn not found!');
  }
  
  // Wait for page to load tournament view
  await new Promise(r => setTimeout(r, 4000));
  console.log('[5] Waiting done, inspecting page...');
  
  // Detailed inspection
  const info = await page.evaluate(() => {
    const allText = document.body.innerText;
    const btns = [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ 
        id: b.id, 
        text: b.textContent.trim().substring(0, 40),
        class: b.className.substring(0, 40)
      }));
    
    return {
      bodyTextLength: allText.length,
      firstChars: allText.substring(0, 300),
      buttonCount: btns.length,
      buttons: btns
    };
  });
  
  console.log(`\n=== PAGE STATE AFTER CLICKING ucl-sim-btn ===`);
  console.log(`Text length: ${info.bodyTextLength}`);
  console.log(`First 300 chars:\n${info.firstChars}\n...`);
  console.log(`\nButtons (${info.buttonCount} total):`);
  info.buttons.forEach((b, i) => {
    console.log(`  [${i}] ID: "${b.id}" | Text: "${b.text}" | Class: "${b.class}"`);
  });
  
  await browser.close();
})();
