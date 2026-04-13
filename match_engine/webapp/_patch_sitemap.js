// Patch: fix generate-sitemap.js urlEntries block
const fs   = require('fs');
const path = require('path');
const f    = path.join(__dirname, 'generate-sitemap.js');
let s = fs.readFileSync(f, 'utf8');

// Find the start and end markers
const START_MARKER = '// ── Build XML ─────────────────────────────────────────────────────────────────\n';
const END_MARKER   = 'const xml = ';
const si = s.indexOf(START_MARKER);
const ei = s.indexOf(END_MARKER);
if (si === -1 || ei === -1) {
  console.error('Markers not found!', { si, ei });
  process.exit(1);
}

const beforeBlock = s.slice(0, si + START_MARKER.length);
const afterBlock  = s.slice(ei);

const newBlock = `const urlEntries = [
  // Homepage
  \`  <url>
    <loc>\${SITE_URL}/</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="es" href="\${SITE_URL}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="\${SITE_URL}/?lang=en"/>
  </url>\`,
  // ── Team profile pages ES + EN ────────────────────────────────────────────
  ...Object.entries(ICONIC).flatMap(([slug, seasons]) => {
    const isTop      = TOP_SLUGS.has(slug);
    const priority   = isTop ? '0.85' : '0.7';
    const priorityEn = isTop ? '0.8'  : '0.65';
    const changefreq = 'monthly';
    const base = [
      \`  <url>
    <loc>\${SITE_URL}/equipo/\${slug}</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>\${changefreq}</changefreq>
    <priority>\${priority}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="\${SITE_URL}/equipo/\${slug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="\${SITE_URL}/team/\${slug}"/>
  </url>\`,
      \`  <url>
    <loc>\${SITE_URL}/team/\${slug}</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>\${changefreq}</changefreq>
    <priority>\${priorityEn}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="\${SITE_URL}/equipo/\${slug}"/>
    <xhtml:link rel="alternate" hreflang="en" href="\${SITE_URL}/team/\${slug}"/>
  </url>\`,
    ];
    const seasonPages = seasons.flatMap(sv => [
      \`  <url>
    <loc>\${SITE_URL}/equipo/\${slug}:\${sv}</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>\${isTop ? '0.75' : '0.6'}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="\${SITE_URL}/equipo/\${slug}:\${sv}"/>
    <xhtml:link rel="alternate" hreflang="en" href="\${SITE_URL}/team/\${slug}:\${sv}"/>
  </url>\`,
      \`  <url>
    <loc>\${SITE_URL}/team/\${slug}:\${sv}</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>\${isTop ? '0.7' : '0.55'}</priority>
    <xhtml:link rel="alternate" hreflang="es" href="\${SITE_URL}/equipo/\${slug}:\${sv}"/>
    <xhtml:link rel="alternate" hreflang="en" href="\${SITE_URL}/team/\${slug}:\${sv}"/>
  </url>\`,
    ]);
    return [...base, ...seasonPages];
  }),
  // ── Matchup pages ES + EN + PT-BR ────────────────────────────────────────
  ...matchupSegs.flatMap(seg => {
    const [partA, partB] = seg.split('-vs-');
    const slugA = (partA || '').split(':')[0];
    const slugB = (partB || '').split(':')[0];
    const isTop      = TOP_SLUGS.has(slugA) && TOP_SLUGS.has(slugB);
    const priority   = isTop ? '0.9'  : '0.7';
    const priorityEn = isTop ? '0.85' : '0.65';
    const priorityPt = isTop ? '0.85' : '0.65';
    const changefreq = isTop ? 'weekly' : 'monthly';
    const hreflangTags = \`
    <xhtml:link rel="alternate" hreflang="es" href="\${SITE_URL}/partido/\${seg}"/>
    <xhtml:link rel="alternate" hreflang="en" href="\${SITE_URL}/match/\${seg}"/>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="\${SITE_URL}/partida/\${seg}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="\${SITE_URL}/partido/\${seg}"/>\`;
    return [
      \`  <url>
    <loc>\${SITE_URL}/partido/\${seg}</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>\${changefreq}</changefreq>
    <priority>\${priority}</priority>\${hreflangTags}
  </url>\`,
      \`  <url>
    <loc>\${SITE_URL}/match/\${seg}</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>\${changefreq}</changefreq>
    <priority>\${priorityEn}</priority>\${hreflangTags}
  </url>\`,
      \`  <url>
    <loc>\${SITE_URL}/partida/\${seg}</loc>
    <lastmod>\${TODAY}</lastmod>
    <changefreq>\${changefreq}</changefreq>
    <priority>\${priorityPt}</priority>\${hreflangTags}
  </url>\`,
    ];
  }),
];

`;

fs.writeFileSync(f, beforeBlock + newBlock + afterBlock, 'utf8');
console.log('Done. Rewrote urlEntries block.');
