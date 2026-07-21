/**
 * generate-sitemap.js
 * Run: node generate-sitemap.js
 *
 * Strategy (SEO-lean, post Gemini audit):
 *  - sitemap-index.xml      → master index pointing to sub-sitemaps
 *  - sitemap-main.xml       → homepage + team pages  (<300 URLs)
 *  - sitemap-matches-es.xml → top ES matchup pages   (<700 URLs)
 *  - sitemap-matches-en.xml → top EN matchup pages   (<700 URLs)
 *  - sitemap-matches-pt.xml → top PT matchup pages   (<700 URLs)
 *  - sitemap.xml            → flat copy (Search Console backwards compat)
 *
 * /resultado/, /result/, /jogo/ are NOT submitted to Google.
 * They stay accessible and will be found via internal links once we have authority.
 *
 * Changefreq: yearly for historical, monthly for current-season content.
 * Only ~80 legendary rival pairs submitted at launch.
 */
const fs   = require('fs');
const path = require('path');

const SITE_URL = 'https://golazox.com';
const TODAY    = new Date().toISOString().slice(0, 10);
const OUT_DIR  = path.join(__dirname, 'public');

// ── Iconic seasons per team slug (verified against live catalog) ──────────────
const ICONIC = {
  // ── La Liga ──
  'real-madrid':            ['1960','1966','1986','1998','2002','2006','2012','2014','2016','2017','2026'],
  'fc-barcelona':           ['1992','1995','2006','2009','2010','2011','2014','2015','2026'],
  'atletico-madrid':        ['1974','1995','1996','2013','2016','2021'],
  'fc-sevilla':             ['2006','2015','2016','2020','2023'],
  // ── Bundesliga ──
  'fc-bayern-munchen':      ['1974','1976','2001','2013','2020'],
  'borussia-dortmund':      ['1997','2012','2019','2024'],
  'borussia-monchengladbach': ['1975','1977'],
  // ── Premier League ──
  'fc-arsenal':             ['2002','2004','2023','2024','2026'],
  'fc-liverpool':           ['1977','1984','2005','2019','2026'],
  'fc-chelsea':             ['2005','2012','2021'],
  'manchester-united':      ['1994','1999','2002','2008'],
  'manchester-city':        ['2012','2019','2023','2026'],
  // ── Serie A ──
  'ac-mailand':             ['1969','1989','1994','2003','2007'],
  'inter-mailand':          ['1965','1989','2010','2021'],
  'juventus-turin':         ['1985','1996','2002','2015','2017','2019'],
  'as-rom':                 ['2001','2006'],
  'ssc-neapel':             ['1987','1988','2023'],
  // ── Eredivisie ──
  'ajax-amsterdam':         ['1971','1973','1995','2019'],
  'psv-eindhoven':          ['1988','2006'],
  'feyenoord-rotterdam':    ['1970','1995','2023'],
  // ── Liga Portugal ──
  'benfica-lissabon':       ['1962','1987','2015','2023'],
  'fc-porto':               ['1987','2004'],
  // ── Ligue 1 ──
  'fc-paris-saint-germain': ['2015','2016','2020','2022'],
  'olympique-lyon':         ['2005','2006','2008'],
  // ── Selecciones ──
  'brasilien':              ['1970','1982','1994','2002'],
  'argentinien':            ['1978','1986','1994','2022'],
  'deutschland':            ['1974','1982','1986','1990','2002','2014'],
  'spanien':                ['1988','2008','2010','2012'],
  'frankreich':             ['1984','1998','2000','2018'],
  'italien':                ['1982','1990','1994','2006'],
  'niederlande':            ['1974','1978','1988','2010'],
  'portugal':               ['2004','2016','2022'],
  'england':                ['1966','1996','2021'],
  'belgien':                ['1984','2018'],
  'uruguay':                ['1966','1970'],
  // ── Brasileirao ──
  'flamengo':               ['2018','2022','2025'],
  'fluminense':             ['2023','2025'],
  'botafogo':               ['2025'],
  'corinthians':            ['2025'],
  'se-palmeiras':           ['2021','2025'],
  'santos':                 ['1962','1963','2025'],
  'fc-sao-paulo':           ['1992','1993','2005','2025'],
  'clube-atletico-mineiro': ['2021','2025'],
  'cruzeiro':               ['1997','2025'],
  'sc-internacional':       ['2006','2010','2025'],
  'gremio':                 ['1983','1995','2025'],
  'vasco-da-gama':          ['1998','2025'],
  'red-bull-bragantino':    ['2025'],
  'bahia':                  ['2025'],
  'athletico-paranaense':   ['2025'],
  // ── Argentina ──
  'river-plate':            ['2025'],
  'boca-juniors':           ['2025'],
  'racing-club':            ['2001','2025'],
  'independiente':          ['1975','2025'],
  'san-lorenzo':            ['2025'],
  'talleres-cordoba':       ['2025'],
  'estudiantes':            ['2025'],
  'newells-old-boys':       ['2025'],
  'rosario-central':        ['2025'],
  'huracan':                ['2025'],
  // ── Saudi Pro League ──
  'al-hilal':               ['2025'],
  'al-nassr':               ['2025'],
  'al-ittihad':             ['2025'],
  'al-ahli':                ['2025'],
  'al-ettifaq':             ['2023','2025'],
};

