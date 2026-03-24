'use strict';

/**
 * seed_squads.js — Pre-poblar la base de datos local de alineaciones
 * ════════════════════════════════════════════════════════════════════
 * Descarga alineaciones de Transfermarkt de forma controlada y las
 * guarda en squads/{slug}.json, evitando peticiones duplicadas y
 * bans por rate-limiting.
 *
 * USO:
 *   node seed_squads.js                     # Todo (salta los cacheados)
 *   node seed_squads.js --batch national    # Solo selecciones
 *   node seed_squads.js --batch clubs       # Solo clubes
 *   node seed_squads.js --dry-run           # Vista previa sin descargar
 *   node seed_squads.js --delay 3000        # Delay entre peticiones (ms, default 2500)
 *   node seed_squads.js --team "Spain"      # Un equipo, todos sus años
 *   node seed_squads.js --from 50           # Reanudar desde el ítem Nº50
 *   node seed_squads.js --only-new          # Solo mostrar las descargas nuevas
 */

const path = require('path');
const fs   = require('fs');
const { fetchTransfermarktSquad, resolveClub, _loadTeamFile } = require('./transfermarkt');

// ── Parseo de argumentos ───────────────────────────────────────
const args     = process.argv.slice(2);
const getArg   = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null; };
const hasFlag  = (f) => args.includes(f);

const DRY_RUN  = hasFlag('--dry-run');
const DELAY    = parseInt(getArg('--delay')   || '2500', 10);
const BATCH    = getArg('--batch')            || 'all';
const ONLY_TEAM= getArg('--team');
const FROM     = parseInt(getArg('--from')    || '0', 10);
const ONLY_NEW = hasFlag('--only-new');

// ── Años por competición ───────────────────────────────────────
// (año de inicio de temporada, ej. 2010 = temporada 2010/11)
const WORLD_CUPS    = [1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022];
const EUROS         = [1996,2000,2004,2008,2012,2016,2020];
const COPA_AMERICA  = [1975,1979,1983,1987,1991,1993,1995,1997,1999,2001,2004,2007,2011,2015,2016,2019,2021];
const AFCON         = [1994,1996,1998,2000,2002,2004,2006,2008,2010,2012,2013,2015,2017,2019,2021,2023];

const uniq = (...arrs) => [...new Set(arrs.flat())].sort((a, b) => a - b);

// ── Catálogo de selecciones ────────────────────────────────────
const NATIONAL_TEAMS = [
  // ── Europa ── Mundial + Eurocopa
  ...['spain','germany','france','italy','england','netherlands','portugal',
      'belgium','croatia','czech republic','russia','poland','denmark',
      'sweden','switzerland','austria','scotland','wales','turkey','greece',
      'serbia','romania','hungary','slovakia','slovenia','iceland','ireland',
      'northern ireland','ukraine','norway','finland','albania','bosnia'].map(t => ({
    team: t,
    years: uniq(WORLD_CUPS, EUROS),
    region: 'Europa',
  })),

  // ── América ── Mundial + Copa América
  ...['argentina','brasil','uruguay','colombia','chile','ecuador','peru',
      'paraguay','venezuela','mexico','usa','costa rica','canada'].map(t => ({
    team: t,
    years: uniq(WORLD_CUPS, COPA_AMERICA),
    region: 'América',
  })),

  // ── África ── Mundial + Copa África
  ...['senegal','cameroon','ghana','nigeria','morocco','egypt',
      'ivory coast','south africa','algeria','tunisia','mali'].map(t => ({
    team: t,
    years: uniq(WORLD_CUPS, AFCON),
    region: 'África',
  })),

  // ── Asia / Oceanía ── Mundial
  ...['japan','south korea','australia','saudi arabia','iran'].map(t => ({
    team: t,
    years: WORLD_CUPS,
    region: 'Asia/Oceanía',
  })),
];

