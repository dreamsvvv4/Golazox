'use strict';

/**
 * download_badges.js — Descargar todos los escudos de equipos cacheados
 * ═══════════════════════════════════════════════════════════════════════
 * Lee todos los squads/*.json, busca el escudo en TheSportsDB para cada
 * equipo y lo guarda en public/img/badges/{slug}.{ext}.
 * El valor badgeLocalPath se persiste en el fichero del equipo.
 *
 * USO:
 *   node download_badges.js                 # Todos (salta los ya descargados)
 *   node download_badges.js --force         # Re-descarga incluso los existentes
 *   node download_badges.js --delay 2000    # Delay entre peticiones (ms, default 1500)
 *   node download_badges.js --dry-run       # Vista previa sin descargar
 *   node download_badges.js --extended      # Top 50 selecciones + Top 100 clubes históricos
 *   node download_badges.js --extended --dry-run  # Vista previa del listado extendido
 */

const fs   = require('fs');
const path = require('path');
const { fetchTeamBadge } = require('./lookup');
const { getLocalBadgePath, resolveClub } = require('./transfermarkt');

// ── Parseo de argumentos ───────────────────────────────────────
const args    = process.argv.slice(2);
const getArg  = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const hasFlag = (f) => args.includes(f);

const DRY_RUN  = hasFlag('--dry-run');
const FORCE    = hasFlag('--force');
const EXTENDED = hasFlag('--extended');
const DELAY    = parseInt(getArg('--delay') || '1500', 10);

