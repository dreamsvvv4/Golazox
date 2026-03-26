'use strict';

/**
 * referee_logic.js
 * ═══════════════════════════════════════════════════════
 * Helper layer between referees.json and engine.js.
 * All functions are pure (no side effects, no I/O beyond the
 * one-time require at module load time).
 *
 * Referee multiplier semantics:
 *   1.0      = neutral / average referee behaviour
 *   > 1.0    = inflated probability (e.g. strictness 1.4 → +40% cards)
 *   < 1.0    = deflated probability (e.g. foul_tolerance 0.75 → 25% fewer fouls called)
 *
 * Probability formulas (as specified):
 *   P(foul)    = base_foul_rate    × (2.0 − referee.foul_tolerance)
 *   P(yellow)  = base_card_rate    × referee.strictness
 *   P(red)     = base_red_rate     × referee.red_card_bias
 *   P(penalty) = base_penalty_rate × referee.penalty_rate
 */

const fs   = require('fs');
const path = require('path');

// ── Load dataset once ─────────────────────────────────────────
const REFEREES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'referees.json'), 'utf8')
);

// ── Neutral fallback (all multipliers = 1.0) ─────────────────
const NEUTRAL_REFEREE = REFEREES.find(r => r.id === 'neutral') || {
  id: 'neutral', name: 'Árbitro neutral',
  strictness: 1.0, foul_tolerance: 1.0,
  penalty_rate: 1.0, red_card_bias: 1.0,
  play_advantage: 1.0,
};

/**
 * getRefereeById(id)
 * Returns the referee object for the given id, or NEUTRAL_REFEREE.
 * Safe to call with null / undefined.
 */
function getRefereeById(id) {
  if (!id) return NEUTRAL_REFEREE;
  return REFEREES.find(r => r.id === id) || NEUTRAL_REFEREE;
}

/**
 * applyBigMatchPressure(referee, isFinal, rand)
 * "Final" modifier: pressure of a final nudges the referee toward
 * stricter enforcement (more cards, fewer fouls tolerated).
 * Uses the seeded PRNG so determinism is maintained.
 *
 * @param {object}   referee  - base referee object (will NOT be mutated)
 * @param {boolean}  isFinal  - true when the match is a cup final / tournament final
 * @param {function} rand     - seeded PRNG (0–1), injected from engine
 * @returns {object} a new referee object with adjusted multipliers
 */
function applyBigMatchPressure(referee, isFinal, rand) {
  if (!isFinal) return referee;

  // Small PRNG-based variance: ±0.05 around fixed final bonus
  const variance = () => (rand() - 0.5) * 0.10;  // −0.05 … +0.05
  const FINAL_STRICTNESS_BONUS = 0.08;

  return {
    ...referee,
    // Pressure makes the ref marginally stricter and quicker to reach for cards
    strictness:    +(Math.min(2.0, referee.strictness    + FINAL_STRICTNESS_BONUS + variance())).toFixed(4),
    red_card_bias: +(Math.min(2.0, referee.red_card_bias + 0.05               + variance())).toFixed(4),
    // Under pressure, refs are also quicker to award penalties
    penalty_rate:  +(Math.min(2.0, referee.penalty_rate  + 0.04               + variance())).toFixed(4),
    // foul_tolerance and play_advantage are unaffected — these are personality traits
  };
}

/**
 * calcFoulRate(baseFoulRate, referee)
 * P(foul) = base_foul_rate × (2.0 − referee.foul_tolerance)
 *
 *   foul_tolerance = 1.0 → multiplier 1.0 (neutral)
 *   foul_tolerance = 1.3 → multiplier 0.7 (lenient: fewer fouls called)
 *   foul_tolerance = 0.7 → multiplier 1.3 (strict: more fouls called)
 *
 * @param {number} baseFoulRate  - base expected fouls per team (e.g. 10)
 * @param {object} referee
 * @returns {number} adjusted foul rate
 */
function calcFoulRate(baseFoulRate, referee) {
  const multiplier = 2.0 - (referee.foul_tolerance || 1.0);
  return Math.max(0, baseFoulRate * multiplier);
}

/**
 * calcCardRate(baseCardRate, referee)
 * P(yellow) = base_card_rate × referee.strictness
 */
function calcCardRate(baseCardRate, referee) {
  return Math.max(0, baseCardRate * (referee.strictness || 1.0));
}

/**
 * calcRedRate(baseRedRate, referee)
 * P(red) = base_red_rate × referee.red_card_bias
 */
function calcRedRate(baseRedRate, referee) {
  return Math.max(0, baseRedRate * (referee.red_card_bias || 1.0));
}

/**
 * calcPenaltyRate(basePenaltyRate, referee)
 * P(penalty) = base_penalty_rate × referee.penalty_rate
 */
function calcPenaltyRate(basePenaltyRate, referee) {
  return Math.max(0, basePenaltyRate * (referee.penalty_rate || 1.0));
}

/**
 * calcPlayAdvantageXgBoost(referee)
 * A ref who lets play flow (play_advantage > 1.0) creates more open play,
 * boosting xG slightly: +1.5% per 0.1 above 1.0, capped at +8%.
 * A ref who stops play constantly (play_advantage < 1.0) reduces xG.
 */
function calcPlayAdvantageXgBoost(referee) {
  const pa = referee.play_advantage || 1.0;
  return Math.max(0.92, Math.min(1.08, 1.0 + (pa - 1.0) * 0.15));
}

/**
 * buildRefereeStats(timeline, matchPenalties)
 * can display a referee report card.
 *
 * @param {Array}  timeline        - output of engine.buildTimeline()
 * @param {object} stats           - engine stats (fouls.teamA / fouls.teamB)
 * @param {Array}  matchPenalties  - in-match penalty events (scored or missed)
 * @returns {object} referee_stats
 */
function buildRefereeStats(timeline, stats, matchPenalties) {
  const cards = { yellow: { A: 0, B: 0 }, red: { A: 0, B: 0 } };
  let penaltiesAwarded = 0;

  for (const ev of (timeline || [])) {
    if (ev.type === 'yellow')       { cards.yellow[ev.side] = (cards.yellow[ev.side] || 0) + 1; }
    if (ev.type === 'red')          { cards.red[ev.side]    = (cards.red[ev.side]    || 0) + 1; }
    if (ev.type === 'penalty' || ev.type === 'penalty_miss') { penaltiesAwarded++; }
  }
  penaltiesAwarded += (matchPenalties || []).length;

  return {
    fouls_called: {
      teamA: (stats?.fouls?.teamA) || 0,
      teamB: (stats?.fouls?.teamB) || 0,
    },
    yellow_cards: {
      teamA: cards.yellow.A,
      teamB: cards.yellow.B,
      total: cards.yellow.A + cards.yellow.B,
    },
    red_cards: {
      teamA: cards.red.A,
      teamB: cards.red.B,
      total: cards.red.A + cards.red.B,
    },
    penalties_awarded: penaltiesAwarded,
  };
}

module.exports = {
  REFEREES,
  NEUTRAL_REFEREE,
  getRefereeById,
  applyBigMatchPressure,
  calcCardRate,
  calcRedRate,
  calcFoulRate,
  calcPenaltyRate,
  calcPlayAdvantageXgBoost,
  buildRefereeStats,
};