// ── Catálogo de clubes (eras míticas) ─────────────────────────
const CLUB_TEAMS = [
  // España
  { team: 'Real Madrid',     years: [1956,1960,1966,1976,1980,1986,1998,2002,2006,2012,2013,2014,2015,2016,2017,2022], region: 'La Liga' },
  { team: 'Barcelona',       years: [1985,1992,1995,1999,2006,2009,2010,2011,2014,2015], region: 'La Liga' },
  { team: 'Atletico Madrid', years: [1974,1996,2004,2012,2013,2015,2016,2020],           region: 'La Liga' },
  { team: 'Valencia',        years: [1999,2000,2001,2003],                               region: 'La Liga' },
  { team: 'Deportivo',       years: [1999,2000,2003],                                    region: 'La Liga' },
  { team: 'Sevilla',         years: [2006,2015,2016,2020],                               region: 'La Liga' },

  // Italia
  { team: 'Juventus',        years: [1983,1985,1995,1996,1997,2002,2012,2015,2017,2018], region: 'Serie A' },
  { team: 'AC Milan',        years: [1988,1989,1993,1994,2002,2006],                     region: 'Serie A' },
  { team: 'Inter Milan',     years: [1964,1965,1988,1989,2004,2009,2010],                region: 'Serie A' },
  { team: 'Roma',            years: [2001,2006],                                         region: 'Serie A' },
  { team: 'Napoli',          years: [1986,1987,1988,2017,2022],                          region: 'Serie A' },

  // Alemania
  { team: 'Bayern Munich',   years: [1974,1975,1976,1999,2000,2001,2012,2013,2019,2020], region: 'Bundesliga' },
  { team: 'Borussia Dortmund', years: [1996,1997,2011,2012],                             region: 'Bundesliga' },
  { team: 'Bayer Leverkusen', years: [2002,2023],                                        region: 'Bundesliga' },

  // Inglaterra
  { team: 'Manchester United', years: [1994,1998,1999,2002,2007,2008],                   region: 'Premier League' },
  { team: 'Arsenal',           years: [2001,2002,2003,2004],                             region: 'Premier League' },
  { team: 'Liverpool',         years: [1977,1978,1984,2004,2008,2019],                   region: 'Premier League' },
  { team: 'Chelsea',           years: [2004,2005,2011,2014],                             region: 'Premier League' },
  { team: 'Manchester City',   years: [2011,2012,2018,2019,2021,2022,2023],              region: 'Premier League' },

  // Francia
  { team: 'Paris Saint-Germain', years: [2012,2015,2016,2019,2020],                      region: 'Ligue 1' },
  { team: 'Lyon',               years: [2004,2005,2006,2007,2008],                       region: 'Ligue 1' },
  { team: 'Marseille',          years: [1992,1993],                                      region: 'Ligue 1' },
  { team: 'Monaco',             years: [2003,2016],                                      region: 'Ligue 1' },

  // Países Bajos
  { team: 'Ajax',               years: [1971,1972,1973,1994,1995,2018],                  region: 'Eredivisie' },
  { team: 'PSV',                years: [1987,1988,1991,1997,2005,2006],                  region: 'Eredivisie' },
  { team: 'Feyenoord',          years: [1969,1982,2001,2016],                            region: 'Eredivisie' },

  // Portugal
  { team: 'Porto',              years: [1987,1994,2003,2004],                            region: 'Primeira Liga' },
  { team: 'Benfica',            years: [1961,1962,1987,2014,2015,2022],                  region: 'Primeira Liga' },
  { team: 'Sporting CP',        years: [1999,2001,2021],                                 region: 'Primeira Liga' },

  // Escocia
  { team: 'Celtic',             years: [1967,1969,1970],                                 region: 'Escocia' },
];

