/**
 * player_ratings.js — Fuente única de verdad para ratings individuales
 * ═══════════════════════════════════════════════════════════════════════
 * ~350 jugadores históricos + ~120 actuales (2023-26).
 * Prioridad en calcPlayerRating():
 *   1. Override por nombre (este fichero)
 *   2. mvToRating(marketValue) desde TM
 *   3. Media del equipo ± hash del nombre
 *
 * Compatible Node.js (require) + browser (window.*)
 */

'use strict';

/**
 * PLAYER_POSITIONS � correcci�n de posici�n para jugadores famosos
 * que en algunas bases de datos aparecen mal clasificados.
 * Normalizaci�n de nombre id�ntica a getPlayerOverride().
 */
const PLAYER_POSITIONS_RAW = [
  // Laterales que BDFutbol/TM registra a veces como CB
  ['paolo maldini',            'LB'],
  ['roberto carlos',           'LB'],
  ['cafu',                     'RB'],
  ['caf�',                     'RB'],
  ['philipp lahm',             'RB'],
  ['dani alves',               'RB'],
  ['dani alvez',               'RB'],
  ['gary neville',             'RB'],
  ['ashley cole',              'LB'],
  ['jordi alba',               'LB'],
  ['bixente lizarazu',         'LB'],
  ['carlos alberto',           'RB'],
  ['giacinto facchetti',       'LB'],
  ['mauro tassotti',           'RB'],
  ['christian panucci',        'RB'],
  ['albert ferrer',            'RB'],
  ['sergi roberto',            'RB'],
  ['roberto carlos',           'LB'],
  ['lilian thuram',            'RB'],
  ['frank de boer',            'CB'],
  ['marcelo vieira',           'LB'],  // a veces aparece como CM
  ['theo hernandez',           'LB'],
  ['achraf hakimi',            'RB'],
  ['trent alexander-arnold',   'RB'],
  ['andrew robertson',         'LB'],
  ['ferland mendy',            'LB'],
  ['reece james',              'RB'],
  ['joao cancelo',             'RB'],  // puede jugar los 2 lados
  ['alejandro grimaldo',       'LB'],
  ['alex grimaldo',            'LB'],
  ['dani carvajal',            'RB'],
  ['kyle walker',              'RB'],
  ['claudio gentile',          'RB'],
  ['antonio cabrini',          'LB'],
  ['julius cesar',             'GK'],
  ['julius cesar brasil',      'GK'],
  // ── Laterales modernos frecuentemente clasificados como CB en scrapers ──
  // Real Madrid
  ['alvaro carreras',          'LB'],  // RM LB 2024-25
  ['fran garcia',              'LB'],  // RM LB 2022-25 (distinto de Francesc Garcia)
  ['lucas vazquez',            'RB'],  // RM RB suplente
  ['nacho fernandez',          'CB'],  // RM CB
  // Barcelona
  ['jules kounde',             'RB'],  ['koundé',               'RB'],
  ['gerard martin',            'LB'],  // Barça LB 2024-25
  ['eric garcia',              'CB'],  // Barça CB
  // Bayern Munich
  ['alphonso davies',          'LB'],
  ['noussair mazraoui',        'RB'],  ['mazraoui',             'RB'],
  // Liverpool
  ['conor bradley',            'RB'],
  ['kostas tsimikas',          'LB'],  ['tsimikas',             'LB'],
  ['jarell quansah',           'CB'],
  // Man City
  ['manuel akanji',            'CB'],  ['akanji',               'CB'],
  ['joleon lescott',           'CB'],
  // Tottenham / PL
  ['pedro porro',              'RB'],
  ['kieran trippier',          'RB'],  ['trippier',             'RB'],
  ['nathaniel clyne',          'RB'],
  ['ben davies',               'LB'],
  ['ryan sessegnon',           'LB'],
  ['sergio reguilon',          'LB'],  ['reguilón',             'LB'],
  // Inter
  ['benjamin pavard',          'RB'],  ['pavard',               'RB'],
  ['denzel dumfries',          'RB'],
  ['carlos augusto',           'LB'],  // Inter LB
  ['matteo darmian',           'RB'],
  ['michele di gregorio',      'GK'],
  // Juventus
  ['juan cuadrado',            'RB'],  ['cuadrado',             'RB'],
  ['weston mckennie',          'CM'],
  ['andrea cambiaso',          'RB'],  // Juve can play RB or LB — primary RB
  ['nicolo fagioli',           'CM'],  ['nicolò fagioli',       'CM'],
  ['timothy weah',             'RW'],
  ['samuel mbangula',          'LW'],
  ['jonas rouhi',              'LB'],
  // AC Milan
  ['davide calabria',          'RB'],  ['calabria',             'RB'],
  ['theo hernandez',           'LB'],  // already overridden but duplicate for safety
  ['pierre kalulu',            'CB'],  ['kalulu',               'CB'],
  ['malick thiaw',             'CB'],  ['thiaw',                'CB'],
  ['tijjani reijnders',        'CM'],
  ['mike maignan',             'GK'],  // already GK in ratings
  // Atletico Madrid
  ['cesar azpilicueta',        'RB'],  ['azpilicueta',          'RB'],
  ['marcos llorente',          'CM'],
  ['nahuel molina',            'RB'],  // already ✓
  ['reinildo',                 'LB'],  ['reinildo mandava',     'LB'],
  ['rodrigo de paul',          'CM'],
  ['thomas lemar',             'LW'],  ['lemar',                'LW'],
  // Borussia Dortmund
  ['marius wolf',              'RB'],
  ['julian ryerson',           'RB'],  ['ryerson',              'RB'],
  ['ramy bensebaini',          'LB'],  ['bensebaini',           'LB'],
  ['niklas sule',              'CB'],  ['süle',                 'CB'], ['sule', 'CB'],
  ['nico schlotterbeck',       'CB'],  // already ✓
  ['emre can',                 'DM'],  // BVB/Juve DM
  // Manchester United
  ['diogo dalot',              'RB'],  ['dalot',                'RB'],
  ['victor lindelof',          'CB'],
  ['lisandro martinez',        'CB'],  ['martínez lisandro',    'CB'],
  ['tyrell malacia',           'LB'],
  ['luke shaw',                'LB'],
  // Arsenal
  ['cedric soares',            'RB'],  ['cedric',               'RB'],
  ['takehiro tomiyasu',        'RB'],  ['tomiyasu',             'RB'],
  ['kieran tierney',           'LB'],  ['tierney',              'LB'],
  ['oleksandr zinchenko',      'LB'],  // already ✓
  ['ben white',                'RB'],  // Arsenal play Ben White as RB
  // PSG
  ['achraf hakimi',            'RB'],  // already ✓ but extra safety
  ['nuno mendes',              'LB'],  ['mendes',               'LB'],
  ['milan skriniar',           'CB'],  ['škriniar',             'CB'], ['skriniar', 'CB'],
  ['marquinhos',               'CB'],  // already overridden? Let me ensure
  ['manuel ugarte',            'DM'],  // PSG DM
  // Real Sociedad / Spain
  ['andoni gorosabel',         'RB'],
  ['aritz elustondo',          'CB'],
  ['igor zubeldia',            'CB'],
  ['mikel oyarzabal',          'LW'],  // override from AM to LW for accuracy
  // Key forwards/wingers commonly mispositioned in scrapers
  ['mo salah',                 'RW'],  ['mohamed salah',         'RW'],  // Liverpool RW not LW
  ['raheem sterling',          'LW'],
  ['gabriel martinelli',       'LW'],  // Arsenal LW
  ['diogo jota',               'LW'],  // Liverpool LW/ST versatile
  ['cody gakpo',               'LW'],  // Liverpool LW
  ['nicolas jackson',          'ST'],  // Chelsea CF
  ['roberto firmino',          'ST'],  // Liverpool CF
  ['karim adeyemi',            'LW'],  ['adeyemi',               'LW'],
  ['jamie gittens',            'LW'],  ['gittens',               'LW'],  // BVB LW
  ['serhou guirassy',          'ST'],  ['guirassy',              'ST'],  // BVB/Stuttgart ST
  ['julian brandt',            'AM'],  // BVB AM
  // Key DMs/pivots not yet in positions map
  ['fabinho',                  'DM'],  // Liverpool/PSG DM pivot
  ['georginio wijnaldum',      'CM'],  ['wijnaldum',             'CM'],
  ['jordan henderson',         'CM'],  // Liverpool CM captain
  // Key forwards/wingers commonly mispositioned in scrapers
  ['mo salah',                 'RW'],  ['mohamed salah',         'RW'],  // Liverpool RW
  ['raheem sterling',          'LW'],
  ['gabriel martinelli',       'LW'],  // Arsenal LW
  ['diogo jota',               'LW'],  // Liverpool LW/ST
  ['cody gakpo',               'LW'],  // Liverpool LW
  ['nicolas jackson',          'ST'],  // Chelsea CF
  ['roberto firmino',          'ST'],  // Liverpool CF
  ['karim adeyemi',            'LW'],  ['adeyemi',               'LW'],
  ['jamie gittens',            'LW'],  ['gittens',               'LW'],  // BVB LW
  ['serhou guirassy',          'ST'],  ['guirassy',              'ST'],  // BVB/Stuttgart ST
  ['julian brandt',            'AM'],  // BVB AM
  // Key DMs/pivots not yet in positions map
  ['fabinho',                  'DM'],  // Liverpool/PSG DM
  ['georginio wijnaldum',      'CM'],  ['wijnaldum',             'CM'],
  ['jordan henderson',         'CM'],  // Liverpool captain
  ['jordan henderson',         'CM'],
  // Ajax
  ['devyne rensch',            'RB'],
  ['jorrel hato',              'LB'],
  // Misc Europe
  ['pedro neto',               'RW'],  // already ✓  
  ['noni madueke',             'RW'],  // already ✓
  ['malo gusto',               'RB'],  // already ✓
  ['jeremy doku',              'LW'],  ['jeremy doku',          'LW'],
  ['ryan gravenberch',         'DM'],  // Liverpool CM/DM — listed DM for better 4-3-3 fit
  ['manu kone',                'DM'],  ['kone manu',            'DM'],
  ['boubacar kamara',          'DM'],  ['kamara boubacar',      'DM'],
  ['ibrahim sangare',          'DM'],  ['sangaré',              'DM'],
  ['dominik szoboszlai',       'AM'],  // Liverpool AM
  ['dani olmo',                'AM'],  ['olmo dani',            'AM'],
  ['joao felix',               'AM'],  // already might be — ensure AM
  ['isco alarcon',             'AM'],  // already ✓ as isco
  ['matteo guendouzi',         'CM'],  // already ✓
  ['youri tielemans',          'CM'],  // already ✓
  ['amadou onana',             'DM'],  // Aston Villa/Belgium DM
  ['boubakar kouyate',         'DM'],
  // Centrocampistas que a veces aparecen como delanteros o defensas
  ['franz beckenbauer',        'CB'],
  ['lothar matthaus',          'CM'],
  ['javier zanetti',           'RB'],
  // Pivotes defensivos (aparecen como CM en TM)
  ['casemiro',                 'DM'],
  ['aurelien tchouameni',      'DM'],
  ['aur�lien tchouam�ni',      'DM'],
  ['rodri',                    'DM'],
  ['declan rice',              'DM'],
  ['joao neves',               'DM'],
  ['jo�o neves',               'DM'],
  ['granit xhaka',             'DM'],
  ['idrissa gueye',            'DM'],
  ['sofyan amrabat',           'DM'],
  ['wataru endo',              'DM'],
  ['frenkie de jong',          'CM'],
  // Extremos que TM registra como ST
  ['vinicius junior',          'LW'],
  ['raphinha',                 'RW'],
  ['kylian mbapp�',            'ST'],
  ['kylian mbappe',            'ST'],
  ['ousmane demb�l�',          'RW'],
  ['ousmane dembele',          'RW'],
  ['leroy sane',               'LW'],
  ['leroy san�',               'LW'],
  ['son heung-min',            'LW'],
  ['bukayo saka',              'RW'],
  ['sadio mane',               'LW'],
  ['sadio man�',               'LW'],
  ['luis diaz',                'LW'],
  ['luis d�az',                'LW'],
  ['bradley barcola',          'LW'],
  ['michael olise',            'RW'],
  ['lamine yamal',             'RW'],
  ['nico williams',            'LW'],
  // Additional 2025/26 position fixes
  ['jude bellingham',          'AM'],
  ['martin odegaard',          'AM'],
  ['martin ødegaard',          'AM'],
  ['arda guler',               'AM'],
  ['arda güler',               'AM'],
  ['kevin de bruyne',          'AM'],
  ['paulo dybala',             'AM'],
  ['julian alvarez',           'ST'],
  ['julián alvarez',           'ST'],
  ['julian alvarez atletico',  'ST'],
  ['freddie bellingham',       'CM'],
  ['mathys tel',               'ST'],
  ['silas wissa',              'LW'],
  ['mason greenwood',          'RW'],
  ['crysencio summerville',    'LW'],
  ['emile smith rowe',         'AM'],
  ['kaoru mitoma',             'LW'],
  ['oscar bobb',               'RW'],
  ['ademola lookman',          'RW'],
  ['florian wirtz',            'AM'],
  ['wirtz',                    'AM'],
  // WC2026 role adjustments
  ['mikel oyarzabal',          'ST'],   // CF/9 for Spain 2026 (overrides LW)
  ['dani olmo',                'CM'],   // interior CM for Spain 2026 (overrides AM)
  ['pedri',                    'AM'],   // dynamic #8 in Spain 2026 system
  ['rodrigo de paul',          'RM'],   // right midfield for Argentina 2026 (overrides CM)
];

