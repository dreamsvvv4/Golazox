/**
 * player_ratings.js â€” Fuente Ãºnica de verdad para ratings individuales
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * ~350 jugadores histÃ³ricos + ~120 actuales (2023-26).
 * Prioridad en calcPlayerRating():
 *   1. Override por nombre (este fichero)
 *   2. mvToRating(marketValue) desde TM
 *   3. Media del equipo Â± hash del nombre
 *
 * Compatible Node.js (require) + browser (window.*)
 */

'use strict';

/**
 * PLAYER_POSITIONS — corrección de posición para jugadores famosos
 * que en algunas bases de datos aparecen mal clasificados.
 * Normalización de nombre idéntica a getPlayerOverride().
 */
const PLAYER_POSITIONS_RAW = [
  // Laterales que BDFutbol/TM registra a veces como CB
  ['paolo maldini',            'LB'],
  ['roberto carlos',           'LB'],
  ['cafu',                     'RB'],
  ['cafú',                     'RB'],
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
  // Centrocampistas que a veces aparecen como delanteros o defensas
  ['franz beckenbauer',        'CB'],
  ['lothar matthaus',          'CM'],
  ['javier zanetti',           'RB'],
];

const PLAYER_POSITIONS_MAP = new Map(PLAYER_POSITIONS_RAW);

