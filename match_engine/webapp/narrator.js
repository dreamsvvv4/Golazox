'use strict';

/**
 * narrator.js — Procedural match commentary generator
 * ════════════════════════════════════════════════════
 *
 * Assembles a narrative sentence from 4 independent dictionary slices:
 *   1. Contexto  — sets the scene (minute / match phase)
 *   2. Creacion  — describes how the chance was built (dependent on playStyle)
 *   3. Ejecucion — what the player did (dependent on player rating + isClutch)
 *   4. Desenlace — the outcome (randomly selected variant)
 *
 * Usage:
 *   const { describe, describeTimeline } = require('./narrator');
 *
 *   // Single event
 *   const text = describe(event, context, 'es', randFn);
 *
 *   // Annotate a full timeline in-place
 *   describeTimeline(timelineArray, context, 'es', seed);
 */

const fs   = require('fs');
const path = require('path');

// ── Load dictionary once at startup ───────────────────────────
const DICT = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'narrator_dict.json'), 'utf8')
);

// ── Mulberry32 PRNG (same as engine.js, self-contained here) ──
function _rng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Helpers ────────────────────────────────────────────────────
function _pick(arr, rand) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(rand() * arr.length)];
}

/** Replace ${var} tokens in a template string. */
function _interpolate(tpl, vars) {
  if (!tpl) return '';
  return tpl.replace(/\$\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

/** Derive context key from match minute. */
function _ctxKey(minute) {
  if (minute <= 20) return 'early';
  if (minute <= 45) return 'first_half';
  if (minute <= 65) return 'second_half';
  if (minute <= 80) return 'late';
  return 'final_minutes';
}

/** Derive execution quality key from overall player rating. */
function _ejKey(rating) {
  if (rating >= 88) return 'elite';
  if (rating >= 78) return 'good';
  return 'average';
}

/**
 * Pick a phrase from a nested dict entry:
 *   dict → { [key]: { [lang]: string[] } }
 * Falls back to 'default' → '' when key or lang is missing.
 */
function _phrase(section, key, lang, rand) {
  if (!section) return '';
  const bucket = section[key] || section['default'] || {};
  return _pick(bucket[lang] || bucket['es'] || [], rand);
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Generate a narrative sentence for a single match event.
 *
 * @param {object} event
 *   { type, minute, side, player, scoreA, scoreB,
 *     playerRating=75, isClutch=false }
 * @param {object} context
 *   { playStyleA='directo', playStyleB='directo' }
 * @param {string} lang  - 'es' | 'en'
 * @param {function} rand - seeded PRNG (0–1), defaults to Math.random
 * @returns {string}
 */
function describe(event, context = {}, lang = 'es', rand = Math.random) {
  const {
    type        = 'goal',
    minute      = 45,
    side        = 'A',
    player      = '?',
    scoreA      = 0,
    scoreB      = 0,
    playerRating = 75,
    isClutch    = false,
    refereeId   = null,
    refereeName = '',
  } = event;

  const { playStyleA = 'directo', playStyleB = 'directo' } = context;
  const playStyle = side === 'A' ? playStyleA : playStyleB;

  const eventDict = DICT[type];
  if (!eventDict) return '';

  const vars = {
    player:   player || '?',
    minute:   String(minute),
    scoreA:   String(scoreA),
    scoreB:   String(scoreB),
    referee:  refereeName || '',
  };

  const ctxKey = _ctxKey(minute);
  const ejKey  = isClutch ? 'clutch' : _ejKey(playerRating);

  // Referee-specific override: if event carries refereeId AND the dict has a
  // `ref_<id>` bucket in ejecucion, use it first (falls back to ejKey if empty).
  const refKey    = refereeId ? `ref_${refereeId}` : null;
  const ejKeyFinal = (refKey && eventDict.ejecucion?.[refKey]) ? refKey : ejKey;

  const contexto  = _interpolate(_phrase(eventDict.contexto,  ctxKey,    lang, rand), vars);
  const creacion  = _interpolate(_phrase(eventDict.creacion,  playStyle, lang, rand), vars);
  const ejecucion = _interpolate(_phrase(eventDict.ejecucion, ejKeyFinal, lang, rand), vars);

  // Pick a random desenlace variant
  const desDict   = eventDict.desenlace || {};
  const desKeys   = Object.keys(desDict).filter(k => k !== 'default');
  const desKey    = desKeys.length ? desKeys[Math.floor(rand() * desKeys.length)] : 'default';
  const desenlace = _interpolate(_phrase(eventDict.desenlace, desKey, lang, rand), vars);

  return [contexto, creacion, ejecucion, desenlace]
    .map(s => s.trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Annotates every event in a timeline array (in-place) with a `narrative` string.
 * Also adds `narrativeEn` if lang is 'es', or `narrativeEs` if lang is 'en'.
 *
 * @param {Array}  events   - output of engine.buildTimeline()
 * @param {object} context  - { playStyleA, playStyleB }
 * @param {string} lang     - primary language ('es' | 'en')
 * @param {number} seed     - integer seed for deterministic output
 */
function describeTimeline(events, context = {}, lang = 'es', seed = 42) {
  const rand = _rng(seed);
  for (const ev of events) {
    ev.narrative = describe(ev, context, lang, rand);
  }
  return events;
}

module.exports = { describe, describeTimeline };
