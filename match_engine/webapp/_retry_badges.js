'use strict';

require('dotenv').config();
const { fetchTeamBadge } = require('./lookup');
const fs   = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Teams not found by primary name — try alternative search terms
const ALTS = {
  'bahia':              ['Bahia', 'EC Bahia', 'Esporte Clube Bahia'],
  'banfield':           ['Banfield', 'Club Atletico Banfield'],
  'huracan':            ['Huracan', 'Club Atletico Huracan', 'CA Huracan'],
  'lanus':              ['Lanus', 'Club Atletico Lanus'],
  'newells-old-boys':   ["Newell's Old Boys", "Newells Old Boys", "Newells"],
  'red-bull-bragantino':['Bragantino', 'Red Bull Bragantino', 'Clube Atletico Bragantino'],
  'remo':               ['Remo', 'Clube do Remo'],
  'rosario-central':    ['Rosario Central', 'CA Rosario Central'],
  'union-santa-fe':     ['Union Santa Fe', 'Club Atletico Union'],
  'vitoria':            ['Vitoria', 'EC Vitoria', 'Sport Club Vitoria'],
  'fortaleza':          ['Fortaleza', 'Fortaleza EC'],
  'criciuma':           ['Criciuma', 'Criciuma EC'],
  'mirassol':           ['Mirassol', 'Mirassol FC'],
  'cuiaba':             ['Cuiaba', 'Cuiaba EC'],
  'sarmiento':          ['Sarmiento', 'CA Sarmiento'],
  'central-cordoba':    ['Central Cordoba', 'Central Cordoba SDE'],
  'instituto':          ['Instituto', 'Instituto de Cordoba', 'Instituto AC'],
  'neom':               ['NEOM', 'NEOM SC'],
  'al-akhdood':         ['Al-Okhdood', 'Al Okhdood', 'Al Akhdood'],
  'al-hazm':            ['Al-Hazm', 'Al Hazm'],
  'gimnasia-mendoza':   ['Gimnasia Mendoza', 'Gimnasia y Esgrima Mendoza'],
  // Also try these that had wrong match
  'athletico-paranaense':['Athletico Paranaense', 'Athletico PR', 'Club Athletico Paranaense'],
  'atletico-goianiense': ['Atletico Goianiense', 'Atletico Club Goianiense'],
  'atletico-tucuman':    ['Atletico Tucuman', 'CA Atletico Tucuman'],
  'deportivo-riestra':   ['Deportivo Riestra', 'Club Deportivo Riestra'],
  'juventude':           ['Juventude', 'EC Juventude', 'Esporte Clube Juventude'],
  'platense':            ['Platense', 'CA Platense', 'Club Atletico Platense'],
  'tigre':               ['Tigre', 'CA Tigre', 'Club Atletico Tigre'],
};

// Slugs we know are correct matches — never treat as a false positive
const EXPECTED_SLUG_FRAGMENT = {
  'bahia':              'bahia',
  'banfield':           'banfield',
  'huracan':            'huracan',
  'lanus':              'lanus',
  'newells-old-boys':   "newell",
  'red-bull-bragantino':'bragantino',
  'remo':               'remo',
  'rosario-central':    'rosario',
  'union-santa-fe':     'union',
  'vitoria':            'vitoria',
  'fortaleza':          'fortaleza',
  'criciuma':           'criciuma',
  'mirassol':           'mirassol',
  'cuiaba':             'cuiaba',
  'sarmiento':          'sarmiento',
  'central-cordoba':    'central',
  'instituto':          'instituto',
  'neom':               'neom',
  'al-akhdood':         'akhdood',
  'al-hazm':            'hazm',
  'gimnasia-mendoza':   'gimnasia',
  'athletico-paranaense':'athletico',
  'atletico-goianiense': 'goianiense',
  'atletico-tucuman':    'tucuman',
  'deportivo-riestra':   'riestra',
  'juventude':           'juventude',
  'platense':            'platense',
  'tigre':               'tigre',
};

async function tryDownload(slug, names) {
  const expectedFragment = EXPECTED_SLUG_FRAGMENT[slug] || slug.split('-')[0];

  for (const name of names) {
    try {
      const localPath = await fetchTeamBadge(name);
      if (!localPath) { await sleep(400); continue; }

      // Sanity check: returned path should relate to the team we wanted
      const pathLower = localPath.toLowerCase();
      if (!pathLower.includes(expectedFragment)) {
        console.log(`  [skip] ${name} → ${localPath} (mismatch, expected '${expectedFragment}')`);
        await sleep(400);
        continue;
      }

      // Update squad JSON
      const f   = path.join('./squads', slug + '.json');
      const raw = fs.readFileSync(f, 'utf8');
      const bom = raw.charCodeAt(0) === 0xFEFF;
      const data = JSON.parse(bom ? raw.slice(1) : raw);
      data.badgeLocalPath = localPath;
      if (data.seasons) {
        Object.values(data.seasons).forEach(s => { if (s.badgeUrl) s.badgeUrl = localPath; });
      }
      fs.writeFileSync(f, (bom ? '\uFEFF' : '') + JSON.stringify(data, null, 2));
      return { ok: true, path: localPath };
    } catch (_) {}
    await sleep(400);
  }
  return { ok: false };
}

async function main() {
  const entries = Object.entries(ALTS);
  let ok = 0, failed = 0;
  for (let i = 0; i < entries.length; i++) {
    const [slug, names] = entries[i];
    const r = await tryDownload(slug, names);
    console.log((r.ok ? '✅' : '⚠️ ') + ' ' + slug + (r.ok ? ' → ' + r.path : ''));
    if (r.ok) ok++; else failed++;
    if (i < entries.length - 1) await sleep(800);
  }
  console.log(`\nOK: ${ok} | Not found: ${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