// ── Top clubs (priority tier) ─────────────────────────────────────────────────
const TOP_SLUGS = new Set([
  'real-madrid','fc-barcelona','manchester-united','fc-liverpool','fc-chelsea',
  'fc-arsenal','fc-bayern-munchen','ac-mailand','juventus-turin','inter-mailand',
  'fc-paris-saint-germain','ajax-amsterdam','brasilien','deutschland','argentinien',
  'spanien','england','frankreich','niederlande','italien','manchester-city',
]);

// ── Top legendary rival pairs — ONLY these are submitted at launch ────────────
const TOP_RIVALS = [
  // ── El Clasico ──
  ['real-madrid',            'fc-barcelona'],
  // ── Champions 2025-26 (hot) ──
  ['fc-arsenal',             'real-madrid'],
  ['inter-mailand',          'fc-barcelona'],
  ['fc-paris-saint-germain', 'fc-arsenal'],
  ['manchester-city',        'fc-paris-saint-germain'],
  // ── Derby de Madrid ──
  ['real-madrid',            'atletico-madrid'],
  ['fc-barcelona',           'atletico-madrid'],
  // ── Bundesliga ──
  ['fc-bayern-munchen',      'borussia-dortmund'],
  // ── Premier derbies ──
  ['fc-arsenal',             'fc-liverpool'],
  ['fc-arsenal',             'manchester-united'],
  ['fc-liverpool',           'manchester-united'],
  ['fc-liverpool',           'manchester-city'],
  ['manchester-united',      'manchester-city'],
  ['fc-chelsea',             'fc-liverpool'],
  ['fc-chelsea',             'fc-arsenal'],
  // ── Derby di Milano ──
  ['ac-mailand',             'inter-mailand'],
  // ── Serie A clasicos ──
  ['ac-mailand',             'juventus-turin'],
  ['inter-mailand',          'juventus-turin'],
  ['juventus-turin',         'ssc-neapel'],
  // ── Eredivisie ──
  ['ajax-amsterdam',         'psv-eindhoven'],
  // ── Liga Portugal ──
  ['benfica-lissabon',       'fc-porto'],
  // ── Champions cross-era: Real Madrid ──
  ['real-madrid',            'fc-liverpool'],
  ['real-madrid',            'ac-mailand'],
  ['real-madrid',            'fc-bayern-munchen'],
  ['real-madrid',            'juventus-turin'],
  ['real-madrid',            'manchester-united'],
  ['real-madrid',            'manchester-city'],
  ['real-madrid',            'ajax-amsterdam'],
  ['real-madrid',            'borussia-dortmund'],
  // ── Champions cross-era: Barcelona ──
  ['fc-barcelona',           'ac-mailand'],
  ['fc-barcelona',           'ajax-amsterdam'],
  ['fc-barcelona',           'fc-liverpool'],
  ['fc-barcelona',           'manchester-united'],
  ['fc-barcelona',           'juventus-turin'],
  ['fc-barcelona',           'fc-bayern-munchen'],
  ['fc-barcelona',           'inter-mailand'],
  // ── Champions cross-era: otros ──
  ['ac-mailand',             'ajax-amsterdam'],
  ['ac-mailand',             'fc-liverpool'],
  ['inter-mailand',          'fc-porto'],
  ['fc-chelsea',             'real-madrid'],
  ['fc-chelsea',             'fc-barcelona'],
  ['manchester-united',      'juventus-turin'],
  ['manchester-city',        'real-madrid'],
  ['manchester-city',        'inter-mailand'],
  ['fc-arsenal',             'juventus-turin'],
  ['fc-arsenal',             'ac-mailand'],
  ['atletico-madrid',        'fc-liverpool'],
  ['atletico-madrid',        'ac-mailand'],
  ['fc-liverpool',           'ac-mailand'],
  ['fc-liverpool',           'fc-paris-saint-germain'],
  ['ssc-neapel',             'fc-liverpool'],
  ['ssc-neapel',             'fc-barcelona'],
  // ── Selecciones mundiales ──
  ['brasilien',              'argentinien'],
  ['brasilien',              'deutschland'],
  ['brasilien',              'niederlande'],
  ['brasilien',              'frankreich'],
  ['brasilien',              'spanien'],
  ['brasilien',              'portugal'],
  ['brasilien',              'england'],
  ['brasilien',              'uruguay'],
  ['argentinien',            'deutschland'],
  ['argentinien',            'frankreich'],
  ['argentinien',            'niederlande'],
  ['argentinien',            'spanien'],
  ['argentinien',            'england'],
  ['argentinien',            'italien'],
  ['deutschland',            'italien'],
  ['deutschland',            'frankreich'],
  ['deutschland',            'spanien'],
  ['deutschland',            'niederlande'],
  ['spanien',                'frankreich'],
  ['spanien',                'italien'],
  ['spanien',                'portugal'],
  ['frankreich',             'england'],
  ['frankreich',             'portugal'],
  ['niederlande',            'portugal'],
  ['portugal',               'england'],
  // ── Superclasico ARG ──
  ['river-plate',            'boca-juniors'],
  // ── Brasil derbies ──
  ['flamengo',               'fluminense'],
  ['flamengo',               'corinthians'],
  ['flamengo',               'real-madrid'],
  ['flamengo',               'fc-barcelona'],
  ['flamengo',               'fc-liverpool'],
  ['corinthians',            'se-palmeiras'],
  ['se-palmeiras',           'santos'],
  ['sc-internacional',       'gremio'],
  ['clube-atletico-mineiro', 'cruzeiro'],
  // ── Saudi ──
  ['al-hilal',               'al-nassr'],
];

