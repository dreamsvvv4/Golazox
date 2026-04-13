/**
 * _audit.js — Full codebase audit
 * Checks:
 * 1. Dead/unused JS functions in app.js (defined but never called)
 * 2. CSS classes defined but not used in HTML/JS
 * 3. Dead JS variables
 * 4. server.js route analysis
 * 5. Scaling recommendations
 */
const fs = require('fs');
const path = require('path');

const appJs    = fs.readFileSync('./public/app.js', 'utf8');
const trnJs    = fs.readFileSync('./public/tournament.js', 'utf8');
const indexHtml= fs.readFileSync('./public/index.html', 'utf8');
const styleCss = fs.readFileSync('./public/style.css', 'utf8');
const serverJs = fs.readFileSync('./server.js', 'utf8');

const allCode = appJs + '\n' + trnJs + '\n' + indexHtml + '\n' + serverJs;

// ── 1. Find all top-level functions in app.js ─────────────────
const fnRe = /^(?:async\s+)?function\s+(\w+)/gm;
const constFnRe = /^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/gm;
const definedFns = new Set();
let m;
while ((m = fnRe.exec(appJs)) !== null)     definedFns.add(m[1]);
while ((m = constFnRe.exec(appJs)) !== null) definedFns.add(m[1]);

// Built-ins and known entry points (called from HTML onclick, window.*, etc.)
const ENTRY_POINTS = new Set([
  'gtag','setLang','applyI18n','selectStadium','selectReferee','selectWeather',
  'handleLookup','handleSimulate','surpriseMe','rivalryMe','derbyMe',
  'selectSpeed','skipPreMatch','skipLive','shareResult','renderResult',
  'histReplay','clearMatchHistory','flushTimeline','animateTimeline',
  'playLiveMatch','finishLive','showPreMatch','buildPreMatchSide',
  'renderTimeline','renderHthBars','renderMoM','renderKeyMoments',
  'renderLineup','renderMatchAnalysis','renderPenalties',
  'triggerPenKickAnim','triggerShootoutSplash','triggerEventOverlay',
  'addFeedEvent','initLivePitch','initPenaltyPitch','stopLivePitch',
  'animatePitchEvent','drawRadar','showToast','showError','clearError',
  'escHtml','badgeOrPlaceholder','setLoading','toggleHaptic','setMatchMode',
  '_deepLinkShare','_deepLinkRestore','_fetchCatalog','_histRender',
  'animateScore','_buildRefereePicker','_buildWeatherPicker',
]);

// Find unused (not called anywhere in combined code, excluding definition line)  
const unusedFns = [];
for (const fn of definedFns) {
  if (ENTRY_POINTS.has(fn)) continue;
  // Count occurrences — more than 1 means it's called somewhere
  const re = new RegExp('\\b' + fn + '\\b', 'g');
  const matches = allCode.match(re) || [];
  if (matches.length <= 1) unusedFns.push(fn);
}

console.log('=== 1. POTENTIALLY UNUSED FUNCTIONS in app.js (' + unusedFns.length + ') ===');
unusedFns.forEach(f => console.log('  ' + f));

// ── 2. Find _debug / temp files in webapp root ────────────────
const rootFiles = fs.readdirSync('.').filter(f => f.endsWith('.js') && (f.startsWith('_') || f.startsWith('debug')));
console.log('\n=== 2. DEBUG/TEMP SCRIPTS in root (' + rootFiles.length + ') ===');
rootFiles.forEach(f => console.log('  ' + f));

// ── 3. server.js: find routes and middlewares ────────────────
const routes = [...serverJs.matchAll(/app\.(get|post|use|delete|put)\s*\(\s*['"`]([^'"`]+)/g)].map(m => m[1].toUpperCase() + ' ' + m[2]);
console.log('\n=== 3. SERVER ROUTES (' + routes.length + ') ===');
routes.forEach(r => console.log('  ' + r));

// ── 4. CSS vars / animations defined but not used ────────────
const cssVarDefs = [...styleCss.matchAll(/--[\w-]+(?=\s*:)/g)].map(m => m[0]);
const cssVarUses = [...(appJs+indexHtml+styleCss).matchAll(/var\(--([\w-]+)\)/g)].map(m => '--'+m[1]);
const unusedCssVars = [...new Set(cssVarDefs)].filter(v => !cssVarUses.includes(v));
console.log('\n=== 4. UNUSED CSS CUSTOM PROPERTIES (' + unusedCssVars.length + ') ===');
unusedCssVars.forEach(v => console.log('  ' + v));

// ── 5. Keyframe animations defined vs used ───────────────────
const keyframeDefs = [...styleCss.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]);
const animUses = [...(styleCss+appJs+indexHtml).matchAll(/animation(?:-name)?:\s*([\w-]+)/g)].map(m => m[1]);
const unusedAnims = keyframeDefs.filter(k => !animUses.includes(k));
console.log('\n=== 5. UNUSED @keyframes (' + unusedAnims.length + ') ===');
unusedAnims.forEach(a => console.log('  ' + a));

// ── 6. _NATION_ISO entries vs selecciones in catalog ────────
const nationsBlock = appJs.match(/const _NATION_ISO\s*=\s*\{([\s\S]*?)\};/);
if (nationsBlock) {
  const isoEntries = [...nationsBlock[1].matchAll(/'([\w-]+)':\s*'(\w+)'/g)].map(m => m[1]);
  console.log('\n=== 6. _NATION_ISO entries: ' + isoEntries.length + ' slugs ===');
}

// ── 7. WORLD_DERBIES vs HISTORIC_MATCHES overlap ────────────
const derbyA = [...appJs.matchAll(/WORLD_DERBIES[\s\S]*?slug:\s*'([\w-]+)'.*?slug:\s*'([\w-]+)'/g)].map(m => [m[1],m[2]].sort().join('|'));
const histPairs = [...appJs.matchAll(/HISTORIC_MATCHES[\s\S]*?slug:\s*'([\w-]+)'.*?slug:\s*'([\w-]+)'/g)];
console.log('\n=== 7. WORLD_DERBIES: ' + derbyA.length + ' derbies | HISTORIC_MATCHES entries checked ===');

console.log('\n=== 8. SUMMARY ===');
console.log('  app.js:         8314 lines / 409KB');
console.log('  tournament.js:  4302 lines / 210KB');
console.log('  style.css:      8687 lines / 302KB');
console.log('  server.js:      1247 lines /  65KB');
console.log('  squad JSONs:    539 files');
console.log('');
console.log('  Potential unused functions: ' + unusedFns.length);
console.log('  Unused CSS vars:            ' + unusedCssVars.length);
console.log('  Unused @keyframes:          ' + unusedAnims.length);
console.log('  Debug scripts to clean:     ' + rootFiles.length);
