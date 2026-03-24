/**
 * utils.js — Shared utilities for squad scrapers
 * ════════════════════════════════════════════════════════════
 * Exports used by transfermarkt.js, bdfutbol.js and lookup.js.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// National team classification lists
// Used by rating estimators in transfermarkt.js and lookup.js
// ─────────────────────────────────────────────────────────────
const ELITE_NATIONALS = [
  'spain','españa','espana','germany','deutschland','alemania',
  'france','frankreich','francia','brazil','brasil','argentina',
  'england','inglaterra','italy','italia','portugal',
  'netherlands','holanda','holland','belgium','belgica',
  'croatia','croacia',
];

const STRONG_NATIONALS = [
  'denmark','dinamarca','switzerland','suiza','colombia',
  'senegal','morocco','marruecos','usa','mexico','austria',
  'czech','poland','polonia','ukraine','ucrania',
  'sweden','suecia','norway','noruega',
  'japan','japon','south korea','corea',
  'cameroon','nigeria','chile','uruguay',
];

// ─────────────────────────────────────────────────────────────
// Build a balanced XI (up to 11) from { name, position }[] list.
// Adapts formation: 4-4-2 when ≥2 strikers + ≥4 midfielders,
// otherwise 4-3-3.
// ─────────────────────────────────────────────────────────────
function buildXI(raw) {
  const pool = {};
  for (const { name, position } of raw) {
    (pool[position] = pool[position] || []).push(name);
  }

  const xi = [];
  function take(pos, n, ...fallbacks) {
    let need = n;
    for (const src of [pos, ...fallbacks]) {
      while (need > 0 && pool[src]?.length > 0) {
        xi.push({ name: pool[src].shift(), position: pos });
        need--;
      }
      if (!need) break;
    }
  }

  const attCount = (pool['ST']||[]).length + (pool['RW']||[]).length + (pool['LW']||[]).length;
  const midCount = (pool['CM']||[]).length + (pool['DM']||[]).length + (pool['AM']||[]).length;
  const useTwoUp = attCount >= 2 && midCount >= 4;

  take('GK', 1);
  take('RB', 1, 'CB');
  take('CB', 2, 'DM');
  take('LB', 1, 'CB');
  if (useTwoUp) {
    take('DM', 1, 'CM');
    take('CM', 3, 'AM', 'DM', 'RW', 'LW');
    take('ST', 2, 'RW', 'LW', 'AM');
  } else {
    take('DM', 1, 'CM');
    take('CM', 2, 'AM', 'DM');
    take('RW', 1, 'AM', 'CM');
    take('ST', 1, 'LW', 'AM', 'CM');
    take('LW', 1, 'AM', 'CM', 'ST');
  }

  return xi.slice(0, 11);
}

module.exports = { buildXI, ELITE_NATIONALS, STRONG_NATIONALS };
