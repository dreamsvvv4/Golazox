/**
 * gen_pele_maradona.js — Brasil 1970 vs Argentina 1986
 * El debate eterno: ¿Pelé o Maradona? El mejor equipo de cada leyenda.
 *
 * Uso: node gen_pele_maradona.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');

(async () => {
  console.log('\n🎬 Generando: Brasil 1970 vs Argentina 1986 — ¿Pelé o Maradona?');
  try {
    const result = await generateVideo({
      type:       'match',
      teamA:      'brasilien',
      eraA:       '1970',
      teamB:      'argentinien',
      eraB:       '1986',
      stadiumId:  'azteca',
      refereeId:  'collina',
      weatherId:  'heat',
      introTitle: '¿PELÉ O MARADONA?',
      introSub:   'Brasil 70 · Argentina 86 · EL DEBATE ETERNO',
    });
    console.log('✅ Guardado:', result.path);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
})();
