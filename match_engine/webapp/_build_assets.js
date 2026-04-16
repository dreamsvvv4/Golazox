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

const pub = path.join(__dirname, 'public');

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

  // CSS
  const cssResult = await esbuild.build({
    entryPoints: [path.join(pub, 'style.css')],
    outfile:     path.join(pub, 'style.min.css'),
    bundle:      false,
    minify:      true,
    logLevel:    'silent',
  });

  // Gamification modules
  await esbuild.build({
    entryPoints: [path.join(pub, 'gx-user.js')],
    outfile:     path.join(pub, 'gx-user.min.js'),
    bundle:      false,
    minify:      true,
    target:      ['es2017'],
    logLevel:    'silent',
  });
  await esbuild.build({
    entryPoints: [path.join(pub, 'gx-ui.js')],
    outfile:     path.join(pub, 'gx-ui.min.js'),
    bundle:      false,
    minify:      true,
    target:      ['es2017'],
    logLevel:    'silent',
  });

  const jsOrig  = fs.statSync(path.join(pub, 'app.js')).size;
  const jsMin   = fs.statSync(path.join(pub, 'app.min.js')).size;
  const trnOrig = fs.statSync(path.join(pub, 'tournament.js')).size;
  const trnMin  = fs.statSync(path.join(pub, 'tournament.min.js')).size;
  const cssOrig = fs.statSync(path.join(pub, 'style.css')).size;
  const cssMin  = fs.statSync(path.join(pub, 'style.min.css')).size;
  const gxUOrig = fs.statSync(path.join(pub, 'gx-user.js')).size;
  const gxUMin  = fs.statSync(path.join(pub, 'gx-user.min.js')).size;
  const gxIOrig = fs.statSync(path.join(pub, 'gx-ui.js')).size;
  const gxIMin  = fs.statSync(path.join(pub, 'gx-ui.min.js')).size;

  const kb = n => (n / 1024).toFixed(1) + ' KB';
  const pct = (orig, min) => (((orig - min) / orig) * 100).toFixed(0) + '%';

  console.log(`[build] app.js        ${kb(jsOrig)} → ${kb(jsMin)}  (-${pct(jsOrig, jsMin)})`);
  console.log(`[build] tournament.js ${kb(trnOrig)} → ${kb(trnMin)}  (-${pct(trnOrig, trnMin)})`);
  console.log(`[build] style.css     ${kb(cssOrig)} → ${kb(cssMin)}  (-${pct(cssOrig, cssMin)})`);
  console.log(`[build] gx-user.js    ${kb(gxUOrig)} → ${kb(gxUMin)}  (-${pct(gxUOrig, gxUMin)})`);
  console.log(`[build] gx-ui.js      ${kb(gxIOrig)} → ${kb(gxIMin)}  (-${pct(gxIOrig, gxIMin)})`);
  console.log(`[build] Done in ${Date.now() - t}ms`);
}

build().catch(e => { console.error(e); process.exit(1); });