// ── Cap seasons at 3 per team for cross-product ───────────────────────────────
const ICONIC_TOP3 = {};
for (const [slug, seasons] of Object.entries(ICONIC)) {
  ICONIC_TOP3[slug] = seasons.length <= 3
    ? seasons
    : [seasons[0], seasons[Math.floor(seasons.length / 2)], seasons[seasons.length - 1]];
}

// ── Generate matchup segments ─────────────────────────────────────────────────
const seen        = new Set();
const matchupSegs = [];

for (const [slugA, slugB] of TOP_RIVALS) {
  const seasonsA = ICONIC_TOP3[slugA] || [];
  const seasonsB = ICONIC_TOP3[slugB] || [];
  if (!seasonsA.length || !seasonsB.length) continue;

  for (const sA of seasonsA) {
    for (const sB of seasonsB) {
      const key = [slugA + sA, slugB + sB].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      matchupSegs.push(`${slugA}:${sA}-vs-${slugB}:${sB}`);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CURRENT_YEAR    = new Date().getFullYear();
const isCurrentSeason = sv => parseInt(sv, 10) >= CURRENT_YEAR - 1;

function urlBlock(loc, lastmod, changefreq, priority, hreflang = []) {
  const tags = hreflang.map(([lang, href]) =>
    `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`
  ).join('\n');
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${tags}
  </url>`;
}

function writeXml(filename, entries) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(OUT_DIR, filename), xml, 'utf8');
  console.log(`  ✅ ${filename}: ${entries.length} URLs`);
}

// ── sitemap-main.xml: homepage + team pages ───────────────────────────────────
const mainEntries = [];

mainEntries.push(urlBlock(
  `${SITE_URL}/`, TODAY, 'weekly', '1.0',
  [['es', `${SITE_URL}/`], ['en', `${SITE_URL}/?lang=en`], ['x-default', `${SITE_URL}/`]]
));

// Secciones editoriales (server-rendered, alto valor SEO)
mainEntries.push(urlBlock(
  `${SITE_URL}/fichajes`, TODAY, 'hourly', '0.8',
  [['es', `${SITE_URL}/fichajes`], ['x-default', `${SITE_URL}/fichajes`]]
));
mainEntries.push(urlBlock(
  `${SITE_URL}/noticias`, TODAY, 'hourly', '0.8',
  [['es', `${SITE_URL}/noticias`], ['x-default', `${SITE_URL}/noticias`]]
));
mainEntries.push(urlBlock(
  `${SITE_URL}/clasificaciones`, TODAY, 'daily', '0.8',
  [['es', `${SITE_URL}/clasificaciones`], ['x-default', `${SITE_URL}/clasificaciones`]]
));

for (const [slug] of Object.entries(ICONIC)) {
  const isTop = TOP_SLUGS.has(slug);
  mainEntries.push(urlBlock(
    `${SITE_URL}/equipo/${slug}`, TODAY, 'monthly', isTop ? '0.85' : '0.7',
    [['es', `${SITE_URL}/equipo/${slug}`], ['en', `${SITE_URL}/team/${slug}`], ['x-default', `${SITE_URL}/equipo/${slug}`]]
  ));
  mainEntries.push(urlBlock(
    `${SITE_URL}/team/${slug}`, TODAY, 'monthly', isTop ? '0.8' : '0.65',
    [['es', `${SITE_URL}/equipo/${slug}`], ['en', `${SITE_URL}/team/${slug}`], ['x-default', `${SITE_URL}/equipo/${slug}`]]
  ));
}

writeXml('sitemap-main.xml', mainEntries);

// ── sitemap-matches-*.xml: matchup pages per language ────────────────────────
const matchesEs = [];
const matchesEn = [];
const matchesPt = [];

for (const seg of matchupSegs) {
  const slugA  = seg.split(':')[0];
  const eraA   = (seg.split(':')[1] || '').split('-vs-')[0];
  const slugB  = (seg.split('-vs-')[1] || '').split(':')[0];
  const isTop  = TOP_SLUGS.has(slugA) && TOP_SLUGS.has(slugB);
  const cf     = isCurrentSeason(eraA) ? 'monthly' : 'yearly';
  const hreflang = [
    ['es',        `${SITE_URL}/partido/${seg}`],
    ['en',        `${SITE_URL}/match/${seg}`],
    ['pt-BR',     `${SITE_URL}/partida/${seg}`],
    ['x-default', `${SITE_URL}/partido/${seg}`],
  ];
  matchesEs.push(urlBlock(`${SITE_URL}/partido/${seg}`, TODAY, cf, isTop ? '0.9'  : '0.7',  hreflang));
  matchesEn.push(urlBlock(`${SITE_URL}/match/${seg}`,   TODAY, cf, isTop ? '0.85' : '0.65', hreflang));
  matchesPt.push(urlBlock(`${SITE_URL}/partida/${seg}`, TODAY, cf, isTop ? '0.85' : '0.65', hreflang));
}

writeXml('sitemap-matches-es.xml', matchesEs);
writeXml('sitemap-matches-en.xml', matchesEn);
writeXml('sitemap-matches-pt.xml', matchesPt);

// ── sitemap.xml (flat, backwards compat for Search Console) ──────────────────
writeXml('sitemap.xml', [...mainEntries, ...matchesEs, ...matchesEn, ...matchesPt]);

// ── sitemap-index.xml ─────────────────────────────────────────────────────────
const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-main.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-matches-es.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-matches-en.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-matches-pt.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
</sitemapindex>
`;
fs.writeFileSync(path.join(OUT_DIR, 'sitemap-index.xml'), sitemapIndex, 'utf8');
console.log(`  ✅ sitemap-index.xml`);

console.log(`\n📊 Resumen:`);
console.log(`   Main:         ${mainEntries.length} URLs`);
console.log(`   Matches ES:   ${matchesEs.length} URLs`);
console.log(`   Matches EN:   ${matchesEn.length} URLs`);
console.log(`   Matches PT:   ${matchesPt.length} URLs`);
console.log(`   TOTAL flat:   ${mainEntries.length + matchesEs.length + matchesEn.length + matchesPt.length} URLs`);
console.log(`   Duelos:       ${matchupSegs.length} × 3 idiomas`);
