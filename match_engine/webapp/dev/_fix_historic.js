/**
 * _fix_historic.js
 * 1. Extrae todos los slugs usados en HISTORIC_MATCHES
 * 2. Compara con el catálogo activo (GET /catalog)
 * 3. Para slugs faltantes: intenta seed_squads (scrape Transfermarkt)
 * 4. Si sigue sin aparecer → elimina las entradas del array en app.js
 */
const fs   = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const APP_JS = path.join(__dirname, 'public', 'app.js');

// ── 1. Extraer slugs de HISTORIC_MATCHES ────────────────────
const src   = fs.readFileSync(APP_JS, 'utf8');
const start = src.indexOf('const HISTORIC_MATCHES = [');
const end   = src.indexOf('];', start);
const block = src.slice(start, end);

const re    = /slug:\s*'([^']+)'/g;
const seen  = new Set();
let m;
while ((m = re.exec(block)) !== null) seen.add(m[1]);
const allSlugs = [...seen];
console.log(`HISTORIC_MATCHES usa ${allSlugs.length} slugs únicos`);

// ── 2. Obtener catálogo activo ───────────────────────────────
function getCatalog() {
  return new Promise((res, rej) => {
    http.get('http://localhost:3000/catalog', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const parsed = JSON.parse(d);
          const arr = Array.isArray(parsed) ? parsed : [];
          res(new Set(arr.map(t => t.slug)));
        } catch(e) { rej(e); }
      });
    }).on('error', rej);
  });
}

// ── 3. Intentar descargar un equipo faltante ─────────────────
function tryDownload(slug) {
  const squadFile = path.join(__dirname, 'squads', slug + '.json');
  if (fs.existsSync(squadFile)) {
    console.log(`  ✓ Archivo existe pero no está en catálogo: ${slug}`);
    return true; // archivo existe, catálogo desactualizado
  }
  console.log(`  ⬇ Intentando descargar: ${slug}`);
  try {
    execSync(`node seed_squads.js ${slug}`, { timeout: 30000, stdio: 'inherit', cwd: __dirname });
    if (fs.existsSync(squadFile)) {
      console.log(`  ✅ Descargado: ${slug}`);
      return true;
    }
  } catch(e) {
    // silently fail
  }
  console.log(`  ❌ No se pudo descargar: ${slug}`);
  return false;
}

// ── 4. Eliminar entradas de HISTORIC_MATCHES con slug faltante ─
function removeEntriesWithSlug(slug, appSrc) {
  // Match each full object entry { ... } in the array that references this slug
  // Strategy: split by entries (each starts with { label:) and filter
  const lines = appSrc.split('\n');
  const out = [];
  let skipMode = false;
  let braceDepth = 0;
  let removed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!skipMode) {
      // Detect start of an entry that contains our slug
      const lookahead = lines.slice(i, i + 10).join('\n');
      if (lookahead.includes(`slug: '${slug}'`) && line.trimStart().startsWith('{')) {
        skipMode = true;
        braceDepth = 0;
      }
    }
    if (skipMode) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0) {
        skipMode = false;
        removed++;
        console.log(`  🗑  Quitando entrada con ${slug} (línea ~${i + 1})`);
      }
      continue; // skip this line
    }
    out.push(line);
  }
  console.log(`  → ${removed} entradas eliminadas para ${slug}`);
  return out.join('\n');
}

// ── Main ─────────────────────────────────────────────────────
(async () => {
  let catalogSlugs;
  try {
    catalogSlugs = await getCatalog();
    console.log(`Catálogo activo: ${catalogSlugs.size} equipos\n`);
  } catch(e) {
    console.error('No se puede conectar al servidor. ¿Está corriendo en :3000?');
    process.exit(1);
  }

  const missing = allSlugs.filter(s => !catalogSlugs.has(s));
  if (!missing.length) {
    console.log('✅ Todos los slugs están en el catálogo. Nada que hacer.');
    return;
  }

  console.log(`\n⚠  ${missing.length} slugs no están en el catálogo:\n  ${missing.join('\n  ')}\n`);

  const stillMissing = [];
  for (const slug of missing) {
    const ok = tryDownload(slug);
    if (!ok) stillMissing.push(slug);
  }

  if (!stillMissing.length) {
    console.log('\n✅ Todos los slugs faltantes se han descargado. Reinicia el servidor.');
    return;
  }

  console.log(`\n🗑  Eliminando entradas para: ${stillMissing.join(', ')}`);
  let updated = src;
  for (const slug of stillMissing) {
    updated = removeEntriesWithSlug(slug, updated);
  }

  fs.writeFileSync(APP_JS, updated, 'utf8');
  console.log('\n✅ app.js actualizado. Verifica con node --check public/app.js');
})();
