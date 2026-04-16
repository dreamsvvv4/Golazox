/**
 * generate-sitemap.js
 * Run: node generate-sitemap.js
 * Writes public/sitemap.xml with homepage + auto-generated matchup pages.
 *
 * Strategy: for each rival pair, cross-product their ICONIC seasons.
 * This produces hundreds of long-tail URLs matching real search queries.
 * Only verified team slugs and seasons are used (from the live catalog).
 */
const fs   = require('fs');
const path = require('path');

const SITE_URL = 'https://golazox.com';
const TODAY    = new Date().toISOString().slice(0, 10);

// ── Iconic seasons per team slug (verified against live catalog) ──────────────
// Only seasons confirmed to exist in the squads/ folder are listed.
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
  'Uruguay':                ['1966','1970'],
  'uruguay':                ['1966','1970'],
  // ── Brasileirão ──
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

// ── Rival pairs ───────────────────────────────────────────────────────────────
// Cross-product of iconic seasons is generated for each pair.
// Order matters to avoid direction duplication (deduped by seen set).
const RIVALS = [
  // ─ El Clásico ─
  ['real-madrid',            'fc-barcelona'],
  // ─ Champions 2025-26 cuartos (actualidad) ─
  ['fc-arsenal',             'real-madrid'],
  ['inter-mailand',          'fc-barcelona'],
  ['fc-paris-saint-germain', 'fc-arsenal'],
  ['manchester-city',        'fc-paris-saint-germain'],
  // ─ Derby de Madrid ─
  ['real-madrid',            'atletico-madrid'],
  ['fc-barcelona',           'atletico-madrid'],
  // ─ España ─
  ['real-madrid',            'fc-sevilla'],
  ['fc-barcelona',           'fc-sevilla'],
  // ─ Bundesliga ─
  ['fc-bayern-munchen',      'borussia-dortmund'],
  ['fc-bayern-munchen',      'borussia-monchengladbach'],
  // ─ Premier League ─
  ['fc-arsenal',             'fc-liverpool'],
  ['fc-arsenal',             'manchester-united'],
  ['fc-arsenal',             'fc-chelsea'],
  ['fc-liverpool',           'manchester-united'],
  ['fc-liverpool',           'manchester-city'],
  ['manchester-united',      'manchester-city'],
  ['fc-chelsea',             'manchester-city'],
  ['fc-chelsea',             'fc-liverpool'],
  // ─ Derby di Milano ─
  ['ac-mailand',             'inter-mailand'],
  // ─ Serie A ─
  ['ac-mailand',             'juventus-turin'],
  ['ac-mailand',             'as-rom'],
  ['ac-mailand',             'ssc-neapel'],
  ['inter-mailand',          'juventus-turin'],
  ['juventus-turin',         'as-rom'],
  ['juventus-turin',         'ssc-neapel'],
  // ─ Eredivisie ─
  ['ajax-amsterdam',         'psv-eindhoven'],
  ['ajax-amsterdam',         'feyenoord-rotterdam'],
  // ─ Liga Portugal ─
  ['benfica-lissabon',       'fc-porto'],
  // ─ Champions cross-era ─
  ['real-madrid',            'fc-liverpool'],
  ['real-madrid',            'ac-mailand'],
  ['real-madrid',            'fc-bayern-munchen'],
  ['real-madrid',            'juventus-turin'],
  ['real-madrid',            'manchester-united'],
  ['real-madrid',            'manchester-city'],
  ['real-madrid',            'fc-paris-saint-germain'],
  ['real-madrid',            'borussia-dortmund'],
  ['real-madrid',            'ajax-amsterdam'],
  ['fc-barcelona',           'ac-mailand'],
  ['fc-barcelona',           'ajax-amsterdam'],
  ['fc-barcelona',           'fc-liverpool'],
  ['fc-barcelona',           'manchester-united'],
  ['fc-barcelona',           'juventus-turin'],
  ['fc-barcelona',           'fc-chelsea'],
  ['fc-barcelona',           'fc-paris-saint-germain'],
  ['fc-barcelona',           'fc-bayern-munchen'],
  ['fc-barcelona',           'inter-mailand'],
  ['ac-mailand',             'ajax-amsterdam'],
  ['ac-mailand',             'fc-porto'],
  ['ac-mailand',             'fc-liverpool'],
  ['ac-mailand',             'fc-barcelona'],
  ['inter-mailand',          'fc-porto'],
  ['inter-mailand',          'borussia-dortmund'],
  ['ajax-amsterdam',         'juventus-turin'],
  ['ajax-amsterdam',         'ac-mailand'],
  ['borussia-dortmund',      'fc-arsenal'],
  ['borussia-dortmund',      'juventus-turin'],
  ['benfica-lissabon',       'ajax-amsterdam'],
  ['fc-paris-saint-germain', 'manchester-city'],
  ['fc-paris-saint-germain', 'fc-liverpool'],
  ['manchester-city',        'real-madrid'],
  ['manchester-city',        'inter-mailand'],
  ['fc-chelsea',             'fc-barcelona'],
  ['fc-chelsea',             'real-madrid'],
  ['fc-chelsea',             'borussia-dortmund'],
  ['manchester-united',      'juventus-turin'],
  ['manchester-united',      'fc-porto'],
  ['manchester-united',      'ac-mailand'],
  ['fc-arsenal',             'inter-mailand'],
  ['fc-arsenal',             'juventus-turin'],
  ['fc-arsenal',             'real-madrid'],
  ['fc-arsenal',             'ac-mailand'],
  ['fc-arsenal',             'fc-paris-saint-germain'],
  ['atletico-madrid',        'ac-mailand'],
  ['atletico-madrid',        'fc-liverpool'],
  ['atletico-madrid',        'fc-chelsea'],
  ['atletico-madrid',        'borussia-dortmund'],
  ['fc-liverpool',           'fc-paris-saint-germain'],
  ['fc-liverpool',           'ac-mailand'],
  ['fc-liverpool',           'inter-mailand'],
  ['fc-liverpool',           'borussia-dortmund'],
  ['ssc-neapel',             'fc-liverpool'],
  ['ssc-neapel',             'fc-barcelona'],
  ['psv-eindhoven',          'ac-mailand'],
  // ─ Internacionales: Brasil ─
  ['brasilien',              'argentinien'],
  ['brasilien',              'deutschland'],
  ['brasilien',              'italien'],
  ['brasilien',              'niederlande'],
  ['brasilien',              'frankreich'],
  ['brasilien',              'spanien'],
  ['brasilien',              'portugal'],
  ['brasilien',              'england'],
  ['brasilien',              'uruguay'],
  // ─ Internacionales: Argentina ─
  ['argentinien',            'deutschland'],
  ['argentinien',            'italien'],
  ['argentinien',            'frankreich'],
  ['argentinien',            'niederlande'],
  ['argentinien',            'spanien'],
  ['argentinien',            'england'],
  ['argentinien',            'portugal'],
  ['argentinien',            'uruguay'],
  // ─ Internacionales: Europa ─
  ['deutschland',            'italien'],
  ['deutschland',            'frankreich'],
  ['deutschland',            'spanien'],
  ['deutschland',            'niederlande'],
  ['deutschland',            'portugal'],
  ['deutschland',            'england'],
  ['deutschland',            'belgien'],
  ['spanien',                'italien'],
  ['spanien',                'frankreich'],
  ['spanien',                'niederlande'],
  ['spanien',                'portugal'],
  ['spanien',                'england'],
  ['frankreich',             'italien'],
  ['frankreich',             'portugal'],
  ['frankreich',             'niederlande'],
  ['frankreich',             'england'],
  ['frankreich',             'belgien'],
  ['italien',                'niederlande'],
  ['italien',                'portugal'],
  ['italien',                'england'],
  ['niederlande',            'portugal'],
  ['niederlande',            'england'],
  ['portugal',               'england'],
  // ─ Superclásico ARG ─
  ['river-plate',            'boca-juniors'],
  // ─ Argentina derbies ─
  ['river-plate',            'independiente'],
  ['river-plate',            'racing-club'],
  ['river-plate',            'san-lorenzo'],
  ['river-plate',            'estudiantes'],
  ['river-plate',            'newells-old-boys'],
  ['boca-juniors',           'racing-club'],
  ['boca-juniors',           'independiente'],
  ['boca-juniors',           'san-lorenzo'],
  ['boca-juniors',           'estudiantes'],
  ['independiente',          'racing-club'],
  // ─ Clássico Carioca ─
  ['flamengo',               'fluminense'],
  // ─ Brasileirão derbies ─
  ['flamengo',               'botafogo'],
  ['flamengo',               'vasco-da-gama'],
  ['flamengo',               'corinthians'],
  ['flamengo',               'se-palmeiras'],
  ['flamengo',               'clube-atletico-mineiro'],
  ['flamengo',               'sc-internacional'],
  ['fluminense',             'botafogo'],
  ['fluminense',             'vasco-da-gama'],
  ['corinthians',            'se-palmeiras'],
  ['corinthians',            'santos'],
  ['corinthians',            'fc-sao-paulo'],
  ['se-palmeiras',           'santos'],
  ['se-palmeiras',           'fc-sao-paulo'],
  ['santos',                 'fc-sao-paulo'],
  ['sc-internacional',       'gremio'],
  ['clube-atletico-mineiro', 'cruzeiro'],
  // ─ Saudi derbies ─
  ['al-hilal',               'al-nassr'],
  ['al-hilal',               'al-ittihad'],
  ['al-hilal',               'al-ahli'],
  ['al-nassr',               'al-ittihad'],
  ['al-nassr',               'al-ahli'],
  // ─ LATAM vs Europe ─
  ['flamengo',               'real-madrid'],
  ['flamengo',               'fc-liverpool'],
  ['flamengo',               'fc-barcelona'],
  ['boca-juniors',           'real-madrid'],
  ['boca-juniors',           'fc-barcelona'],
  ['river-plate',            'real-madrid'],
  ['river-plate',            'fc-barcelona'],
  ['al-hilal',               'real-madrid'],
  ['al-nassr',               'real-madrid'],
  ['al-nassr',               'fc-paris-saint-germain'],
];

