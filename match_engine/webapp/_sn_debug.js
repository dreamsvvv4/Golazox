'use strict';
const fs = require('fs');
const cheerio = require('./node_modules/cheerio');

fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
  format: 'json', action: 'parse', page: 'Senegal national football team', prop: 'text'
}), { headers: { 'User-Agent': 'Test/1.0' }, signal: AbortSignal.timeout(12000) })
  .then(r => r.json())
  .then(d => {
    const html = d?.parse?.text?.['*'] || '';
    const $ = cheerio.load(html);
    // Focus on T3 - the squad table
    const tables = $('table.wikitable');
    const t3 = tables.eq(3);
    let out = 'T3 headers: ' + t3.find('tr').first().find('th').map((_, h) => $(h).text().trim()).get().join(' | ') + '\n\n';

    // Check if player names are in <th> cells in data rows
    t3.find('tr').slice(1, 4).each((ri, row) => {
      const ths = $(row).find('th');
      if (ths.length > 0) {
        out += 'Row ' + ri + ' has ' + ths.length + ' <th> cells:\n';
        ths.each((ci, th) => {
          const txt = $(th).text().replace(/\s+/g, ' ').trim().slice(0, 60);
          const links = $(th).find('a[href]').map((_, a) => $(a).attr('href').slice(0,40) + '=[' + $(a).text().trim().slice(0,20) + ']').get().join(', ');
          out += '  th[' + ci + ']: text="' + txt + '"  links=' + links + '\n';
        });
      } else {
        out += 'Row ' + ri + ': no <th> cells\n';
      }
    });

    fs.writeFileSync('C:/Users/vvvfb/match-engine/sn_debug2.txt', out);
    console.log('Done → sn_debug2.txt');
  })
  .catch(e => { fs.writeFileSync('C:/Users/vvvfb/match-engine/sn_debug2.txt', 'ERR: ' + e.message); console.log('ERR: ' + e.message); });

