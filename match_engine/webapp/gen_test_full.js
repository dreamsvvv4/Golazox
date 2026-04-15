/**
 * gen_test_full.js — Video de prueba completo
 * FC Barcelona 2009 vs Manchester United 2009
 * Final Champions League · Roma, 27 Mayo 2009
 *
 * Genera el pipeline completo: intro (3 slides) → partido → outro (resultado + goleadores + stats)
 * Uso: node gen_test_full.js
 */
'use strict';

require('dotenv').config();
const { generateVideo } = require('./video_generator');

(async () => {
  console.log('\n🎬 Generando video completo: FC Barcelona 2009 vs Manchester United 2009');
  console.log('   Final UCL · Roma · 27 Mayo 2009\n');
  try {
    const result = await generateVideo({
      type:       'match',
      teamA:      'fc-barcelona',
      eraA:       '2009',
      teamB:      'manchester-united',
      eraB:       '2009',
      stadiumId:  'wembley',
      refereeId:  'collina',
      weatherId:  'night',
      introTitle: 'FINAL CHAMPIONS LEAGUE',
      introSub:   'Roma · 27 Mayo 2009',
      introEraA:  '2009',
      introEraB:  '2009',
    });
    console.log('\n✅ Video guardado en:', result.path);
    if (result.matchMeta?.finalScore) {
      const { scoreA, scoreB } = result.matchMeta.finalScore;
      console.log(`   Resultado: Barcelona ${scoreA} – ${scoreB} Man United`);
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
})();