const SQUADS_DIR = path.join(__dirname, 'squads');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Slug helper (mirrors _resolveSlug in lookup.js) ────────────
function _slugForName(name) {
  const club = resolveClub(name);
  if (club && club.slug) return club.slug;
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── Listas para --extended ─────────────────────────────────────
const EXTENDED_NATIONALS = [
  // Europa
  'Morocco', 'Uruguay', 'Colombia', 'United States', 'Mexico', 'Senegal',
  'Ukraine', 'Serbia', 'Hungary', 'Turkey', 'Ecuador', 'Japan', 'South Korea',
  'Wales', 'Chile', 'Peru', 'Cameroon', 'Nigeria', 'Ghana', 'Algeria',
  'Ivory Coast', 'Egypt', 'Iran', 'Australia', 'Saudi Arabia', 'Canada',
  'Paraguay', 'Venezuela', 'Slovakia', 'Slovenia', 'Norway', 'Romania',
  'Republic of Ireland', 'Russia', 'Finland', 'Iceland', 'Bosnia',
  'Albania', 'Northern Ireland', 'Tunisia', 'Costa Rica', 'Honduras', 'Panama',
];

const EXTENDED_CLUBS = [
  // ══ PREMIER LEAGUE (actual + histórico) ══════════════════════
  'Tottenham Hotspur', 'Everton', 'Newcastle United', 'West Ham United',
  'Fulham', 'Crystal Palace', 'Brentford', 'Bournemouth', 'Burnley',
  'Sheffield United', 'Watford', 'Leicester City', 'Leeds United',
  'Wolverhampton Wanderers', 'Brighton', 'Blackburn Rovers',
  'Middlesbrough', 'Ipswich Town', 'Derby County', 'Sunderland',
  'Stoke City', 'Coventry City', 'Millwall', 'Swansea City',
  // ══ BUNDESLIGA (actual + histórico) ═════════════════════════
  'RB Leipzig', 'Schalke 04', 'Eintracht Frankfurt', 'Wolfsburg',
  'Werder Bremen', 'Union Berlin', 'Augsburg', 'Mainz 05', 'Freiburg',
  'Hoffenheim', 'Kaiserslautern', 'Hamburger SV', 'Hertha Berlin',
  'Holstein Kiel', 'St. Pauli', 'Heidenheim', 'Hannover 96', 'Darmstadt',
  // ══ SERIE A (actual + histórico) ════════════════════════════
  'Lazio', 'Atalanta', 'Fiorentina', 'Torino',
  'Bologna', 'Genoa', 'Monza', 'Hellas Verona', 'Udinese',
  'Lecce', 'Empoli', 'Sampdoria', 'Parma', 'Cagliari', 'Salernitana',
  // ══ LIGUE 1 (actual + histórico) ════════════════════════════
  'Lens', 'Rennes', 'Toulouse', 'Brest', 'Montpellier', 'Strasbourg',
  'Stade Reims', 'Nantes', 'Bordeaux', 'Lille', 'Nice', 'Saint-Etienne',
  'Angers', 'Lorient',
  // ══ LA LIGA + SEGUNDA ════════════════════════════════════════
  'Villarreal', 'Deportivo', 'Espanyol', 'Celta Vigo', 'Mallorca',
  'Osasuna', 'Girona', 'Alaves',
  // ══ CHAMPIONS LEAGUE (participantes recientes) ═══════════════
  'Rangers', 'Anderlecht', 'Club Brugge', 'AZ Alkmaar', 'Braga',
  'Galatasaray', 'Fenerbahce', 'Besiktas', 'Red Star Belgrade', 'Partizan',
  'Young Boys', 'Red Bull Salzburg', 'Shakhtar Donetsk',
  'FC Copenhagen', 'Dinamo Zagreb',
  // ══ RESTO EUROPA ════════════════════════════════════════════
  'Dynamo Kyiv', 'Spartak Moscow', 'Zenit St Petersburg', 'CSKA Moscow',
  'Steaua Bucharest', 'Rapid Vienna',
  // ══ SAUDI PRO LEAGUE ════════════════════════════════════════
  'Al-Hilal', 'Al-Nassr', 'Al-Ittihad', 'Al-Ahli',
  'Al-Shabab', 'Al-Fateh', 'Al-Ettifaq', 'Al-Qadsiah',
  // ══ MLS ═════════════════════════════════════════════════════
  'LA Galaxy', 'LAFC', 'Seattle Sounders', 'Portland Timbers',
  'Atlanta United', 'Inter Miami', 'New York City FC', 'New York Red Bulls',
  'Columbus Crew', 'Toronto FC', 'Chicago Fire', 'Philadelphia Union',
  'FC Dallas', 'Sporting Kansas City', 'New England Revolution',
  'Austin FC', 'Real Salt Lake', 'Vancouver Whitecaps', 'CF Montreal',
  // ══ SUDAMÉRICA ══════════════════════════════════════════════
  'Boca Juniors', 'River Plate', 'Santos', 'Flamengo', 'Fluminense',
  'Corinthians', 'Sao Paulo FC', 'Internacional', 'Gremio', 'Cruzeiro',
  'Atletico Mineiro', 'Palmeiras', 'Botafogo', 'Vasco da Gama',
  'Nacional', 'Peñarol', 'Colo-Colo',
  'Estudiantes', 'Independiente', 'San Lorenzo', 'Racing Club',
  // ══ MÉXICO / CONCACAF ════════════════════════════════════════
  'Tigres UANL', 'Club America', 'Guadalajara', 'Cruz Azul', 'Monterrey',
];

// ─────────────────────────────────────────────────────────────
// Recoger todos los slugs y el nombre canónico de cada equipo
// ─────────────────────────────────────────────────────────────
function loadAllTeams() {
  const files = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('.'));
  const teams = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SQUADS_DIR, file), 'utf8'));
      // Use the stored name first; fall back to slug-derived name
      const slug = data.slug || file.replace('.json', '');
      const name = data.name || slug.replace(/-/g, ' ');
      teams.push({ slug, name, hasBadge: !!data.badgeLocalPath });
    } catch (_) { /* skip malformed files */ }
  }
  return teams.sort((a, b) => a.slug.localeCompare(b.slug));
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  // ── Modo extendido (-extended): top 50 selecciones + top 100 clubes ──
  if (EXTENDED) {
    const allNames = [...new Set([...EXTENDED_NATIONALS, ...EXTENDED_CLUBS])];
    const toDownload = [], skipped = [];
    for (const name of allNames) {
      if (!FORCE && getLocalBadgePath(_slugForName(name))) skipped.push(name);
      else toDownload.push(name);
    }
    const pad = String(toDownload.length).length;
    console.log(`\n🌍  Descarga extendida de escudos`);
    console.log(`   Total         : ${allNames.length}`);
    console.log(`   Ya descargados: ${skipped.length}`);
    console.log(`   Pendientes    : ${toDownload.length}`);
    if (DRY_RUN) console.log(`   Modo          : DRY-RUN\n`);
    else         console.log(`   Delay         : ${DELAY} ms\n`);

    let ok = 0, failed = 0;
    for (let i = 0; i < toDownload.length; i++) {
      const name = toDownload[i];
      const prefix = `[${String(i + 1).padStart(pad, ' ')}/${toDownload.length}]`;
      if (DRY_RUN) { console.log(`${prefix} PENDIENTE  ${name}`); continue; }
      try {
        const localPath = await fetchTeamBadge(name);
        if (localPath) { console.log(`${prefix} ✅  ${name}  →  ${localPath}`); ok++; }
        else           { console.log(`${prefix} ⚠️   ${name}  —  no encontrado`); failed++; }
      } catch (err) {
        console.log(`${prefix} ❌  ${name}  —  ${err.message}`); failed++;
      }
      if (i < toDownload.length - 1) await sleep(DELAY);
    }
    console.log(`\n─────────────────────────────────────────`);
    console.log(`  OK      : ${ok}`);
    console.log(`  Fallidos: ${failed}`);
    console.log(`  Ya tenían: ${skipped.length}`);
    console.log(`─────────────────────────────────────────\n`);
    return;
  }

  // ── Modo normal: equipos en squads/ ───────────────────────────
  const teams = loadAllTeams();
  const toProcess = FORCE
    ? teams
    : teams.filter(t => !t.hasBadge && !getLocalBadgePath(t.slug));

  const total   = teams.length;
  const skip    = total - toProcess.length;
  const pending = toProcess.length;

  console.log(`\n🏟  Descarga de escudos`);
  console.log(`   Total equipos : ${total}`);
  console.log(`   Ya descargados: ${skip}`);
  console.log(`   Pendientes    : ${pending}`);
  if (DRY_RUN) console.log(`   Modo          : DRY-RUN (sin descarga)\n`);
  else         console.log(`   Delay         : ${DELAY} ms entre peticiones\n`);

  if (pending === 0) {
    console.log('✅  Todos los escudos ya están en local. Nada que descargar.');
    return;
  }

  let ok = 0, failed = 0, skipped = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const { slug, name } = toProcess[i];
    const prefix = `[${String(i + 1).padStart(toProcess.length.toString().length, ' ')}/${pending}]`;

    if (DRY_RUN) {
      console.log(`${prefix} PENDIENTE  ${slug}  (${name})`);
      continue;
    }

    try {
      const localPath = await fetchTeamBadge(name);
      if (localPath) {
        console.log(`${prefix} ✅  ${slug}  →  ${localPath}`);
        ok++;
      } else {
        console.log(`${prefix} ⚠️   ${slug}  —  no encontrado en TheSportsDB`);
        failed++;
      }
    } catch (err) {
      console.log(`${prefix} ❌  ${slug}  —  error: ${err.message}`);
      failed++;
    }

    if (i < toProcess.length - 1) await sleep(DELAY);
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  OK      : ${ok}`);
  console.log(`  Fallidos: ${failed}`);
  console.log(`  Ya tenían: ${skip}`);
  console.log(`─────────────────────────────────────────\n`);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
