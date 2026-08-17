#!/usr/bin/env node
/**
 * _gen_highlights_video.js — Generador de vídeos de simulación MEJORADO.
 *
 * Qué mejora respecto a `daily_matches.js`:
 *   1. Partido más DINÁMICO: usa la velocidad "30 seg" (tick 333) en vez de
 *      "1 min" (tick 667) → el partido dura la mitad y el vídeo no se hace largo.
 *   2. Reutiliza el pipeline pulido de `video_generator.js` (intro con escudos +
 *      alineaciones + tarjeta final con marcador/goleadores/stats + slide de
 *      suscripción). REQUIERE los 4 scripts `_*_screenshot.js` (restaurados).
 *   3. Elige el partido más INTERESANTE del día (ranking de `daily_matches.js`)
 *      o los equipos que le pases por CLI.
 *
 * Uso:
 *   node _gen_highlights_video.js                       → mejor partido del día (~30s)
 *   node _gen_highlights_video.js --top 3               → los 3 más interesantes
 *   node _gen_highlights_video.js --speed 667           → partido a 1 min (más lento)
 *   node _gen_highlights_video.js --a real-madrid:2026 --b fc-barcelona:2026
 *   node _gen_highlights_video.js --promo --a rc-deportivo:2025 --b elche-cf:2025
 *   node _gen_highlights_video.js --date 2026-08-17
 *   node _gen_highlights_video.js --upload              → sube a YouTube tras generar
 *
 * Notas:
 *   - --promo: vídeo CORTO (~15-20s) para promocionar la web: intro breve,
 *     partido acelerado 2x, cierre con golazox.com y sin slide de "suscríbete".
 *   - Ejecutar desde match_engine/webapp (el terminal arranca en Documents).
 *   - El render usa golazox.com por defecto (GOLAZOX_URL para override).
 */

'use strict';

const { generateVideo } = require('./video_generator');
const { fetchTodayMatches, rankMatches } = require('./daily_matches');

// ── Parse "slug:era" → { slug, era } ─────────────────────────────────────────
function parseTeamArg(v) {
  if (!v) return null;
  const i = v.indexOf(':');
  if (i === -1) return { slug: v.trim(), era: '' };
  return { slug: v.slice(0, i).trim(), era: v.slice(i + 1).trim() };
}

// ── Nombres de competición amigables (mismo criterio que daily_matches) ──────
const COMP_DISPLAY = {
  'Primera Division':       'La Liga',
  'UEFA Champions League':  'Champions League',
  'UEFA Europa League':     'Europa League',
  'UEFA Conference League': 'Conference League',
  'Copa Libertadores':      'Copa Libertadores',
  'Brasileirao Serie A':    'Brasileirao',
  'Argentine Primera':      'Primera División ARG',
  'Saudi Pro League':       'Saudi Pro League',
};

// Quita sufijos corporativos para el título con marcador
function shortName(n) {
  return (n || '').replace(/\s(FC|CF|SC|SV|AC|AS|RC|UD|RCD|FSV|TSG|VFL|VFB)$/i, '').trim();
}

