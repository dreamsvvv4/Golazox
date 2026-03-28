// Fetch TM confederation pages to extract national team IDs
const cheerio = require('cheerio');
const CONFS = [
  { name: 'CONMEBOL', url: 'https://www.transfermarkt.es/conmebol/startseite/verband/21' },
  { name: 'CONCACAF', url: 'https://www.transfermarkt.es/concacaf/startseite/verband/24' },
  { name: 'CAF',      url: 'https://www.transfermarkt.es/caf/startseite/verband/25' },
  { name: 'AFC',      url: 'https://www.transfermarkt.es/afc/startseite/verband/23' },
];

(async () => {
  for (const { name, url } of CONFS) {
    console.log('\n=== ' + name + ' ===' );
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
        signal: AbortSignal.timeout(10000)
      });
      const html = await r.text();
      console.log('  HTML size:', html.length);
      const $ = cheerio.load(html);
      // Look for links to member national teams
      $('a[href*="/verein/"], a[href*="/verband/"]').each((i, a) => {
        if (i > 20) return false;
        const href = $(a).attr('href') || '';
        const m = href.match(/\/([^/]+)\/startseite\/(verein|verband)\/(\d+)/);
        if (m) {
          console.log('  ' + m[2] + '/' + m[3].padEnd(8) + ' slug:' + m[1].padEnd(28) + $(a).text().trim().slice(0,20));
        }
      });
    } catch(e) { console.log('  ERROR:', e.message); }
    await new Promise(r => setTimeout(r, 2000));
  }
})();