// ── Construir cola de descargas ────────────────────────────────
function buildQueue() {
  let catalog = [];

  // Clubs first: easier to verify, not rate-limited as aggressively
  if (BATCH === 'clubs'    || BATCH === 'all') catalog.push(...CLUB_TEAMS);
  if (BATCH === 'national' || BATCH === 'all') catalog.push(...NATIONAL_TEAMS);

  if (ONLY_TEAM) {
    const key = ONLY_TEAM.toLowerCase();
    catalog = catalog.filter(c => c.team.toLowerCase() === key);
  }

  const queue = [];
  for (const { team, years, region } of catalog) {
    for (const year of years) {
      queue.push({ team, year: String(year), region: region || '' });
    }
  }
  return queue;
}

// ── Utilidades ────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function eta(done, total, elapsedMs, downloadsOnly) {
  if (downloadsOnly === 0) return '?';
  // ETA based on actual download time only (cached items are instant)
  const msPerDownload = elapsedMs / Math.max(downloadsOnly, 1);
  const remaining = (total - done);
  return formatTime(msPerDownload * remaining * 0.3); // rough estimate
}

// ── Comprobar si ya está en caché sin hacer petición de red ───
const SQUADS_DIR = path.join(__dirname, 'squads');

function isCachedLocally(team, year) {
  const club = resolveClub(team);
  const slug = club?.slug || team.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const data = _loadTeamFile(slug);
  return !!(data.seasons && data.seasons[String(year)]);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const queue = buildQueue();
  const total  = queue.length;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         ⚽  Squad Seeder — Base de datos local           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Batch:   ${BATCH}  |  Delay: ${DELAY}ms  |  Dry-run: ${DRY_RUN}`);
  if (ONLY_TEAM) console.log(`  Equipo:  "${ONLY_TEAM}"`);
  if (FROM > 0)  console.log(`  Desde:   ítem #${FROM}`);
  console.log(`  Total:   ${total} combinaciones equipo+año en cola`);
  console.log('─'.repeat(62));

  if (DRY_RUN) {
    const byRegion = {};
    for (const { team, year, region } of queue) {
      (byRegion[region] = byRegion[region] || []).push(`${team} ${year}`);
    }
    for (const [reg, items] of Object.entries(byRegion)) {
      console.log(`\n  📍 ${reg} (${items.length} combos):`);
      // Show unique teams
      const teams = [...new Set(items.map(i => i.split(' ')[0]))];
      console.log('    ' + teams.join(', '));
    }
    console.log(`\n  Total: ${total} descargas posibles (las cacheadas serán ≈ 0ms)`);
    return;
  }

  let downloaded = 0, cached = 0, failed = 0, skipped = 0;
  const startTime = Date.now();
  let lastRegion  = '';
  let consecutiveFails = 0; // track rate-limiting
  const PROGRESS_FILE = path.join(SQUADS_DIR, '.seed-progress.json');

  function writeProgress(i, currentTeam, currentYear) {
    try {
      const elapsed = Date.now() - startTime;
      const done = i + 1;
      const remaining = total - done;
      const msPerDl = downloaded > 0 ? elapsed / downloaded : DELAY;
      const etaSec  = Math.round((remaining * msPerDl) / 1000);
      const etaStr  = etaSec > 3600
        ? `${Math.floor(etaSec/3600)}h ${Math.floor((etaSec%3600)/60)}m`
        : etaSec > 60 ? `${Math.floor(etaSec/60)}m ${etaSec%60}s` : `${etaSec}s`;
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        progreso: `${done}/${total}`,
        porcentaje: `${Math.round((done/total)*100)}%`,
        descargados: downloaded,
        enCache:     cached,
        sinDatos:    failed,
        ahora:       `${currentTeam} ${currentYear}`,
        tiempoTranscurrido: formatTime(elapsed),
        etaRestante: etaStr,
        ultimaActualizacion: new Date().toISOString(),
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  for (let i = 0; i < total; i++) {
    if (i < FROM) { skipped++; continue; }

    const { team, year, region } = queue[i];
    const num    = String(i + 1).padStart(4);
    const pct    = String(Math.round(((i + 1) / total) * 100)).padStart(3);

    // Print region header when it changes
    if (region !== lastRegion) {
      console.log(`\n  📍 ${region}`);
      lastRegion = region;
    }

    // Skip instantly if already on disk — no network call at all
    if (isCachedLocally(team, year)) {
      cached++;
      if (!ONLY_NEW) console.log(`  [${num}/${total}] ${pct}%  💾  ${team.padEnd(22)} ${year}  (en caché)`);
      continue;
    }

    try {
      const t0     = Date.now();
      const result = await fetchTransfermarktSquad(team, year);
      const ms     = Date.now() - t0;

      if (!result) {
        if (!ONLY_NEW) console.log(`  [${num}/${total}] ${pct}%  ⬛  ${team.padEnd(22)} ${year}  — sin datos TM`);
        failed++;
        consecutiveFails++;

        // If we get ≥10 consecutive failures, TM is almost certainly blocking us — abort
        if (consecutiveFails >= 10) {
          console.log(`\n  🚫  ${consecutiveFails} fallos seguidos — TM está bloqueando la IP. Abortando.`);
          console.log(`  💡  Espera unas horas y vuelve a lanzar con --only-new para reanudar.`);
          process.exit(1);
        }

        // Back-off: avoid hammering TM when it's blocking us
        if (consecutiveFails >= 5 && consecutiveFails % 5 === 0) {
          const backoff = Math.min(consecutiveFails * 500, 10000); // up to 10s
          console.log(`  ⚠️  ${consecutiveFails} fallos consecutivos — pausa de ${backoff}ms`);
          await sleep(backoff);
        } else {
          await sleep(800); // short delay even on failures
        }

      } else {
        // Real network download — show GK for spot-checking
        consecutiveFails = 0; // reset on success
        downloaded++;
        const gk     = result.players.find(p => p.position === 'GK');
        const gkName = gk ? gk.name : '(sin GK?)';
        const total2 = result.players.length;
        console.log(`  [${num}/${total}] ${pct}%  ⬇️   ${team.padEnd(22)} ${year}  ${result.formation}  ${total2}j  GK: ${gkName}  (${ms}ms)`);
        // Only throttle after actual network requests
        await sleep(DELAY);
      }

    } catch (e) {
      console.log(`  [${num}/${total}] ${pct}%  ❌  ${team.padEnd(22)} ${year}  ERROR: ${e.message}`);
      failed++;
      await sleep(DELAY); // wait even after errors
    }

    // Write progress file every 5 items
    if (i % 5 === 0) writeProgress(i, team, year);

    // Progress summary every 50 items
    if ((i + 1) % 50 === 0) {
      const elapsed = Date.now() - startTime;
      console.log(`\n  ┄ Progreso: ${downloaded} descargados | ${cached} en caché | ${failed} sin datos | ${formatTime(elapsed)} transcurrido\n`);
    }
  }
  writeProgress(total - 1, 'COMPLETADO', '');

  // ── Resumen final ────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  console.log('\n' + '═'.repeat(62));
  console.log(`  ✅  Completado en ${formatTime(totalMs)}`);
  console.log(`  ⬇️   Nuevas descargas:  ${downloaded}`);
  console.log(`  💾  En caché local:    ${cached}`);
  console.log(`  ⬛  Sin datos en TM:   ${failed}`);
  if (skipped) console.log(`  ⏩  Saltados (--from): ${skipped}`);

  // squads/ summary
  if (fs.existsSync(SQUADS_DIR)) {
    const files = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json'));
    let totalSeasons = 0;
    const teamList   = [];
    files.forEach(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(SQUADS_DIR, f), 'utf8'));
        const n = Object.keys(d.seasons || {}).length;
        totalSeasons += n;
        if (n > 0) teamList.push(`${d.name || d.slug} (${n})`);
      } catch (_) {}
    });
    console.log(`\n  📁 squads/: ${files.length} equipos, ${totalSeasons} temporadas en disco`);
    console.log('  ' + teamList.sort().join(' · '));
  }
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
