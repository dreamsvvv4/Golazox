#!/usr/bin/env node
/**
 * sync-meta.js — Sincroniza squads-meta.json usando list.json como fuente de verdad.
 *
 * Uso:
 *   node sync-meta.js              → muestra diferencias sin modificar nada
 *   node sync-meta.js --apply      → aplica cambios a squads-meta.json
 *   node sync-meta.js --apply --update-dgroup  → también actualiza d.group en los squad JSON
 *
 * Para actualizar al inicio de cada temporada:
 *   1. Edita list.json con los ascendidos/descendidos
 *   2. node sync-meta.js --apply
 *   3. git add squads-meta.json && git commit -m "fix: ligas temporada XXXX" && git push
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const APPLY         = process.argv.includes('--apply');
const UPDATE_DGROUP = process.argv.includes('--update-dgroup');
const AUDIT         = process.argv.includes('--audit');

// ── 1. Group labels ────────────────────────────────────────────────────────────
const GROUP_MAP = {
  'spain.primera_division':   '🇪🇸 La Liga',
  'spain.segunda_division':   '🇪🇸 La Liga 2',
  'england.premier_league':   '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'england.championship':     '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'italy.serie_a':            '🇮🇹 Serie A',
  'italy.serie_b':            '🇮🇹 Serie B',
  'germany.bundesliga':       '🇩🇪 Bundesliga',
  'germany.2_bundesliga':     '🇩🇪 2. Bundesliga',
  'france.ligue_1':           '🇫🇷 Ligue 1',
  'france.ligue_2':           '🇫🇷 Ligue 2',
  'mls':                      '🇺🇸 MLS',
  'saudi_pro_league':         '🇸🇦 Saudi Pro League',
  // Ignorados: world_cup_2026_qualified_selections, champions_league_2025_26
};

// ── 2. Explicit name → slug mapping ───────────────────────────────────────────
// Clave: nombre en minúsculas desde list.json   Valor: slug del archivo squad
// Añade aquí cualquier alias nuevo o equipo con slug distinto al nombre.
const NAME_TO_SLUG = {
  // ─── España — La Liga ───────────────────────────────────────────────────────
  'barcelona':                    'fc-barcelona',
  'real madrid':                  'real-madrid',
  'villarreal':                   'fc-villarreal',
  'atletico madrid':              'atletico-madrid',
  'real betis':                   'real-betis-balompie',
  'celta vigo':                   'celta-vigo',
  'real sociedad':                'real-sociedad-san-sebastian',
  'getafe':                       'fc-getafe',
  'athletic bilbao':              'athletic-club',
  'osasuna':                      'ca-osasuna',
  'espanyol':                     'espanyol-barcelona',
  'valencia':                     'fc-valencia',
  'girona':                       'fc-girona',
  'sevilla':                      'fc-sevilla',
  'alaves':                       'deportivo-alaves',
  'deportivo alaves':             'deportivo-alaves',
  'elche':                        'elche-cf',
  'mallorca':                     'rcd-mallorca',
  'levante':                      'levante-ud',
  'real oviedo':                  'real-oviedo',
  'rayo vallecano':               'rayo-vallecano',
  // ─── España — La Liga 2 ─────────────────────────────────────────────────────
  'albacete':                     'albacete',
  'almeria':                      'ud-almeria',
  'andorra':                      'fc-andorra',
  'burgos':                       'burgos-cf',
  'cadiz':                        'cadiz-cf',
  'castellon':                    'castellon',
  'celta fortuna':                'celta-vigo-b',
  'cordoba':                      'cordoba',
  'cultural leonesa':             'cultural-leonesa',
  'deportivo la coruna':          'rc-deportivo',
  'eibar':                        'sd-eibar',
  'eldense':                      'cd-eldense',
  'granada':                      'granada-cf',
  'huesca':                       'sd-huesca',
  'las palmas':                   'ud-las-palmas',
  'leganes':                      'cd-leganes',
  'malaga':                       'malaga',
  'mirandes':                     'cd-mirandes',
  'racing santander':             'real-racing-club',
  'real zaragoza':                'real-zaragoza',
  'real sociedad b':              'real-sociedad-ii',
  'sabadell':                     'ce-sabadell',
  'sporting gijon':               'sporting-gijon',
  'tenerife':                     'cd-tenerife',
  'valladolid':                   'real-valladolid',
  // ─── Inglaterra — Premier League ────────────────────────────────────────────
  'arsenal':                      'fc-arsenal',
  'aston villa':                  'aston-villa',
  'bournemouth':                  'afc-bournemouth',
  'brentford':                    'fc-brentford',
  'brighton':                     'brighton-hove-albion',
  'burnley':                      'fc-burnley',
  'chelsea':                      'fc-chelsea',
  'crystal palace':               'crystal-palace',
  'everton':                      'fc-everton',
  'fulham':                       'fc-fulham',
  'liverpool':                    'fc-liverpool',
  'manchester city':              'manchester-city',
  'manchester united':            'manchester-united',
  'newcastle united':             'newcastle-united',
  'nottingham forest':            'nottingham-forest',
  'sunderland':                   'sunderland',
  'tottenham hotspur':            'tottenham-hotspur',
  'west ham united':              'west-ham-united',
  'wolverhampton wanderers':      'wolverhampton-wanderers',
  'leeds united':                 'leeds-united',
  // ─── Inglaterra — Championship ──────────────────────────────────────────────
  'birmingham city':              'birmingham-city',
  'blackburn rovers':             'blackburn-rovers',
  'bolton wanderers':             'bolton-wanderers',
  'bristol city':                 'bristol-city',
  'charlton athletic':            'charlton-athletic',
  'coventry city':                'coventry-city',
  'derby county':                 'derby-county',
  'hull city':                    'hull-city',
  'ipswich town':                 'ipswich-town',
  'leicester city':               'leicester-city',
  'lincoln city':                 'lincoln-city',
  'middlesbrough':                'middlesbrough',
  'millwall':                     'millwall',
  'norwich city':                 'norwich-city',
  'oxford united':                'oxford-united',
  'portsmouth':                   'portsmouth-fc',
  'preston north end':            'preston-north-end',
  'queens park rangers':          'queens-park-rangers',
  'qpr':                          'queens-park-rangers',
  'sheffield united':             'sheffield-united',
  'southampton':                  'southampton-fc',
  'stoke city':                   'stoke-city',
  'swansea city':                 'swansea-city',
  'watford':                      'fc-watford',
  'west bromwich albion':         'west-bromwich-albion',
  // ─── Italia — Serie A ───────────────────────────────────────────────────────
  'atalanta':                     'atalanta-bc',
  'bologna':                      'bologna',
  'cagliari':                     'cagliari',
  'como':                         'como-1907',
  'cremonese':                    'cremonese',
  'fiorentina':                   'ac-florenz',
  'genoa':                        'cfc-genua',
  'inter':                        'inter-mailand',
  'juventus':                     'juventus-turin',
  'lazio':                        'lazio-rom',
  'lecce':                        'us-lecce',
  'milan':                        'ac-mailand',
  'napoli':                       'ssc-neapel',
  'parma':                        'parma',
  'pisa':                         'pisa',
  'roma':                         'as-rom',
  'sassuolo':                     'sassuolo',
  'torino':                       'fc-turin',
  'udinese':                      'udinese-calcio',
  'verona':                       'hellas-verona',
  // ─── Italia — Serie B ───────────────────────────────────────────────────────
  'arezzo':                       'ss-arezzo',
  'ascoli':                       'ascoli-calcio',
  'avellino':                     'avellino',
  'bari':                         'bari',
  'benevento':                    'benevento-calcio',
  'carrarese':                    'carrarese',
  'catanzaro':                    'catanzaro',
  'cesena':                       'cesena',
  'empoli':                       'fc-empoli',
  'entella':                      'virtus-entella',
  'virtus entella':               'virtus-entella',
  'frosinone':                    'frosinone',
  'juve stabia':                  'juve-stabia',
  'mantova':                      'mantova',
  'modena':                       'modena',
  'monza':                        'ac-monza',
  'padova':                       'padova',
  'palermo':                      'palermo',
  'pescara':                      'pescara',
  'reggiana':                     'reggiana',
  'sampdoria':                    'sampdoria',
  'spezia':                       'spezia',
  'sudtirol':                     'fc-sudtirol',
  'venezia':                      'venezia-fc',
  'vicenza':                      'lr-vicenza-virtus',
  // ─── Alemania — Bundesliga ──────────────────────────────────────────────────
  'augsburg':                     'fc-augsburg',
  'bayer leverkusen':             'bayer-04-leverkusen',
  'bayern munich':                'fc-bayern-munchen',
  'borussia dortmund':            'borussia-dortmund',
  'borussia monchengladbach':     'borussia-monchengladbach',
  'borussia mönchengladbach':     'borussia-monchengladbach',
  'eintracht frankfurt':          'eintracht-frankfurt',
  'freiburg':                     'freiburg',
  'heidenheim':                   'heidenheim',
  'hoffenheim':                   'tsg-1899-hoffenheim',
  'cologne':                      '1-fc-koln',
  'köln':                         '1-fc-koln',
  'mainz 05':                     '1-fsv-mainz-05',
  'rb leipzig':                   'rasenballsport-leipzig',
  'st. pauli':                    'fc-st-pauli',
  'st pauli':                     'fc-st-pauli',
  'stuttgart':                    'vfb-stuttgart',
  'union berlin':                 '1-fc-union-berlin',
  'werder bremen':                'sv-werder-bremen',
  'wolfsburg':                    'vfl-wolfsburg',
  'hamburger sv':                 'hamburger-sv',
  // ─── Alemania — 2. Bundesliga ───────────────────────────────────────────────
  'arminia bielefeld':            'arminia-bielefeld',
  'darmstadt 98':                 'darmstadt',
  'dynamo dresden':               'dynamo-dresden',
  'eintracht braunschweig':       'eintracht-braunschweig',
  'energie cottbus':              'fc-energie-cottbus',
  'elversberg':                   'sv-elversberg',
  'fortuna dusseldorf':           'fortuna-dusseldorf',
  'greuther furth':               'greuther-furth',
  'hannover 96':                  'hannover-96',
  'hertha bsc':                   'hertha-bsc',
  'holstein kiel':                'holstein-kiel',
  'karlsruher sc':                'karlsruher-sc',
  'kaiserslautern':               'kaiserslautern',
  'magdeburg':                    '1-fc-magdeburg',
  'nurnberg':                     '1-fc-nurnberg',
  'vfl osnabruck':                'vfl-osnabruck',
  'paderborn':                    'sc-paderborn-07',
  'schalke 04':                   'fc-schalke-04',
  'preussen munster':             'preussen-munster',
  'vfl bochum':                   'vfl-bochum',
  // ─── Francia — Ligue 1 ──────────────────────────────────────────────────────
  'angers':                       'angers',
  'auxerre':                      'auxerre',
  'brest':                        'stade-brest-29',
  'le havre':                     'le-havre',
  'le mans':                      'le-mans-fc',
  'lens':                         'rc-lens',
  'lille':                        'losc-lille',
  'lyon':                         'olympique-lyon',
  'marseille':                    'olympique-marseille',
  'monaco':                       'as-monaco',
  'montpellier':                  'montpellier-hsc',
  'nantes':                       'nantes',
  'nice':                         'ogc-nice',
  'paris saint germain':          'fc-paris-saint-germain',
  'rennes':                       'fc-stade-rennes',
  'saint etienne':                'as-saint-etienne',
  'strasbourg':                   'rc-strasbourg',
  'toulouse':                     'fc-toulouse',
  'troyes':                       'es-troyes-ac',
  // ─── Francia — Ligue 2 ──────────────────────────────────────────────────────
  'annecy':                       'fc-annecy',
  'boulogne':                     'us-boulogne',
  'caen':                         'caen',
  'clermont':                     'clermont-foot-63',
  'dijon':                        'dijon-fco',
  'dunkerque':                    'usl-dunkerque',
  'grenoble':                     'grenoble-foot-38',
  'guingamp':                     'guingamp',
  'laval':                        'stade-laval',
  'lorient':                      'fc-lorient',
  'metz':                         'fc-metz',
  'nancy':                        'as-nancy-lorraine',
  'pau':                          'pau-fc',
  'red star':                     'red-star-fc',
  'reims':                        'stade-reims',
  'rodez':                        'rodez-af',
  'sochaux':                      'fc-sochaux-montbeliard',
  // ─── MLS ────────────────────────────────────────────────────────────────────
  'atlanta united':               'atlanta-united-fc',
  'austin fc':                    'austin-fc',
  'cf montreal':                  'cf-montreal',
  'chicago fire':                 'chicago-fire',
  'columbus crew':                'columbus-crew',
  'dc united':                    'd-c-united',
  'fc dallas':                    'fc-dallas',
  'houston dynamo':               'houston-dynamo-fc',
  'inter miami':                  'inter-miami-cf',
  'la galaxy':                    'la-galaxy',
  'lafc':                         'lafc',
  'minnesota united':             'minnesota-united-fc',
  'orlando city':                 'orlando-city-sc',
  'new york city fc':             'new-york-city-fc',
  'new york red bulls':           'new-york-red-bulls',
  'philadelphia union':           'philadelphia-union',
  'portland timbers':             'portland-timbers',
  'real salt lake':               'real-salt-lake',
  'seattle sounders':             'seattle-sounders',
  'sporting kansas city':         'sporting-kansas-city',
  'toronto fc':                   'toronto-fc',
  'vancouver whitecaps':          'vancouver-whitecaps',
  // ─── Saudi Pro League ───────────────────────────────────────────────────────
  'al ahli sfc':                  'al-ahli',
  'al ettifaq':                   'al-ettifaq',
  'al fateh sc':                  'al-fateh',
  'al fayha fc':                  'al-fayha',
  'al hazem sc':                  'al-hazm',
  'al hilal sfc':                 'al-hilal',
  'al ittihad':                   'al-ittihad',
  'al khaleej fc':                'al-khaleej',
  'al kholood club':              'al-kholood',
  'al najma fc':                  'al-najma',
  'al nassr fc':                  'al-nassr',
  'al okhdood club':              'al-okhdood',
  'al qadsiah fc':                'al-qadsiah',
  'al riyadh sc':                 'al-riyadh',
  'al shabab fc':                 'al-shabab',
  'al taawoun fc':                'al-taawoun',
  'neom sc':                      'neom',
};

// ── 3. Flatten list.json into [{name, slug, wantedGroup}] ─────────────────────
const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'list.json'), 'utf8'));
const wanted  = []; // squad file exists
const missing = []; // no squad file yet

function flatten(obj, key = '') {
  if (Array.isArray(obj)) {
    const group = GROUP_MAP[key];
    if (!group) return; // skip world_cup, champions_league, etc.
    for (const name of obj) {
      const norm = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const slug = NAME_TO_SLUG[norm] || norm.replace(/ /g, '-');
      const exists = fs.existsSync(path.join(__dirname, 'squads', slug + '.json'));
      (exists ? wanted : missing).push({ name, slug, wantedGroup: group });
    }
  } else {
    for (const [k, v] of Object.entries(obj)) flatten(v, key ? key + '.' + k : k);
  }
}
flatten(list);

// ── 4. Compute changes needed ─────────────────────────────────────────────────
const metaPath = path.join(__dirname, 'squads-meta.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

const officialLeagues = {};
for (const team of wanted) {
  (officialLeagues[team.wantedGroup] ||= []).push(team.slug);
}

if (AUDIT) {
  const failures = [];
  const duplicateSlugs = [...new Set(wanted.map(team => team.slug).filter((slug, index, slugs) => slugs.indexOf(slug) !== index))];
  if (duplicateSlugs.length) failures.push(`Slugs duplicados: ${duplicateSlugs.join(', ')}`);

  for (const [group, slugs] of Object.entries(officialLeagues)) {
    console.log(`  ${group}: ${slugs.length} equipos`);
  }
  for (const team of wanted) {
    const squadPath = path.join(__dirname, 'squads', `${team.slug}.json`);
    const squad = JSON.parse(fs.readFileSync(squadPath, 'utf8'));
    const players = squad.seasons?.['2026']?.players;
    if (!Array.isArray(players) || players.length < 8) failures.push(`${team.slug}: sin plantilla 2026 válida`);
    const badge = meta[team.slug]?.badgeLocalPath || squad.badgeLocalPath;
    const badgePath = badge?.startsWith('/') ? path.join(__dirname, 'public', badge.slice(1)) : '';
    if (!badgePath || !fs.existsSync(badgePath)) failures.push(`${team.slug}: sin escudo local`);
  }

  if (failures.length) {
    console.error(`\n❌ Auditoría fallida (${failures.length}):\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`\n✅ Auditoría completa: ${wanted.length} equipos, temporada 2026, plantillas y escudos correctos.`);
  process.exit(0);
}

function currentGroup(slug) {
  if (meta[slug]?.group) return meta[slug].group;
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', slug + '.json'), 'utf8')).group || '🌍 Otros'; }
  catch { return '?'; }
}

const changes = wanted
  .map(t => ({ ...t, from: currentGroup(t.slug) }))
  .filter(t => t.from !== t.wantedGroup);
const managedGroups = new Set(Object.values(GROUP_MAP));
const wantedSlugs = new Set(wanted.map(team => team.slug));
const stale = fs.readdirSync(path.join(__dirname, 'squads'))
  .filter(file => file.endsWith('.json'))
  .map(file => file.slice(0, -5))
  .filter(slug => !wantedSlugs.has(slug) && managedGroups.has(currentGroup(slug)))
  .map(slug => ({ slug, from: currentGroup(slug), wantedGroup: '🌍 Otros', name: meta[slug]?.nameEs || slug }));
changes.push(...stale);

// ── 5. Report ──────────────────────────────────────────────────────────────────
console.log(`\n📊 Equipos verificados: ${wanted.length}  |  Sin archivo squad: ${missing.length}\n`);

if (changes.length === 0) {
  console.log('✅ Todo correcto — ningún cambio necesario.');
} else {
  console.log(`⚠️  ${changes.length} equipos con grupo incorrecto o fuera de la liga oficial:`);
  for (const c of changes) {
    console.log(`  [${c.slug}]  "${c.name}"  →  ${c.from}  ⟹  ${c.wantedGroup}`);
  }
}

const realMissing = missing.filter(m => !m.slug.startsWith('unknown'));
if (realMissing.length) {
  console.log(`\n📭 Sin archivo squad (${realMissing.length} equipos — no se pueden importar hasta que existan datos):`);
  const byGroup = {};
  for (const m of realMissing) {
    if (!byGroup[m.wantedGroup]) byGroup[m.wantedGroup] = [];
    byGroup[m.wantedGroup].push(m.name);
  }
  for (const [g, names] of Object.entries(byGroup)) {
    console.log(`  ${g}: ${names.join(', ')}`);
  }
}

if (!APPLY) {
  if (changes.length) console.log('\n💡 Ejecuta con --apply para aplicar los cambios.');
  process.exit(0);
}

// ── 6. Apply ──────────────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(__dirname, 'data', 'official-leagues.json'),
  JSON.stringify(officialLeagues, null, 2),
  'utf8'
);
console.log('\n✅ data/official-leagues.json actualizado.');

if (changes.length === 0) process.exit(0);

console.log('\n📝 Aplicando cambios a squads-meta.json...');
for (const { slug, wantedGroup: to, name } of changes) {
  if (!meta[slug]) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', slug + '.json'), 'utf8'));
      meta[slug] = { group: to, nameEn: d.nameEn || d.name || name, nameEs: d.nameEs || d.name || name };
    } catch {
      meta[slug] = { group: to, nameEn: name, nameEs: name };
    }
  } else {
    meta[slug].group = to;
  }
  console.log(`  ✓ ${slug} → ${to}`);
}

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
console.log('\n✅ squads-meta.json actualizado.');

// ── 7. Optionally sync d.group in squad JSONs ─────────────────────────────────
if (UPDATE_DGROUP) {
  console.log('\n📝 Actualizando d.group en squad JSONs...');
  for (const { slug, wantedGroup: to } of changes) {
    const fp = path.join(__dirname, 'squads', slug + '.json');
    try {
      const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (d.group !== to) {
        d.group = to;
        fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8');
        console.log(`  ✓ ${slug}.json d.group → ${to}`);
      }
    } catch (_) {}
  }
}
