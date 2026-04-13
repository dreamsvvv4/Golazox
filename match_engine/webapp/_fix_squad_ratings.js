/**
 * _fix_squad_ratings.js
 * Fixes broken season-level ratings in squad JSON files:
 *  - ALL_SAME: all 4 ratings identical (scraper artifact)
 *  - RATINGS_TOO_LOW: avg < 65 (wrong market-value based scrape)
 *  - NO_SEASON_RATINGS: missing ratings object entirely
 *
 * Derives correct ratings from player OVR data grouped by position.
 */

const fs   = require('fs');
const path = require('path');

const SQUADS_DIR = path.join(__dirname, 'squads');

// Position → department mapping
const POS_TO_GROUP = {
  GK:  'gk',
  CB:  'def', LB: 'def', RB: 'def',
  CM:  'mid', DM: 'mid', AM: 'mid', CAM: 'mid', LM: 'mid', RM: 'mid',
  ST:  'atk', LW: 'atk', RW: 'atk', CF: 'atk',
};

/**
 * Derive {attack, midfield, defense, goalkeeping} from player array.
 * Takes top-4 non-null ratings per department.
 * Falls back to overall squad average if a department has < 2 players.
 */
function computeRatings(players, existingRatings = null) {
  const groups = { atk: [], mid: [], def: [], gk: [] };

  for (const p of (players || [])) {
    if (p.rating == null || typeof p.rating !== 'number') continue;
    const g = POS_TO_GROUP[p.position];
    if (g) groups[g].push(p.rating);
  }

  // Top-4 per dept (starting XI level, not bench)
  for (const g of Object.keys(groups)) {
    groups[g] = groups[g].sort((a, b) => b - a).slice(0, 4);
  }

  const deptAvg = arr => arr.length >= 2
    ? Math.round(arr.reduce((s, r) => s + r, 0) / arr.length)
    : null;

  // Overall average of top-15 squad players as fallback
  const allRatings = (players || [])
    .filter(p => p.rating != null && typeof p.rating === 'number')
    .map(p => p.rating)
    .sort((a, b) => b - a)
    .slice(0, 15);
  const overallAvg = allRatings.length > 0
    ? Math.round(allRatings.reduce((s, r) => s + r, 0) / allRatings.length)
    : 72;

  // If overall avg < 65 there's too little data to derive meaningful values
  // — keep existing if present, else return null
  if (allRatings.length < 6 || overallAvg < 65) {
    return null; // can't derive reliably
  }

  let atk = deptAvg(groups.atk) ?? (overallAvg + 1);
  let mid = deptAvg(groups.mid) ?? overallAvg;
  let def = deptAvg(groups.def) ?? (overallAvg - 1);
  let gk  = deptAvg(groups.gk)  ?? (overallAvg - 2);

  // If ALL_SAME existing ratings with avg ≥ 70 but we have no dept breakdown,
  // apply small variance so they're not identical
  if (existingRatings) {
    const vals = Object.values(existingRatings);
    const allSame = vals.every(v => v === vals[0]);
    if (allSame && vals[0] >= 70 && allRatings.length < 6) {
      const base = vals[0];
      // Give slight natural variance based on the base stats
      return {
        attack:      Math.min(95, base + 2),
        midfield:    Math.min(95, base),
        defense:     Math.min(95, base - 1),
        goalkeeping: Math.min(95, base - 2),
      };
    }
  }

  const clamp = (v, lo = 65, hi = 95) => Math.max(lo, Math.min(hi, Math.round(v)));
  return {
    attack:      clamp(atk),
    midfield:    clamp(mid),
    defense:     clamp(def),
    goalkeeping: clamp(gk),
  };
}

function avgRatings(r) {
  if (!r) return 0;
  return (r.attack + r.midfield + r.defense + r.goalkeeping) / 4;
}

function isAllSame(r) {
  if (!r) return false;
  const vals = [r.attack, r.midfield, r.defense, r.goalkeeping];
  return vals.every(v => v === vals[0]);
}

function needsFix(r) {
  if (!r) return true;                         // NO_SEASON_RATINGS
  if (avgRatings(r) < 65) return true;         // RATINGS_TOO_LOW
  if (isAllSame(r) && r.attack < 65) return true; // ALL_SAME + too low
  if (isAllSame(r)) return true;               // ALL_SAME at any level
  return false;
}

// Teams that should NOT be auto-fixed (manually curated all-time XIs, OK as-is)
const SKIP_TEAMS = new Set([
  'america-historica', 'europa-historica', 'best-xi-history',
]);

let fixedCount  = 0;
let skippedCount = 0;
let noDataCount  = 0;

const squadFiles = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json'));

for (const file of squadFiles) {
  const slug   = file.replace('.json', '');
  if (SKIP_TEAMS.has(slug)) { skippedCount++; continue; }

  const filePath = path.join(SQUADS_DIR, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[SKIP] ${file}: parse error`);
    continue;
  }

  if (!data.seasons || typeof data.seasons !== 'object') continue;

  let dirty = false;

  for (const year of Object.keys(data.seasons)) {
    const season = data.seasons[year];
    if (!season) continue;

    const existing = season.ratings || null;
    if (!needsFix(existing)) continue;

    // Skip special all-time entries that are correct
    if (year === 'all-time' && existing && avgRatings(existing) >= 90) {
      continue;
    }

    const derived = computeRatings(season.players, existing);

    if (!derived) {
      // Could not derive; apply generic variance to ALL_SAME if needed
      if (existing && isAllSame(existing) && existing.attack >= 70) {
        const base = existing.attack;
        data.seasons[year].ratings = {
          attack:      Math.min(95, base + 2),
          midfield:    Math.min(95, base),
          defense:     Math.min(95, base - 1),
          goalkeeping: Math.min(95, base - 2),
        };
        console.log(`[VAR] ${slug}|${year}: all-same ${base} → ${JSON.stringify(data.seasons[year].ratings)}`);
        dirty = true;
        fixedCount++;
      } else {
        // Cannot determine good value - leave for manual fix
        noDataCount++;
      }
      continue;
    }

    data.seasons[year].ratings = derived;
    console.log(`[FIX] ${slug}|${year}: ${JSON.stringify(existing)} → ${JSON.stringify(derived)}`);
    dirty = true;
    fixedCount++;
  }

  if (dirty) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

console.log(`\n=== Done: ${fixedCount} seasons fixed, ${noDataCount} no-data skipped, ${skippedCount} intentionally skipped ===`);
