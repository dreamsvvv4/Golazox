'use strict';
const cheerio = require('cheerio');

async function test() {
  const WP_API = 'https://en.wikipedia.org/w/api.php';
  const params = new URLSearchParams({format:'json', action:'parse', page:'Senegal national football team', prop:'text'});
  const res = await fetch(WP_API+'?'+params, {headers:{'User-Agent':'test/1.0'}, signal:AbortSignal.timeout(12000)});
  const d = await res.json();
  const html = d.parse.text['*'];
  const $ = cheerio.load(html);

  // Focus on Table 3 to understand cell structure
  let tableCount = 0;
  $('table.wikitable').each((ti, t) => {
    const hdrs = [];
    $(t).find('tr').first().find('th').each((_, th) => hdrs.push($(th).text().toLowerCase().trim().slice(0,30)));
    const nameIdx = hdrs.findIndex(h => h.includes('name') || h === 'player');
    if (nameIdx === -1) return;
    if (tableCount >= 2) return;
    tableCount++;
    console.log(`\n=== Table ${ti} headers: ${JSON.stringify(hdrs)} ===`);
    let rowCount = 0;
    $(t).find('tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2 || nameIdx >= cells.length || rowCount >= 2) return;
      const cell = cells[nameIdx];
      // Show inner HTML (truncated)
      const innerHtml = $(cell).html().replace(/\n/g,'').slice(0, 200);
      const sortVal = $(cell).attr('data-sort-value') || '';
      console.log(`  row ${rowCount}: html="${innerHtml}"`);
      console.log(`            sort="${sortVal}"`);
      rowCount++;
    });
  });
}

test().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });


