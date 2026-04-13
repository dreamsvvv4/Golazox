/**
 * _fix_squads_audit.js
 * Comprehensive squad data quality fixes:
 * 1. Fix 22 mojibake names in squads-meta.json
 * 2. La Liga promoted teams → La Liga
 * 3. La Liga relegated teams → La Liga 2
 * 4. Hide La Liga duplicates (no badge)
 * 5. Fix palmeiras group+badge
 * 6. Assign/hide no-group teams
 * 7. Norwegian/Moroccan/Monterrey duplicates
 * 8. Mexican teams wrong group
 * 9. Fix bad Bayern Munich key in squads-meta
 * 10. Delete .seed-progress.json
 */

const fs = require('fs');
const path = require('path');

const SQUADS_META = path.join(__dirname, 'squads-meta.json');
const SQUADS_DIR = path.join(__dirname, 'squads');

// Load squads-meta
let raw = fs.readFileSync(SQUADS_META, 'utf8').replace(/^\uFEFF/, '');
const meta = JSON.parse(raw);

let changes = 0;

function set(slug, props) {
  if (!meta[slug]) meta[slug] = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null) {
      delete meta[slug][k];
    } else {
      meta[slug][k] = v;
    }
  }
  changes++;
}

// ─── 1. FIX MOJIBAKE NAMES ─────────────────────────────────────────────────
const mojibakeFixes = {
  'atletico-madrid':      { nameEn: 'Atlético Madrid',      nameEs: 'Atlético de Madrid' },
  'deportivo-alaves':     { nameEn: 'Deportivo Alavés',     nameEs: 'Deportivo Alavés' },
  'cadiz-cf':             { nameEn: 'Cádiz CF',             nameEs: 'Cádiz CF' },
  'castellon':            { nameEn: 'CD Castellón',         nameEs: 'CD Castellón' },
  'cd-leganes':           { nameEn: 'CD Leganés',           nameEs: 'CD Leganés' },
  'cd-mirandes':          { nameEn: 'CD Mirandés',          nameEs: 'CD Mirandés' },
  'cordoba':              { nameEn: 'Córdoba CF',           nameEs: 'Córdoba CF' },
  'malaga':               { nameEn: 'Málaga CF',            nameEs: 'Málaga CF' },
  'sd-eibar':             { nameEn: 'SD Éibar',             nameEs: 'SD Éibar' },
  'sporting-gijon':       { nameEn: 'Sporting Gijón',       nameEs: 'Sporting de Gijón' },
  'ud-almeria':           { nameEn: 'UD Almería',           nameEs: 'UD Almería' },
  'as-monaco':            { nameEs: 'Mónaco' },
  'as-saint-etienne':     { nameEn: 'AS Saint-Étienne',    nameEs: 'Saint-Étienne' },
  'ac-mailand':           { nameEs: 'AC Milán' },
  'inter-mailand':        { nameEs: 'Inter de Milán' },
  'ssc-napoli':           { nameEs: 'Nápoles' },
  'clube-atletico-mineiro': { nameEn: 'Atlético Mineiro',  nameEs: 'Atlético Mineiro' },
  'fc-sao-paulo':         { nameEn: 'São Paulo FC',         nameEs: 'São Paulo' },
  'cf-america':           { nameEn: 'Club América',         nameEs: 'América' },
  'fenerbahce-sk':        { nameEn: 'Fenerbahçe SK',        nameEs: 'Fenerbahçe' },
  'fc-koln':              { nameEn: '1. FC Köln',           nameEs: 'FC Colonia' },
};
for (const [slug, props] of Object.entries(mojibakeFixes)) {
  set(slug, props);
}
// Fix bad key: fc-Bayern-mÃ¼nchen → fc-Bayern-münchen is the decoded form,
// but the real file is fc-Bayern-munchen, so this key is dead. The correct entry
// is under fc-Bayern-munchen (or fc-Bayern-münchen if that's the slug). Remove the bad key.
const badBayernKey = 'fc-Bayern-mÃ¼nchen';
if (meta[badBayernKey]) {
  console.log('Removing bad Bayern key:', badBayernKey);
  delete meta[badBayernKey];
  changes++;
}
// Ensure correct Bayern entry exists
if (!meta['fc-Bayern-munchen'] && !meta['fc-Bayern-münchen']) {
  const bayernFile = path.join(SQUADS_DIR, 'fc-Bayern-munchen.json');
  if (fs.existsSync(bayernFile)) {
    set('fc-Bayern-munchen', { nameEn: 'Bayern Munich', nameEs: 'Bayern Múnich' });
  }
}

