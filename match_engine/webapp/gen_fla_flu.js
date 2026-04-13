/**
 * gen_fla_flu.js — Derby Fla-Flu en el Maracanã
 * Flamengo (2022, campeón Copa Libertadores) vs Fluminense (2023, campeón Libertadores)
 *
 * Uso: node gen_fla_flu.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');

(async () => {
  console.log('\n🎬 Generando: Fla-Flu — Derby Carioca en el Maracanã');
  try {
    const result = await generateVideo({
      type:       'match',
      teamA:      'flamengo',
      eraA:       '2022',
      teamB:      'fluminense',
      eraB:       '2023',
      stadiumId:  'maracana',
      refereeId:  'brych',
      weatherId:  'heat',
      introTitle: '¡EL CLÁSICO DE RÍO!',
      introSub:   'Fla-Flu · Maracanã',
    });
    console.log('✅ Guardado:', result.path);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
})();
