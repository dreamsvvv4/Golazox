/**
 * gen_atm_barca.js — Atlético de Madrid 2025 vs FC Barcelona 2025
 * Cuartos de Final Champions League — 14 Abril 2026
 *
 * Uso: node gen_atm_barca.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');
const { uploadYouTube } = require('./uploader');

(async () => {
  console.log('\n🎬 Generando: Cuartos de Final UCL — Atlético de Madrid vs FC Barcelona');
  console.log('   Champions League · 14 Abril 2026\n');
  try {
    const result = await generateVideo({
      type:       'match',
      teamA:      'atletico-madrid',
      eraA:       '2025',
      teamB:      'fc-barcelona',
      eraB:       '2025',
      stadiumId:  'campnou',
      refereeId:  'brych',
      weatherId:  'night',
      introTitle:   '\u00bfHABR\u00c1 REMONTADA?',
      introSub:    'Metropolitano \u00b7 Madrid \u00b7 21:00h',
      matchDesc:   'Ida: FC Barcelona 0-2 Atl\u00e9tico de Madrid',
      introContext: 'Cuartos de Final \u00b7 UEFA Champions League',
      introTrophy:  'ucl',
      introEraA:   '2025',
      introEraB:   '2025',
    });
    console.log('\n✅ Video guardado en:', result.path);
    if (result.matchMeta?.finalScore) {
      const { scoreA, scoreB } = result.matchMeta.finalScore;
      console.log(`   Resultado: Atlético ${scoreA} – ${scoreB} Barcelona`);
    }

    // Auto-upload to YouTube
    const { scoreA, scoreB } = result.matchMeta?.finalScore ?? { scoreA: '?', scoreB: '?' };
    await uploadYouTube({
      file: result.path,
      title: `Atlético de Madrid ${scoreA}-${scoreB} FC Barcelona | UCL Cuartos de Final | Simulación`,
      type: 'match',
    });
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
})();
