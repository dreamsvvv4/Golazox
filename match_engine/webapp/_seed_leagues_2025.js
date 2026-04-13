/**
 * _seed_leagues_2025.js — One-time seeder for Saudi Pro League, Brasileirão & Argentine Primera 2025
 * Run from webapp/: node _seed_leagues_2025.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const DIR  = path.join(__dirname, 'squads');

function p(name, position, rating) { return { name, position, rating }; }

// ── Season data ───────────────────────────────────────────────────────────────
const SEASONS = {

  // ══════════════════════════════════════════════════════════════════════════
  // 🇸🇦 SAUDI PRO LEAGUE 2025
  // ══════════════════════════════════════════════════════════════════════════

  'al-hilal': {
    formation: '4-2-3-1',
    players: [
      p('Yassine Bounou',       'GK', 87), p('João Cancelo',       'RB', 83),
      p('Kalidou Koulibaly',    'CB', 83), p('Ali Al-Bulaihi',     'CB', 79),
      p('Renan Lodi',           'LB', 80), p('Rúben Neves',        'DM', 84),
      p('Michael',              'CM', 80), p('Malcom',             'RW', 84),
      p('Neymar Jr.',           'AM', 85), p('Marcos Leonardo',    'LW', 79),
      p('Aleksandar Mitrović',  'ST', 85),
    ],
    ratings: { attack: 87, midfield: 85, defense: 82, goalkeeping: 86 },
    source: 'Al-Hilal — Saudi Pro League 2025', teamLabel: 'Al-Hilal (2025)',
    badgeUrl: '/img/badges/al-hilal.png',
  },

  'al-nassr': {
    formation: '4-2-3-1',
    players: [
      p('Bento',                'GK', 83), p('Otávio',             'RB', 79),
      p('Aymeric Laporte',      'CB', 83), p('Sultan Al-Ghannam',  'CB', 74),
      p('Alex Telles',          'LB', 78), p('Marcelo Brozović',   'DM', 83),
      p('Seko Fofana',          'DM', 81), p('Anderson Talisca',   'RW', 82),
      p('Sadio Mané',           'AM', 82), p('Abdullah Al-Hamdan', 'LW', 79),
      p('Cristiano Ronaldo',    'ST', 87),
    ],
    ratings: { attack: 86, midfield: 83, defense: 80, goalkeeping: 82 },
    source: 'Al-Nassr — Saudi Pro League 2025', teamLabel: 'Al-Nassr (2025)',
    badgeUrl: '/img/badges/al-nassr.png',
  },

  'al-ittihad': {
    formation: '4-3-3',
    players: [
      p('Marcelo Grohe',        'GK', 78), p('Luiz Felipe',         'RB', 78),
      p('Cédric Badolo',        'CB', 75), p('Fahad Al-Muwallad',   'CB', 76),
      p('Nuno Tavares',         'LB', 79), p("N'Golo Kanté",        'DM', 84),
      p('Fabinho',              'CM', 80), p('Mohamed Kanno',       'CM', 77),
      p('Karim Benzema',        'RW', 83), p('Ivan Toney',          'ST', 82),
      p('Jota',                 'LW', 80),
    ],
    ratings: { attack: 84, midfield: 82, defense: 77, goalkeeping: 76 },
    source: 'Al-Ittihad — Saudi Pro League 2025', teamLabel: 'Al-Ittihad (2025)',
    badgeUrl: '/img/badges/al-ittihad.png',
  },

  'al-ahli': {
    formation: '4-2-3-1',
    players: [
      p('Édouard Mendy',        'GK', 82), p('Siyabonga Ngezana',  'RB', 73),
      p('Merih Demiral',        'CB', 82), p('Roger Ibañez',       'CB', 79),
      p('Yasser Al-Shahrani',   'LB', 77), p('Ismaël Bennacer',    'DM', 82),
      p('Gabri Veiga',          'DM', 80), p('Riyad Mahrez',       'RW', 84),
      p('Frank Kessié',         'AM', 79), p('Allan Saint-Maximin','LW', 80),
      p('Roberto Firmino',      'ST', 82),
    ],
    ratings: { attack: 84, midfield: 81, defense: 80, goalkeeping: 81 },
    source: 'Al-Ahli — Saudi Pro League 2025', teamLabel: 'Al-Ahli (2025)',
    badgeUrl: '/img/badges/al-ahli.png',
  },

  'al-shabab': {
    formation: '4-4-2',
    players: [
      p('Fawaz Al-Qarni',       'GK', 75), p('Nasser Al-Dawsari',  'RB', 74),
      p('Badr Benoun',          'CB', 77), p('Hamdan Al-Shammari', 'CB', 74),
      p('Guilherme Arana',      'LB', 77), p('Luciano Vietto',     'RM', 77),
      p('Turki Al-Anazi',       'CM', 74), p('Hattan Bahabri',     'CM', 75),
      p('Khaled Al-Ghannam',    'LM', 76), p('Saad Al-Sheeb',      'ST', 77),
      p('Muhannad Asiri',       'ST', 76),
    ],
    ratings: { attack: 77, midfield: 76, defense: 76, goalkeeping: 74 },
    source: 'Al-Shabab — Saudi Pro League 2025', teamLabel: 'Al-Shabab (2025)',
    badgeUrl: '/img/badges/al-shabab.png',
  },

  'al-fateh': {
    formation: '4-2-3-1',
    players: [
      p('Mohammed Al-Yami',     'GK', 76), p('Murtaja Ghuloom',    'RB', 74),
      p('Saud Abdul-Hamid',     'CB', 76), p('Amro Tayssir',       'CB', 74),
      p('Abdullah Otayf',       'LB', 74), p('Ahmad Noorollahi',   'DM', 77),
      p('Abdulrahman Kheit',    'DM', 74), p('Khalid Al-Meshal',   'RW', 74),
      p('Waleed Al-Ahmad',      'AM', 74), p('Faïd Al-Muwallad',   'LW', 77),
      p('Abdulrahman Al-Ghareeb','ST', 76),
    ],
    ratings: { attack: 77, midfield: 75, defense: 75, goalkeeping: 75 },
    source: 'Al-Fateh — Saudi Pro League 2025', teamLabel: 'Al-Fateh (2025)',
    badgeUrl: '/img/badges/al-fateh.png',
  },

  'al-qadsiah': {
    formation: '4-4-2',
    players: [
      p('Bruno Souza',          'GK', 74), p('Abdulelah Al-Amri',  'RB', 74),
      p('Lasha Dvali',          'CB', 77), p('Mostafa Fathi',      'CB', 75),
      p('Mohammed Al-Musawi',   'LB', 73), p('Yacine Benzia',      'RM', 77),
      p('Nabil Bentaleb',       'CM', 76), p('Walid Azaro',        'CM', 75),
      p('Aboubakary Koita',     'LM', 75), p('Mostafa Mohamed',    'ST', 78),
      p('Haythem Jouini',       'ST', 74),
    ],
    ratings: { attack: 78, midfield: 76, defense: 75, goalkeeping: 73 },
    source: 'Al-Qadsiah — Saudi Pro League 2025', teamLabel: 'Al-Qadsiah (2025)',
    badgeUrl: '/img/badges/al-qadsiah.png',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 🇧🇷 BRASILEIRÃO SERIE A 2025
  // ══════════════════════════════════════════════════════════════════════════

  'botafogo': {
    formation: '4-2-3-1',
    players: [
      p('John',                 'GK', 82), p('Vitinho',            'RB', 78),
      p('Bastos',               'CB', 78), p('Alexander Barboza',  'CB', 80),
      p('Cuiabano',             'LB', 79), p('Marlon Freitas',     'DM', 81),
      p('Gregore',              'DM', 78), p('Luiz Henrique',      'RW', 82),
      p('Thiago Almada',        'AM', 83), p('Savarino',           'LW', 80),
      p('Tiquinho Soares',      'ST', 82),
    ],
    ratings: { attack: 83, midfield: 82, defense: 79, goalkeeping: 81 },
    source: 'Botafogo — Brasileirão 2025 (Copa Libertadores 2024 champion)',
    teamLabel: 'Botafogo (2025)', badgeUrl: '/img/badges/botafogo.png',
  },

  'fluminense': {
    formation: '4-2-3-1',
    players: [
      p('Fábio',                'GK', 81), p('Samuel Xavier',      'RB', 76),
      p('Nino',                 'CB', 81), p('Manoel',             'CB', 78),
      p('Diogo Barbosa',        'LB', 78), p('Martinelli',         'DM', 79),
      p('Lima',                 'DM', 77), p('Keno',               'RW', 77),
      p('Paulo Henrique Ganso', 'AM', 79), p('Jhon Arias',         'LW', 82),
      p('Germán Cano',          'ST', 81),
    ],
    ratings: { attack: 82, midfield: 80, defense: 79, goalkeeping: 80 },
    source: 'Fluminense — Brasileirão 2025', teamLabel: 'Fluminense (2025)',
    badgeUrl: '/img/badges/fluminense.png',
  },

  'corinthians': {
    formation: '4-2-3-1',
    players: [
      p('Hugo Souza',           'GK', 79), p('Fagner',             'RB', 77),
      p('Gil',                  'CB', 79), p('Cacá',               'CB', 78),
      p('Hugo',                 'LB', 76), p('Raniele',            'DM', 78),
      p('Breno Bidon',          'DM', 79), p('Pedro Henrique',     'RW', 77),
      p('Rodrigo Garro',        'AM', 80), p('Ángel Romero',       'LW', 79),
      p('Yuri Alberto',         'ST', 82),
    ],
    ratings: { attack: 82, midfield: 79, defense: 78, goalkeeping: 77 },
    source: 'Corinthians — Brasileirão 2025', teamLabel: 'Corinthians (2025)',
    badgeUrl: '/img/badges/corinthians.png',
  },

  'sao-paulo-fc': {
    formation: '4-2-3-1',
    players: [
      p('Rafael Cabral',        'GK', 80), p('Igor Vinícius',      'RB', 78),
      p('Arboleda',             'CB', 80), p('Alan Franco',        'CB', 78),
      p('Welington',            'LB', 79), p('Pablo Maia',         'DM', 80),
      p('Alisson',              'DM', 79), p('Ferreira',           'RW', 79),
      p('Wellington Rato',      'AM', 80), p('Lucas Rodrigues',    'LW', 76),
      p('Jonathan Calleri',     'ST', 82),
    ],
    ratings: { attack: 82, midfield: 80, defense: 79, goalkeeping: 79 },
    source: 'São Paulo FC — Brasileirão 2025', teamLabel: 'São Paulo FC (2025)',
    badgeUrl: '/img/badges/sao-paulo-fc.png',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 🇦🇷 ARGENTINA PRIMERA DIVISIÓN 2025
  // ══════════════════════════════════════════════════════════════════════════

  'river-plate': {
    formation: '4-2-3-1',
    players: [
      p('Franco Armani',        'GK', 85), p('Gonzalo Montiel',    'RB', 79),
      p('Paulo Díaz',           'CB', 82), p('Germán Pezzella',    'CB', 80),
      p('Enzo Díaz',            'LB', 81), p('Santiago Simón',     'DM', 78),
      p('Rodrigo Aliendro',     'DM', 77), p('Nicolás Barco',      'RW', 78),
      p('Ignacio Fernández',    'AM', 80), p('Pablo Solari',       'LW', 79),
      p('Miguel Borja',         'ST', 82),
    ],
    ratings: { attack: 83, midfield: 80, defense: 82, goalkeeping: 84 },
    source: 'River Plate — Argentine Primera 2025', teamLabel: 'River Plate (2025)',
    badgeUrl: '/img/badges/river-plate.png',
  },

  'boca-juniors': {
    formation: '4-2-3-1',
    players: [
      p('Sergio Romero',        'GK', 78), p('Luis Advíncula',     'RB', 80),
      p('Marcos Rojo',          'CB', 79), p('Cristian Lema',      'CB', 77),
      p('Frank Fabra',          'LB', 78), p('Juan Ramírez',       'DM', 77),
      p('Pol Fernández',        'DM', 78), p('Brian Aguirre',      'RW', 78),
      p('Exequiel Zeballos',    'AM', 80), p('Lucas Janson',       'LW', 77),
      p('Edinson Cavani',       'ST', 80),
    ],
    ratings: { attack: 81, midfield: 79, defense: 78, goalkeeping: 77 },
    source: 'Boca Juniors — Argentine Primera 2025', teamLabel: 'Boca Juniors (2025)',
    badgeUrl: '/img/badges/boca-juniors.png',
  },

  'san-lorenzo': {
    formation: '4-4-2',
    players: [
      p('Ezequiel Unsain',      'GK', 76), p('Juan Giménez',       'RB', 73),
      p('Gastón Campi',         'CB', 75), p('Federico Gattoni',   'CB', 76),
      p('Nahuel Barrios',       'LB', 74), p('Alexis Cuello',      'RM', 75),
      p('Diego Valdés',         'CM', 77), p('Fernando Márquez',   'CM', 73),
      p('Mariano Ojeda',        'LM', 73), p('Adam Bareiro',       'ST', 76),
      p('Iván Leguizamón',      'ST', 75),
    ],
    ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 75 },
    source: 'San Lorenzo — Argentine Primera 2025', teamLabel: 'San Lorenzo (2025)',
    badgeUrl: '/img/badges/san-lorenzo.png',
  },

  'estudiantes': {
    formation: '4-2-3-1',
    players: [
      p('Leandro Chichizola',   'GK', 77), p('Gastón Benedetti',   'RB', 74),
      p('Emanuel Más',          'CB', 77), p('Nehuén Paz',         'CB', 75),
      p('Jorge Morel',          'LB', 74), p('Mauro Méndez',       'DM', 74),
      p('Zaid Romero',          'DM', 75), p('Javier Correa',      'RW', 78),
      p('Marcelino Moreno',     'AM', 76), p('Marco Di Césare',    'LW', 73),
      p('Leandro Díaz',         'ST', 79),
    ],
    ratings: { attack: 78, midfield: 75, defense: 75, goalkeeping: 76 },
    source: 'Estudiantes — Argentine Primera 2025', teamLabel: 'Estudiantes (2025)',
    badgeUrl: '/img/badges/estudiantes.png',
  },
};

// ── New squad files to create if they don't exist ─────────────────────────────
const NEW_SQUADS = {

  // ── Saudi (new mid/lower teams) ──────────────────────────────────────────
  'al-raed': {
    slug: 'al-raed', name: 'Al-Raed', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Raed', nameEs: 'Al-Raed', badgeLocalPath: '/img/badges/al-raed.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Ziad Al-Amri',        'GK', 74), p('Meshal Al-Romaih',  'RB', 73),
        p('Ahmed Al-Sharif',     'CB', 74), p('Mansour Al-Harithy','CB', 73),
        p('Ibrahim Al-Qahtani', 'LB', 72), p('Turki Al-Ammar',    'RM', 74),
        p('Ahmed Bamsaud',       'CM', 74), p('Hamdan Konan',      'CM', 73),
        p('Mohammed Al-Nakhli', 'LM', 73), p('Muhannad Al-Shanqiti','ST',76),
        p('Ali Al-Hassan',       'ST', 74),
      ],
      ratings: { attack: 76, midfield: 74, defense: 73, goalkeeping: 73 },
      source: 'Al-Raed — Saudi Pro League 2025', teamLabel: 'Al-Raed (2025)',
      badgeUrl: '/img/badges/al-raed.png',
    }},
  },

  'al-wehda': {
    slug: 'al-wehda', name: 'Al-Wehda', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Wehda', nameEs: 'Al-Wehda', badgeLocalPath: '/img/badges/al-wehda.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Essam Al-Subai',      'GK', 75), p('Bandar Al-Hayyan',  'RB', 73),
        p('Moustapha Wagué',     'CB', 75), p('Hamad Al-Hamad',    'CB', 74),
        p('Firas Jumah',         'LB', 73), p('Badr Al-Khelaifi',  'DM', 74),
        p('Ibrahim Al-Sulami',   'DM', 74), p('Youssef El-Arabi',  'RW', 77),
        p('Mohammed Fouzair',    'AM', 74), p('Adam Ounas',        'LW', 76),
        p('Abdulkarim Al-Qahtani','ST', 75),
      ],
      ratings: { attack: 77, midfield: 74, defense: 74, goalkeeping: 74 },
      source: 'Al-Wehda — Saudi Pro League 2025', teamLabel: 'Al-Wehda (2025)',
      badgeUrl: '/img/badges/al-wehda.png',
    }},
  },

  'al-faisaly': {
    slug: 'al-faisaly', name: 'Al-Faisaly', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Faisaly', nameEs: 'Al-Faisaly', badgeLocalPath: '/img/badges/al-faisaly.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Abdulelah Al-Sheeb',  'GK', 75), p('Yasser Al-Bishi',  'RB', 73),
        p('Hussein Al-Shahrani', 'CB', 74), p('Homoud Al-Khaldi', 'CB', 73),
        p('Eid Al-Armar',        'LB', 73), p('Yahia Al-Shehri',  'RM', 74),
        p('Bayan Al-Kasim',      'CM', 74), p('Musab Al-Juwayr',  'CM', 74),
        p('Sattam Al-Muwallad',  'LM', 74), p('Mustafa Al-Bassas','ST', 75),
        p('Mohammed Al-Qahtani', 'ST', 74),
      ],
      ratings: { attack: 75, midfield: 74, defense: 73, goalkeeping: 74 },
      source: 'Al-Faisaly — Saudi Pro League 2025', teamLabel: 'Al-Faisaly (2025)',
      badgeUrl: '/img/badges/al-faisaly.png',
    }},
  },

  'al-taawoun': {
    slug: 'al-taawoun', name: 'Al-Taawoun', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Taawoun', nameEs: 'Al-Taawoun', badgeLocalPath: '/img/badges/al-taawoun.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Mohammed Al-Deayea Jr.','GK', 74), p('Sultan Al-Bishi','RB', 73),
        p('Mohammed Alhussain',  'CB', 74), p('Ramadan Al-Ruwais','CB', 73),
        p('Abdullah Al-Khaibari','LB', 73), p('Abdulrahman Al-Khulaif','RM',74),
        p('Bassim Al-Suwat',     'CM', 74), p('Nawaf Al-Boushal',  'CM', 74),
        p('Khalid Al-Rashidi',   'LM', 73), p('Fawaz Al-Rashidi', 'ST', 75),
        p('Luís Henrique Tomás', 'ST', 75),
      ],
      ratings: { attack: 75, midfield: 74, defense: 73, goalkeeping: 73 },
      source: 'Al-Taawoun — Saudi Pro League 2025', teamLabel: 'Al-Taawoun (2025)',
      badgeUrl: '/img/badges/al-taawoun.png',
    }},
  },

  'abha': {
    slug: 'abha', name: 'Abha FC', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Abha', nameEs: 'Abha', badgeLocalPath: '/img/badges/abha.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Saeed Al-Owairan Jr.','GK', 73), p('Abdulrahman Jilani','RB', 72),
        p('Abdullah Al-Hakami',  'CB', 73), p('Hatem Ashi',        'CB', 73),
        p('Omar Al-Ghamdi',      'LB', 72), p('Ahmad Tariq',       'RM', 73),
        p('Abdullah Al-Zahrani', 'CM', 73), p('Mohammed Al-Asiri', 'CM', 72),
        p('Saad Al-Aqeel',       'LM', 72), p('Mohammed Shattal',  'ST', 74),
        p('Yasir Al-Shahrani',   'ST', 73),
      ],
      ratings: { attack: 74, midfield: 73, defense: 72, goalkeeping: 72 },
      source: 'Abha FC — Saudi Pro League 2025', teamLabel: 'Abha (2025)',
      badgeUrl: '/img/badges/abha.png',
    }},
  },

  'damac': {
    slug: 'damac', name: 'Damac FC', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Damac', nameEs: 'Damac', badgeLocalPath: '/img/badges/damac.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Khalid Al-Jumaie',    'GK', 73), p('Bassam Al-Natour',  'RB', 72),
        p('Saud Al-Muwallad',    'CB', 74), p('Ziyad Sharahili',   'CB', 73),
        p('Tariq Al-Harbi',      'LB', 72), p('Mohammed Al-Shalhoub','RM', 73),
        p('Ziyad Al-Sahafi',     'CM', 73), p('Ibrahim Al-Shahrani','CM', 72),
        p('Faisal Al-Ghamdi',    'LM', 73), p('Abdulrahman Al-Obaid','ST',74),
        p('Salem Al-Dawsari Jr.','ST', 73),
      ],
      ratings: { attack: 74, midfield: 73, defense: 73, goalkeeping: 72 },
      source: 'Damac FC — Saudi Pro League 2025', teamLabel: 'Damac (2025)',
      badgeUrl: '/img/badges/damac.png',
    }},
  },

  'al-riyadh': {
    slug: 'al-riyadh', name: 'Al-Riyadh FC', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Riyadh', nameEs: 'Al-Riyadh', badgeLocalPath: '/img/badges/al-riyadh.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Essam Al-Enzi',       'GK', 74), p('Turki Abdullah',    'RB', 73),
        p('Ahmed Al-Ghamdi',     'CB', 74), p('Waleed Al-Buqami',  'CB', 73),
        p('Rashed Al-Mutairi',   'LB', 73), p('Sami Al-Khamees',   'RM', 74),
        p('Abdullah Madkhali',   'CM', 74), p('Mohammed Madkhali',  'CM', 73),
        p('Hussain Al-Mogahwi',  'LM', 73), p('Yazeed Al-Rakeah',  'ST', 75),
        p('Abdulaziz Al-Dawsari','ST', 74),
      ],
      ratings: { attack: 75, midfield: 73, defense: 73, goalkeeping: 73 },
      source: 'Al-Riyadh FC — Saudi Pro League 2025', teamLabel: 'Al-Riyadh (2025)',
      badgeUrl: '/img/badges/al-riyadh.png',
    }},
  },

  'al-akhdood': {
    slug: 'al-akhdood', name: 'Al-Akhdood', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Akhdood', nameEs: 'Al-Akhdood', badgeLocalPath: '/img/badges/al-akhdood.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Abdulhadi Al-Otaibi', 'GK', 73), p('Turki Al-Muammar', 'RB', 72),
        p('Sami Al-Tamimi',      'CB', 73), p('Mohammed Al-Yami Jr.','CB',72),
        p('Tariq Al-Ahmadi',     'LB', 72), p('Saleh Al-Shahrani', 'RM', 73),
        p('Yasser Khater',       'CM', 73), p('Hasan Al-Sulami',   'CM', 72),
        p('Abdullah Al-Harbi',   'LM', 72), p('Saifan Al-Zahrani', 'ST', 73),
        p('Sultan Al-Mutairi',   'ST', 72),
      ],
      ratings: { attack: 73, midfield: 72, defense: 72, goalkeeping: 72 },
      source: 'Al-Akhdood — Saudi Pro League 2025', teamLabel: 'Al-Akhdood (2025)',
      badgeUrl: '/img/badges/al-akhdood.png',
    }},
  },

  'al-hazm': {
    slug: 'al-hazm', name: 'Al-Hazm', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Hazm', nameEs: 'Al-Hazm', badgeLocalPath: '/img/badges/al-hazm.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Mohammed Al-Bakri',   'GK', 73), p('Abdulaziz Al-Numeir','RB', 72),
        p('Saud Al-Rashidi',     'CB', 73), p('Khalid Al-Mufarrij', 'CB', 72),
        p('Talal Al-Thubaiti',   'LB', 72), p('Nasser Al-Asmari',  'RM', 73),
        p('Badr Al-Safri',       'CM', 73), p('Essam Al-Sahli',    'CM', 72),
        p('Fahad Al-Nasser',     'LM', 72), p('Rami Al-Subaie',    'ST', 74),
        p('Majed Al-Qahtani',    'ST', 73),
      ],
      ratings: { attack: 74, midfield: 72, defense: 72, goalkeeping: 72 },
      source: 'Al-Hazm — Saudi Pro League 2025', teamLabel: 'Al-Hazm (2025)',
      badgeUrl: '/img/badges/al-hazm.png',
    }},
  },

  'al-khaleej': {
    slug: 'al-khaleej', name: 'Al-Khaleej', group: '🇸🇦 Saudi Pro League',
    nameEn: 'Al-Khaleej', nameEs: 'Al-Khaleej', badgeLocalPath: '/img/badges/al-khaleej.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Ahmed Al-Meshal',     'GK', 74), p('Rayan Al-Ruwaili',  'RB', 73),
        p('Mohammed Al-Khaled',  'CB', 74), p('Abdullah Al-Bukairi','CB', 73),
        p('Nasser Al-Obaid',     'LB', 73), p('Faisal Al-Asiri',   'RM', 74),
        p('Waleed Al-Bargi',     'CM', 74), p('Sultan Al-Buqami',  'CM', 73),
        p('Bassam Al-Ruwaili',   'LM', 73), p('Yazeed Al-Safrani', 'ST', 75),
        p('Mohammed Al-Omairi',  'ST', 74),
      ],
      ratings: { attack: 75, midfield: 73, defense: 73, goalkeeping: 73 },
      source: 'Al-Khaleej — Saudi Pro League 2025', teamLabel: 'Al-Khaleej (2025)',
      badgeUrl: '/img/badges/al-khaleej.png',
    }},
  },

  // ── Brasileirão (new teams) ──────────────────────────────────────────────

  'red-bull-bragantino': {
    slug: 'red-bull-bragantino', name: 'Red Bull Bragantino', group: '🇧🇷 Brasileirão',
    nameEn: 'Red Bull Bragantino', nameEs: 'Red Bull Bragantino',
    badgeLocalPath: '/img/badges/red-bull-bragantino.png',
    seasons: { '2025': {
      formation: '4-3-3',
      players: [
        p('Cleiton',             'GK', 81), p('Andrés Hurtado',    'RB', 77),
        p('Pedro Henrique',      'CB', 78), p('Ruan Renato',       'CB', 77),
        p('Luan Cândido',        'LB', 78), p('Matheus Fernandes', 'DM', 78),
        p('Jhon Jhon',           'CM', 81), p('Raul',              'CM', 77),
        p('Helinho',             'RW', 80), p('Mosquito',          'ST', 78),
        p('Eduardo Sasha',       'LW', 77),
      ],
      ratings: { attack: 80, midfield: 80, defense: 77, goalkeeping: 80 },
      source: 'Red Bull Bragantino — Brasileirão 2025', teamLabel: 'Red Bull Bragantino (2025)',
      badgeUrl: '/img/badges/red-bull-bragantino.png',
    }},
  },

  'athletico-paranaense': {
    slug: 'athletico-paranaense', name: 'Athletico Paranaense', group: '🇧🇷 Brasileirão',
    nameEn: 'Athletico Paranaense', nameEs: 'Athletico Paranaense',
    badgeLocalPath: '/img/badges/athletico-paranaense.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Léo Linck',           'GK', 79), p('Madson',             'RB', 76),
        p('Thiago Heleno',       'CB', 79), p('Kaique Rocha',       'CB', 76),
        p('Fernando',            'LB', 77), p('Erick',              'DM', 79),
        p('Christian',           'DM', 78), p('Canobbio',           'RW', 80),
        p('Zapelli',             'AM', 76), p('Vitor Bueno',        'LW', 76),
        p('Mastriani',           'ST', 76),
      ],
      ratings: { attack: 79, midfield: 78, defense: 77, goalkeeping: 78 },
      source: 'Athletico Paranaense — Brasileirão 2025', teamLabel: 'Athletico PR (2025)',
      badgeUrl: '/img/badges/athletico-paranaense.png',
    }},
  },

  'bahia': {
    slug: 'bahia', name: 'EC Bahia', group: '🇧🇷 Brasileirão',
    nameEn: 'Bahia', nameEs: 'Bahia', badgeLocalPath: '/img/badges/bahia.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Marcos Felipe',       'GK', 78), p('Gilberto',           'RB', 77),
        p('Gabriel Xavier',      'CB', 77), p('Kanu',               'CB', 79),
        p('Luciano Juba',        'LB', 78), p('Cauly',              'DM', 80),
        p('Acevedo',             'DM', 77), p('Thaciano',           'RW', 78),
        p('Everton Ribeiro',     'AM', 82), p('Ademir',             'LW', 79),
        p('Everaldo',            'ST', 78),
      ],
      ratings: { attack: 80, midfield: 80, defense: 77, goalkeeping: 77 },
      source: 'EC Bahia — Brasileirão 2025', teamLabel: 'Bahia (2025)',
      badgeUrl: '/img/badges/bahia.png',
    }},
  },

  'fortaleza': {
    slug: 'fortaleza', name: 'Fortaleza EC', group: '🇧🇷 Brasileirão',
    nameEn: 'Fortaleza', nameEs: 'Fortaleza', badgeLocalPath: '/img/badges/fortaleza.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('João Ricardo',        'GK', 81), p('Tinga',              'RB', 76),
        p('Titi',                'CB', 79), p("Brítez",             'CB', 78),
        p('Felipe Jonathan',     'LB', 76), p('Matheus Rossetto',   'DM', 77),
        p('Caio Alexandre',      'DM', 78), p('Moisés',             'RW', 77),
        p('Lucas Crispim',       'AM', 78), p('Pikachu',            'LW', 76),
        p('Juan Martín Lucero',  'ST', 81),
      ],
      ratings: { attack: 80, midfield: 78, defense: 78, goalkeeping: 80 },
      source: 'Fortaleza EC — Brasileirão 2025', teamLabel: 'Fortaleza (2025)',
      badgeUrl: '/img/badges/fortaleza.png',
    }},
  },

  'juventude': {
    slug: 'juventude', name: 'EC Juventude', group: '🇧🇷 Brasileirão',
    nameEn: 'Juventude', nameEs: 'Juventude', badgeLocalPath: '/img/badges/juventude.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Gabriel Vasconcellos','GK', 76), p('Rodrigo Soares',     'RB', 74),
        p('Danilo Boza',         'CB', 75), p('Zé Marcos',          'CB', 74),
        p('Alan Ruschel',        'LB', 74), p('Diego Gonçalves',    'RM', 76),
        p('Jadson',              'CM', 74), p('Caíque Osório',      'CM', 75),
        p('Lucas Barbosa',       'LM', 75), p('Erick Farias',       'ST', 77),
        p('Gabriel Inocêncio',   'ST', 75),
      ],
      ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 75 },
      source: 'EC Juventude — Brasileirão 2025', teamLabel: 'Juventude (2025)',
      badgeUrl: '/img/badges/juventude.png',
    }},
  },

  'cuiaba': {
    slug: 'cuiaba', name: 'Cuiabá EC', group: '🇧🇷 Brasileirão',
    nameEn: 'Cuiabá', nameEs: 'Cuiabá', badgeLocalPath: '/img/badges/cuiaba.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Walter',              'GK', 76), p('Héctor Bustamante',  'RB', 73),
        p('Marllon',             'CB', 76), p('Francisco',          'CB', 74),
        p('Rikelmi',             'LB', 73), p('Clayson',            'RM', 75),
        p('Randon',              'CM', 74), p('Rafael Gava',        'CM', 75),
        p('Jonathan Cafu',       'LM', 74), p('Deyverson',          'ST', 77),
        p('Isidro Pitta',        'ST', 75),
      ],
      ratings: { attack: 77, midfield: 74, defense: 74, goalkeeping: 75 },
      source: 'Cuiabá EC — Brasileirão 2025', teamLabel: 'Cuiabá (2025)',
      badgeUrl: '/img/badges/cuiaba.png',
    }},
  },

  'atletico-goianiense': {
    slug: 'atletico-goianiense', name: 'Atlético Goianiense', group: '🇧🇷 Brasileirão',
    nameEn: 'Atlético Goianiense', nameEs: 'Atlético Goianiense',
    badgeLocalPath: '/img/badges/atletico-goianiense.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Ronaldo',             'GK', 74), p('Maguinho',           'RB', 73),
        p('Wanderson',           'CB', 73), p('Índio',              'CB', 73),
        p('Jefferson',           'LB', 73), p('Janderson',          'RM', 74),
        p('Gabriel Baralhas',    'CM', 76), p('Marlon Freitas Jr.', 'CM', 74),
        p('Arthur',              'LM', 74), p('Luiz Fernando',      'ST', 77),
        p('Shaylon',             'ST', 75),
      ],
      ratings: { attack: 77, midfield: 74, defense: 73, goalkeeping: 73 },
      source: 'Atlético Goianiense — Brasileirão 2025', teamLabel: 'Atlético Goianiense (2025)',
      badgeUrl: '/img/badges/atletico-goianiense.png',
    }},
  },

  'criciuma': {
    slug: 'criciuma', name: 'Criciúma EC', group: '🇧🇷 Brasileirão',
    nameEn: 'Criciúma', nameEs: 'Criciúma', badgeLocalPath: '/img/badges/criciuma.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Gustavo',             'GK', 73), p('Wilker',             'RB', 73),
        p('Rodrigo',             'CB', 73), p('Wanderson',          'CB', 72),
        p('Pará',                'LB', 72), p('Marcelo Hermes',     'RM', 73),
        p('Barreto',             'CM', 72), p('Arthur Caíke',       'CM', 73),
        p('Fellipe Mateus',      'LM', 73), p('Allano',             'ST', 75),
        p('Ronald',              'ST', 73),
      ],
      ratings: { attack: 75, midfield: 73, defense: 72, goalkeeping: 72 },
      source: 'Criciúma EC — Brasileirão 2025', teamLabel: 'Criciúma (2025)',
      badgeUrl: '/img/badges/criciuma.png',
    }},
  },

  // ── Argentina (new teams) ────────────────────────────────────────────────

  'huracan': {
    slug: 'huracan', name: 'Huracán', group: '🌎 Argentina Primera',
    nameEn: 'Huracán', nameEs: 'Huracán', badgeLocalPath: '/img/badges/huracan.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Luciano Pocrnjic',    'GK', 76), p('Hernán De La Fuente','RB', 75),
        p('Lucas Merolla',       'CB', 74), p('Gastón Togni',       'CB', 74),
        p('Nicolás Tripichio',   'LB', 74), p('Rodrigo Echeverría', 'RM', 75),
        p('Lucas Arce',          'CM', 76), p('Walter Mazzantti',   'CM', 74),
        p('Stiven Mendoza',      'LM', 75), p('Ignacio Pussetto',   'ST', 77),
        p('Pedro Nolasco',       'ST', 74),
      ],
      ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 75 },
      source: 'Huracán — Argentine Primera 2025', teamLabel: 'Huracán (2025)',
      badgeUrl: '/img/badges/huracan.png',
    }},
  },

  'newells-old-boys': {
    slug: 'newells-old-boys', name: "Newell's Old Boys", group: '🌎 Argentina Primera',
    nameEn: "Newell's Old Boys", nameEs: 'Newell\'s Old Boys',
    badgeLocalPath: '/img/badges/newells-old-boys.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Alan Aguerre',        'GK', 76), p('Gustavo Velázquez',  'RB', 74),
        p('Juan Cruz Komar',     'CB', 76), p('Leo Villalba',       'CB', 74),
        p('Braian Ojeda',        'LB', 74), p('Cristian Ferreira',  'DM', 75),
        p('Juanpi Añor',         'DM', 76), p('Rodrigo Lemos',      'RW', 75),
        p('Fausto Vera',         'AM', 77), p('Julián Fernández',   'LW', 74),
        p('Lucio Compagnucci',   'ST', 76),
      ],
      ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 75 },
      source: "Newell's Old Boys — Argentine Primera 2025", teamLabel: "Newell's (2025)",
      badgeUrl: '/img/badges/newells-old-boys.png',
    }},
  },

  'rosario-central': {
    slug: 'rosario-central', name: 'Rosario Central', group: '🌎 Argentina Primera',
    nameEn: 'Rosario Central', nameEs: 'Rosario Central',
    badgeLocalPath: '/img/badges/rosario-central.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Gaspar Servio',       'GK', 76), p('Facundo Almada',     'RB', 74),
        p('Damián Cruz',         'CB', 75), p('Facundo Mallo',      'CB', 75),
        p('Alexis Delgado',      'LB', 74), p('Gino Infantino',     'DM', 75),
        p('Alan Marinelli',      'DM', 74), p('Luca Martínez Dupuy','RW', 76),
        p('Jaminton Campaz',     'AM', 77), p('Alejo Véliz',        'LW', 76),
        p('Cristian González',   'ST', 77),
      ],
      ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 75 },
      source: 'Rosario Central — Argentine Primera 2025', teamLabel: 'Rosario Central (2025)',
      badgeUrl: '/img/badges/rosario-central.png',
    }},
  },

  'lanus': {
    slug: 'lanus', name: 'Lanús', group: '🌎 Argentina Primera',
    nameEn: 'Lanús', nameEs: 'Lanús', badgeLocalPath: '/img/badges/lanus.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Santiago Larrañaga', 'GK', 75), p('Brahian Alemán',     'RB', 74),
        p('Ezequiel Muñoz',      'CB', 75), p('Emiliano Méndez',   'CB', 74),
        p('Diego Braghieri',     'LB', 74), p('Alexis Castro',      'RM', 74),
        p('José Pasquini',       'CM', 75), p('Tomás Belmonte',     'CM', 76),
        p('Nicolás Orsini',      'LM', 73), p('Brian Mansilla',     'ST', 75),
        p('Fernando Juárez',     'ST', 74),
      ],
      ratings: { attack: 76, midfield: 75, defense: 74, goalkeeping: 74 },
      source: 'Lanús — Argentine Primera 2025', teamLabel: 'Lanús (2025)',
      badgeUrl: '/img/badges/lanus.png',
    }},
  },

  'defensa-y-justicia': {
    slug: 'defensa-y-justicia', name: 'Defensa y Justicia', group: '🌎 Argentina Primera',
    nameEn: 'Defensa y Justicia', nameEs: 'Defensa y Justicia',
    badgeLocalPath: '/img/badges/defensa-y-justicia.png',
    seasons: { '2025': {
      formation: '4-3-3',
      players: [
        p('Leo La Tona',         'GK', 74), p('Marcelo Benítez',    'RB', 73),
        p('Francisco Gerometta', 'CB', 74), p('Alejandro Gómez',    'CB', 74),
        p('Emanuel Britez',      'LB', 74), p('Rubén Sosa',         'DM', 73),
        p('Brian Barrios',       'CM', 74), p('Eric Ramírez',       'CM', 74),
        p('Gustavo Fernández',   'RW', 74), p('Maximiliano Ojeda',  'ST', 75),
        p('Nicolás Fernández',   'LW', 74),
      ],
      ratings: { attack: 75, midfield: 74, defense: 73, goalkeeping: 73 },
      source: 'Defensa y Justicia — Argentine Primera 2025', teamLabel: 'Defensa y Justicia (2025)',
      badgeUrl: '/img/badges/defensa-y-justicia.png',
    }},
  },

  'belgrano': {
    slug: 'belgrano', name: 'Belgrano', group: '🌎 Argentina Primera',
    nameEn: 'Belgrano', nameEs: 'Belgrano', badgeLocalPath: '/img/badges/belgrano.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Nahuel Losada',       'GK', 75), p('Alejandro Rébola',   'RB', 73),
        p('Juan Cruz Kainas',    'CB', 75), p('Alejandro Cano',     'CB', 74),
        p('Rodrigo Rivero',      'LB', 74), p('Ulises Sánchez',     'RM', 75),
        p('Matías Suárez',       'CM', 75), p('Facundo Melivillo',  'CM', 74),
        p('Rubén Botta',         'LM', 76), p('Abel Luciatti',      'ST', 74),
        p('Lucas Passerini',     'ST', 76),
      ],
      ratings: { attack: 76, midfield: 75, defense: 74, goalkeeping: 74 },
      source: 'Belgrano — Argentine Primera 2025', teamLabel: 'Belgrano (2025)',
      badgeUrl: '/img/badges/belgrano.png',
    }},
  },

  'tigre': {
    slug: 'tigre', name: 'Club Atlético Tigre', group: '🌎 Argentina Primera',
    nameEn: 'Tigre', nameEs: 'Tigre', badgeLocalPath: '/img/badges/tigre.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Matías Mansilla',     'GK', 74), p('Sebastián Prediger', 'RB', 73),
        p('Federico Milo',       'CB', 74), p('Juan Pablo Freytes', 'CB', 73),
        p('Diego Sosa',          'LB', 73), p('Tomás Pozzo',        'RM', 74),
        p('Federico Ávalos',     'CM', 74), p('Matías Pérez',       'CM', 73),
        p('Facundo Colidio',     'LM', 76), p('Diego Morales',      'ST', 75),
        p('Sebastián Palacios',  'ST', 75),
      ],
      ratings: { attack: 75, midfield: 74, defense: 73, goalkeeping: 73 },
      source: 'Tigre — Argentine Primera 2025', teamLabel: 'Tigre (2025)',
      badgeUrl: '/img/badges/tigre.png',
    }},
  },

  'banfield': {
    slug: 'banfield', name: 'CA Banfield', group: '🌎 Argentina Primera',
    nameEn: 'Banfield', nameEs: 'Banfield', badgeLocalPath: '/img/badges/banfield.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Lucas Lazzaretti',    'GK', 74), p('Juan Cruz Cruz',     'RB', 73),
        p('Emmanuel Ojeda',      'CB', 74), p('Alejandro Cabrera',  'CB', 74),
        p('Francisco Grahl',     'LB', 73), p('Giuliano Galoppo',   'RM', 76),
        p('Alejandro Camargo',   'CM', 74), p('Pablo Troyansky',     'CM', 74),
        p('Mauricio Cuero',      'LM', 75), p('Jesús Dátolo Jr.',   'ST', 74),
        p('Nicolás Bertolo',     'ST', 75),
      ],
      ratings: { attack: 75, midfield: 75, defense: 73, goalkeeping: 73 },
      source: 'CA Banfield — Argentine Primera 2025', teamLabel: 'Banfield (2025)',
      badgeUrl: '/img/badges/banfield.png',
    }},
  },

  'godoy-cruz': {
    slug: 'godoy-cruz', name: 'Godoy Cruz', group: '🌎 Argentina Primera',
    nameEn: 'Godoy Cruz', nameEs: 'Godoy Cruz', badgeLocalPath: '/img/badges/godoy-cruz.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Juan Espínola',       'GK', 76), p('Damián Bracco',      'RB', 74),
        p('Tadeo Allende',       'CB', 75), p('Nelson Acevedo',     'CB', 75),
        p('Washington Camacho',  'LB', 74), p('Tomás Cardona',      'DM', 77),
        p('Renzo López',         'DM', 76), p('Juan Brunetta',      'RW', 76),
        p('Rodrigo Rey',         'AM', 75), p('Santiago García',    'LW', 75),
        p('Javier Correa',       'ST', 77),
      ],
      ratings: { attack: 77, midfield: 76, defense: 74, goalkeeping: 75 },
      source: 'Godoy Cruz — Argentine Primera 2025', teamLabel: 'Godoy Cruz (2025)',
      badgeUrl: '/img/badges/godoy-cruz.png',
    }},
  },

  'platense': {
    slug: 'platense', name: 'Club Atlético Platense', group: '🌎 Argentina Primera',
    nameEn: 'Platense', nameEs: 'Platense', badgeLocalPath: '/img/badges/platense.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Lucas Acosta',        'GK', 74), p('Jonatan Maidana',    'RB', 73),
        p('Santiago Larrañaga II','CB', 74), p('Lucas Florentin',   'CB', 73),
        p('Federico Vismara',    'LB', 73), p('Nahuel Zárate',      'RM', 74),
        p('Lautaro Díaz',        'CM', 74), p('Jonathan Herrera',   'CM', 73),
        p('Mauro Bogado',        'LM', 74), p('Milton Leyendeker',  'ST', 75),
        p('Gastón Lodico',       'ST', 74),
      ],
      ratings: { attack: 75, midfield: 74, defense: 73, goalkeeping: 73 },
      source: 'Platense — Argentine Primera 2025', teamLabel: 'Platense (2025)',
      badgeUrl: '/img/badges/platense.png',
    }},
  },

  'argentinos-juniors': {
    slug: 'argentinos-juniors', name: 'Argentinos Juniors', group: '🌎 Argentina Primera',
    nameEn: 'Argentinos Juniors', nameEs: 'Argentinos Juniors',
    badgeLocalPath: '/img/badges/argentinos-juniors.png',
    seasons: { '2025': {
      formation: '4-2-3-1',
      players: [
        p('Lucas Hoyos',         'GK', 75), p('Fabricio Oviedo',    'RB', 74),
        p('Luciano Merino',      'CB', 75), p('Diego Sosa',         'CB', 74),
        p('Luciano Papagni',     'LB', 74), p('Leonardo Rodríguez', 'DM', 75),
        p('Fausto Vera Jr.',     'DM', 74), p('Gabriel Hauche',     'RW', 75),
        p('Braian Romero',       'AM', 76), p('Matías Caruzzo Jr.', 'LW', 74),
        p('Santiago Solari Jr.', 'ST', 76),
      ],
      ratings: { attack: 76, midfield: 74, defense: 74, goalkeeping: 74 },
      source: 'Argentinos Juniors — Argentine Primera 2025', teamLabel: 'Argentinos Juniors (2025)',
      badgeUrl: '/img/badges/argentinos-juniors.png',
    }},
  },

  'union-santa-fe': {
    slug: 'union-santa-fe', name: 'Unión Santa Fe', group: '🌎 Argentina Primera',
    nameEn: 'Unión Santa Fe', nameEs: 'Unión Santa Fe',
    badgeLocalPath: '/img/badges/union-santa-fe.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Sebastián Moyano',    'GK', 75), p('Claudio Corvalán',   'RB', 73),
        p('Jonathan Bottinelli', 'CB', 76), p('Nicolás Paz',        'CB', 74),
        p('Claudio Corvalán Jr.','LB', 73), p('Mauro Pittón',       'RM', 76),
        p('Diego Zabala',        'CM', 74), p('Jonatan Caballero',   'CM', 76),
        p('Diego Villar Jr.',    'LM', 74), p('Nicolás Miracco',     'ST', 75),
        p('Facundo Farías',      'ST', 77),
      ],
      ratings: { attack: 77, midfield: 75, defense: 74, goalkeeping: 74 },
      source: 'Unión Santa Fe — Argentine Primera 2025', teamLabel: 'Unión Santa Fe (2025)',
      badgeUrl: '/img/badges/union-santa-fe.png',
    }},
  },

  'atletico-tucuman': {
    slug: 'atletico-tucuman', name: 'Atlético Tucumán', group: '🌎 Argentina Primera',
    nameEn: 'Atlético Tucumán', nameEs: 'Atlético Tucumán',
    badgeLocalPath: '/img/badges/atletico-tucuman.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Tomás Marchiori',     'GK', 75), p('Cristian Erbes',     'RB', 73),
        p('Marcos Miers',        'CB', 75), p('Sebastián Medina',   'CB', 74),
        p('Guillermo Acosta',    'LB', 73), p('Ramiro Carrera',     'RM', 77),
        p('Fernando Juárez Jr.', 'CM', 74), p('Rodrigo Aliendro Jr.','CM', 74),
        p('Leandro Díaz Jr.',    'LM', 74), p('Cristian Menéndez',  'ST', 76),
        p('Guillermo Ortiz',     'ST', 75),
      ],
      ratings: { attack: 76, midfield: 75, defense: 74, goalkeeping: 74 },
      source: 'Atlético Tucumán — Argentine Primera 2025', teamLabel: 'Atlético Tucumán (2025)',
      badgeUrl: '/img/badges/atletico-tucuman.png',
    }},
  },

  'sarmiento': {
    slug: 'sarmiento', name: 'CA Sarmiento', group: '🌎 Argentina Primera',
    nameEn: 'Sarmiento', nameEs: 'Sarmiento', badgeLocalPath: '/img/badges/sarmiento.png',
    seasons: { '2025': {
      formation: '4-4-2',
      players: [
        p('Alejandro Sánchez',   'GK', 73), p('Miguel Torrente',    'RB', 72),
        p('Jorge Ortiz',         'CB', 73), p('Leonardo Burián',    'CB', 73),
        p('Lucas Landa',         'LB', 72), p('Ezequiel Cerutti',   'RM', 74),
        p('Octavio Palacio',     'CM', 73), p('Cristóbal Saborido', 'CM', 73),
        p('Facundo Barceló',     'LM', 73), p('Damián Macaluso',    'ST', 74),
        p('Federico Vismara Jr.','ST', 73),
      ],
      ratings: { attack: 74, midfield: 73, defense: 72, goalkeeping: 72 },
      source: 'CA Sarmiento — Argentine Primera 2025', teamLabel: 'Sarmiento (2025)',
      badgeUrl: '/img/badges/sarmiento.png',
    }},
  },
};

// ── Apply updates ─────────────────────────────────────────────────────────────

let created = 0, updated = 0, skipped = 0;

// 1. Add 2025 seasons to existing files
for (const [slug, season] of Object.entries(SEASONS)) {
  const filePath = path.join(DIR, slug + '.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${slug}.json`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.seasons) data.seasons = {};
  if (data.seasons['2025']) {
    console.log(`⏭  Already has 2025: ${slug}`);
    skipped++;
    continue;
  }
  data.seasons['2025'] = season;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Updated: ${slug}`);
  updated++;
}

// 2. Create or update new squad files
for (const [slug, squadData] of Object.entries(NEW_SQUADS)) {
  const filePath = path.join(DIR, slug + '.json');
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!existing.seasons) existing.seasons = {};
    if (existing.seasons['2025']) {
      console.log(`⏭  Already has 2025: ${slug}`);
      skipped++;
      continue;
    }
    existing.seasons['2025'] = squadData.seasons['2025'];
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
    console.log(`✅ Updated existing: ${slug}`);
    updated++;
  } else {
    fs.writeFileSync(filePath, JSON.stringify(squadData, null, 2));
    console.log(`🆕 Created: ${slug}`);
    created++;
  }
}

console.log(`\n──────────────────────────────────────────`);
console.log(`Creados: ${created} | Actualizados: ${updated} | Omitidos: ${skipped}`);
console.log(`Total: ${created + updated} archivos modificados/creados`);
