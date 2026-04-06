/**
 * Debug: wait for simulation to complete (progress bar hidden) then inspect results
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });

  // 1-3. Click preset + draw + wait
  await page.click('[data-preset="ucl2026"]');
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => document.querySelector('#ucl-start-btn')?.click());
  console.log('[1] Draw started');

  // Wait for draw to finish (~6s)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    const done = await page.evaluate(() => {
      const btn = document.querySelector('#ucl-sim-btn');
      return btn && btn.offsetParent !== null;
    });
    if (done) { console.log(`[2] Draw done at ${i*0.4}s`); break; }
  }

  // 4. Click Simular
  await page.evaluate(() => document.querySelector('#ucl-sim-btn')?.click());
  const simStart = Date.now();
  console.log('[3] Simulation started. Waiting for progress to complete...');

  // 5. Poll until trn-spinner disappears (simulation done)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const elapsed = Math.round((Date.now() - simStart) / 1000);

    const state = await page.evaluate(() => {
      const spinner = document.querySelector('.trn-spinner');
      const progressBar = document.querySelector('.trn-progress-bar');
      const spinnerVisible = spinner && spinner.offsetParent !== null;
      const barVisible = progressBar && progressBar.offsetParent !== null;
      const textLen = document.body.innerText.length;
      
      // Progress text if available
      const progText = document.querySelector('.trn-progress-text, #trn-progress-text');
      const progPct = document.querySelector('.trn-progress-bar');
      
      return {
        spinnerVisible,
        barVisible,
        textLen,
        progressText: progText ? progText.textContent.trim() : null,
        progressWidth: progPct ? progPct.style.width : null
      };
    });

    process.stdout.write(`[${elapsed}s] Spinner:${state.spinnerVisible} Bar:${state.barVisible} Width:${state.progressWidth} TextLen:${state.textLen}\r`);

    if (!state.spinnerVisible && !state.barVisible && state.textLen > 2000) {
      console.log(`\n✅ SIMULATION COMPLETE at ${elapsed}s! TextLen: ${state.textLen}`);
      break;
    }
  }

  const elapsed = Math.round((Date.now() - simStart) / 1000);
  console.log(`\nTotal simulation time: ${elapsed}s`);

  // 6. Dump page
  const finalState = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ id: b.id, text: b.textContent.trim().substring(0, 40) }));
    
    const headings = [...document.querySelectorAll('h1, h2, h3, h4')]
      .filter(h => h.offsetParent !== null)
      .map(h => h.textContent.trim().substring(0, 60));
    
    const keyElements = {
      champion: !!document.querySelector('.trn-champ, .trn-champion, [class*="champion"]'),
      scorers: !!document.querySelector('.trn-scorers, [class*="scorer"], [class*="goleador"]'),
      table: !!document.querySelector('.trn-table, [class*="standings"], table'),
    };

    return { 
      textLen: document.body.innerText.length, 
      firstChars: document.body.innerText.substring(0, 400), 
      buttons: btns,
      headings,
      keyElements
    };
  });

  console.log('\n=== FINAL STATE ===');
  console.log('TextLen:', finalState.textLen);
  console.log('First 400 chars:', finalState.firstChars);
  console.log('\nKey elements:', finalState.keyElements);
  console.log('\nHeadings:', finalState.headings);
  console.log('\nButtons:', finalState.buttons);

  await browser.close();
})();
