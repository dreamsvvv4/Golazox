/**
 * gen_bayern_realmadrid.js — Bayern München 2025 vs Real Madrid 2025
 * Cuartos de Final Champions League (Vuelta) — Abril 2026
 * Ida: Real Madrid 1-2 Bayern München
 *
 * Uso: node gen_bayern_realmadrid.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');
const { uploadYouTube } = require('./uploader');

(async () => {
  console.log('\n🎬 Generando: Cuartos de Final UCL — Bayern München vs Real Madrid');
  console.log('   Champions League · Vuelta · Abril 2026\n');
  try {
    const result = await generateVideo({
      type:        'match',
      teamA:       'fc-bayern-munchen',
      eraA:        '2025',
      teamB:       'real-madrid',
      eraB:        '2025',
      stadiumId:   'wembley',
      refereeId:   'brych',
      weatherId:   'night',
      introTitle:   '¿PUEDE EL REAL MADRID REMONTAR?',
      introSub:    'Allianz Arena · Múnich · 21:00h',
      matchDesc:   'Ida: Real Madrid 1-2 Bayern München',
      introContext: 'Cuartos de Final · UEFA Champions League',
      introTrophy:  'ucl',
      introEraA:   '2025',
      introEraB:   '2025',
    });
    console.log('\n✅ Video guardado en:', result.path);
    if (result.matchMeta?.finalScore) {
      const { scoreA, scoreB } = result.matchMeta.finalScore;
      console.log(`   Resultado: Bayern ${scoreA} – ${scoreB} Real Madrid`);
    }

    // Auto-upload to YouTube — COMMENT OUT UNTIL APPROVED
    // const { scoreA, scoreB } = result.matchMeta?.finalScore ?? { scoreA: '?', scoreB: '?' };
    // await uploadYouTube({
    //   file: result.path,
    //   title: `Bayern München ${scoreA}-${scoreB} Real Madrid | UCL Cuartos de Final | Simulación`,
    //   type: 'match',
    // });

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
})();
