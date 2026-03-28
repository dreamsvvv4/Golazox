'use strict';
const { describe, describeTimeline } = require('./narrator.js');
const { simulateMatch }              = require('./engine.js');

const v = simulateMatch({ teamA: 'Brazil', teamB: 'Italy', eraA: '1970', eraB: '1982', matchSalt: 7 });
console.log('Timeline length:', v.timeline.length);
describeTimeline(v.timeline, { playStyleA: 'directo', playStyleB: 'catenaccio' }, 'es', 42);
v.timeline.slice(0, 4).forEach(ev => {
  console.log('[' + ev.minute + "' " + ev.type + ' ' + ev.side + '] ' + (ev.player || ''));
  console.log('  ES:', ev.narrative);
});