// ─── 2. LA LIGA PROMOTED TEAMS ─────────────────────────────────────────────
const promoted2425 = ['cd-leganes', 'ud-las-palmas', 'real-valladolid'];
for (const slug of promoted2425) {
  set(slug, { group: '🇪🇸 La Liga' });
  console.log('✓ Promoted to La Liga:', slug);
}

// ─── 3. LA LIGA RELEGATED TEAMS ────────────────────────────────────────────
const relegated2425 = ['elche-cf', 'levante-ud', 'real-oviedo'];
for (const slug of relegated2425) {
  set(slug, { group: '🇪🇸 La Liga 2' });
  console.log('✓ Relegated to La Liga 2:', slug);
}

// ─── 4. HIDE LA LIGA DUPLICATES (remove badge) ─────────────────────────────
const laLigaDuplicates = [
  'girona-fc',                  // dup of fc-girona
  'rc-celta-vigo',              // dup of celta-vigo
  'rcd-espanyol-barcelona',     // dup of espanyol-barcelona
  'real-club-deportivo-mallorca', // dup of rcd-mallorca
  'villarreal-cf',              // dup of fc-villarreal
  'real-betis-sevilla',         // dup of real-betis-balompie (wrong badge!)
];
for (const slug of laLigaDuplicates) {
  set(slug, { group: '🌍 Otros', badgeLocalPath: null });
  console.log('✓ Hidden (dup):', slug);
}

// ─── 5. FIX PALMEIRAS ───────────────────────────────────────────────────────
set('palmeiras', {
  group: '🇧🇷 Brasileirão',
  badgeLocalPath: '/img/badges/palmeiras.png',
  nameEn: 'Palmeiras',
  nameEs: 'Palmeiras',
});
console.log('✓ Palmeiras → Brasileirão');

// ─── 6. NO-GROUP TEAMS → OTROS (HIDDEN since no data) ──────────────────────
const noGroupToOtros = {
  'abha-fc':    { group: '🌍 Otros', badgeLocalPath: null },
  'al-okhdood': { group: '🌍 Otros', badgeLocalPath: null },
  'al-riyadh-fc': { group: '🌍 Otros', badgeLocalPath: null },
  'damac-fc':   { group: '🌍 Otros', badgeLocalPath: null },
  'coritiba-fc': { group: '🌍 Otros', badgeLocalPath: null },
  'gimnasia-y-esgrima-mendoza': { group: '🌍 Otros', badgeLocalPath: null },
};
for (const [slug, props] of Object.entries(noGroupToOtros)) {
  set(slug, props);
  console.log('✓ No-group → Otros (hidden):', slug);
}

// ─── 7. HIDE DUPLICATES: noruega, marruecos, cf-monterrey ──────────────────
const hideDups = ['noruega', 'marruecos', 'cf-monterrey'];
for (const slug of hideDups) {
  set(slug, { badgeLocalPath: null });
  console.log('✓ Hidden duplicate:', slug);
}

// ─── 8. MEXICAN TEAMS WRONG GROUP → OTROS ──────────────────────────────────
const mexicanTeams = ['monterrey', 'cruz-azul', 'guadalajara'];
for (const slug of mexicanTeams) {
  set(slug, { group: '🌍 Otros' });
  console.log('✓ Mexican team → Otros:', slug);
}

// ─── 9. WRITE UPDATED squads-meta.json ─────────────────────────────────────
const output = JSON.stringify(meta, null, 2);
fs.writeFileSync(SQUADS_META, output, 'utf8');
console.log(`\n✅ squads-meta.json updated (${changes} entries changed)`);

// ─── 10. DELETE .seed-progress.json ────────────────────────────────────────
const seedProgress = path.join(SQUADS_DIR, '.seed-progress.json');
if (fs.existsSync(seedProgress)) {
  fs.unlinkSync(seedProgress);
  console.log('✅ Deleted .seed-progress.json');
}

// ─── VERIFY: Show La Liga and La Liga 2 counts ─────────────────────────────
const metaFinal = JSON.parse(fs.readFileSync(SQUADS_META, 'utf8'));
const files = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json'));
const ligaCounts = {};
for (const f of files) {
  const slug = f.replace('.json', '');
  const fileRaw = fs.readFileSync(path.join(SQUADS_DIR, f), 'utf8').replace(/^\uFEFF/, '');
  let d; try { d = JSON.parse(fileRaw); } catch (e) { continue; }
  const m = metaFinal[slug] || {};
  const group = m.group || d.group || '';
  ligaCounts[group] = (ligaCounts[group] || 0) + 1;
}
console.log('\n📊 Final group counts:');
Object.entries(ligaCounts).sort((a, b) => b[1] - a[1]).forEach(([g, c]) => console.log(`  ${c}  ${g}`));
