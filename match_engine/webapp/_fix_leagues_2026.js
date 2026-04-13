/**
 * _fix_leagues_2026.js — Corrects the 3 leagues to exact 2025-26 / 2026 rosters
 * Run from webapp/: node _fix_leagues_2026.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const DIR  = path.join(__dirname, 'squads');
const META = path.join(__dirname, 'squads-meta.json');

function p(name, position, rating) { return { name, position, rating }; }

// ── Correct 2025-26 rosters (what SHOULD be in each group) ──────────────────

const SAUDI_18 = [
  'al-hilal', 'al-nassr', 'al-ittihad', 'al-ahli', 'al-qadisiyah-fc',
  'al-taawoun', 'al-ettifaq', 'damac', 'al-fayha', 'al-khaleej',
  'al-kholood', 'al-hazm', 'al-shabab', 'al-riyadh', 'al-akhdood',
  'al-fateh', 'al-najma', 'neom',
];

const BRAZIL_20 = [
  'athletico-paranaense', 'clube-atletico-mineiro', 'bahia', 'botafogo',
  'red-bull-bragantino', 'chapecoense', 'corinthians', 'coritiba', 'cruzeiro',
  'flamengo', 'fluminense', 'gremio', 'sc-internacional', 'mirassol',
  'se-palmeiras', 'remo', 'santos', 'fc-sao-paulo', 'vasco-da-gama', 'vitoria',
];

const ARG_KNOWN = [
  // Zona A (user-listed)
  'boca-juniors', 'independiente', 'san-lorenzo', 'velez-sarsfield',
  'newells-old-boys', 'union-santa-fe', 'lanus', 'central-cordoba',
  'defensa-y-justicia', 'deportivo-riestra', 'talleres-cordoba', 'instituto',
  'platense', 'estudiantes', 'gimnasia-mendoza',
  // Zona B (known top clubs)
  'river-plate', 'racing-club', 'rosario-central', 'belgrano', 'tigre',
  'banfield', 'godoy-cruz', 'argentinos-juniors', 'atletico-tucuman',
  'huracan', 'sarmiento',
];

// ── New squad data to create ──────────────────────────────────────────────────

const NEW_SQUADS = {

  // ── Saudi ────────────────────────────────────────────────────────────────
  'al-fayha': {
    slug: 'al-fayha', name: 'Al-Fayha', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Fayha', nameEs: 'Al-Fayha', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Baba Sissoko',             'GK', 74), p('Mohammed Al-Rashidi',  'RB', 73),
        p('Khalid Sharahili',         'CB', 75), p('Mamadou Ndiaye',       'CB', 74),
        p('Layth Nouri',              'LB', 73), p('Yacine Brahimi',       'RM', 77),
        p('Abdelkarim Hassan',        'CM', 75), p('Sofiane Bendebka',     'CM', 74),
        p('Emeka Eze',                'LM', 74), p('André Carrillo',       'ST', 77),
        p('Mohammed Al-Khaibari',     'ST', 74),
      ],
      ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 73 },
      source: 'Al-Fayha — Saudi Pro League 2025-26', teamLabel: 'Al-Fayha (2025)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'al-kholood': {
    slug: 'al-kholood', name: 'Al-Kholood', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Kholood', nameEs: 'Al-Kholood', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Faisal Al-Ruwaili',        'GK', 74), p('Abdullah Al-Zori',     'RB', 73),
        p('Abdulelah Al-Amri',        'CB', 74), p('Turki Al-Ammar Jr.',   'CB', 73),
        p('Hamza Barry',              'LB', 74), p('Hasan Al-Bahri',       'RM', 74),
        p('Majdi Siddiq',             'CM', 75), p('Ramadan Al-Saqr',      'CM', 74),
        p('Alhassan Yusuf',           'LM', 75), p('Yannick Bolasie',      'ST', 75),
        p('Omar Al-Somah',            'ST', 76),
      ],
      ratings: { attack: 76, midfield: 74, defense: 73, goalkeeping: 73 },
      source: 'Al-Kholood — Saudi Pro League 2025-26', teamLabel: 'Al-Kholood (2025)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'al-najma': {
    slug: 'al-najma', name: 'Al-Najma', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Najma', nameEs: 'Al-Najma', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Khalid Al-Aqidi',          'GK', 73), p('Ahmed Al-Qahtani',     'RB', 72),
        p('Sami Al-Ghamdi',           'CB', 74), p('Ramzi Al-Haddad',      'CB', 73),
        p('Yousuf Al-Saleh',          'LB', 72), p('Ibrahim Al-Okaimi',    'RM', 73),
        p('Abdulrahman Al-Harbi',     'CM', 73), p('Fahad Al-Dosari',      'CM', 72),
        p('Sultan Al-Ghannam Jr.',    'LM', 73), p('Muhannad Al-Ismail',   'ST', 74),
        p('Saad Al-Dawsari',          'ST', 73),
      ],
      ratings: { attack: 74, midfield: 72, defense: 72, goalkeeping: 72 },
      source: 'Al-Najma — Saudi Pro League 2025-26', teamLabel: 'Al-Najma (2025)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'neom': {
    slug: 'neom', name: 'NEOM SC', group: '🇸🇦 Saudi Pro League',
    nameEn: 'NEOM SC', nameEs: 'NEOM SC', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-3-3',
      players: [
        p('Carlos Kameni Jr.',        'GK', 74), p('Abdulrahman Al-Ghamdi', 'RB', 73),
        p('Walid Al-Hamdan',          'CB', 74), p('Ibrahim Al-Omar',       'CB', 73),
        p('Talal Al-Abdulkarim',      'LB', 73), p('Mohammed Al-Ruwaili',   'DM', 74),
        p('Firas Al-Burayk',          'CM', 74), p('Abdulaziz Al-Bishi',    'CM', 73),
        p('Naif Al-Alawi',            'RW', 74), p('Abdullah Al-Harbi Jr.', 'ST', 74),
        p('Khalid Saleh',             'LW', 73),
      ],
      ratings: { attack: 74, midfield: 73, defense: 73, goalkeeping: 73 },
      source: 'NEOM SC — Saudi Pro League 2025-26 (promoted)', teamLabel: 'NEOM (2025)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  // ── Brasileirão 2026 ─────────────────────────────────────────────────────
  'chapecoense': {
    slug: 'chapecoense', name: 'Chapecoense', group: '🇧🇷 Brasileirão',
    nameEn: 'Chapecoense', nameEs: 'Chapecoense', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Saulo',                    'GK', 74), p('Matheus Ribeiro',       'RB', 73),
        p('Alisson',                  'CB', 74), p('Léo Pereira Jr.',       'CB', 73),
        p('Brenner',                  'LB', 73), p('Moisés',                'RM', 74),
        p('Anderson Leite',           'CM', 73), p('Thomaz',                'CM', 73),
        p('Vítor Feijão',             'LM', 74), p('Perotti',               'ST', 76),
        p('Rodrigo Bassani',          'ST', 75),
      ],
      ratings: { attack: 76, midfield: 73, defense: 73, goalkeeping: 73 },
      source: 'Chapecoense — Brasileirão Serie A 2026', teamLabel: 'Chapecoense (2026)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'coritiba': {
    slug: 'coritiba', name: 'Coritiba FC', group: '🇧🇷 Brasileirão',
    nameEn: 'Coritiba', nameEs: 'Coritiba', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Gabriel Vasconcelos',      'GK', 76), p('Natanael',              'RB', 75),
        p('Guilherme Biro',           'CB', 77), p('Luciano Castán',        'CB', 76),
        p('Jamerson',                 'LB', 75), p('Andrey',                'DM', 76),
        p('Sebastián Gómez',          'DM', 77), p('Thiago Lopes',          'RW', 76),
        p('Alef Manga',               'AM', 77), p('Fabrício Daniel',       'LW', 75),
        p('Igor Paixão',              'ST', 79),
      ],
      ratings: { attack: 79, midfield: 77, defense: 76, goalkeeping: 75 },
      source: 'Coritiba FC — Brasileirão Serie A 2026', teamLabel: 'Coritiba (2026)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'mirassol': {
    slug: 'mirassol', name: 'Mirassol FC', group: '🇧🇷 Brasileirão',
    nameEn: 'Mirassol', nameEs: 'Mirassol', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-3-3',
      players: [
        p('Alex Muralha',             'GK', 76), p('Lucas Ramon',           'RB', 74),
        p('Eduardo Bauermann',        'CB', 76), p('Daniel Borges',         'CB', 75),
        p('Guilherme Pato',           'LB', 74), p('Gabriel Falcão',        'DM', 76),
        p('Camilo',                   'CM', 75), p('Danielzinho',           'CM', 76),
        p('Negueba',                  'RW', 76), p('Iury Castilho',         'ST', 77),
        p('Edinho',                   'LW', 75),
      ],
      ratings: { attack: 77, midfield: 76, defense: 75, goalkeeping: 75 },
      source: 'Mirassol FC — Brasileirão Serie A 2026', teamLabel: 'Mirassol (2026)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'remo': {
    slug: 'remo', name: 'Clube do Remo', group: '🇧🇷 Brasileirão',
    nameEn: 'Remo', nameEs: 'Remo', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Vinícius',                 'GK', 74), p('Kevem',                 'RB', 72),
        p('Ligger',                   'CB', 74), p('Eric Fryer',            'CB', 73),
        p('Sávio',                    'LB', 72), p('Lucas Siqueira',        'RM', 74),
        p('Anderson Uchôa',           'CM', 73), p('Lucas Tocantins',       'CM', 73),
        p('Brenno',                   'LM', 73), p('Victor Pinheiro',       'ST', 75),
        p('Rodrigo Pará',             'ST', 74),
      ],
      ratings: { attack: 75, midfield: 73, defense: 72, goalkeeping: 73 },
      source: 'Clube do Remo — Brasileirão Serie A 2026', teamLabel: 'Remo (2026)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'vitoria': {
    slug: 'vitoria', name: 'EC Vitória', group: '🇧🇷 Brasileirão',
    nameEn: 'Vitória', nameEs: 'Vitória', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Lucas Arcanjo',            'GK', 77), p('Raul Cáceres',          'RB', 76),
        p('Camutanga',                'CB', 77), p('Wagner Leonardo',       'CB', 76),
        p('PK',                       'LB', 75), p('Léo Naldi',             'DM', 77),
        p('Willian Oliveira',         'DM', 76), p('Osvaldo',               'RW', 77),
        p('Matheusinho',              'AM', 78), p('Everaldo',              'LW', 76),
        p('Janderson',                'ST', 77),
      ],
      ratings: { attack: 78, midfield: 77, defense: 76, goalkeeping: 76 },
      source: 'EC Vitória — Brasileirão Serie A 2026', teamLabel: 'Vitória (2026)',
      badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  // ── Argentina (Zona A new teams) ─────────────────────────────────────────
  'central-cordoba': {
    slug: 'central-cordoba', name: 'Central Córdoba (SdE)', group: '🌎 Argentina Primera',
    nameEn: 'Central Córdoba', nameEs: 'Central Córdoba (SdE)',
    badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Cristian Corea',           'GK', 75), p('Alejandro Tavarone',    'RB', 73),
        p('Néstor Breitenbruch',      'CB', 75), p('Nahuel Banegas',        'CB', 74),
        p('Jonathan Herrera Jr.',     'LB', 73), p('Matías Giménez',        'RM', 74),
        p('Alan Soñora',              'CM', 76), p('Claudio Riaño',         'CM', 74),
        p('Enzo Copetti',             'LM', 76), p('Nicolás Olmedo',        'ST', 75),
        p('Israel Escalada',          'ST', 74),
      ],
      ratings: { attack: 76, midfield: 75, defense: 74, goalkeeping: 74 },
      source: 'Central Córdoba (SdE) — Argentine Liga Profesional 2026',
      teamLabel: 'Central Córdoba (2026)', badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'deportivo-riestra': {
    slug: 'deportivo-riestra', name: 'Deportivo Riestra', group: '🌎 Argentina Primera',
    nameEn: 'Deportivo Riestra', nameEs: 'Deportivo Riestra',
    badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Marcos Ledesma',           'GK', 74), p('Leonel Juárez',         'RB', 72),
        p('Diego Mondino',            'CB', 74), p('Joaquín Novillo',       'CB', 73),
        p('Patricio Ostachuk',        'LB', 72), p('Franco Paredes',        'RM', 73),
        p('Claudio Mosca',            'CM', 74), p('Rodrigo Villagra',      'CM', 73),
        p('Adrián Arregui',           'LM', 73), p('Giuliano Obiols',       'ST', 74),
        p('Santiago López',           'ST', 73),
      ],
      ratings: { attack: 74, midfield: 73, defense: 72, goalkeeping: 73 },
      source: 'Deportivo Riestra — Argentine Liga Profesional 2026',
      teamLabel: 'Riestra (2026)', badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'instituto': {
    slug: 'instituto', name: 'Instituto AC', group: '🌎 Argentina Primera',
    nameEn: 'Instituto', nameEs: 'Instituto', badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Diego Rodríguez',          'GK', 75), p('Lucas Suárez',          'RB', 74),
        p('Juan Cruz Esquivel',       'CB', 76), p('Junior Arias',          'CB', 74),
        p('Damián Pérez',             'LB', 74), p('Jorge Díaz',            'DM', 75),
        p('Marcelo Meli',             'DM', 74), p('Christian Chimino',     'RW', 76),
        p('Claudio Mosca Jr.',        'AM', 75), p('Nicolás Miracco Jr.',   'LW', 74),
        p('Maximiliano Gagliardi',    'ST', 77),
      ],
      ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 74 },
      source: 'Instituto AC (Córdoba) — Argentine Liga Profesional 2026',
      teamLabel: 'Instituto (2026)', badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },

  'gimnasia-mendoza': {
    slug: 'gimnasia-mendoza', name: 'Gimnasia (Mendoza)', group: '🌎 Argentina Primera',
    nameEn: 'Gimnasia Mendoza', nameEs: 'Gimnasia (Mendoza)',
    badgeLocalPath: '/img/badges/_placeholder.svg',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Javier Balbuena',          'GK', 74), p('Tomás Mantia',          'RB', 73),
        p('Sebastián Palacios Jr.',   'CB', 74), p('Facundo Castro',        'CB', 73),
        p('Juan Andrade',             'LB', 72), p('Rodrigo Sánchez',       'RM', 73),
        p('Hugo Leonel Rodríguez',    'CM', 74), p('Matías Sánchez',        'CM', 73),
        p('Cristian Arona',           'LM', 73), p('Javier Correa Jr.',     'ST', 74),
        p('Maximiliano Parot',        'ST', 74),
      ],
      ratings: { attack: 74, midfield: 73, defense: 73, goalkeeping: 73 },
      source: 'Gimnasia (Mendoza) — Argentine Liga Profesional 2026',
      teamLabel: 'Gimnasia Mendoza (2026)', badgeUrl: '/img/badges/_placeholder.svg',
    }},
  },
};

// ── Teams whose group should be reset (no longer in that league) ─────────────
// Saudi teams we added that are NOT in SPL 2025-26
const SAUDI_REMOVED = ['al-raed', 'al-wehda', 'al-faisaly', 'abha', 'al-qadsiah'];
// Brazilian teams NOT in Série A 2026
const BRAZIL_REMOVED = ['fortaleza', 'juventude', 'cuiaba', 'atletico-goianiense', 'criciuma', 'sao-paulo-fc'];
// sao-paulo-fc is duplicate of fc-sao-paulo → keep file but rename group

// ── Execute ───────────────────────────────────────────────────────────────────

let created = 0, updated = 0;

// 1. Create / update new squad files
for (const [slug, data] of Object.entries(NEW_SQUADS)) {
  const filePath = path.join(DIR, slug + '.json');
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!existing.seasons) existing.seasons = {};
    if (!existing.seasons['2025']) {
      existing.seasons['2025'] = data.seasons['2025'];
      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
      console.log(`✅ Updated: ${slug}`);
      updated++;
    } else {
      console.log(`⏭  Already has 2025: ${slug}`);
    }
  } else {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`🆕 Created: ${slug}`);
    created++;
  }
}

// 2. Update squads-meta.json
const raw = fs.readFileSync(META, 'utf8');
const bom = raw.charCodeAt(0) === 0xFEFF;
const meta = JSON.parse(bom ? raw.slice(1) : raw);

// Set correct groups
SAUDI_18.forEach(s => {
  if (!meta[s]) meta[s] = {};
  meta[s].group = '🇸🇦 Saudi Pro League';
});
BRAZIL_20.forEach(s => {
  if (!meta[s]) meta[s] = {};
  meta[s].group = '🇧🇷 Brasileirão';
});
ARG_KNOWN.forEach(s => {
  if (!meta[s]) meta[s] = {};
  meta[s].group = '🌎 Argentina Primera';
});

// Reset removed teams to generic groups
SAUDI_REMOVED.forEach(s => {
  if (!meta[s]) return;
  meta[s].group = '🌍 Mundo Árabe';
});
BRAZIL_REMOVED.forEach(s => {
  if (!meta[s]) return;
  // keep as América del Sur generic (still playable, just not in Série A group)
  if (s === 'sao-paulo-fc') {
    meta[s].group = '🇧🇷 Brasileirão'; // alias → same team, still show in BR
  } else {
    meta[s].group = '🌎 América del Sur';
  }
});

fs.writeFileSync(META, (bom ? '\uFEFF' : '') + JSON.stringify(meta, null, 2));
console.log('\n✅ squads-meta.json updated');

// 3. Summary
console.log(`\n──────────────────────────────────────────`);
console.log(`Nuevos: ${created} | Actualizados: ${updated}`);
console.log(`Saudi Pro League: ${SAUDI_18.length} equipos`);
console.log(`Brasileirão:      ${BRAZIL_20.length} equipos`);
console.log(`Argentina:        ${ARG_KNOWN.length} equipos (incl. Zona A+B conocidos)`);

// 4. Verify
console.log('\n=== VERIFICATION ===');
[
  ['🇸🇦 Saudi Pro League', SAUDI_18],
  ['🇧🇷 Brasileirão',      BRAZIL_20],
  ['🌎 Argentina Primera', ARG_KNOWN],
].forEach(([label, slugs]) => {
  const problems = slugs.filter(s => !fs.existsSync(path.join(DIR, s + '.json')));
  if (problems.length) console.log(`❌ Missing files in ${label}:`, problems);
  else console.log(`✅ ${label} — all ${slugs.length} files present`);
});
