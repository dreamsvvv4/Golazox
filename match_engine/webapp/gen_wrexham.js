/**
 * gen_wrexham.js — Wrexham vs Real Madrid — Final de la Champions
 *
 * Uso: node gen_wrexham.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');

(async () => {
  console.log('\n🎬 Generando: Wrexham vs Real Madrid — Final UCL');
  try {
    const result = await generateVideo({
      type:       'match',
      teamA:      'wrexham',
      eraA:       '2025',
      teamB:      'real-madrid',
      eraB:       '2025',
      stadiumId:  'wembley',
      refereeId:  'collina',
      weatherId:  'night',
      introTitle: '¿Y SI WREXHAM LLEGARA A LA FINAL?',
      introSub:   'Champions League · Final',
      introEraA:  '',
      introEraB:  '',
    });
    console.log('✅ Guardado:', result.path);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
})();
