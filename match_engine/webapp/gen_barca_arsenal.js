/**
 * gen_derbi_catalan.js — FC Barcelona 2025 vs Espanyol 2025
 * Derbi Barcelonés — La Liga, 11 Abril 2026
 *
 * Uso: node gen_barca_arsenal.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');

(async () => {
  console.log('\n🎬 Generando: Derbi Catalán — FC Barcelona vs Espanyol 2025');
  try {
    const result = await generateVideo({
      type:       'match',
      teamA:      'fc-barcelona',
      eraA:       '2025',
      teamB:      'espanyol-barcelona',
      eraB:       '2025',
      stadiumId:  'campnou',
      refereeId:  'lahoz',
      weatherId:  'night',
      introTitle: 'DERBI CATALÁN',
      introSub:   'La Liga · 11 Abril 2026',
      introEraA:  '',
      introEraB:  '',
    });
    console.log('✅ Guardado:', result.path);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
})();
