/**
 * gen_como_inter.js — Como 1907 2025 vs Inter Milan 2025
 * Serie A — 12 Abril 2026
 *
 * Uso: node gen_como_inter.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');

(async () => {
  console.log('\n🎬 Generando: Serie A — Como 1907 vs Inter Milan 2025');
  try {
    const result = await generateVideo({
      type:       'match',
      teamA:      'como-1907',
      eraA:       '2025',
      teamB:      'inter-mailand',
      eraB:       '2025',
      stadiumId:  'sansiro',
      refereeId:  'rizzoli',
      weatherId:  'night',
      introTitle: 'SERIE A',
      introSub:   'Jornada 32 · 12 Abril 2026',
      introEraA:  '',
      introEraB:  '',
    });
    console.log('✅ Guardado:', result.path);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
})();