const PLAYER_POSITIONS_MAP = new Map(PLAYER_POSITIONS_RAW);

/**
 * Si el jugador tiene una posici�n can�nica conocida, la devuelve.
 * Usa la misma normalizaci�n que getPlayerOverride.
 * @param {string} name
 * @returns {string|null} position code (GK/RB/CB/LB/DM/CM/AM/RW/LW/ST) o null
 */
function getPlayerPosition(name) {
  if (!name) return null;
  const normalize = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\-']/g, ' ').replace(/\s+/g, ' ').trim();
  const nl = normalize(name);
  const nameWords = new Set(nl.split(' '));
  for (const [key, pos] of PLAYER_POSITIONS_MAP) {
    const kn = normalize(key);
    const keyWords = kn.split(' ');
    if (kn === nl || keyWords.every(w => nameWords.has(w))) return pos;
  }
  return null;
}

/* eslint-disable key-spacing */
const PLAYER_RATINGS_RAW = [

  // ════════════════════════════════════════════════════════════════════
  // PORTEROS
  // ════════════════════════════════════════════════════════════════════
  // ── All-time greats ──
  ['lev yashin',             95], ['yashin',               95],
  ['gordon banks',           90],
  ['dino zoff',              91], ['zoff',                 91],
  ['sepp maier',             89], ['maier',                89],
  ['peter shilton',          87], ['shilton',              87],
  ['pat jennings',           87],
  ['ubaldo fillol',          87], ['fillol',               87],
  ['neville southall',       87], ['southall',             87],
  ['walter zenga',           85], ['zenga',                85],
  ['rene higuita',           82], ['higuita',              82],
  ['andoni zubizarreta',     86], ['zubizarreta',          86],
  ['peter schmeichel',       91], ['schmeichel',           91],
  ['oliver kahn',            92], ['kahn',                 92],
  ['gianluigi buffon',       89], ['buffon',               89],
  ['iker casillas',          88], ['casillas',             88],
  ['victor baia',            85],
  ['fabien barthez',         86], ['barthez',              86],
  ['brad friedel',           83],
  ['pepe reina',             84], ['reina',                84],
  ['manoel tobias',          82],
  ['jorge campos',           82], ['campos',               82],
  ['kasey keller',           82],
  ['carlos roa',             82],
  ['claudio taffarel',       86], ['taffarel',             86],
  ['thomas ravelli',         85],
  ['jean-marie pfaff',       87], ['pfaff',                87],
  ['vladimir beara',         88],
  ['gyula grosics',          88],
  ['marco ballotta',         80],
  ['francisco Buyo',         82], ['buyo',                 82], ['paco buyo',            82],
  // ── 2000s–2010s ──
  ['edwin van der sar',      89], ['van der sar',          89],
  ['petr čech',              88], ['cech',                 88], ['čech',     88],
  ['victor valdes',          86], ['víctor valdés',        86],
  ['julio cesar',            86], ['júlio césar',          86],
  ['gianluigi donnarumma',   90], ['donnarumma',           90],
  ['keylor navas',           86], ['navas',                86],
  ['david de gea',           87], ['de gea',               87],
  ['manuel neuer',           85], ['neuer',                85],
  ['hugo lloris',            87], ['lloris',               87],
  ['thibaut courtois',       91], ['courtois',             91],
  ['joe hart',               83],
  ['marc-andre ter stegen',  89], ['ter stegen',           89], ['marc-andré ter stegen', 89],
  ['jan oblak',              92], ['oblak',                92],
  // ── Actuales (2023-26) ──
  ['alisson becker',         91], // solo el portero del Liverpool — no el centrocampista del Fluminense
  ['ederson moraes',         88], ['ederson',              88],
  ['mike maignan',           87], ['maignan',              87],
  ['gregor kobel',           86], ['kobel',                86],
  ['andriy lunin',           85], ['lunin',                85],
  ['bono yassine',           85],
  ['diogo costa',            86],
  ['unai simon',             84], ['unai simón',           84],
  ['alex remiro',            84],
  ['lukasz fabianski',       82],
  ['wojciech szczesny',      86], ['szczęsny',             86],
  ['yann sommer',            86], ['sommer',               86],
  ['marcus flekken',         83],
  ['rui patricio',           85],

  // ════════════════════════════════════════════════════════════════════
  // DEFENSAS
  // ════════════════════════════════════════════════════════════════════
  // ── Leyendas absolutas ──
  ['franz beckenbauer',      96], ['beckenbauer',          96],
  ['franco baresi',          97], ['baresi',               97],
  ['paolo maldini',          97], ['maldini',              97],
  ['bobby moore',            92],
  ['gaetano scirea',         91], ['scirea',               91],
  ['cafu',                   90], ['cafú',                 90],
  ['carlos alberto',         90],
  ['giacinto facchetti',     90], ['facchetti',            90],
  ['daniel passarella',      88], ['passarella',           88],
  ['ruud krol',              86], ['krol',                 86],
  ['berti vogts',            85],
  ['emlyn hughes',           83],
  // ── 1990s–2000s ──
  ['roberto carlos',         91],
  ['cafu',                   90],
  ['fabio cannavaro',        93], ['cannavaro',            93],
  ['alessandro nesta',       93], ['nesta',                93],
  ['lilian thuram',          88], ['thuram',               88],
  ['bixente lizarazu',       86], ['lizarazu',             86],
  ['marcel desailly',        88], ['desailly',             88],
  ['laurent blanc',          87], ['blanc',                87],
  ['frank de boer',          86],
  ['carles puyol',           90], ['puyol',                90],
  ['nemanja vidic',          88], ['vidic',                88],
  ['rio ferdinand',          89], ['ferdinand',            89],
  ['john terry',             87], ['terry',                87],
  ['philipp lahm',           92], ['lahm',                 92],
  ['sergio ramos',           91], ['ramos',                91],
  ['giorgio chiellini',      89], ['chiellini',            89],
  ['leonardo bonucci',       87], ['bonucci',              87],
  ['gary neville',           85],
  ['ashley cole',            86],
  ['carlos puyol',           90],
  ['mike silvestre',         82],
  ['roberto ayala',          87], ['ayala',                87],
  ['julius aghahowa',        75],
  ['javier zanetti',         88], ['zanetti',              88],
  ['samuel eto',             92],
  ['david weir',             80],
  ['olof mellberg',          82],
  ['sami hyypia',            85], ['hyypiä',               85],
  // ── 2010s ──
  ['jordi alba',             86], ['alba',                 86],
  ['dani carvajal',          87], ['carvajal',             87],
  ['philipp lahm',           92],
  ['jerome boateng',         87], ['boateng',              87],
  ['mats hummels',           88], ['hummels',              88],
  ['gerard pique',           88], ['piqué',                88], ['pique', 88],
  ['pepe kellermann',        86],
  ['marcelo vieira',         87], ['marcelo brozovic',     86],
  ['david alaba',            87], ['alaba',                87],
  ['raphael varane',         89], ['raphaël varane',       89], ['varane', 89],
  ['jose gimenez',           85], ['giménez',              85],
  ['stefan de vrij',         86],
  // ── Actuales (2023-26) ──
  ['virgil van dijk',        91], ['van dijk',             91],
  ['ruben dias',             89], ['rúben dias',           89], ['dias',  89],
  ['william saliba',         86], ['saliba',               86],
  ['min-jae kim',            87], ['kim min-jae',          87],
  ['ronald araujo',          86], ['araújo',               86], ['araujo', 86],
  ['marquinhos',             87],
  ['antonio rudiger',        85], ['rüdiger',              85], ['rudiger', 85],
  ['eder militao',           86], ['éder militão',         86], ['militão', 86], ['militao', 86],
  ['joao cancelo',           86], ['joão cancelo',         86], ['cancelo', 86],
  ['trent alexander-arnold', 88], ['trent',                88],
  ['alex grimaldo',          85], ['grimaldo',             85],
  ['alejandro grimaldo',     85],
  ['inigo martinez',         83], ['iñigo martínez',       83],
  ['aymeric laporte',        86], ['laporte',              86],
  ['kyle walker',            85], ['walker',               85],
  ['theo hernandez',         88], ['théo hernandez',       88],
  ['achraf hakimi',          87], ['hakimi',               87],
  ['reece james',            86], ['reece james',          86],
  ['andrew robertson',       86], ['robertson',            86],
  ['ferland mendy',          85], ['mendy',                85],
  ['ibrahima konate',        86], ['konaté',               86], ['konate', 86],
  ['jules kounde',           86], ['koundé',               86], ['kounde', 86],
  ['ben white',              84],
  ['joe gomez',              83],
  ['nico schlotterbeck',     84], ['schlotterbeck',        84],
  ['nordi mukiele',          82],
  ['sergio gomez',           80],
  ['lucas hernandez',        84],
  ['presnel kimpembe',       83], ['kimpembe',             83],
  ['danilo luiz',            84], ['danilo',               84],

  // ════════════════════════════════════════════════════════════════════
  // CENTROCAMPISTAS
  // ════════════════════════════════════════════════════════════════════
  // ── All-time greats ──
  ['diego maradona',         99], ['maradona',             99],
  ['zinedine zidane',        96],
  ['johan cruyff',           98], ['cruyff',               98],
  ['michel platini',         96], ['platini',              96],
  ['ronaldinho',             96],
  ['lothar matthaus',        93], ['matthäus',             93], ['matthaus', 93],
  ['bobby charlton',         93],
  ['franz beckenbauer',      96],
  ['alfredo di stefano',     98], ['di stéfano',           98], ['di stefano', 98],
  ['socrates',               90],
  ['falcao uruguayo',        82],
  ['falcao el caballero',    89], ['falcão',               89],
  ['zico',                   92],
  ['didi',                   88],
  ['gerson',                 88],
  ['bryan robson',           87], ['robson',               87],
  ['graeme souness',         87], ['souness',              87],
  ['glen hoddle',            85], ['hoddle',               85],
  ['gunter netzer',          88], ['netzer',               88],
  ['gerd muller',            95], ['müller gerd',          95],
  ['josef masopust',         88],
  ['raymond kopa',           89],
  ['dzajic',                 86],
  ['cubillas',               87], ['teofilo cubillas',     87],
  ['mario kempes',           90], ['kempes',               90],
  ['osvaldo ardiles',        86], ['ardiles',              86],
  ['rivelino',               89],
  ['carlos valderrama',      87], ['valderrama',           87],
  // ── 1990s–2000s ──
  ['xavi hernandez',         93], ['xavi hernández',       93], ['xavi', 93],
  ['andres iniesta',         92], ['andrés iniesta',       92], ['iniesta', 92],
  ['andrea pirlo',           93], ['pirlo',                93],
  ['luka modric',            91], ['luka modrić',          91], ['modrić',  91], ['modric', 91],
  ['toni kroos',             91], ['kroos',                91],
  ['xabi alonso',            91],
  ['sergio busquets',        89], ['busquets',             89],
  ['frank lampard',          89], ['lampard',              89],
  ['steven gerrard',         89], ['gerrard',              89],
  ['paul scholes',           88], ['scholes',              88],
  ['ryan giggs',             88], ['giggs',                88],
  ['patrick vieira',         90], ['vieira',               90],
  ['claude makelele',        88], ['makélélé',             88], ['makelele', 88],
  ['clarence seedorf',       88], ['seedorf',              88],
  ['edgar davids',           85], ['davids',               85],
  ['roy keane',              88],
  ['paul gascoigne',         89], ['gascoigne',            89],
  ['david beckham',          87], ['beckham',              87],
  ['riquelme',               89], ['juan roman riquelme',  89],
  ['pablo aimar',            86], ['aimar',                86],
  ['yaya toure',             88], ['yaya touré',           88],
  ['cesc fabregas',          87], ['fàbregas',             87], ['fabregas', 87],
  ['mesut ozil',             88], ['özil',                 88], ['ozil',    88],
  ['sami hyypia',            85],
  ['roberto baggio',         92], ['baggio',               92],
  ['jose mari bakero',       82],
  ['michael laudrup',        90], ['laudrup',              90],
  ['brian laudrup',          87],
  ['fernando redondo',       89], ['redondo',              89],
  ['jose luis chilavert',    82], ['chilavert',            82], // goalkeeper/midfielder hybrid
  ['hector enrique',         82],
  ['tony adams',             85], ['adams',                85],
  ['patrick kluivert',       85], ['kluivert',             85],
  ['dennis bergkamp',        92], ['bergkamp',             92],
  ['marc overmars',          85], ['overmars',             85],
  ['ruud gullit',            93], ['gullit',               93],
  ['frank rijkaard',         89], ['rijkaard',             89],
  ['wesley sneijder',        88], ['sneijder',             88],
  ['philip cocu',            84],
  ['peter van vossen',       80],
  ['kaka',                   92],
  ['rivaldo',                93],
  ['melo',                   78],
  ['emerson',                84],
  ['deivid',                 78],
  // ── 2010s ──
  ['kevin de bruyne',        92], ['de bruyne',            92],
  ['eden hazard',            89], ['hazard',               89],
  ['casemiro',               83],
  ['pep guardiola',          88], ['guardiola',            88],
  ['isco alarcon',           84], ['isco',                 84],
  ['dani ceballos',          82], ['ceballos',             82],
  ['marco asensio',          83], ['asensio',              83],
  ['dani parejo',            84], ['parejo',               84],
  ['mikel oyarzabal',        85], ['oyarzabal',            85],
  ['david silva',            91],
  ['sergio canales',         83], ['canales',              83],
  ['thiago alcantara',       88], ['thiago alcântara',     88], ['thiago',  88],
  ['ivan rakitic',           87], ['rakitić',              87], ['rakitic', 87],
  ['ngolo kante',            91], ["n'golo kanté",         91], ['kante',   91],
  ['paul pogba',             86], ['pogba',                86],
  ['arturo vidal',           86], ['vidal',                86],
  ['lasse schone',           82],
  ['james rodriguez',        85], ['james rodríguez',      85], ['james',   85],
  ['giovanni dos santos',    80],
  ['santi cazorla',          85], ['cazorla',              85],
  ['mikel arteta',           84], ['arteta',               84],
  ['jack wilshere',          82],
  ['Coutinho',               85], ['philippe coutinho',    85], ['coutinho', 85],
  ['willian',                82],
  ['oscar',                  85],
  ['hulk',                   83],
  ['lucas moura',            82],
  ['paulinho',               82],
  // -- Actuales (2023-26) --
  ['rodrigo hernandez',      92], ['rodrigo hernandez cascante', 92], // Rodri Man City (no usar 'rodri' solo � colisiona)
  ['jude bellingham',        90], ['bellingham',           90],
  ['pedri',                  88],
  ['gavi',                   88],
  ['frenkie de jong',        88], ['de jong',              88],
  ['federico valverde',      88], ['valverde',             88],
  ['martin odegaard',        88], ['ødegaard',             88], ['odegaard', 88],
  ['declan rice',            88], ['rice',                 88],
  ['phil foden',             90], ['foden',                90],
  ['bernardo silva',         88],
  ['aurelien tchouameni',    88], ['tchouaméni',           88], ['tchouameni', 88],
  ['camavinga',              85],
  ['vitinha',                85],
  ['nicolo barella',         87], ['barella',              87],
  ['alexis mac allister',    86], ['mac allister',         86],
  ['dominik szoboszlai',     85], ['szoboszlai',           85],
  ['bruno fernandes',        88],
  ['kobbie mainoo',          83], ['mainoo',               83],
  ['florian wirtz',          90], ['wirtz',                90],
  ['jamal musiala',          90], ['musiala',              90],
  ['granit xhaka',           82], ['xhaka',                82],
  ['leandro trossard',       83], ['trossard',             83],
  ['tomas soucek',           82],
  ['matheus nunes',          83],
  ['ruben neves',            84], ['rúben neves',          84],
  ['joao palhinha',          84],
  ['enzo fernandez',         86], ['énzo fernandez',       86],
  ['moises caicedo',         86], ['caicedo',              86],
  ['manuel ugarte',          83],
  ['warren zaire-emery',     82],
  ['rayan cherki',           83],
  ['jamal musiala',          90],
  ['xavi simons',            85],
  ['sam lammers',            78],
  ['chris zirkzee',          81],
  ['mikel merino',           84], ['merino',               84],
  ['martin zubimendi',       84], ['zubimendi',            84],
  ['rodrigo bentancur',      83], ['bentancur',            83],
  ['alexis sanchez',         84], ['alexis sánchez',       84],

  // ════════════════════════════════════════════════════════════════════
  // DELANTEROS / EXTREMOS
  // ════════════════════════════════════════════════════════════════════
  // ── Inmortales ──
  ['pele',                   99], ['pelé',                 99],
  ['lionel messi',           99], ['leo messi',            99], ['messi',   99],
  ['cristiano ronaldo',      99],
  ['ronaldo nazario',        98], ['ronaldo nazário',      98], ['ronaldo fenomeno', 98],
  ['ronaldo',                98],  // R9 alias — historical JSONs often store just 'Ronaldo'
  ['franz beckenbauer',      96],
  ['alfredo di stefano',     98],
  ['ferenc puskas',          96], ['puskás',               96], ['puskas',  96],
  ['eusebio',                94], ['eusébio',              94], // ← Portuguese legend ONLY — full alias kept
  // NOTE: Eusébio Sacristán (Barcelona/Spain CM) has his own entry below
  ['garrincha',              94],
  ['george best',            95],
  ['gerd muller',            95], ['gerd müller',          95],
  // NOTE: bare 'müller' intentionally removed — it caused false positives for non-German players
  // (e.g. Brazilian Müller, Marcos Evangelista de Morais) who stored only their surname in the JSON.
  // Gerd Müller is covered by full-name entries above.
  ['just fontaine',          89], ['fontaine',             89],
  ['raymond kopa',           89],
  ['sandor kocsis',          90], ['kocsis',               90],
  ['helmut rahn',            87],
  ['fritz walter',           88],
  ['uwe seeler',             88], ['seeler',               88],
  ['karl-heinz rummenigge',  89], ['rummenigge',           89],
  ['roberto baggio',         92],
  ['michel',                 86], ['michel gonzalez',      86],
  ['emilio butragueno',      87], ['butragueño',           87],
  ['hugo sanchez',           90], ['hugo sánchez',         90],
  ['marco van basten',       98], ['van basten',           98],
  ['ruud van nistelrooy',    88], ['van nistelrooy',       88],
  ['george weah',            90], ['weah',                 90],
  ['hristo stoichkov',       91], ['stoichkov',            91],
  ['rivaldo',                93],
  ['romario',                94], ['romário',              94],
  ['zico',                   92],
  ['ronaldinho',             96],
  ['thierry henry',          93],
  ['david trezeguet',        87], ['trezeguet',            87],
  ['nicolas anelka',         85], ['anelka',               85],
  ['lothar matthaus fwd',    88],
  ['ruui gullit fwd',        88],
  // ── 1990s–2000s ──
  ['raul gonzalez',          88], ['raúl',                 88], ['raul',    88],
  ['Fernando Hierro',        87], ['hierro',               87],
  ['ivan helguera',          82], ['helguera',             82],  // UCL 2002 starter
  ['davor suker',            87], ['šuker',                87], ['suker',   87],
  ['robert prosinecki',      85], ['prosinečki',           85],
  ['predrag mijatovic',      84], ['mijatović',            84],
  ['christian vieri',        88], ['vieri',                88],
  ['filippo inzaghi',        85], ['inzaghi',              85],
  ['del piero',              90], ['alessandro del piero', 90],
  ['gabriel batistuta',      92], ['batistuta',            92], ['batigol',  92],
  ['hernan crespo',          85], ['crespo',               85],
  ['claudio lopez',          80],
  ['kevin keegan',           86], ['keegan',               86],
  ['kenny dalglish',         90], ['dalglish',             90],
  ['ian rush',               87],
  ['alan shearer',           88], ['shearer',              88],
  ['peter beardsley',        84], ['beardsley',            84],
  ['gary lineker',           87], ['lineker',              87],
  ['eric cantona',           89], ['cantona',              89],
  ['denis law',              90],
  ['michael owen',           87], ['owen',                 87],
  ['arjen robben',           89], ['robben',               89],
  ['franck ribery',          90], ['ribéry',               90], ['ribery',  90],
  ['gareth bale',            87], ['bale',                 87],
  ['zlatan ibrahimovic',     92], ['ibrahimovic',          92], ['ibrahimović', 92],
  ['samuel etoo',            92], ["eto'o",                92], ['samuel eto\'o', 92],
  ['didier drogba',          90], ['drogba',               90],
  ['wayne rooney',           89], ['rooney',               89],
  ['carlos tevez',           88], ['tevez',                88],
  ['sergio aguero',          90], ['agüero',               90], ['aguero',  90],
  ['andriy shevchenko',      91], ['shevchenko',           91],
  ['filippo inzaghi',        85],
  ['ole gunnar solskjaer',   82], ['solskjaer',            82],
  ['kaka',                   92],
  ['robinho',                84],
  ['adriano',                87], ['adriano imperador',    87],
  ['neymar',                 93],
  ['luis suarez',            91], ['luis suárez',          91],
  ['robin van persie',       88], ['van persie',           88],
  ['gio van bronckhorst',    83],
  ['franck ribery',          90],
  ['oliver bierhoff',        83], ['bierhoff',             83],
  ['luca toni',              84],
  ['gennaro gattuso',        84], ['gattuso',              84],
  ['ciro di marzio',         79],
  ['dario hübner',           79],
  ['peter crouch',           78],
  ['emile heskey',           77],
  ['freddie ljungberg',      84], ['ljungberg',            84],
  ['thierry henry',          93],
  ['nicolas anelka',         85],
  ['marc-vivien foe',        83],
  ['okocha',                 85], ['jay-jay okocha',       85],
  ['nii lamptey',            78],
  ['patrick mboma',          82], ['mboma',                82],
  ['elber',                  84],
  ['sergio conceicao',       80],
  ['jos stank',              78],
  // ── 2010s ──
  ['karim benzema',          91], ['benzema',              91],
  ['gonzalo higuain',        85], ['higuaín',              85], ['higuain',  85],
  ['david villa',            89],
  ['angel di maria',         88], ['ángel di maría',       88], ['di maria', 88], ['di maría', 88],
  ['robert lewandowski',     93], ['lewandowski',          93],
  ['harry kane',             90], ['kane',                 90],
  ['mo salah',               91], ['salah',                91], ['mohamed salah', 91],
  ['sadio mane',             89], ['sadio mané',           89], ['mané',    85],
  ['son heung-min',          88], ['son',                  88], ['heung-min', 88],
  ['antoine griezmann',      89], ['griezmann',            89],
  ['ousmane dembele',        87], ['dembélé',              87], ['dembele', 87],
  ['marco reus',             86], ['reus',                 86],
  ['thomas muller',          86], ['thomas müller',        86],  // Raumdeuter, CL/WC winner
  ['franck ribery',          90],
  ['arjen robben',           89],
  ['lamine yamal',           88],
  ['fernando torres',        87],
  ['alvaro morata',          83], ['morata',               83],
  // ── Jugadores históricos sin valor de mercado (scrapes antiguos) ──────────
  // Liverpool
  ['fabinho',                88], ['fabinho tavares',      88],
  ['georginio wijnaldum',    85], ['wijnaldum',            85], ['gini wijnaldum', 85],
  ['james milner',           81], ['milner',               81],
  ['naby keita',             83], ['naby keïta',           83],
  ['alex oxlade-chamberlain',82], ['oxlade-chamberlain',   82],
  ['adam lallana',           82], ['lallana',              82],
  ['joel matip',             83], ['matip',                83],
  ['dejan lovren',           81], ['lovren',               81],
  ['andy robertson',         86], // alias
  ['roberto firmino',        84], ['firmino',              84],  // bump from 83
  // Real Madrid clásicos sin datos TM
  ['isco',                   85], ['isco alarcon',         85],
  ['marcelo',                86], ['marcelo vieira',       86],
  ['nacho',                  82], ['nacho fernandez',      82],
  ['dani ceballos',          82],
  ['marco asensio',          83],
  // Ajax histórico
  ['frank rijkaard',         89], ['rijkaard',             89],
  ['ruud gullit',            93], ['gullit',               93],
  ['marco van basten',       98], ['van basten',           98],
  // Bayern histórico
  ['philipp lahm',           92], ['lahm',                 92],
  ['bastian schweinsteiger', 90], ['schweinsteiger',       90],
  ['thomas muller',          78],
  ['franck ribery',          90],
  ['arjen robben',           89],
  // Misc important players often without MV in scraped data
  ['mesut ozil',             88], ['özil',                 88],
  ['olivier giroud',         83], ['giroud',               83],
  ['cesc fabregas',          87], ['fàbregas',             87],
  ['santi cazorla',          85], ['cazorla',              85],
  ['mikel arteta',           84], ['arteta',               84],
  ['tomas rosicky',          84], ['rosický',              84],
  ['robin van persie',       88], ['van persie',           88],
  ['juan romero riquelme',   89], // alias
  ['javier zanetti',         88], ['zanetti',              88],
  ['gianluca zambrotta',     85], ['zambrotta',            85],
  ['filippo inzaghi',        85], ['inzaghi',              85],
  ['christian vieri',        88], ['vieri',                88],
  ['hernan crespo',          85], ['crespo',               85],
  ['andrei shevchenko',      91],
  ['andriy shevchenko',      91],
  ['clarence seedorf',       88], ['seedorf',              88],
  ['edgar davids',           85], ['davids',               85],
  ['paulo maldini',          97],      // typo alias
  ['gianfranco zola',        87], ['zola',                 87],
  ['pierre van hooijdonk',   83], ['van hooijdonk',        83],
  ['marc overmars',          85], ['overmars',             85],
  ['dennis bergkamp',        92], ['bergkamp',             92],
  ['thierry henry',          93],
  ['patrick kluivert',       85], ['kluivert',             85],
  ['davor suker',            87], ['šuker',                87], ['suker', 87],
  ['predrag mijatovic',      84],
  ['robert prosinecki',      85],
  ['fernando redondo',       89], ['redondo',              89],
  ['nicolas anelka',         85], ['anelka',               85],
  ['freddie ljungberg',      84], ['ljungberg',            84],
  ['robert pires',           87], ['pirès',                87], ['pires', 87],
  ['sylvain wiltord',        83], ['wiltord',              83],
  ['ray parlour',            80], ['parlour',              80],
  ['ashley cole',            86],
  ['sol campbell',           87], ['campbell sol',         87],
  ['tony adams',             85], ['adams',                85],
  ['lee dixon',              82], ['dixon',                82],
  ['nigel winterburn',       82], ['winterburn',           82],
  ['martin keown',           82], ['keown',                82],
  ['ian wright',             87], ['wright ian',           87],
  ['romelu lukaku',          85], ['lukaku',               85],
  ['pierre-emerick aubameyang', 84], ['aubameyang',        84],
  ['ciro immobile',          85], ['immobile',             85],
  ['dries mertens',          85], ['mertens',              85],
  ['roberto firmino',        83], ['firmino',              83],
  ['riyad mahrez',           85], ['mahrez',               85],
  ['nkunku',                 85], ['christopher nkunku',   85],
  ['kingsley coman',         83], ['coman',                83],
  ['leroy sane',             86], ['leroy sané',           86], ['sane',    86],
  ['serge gnabry',           85], ['gnabry',               85],
  ['christian pulisic',      83], ['pulisic',              83],
  ['joao felix',             84], ['joão félix',           84],
  ['vinicius jr',            92], ['vinícius jr',          92], ['vinícius', 92], ['vinicius',92],
  ['rodrygo',                86], ['rodrygo goes',         86],
  ['raphinha',               89], ['raphinha coutinho',    89],
  ['savinho',                86], ['estevao',              84], ['est�v�o',             84],
  ['gabriel martinelli',     85], ['martinelli',           85],
  ['bukayo saka',            88], ['saka',                 88],
  ['marcus rashford',        86], ['rashford',             86],
  ['jadon sancho',           84], ['sancho',               84],
  ['paulo dybala',           87], ['dybala',               87],
  ['lautaro martinez',       89], ['lautaro martínez',     89], ['lautaro', 89],
  ['dusan vlahovic',         86], ['vlahović',             86], ['vlahovic', 86],
  ['rafael leao',            88], ['rafael leão',          88], ['leão',    88], ['leao',   88],
  ['victor osimhen',         87], ['osimhen',              87],
  ['darwin nunez',           84], ['darwin núñez',         84], ['nunez',   84],
  ['diogo jota',             85], ['jota',                 85],
  ['cody gakpo',             84], ['gakpo',                84],
  ['ferran torres',          84],
  ['cole palmer',            88], ['palmer',               88],
  ['alejandro garnacho',     84], ['garnacho',             84],
  ['nicolas jackson',        82], ['jackson',              82],
  ['kylian mbappe',          96], ['mbappé',               96], ['mbappe',  96],
  ['erling haaland',         95], ['haaland',              95],
  ['victor gyokeres',        87], ['gyökeres',             87], ['gyokeres', 87],
  ['alexander isak',         87], ['isak',                 87],
  ['khvicha kvaratskhelia',  88], ['kvaratskhelia',        88], ['kvara',   88],
  ['nico williams',          87], ['nico',                 87],
  ['inaki williams',         83], ['iñaki williams',       83],
  ['marcus thuram',          85], ['thuram marcus',        85],
  ['randal kolo muani',      83], ['kolo muani',           83],
  ['gabriel jesus',          84], ['g.jesus',              84],
  ['ansu fati',              83], ['fati',                 83],
  ['fermin lopez',           82],
  ['ollie watkins',          85], ['watkins',              85],
  ['dominic solanke',        82],
  ['timo werner',            82], ['werner',               82],
  ['donyell malen',          82],
  ['breel embolo',           79],
  ['zeki celik',             79],
  ['loic remy',              80],
  ['youssef en-nesyri',      82], ['en-nesyri',            82],
  ['isaac romero',           80],
  ['artem dovbyk',           83], ['dovbyk',               83],
  ['joselu',                 80],
  ['tammy abraham',          81], ['abraham',              81],
  ['Michy Batshuayi',        78],
  ['ben yedder',             83], ['wissam ben yedder',    83],
  ['alvaro morata',          83],
  ['serhou guirassy',        84], ['guirassy',             84],
  ['loïs openda',            84], ['openda',               84],
  ['dani olmo',              86], ['olmo',                 86],
  ['ferran torres',          84],
  ['ayoze perez',            80],
  ['ante rebic',             81],
  ['niclas fullkrug',        83], ['füllkrug',             83], ['fullkrug', 83],
  ['harry maguire',          81],
  ['james maddison',         85], ['maddison',             85],
  ['aleksandar mitrovic',    84], ['mitrović',             84],
  ['wahbi khazri',           80],

  // ── Jugadores MLS / Saudi / históricos adicionales ──
  ['david beckham',          87],
  ['xherdan shaqiri',        82], ['shaqiri',              82],
  ['lorenzo insigne',        85], ['insigne',              85],
  ['sebastian giovinco',     83], ['giovinco',             83],
  ['blaise matuidi',         84], ['matuidi',              84],
  ['kalidou koulibaly',      86], ['koulibaly',            86],
  ['jordan henderson',       80], ['henderson',            80],
  ['roberto firmino',        83],
  ['riyad mahrez',           85],

  // -- FC Bayern (actuales) ---------------------------------------------
  ['joshua kimmich',         87], ['kimmich',              87],
  ['alphonso davies',        84], ['davies alphonso',      84],
  ['dayot upamecano',        83], ['upamecano',            83],
  ['jonathan tah',           82], ['tah',                  82],
  ['leon goretzka',          81], ['goretzka',             81],
  ['michael olise',          86], ['olise',                86],
  ['raphael guerreiro',      79],
  ['konrad laimer',          82], ['laimer',               82],
  ['josip stanisic',         76],
  ['aleksandar pavlovic',    81], ['pavlovic aleksandar',  81],
  ['min-jae kim',            84],
  ['harry kane',             90],
  ['thomas muller',          78],
  ['serge gnabry',           78],
  ['jamal musiala',          88],
  ['leroy sane',             84],

  // -- Real Madrid (actuales 2025) ---------------------------------------
  ['arda guler',             83], ['arda g�ler',           83],
  ['dean huijsen',           82], ['huijsen',              82],
  ['raul asencio',           80], ['asencio',              80],
  ['alvaro carreras',        81],
  ['endrick',                80],

  // -- Barcelona (actuales 2025) -----------------------------------------
  ['joan garcia',            83],
  ['pau cubarsi',            83], ['cubars�',              83], ['cubarsi', 83],
  ['alejandro balde',        84], ['balde',                84], ['alejandro balde', 84],
  ['gerard martin',          80],
  ['fermin lopez',           83], ['ferm�n',               83],
  ['eric garcia camara',     79],

  // -- Premier League (actuales 2025) ------------------------------------
  // England national team current squad
  ['jordan pickford',        85], ['pickford',             85],
  ['dean henderson',         80], ['henderson dean',       80],
  ['james trafford',         79],
  ['trent alexander-arnold', 88], ['alexander-arnold',     88],
  ['reece james',            85], ['james reece',          85],
  ['kyle walker',            82], ['walker kyle',          82],
  ['levi colwill',           85], ['colwill',              85],
  ['marc gu�hi',             85], ['marc guehi',           85], ['gu�hi',  85],
  ['john stones',            84], ['stones',               84],
  ['ezri konsa',             83], ['konsa',                83],
  ['jarell quansah',         81], ['quansah',              81],
  ['trevoh chalobah',        80], ['chalobah',             80],
  ['dan burn',               80], ['burn',                 80],
  ['myles lewis-skelly',     81], ['lewis-skelly',         81],
  ['tino livramento',        81], ['livramento',           81],
  ['djed spence',            79], ['spence',               79],
  ['nico o\'reilly',          79],
  ['adam wharton',           83], ['wharton',              83],
  ['conor gallagher',        83], ['gallagher',            83],
  ['curtis jones',           82], ['jones curtis',         82],
  ['jordan henderson',       80],
  ['elliot anderson',        80],
  ['ruben loftus-cheek',     82], ['loftus-cheek',         82],
  ['alex scott',             78],
  ['ivan toney',             82], ['toney',                82],
  ['dominic solanke',        82],
  ['noni madueke',           83], ['madueke',              83],
  // Other PL players
  ['chris wood',             82],
  ['morgan gibbs-white',     84], ['gibbs-white',          84],
  ['pedro neto',             83], ['pedro neto silva',     83],
  ['morgan rogers',          82],
  ['jhon duran',             82], ['duran jhon',           82],
  ['micky van de ven',       84], ['van de ven',           84],
  ['brennan johnson',        83], ['b.johnson',            83],
  ['nottm forest',           78],
  ['rasmus hojlund',         83], ['hojlund',              83],

  // -- Bundesliga (actuales 2025) ----------------------------------------
  ['hugo larsson',           81],
  ['can uzun',               82],
  ['omar marmoush',          85], ['marmoush',             85],
  ['jonathan burkardt',      82], ['burkardt',             82],
  ['christoph baumgartner',  82], ['baumgartner',          82],
  ['maximilian beier',       83], ['beier',                83],

  // -- Serie A (actuales 2025) -------------------------------------------
  ['matteo retegui',         84], ['retegui',              84],
  ['ademola lookman',        85], ['lookman',              85],
  ['sandro tonali',          85], ['tonali',               85],
  ['federico chiesa',        83], ['chiesa',               83],
  ['piotr zielinski',        84], ['zielinski',            84],
  ['hakan calhanoglu',       87], ['calhanoglu',           87], ['�alhanoglu', 87],
  ['matias vecino',          79],
  ['kristjan asllani',       80],
  ['yann bisseck',           81],

  // -- La Liga extra (actuales 2025) -------------------------------------
  ['david raya',             85], ['raya',                 85],
  ['ian maatsen',            83], ['maatsen',              83],
  ['konrad de la fuente',    80],
  ['takefusa kubo',          83], ['kubo',                 83],

  // -- Italy national team (2025) ---------------------------------------
  ['gianluigi donnarumma',   90], ['donnarumma',           90],
  ['giovanni di lorenzo',    83], ['di lorenzo',           83],
  ['andrea cambiaso',        87], ['cambiaso',             87],
  ['destiny udogie',         85], ['udogie',               85],
  ['matteo ruggeri',         82],
  ['luca ranieri',           79],
  ['federico dimarco',       89], ['dimarco',              89],
  ['davide frattesi',        86], ['frattesi',             86],
  ['nicol� barella',         87], ['barella',              87], ['nicolo barella', 87],
  ['cesare casadei',         84], ['casadei',              84],
  ['manuel locatelli',       84], ['locatelli',            84],
  ['giacomo raspadori',      85], ['raspadori',            85],
  ['riccardo orsolini',      83], ['orsolini',             83],
  ['mattia zaccagni',        84], ['zaccagni',             84],
  ['matteo politano',        82], ['politano',             82],
  ['nicolo cambiaghi',       82], ['cambiaghi',            82],
  ['pio esposito',           85], ['esposito',             85],
  ['moise kean',             85], ['kean',                 85],
  ['gianluca scamacca',      84], ['scamacca',             84],
  ['lorenzo lucca',          83], ['lucca',                83],
  ['daniel maldini',         80], ['maldini daniel',       80],
  ['bryan cristante',        80], ['cristante',            80],

  // -- Spain national team (2025) extra ---------------------------------
  ['alejandro grimaldo',     88], ['grimaldo',             88],
  ['marc cucurella',         87], ['cucurella',            87],
  ['robin le normand',       88], ['le normand',           88],
  ['aymeric laporte',        84], ['laporte',              84],
  ['dani carvajal',          87], ['carvajal',             87],
  ['pedro porro',            87], ['porro',                87],
  ['pablo barrios',          84], ['barrios',              84],
  ['mikel merino',           86], ['merino',               86],
  ['fabi�n ruiz',            87], ['fabian ruiz',          87],
  ['joselu',                 80],
  ['alvaro morata',          83], ['morata',               83],
  ['alex baena',             86], ['baena',                86],
  ['bryan gil',              82], ['gil bryan',            82],

  // -- Germany national team (2025) extra -------------------------------
  ['antonio r�diger',        87], ['rudiger',              87], ['r�diger', 87],
  ['nico schlotterbeck',     85], ['schlotterbeck',        85],
  ['benjamin henrichs',      82], ['henrichs',             82],
  ['david raum',             83], ['raum',                 83],
  ['florian wirtz',          91], ['wirtz',                91],
  ['kai havertz',            86], ['havertz',              86],
  ['toni kroos',             89], ['kroos',                89],
  ['ilkay g�ndogan',         86], ['gundogan',             86], ['g�ndogan', 86],
  ['julian brandt',          84], ['brandt',               84],
  ['niclas fullkrug',        83], ['fullkrug',             83],
  ['deniz undav',            82], ['undav',                82],

  // -- Portugal national squad (2025) extra -----------------------------
  ['r�ben dias',             89], ['ruben dias',           89], ['dias ruben', 89],
  ['bernardo silva',         89], ['b.silva',              89],
  ['vitinha',                87],
  ['joao felix',             84], ['jo�o f�lix',           84],
  ['rafael leao',            88], ['le�o',                 88],
  // CR7 current form — DO NOT override the all-time 99 entry above (Map last-wins);
  // actual rating is set by the definitive entry ['cristiano ronaldo', 99] earlier.
  // ['cristiano ronaldo', 88] removed to avoid overwriting legendary peak.
  ['nuno mendes',            87], ['mendes nuno',          87],
  ['ruben neves',            85], ['neves ruben',          85],
  ['pedro neto',             83],
  ['francisco conceicao',    85], ['francisco concei��o',  85], ['chico concei��o', 85],
  ['diogo costa',            86], ['d.costa',              86],

  // -- Belgium (2025) ----------------------------------------------------
  ['romelu lukaku',          85], ['lukaku',               85],
  ['kevin de bruyne',        90], ['de bruyne',            90], ['kdb',     90],
  ['youri tielemans',        84], ['tielemans',            84],
  ['axel witsel',            80], ['witsel',               80],
  ['amadou onana',           86], ['onana amadou',         86],
  ['charles de ketelaere',   85], ['de ketelaere',         85], ['cdk',    85],
  ['lo�s openda',             84], ['openda',               84],
  ['arthur theate',          83], ['theate',               83],
  ['wout faes',              82], ['faes',                 82],
  ['leandro trossard',       84], ['trossard',             84],
  ['jeremy doku',            85], ['doku',                 85],
  ['yannick carrasco',       83], ['carrasco',             83],
  ['timothy castagne',       82], ['castagne',             82],
  ['jan vertonghen',         80], ['vertonghen',           80],

  // -- Netherlands (2025) -----------------------------------------------
  ['virgil van dijk',        89], ['van dijk',             89],
  ['stefan de vrij',         85], ['de vrij',              85],
  ['denzel dumfries',        86], ['dumfries',             86],
  ['nathan ake',             85], ['ak�',                  85], ['ake',    85],
  ['frenkie de jong',        87], ['f. de jong',           87],
  ['ryan gravenberch',       87], ['gravenberch',          87],
  ['tijjani reijnders',      86], ['reijnders',            86],
  ['wout weghorst',          80], ['weghorst',             80],
  ['memphis depay',          83], ['memphis',              83],
  ['steven berghuis',        82], ['berghuis',             82],
  ['quinten timber',         84], ['timber quinten',       84],
  ['jurrien timber',         85], ['j.timber',             85],
  ['xavi simons',            86], ['simons',               86],
  ['donyell malen',          83],
  ['brian brobbey',          83], ['brobbey',              83],
  ['mike maignan',           87], ['maignan',              87],

  // -- France CB / defenders extra ---------------------------------------
  ['william saliba',         86], ['saliba',               86],
  ['ibrahima konat�',        86], ['konate',               86], ['konat�',  86],
  ['theo hernandez',         88], ['theo hern�ndez',       88], ['t.hernandez', 88],
  ['malo gusto',             84], ['gusto',                84],
  ['adrien rabiot',          84], ['rabiot',               84],
  ['matteo guendouzi',       83], ['guendouzi',            83],
  ['marcus thuram',          86], ['thuram',               86],
  ['kingsley coman',         84], ['coman',                84],
  ['randal kolo muani',      84], ['kolo muani',           84],
  ['jean-philippe mateta',   83], ['mateta',               83],

  // -- Argentina extra ---------------------------------------------------
  ['emiliano martinez',      86], ['dibu martinez',        86],
  ['nahuel molina',          86], ['molina',               86],
  ['nicolas tagliafico',     81], ['tagliafico',           81],
  ['nicholas otamendi',      79], ['otamendi',             79],
  ['marcos senesi',          85], ['senesi',               85],
  ['exequiel palacios',      87], ['palacios',             87],
  ['alan varela',            83], ['varela alan',          83],
  ['nicolas de la cruz',     85], ['de la cruz',           85],
  ['giorgian de arrascaeta', 84], ['arrascaeta',           84], ['de arrascaeta', 84],
  ['valent�n barco',         80], ['barco',                80],
  ['franco mastantuono',     82], ['mastantuono',          82],
  ['joaquin correa',         82], ['correa',               82],
  ['giovani lo celso',       84], ['lo celso',             84],
  ['nico paz',               84], ['paz nico',             84],
  ['rodrigo de paul',        85], ['de paul',              85],
  ['enzo fernandez',         86], ['enzo fern�ndez',       86],
  ['alexis mac allister',    86], ['mac allister',         86],

  // -- Uruguay extra -----------------------------------------------------
  ['jose maria gimenez',     85], ['gimenez jose',         85], ['gim�nez',  85],
  ['mathias olivera',        85], ['olivera mathias',      85],
  ['federico valverde',      88], ['valverde',             88],
  ['rodrigo bentancur',      83], ['bentancur',            83],
  ['lucas torreira',         84], ['torreira',             84],
  ['manuel ugarte',          83], ['ugarte',               83],
  ['darwin nunez',           84], ['darwin n��ez',         84],
  ['facundo torres',         84], ['torres facundo',       84],
  ['nicolas de la cruz',     85],

  // -- Norway extra ------------------------------------------------------
  ['martin odegaard',        89], ['�degaard',             89], ['odegaard', 89],
  ['erling haaland',         95], ['haaland',              95],
  ['julian ryerson',         83], ['ryerson',              83],
  ['marcus pedersen',        81], ['pedersen marcus',      81],
  ['fredrik bjorkan',        80], ['bj�rkan',              80], ['bjorkan', 80],
  ['leo ostigard',           81], ['�stig�rd',             81], ['ostigard', 81],
  ['antonio nusa',           85], ['nusa',                 85],
  ['oscar bobb',             85], ['bobb',                 85],
  ['jorgen strand larsen',   84], ['strand larsen',        84],
  ['andreas schjelderup',    83], ['schjelderup',          83],

  // -- Morocco extra -----------------------------------------------------
  ['achraf hakimi',          89], ['hakimi',               89],
  ['noussair mazraoui',      87], ['mazraoui',             87],
  ['brahim diaz',            86], ['brahim d�az',          86],
  ['hakim ziyech',           85], ['ziyech',               85],
  ['sofyan amrabat',         86], ['amrabat',              86],
  ['youssef en-nesyri',      82], ['en-nesyri',            82],
  ['nayef aguerd',           87], ['aguerd',               87],
  ['romain saiss',           79],
  ['amine adli',             83], ['adli',                 83],
  ['ilias akhomach',         82],
  ['eliesse ben seghir',     85], ['ben seghir',           85],
  ['bilal el khannouss',     85], ['el khannouss',         85],

  // -- Colombia extra ----------------------------------------------------
  ['james rodriguez',        85], ['james rodr�guez',      85],
  ['luis diaz',              90], ['luis d�az',            90],
  ['jhon cordoba',           82], ['c�rdoba',              82],
  ['daniel munoz',           86], ['mu�oz daniel',         86],
  ['davinson sanchez',       85], ['s�nchez davinson',     85],
  ['jhon lucumi',            85], ['lucumi',               85],
  ['richard rios',           84], ['r�os richard',         84],
  ['yaser asprilla',         84], ['asprilla',             84],
  ['jhon arias',             84], ['arias jhon',           84],
  ['cucho hernandez',        84], ['hern�ndez cucho',      84],
  ['jhon duran',             82],
  ['rafael borre',           82], ['borr�',                82],
  ['juan cuadrado',          81], ['cuadrado',             81],

  // -- Croatia extra -----------------------------------------------------
  ['luka modric',            91], ['modric',               91], ['modric', 91],
  ['mateo kovacic',          87], ['kovacic',              87], ['kovacic', 87],
  ['josko gvardiol',         90], ['gvardiol',             90],
  ['lovro majer',            84], ['majer',                84],
  ['josip sutalo',           85], ['sutalo',               85],
  ['martin baturina',        83], ['baturina',             83],
  ['andrej kramaric',        83], ['kram??ic',             83], ['kramaric', 83],
  ['petar musa',             81], ['musa petar',           81],
  ['igor matanovic',         82], ['matanovic',            82],

  // -- Japan extra -------------------------------------------------------
  ['hiroki ito',             87], ['ito hiroki',           87],
  ['ritsu doan',             84], ['doan',                 84],
  ['kaoru mitoma',           88], ['mitoma',               88],
  ['wataru endo',            83], ['endo',                 83],
  ['hidemasa morita',        84], ['morita',               84],
  ['daichi kamada',          84], ['kamada',               84],
  ['daizen maeda',           82], ['maeda',                82],
  ['takumi minamino',        84], ['minamino',             84],
  ['koki machida',           82], ['machida',              82],
  ['ko itakura',             84], ['itakura',              84],
  ['kyogo furuhashi',        84], ['furuhashi',            84],
  ['yukinari sugawara',      83], ['sugawara',             83],
  ['reo hatate',             83], ['hatate',               83],

  // -- Senegal extra -----------------------------------------------------
  ['sadio mane',             89], ['man�',                 89], ['mane',   89],
  ['ismaila sarr',           85], ['sarr ismaila',         85],
  ['kalidou koulibaly',      86], ['koulibaly',            86],
  ['pape matar sarr',        87], ['p.m. sarr',            87],
  ['habib diarra',           83], ['diarra habib',         83],
  ['lamine camara',          84], ['laminage camara',      84],
  ['edouard mendy',          82], ['e.mendy',              82],
  ['yehvann diouf',          82], ['diouf',                82],
  ['ismail jakobs',          82], ['jakobs',               82],
  ['el hadji malick diouf',  84], ['m.diouf',              84],
  ['iliman ndiaye',          83], ['i.ndiaye',             83],
  ['boulaye dia',            83], ['dia boulaye',          83],
  ['nicolas jackson',        83],

  // -- Nigeria extra -----------------------------------------------------
  ['victor osimhen',         87], ['osimhen',              87],
  ['victor boniface',        86], ['boniface',             86],
  ['ademola lookman',        85], ['lookman',              85],
  ['samuel chukwueze',       83], ['chukwueze',            83],
  ['alex iwobi',             82], ['iwobi',                82],
  ['wilfred ndidi',          83], ['ndidi',                83],
  ['calvin bassey',          84], ['bassey',               84],
  ['ola aina',               84], ['aina',                 84],
  ['maduka okoye',           81], ['okoye',                81],

  // -- Ghana extra -------------------------------------------------------
  ['mohammed kudus',         87], ['kudus',                87],
  ['thomas partey',          84], ['partey',               84],
  ['antoine semenyo',        84], ['semenyo',              84],
  ['kamaldeen sulemana',     83], ['k.sulemana',           83],
  ['inaki williams',         83], ['��aki williams',       83],
  ['ibrahim osman',          82], ['i.osman',              82],
  ['ernest nuamah',          83], ['nuamah',               83],
  ['abdul fatawu',           82], ['fatawu',               82],
  ['tariq lamptey',          83], ['lamptey',              83],
  ['gideon mensah',          79],
  ['derrick kohn',           80], ['k�hn',                 80],
  ['mohammed salisu',        84], ['salisu',               84],
  ['ibrahim sulemana',       82], ['ibrahim sulemana ibrahim', 82],
  ['salis abdul samed',      81], ['samed',                81],

  // -- Turkey extra -----------------------------------------------------
  ['hakan calhanoglu',       87], ['�alhanoglu',           87],
  ['arda guler',             85], ['arda g�ler',           85],
  ['kenan yildiz',           88], ['kenan yildiz',         88],
  ['ferdi kadioglu',         87], ['kadioglu',             87],
  ['kerem akt�rkoglu',       84], ['akt�rkoglu',           84], ['akturkoglu', 84],
  ['orkun kokcu',            84], ['k�k��',                84], ['kokcu',   84],
  ['ugurcan cakir',          84], ['�akir',                84], ['cakir',   84],
  ['baris alper yilmaz',     84], ['baris alper yilmaz',   84],
  ['merih demiral',          84], ['demiral',              84],

  // -- Ukraine extra -----------------------------------------------------
  ['andriy lunin',           85], ['lunin',                85],
  ['ilya zabarnyi',          87], ['zabarnyi',             87],
  ['oleksandr zinchenko',    83], ['zinchenko',            83],
  ['mykhailo mudryk',        83], ['mudryk',               83],
  ['vitaliy mykolenko',      83], ['mykolenko',            83],
  ['georgiy sudakov',        85], ['sudakov',              85],
  ['artem dovbyk',           83], ['dovbyk',               83],
  ['yegor yarmolyuk',        84], ['yarmolyuk',            84],
  ['anatoliy trubin',        85], ['trubin',               85],

  // -- Serbia extra -----------------------------------------------------
  ['dusan vlahovic',         86], ['vlahov�c',             86],
  ['aleksandar mitrovic',    84], ['a.mitrovic',           84],
  ['nikola milenkovic',      86], ['milenkovic',           86],
  ['strahinja pavlovic',     85], ['s.pavlovic',           85],
  ['ivan ilic',              85], ['ilic',                 85], ['ilic',   85],
  ['lazar samardzic',        84], ['samard�ic',            84],
  ['filip kostic',           82], ['kostic',               82], ['kostic',  82],
  ['djordje petrovic',       83], ['d.petrovic',           83],
  ['kosta nedeljkovic',      82], ['nedeljkovic',          82],
  ['andrija zivkovic',       82], ['�ivkovic',             82],

  // -- Miscellaneous WC2026 nations -------------------------------------
  ['keylor navas',           84], ['navas',                84],
  ['manfred ugalde',         84], ['ugalde',               84],
  ['iliman ndiaye',          83],
  ['ronaldo araujo',         86], ['araujo ronald',        86],
  ['abdukodir khusanov',     83], ['khusanov',             83],
  ['kang-in lee',            87], ['lee kang-in',          87],
  ['heung-min son',          88], ['son',                  88],
  ['hee-chan hwang',         85], ['hwang',                85],
  ['piero hincapie',         87], ['hincapi�',             87],
  ['willian pacho',          87], ['pacho',                87],
  ['mois�s caicedo',         86], ['caicedo',              86],
  ['pervis estupinian',      85], ['estupi��n',            85], ['estupinian', 85],
  ['lautaro martinez',       89], ['lautaro mart�nez',     89],
  ['julian alvarez',         89], ['juli�n �lvarez',       89],
  // Messi current form — same as CR7: definitive entry ['lionel messi', 99] wins.
  // ['lionel messi', 88] removed to preserve the legendary all-time rating.
  ['paulo dybala',           86], ['dybala',               86],
  ['min-jae kim',            87], ['kim min-jae',          87],
  ['joel pohjanpalo',        82], ['pohjanpalo',           82],
  ['leon bailey',            84], ['bailey leon',          84],
  ['levi garcia',            82], ['levi garc�a',          82], ['garcia levi', 82],
  ['achraf hakimi',          90],
  ['andre de jong nz',       82],
  ['marko stamenic',         81], ['stamenic',             81],
  ['chris wood',             82],

  // ── 2025/26 season — updated & new entries ────────────────────────────────
  // Updated ratings (hyperrealistic 2025/26 form)
  ['florian wirtz',          93], ['wirtz',                93],
  ['jamal musiala',          92], ['musiala',              92],
  ['lamine yamal',           91],
  ['vinicius junior',        93], ['vinicius',             93],
  ['rodrygo',                90], ['rodrygo goes',         90],
  ['jude bellingham',        91], ['bellingham',           91],
  ['kylian mbappe',          94], ['kylian mbappé',        94],
  ['martin odegaard',        89], ['martin ødegaard',      89], ['ødegaard',    89],
  ['arda guler',             87], ['arda güler',           87], ['guler',        87],
  ['joao neves',             91], ['joão neves',           91],
  ['bernardo silva',         92],
  ['ruben dias',             90], ['rúben dias',           90],
  ['nicolas barella',        90], ['nicolo barella',       90],
  ['pedri',                  90], ['pedri gonzalez',       90],
  ['bukayo saka',            90],
  ['julian alvarez',         91], ['julián alvarez',       91], ['julián álvarez', 91],
  ['darwin nunez',           87], ['darwin núñez',         87],
  ['julian araujo',          79],
  // New entrants: key WC2026 players not previously rated
  ['martin zubimendi',       87], ['zubimendi',            87],
  ['viktor gyokeres',        88], ['viktor gyökeres',      88], ['gyokeres',     88],
  ['mathys tel',             85], ['tel',                  85],
  ['ademola lookman',        88], ['lookman',              88],
  ['silas wissa',            86], ['wissa silas',          86],
  ['yoane wissa',            84], ['wissa yoane',          84],
  ['castello lukeba',        85], ['lukeba',               85],
  ['jean-clair todibo',      86], ['todibo',               86],
  ['mason greenwood',        86], ['greenwood',            86],
  ['jarrad branthwaite',     84], ['branthwaite',          84],
  ['aymen hussein',          82],
  ['mousa al-taamari',       82], ['mousa taamari',        82],
  ['cecilio waterman',       82], ['waterman',             82],
  ['adalberto carrasquilla', 81], ['carrasquilla',         81],
  ['lamine camara',          83],
  ['nicolas seiwald',        82], ['seiwald',              82],
  ['carlos baleba',          84], ['baleba',               84],
  ['mats wieffer',           82], ['wieffer',              82],
  ['jorge martin odegaard',  89],
  ['crysencio summerville',  83], ['summerville',          83],
  ['emile smith rowe',       84], ['smith rowe',           84],
  ['kaoru mitoma',           89], ['mitoma',               89],
  ['ian maatsen',            83], ['maatsen',              83],
  ['endrick',                83],
  ['nico paz',               85], ['paz nico',             85],
  ['franco mastantuono',     84], ['mastantuono',          84],
  ['aleksandr golovin',      79], ['golovin',              79],
  ['pierre-emile hojbjerg',  83], ['højbjerg',             83],
  ['jonathan burkardt',      82], ['burkardt',             82],
  ['oscar bobb',             84], ['bobb',                 84],
  ['benjamin sesko',         86], ['sesko',                86], ['benjamin šeško', 86],
  ['nicolas caisedo',        88], ['moisés caicedo',       88], ['caicedo',      88],
  ['moisés caicedo',         88],
  ['joelinton',              82],
  ['sandro tonali',          85], ['tonali',               85],

  // ════════════════════════════════════════════════════════════════════
  // LEYENDAS HISTÓRICAS — players missing from old squad JSONs
  // ════════════════════════════════════════════════════════════════════

  // ── Alemania / Germany ───────────────────────────────────────────
  ['jurgen klinsmann',       88], ['klinsmann',            88], ['jürgen klinsmann', 88],
  ['rudi voller',            85], ['völler',               85], ['voller',           85],
  ['andreas brehme',         87], ['brehme',               87], // scored winning penalty 1990 WC
  ['jurgen kohler',          84], ['kohler',               84], ['jürgen kohler',    84],
  ['thomas hassler',         83], ['häßler',               83], ['hässler',          83],
  ['pierre littbarski',      82], ['littbarski',           82],
  ['guido buchwald',         83], ['buchwald',             83], // marked Maradona 1990 SF
  ['bodo illgner',           83], ['illgner',              83],
  ['ulf kirsten',            82], ['kirsten',              82],
  ['bernd schuster',         88], ['schuster',             88], // controversial genius
  ['harold schumacher',      83], ['schumacher',           83], ['toni schumacher', 83],
  ['heinz flohe',            82], ['flohe',                82],
  ['rainer bonhof',          83], ['bonhof',               83],
  ['wolfgang overath',       86], ['overath',              86], // 1966/70/74 playmaker
  ['bernd holzenbein',       81], ['hölzenbein',           81],

  // ── Argentina ────────────────────────────────────────────────────
  ['jorge burruchaga',       83], ['burruchaga',           83], // scored 3-2 in 1986 WC final
  ['claudio caniggia',       86], ['caniggia',             86],
  ['jorge valdano',          82], ['valdano',              82],
  ['oscar ruggeri',          83], ['ruggeri',              83],
  ['daniel bertoni',         80], ['bertoni',              80],
  ['leopoldo luque',         80], ['luque',                80],
  ['rene houseman',          80], ['houseman',             80],
  ['jorge carrascosa',       79], ['carrascosa',           79],
  ['amelrico gallego',       81], ['gallego',              81], ['américo gallego', 81],
  ['hugo gatti',             82], ['gatti',                82],
  ['pedro pasculli',         79], ['pasculli',             79],
  ['juan sebastian veron',   86], ['verón',                86], ['veron',           86],
  ['marcelo gallardo',       83], ['gallardo',             83],

  // ── Brasil / Brazil ───────────────────────────────────────────────
  ['jairzinho',              88], // scored in every 1970 WC game
  ['tostao',                 87], ['tostão',               87],
  ['clodoaldo',              83],
  ['bebeto',                 87], ['josé roberto gama',    87], // 1994 WC – baby celebration
  ['leonidas',               87], ['leônidas',             87], ['leonidas da silva', 87],
  ['ademir',                 86], // 1950 WC, top scorer
  ['careca',                 87], // 1986/1990 WC striker
  ['junior',                 84], ['junior leandro',       84], // 1982/1986 WC LB
  ['cerezo',                 83], ['toninho cerezo',       83],
  ['edu',                    82], ['edu coimbra',          82],
  ['eder',                   83], ['éder',                 83], // 1982 WC – the Eder goal
  ['paulo roberto falcao',   89], // covered above as falcão but add full name alias
  ['didier',                 82],

  // ── Francia / France ──────────────────────────────────────────────
  ['alain giresse',          85], ['giresse',              85],
  ['jean tigana',            84], ['tigana',               84],
  ['luis fernandez',         82], ['fernandez luis',       82],
  ['manuel amoros',          82], ['amoros',               82],
  ['jean-pierre papin',      87], ['papin',                87],
  ['youri djorkaeff',        83], ['djorkaeff',            83],
  ['emmanuel petit',         85], ['petit',                85],
  ['didier deschamps',       84], ['deschamps',            84],
  ['marius tresor',          83], ['trésor',               83], ['tresor',          83],
  ['bernard lacombe',        80], ['lacombe',              80],
  ['dominique rocheteau',    82], ['rocheteau',            82],
  ['david ginola',           82], ['ginola',               82],
  ['zinedine zidane',        96], // alias redundancy guard

  // ── Italia / Italy ────────────────────────────────────────────────
  ['paolo rossi',            88], ['rossi',                88], // 1982 WC Golden Boot – 6 goals
  ['marco tardelli',         83], ['tardelli',             83], // famous 1982 final goal scream
  ['bruno conti',            83], ['conti',                83],
  ['antonio cabrini',        82], ['cabrini',              82],
  ['giancarlo antognoni',    86], ['antognoni',            86],
  ['luigi riva',             89], ['riva',                 89], // Italy all-time top scorer (35 goals)
  ['sandro mazzola',         87], ['mazzola',              87],
  ['gianni rivera',          88], ['rivera',               88], // 1969 Ballon d'Or
  ['roberto boninsegna',     85], ['boninsegna',           85],
  ['franco causio',          82], ['causio',               82],
  ['giuseppe meazza',        92], ['meazza',               92], // 1934/1938 WC winner, legend
  ['silvio piola',           87], ['piola',                87], // 1938 WC
  ['roberto bettega',        83], ['bettega',              83],
  ['fabio capello',          82], ['capello',              82],
  ['tarcisio burgnich',      83], ['burgnich',             83], // 1970 WC
  ['romeo menti',            79],
  ['giuseppe signori',       84], ['signori',              84], // 1994 WC
  ['roberto donadoni',       83], ['donadoni',             83], // 1990 WC
  ['dino baggio',            80], ['dino baggio dino',     80],

  // ── Países Bajos / Netherlands ────────────────────────────────────
  ['johan neeskens',         86], ['neeskens',             86], // Cruyff's partner
  ['johnny rep',             83], ['rep',                  83],
  ['rob rensenbrink',        84], ['rensenbrink',          84], // hit the post in 78 WC final!
  ['arie haan',              83], ['haan',                 83],
  ['willy van de kerkhof',   82], ['van de kerkhof',       82],
  ['rene van de kerkhof',    80],
  ['ronald koeman',          87], ['r.koeman',             87], // 1988 EURO – scored in final
  ['dirk kuyt',              82], ['kuyt',                 82],
  ['mark van bommel',        83], ['van bommel',           83],
  ['cocu',                   84], ['philip cocu',          84],

  // ── Croacia / Croatia ────────────────────────────────────────────
  ['zvonimir boban',         86], ['boban',                86], // legendary captain 1998 WC
  ['alen boksic',            84], ['bokšić',               84], ['boksic',          84],
  ['igor stimac',            81], ['štimac',               81], ['stimac',          81],
  ['mario stanic',           80], ['stanić',               80],
  ['slaven bilic',           80], ['bilić',                80], ['bilic',           80],
  ['dario simic',            81], ['šimić',                81], ['simic',           81],
  ['nikola jerkan',          79], ['jerkan',               79],
  ['igor tudor',             80], ['tudor',                80],
  ['niko kovac',             81], ['kovač',                81], ['kovac',           81],

  // ── Portugal historial ────────────────────────────────────────────
  ['mario coluna',           86], ['coluna',               86], // 1966 WC – Benfica/Portugal captain
  ['jose augusto',           82], ['josé augusto',         82],
  ['antonio simoes',         82], ['simões',               82], ['simoes',          82],
  ['paula torres',           79],
  ['rui costa',              88], ['rui costa jorge',      88], // not the Fiorentina one
  ['luis figo',              94], ['figo',                 94], ['luís figo',       94], // 2001 Ballon d'Or
  ['joao pinto',             82], ['joão pinto',           82],
  ['pauleta',                84], ['pedro de sa',          84],
  ['nuno gomes',             82], ['nuno gomes junior',    82],
  ['deco',                   89], // Barcelona/Chelsea playmaker
  ['maniche',                82],
  ['costinha',               80],
  ['ricardo carvalho',       86], ['r.carvalho',           86],
  ['joao moutinho',          84], ['joão moutinho',        84], ['moutinho',        84],
  ['pepe kellermann',        86], ['pepe',                 86], // Pepe Portugal/RM CB

  // ── Portugal squad depth ─────────────────────────────────────────
  ['tiago mendes',           84], ['tiago',                84], // 2006 WC - Atlético CM
  ['simao sabrosa',          85], ['simão',                85], ['simao',            85],
  ['ricardo quaresma',       82], ['quaresma',             82],
  ['nuno valente',           81],
  ['miguel monteiro',        80], ['miguel',               80], // 2006 WC RB

  // ── France squad depth ───────────────────────────────────────────
  ['william gallas',         84], ['gallas',               84],
  ['eric abidal',            83], ['abidal',               83], ['éric abidal',      83],
  ['patrice evra',           84], ['evra',                 84],
  ['willy sagnol',           83], ['sagnol',               83],
  ['gregory coupet',         83], ['coupet',               83], ['grégory coupet',   83],
  ['mikael silvestre',       82], ['mikaël silvestre',     82], // alias for name normalisation
  ['florent malouda',        83], ['malouda',              83],
  ['djibril cisse',          82], ['cissé',                82], ['cisse',            82],
  ['sidney govou',           80], ['govou',                80],
  ['youri djorkaeff',        83], // alias already present — guard duplicate
  ['robert pires',           87], // alias already present
  ['sylvain wiltord',        82],
  ['maxime gonalons',        81],

  // ── Italy 1982 WC winner squad depth ────────────────────────────
  ['claudio gentile',        83], ['gentile',              83], // neutralised Maradona & Zico
  ['giuseppe bergomi',       84], ['bergomi',              84],
  ['alessandro altobelli',   83], ['altobelli',            83], // scored in 1982 WC final
  ['gianpiero marini',       80], ['marini',               80],
  ['gabriele oriali',        80], ['oriali',               80],
  ['fulvio collovati',       81], ['collovati',            81],
  ['claudio prandelli',      79], ['prandelli',            79],
  ['antonio cabrini',        82], // alias already present
  ['ivano bordon',           82], ['bordon',               82],
  ['giovanni galli',         81], ['g.galli',              81],
  ['daniela massaro',        80], ['massaro',              80],
  ['roberto pruzzo',         81], ['pruzzo',               81],
  ['giancarlo antognoni',    86], // alias already present
  ['sergio brio',            79],

  // ── Spain 2010 WC winner squad depth ────────────────────────────
  ['joan capdevila',         82], ['capdevila',            82],
  ['alvaro arbeloa',         82], ['arbeloa',              82], ['álvaro arbeloa',   82],
  ['raul albiol',            83], ['albiol',               83], ['raúl albiol',      83],
  ['jesus navas',            84], ['navas jesus',          84], ['jesús navas',      84],
  ['juan mata',              85], ['mata',                 85],
  ['pedro rodriguez',        84], ['pedro',                84], ['pedro rodríguez',  84],
  ['fernando llorente',      83], ['llorente',             83],
  ['carlos marchena',        81], ['marchena',             81],

  // ── Brazil 1970 legendary squad depth ──────────────────────────
  ['felix',                  82], ['félix miéle',          82], // 1970 WC GK - blamed for Italy goals
  ['brito',                  83], ['brito roberto',        83], // 1970 WC CB
  ['rivellino',              89], // spelling variant of rivelino used in some JSONs
  ['everaldo',               82], // 1970 WC LB
  ['paulo cesar lima',       81], ['paulo cesar',          81],
  ['piazza',                 80], ['wilson piazza',        80],
  ['clodoaldo',              83], // already inserted above — guard

  // ── Argentina 1986 WC winner squad depth ────────────────────────
  ['nery pumpido',           83], ['pumpido',              83], // 1986/1990 WC GK
  ['jose luis brown',        81], ['brown jose',           81], // scored 1986 WC final goal
  ['julio olarticoechea',    81], ['olarticoechea',        81],
  ['sergio batista',         81], ['batista sergio',       81],
  ['ricardo bochini',        84], ['bochini',              84], // Maradona's idol
  ['néstor clausen',         80], ['clausen',              80],
  ['oscar garrre',           80],
  ['gerardo martino',        80], ['tata martino',         80],

  // ── Netherlands 1988 EURO winner squad depth ────────────────────
  ['hans van breukelen',     85], ['van breukelen',        85], // saved penalty in 1988 EURO SF
  ['erwin koeman',           82], // Ronald's brother, also in 1988 squad
  ['arnold muhren',          83], ['mühren',               83], ['muhren',           83],
  ['wim kieft',              82], ['kieft',                82],
  ['aron winter',            82], ['winter',               82],
  ['adri van tiggelen',      81], ['van tiggelen',         81],
  ['berry van aerle',        80], ['van aerle',            80],
  ['gerald vanenburg',       81], ['vanenburg',            81],
  ['john van t schip',       80], ['van t schip',          80],

  // ════════════════════════════════════════════════════════════════════
  // CLUBS EUROPEOS — jugadores sin override en eras icónicas
  // ════════════════════════════════════════════════════════════════════

  // ── Eusébio Sacristán (Spanish CM, Barça Dream Team) — NOT the Portuguese legend ──
  ['eusebio sacristan',      82], ['eusébio sacristán',    82],

  // ── Juventus ─────────────────────────────────────────────────────
  ['stefano tacconi',        85], ['tacconi',              85], // Juve GK 1983-92, CL winner
  ['zbigniew boniek',        87], ['boniek',               87], // Polish legend – Juve/Roma
  ['massimo bonini',         80], ['bonini massimo',       80],
  ['lionello manfredonia',   81], ['manfredonia',          81],
  ['massimo briaschi',       79], ['briaschi',             79],
  ['aldo serena',            82], ['serena aldo',          82],
  ['stefano pioli',          76], ['pioli',                76],
  ['sergio brio',            80], ['brio',                 80],
  ['angelo peruzzi',         84], ['peruzzi',              84],
  ['ciro ferrara',           85], ['ferrara ciro',         85],
  ['mark iuliano',           82], ['iuliano',              82],
  ['gianluca pessotto',      81], ['pessotto',             81],
  ['antonio conte',          84], ['conte antonio',        84], // Juve CM before coaching career
  ['angelo di livio',        82], ['di livio',             82],
  ['nicola amoruso',         80], ['amoruso',              80],
  ['daniel fonseca',         83], ['fonseca daniel',       83],

  // ── Barcelona ────────────────────────────────────────────────────
  ['carles busquets',        81], ['busquets carles',      81], // Sergio's father – Dream Team GK
  ['jose ramon alexanko',    81], ['alexanko',             81],
  ['miguel angel nadal',     83], ['nadal miguel',         83], // "The Beast of Barcelona"
  ['albert ferrer',          82], ['ferrer albert',        82],
  ['sergi barjuan',          82], ['barjuan',              82],
  ['guillermo amor',         82], ['amor guillermo',       82],
  ['txiki begiristain',      83], ['begiristain',          83],
  ['julio salinas',          82], ['salinas julio',        82],
  ['richard witschge',       80], ['witschge',             80],
  ['oscar garcia',           79], ['óscar garcía',         79],

  // ── Real Madrid ──────────────────────────────────────────────────
  ['paco gento',             88], ['gento',                88], // 6× EC winner, legendary LW
  ['miguel munoz',           81], ['muñoz',                81], ['munoz',            81],
  ['marquitos',              80],
  ['hector rial',            81], ['rial',                 81],
  ['jose maria zarraga',     80], ['zárraga',              80], ['zarraga',          80],
  ['santillana',             84], ['carlos santillana',    84],
  ['pirri',                  83],
  ['uli stielike',           84], ['stielike',             84],
  ['manolo sanchis',         83], ['sanchis',              83],
  ['christian karembeu',     83], ['karembeu',             83],
  ['fernando morientes',     85], ['morientes',            85],
  ['guti',                   83], ['josé maría gutiérrez', 83],

  // ── AC Milan ─────────────────────────────────────────────────────
  ['alessandro costacurta',  88], ['costacurta',           88], // Maldini's CB partner – legend
  ['mauro tassotti',         82], ['tassotti',             82],
  ['carlo ancelotti',        83], ['ancelotti carlo',      83], // as Milan CM player
  ['alberico evani',         82], ['evani',                82],
  ['daniele massaro',        82], ['massaro daniele',      82], // scored in 1994 CL final
  ['dejan savicevic',        87], ['savicevic',            87], ['savičević',         87],
  ['gianluca lentini',       82], ['lentini',              82],
  ['sebastiano rossi',       83], ['s.rossi',              83], // Milan GK 1990-2002
  ['demetrio albertini',     84], ['albertini',            84],
  ['pietro virdis',          82], ['virdis',               82], // Milan ST 1984-90

  // ── Liverpool ────────────────────────────────────────────────────
  ['bruce grobbelaar',       84], ['grobbelaar',           84],
  ['alan hansen',            88], ['hansen alan',          88],
  ['mark lawrenson',         85], ['lawrenson',            85],
  ['phil neal',              83], ['neal phil',            83],
  ['alan kennedy',           81], ['kennedy alan',         81],
  ['terry mcdermott',        83], ['mcdermott',            83],
  ['phil thompson',          83], ['thompson phil',        83],
  ['steve nicol',            83], ['nicol steve',          83],
  ['ronnie whelan',          82], ['whelan ronnie',        82],
  ['jan molby',              83], ['jan mølby',            83], ['mølby',             83], ['molby',             83],
  ['john wark',              81], ['wark',                 81],

  // ── Arsenal ──────────────────────────────────────────────────────
  ['kolo toure',             83], ['kolo touré',           83],
  ['gael clichy',            80], ['clichy',               80],
  ['lauren',                 82], ['lauren etame',         82], // RB Invincibles
  ['gilberto silva',         84], ['gilberto',             84], // "The Invisible Wall"
  ['jose antonio reyes',     83], ['reyes jose',           83],
  ['edu',                    79], ['edu gaspar',           79],
  ['paul merson',            82], ['merson',               82],

  // ── Bayern Munich ────────────────────────────────────────────────
  ['georg schwarzenbeck',    83], ['schwarzenbeck',        83],
  ['bernd durnberger',       80], ['dürnberger',           80],
  ['conny torstensson',      80], ['torstensson',          80],
  ['franz roth',             81], ['roth franz',           81],
  ['stefan effenberg',       86], ['effenberg',            86],
  ['giovane elber',          84], ['elber',                84],
  ['mehmet scholl',          84], ['scholl',               84],

  // ── Manchester United ────────────────────────────────────────────
  ['andy cole',              85], ['cole andy',            85],
  ['dwight yorke',           86], ['yorke',                86],
  ['teddy sheringham',       83], ['sheringham',           83],
  ['jaap stam',              87], ['stam',                 87], // arguably best CB of his era
  ['denis irwin',            83], ['irwin denis',          83],
  ['ronny johnsen',          81], ['johnsen',              81],
  ['nicky butt',             82], ['butt nicky',           82],
  ['jesper blomqvist',       79], ['blomqvist',            79],
  ['gary pallister',         86], ['pallister',            86], // United CB '92-98 double
  ['steve bruce',            83], ['bruce steve',          83], // United CB
  ['peter schmeichel',       91], // alias guard

  // ════════════════════════════════════════════════════════════════════
  // CLUBS EUROPEOS — 2ª tanda de overrides
  // ════════════════════════════════════════════════════════════════════

  // ── Grande Inter (1964-65) ───────────────────────────────────────
  ['giuliano sarti',         87], ['sarti',                87], // legendary GK of Grande Inter
  ['armando picchi',         84], ['picchi',               84], // Grande Inter captain/libero
  ['saul malatrasi',         81], ['malatrasi',            81],
  ['gianfranco bedin',       81], ['bedin',                81],
  ['mario corso',            85], ['corso',                85], // "Corsino" – elegant Inter inside-forward
  ['jair',                   84], // Brazilian winger Grande Inter
  ['angelo domenghini',      82], ['domenghini',           82],
  ['joaquin peiro',          81], ['peiró',                81], ['peiro',             81],
  ['giorgio dellagiovanna',  80], ['dellagiovanna',        80],
  ['renato cappellini',      79], ['cappellini renato',    79],

  // ── Inter Milan 1988-2010 era ────────────────────────────────────
  ['nicola berti',           83], ['berti nicola',         83],
  ['aldo serena',            82], // already in list — alias guard
  ['fausto pizzi',           79],
  ['diego simeone',          83], ['simeone',              83], // CM Inter / Argentina
  ['ronaldo nazario',        98], // alias guard — 2002/2003 Inter
  ['cambiasso',              84], ['esteban cambiasso',    84], // key for 2010 treble
  ['javier zanetti',         88], // alias guard
  ['ivan cordoba',           83], ['córdoba',              83], ['cordoba ivan',       83],
  ['maicon',                 86], ['maicon douglas',       86], // RB Inter/Brazil
  ['samuel paulo',           87], ['samuel',               87], // Nigerian CB Inter
  ['lucio',                  86], ['lucimar ferreira',     86], // Brazil/Inter CB
  ['thiago motta',           83], ['motta thiago',         83],
  ['marco materazzi',        82], ['materazzi',            82], // infamous 2006 WC

  // ── Chelsea ──────────────────────────────────────────────────────
  ['gianfranco zola',        87], // alias guard
  ['roberto di matteo',      82], ['di matteo',            82],
  ['jimmy floyd hasselbaink',85], ['hasselbaink',          85],
  ['eidur gudjohnsen',       83], ['guðjohnsen',           83], ['gudjohnsen',         83],
  ['geremi',                 81], ['geremi njitap',        81],
  ['joe cole',               83], ['cole joe',             83],
  ['arjen robben',           89], // alias guard
  ['petr cech',              88], // alias guard
  ['michael essien',         85], ['essien',               85], // Ghana/Chelsea 2004-12
  ['florent malouda',        83], // alias guard
  ['nicolas anelka',         85], // alias guard
  ['frank lampard',          89], // alias guard
  ['john terry',             87], // alias guard
  ['didier drogba',          90], // alias guard

  // ── Tottenham ────────────────────────────────────────────────────
  ['jimmy greaves',          90], ['greaves',              90], // Spurs/England legend – 44 goals in 57 games
  ['danny blanchflower',     87], ['blanchflower',         87], // Double-winning captain 1961
  ['cliff jones',            82], ['jones cliff',          82], // Welsh winger, 1961 Double
  ['paul gascoigne',         89], // alias guard
  ['gary lineker',           87], // alias guard
  ['harry kane',             90], // alias guard
  ['son heung-min',          88], // alias guard
  ['christian eriksen',      87], ['eriksen',              87],
  ['jan vertonghen',         84], ['vertonghen',           84], // alias duplicate guard
  ['toby alderweireld',      83], ['alderweireld',         83],
  ['hugo lloris',            87], // alias guard
  ['dele alli',              83], ['alli',                 83],

  // ── AS Roma ──────────────────────────────────────────────────────
  ['roberto boninsegna',     85], // alias guard
  ['roberto pruzzo',         81], ['pruzzo',               81], // Roma ST — alias guard
  ['agostino di bartolomei', 84], ['di bartolomei',        84], // tragic Roma captain
  ['falcao',                 89], ['falcão',               89], // Brazilian CM Roma 1980-83
  ['paulo roberto falcao',   89], // alias
  ['gabriel batistuta',      92], // alias guard — Roma 2000-01
  ['emerson palmieri',       83], ['emerson ferreira',     83], // Roma CM 2001 scudetto
  ['daniele de rossi',       86], ['de rossi',             86],
  ['antonio cassano',        83], ['cassano',              83],
  ['edin dzeko',             84], ['džeko',                84], ['dzeko',              84],
  ['Francesco totti',        92], ['totti',                92], // Roma legend

  // ── Borussia Dortmund ────────────────────────────────────────────
  ['karl-heinz riedle',      83], ['riedle',               83], // CL 1997 brace
  ['andreas moller',         85], ['möller',               85], ['moller',             85],
  ['stephane chapuisat',     83], ['chapuisat',            83], // Swiss ST BVB 1991-99
  ['michael zorc',           83], ['zorc',                 83], // BVB legend
  ['Lars Ricken',            82], ['ricken',               82], // CL 1997 chip vs Juventus
  ['marco reus',             86], // alias guard
  ['mats hummels',           88], // alias guard
  ['mario gotze',            84], ['götze',                84], ['gotze',              84],
  ['robert lewandowski',     93], // alias guard
  ['ilkay gundogan',         86], // alias guard

  // ── Ajax ─────────────────────────────────────────────────────────
  ['litmanen',               87], ['jari litmanen',        87], // Finnish genius, Ajax MCL 1995
  ['clarence seedorf',       88], // alias guard — Ajax before Milan
  ['patrick kluivert',       85], // alias guard — Ajax CL winner 1995
  ['frank de boer',          86], // alias guard — Ajax captain
  ['edgar davids',           85], // alias guard
  ['michael reiziger',       82], ['reiziger',             82], // Ajax/Barcelona RB
  ['marc overmars',          85], // alias guard
  ['danny blind',            80], ['blind danny',          80], // Ajax CB captain
  ['mehmet scholl',          84], // alias guard (Bayern)
  ['sjaak swart',            82],  // alias — but mainly alias for Golden Ajax era players
  ['dusan tadic',            84], ['tadić',                84], ['tadic',              84], // 2019 CL SF - inspired
  ['matthijs de ligt',       87], ['de ligt',              87],
  ['frenkie de jong',        88], // alias guard
  ['hakim ziyech',           84], ['ziyech',               84],

  // ── Porto ────────────────────────────────────────────────────────
  ['deco',                   89], // alias guard
  ['costinha',               80], // alias guard
  ['radamel falcao garcia',  88], ['falcao garcia',        88], // Porto striker 2009-11 alias
  ['hulk',                   83], ['hulk porto',           83],

  // ── Benfica ──────────────────────────────────────────────────────
  ['jose augusto benfica',   82], // covered above
  ['eusebio',                94], // alias guard
  ['mario coluna',           86], // alias guard
  ['beto bebeto da silva',   79],
  ['joao mario',             82], ['joão mário',           82],

  // ── Monaco ───────────────────────────────────────────────────────
  ['kylian mbappe',          96], // alias guard
  ['bernardo silva',         88], // alias guard — Monaco before City
  ['thomas lemar',           83], ['lemar',                83],
  ['fabinho',                88], // alias guard — Monaco before Liverpool
  ['radamel falcao',         88], ['falcão',               88], ['falcao',             88],

  // ── Marseille ────────────────────────────────────────────────────
  ['rudi voller',            85], // alias guard — OM 1992-94
  ['alen boksic marsella',   84], // alias guard
  ['abedi pele',             86], ['abedi',                86], ['abedi ayew',         86], // Ghanaian legend, OM 1992-93 CL

  // ── Lyon ─────────────────────────────────────────────────────────
  ['juninho pernambucano',   89], ['juninho',              89], // OL legend — free kick master
  ['michael essien lyon',    85], // before Chelsea
  ['samuel eto',             92], // alias guard
  ['karim benzema',          91], // alias guard – OL academy

  // ── WC2026 form ratings ────────────────────────────────────────────
  ['gavi',                   87],              // bench option Spain 2026 (Fabián starts over him)
  ['unai simon',             87], ['unai simón',             87],   // #1 GK Spain 2026
  ['marc cucurella',         89], ['cucurella',              89],   // first-choice LB Spain
  ['alejandro grimaldo',     87], ['alex grimaldo',          87],   // backup LB Spain
  ['alex baena',             87], ['baena',                  87],   // LW starter Spain 2026
  ['nico williams',          85], ['nicolas williams',       85],   // LW backup Spain 2026
  ['dani olmo',              88], ['olmo',                   88],   // CM starter Spain
  ['nicolas tagliafico',     83],                                   // first-choice LB Argentina
  ['exequiel palacios',      84], ['palacios',               84],   // squad depth Argentina
];