// ── Genera 1 vídeo dinámico para un enfrentamiento ───────────────────────────
async function generateHighlight({ homeSlug, awaySlug, era, homeName, awayName, competition, utcDate }, speed, promo = false) {
  const compDisplay = COMP_DISPLAY[competition] || competition || 'GolazoX';

  // Subtítulo de intro: "La Liga · 21:00"
  let introSub = compDisplay;
  if (utcDate) {
    try {
      const t = new Date(utcDate).toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
      });
      introSub = `${compDisplay} · ${t}`;
    } catch { /* solo competición */ }
  }

  console.log(`\n[hl] 🎬 ${homeName || homeSlug} vs ${awayName || awaySlug}  (${compDisplay}, tick ${speed}ms${promo ? ', PROMO' : ''})`);
  const result = await generateVideo({
    type:       'match',
    teamA:      homeSlug,
    eraA:       era,
    teamB:      awaySlug,
    eraB:       era,
    introSub,
    matchSpeed: speed,   // ← clave: partido más dinámico
    promo,               // ← vídeo corto promocional de la web
  });

  // Título con marcador si la simulación produjo resultado
  let title = `${homeName || homeSlug} vs ${awayName || awaySlug} | ${compDisplay} | golazox.com`;
  const fs = result.matchMeta?.finalScore;
  if (fs && typeof fs.scoreA === 'number' && typeof fs.scoreB === 'number') {
    title = `${shortName(homeName || homeSlug)} ${fs.scoreA}-${fs.scoreB} ${shortName(awayName || awaySlug)} | ${compDisplay} | golazox.com`;
  }
  console.log(`[hl] ✓ ${title}\n     ${result.path}`);
  return { title, path: result.path };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const getFlag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const promo  = args.includes('--promo');                  // vídeo corto promo de la web
  const speed  = parseInt(getFlag('--speed'), 10) || 333;   // 333 = ~30s (dinámico)
  const top    = Math.max(1, parseInt(getFlag('--top'), 10) || 1);
  const date   = getFlag('--date') || args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || null;
  const upload = args.includes('--upload') || process.env.AUTO_UPLOAD === '1';

  const aArg = parseTeamArg(getFlag('--a'));
  const bArg = parseTeamArg(getFlag('--b'));
  const comp = getFlag('--comp');   // p.ej. "La Liga"

  const results = [];

  // Modo 1: equipos explícitos
  if (aArg && bArg) {
    const prettyName = (s) => s
      .replace(/^(rc|cf|fc|ud|sd|cd|ac|as|rcd)-/, '')
      .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    results.push(await generateHighlight({
      homeSlug: aArg.slug, awaySlug: bArg.slug,
      era:      aArg.era || bArg.era || '',
      homeName: prettyName(aArg.slug), awayName: prettyName(bArg.slug),
      competition: comp || 'GolazoX', utcDate: null,
    }, speed, promo));
  } else {
    // Modo 2: mejor(es) partido(s) del día
    const matches = await fetchTodayMatches(date);
    console.log(`[hl] ${matches.length} partidos encontrados para ${date || 'hoy'}`);
    const ranked = rankMatches(matches);
    if (!ranked.length) {
      console.log('[hl] Ningún partido del día tiene ambos equipos en el catálogo.');
      return;
    }
    console.log('\n[hl] 🔥 Ranking de interés:');
    ranked.slice(0, Math.max(5, top)).forEach((c, i) => {
      const tag = c.isDerby ? ' 🔥DERBI' : '';
      console.log(`  ${i + 1}. [${c.interest}] ${c.homeName} (${c.strengthA ?? '—'}) vs ${c.awayName} (${c.strengthB ?? '—'}) — ${c.competition}${tag}`);
    });

    const n = Math.min(top, ranked.length);
    for (let i = 0; i < n; i++) {
      try {
        results.push(await generateHighlight(ranked[i], speed, promo));
      } catch (e) {
        console.warn(`[hl] ⚠️  Falló ${ranked[i].homeSlug} vs ${ranked[i].awaySlug}: ${e.message}`);
      }
    }
  }

  if (!results.length) {
    console.log('[hl] No se generó ningún vídeo.');
    process.exit(0);
  }

  console.log(`\n[hl] ✅ ${results.length} vídeo(s) generado(s):`);
  results.forEach(r => console.log(`  • ${r.title}\n    ${r.path}`));

  if (upload) {
    const { uploadAll } = require('./uploader');
    for (const r of results) {
      if (!r.path) continue;
      console.log(`[hl] AUTO_UPLOAD — subiendo a YouTube: ${r.title}`);
      await uploadAll({ file: r.path, title: r.title, platforms: 'youtube', type: 'match' });
    }
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error('[hl] ERROR:', e); process.exit(1); });
}

module.exports = { generateHighlight };
