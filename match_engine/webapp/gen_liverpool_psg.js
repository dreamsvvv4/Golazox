/**
 * gen_liverpool_psg.js — Liverpool 2025 vs PSG 2025
 * Cuartos de Final Champions League (Vuelta) — Abril 2026
 * Ida: PSG 2-0 Liverpool
 *
 * Uso: node gen_liverpool_psg.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');
const { uploadYouTube } = require('./uploader');

(async () => {
  console.log('\n🎬 Generando: Cuartos de Final UCL — Liverpool vs Paris Saint-Germain');
  console.log('   Champions League · Vuelta · Abril 2026\n');
  try {
    const result = await generateVideo({
      type:        'match',
      teamA:       'fc-liverpool',
      eraA:        '2025',
      teamB:       'fc-paris-saint-germain',
      eraB:        '2025',
      stadiumId:   'anfield',
      refereeId:   'clattenburg',
      weatherId:   'night',
      introTitle:   '¿PUEDE EL LIVERPOOL REMONTAR?',
      introSub:    'Anfield · Liverpool · 21:00h',
      matchDesc:   'Ida: PSG 2-0 Liverpool',
      introContext: 'Cuartos de Final · UEFA Champions League',
      introTrophy:  'ucl',
      introEraA:   '2025',
      introEraB:   '2025',
    });
    console.log('\n✅ Video guardado en:', result.path);
    if (result.matchMeta?.finalScore) {
      const { scoreA, scoreB } = result.matchMeta.finalScore;
      console.log(`   Resultado: Liverpool ${scoreA} – ${scoreB} PSG`);
    }

    // Auto-upload to YouTube
    const { scoreA, scoreB } = result.matchMeta?.finalScore ?? { scoreA: '?', scoreB: '?' };
    await uploadYouTube({
      file: result.path,
      title: `Liverpool ${scoreA}-${scoreB} PSG | UCL Cuartos de Final | Simulación`,
      type: 'match',
    });
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
})();
