'use strict';
// Probe Transfermarkt national team verein IDs across multiple ranges
const fs = require('fs');

const ranges = [
  // Between Germany(3262) and Spain(3375) — could have England, Russia, etc.
  [3263, 3374],
  // Between Switzerland(3384) and Cameroon(3434) — likely Russia, Ukraine, Wales, etc.
  [3385, 3433],
  // Between Ghana(3441) and Belarus(3450) — possible Americas
  [3444, 3450],
  // 3458-3499 — Americas + possible others
  [3458, 3498],
  // 3512-3555 — between Canada(3510) and Croatia(3556)
  [3512, 3555],
  // Beyond Chile(3700)
  [3701, 3760],
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
};

async function probe(id) {
  const url = `https://www.transfermarkt.es/test/kader/verein/${id}/saison_id/2005`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    // Extract <title> tag
    const m = html.match(/<title>\s*([^<|]+)/i);
    const ti = m ? m[1].trim().replace(/\s+/g, ' ') : '?';
    if (ti.length < 3) return null;
    // Skip "Sin resultados" / generic pages
    if (ti.includes('Transfermarkt') && !ti.includes('/')) return null;
    // Skip club pages (real club IDs return club names with something after |)
    if (res.url.includes('/verein/')) {
      // Final URL might redirect to correct slug
      const slugM = res.url.match(/transfermarkt\.es\/([^/]+)\/kader\/verein\/\d+/);
      const slug = slugM ? slugM[1] : null;
      return { id, title: ti, slug, url: res.url };
    }
    return null;
  } catch (_) { return null; }
}

async function run() {
  const results = [];
  // Build all IDs to test
  const ids = [];
  for (const [start, end] of ranges) {
    for (let i = start; i <= end; i++) ids.push(i);
  }
  // Also test specific IDs from registry that seem suspicious
  const suspicious = [3166, 3300, 3391, 3392, 3393, 3395, 3396, 3397, 3398, 3399,
                      3400, 3401, 3403, 3404, 3409, 3411, 3419, 3432, 3451, 3453,
                      3455, 3456, 3457, 3458, 3462, 3464, 3465, 3473, 3476, 3478,
                      3483, 3484, 3485, 3487, 3488, 3489, 3490, 3491];
  const allIds = [...new Set([...ids, ...suspicious])].sort((a,b)=>a-b);
  console.log(`Probing ${allIds.length} IDs...`);
  
  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    const r = await probe(id);
    if (r) {
      console.log(`  ${id} -> ${r.title.slice(0, 60)} (slug: ${r.slug})`);
      results.push(r);
    }
    if (i % 20 === 19) {
      process.stdout.write(`  [${i+1}/${allIds.length}]\n`);
      await new Promise(r => setTimeout(r, 400));
    }
    await new Promise(r => setTimeout(r, 180));
  }
  fs.writeFileSync('_probe7_out.json', JSON.stringify(results, null, 2));
  console.log(`\nDone. ${results.length} national teams found.`);
}

run().catch(e => { console.error(e); process.exit(1); });
