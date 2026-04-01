/**
 * generate-sitemap.js
 * Run: node generate-sitemap.js
 * Writes public/sitemap.xml with the homepage + top matchup pages.
 */
const fs   = require('fs');
const path = require('path');

const SITE_URL = 'https://golazox.com';
const TODAY    = new Date().toISOString().slice(0, 10);

// ── Top matchups to index ─────────────────────────────────────────────────────
// Format: { a: 'slug:era', b: 'slug:era' }  (era optional)
// These are the high-intent long-tail queries we want to rank for.
const MATCHUPS = [
  // 🇪🇸 El Clásico
  { a: 'real-madrid:2002',     b: 'fc-barcelona:2009'    },
  { a: 'real-madrid:1960',     b: 'fc-barcelona:1961'    },
  { a: 'real-madrid:2012',     b: 'fc-barcelona:2011'    },
  { a: 'real-madrid:1986',     b: 'fc-barcelona:1995'    },
  // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League
  { a: 'manchester-united:1999', b: 'arsenal:2004'       },
  { a: 'liverpool:1988',       b: 'manchester-united:1999'},
  { a: 'chelsea:2005',         b: 'arsenal:2004'         },
  { a: 'manchester-city:2023', b: 'liverpool:2020'       },
  // 🇩🇪 Bundesliga
  { a: 'fc-bayern-munchen:2013', b: 'borussia-dortmund:2012' },
  { a: 'fc-bayern-munchen:2020', b: 'borussia-dortmund:2011' },
  // 🇮🇹 Calcio
  { a: 'juventus-turin:1996',  b: 'ac-mailand:1994'      },
  { a: 'fc-internazionale:2010', b: 'ac-mailand:2003'    },
  { a: 'juventus-turin:2015',  b: 'as-rom:2001'          },
  // 🌍 Selecciones icónicas
  { a: 'brasilien:1970',       b: 'deutschland:1974'     },
  { a: 'brasil:1970',          b: 'argentinien:1986'     },
  { a: 'deutschland:2014',     b: 'spanien:2010'         },
  { a: 'spanien:2010',         b: 'argentinien:1986'     },
  { a: 'frankreich:1998',      b: 'brasilien:1970'       },
  { a: 'england:1966',         b: 'deutschland:1974'     },
  { a: 'deutschland:2014',     b: 'brasilien:1970'       },
  { a: 'nederland:1974',       b: 'brasilien:1970'       },
  { a: 'italien:1982',         b: 'brasilien:1970'       },
  // 🏆 Champions míticos
  { a: 'ac-mailand:1994',      b: 'fc-barcelona:2009'    },
  { a: 'real-madrid:1960',     b: 'ac-mailand:1994'      },
  { a: 'ajax-amsterdam:1995',  b: 'fc-barcelona:2009'    },
  { a: 'fc-barcelona:2009',    b: 'fc-internazionale:2010'},
  // Sin era (all-time matchups)
  { a: 'real-madrid',          b: 'fc-barcelona'         },
  { a: 'brasilien',            b: 'argentinien'          },
  { a: 'manchester-united',    b: 'liverpool'            },
  { a: 'juventus-turin',       b: 'ac-mailand'           },
];

function toUrlSegment(team) {
  // slug:era → "slug:era" (colon kept, only the dash-vs-dash separator changes)
  return team;
}

const urls = [
  // Homepage
  `  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/?lang=en"/>
  </url>`,
  // Matchup pages
  ...MATCHUPS.map(({ a, b }) => {
    const seg = `${toUrlSegment(a)}-vs-${toUrlSegment(b)}`;
    const loc = `${SITE_URL}/partido/${seg}`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;

const outPath = path.join(__dirname, 'public', 'sitemap.xml');
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`✅ sitemap.xml written with ${urls.length} URLs → ${outPath}`);
