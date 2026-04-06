/**
 * Debug: full UCL flow — draw → click Simular → wait up to 90s for results
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });

  // 1. Click preset
  await page.click('[data-preset="ucl2026"]');
  await new Promise(r => setTimeout(r, 2000));
  console.log('[1] UCL preset opened');

  // 2. Click draw button
  await page.evaluate(() => document.querySelector('#ucl-start-btn')?.click());
  console.log('[2] Draw started');

  // 3. Wait for #ucl-sim-btn (draw animation complete)
  console.log('[3] Waiting for draw to complete...');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    const visible = await page.evaluate(() => {
      const btn = document.querySelector('#ucl-sim-btn');
      return btn && btn.offsetParent !== null;
    });
    if (visible) { console.log(`[3] Draw done at ${i * 0.5}s`); break; }
  }

  // 4. Click Simular Champions
  const simText = await page.evaluate(() => {
    const btn = document.querySelector('#ucl-sim-btn');
    if (btn) { btn.click(); return btn.textContent.trim(); }
    return null;
  });
  console.log(`[4] Clicked Simular: "${simText}"`);

  // 5. Poll for results — check every 2s up to 90s
  console.log('[5] Waiting for server simulation to complete...');
  let resultsFound = false;
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const state = await page.evaluate(() => {
      // Check for champion display, standings, top scorers
      const champion = document.querySelector('[class*="champion"], [class*="winner"], #trn-champion, .trn-champ');
      const standings = document.querySelector('[class*="standings"], [class*="clasificacion"], #trn-standings');
      const scorers = document.querySelector('[class*="scorer"], [class*="goleador"], #trn-scorers');
      const progress = document.querySelector('[class*="progress"], [class*="trn-progress"]');
      const resultContainer = document.querySelector('.trn-result, #trn-result, [class*="trn-res"]');

      // Get a snapshot of all IDs and classes that might indicate results
      const allIds = [...document.querySelectorAll('[id]')].map(e => e.id).filter(Boolean);
      const visibleSections = [...document.querySelectorAll('[class*="trn-"]')]
        .filter(e => e.offsetParent !== null)
        .map(e => e.id || e.className.substring(0, 40))
        .slice(0, 20);

      const btns = [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent !== null)
        .map(b => b.textContent.trim().substring(0, 40));

      return {
        hasChampion: !!champion,
        hasStandings: !!standings,
        hasScorers: !!scorers,
        hasProgress: !!progress,
        hasResult: !!resultContainer,
        allIds: allIds.slice(0, 20),
        visibleSections,
        bodyTextLength: document.body.innerText.length,
        buttons: btns
      };
    });

    process.stdout.write(`[${(i+1)*2}s] Champion:${state.hasChampion} Standings:${state.hasStandings} Scorers:${state.hasScorers} TextLen:${state.bodyTextLength}\r`);

    if (state.hasChampion || state.hasStandings || state.hasScorers) {
      console.log('\n✅ RESULTS FOUND!');
      console.log(JSON.stringify(state, null, 2));
      resultsFound = true;
      break;
    }

    // Also check if buttons changed dramatically
    if (i === 5 || i === 15 || i === 29) {
      console.log(`\n--- [${(i+1)*2}s] Snapshot ---`);
      console.log('TextLength:', state.bodyTextLength);
      console.log('Buttons:', state.buttons);
      console.log('IDs:', state.allIds);
      console.log('Visible trn- elements:', state.visibleSections);
    }
  }

  if (!resultsFound) {
    console.log('\n❌ No results found after 90s');
    // Final state dump
    const finalState = await page.evaluate(() => ({
      text: document.body.innerText.substring(0, 600),
      buttons: [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent !== null)
        .map(b => b.textContent.trim())
    }));
    console.log('Final text:', finalState.text);
    console.log('Final buttons:', finalState.buttons);
  }

  await browser.close();
  console.log('\n[done]');
})();
