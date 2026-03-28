'use strict';
/**
 * _test_lookups.js — Test manual de scrapers
 * Uso: node _test_lookups.js [equipo] [año]
 * Ejemplo: node _test_lookups.js "FC Barcelona" 2012
 *          node _test_lookups.js "Spain" 1998
 */
const { lookupTeam } = require('./lookup');

const team = process.argv[2] || 'FC Barcelona';
const era  = process.argv[3] || '2010';

console.log(`\nBuscando: "${team}" era=${era}\n`);

lookupTeam(team, era, '').then(r => {
  if (!r.found) { console.log('NO ENCONTRADO'); process.exit(1); }
  const gk = r.players?.find(p => p.position === 'GK');
  console.log('Fuente:    ', r.source);
  console.log('Jugadores: ', r.players?.length);
  console.log('Portero:   ', gk?.name || '(sin GK)');
  console.log('Formación: ', r.formation);
  console.log('Primeros 5:', r.players?.slice(0, 5).map(p => `${p.name} (${p.position})`).join(', '));
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
