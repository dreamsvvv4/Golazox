const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto('https://golazox.com/?tab=trn', { waitUntil: 'networkidle0', timeout: 30000 });

  await page.click('[data-preset="ucl2026"]');
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => document.querySelector('#ucl-start-btn')?.click());

  // wait for draw
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    const ok = await page.evaluate(() => !!document.querySelector('#ucl-sim-btn')?.offsetParent);
    if (ok) { console.log('Draw done at', i*0.4, 's'); break; }
  }

  await page.evaluate(() => document.querySelector('#ucl-sim-btn')?.click());
  console.log('Simulation started...');

  // wait for simulation
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const done = await page.evaluate(() => {
      const s = document.querySelector('.trn-spinner');
      return (!s || !s.offsetParent) && document.body.innerText.length > 2000;
    });
    if (done) { console.log('Sim done at', i*2, 's'); break; }
  }

  // Click "Cuadro" tab
  const found = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button')].find(b =>
      b.offsetParent && b.textContent.includes('Cuadro'));
    if (tab) tab.click();
    return !!tab;
  });
  console.log('Cuadro tab found:', found);
  await new Promise(r => setTimeout(r, 1000));

  // Inspect scrollable elements inside Cuadro
  const info = await page.evaluate(() => {
    const scrollables = [...document.querySelectorAll('*')].filter(el => {
      if (!el.offsetParent) return false;
      const s = window.getComputedStyle(el);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    }).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className.substring(0, 60),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollLeft: el.scrollLeft
    }));

    // Also check for SVG or canvas (bracket might be SVG)
    const svgs = [...document.querySelectorAll('svg')].filter(s => s.offsetParent).map(s => ({
      width: s.getAttribute('width') || s.clientWidth,
      height: s.getAttribute('height') || s.clientHeight
    }));

    // What's inside the active tab panel?
    const activePanel = document.querySelector('.trn-tab-panel.active, [aria-selected="true"], .trn-results-tab-panel');
    const panelId = activePanel ? activePanel.id || activePanel.className.substring(0, 60) : 'not found';

    return { scrollables, svgs, panelId, bodyLen: document.body.innerText.length };
  });

  console.log('\n=== CUADRO TAB ===');
  console.log('Scrollable elements (wider than viewport):');
  info.scrollables.forEach(el => {
    console.log(`  ${el.tag}#${el.id || '?'} .${el.className} scrollW:${el.scrollWidth} clientW:${el.clientWidth}`);
  });
  console.log('\nSVGs:', info.svgs);
  console.log('Active panel:', info.panelId);

  await browser.close();
})();
