#!/usr/bin/env node
/**
 * _build_assets.js — Minify public/app.js and public/style.css with esbuild.
 * Output: public/app.min.js and public/style.min.css
 * Usage: node _build_assets.js
 */

'use strict';

const esbuild = require('esbuild');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const pub = path.join(__dirname, 'public');

/**
 * Cache-busting: reescribe el `?v=` de cada asset local referenciado en
 * index.html con un hash corto de su contenido. El `?v=` solo cambia cuando
 * el fichero cambia de verdad, así que:
 *   - un deploy sin cambios en un asset → mismo `?v=` → sigue cacheado (rápido)
 *   - un asset modificado → nuevo `?v=` → el navegador lo re-descarga (fresco)
 * Evita depender de acordarse de subir el número a mano.
 */
function bumpAssetVersions() {
  const htmlPath = path.join(pub, 'index.html');
  if (!fs.existsSync(htmlPath)) return;
  let html = fs.readFileSync(htmlPath, 'utf8');

  const hashCache = new Map();
  const bumped = [];

  // Matchea rutas locales con ?v=... precedidas por comilla, espacio o coma
  // (src=, href=, srcset). Excluye URLs absolutas (precedidas por '/').
  const RE = /(["'\s,])(\/?[\w][\w./-]*\.(?:js|css|png|webp|jpg|jpeg|svg|ico|woff2?))\?v=[\w]+/g;

  html = html.replace(RE, (match, lead, assetPath) => {
    // Resolver a fichero bajo public/
    const rel = assetPath.replace(/^\//, '');
    const file = path.join(pub, rel);
    if (!fs.existsSync(file)) return match; // no tocar si no existe localmente

    let hash = hashCache.get(file);
    if (!hash) {
      hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
      hashCache.set(file, hash);
    }
    if (!bumped.includes(assetPath)) bumped.push(assetPath);
    return `${lead}${assetPath}?v=${hash}`;
  });

  fs.writeFileSync(htmlPath, html);
  console.log(`[build] index.html cache-bust → ${bumped.length} assets versionados (hash de contenido)`);
}

async function build() {
  const t = Date.now();

  // JS
  const jsResult = await esbuild.build({
    entryPoints: [path.join(pub, 'app.js')],
    outfile:     path.join(pub, 'app.min.js'),
    bundle:      false,
    minify:      true,
    target:      ['es2017'],
    logLevel:    'silent',
  });

  // Tournament JS
  await esbuild.build({
    entryPoints: [path.join(pub, 'tournament.js')],
    outfile:     path.join(pub, 'tournament.min.js'),
    bundle:      false,
    minify:      true,
    target:      ['es2017'],
    logLevel:    'silent',
  });

  // GX user logic
  await esbuild.build({
    entryPoints: [path.join(pub, 'gx-user.js')],
    outfile:     path.join(pub, 'gx-user.min.js'),
    bundle:      false,
    minify:      true,
    target:      ['es2017'],
    logLevel:    'silent',
  });

  // GX UI
  await esbuild.build({
    entryPoints: [path.join(pub, 'gx-ui.js')],
    outfile:     path.join(pub, 'gx-ui.min.js'),
    bundle:      false,
    minify:      true,
    target:      ['es2017'],
    logLevel:    'silent',
  });

  // CSS
  const cssResult = await esbuild.build({
    entryPoints: [path.join(pub, 'style.css')],
    outfile:     path.join(pub, 'style.min.css'),
    bundle:      false,
    minify:      true,
    logLevel:    'silent',
  });

  const jsOrig  = fs.statSync(path.join(pub, 'app.js')).size;
  const jsMin   = fs.statSync(path.join(pub, 'app.min.js')).size;
  const trnOrig = fs.statSync(path.join(pub, 'tournament.js')).size;
  const trnMin  = fs.statSync(path.join(pub, 'tournament.min.js')).size;
  const gxuOrig = fs.statSync(path.join(pub, 'gx-user.js')).size;
  const gxuMin  = fs.statSync(path.join(pub, 'gx-user.min.js')).size;
  const gxiOrig = fs.statSync(path.join(pub, 'gx-ui.js')).size;
  const gxiMin  = fs.statSync(path.join(pub, 'gx-ui.min.js')).size;
  const cssOrig = fs.statSync(path.join(pub, 'style.css')).size;
  const cssMin  = fs.statSync(path.join(pub, 'style.min.css')).size;

  const kb = n => (n / 1024).toFixed(1) + ' KB';
  const pct = (orig, min) => (((orig - min) / orig) * 100).toFixed(0) + '%';

  console.log(`[build] app.js        ${kb(jsOrig)} → ${kb(jsMin)}  (-${pct(jsOrig, jsMin)})`);
  console.log(`[build] tournament.js ${kb(trnOrig)} → ${kb(trnMin)}  (-${pct(trnOrig, trnMin)})`);
  console.log(`[build] gx-user.js    ${kb(gxuOrig)} → ${kb(gxuMin)}  (-${pct(gxuOrig, gxuMin)})`);
  console.log(`[build] gx-ui.js      ${kb(gxiOrig)} → ${kb(gxiMin)}  (-${pct(gxiOrig, gxiMin)})`);
  console.log(`[build] style.css     ${kb(cssOrig)} → ${kb(cssMin)}  (-${pct(cssOrig, cssMin)})`);

  // Reescribe los ?v= de index.html con hash de contenido (cache-busting)
  bumpAssetVersions();

  console.log(`[build] Done in ${Date.now() - t}ms`);
}

build().catch(e => { console.error(e); process.exit(1); });