// ── Generate matchup URLs ─────────────────────────────────────────────────────
const seen       = new Set();
const matchupSegs = [];

for (const [slugA, slugB] of RIVALS) {
  const seasonsA = ICONIC[slugA] || [];
  const seasonsB = ICONIC[slugB] || [];
  if (!seasonsA.length || !seasonsB.length) continue;

  for (const sA of seasonsA) {
    for (const sB of seasonsB) {
      const key    = [slugA + sA, slugB + sB].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      matchupSegs.push(`${slugA}:${sA}-vs-${slugB}:${sB}`);
    }
  }
}

// ── Top clubs for high-priority URLs ─────────────────────────────────────────
const TOP_SLUGS = new Set([
  'real-madrid','fc-barcelona','manchester-united','fc-liverpool','fc-chelsea',
  'fc-arsenal','fc-bayern-munchen','ac-mailand','juventus-turin','inter-mailand',
  'fc-paris-saint-germain','ajax-amsterdam','brasilien','deutschland','argentinien',
  'spanien','england','frankreich','niederlande','italien','manchester-city',
]);

// ── Build XML ─────────────────────────────────────────────────────────────────
const urlEntries = [
  // Homepage
  `  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/?lang=en"/>
  </url>`,
  // ── Team profile pages ES + EN ─────────────────────────────────────────────
  ...Object.entries(ICONIC).flatMap(([slug, seasons]) => {
    const isTop      = TOP_SLUGS.has(slug);
    const priority   = isTop ? '0.85' : '0.7';
    const priorityEn = isTop ? '0.8'  : '0.65';
    const changefreq = 'monthly';
    const base = [
      `  <url>
    <loc>${SITE_URL}/equipo/${slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/equipo/${slug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/team/${slug}"/>
  </url>`,
      `  <url>
    <loc>${SITE_URL}/team/${slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priorityEn}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/equipo/${slug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/team/${slug}"/>
  </url>`,
    ];
    const seasonPages = seasons.flatMap(sv => [
      `  <url>
    <loc>${SITE_URL}/equipo/${slug}:${sv}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>${isTop ? '0.75' : '0.6'}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/equipo/${slug}:${sv}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/team/${slug}:${sv}"/>
  </url>`,
      `  <url>
    <loc>${SITE_URL}/team/${slug}:${sv}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>${isTop ? '0.7' : '0.55'}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/equipo/${slug}:${sv}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/team/${slug}:${sv}"/>
  </url>`,
    ]);
    return [...base, ...seasonPages];
  }),
  // Matchup pages ES + EN + PT-BR — higher priority for top clubs
  ...matchupSegs.flatMap(seg => {
    const [partA, partB] = seg.split('-vs-');
    const slugA = (partA || '').split(':')[0];
    const slugB = (partB || '').split(':')[0];
    const isTop = TOP_SLUGS.has(slugA) && TOP_SLUGS.has(slugB);
    const priority   = isTop ? '0.9' : '0.7';
    const priorityEn = isTop ? '0.85' : '0.65';
    const priorityPt = isTop ? '0.85' : '0.65';
    const changefreq = isTop ? 'weekly' : 'monthly';
    const hreflangTags = `
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/partido/${seg}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/match/${seg}"/>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${SITE_URL}/partida/${seg}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/partido/${seg}"/>`;
    const hreflangResultTags = `
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/resultado/${seg}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/result/${seg}"/>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${SITE_URL}/jogo/${seg}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/resultado/${seg}"/>`;
    const resultPages = isTop ? [
      `  <url>
    <loc>${SITE_URL}/resultado/${seg}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${hreflangResultTags}
  </url>`,
      `  <url>
    <loc>${SITE_URL}/result/${seg}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>${hreflangResultTags}
  </url>`,
      `  <url>
    <loc>${SITE_URL}/jogo/${seg}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>${hreflangResultTags}
  </url>`,
    ] : [];
    return [
      `  <url>
    <loc>${SITE_URL}/partido/${seg}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${hreflangTags}
  </url>`,
      `  <url>
    <loc>${SITE_URL}/match/${seg}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priorityEn}</priority>${hreflangTags}
  </url>`,
      `  <url>
    <loc>${SITE_URL}/partida/${seg}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priorityPt}</priority>${hreflangTags}
  </url>`,
      ...resultPages,
    ];
  }),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join('\n')}
</urlset>
`;

const outPath = path.join(__dirname, 'public', 'sitemap.xml');
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`✅ sitemap.xml written: ${urlEntries.length} URLs (${matchupSegs.length} matchups × 3 idiomas + team pages + homepage) → ${outPath}`);