/**
 * Si el jugador tiene una posición canónica conocida, la devuelve.
 * Usa la misma normalización que getPlayerOverride.
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PORTEROS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â”€â”€ All-time greats â”€â”€
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
  ['francisco Buyo',         82],
  // â”€â”€ 2000sâ€“2010s â”€â”€
  ['edwin van der sar',      89], ['van der sar',          89],
  ['petr Äech',              88], ['cech',                 88], ['Äech',     88],
  ['victor valdes',          86], ['vÃ­ctor valdÃ©s',        86],
  ['julio cesar',            86], ['jÃºlio cÃ©sar',          86],
  ['gianluigi donnarumma',   90], ['donnarumma',           90],
  ['keylor navas',           86], ['navas',                86],
  ['david de gea',           87], ['de gea',               87],
  ['manuel neuer',           93], ['neuer',                93],
  ['hugo lloris',            87], ['lloris',               87],
  ['thibaut courtois',       91], ['courtois',             91],
  ['joe hart',               83],
  ['marc-andre ter stegen',  89], ['ter stegen',           89], ['marc-andrÃ© ter stegen', 89],
  ['jan oblak',              92], ['oblak',                92],
  // â”€â”€ Actuales (2023-26) â”€â”€
  ['alisson becker',         91], ['alisson',              91],
  ['ederson moraes',         88], ['ederson',              88],
  ['mike maignan',           87], ['maignan',              87],
  ['gregor kobel',           86], ['kobel',                86],
  ['andriy lunin',           85], ['lunin',                85],
  ['bono yassine',           85],
  ['diogo costa',            86],
  ['unai simon',             84], ['unai simÃ³n',           84],
  ['alex remiro',            84],
  ['lukasz fabianski',       82],
  ['wojciech szczesny',      86], ['szczÄ™sny',             86],
  ['yann sommer',            86], ['sommer',               86],
  ['marcus flekken',         83],
  ['rui patricio',           85],

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DEFENSAS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â”€â”€ Leyendas absolutas â”€â”€
  ['franz beckenbauer',      96], ['beckenbauer',          96],
  ['franco baresi',          97], ['baresi',               97],
  ['paolo maldini',          97], ['maldini',              97],
  ['bobby moore',            92],
  ['gaetano scirea',         91], ['scirea',               91],
  ['cafu',                   90], ['cafÃº',                 90],
  ['carlos alberto',         90],
  ['giacinto facchetti',     90], ['facchetti',            90],
  ['daniel passarella',      88], ['passarella',           88],
  ['ruud krol',              86], ['krol',                 86],
  ['berti vogts',            85],
  ['emlyn hughes',           83],
  // â”€â”€ 1990sâ€“2000s â”€â”€
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
  ['sami hyypia',            85], ['hyypiÃ¤',               85],
  // â”€â”€ 2010s â”€â”€
  ['jordi alba',             86], ['alba',                 86],
  ['dani carvajal',          87], ['carvajal',             87],
  ['philipp lahm',           92],
  ['jerome boateng',         87], ['boateng',              87],
  ['mats hummels',           88], ['hummels',              88],
  ['gerard pique',           88], ['piquÃ©',                88], ['pique', 88],
  ['pepe kellermann',        86],
  ['marcelo vieira',         87], ['marcelo brozovic',     86],
  ['david alaba',            87], ['alaba',                87],
  ['raphael varane',         89], ['raphaÃ«l varane',       89], ['varane', 89],
  ['jose gimenez',           85], ['gimÃ©nez',              85],
  ['stefan de vrij',         86],
  // â”€â”€ Actuales (2023-26) â”€â”€
  ['virgil van dijk',        91], ['van dijk',             91],
  ['ruben dias',             89], ['rÃºben dias',           89], ['dias',  89],
  ['william saliba',         86], ['saliba',               86],
  ['min-jae kim',            87], ['kim min-jae',          87],
  ['ronald araujo',          86], ['araÃºjo',               86], ['araujo', 86],
  ['marquinhos',             87],
  ['antonio rudiger',        85], ['rÃ¼diger',              85], ['rudiger', 85],
  ['eder militao',           86], ['Ã©der militÃ£o',         86], ['militÃ£o', 86], ['militao', 86],
  ['joao cancelo',           86], ['joÃ£o cancelo',         86], ['cancelo', 86],
  ['trent alexander-arnold', 88], ['trent',                88],
  ['alex grimaldo',          85], ['grimaldo',             85],
  ['alejandro grimaldo',     85],
  ['inigo martinez',         83], ['iÃ±igo martÃ­nez',       83],
  ['aymeric laporte',        86], ['laporte',              86],
  ['kyle walker',            85], ['walker',               85],
  ['theo hernandez',         88], ['thÃ©o hernandez',       88],
  ['achraf hakimi',          87], ['hakimi',               87],
  ['reece james',            86], ['reece james',          86],
  ['andrew robertson',       86], ['robertson',            86],
  ['ferland mendy',          85], ['mendy',                85],
  ['ibrahima konate',        86], ['konatÃ©',               86], ['konate', 86],
  ['jules kounde',           86], ['koundÃ©',               86], ['kounde', 86],
  ['ben white',              84],
  ['joe gomez',              83],
  ['nico schlotterbeck',     84], ['schlotterbeck',        84],
  ['nordi mukiele',          82],
  ['sergio gomez',           80],
  ['pedri gonzalez cb',      88],
  ['lucas hernandez',        84],
  ['presnel kimpembe',       83], ['kimpembe',             83],
  ['danilo luiz',            84], ['danilo',               84],

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CENTROCAMPISTAS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â”€â”€ All-time greats â”€â”€
  ['diego maradona',         99], ['maradona',             99],
  ['zinedine zidane',        96],
  ['johan cruyff',           98], ['cruyff',               98],
  ['michel platini',         96], ['platini',              96],
  ['ronaldinho',             96],
  ['lothar matthaus',        93], ['matthÃ¤us',             93], ['matthaus', 93],
  ['bobby charlton',         93],
  ['franz beckenbauer',      96],
  ['alfredo di stefano',     98], ['di stÃ©fano',           98], ['di stefano', 98],
  ['socrates',               90],
  ['falcao uruguayo',        82],
  ['falcao el caballero',    89], ['falcÃ£o',               89],
  ['zico',                   92],
  ['didi',                   88],
  ['gerson',                 88],
  ['bryan robson',           87], ['robson',               87],
  ['graeme souness',         87], ['souness',              87],
  ['glen hoddle',            85], ['hoddle',               85],
  ['gunter netzer',          88], ['netzer',               88],
  ['gerd muller',            95], ['mÃ¼ller gerd',          95],
  ['josef masopust',         88],
  ['raymond kopa',           89],
  ['dzajic',                 86],
  ['cubillas',               87], ['teofilo cubillas',     87],
  ['mario kempes',           90], ['kempes',               90],
  ['osvaldo ardiles',        86], ['ardiles',              86],
  ['rivelino',               89],
  ['carlos valderrama',      87], ['valderrama',           87],
  // â”€â”€ 1990sâ€“2000s â”€â”€
  ['xavi hernandez',         93], ['xavi hernÃ¡ndez',       93],
  ['andres iniesta',         92], ['andrÃ©s iniesta',       92], ['iniesta', 92],
  ['andrea pirlo',           93], ['pirlo',                93],
  ['luka modric',            91], ['luka modriÄ‡',          91], ['modriÄ‡',  91], ['modric', 91],
  ['toni kroos',             91], ['kroos',                91],
  ['xabi alonso',            91],
  ['sergio busquets',        89], ['busquets',             89],
  ['frank lampard',          89], ['lampard',              89],
  ['steven gerrard',         89], ['gerrard',              89],
  ['paul scholes',           88], ['scholes',              88],
  ['ryan giggs',             88], ['giggs',                88],
  ['patrick vieira',         90], ['vieira',               90],
  ['claude makelele',        88], ['makÃ©lÃ©lÃ©',             88], ['makelele', 88],
  ['clarence seedorf',       88], ['seedorf',              88],
  ['edgar davids',           85], ['davids',               85],
  ['roy keane',              88],
  ['paul gascoigne',         89], ['gascoigne',            89],
  ['david beckham',          87], ['beckham',              87],
  ['riquelme',               89], ['juan roman riquelme',  89],
  ['pablo aimar',            86], ['aimar',                86],
  ['yaya toure',             88], ['yaya tourÃ©',           88],
  ['cesc fabregas',          87], ['fÃ bregas',             87], ['fabregas', 87],
  ['mesut ozil',             88], ['Ã¶zil',                 88], ['ozil',    88],
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
  ['romario midfield',       80],
  ['melo',                   78],
  ['emerson',                84],
  ['cafu mid',               90],
  ['deivid',                 78],
  // â”€â”€ 2010s â”€â”€
  ['kevin de bruyne',        92], ['de bruyne',            92],
  ['eden hazard',            89], ['hazard',               89],
  ['casemiro',               88],
  ['pep guardiola',          88], ['guardiola',            88],
  ['isco alarcon',           84], ['isco',                 84],
  ['dani ceballos',          82], ['ceballos',             82],
  ['marco asensio',          83], ['asensio',              83],
  ['dani parejo',            84], ['parejo',               84],
  ['mikel oyarzabal',        85], ['oyarzabal',            85],
  ['david silva',            91],
  ['sergio canales',         83], ['canales',              83],
  ['thiago alcantara',       88], ['thiago alcÃ¢ntara',     88], ['thiago',  88],
  ['ivan rakitic',           87], ['rakitiÄ‡',              87], ['rakitic', 87],
  ['ngolo kante',            91], ["n'golo kantÃ©",         91], ['kante',   91],
  ['paul pogba',             86], ['pogba',                86],
  ['arturo vidal',           86], ['vidal',                86],
  ['lasse schone',           82],
  ['james rodriguez',        85], ['james rodrÃ­guez',      85], ['james',   85],
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
  // ── Actuales (2023-26) ──
  ['rodrigo hernandez',      92], ['rodrigo hernandez cascante', 92], // Rodri Man City (no usar 'rodri' solo — colisiona)
  ['jude bellingham',        90], ['bellingham',           90],
  ['pedri',                  88],
  ['gavi',                   88],
  ['frenkie de jong',        88], ['de jong',              88],
  ['federico valverde',      88], ['valverde',             88],
  ['martin odegaard',        88], ['Ã¸degaard',             88], ['odegaard', 88],
  ['declan rice',            88], ['rice',                 88],
  ['phil foden',             90], ['foden',                90],
  ['bernardo silva',         88],
  ['aurelien tchouameni',    86], ['tchouamÃ©ni',           86], ['tchouameni', 86],
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
  ['ruben neves',            84], ['rÃºben neves',          84],
  ['joao palhinha',          84],
  ['enzo fernandez',         86], ['Ã©nzo fernandez',       86],
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
  ['alexis sanchez',         84], ['alexis sÃ¡nchez',       84],

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DELANTEROS / EXTREMOS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â”€â”€ Inmortales â”€â”€
  ['pele',                   99], ['pelÃ©',                 99],
  ['lionel messi',           99], ['leo messi',            99], ['messi',   99],
  ['cristiano ronaldo',      99],
  ['ronaldo nazario',        98], ['ronaldo nazÃ¡rio',      98], ['ronaldo fenomeno', 98],
  ['franz beckenbauer',      96],
  ['alfredo di stefano',     98],
  ['ferenc puskas',          96], ['puskÃ¡s',               96], ['puskas',  96],
  ['eusebio',                94], ['eusÃ©bio',              94],
  ['garrincha',              94],
  ['george best',            95],
  ['gerd muller',            95], ['gerd mÃ¼ller',          95], ['mÃ¼ller',  95],
  ['just fontaine',          89], ['fontaine',             89],
  ['raymond kopa',           89],
  ['sandor kocsis',          90], ['kocsis',               90],
  ['helmut rahn',            87],
  ['fritz walter',           88],
  ['uwe seeler',             88], ['seeler',               88],
  ['karl-heinz rummenigge',  89], ['rummenigge',           89],
  ['roberto baggio',         92],
  ['michel',                 86], ['michel gonzalez',      86],
  ['emilio butragueno',      87], ['butragueÃ±o',           87],
  ['hugo sanchez',           90], ['hugo sÃ¡nchez',         90],
  ['marco van basten',       98], ['van basten',           98],
  ['ruud van nistelrooy',    88], ['van nistelrooy',       88],
  ['george weah',            90], ['weah',                 90],
  ['hristo stoichkov',       91], ['stoichkov',            91],
  ['rivaldo',                93],
  ['romario',                94], ['romÃ¡rio',              94],
  ['zico',                   92],
  ['ronaldinho',             96],
  ['thierry henry',          93],
  ['david trezeguet',        87], ['trezeguet',            87],
  ['nicolas anelka',         85], ['anelka',               85],
  ['lothar matthaus fwd',    88],
  ['ruui gullit fwd',        88],
  // â”€â”€ 1990sâ€“2000s â”€â”€
  ['raul gonzalez',          88], ['raÃºl',                 88], ['raul',    88],
  ['Fernando Hierro',        87], ['hierro',               87],
  ['davor suker',            87], ['Å¡uker',                87], ['suker',   87],
  ['robert prosinecki',      85], ['prosineÄki',           85],
  ['predrag mijatovic',      84], ['mijatoviÄ‡',            84],
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
  ['franck ribery',          90], ['ribÃ©ry',               90], ['ribery',  90],
  ['gareth bale',            87], ['bale',                 87],
  ['zlatan ibrahimovic',     92], ['ibrahimovic',          92], ['ibrahimoviÄ‡', 92],
  ['samuel etoo',            92], ["eto'o",                92], ['samuel eto\'o', 92],
  ['didier drogba',          90], ['drogba',               90],
  ['wayne rooney',           89], ['rooney',               89],
  ['carlos tevez',           88], ['tevez',                88],
  ['sergio aguero',          90], ['agÃ¼ero',               90], ['aguero',  90],
  ['andriy shevchenko',      91], ['shevchenko',           91],
  ['filippo inzaghi',        85],
  ['ole gunnar solskjaer',   82], ['solskjaer',            82],
  ['ryan giggs fwd',         82],
  ['kaka',                   92],
  ['robinho',                84],
  ['adriano',                87], ['adriano imperador',    87],
  ['neymar',                 93],
  ['luis suarez',            91], ['luis suÃ¡rez',          91],
  ['robin van persie',       88], ['van persie',           88],
  ['gio van bronckhorst',    83],
  ['franck ribery',          90],
  ['oliver bierhoff',        83], ['bierhoff',             83],
  ['luca toni',              84],
  ['gennaro gattuso',        84], ['gattuso',              84],
  ['ciro di marzio',         79],
  ['dario hÃ¼bner',           79],
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
  // â”€â”€ 2010s â”€â”€
  ['karim benzema',          91], ['benzema',              91],
  ['gonzalo higuain',        85], ['higuaÃ­n',              85], ['higuain',  85],
  ['david villa',            89],
  ['david silva fwd',        82],
  ['eden hazard fwd',        86],
  ['angel di maria',         88], ['Ã¡ngel di marÃ­a',       88], ['di maria', 88], ['di marÃ­a', 88],
  ['robert lewandowski',     93], ['lewandowski',          93],
  ['harry kane',             91], ['kane',                 91],
  ['mo salah',               91], ['salah',                91], ['mohamed salah', 91],
  ['sadio mane',             89], ['sadio manÃ©',           89], ['manÃ©',    85],
  ['son heung-min',          88], ['son',                  88], ['heung-min', 88],
  ['antoine griezmann',      89], ['griezmann',            89],
  ['ousmane dembele',        87], ['dembÃ©lÃ©',              87], ['dembele', 87],
  ['marco reus',             86], ['reus',                 86],
  ['thomas muller',          88], ['thomas mÃ¼ller',        88],
  ['franck ribery',          90],
  ['arjen robben',           89],
  ['lamine yamal',           88],
  ['fernando torres',        87],
  ['alvaro morata',          83], ['morata',               83],
  ['romelu lukaku',          85], ['lukaku',               85],
  ['pierre-emerick aubameyang', 84], ['aubameyang',        84],
  ['ciro immobile',          85], ['immobile',             85],
  ['dries mertens',          85], ['mertens',              85],
  ['roberto firmino',        83], ['firmino',              83],
  ['riyad mahrez',           85], ['mahrez',               85],
  ['nkunku',                 85], ['christopher nkunku',   85],
  ['kingsley coman',         83], ['coman',                83],
  ['leroy sane',             86], ['leroy sanÃ©',           86], ['sane',    86],
  ['serge gnabry',           85], ['gnabry',               85],
  ['christian pulisic',      83], ['pulisic',              83],
  ['joao felix',             84], ['joÃ£o fÃ©lix',           84],
  ['vinicius jr',            89], ['vinÃ­cius jr',          89], ['vinÃ­cius', 89], ['vinicius',89],
  ['rodrygo',                87], ['rodrygo goes',         87],
  ['raphinha',               85], ['raphinha coutinho',    85],
  ['gabriel martinelli',     85], ['martinelli',           85],
  ['bukayo saka',            88], ['saka',                 88],
  ['marcus rashford',        86], ['rashford',             86],
  ['jadon sancho',           84], ['sancho',               84],
  ['paulo dybala',           87], ['dybala',               87],
  ['lautaro martinez',       89], ['lautaro martÃ­nez',     89], ['lautaro', 89],
  ['dusan vlahovic',         86], ['vlahoviÄ‡',             86], ['vlahovic', 86],
  ['rafael leao',            88], ['rafael leÃ£o',          88], ['leÃ£o',    88], ['leao',   88],
  ['victor osimhen',         87], ['osimhen',              87],
  ['darwin nunez',           84], ['darwin nÃºÃ±ez',         84], ['nunez',   84],
  ['diogo jota',             85], ['jota',                 85],
  ['cody gakpo',             84], ['gakpo',                84],
  ['ferran torres',          84],
  ['cole palmer',            88], ['palmer',               88],
  ['alejandro garnacho',     84], ['garnacho',             84],
  ['nicolas jackson',        82], ['jackson',              82],
  ['kylian mbappe',          96], ['mbappÃ©',               96], ['mbappe',  96],
  ['erling haaland',         95], ['haaland',              95],
  ['victor gyokeres',        87], ['gyÃ¶keres',             87], ['gyokeres', 87],
  ['alexander isak',         87], ['isak',                 87],
  ['khvicha kvaratskhelia',  88], ['kvaratskhelia',        88], ['kvara',   88],
  ['nico williams',          85], ['nico',                 85],
  ['inaki williams',         83], ['iÃ±aki williams',       83],
  ['marcus thuram',          85], ['thuram marcus',        85],
  ['randal kolo muani',      83], ['kolo muani',           83],
  ['gabriel jesus',          84], ['g.jesus',              84],
  ['bernardo silva fwd',     81],
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
  ['loÃ¯s openda',            84], ['openda',               84],
  ['dani olmo',              86], ['olmo',                 86],
  ['pedri gonzalez fwd',     82],
  ['ferran torres',          84],
  ['ayoze perez',            80],
  ['ante rebic',             81],
  ['niclas fullkrug',        83], ['fÃ¼llkrug',             83], ['fullkrug', 83],
  ['harry maguire',          81],
  ['james maddison',         85], ['maddison',             85],
  ['aleksandar mitrovic',    84], ['mitroviÄ‡',             84],
  ['wahbi khazri',           80],

  // â”€â”€ Jugadores MLS / Saudi / histÃ³ricos adicionales â”€â”€
  ['david beckham',          87],
  ['thierry henry mls',      90],
  ['zlatan ibrahimovic mls', 88],
  ['xherdan shaqiri',        82], ['shaqiri',              82],
  ['lorenzo insigne',        85], ['insigne',              85],
  ['sebastian giovinco',     83], ['giovinco',             83],
  ['gonzalo higuain mls',    83],
  ['blaise matuidi',         84], ['matuidi',              84],
  ['kalidou koulibaly',      86], ['koulibaly',            86],
  ['jordan henderson',       80], ['henderson',            80],
  ['roberto firmino',        83],
  ['karim benzema saudi',    88],
  ['neymar saudi',           90],
  ['riyad mahrez',           85],

  // ── FC Bayern (actuales) ─────────────────────────────────────────────
  ['joshua kimmich',         88], ['kimmich',              88],
  ['alphonso davies',        87], ['davies alphonso',      87],
  ['dayot upamecano',        84], ['upamecano',            84],
  ['jonathan tah',           83], ['tah',                  83],
  ['leon goretzka',          84], ['goretzka',             84],
  ['michael olise',          86], ['olise',                86],
  ['raphael guerreiro',      84],
  ['konrad laimer',          83], ['laimer',               83],
  ['josip stanisic',         78],
  ['aleksandar pavlovic',    82], ['pavlovic aleksandar',  82],
  ['min-jae kim',            87],
  ['harry kane',             91],
  ['thomas muller',          88],
  ['serge gnabry',           85],
  ['jamal musiala',          90],
  ['leroy sane',             86],

  // ── Real Madrid (actuales 2025) ───────────────────────────────────────
  ['arda guler',             83], ['arda güler',           83],
  ['dean huijsen',           82], ['huijsen',              82],
  ['raul asencio',           80], ['asencio',              80],
  ['alvaro carreras',        81],
  ['endrick',                80],

  // ── Barcelona (actuales 2025) ─────────────────────────────────────────
  ['joan garcia',            83],
  ['pau cubarsi',            83], ['cubarsí',              83], ['cubarsi', 83],
  ['alejandro balde',        84], ['balde',                84], ['alejandro balde', 84],
  ['gerard martin',          80],
  ['fermin lopez',           83], ['fermín',               83],
  ['eric garcia camara',     79],
  ['inigo martinez barca',   83],

  // ── Premier League (actuales 2025) ────────────────────────────────────
  ['chris wood',             82],
  ['morgan gibbs-white',     84], ['gibbs-white',          84],
  ['noni madueke',           83], ['madueke',              83],
  ['pedro neto',             83], ['pedro neto silva',     83],
  ['morgan rogers',          82],
  ['jhon duran',             82], ['duran jhon',           82],
  ['micky van de ven',       84], ['van de ven',           84],
  ['brennan johnson',        83], ['b.johnson',            83],
  ['nottm forest',           78],
  ['rasmus hojlund',         83], ['hojlund',              83],

  // ── Bundesliga (actuales 2025) ────────────────────────────────────────
  ['hugo larsson',           81],
  ['can uzun',               82],
  ['omar marmoush',          85], ['marmoush',             85],
  ['jonathan burkardt',      82], ['burkardt',             82],
  ['christoph baumgartner',  82], ['baumgartner',          82],
  ['maximilian beier',       83], ['beier',                83],

  // ── Serie A (actuales 2025) ───────────────────────────────────────────
  ['matteo retegui',         84], ['retegui',              84],
  ['ademola lookman',        85], ['lookman',              85],
  ['sandro tonali',          85], ['tonali',               85],
  ['federico chiesa',        83], ['chiesa',               83],
  ['marcus thuram inter',    84],
  ['piotr zielinski',        84], ['zielinski',            84],
  ['hakan calhanoglu',       87], ['calhanoglu',           87], ['çalhanoğlu', 87],
  ['romelu lukaku inter',    84],
  ['matias vecino',          79],
  ['kristjan asllani',       80],
  ['yann bisseck',           81],

  // ── La Liga extra (actuales 2025) ─────────────────────────────────────
  ['kylian mbappe real',     96],
  ['vinicius jr real',       89],
  ['jude bellingham real',   90],
  ['rodri manchester',       92],
  ['robert lewandowski barca', 90],
  ['david raya',             85], ['raya',                 85],
  ['pedri barca',            88],
  ['gavi barca',             88],
  ['osasuna',                75],
  ['valladolid',             73],
  ['ian maatsen',            83], ['maatsen',              83],
  ['konrad de la fuente',    80],
  ['takefusa kubo',          83], ['kubo',                 83],
];


/**
 * Map de key â†’ OVR para bÃºsquedas rÃ¡pidas.
 * Compatible con Node.js y browser.
 */
