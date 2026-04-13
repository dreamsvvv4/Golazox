/**
 * _verify_league_standings.js
 * READ-ONLY — compara los equipos en squads-meta.json con los que
 * están actualmente en cada liga según football-data.org.
 * NO modifica ningún archivo.
 *
 * Uso: node _verify_league_standings.js
 * Requiere: FOOTBALL_DATA_API_KEY en .env
 */
'use strict';

require('dotenv').config();
const fetch = require('node-fetch');
const fs    = require('fs');
const path  = require('path');

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) {
  console.error('❌ Falta FOOTBALL_DATA_API_KEY en .env');
  console.error('   Regístrate gratis en https://www.football-data.org/client/register');
  process.exit(1);
}

// Ligas a verificar: código API → grupo en squads-meta
const LEAGUES = [
  { code: 'PD',  group: '🇪🇸 La Liga',            name: 'La Liga'        },
  { code: 'PL',  group: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',  name: 'Premier League' },
  { code: 'BL1', group: '🇩🇪 Bundesliga',          name: 'Bundesliga'     },
  { code: 'SA',  group: '🇮🇹 Serie A',              name: 'Serie A'        },
  { code: 'FL1', group: '🇫🇷 Ligue 1',              name: 'Ligue 1'        },
  { code: 'DED', group: '🇳🇱 Eredivisie',           name: 'Eredivisie'     },
  { code: 'ELC', group: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',    name: 'Championship'   },
  { code: 'PPL', group: '🇵🇹 Liga Portugal',        name: 'Liga Portugal'  },
];

// Cargar equipos locales por grupo
function loadLocalTeams() {
  const metaRaw = fs.readFileSync(path.join(__dirname, 'squads-meta.json'), 'utf8').replace(/^\uFEFF/, '');
  const meta = JSON.parse(metaRaw);
  const dir = path.join(__dirname, 'squads');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

  const byGroup = {};
  for (const f of files) {
    const slug = f.replace('.json', '');
    const raw = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '');
    let d; try { d = JSON.parse(raw); } catch (e) { continue; }
    const m = meta[slug] || {};
    const group = m.group || d.group || '';
    const badge = m.badgeLocalPath || d.badgeLocalPath || '';
    if (!badge || badge.includes('_placeholder')) continue; // hidden
    if (!byGroup[group]) byGroup[group] = [];
    byGroup[group].push({ slug, nameEn: m.nameEn || d.name || slug });
  }
  return byGroup;
}

async function fetchStandings(leagueCode) {
  const url = `https://api.football-data.org/v4/competitions/${leagueCode}/standings`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} for ${leagueCode}: ${txt.slice(0, 100)}`);
  }
  const json = await res.json();
  // standings[0] = total standings (home+away combined)
  const table = json.standings?.find(s => s.type === 'TOTAL') || json.standings?.[0];
  if (!table) throw new Error(`No standings data for ${leagueCode}`);
  return table.table.map(row => ({
    pos: row.position,
    name: row.team.name,
    shortName: row.team.shortName,
    tla: row.team.tla,
  }));
}

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  const localTeams = loadLocalTeams();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  VERIFICACIÓN DE LIGAS — football-data.org vs local');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const league of LEAGUES) {
    console.log(`\n── ${league.name} (${league.code}) ──`);

    let apiTeams;
    try {
      apiTeams = await fetchStandings(league.code);
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      // Rate limit: wait and continue
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const local = localTeams[league.group] || [];
    const localNames = local.map(t => normalize(t.nameEn));
    const localSlugs = local.map(t => t.slug);

    const apiNames = apiTeams.map(t => ({
      ...t,
      norm: normalize(t.name),
      normShort: normalize(t.shortName || ''),
    }));

    // Find API teams NOT in local
    const missing = apiTeams.filter(at => {
      const n = normalize(at.name);
      const s = normalize(at.shortName || '');
      return !localNames.some(ln => ln.includes(n) || n.includes(ln) || (s && (ln.includes(s) || s.includes(ln))));
    });

    // Find local teams NOT in API
    const extra = local.filter(lt => {
      const n = normalize(lt.nameEn);
      return !apiTeams.some(at => {
        const an = normalize(at.name);
        const as = normalize(at.shortName || '');
        return an.includes(n) || n.includes(an) || (as && (n.includes(as) || as.includes(n)));
      });
    });

    console.log(`  API: ${apiTeams.length} equipos | Local: ${local.length} equipos`);
    if (missing.length === 0 && extra.length === 0) {
      console.log('  ✅ Todo coincide perfectamente');
    } else {
      if (missing.length > 0) {
        console.log(`  ❗ En API pero NO en local (${missing.length}):`);
        missing.forEach(t => console.log(`     ${t.pos}. ${t.name} (${t.tla})`));
      }
      if (extra.length > 0) {
        console.log(`  ⚠️  En local pero NO en API (${extra.length}) — puede ser relegado/historia:`);
        extra.forEach(t => console.log(`     ${t.slug} (${t.nameEn})`));
      }
    }

    // Rate limit: 10 req/min free tier → esperar 7s entre llamadas
    await new Promise(r => setTimeout(r, 7000));
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  FIN — sin cambios realizados');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
