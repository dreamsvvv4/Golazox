// Patch: fix generate-sitemap.js - correct the ICONIC block and remove orphaned code
const fs   = require('fs');
const path = require('path');
const f    = path.join(__dirname, 'generate-sitemap.js');
let lines  = fs.readFileSync(f, 'utf8').split('\n');

// Fix 1: Replace the incomplete ICONIC flatMap block (lines 330-357, 0-indexed: 329-356)
// Current bad block ends at line 357 (0-indexed 356):  }),
// Before the // Matchup pages comment

// Fix 2: Remove orphaned lines 395-429 (0-indexed 394-428): the stray duplicate flatMap code

// Find key lines by content
const ICONIC_START = lines.findIndex(l => l.includes('Team profile pages ES + EN'));
const ICONIC_END   = lines.findIndex((l, i) => i > ICONIC_START && l.trim() === '}),');
const MATCHUP_LINE = lines.findIndex((l, i) => i > ICONIC_END && l.includes('Matchup pages ES + EN + PT-BR'));
const CLOSE_BRACKET_1 = lines.findIndex((l, i) => i > MATCHUP_LINE && l.trim() === '];');
const ORPHAN_START = CLOSE_BRACKET_1 + 1;
const CLOSE_BRACKET_2 = lines.findIndex((l, i) => i > ORPHAN_START && l.trim() === '];');

console.log({ICONIC_START, ICONIC_END, MATCHUP_LINE, CLOSE_BRACKET_1, ORPHAN_START, CLOSE_BRACKET_2});

// Replace the bad ICONIC block with the correct one
const newIconicBlock = `  // ── Team profile pages ES + EN ─────────────────────────────────────────────
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
  }),`;

// Splice: replace lines ICONIC_START..ICONIC_END (inclusive) with new block
const newIconicLines = newIconicBlock.split('\n');
lines.splice(ICONIC_START, ICONIC_END - ICONIC_START + 1, ...newIconicLines);

// Recalculate indices after the splice (offset changed)
const offset = newIconicLines.length - (ICONIC_END - ICONIC_START + 1);
const newClose1 = CLOSE_BRACKET_1 + offset;
const newOrphanStart = newClose1 + 1;
const newClose2 = CLOSE_BRACKET_2 + offset;

console.log('After splice:', { newClose1, newOrphanStart, newClose2 });

// Remove orphaned lines (from newOrphanStart to newClose2 inclusive)
if (newClose2 > newOrphanStart && lines[newOrphanStart] !== 'const xml = \`<?xml version="1.0" encoding="UTF-8"?>') {
  lines.splice(newOrphanStart, newClose2 - newOrphanStart + 1);
  console.log('Removed', newClose2 - newOrphanStart + 1, 'orphaned lines');
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Done.');