const PLAYER_RATINGS_MAP = new Map(PLAYER_RATINGS_RAW);

/**
 * Devuelve el rating override de un jugador, o null si no hay entrada.
 * Normaliza acentos y mayÃºsculas antes de comparar.
 */
function getPlayerOverride(name) {
  if (!name) return null;
  // Normalize: lowercase, strip diacritics, hyphens/apostrophes → space
  const normalize = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\-']/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const nl = normalize(name);
  const nameWords = new Set(nl.split(' '));
  for (const [key, val] of PLAYER_RATINGS_MAP) {
    const kn = normalize(key);
    // Exact full-name match
    if (kn === nl) return val;
    // All key words must exist as whole words in the player name
    const keyWords = kn.split(' ');
    if (keyWords.every(w => nameWords.has(w))) return val;
  }
  return null;
}

/**
 * Convierte valor de mercado (â‚¬) â†’ OVR log-scale.
 * Solo usar cuando no hay override de nombre.
 * â‚¬200Mâ‰ˆ93  â‚¬50Mâ‰ˆ88  â‚¬10Mâ‰ˆ82  â‚¬1Mâ‰ˆ73  â‚¬200Kâ‰ˆ66  <â‚¬100Kâ†’62
 */
function mvToRating(mv) {
  if (!mv || mv <= 0) return null;
  // Escala calibrada: €150M→90(cap)  €50M→89  €20M→85  €10M→82  €5M→80  €1M→73  €200K→67
  // Cap 90: solo los overrides de nombre pueden superar 90 (Messi, Haaland, etc.)
  const log = Math.log10(Math.max(mv, 50000));
  return Math.max(62, Math.min(90, Math.round(18 + 9.2 * log)));
}

/**
 * Rating final: override > mvToRating > null
 */
function playerRating(name, marketValue) {
  return getPlayerOverride(name) ?? mvToRating(marketValue) ?? null;
}

// â”€â”€ Export: Node.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLAYER_RATINGS_MAP, getPlayerOverride, mvToRating, playerRating,
                     PLAYER_POSITIONS_MAP, getPlayerPosition };
}
// â”€â”€ Export: browser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (typeof window !== 'undefined') {
  window.PLAYER_RATINGS_MAP   = PLAYER_RATINGS_MAP;
  window.getPlayerOverride    = getPlayerOverride;
  window.mvToRating           = mvToRating;
  window.playerRating         = playerRating;
  window.PLAYER_POSITIONS_MAP = PLAYER_POSITIONS_MAP;
  window.getPlayerPosition    = getPlayerPosition;
}