/**
 * Map de key ? OVR para b�squedas r�pidas.
 * Compatible con Node.js y browser.
 */
const PLAYER_RATINGS_MAP = new Map(PLAYER_RATINGS_RAW);

/**
 * Devuelve el rating override de un jugador, o null si no hay entrada.
 * Normaliza acentos y min�sculas antes de comparar.
 */
function getPlayerOverride(name) {
  if (!name) return null;
  const normalize = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\-']/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const nl = normalize(name);
  const nameWords = new Set(nl.split(' '));
  for (const [key, val] of PLAYER_RATINGS_MAP) {
    const kn = normalize(key);
    if (kn === nl) return val;
    const keyWords = kn.split(' ');
    if (keyWords.length >= 2 && keyWords.every(w => nameWords.has(w))) return val;
  }
  return null;
}

/**
 * Convierte valor de mercado (euros) en OVR log-scale.
 * Solo usar cuando no hay override de nombre.
 */
function mvToRating(mv) {
  if (!mv || mv <= 0) return null;
  const log = Math.log10(Math.max(mv, 50000));
  return Math.max(62, Math.min(90, Math.round(18 + 9.2 * log)));
}

/**
 * Rating final: override > mvToRating > null
 */
function playerRating(name, marketValue) {
  return getPlayerOverride(name) ?? mvToRating(marketValue) ?? null;
}

/**
 * Devuelve la posicion override de un jugador, o null si no hay entrada.
 */
function getPlayerPosition(name) {
  if (!name) return null;
  const normalize = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\-']/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const nl = normalize(name);
  const nameWords = new Set(nl.split(' '));
  for (const [key, val] of PLAYER_POSITIONS_MAP) {
    const kn = normalize(key);
    if (kn === nl) return val;
    const keyWords = kn.split(' ');
    if (keyWords.length >= 2 && keyWords.every(w => nameWords.has(w))) return val;
  }
  return null;
}

// -- Export: Node.js ----------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLAYER_RATINGS_MAP, getPlayerOverride, mvToRating, playerRating,
                     PLAYER_POSITIONS_MAP, getPlayerPosition };
}
// -- Export: browser ----------------------------------------------------------
if (typeof window !== 'undefined') {
  window.PLAYER_RATINGS_MAP   = PLAYER_RATINGS_MAP;
  window.getPlayerOverride    = getPlayerOverride;
  window.mvToRating           = mvToRating;
  window.playerRating         = playerRating;
  window.PLAYER_POSITIONS_MAP = PLAYER_POSITIONS_MAP;
  window.getPlayerPosition    = getPlayerPosition;
}
