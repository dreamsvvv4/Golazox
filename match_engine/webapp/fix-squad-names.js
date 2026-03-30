'use strict';
/**
 * fix-squad-names.js — Adds nameEs / nameEn to squad JSON files that are missing them.
 * Covers all teams from the main supported leagues.
 *
 * Usage:  node fix-squad-names.js
 */
const fs   = require('fs');
const path = require('path');

const SQUADS_DIR = path.join(__dirname, 'squads');

// slug → { nameEs, nameEn }
// Only include entries where nameEs / nameEn are missing or need correction.
const NAME_MAP = {
  // ══ La Liga ══════════════════════════════════════════════════
  'fc-villarreal':               { nameEs: 'Villarreal CF',          nameEn: 'Villarreal CF' },
  'celta-vigo':                  { nameEs: 'Celta de Vigo',          nameEn: 'Celta Vigo' },
  'fc-girona':                   { nameEs: 'Girona FC',              nameEn: 'Girona FC' },
  'rcd-mallorca':                { nameEs: 'RCD Mallorca',           nameEn: 'RCD Mallorca' },
  'espanyol-barcelona':          { nameEs: 'Espanyol',               nameEn: 'Espanyol' },
  'ca-osasuna':                  { nameEs: 'CA Osasuna',             nameEn: 'CA Osasuna' },
  'rayo-vallecano-de-madrid':    { nameEs: 'Rayo Vallecano',         nameEn: 'Rayo Vallecano' },
  'deportivo-alaves':            { nameEs: 'Deportivo Alavés',       nameEn: 'Deportivo Alavés' },
  'getafe-cf':                   { nameEs: 'Getafe CF',              nameEn: 'Getafe CF' },
  'elche-cf':                    { nameEs: 'Elche CF',               nameEn: 'Elche CF' },
  'levante-ud':                  { nameEs: 'Levante UD',             nameEn: 'Levante UD' },
  'real-oviedo':                 { nameEs: 'Real Oviedo',            nameEn: 'Real Oviedo' },
  'real-betis-balompie':         { nameEs: 'Real Betis',             nameEn: 'Real Betis' },
  'real-sociedad-san-sebastian': { nameEs: 'Real Sociedad',          nameEn: 'Real Sociedad' },
  'fc-valencia':                 { nameEs: 'Valencia CF',            nameEn: 'Valencia CF' },
  'fc-sevilla':                  { nameEs: 'Sevilla FC',             nameEn: 'Sevilla FC' },
  'sevilla-fc':                  { nameEs: 'Sevilla FC',             nameEn: 'Sevilla FC' },
  'fc-barcelona':                { nameEs: 'FC Barcelona',           nameEn: 'FC Barcelona' },
  'atletico-madrid':             { nameEs: 'Atlético de Madrid',     nameEn: 'Atletico Madrid' },
  'athletic-club':               { nameEs: 'Athletic Club',          nameEn: 'Athletic Club' },
  'real-madrid':                 { nameEs: 'Real Madrid',            nameEn: 'Real Madrid' },
  'real-sociedad-ii':            { nameEs: 'Real Sociedad B',        nameEn: 'Real Sociedad B' },

  // ══ La Liga 2 ═════════════════════════════════════════════════
  'albacete':                    { nameEs: 'Albacete BP',            nameEn: 'Albacete BP' },
  'burgos-cf':                   { nameEs: 'Burgos CF',              nameEn: 'Burgos CF' },
  'cadiz-cf':                    { nameEs: 'Cádiz CF',               nameEn: 'Cadiz CF' },
  'castellon':                   { nameEs: 'CD Castellón',           nameEn: 'Castellon' },
  'cd-leganes':                  { nameEs: 'CD Leganés',             nameEn: 'CD Leganés' },
  'cd-mirandes':                 { nameEs: 'CD Mirandés',            nameEn: 'CD Mirandés' },
  'ceuta':                       { nameEs: 'AD Ceuta',               nameEn: 'AD Ceuta' },
  'cordoba':                     { nameEs: 'Córdoba CF',             nameEn: 'Cordoba CF' },
  'cultural-leonesa':            { nameEs: 'Cultural Leonesa',       nameEn: 'Cultural Leonesa' },
  'fc-andorra':                  { nameEs: 'FC Andorra',             nameEn: 'FC Andorra' },
  'granada-cf':                  { nameEs: 'Granada CF',             nameEn: 'Granada CF' },
  'malaga':                      { nameEs: 'Málaga CF',              nameEn: 'Malaga CF' },
  'rc-deportivo':                { nameEs: 'RC Deportivo',           nameEn: 'Deportivo de La Coruña' },
  'real-racing-club':            { nameEs: 'Racing de Santander',    nameEn: 'Racing Santander' },
  'real-valladolid':             { nameEs: 'Real Valladolid',        nameEn: 'Real Valladolid' },
  'real-zaragoza':               { nameEs: 'Real Zaragoza',          nameEn: 'Real Zaragoza' },
  'sd-eibar':                    { nameEs: 'SD Eibar',               nameEn: 'SD Eibar' },
  'sd-huesca':                   { nameEs: 'SD Huesca',              nameEn: 'SD Huesca' },
  'sporting-gijon':              { nameEs: 'Sporting de Gijón',      nameEn: 'Sporting de Gijón' },
  'ud-almeria':                  { nameEs: 'UD Almería',             nameEn: 'UD Almería' },
  'ud-las-palmas':               { nameEs: 'UD Las Palmas',          nameEn: 'UD Las Palmas' },
  'ad-alcorcon':                 { nameEs: 'AD Alcorcón',            nameEn: 'AD Alcorcón' },

  // ══ Serie A ═══════════════════════════════════════════════════
  'ac-florenz':                  { nameEs: 'Fiorentina',             nameEn: 'Fiorentina' },
  'ac-mailand':                  { nameEs: 'AC Milán',               nameEn: 'AC Milan' },
  'as-rom':                      { nameEs: 'AS Roma',                nameEn: 'AS Roma' },
  'atalanta-bc':                 { nameEs: 'Atalanta',               nameEn: 'Atalanta' },
  'bologna':                     { nameEs: 'Bologna FC',             nameEn: 'Bologna' },
  'cagliari':                    { nameEs: 'Cagliari',               nameEn: 'Cagliari' },
  'cfc-genua':                   { nameEs: 'Genoa CFC',              nameEn: 'Genoa' },
  'como-1907':                   { nameEs: 'Como 1907',              nameEn: 'Como 1907' },
  'cremonese':                   { nameEs: 'US Cremonese',           nameEn: 'US Cremonese' },
  'fc-turin':                    { nameEs: 'Torino FC',              nameEn: 'Torino' },
  'hellas-verona':               { nameEs: 'Hellas Verona',          nameEn: 'Hellas Verona' },
  'inter-mailand':               { nameEs: 'Inter de Milán',         nameEn: 'Inter Milan' },
  'juventus-turin':              { nameEs: 'Juventus',               nameEn: 'Juventus' },
  'lazio-rom':                   { nameEs: 'Lazio',                  nameEn: 'SS Lazio' },
  'parma':                       { nameEs: 'Parma Calcio',           nameEn: 'Parma' },
  'pisa':                        { nameEs: 'AC Pisa',                nameEn: 'AC Pisa' },
  'sassuolo':                    { nameEs: 'Sassuolo',               nameEn: 'US Sassuolo' },
  'ssc-neapel':                  { nameEs: 'Nápoles',                nameEn: 'Napoli' },
  'udinese-calcio':              { nameEs: 'Udinese',                nameEn: 'Udinese' },
  'us-lecce':                    { nameEs: 'US Lecce',               nameEn: 'US Lecce' },

  // ══ Serie B ═══════════════════════════════════════════════════
  'ac-monza':                    { nameEs: 'AC Monza',               nameEn: 'AC Monza' },
  'avellino':                    { nameEs: 'US Avellino',            nameEn: 'US Avellino' },
  'bari':                        { nameEs: 'SSC Bari',               nameEn: 'SSC Bari' },
  'carrarese':                   { nameEs: 'Carrarese Calcio',       nameEn: 'Carrarese' },
  'catanzaro':                   { nameEs: 'US Catanzaro',           nameEn: 'US Catanzaro' },
  'cesena':                      { nameEs: 'FC Cesena',              nameEn: 'FC Cesena' },
  'fc-empoli':                   { nameEs: 'Empoli FC',              nameEn: 'Empoli' },
  'fc-sudtirol':                 { nameEs: 'FC Südtirol',            nameEn: 'FC Sudtirol' },
  'frosinone':                   { nameEs: 'Frosinone Calcio',       nameEn: 'Frosinone' },
  'juve-stabia':                 { nameEs: 'SS Juve Stabia',         nameEn: 'Juve Stabia' },
  'mantova':                     { nameEs: 'Mantova 1911',           nameEn: 'Mantova' },
  'modena':                      { nameEs: 'Modena FC',              nameEn: 'Modena' },
  'padova':                      { nameEs: 'Calcio Padova',          nameEn: 'Padova' },
  'palermo':                     { nameEs: 'US Palermo',             nameEn: 'Palermo' },
  'pescara':                     { nameEs: 'Pescara Calcio',         nameEn: 'Pescara' },
  'reggiana':                    { nameEs: 'AC Reggiana',            nameEn: 'AC Reggiana' },
  'sampdoria':                   { nameEs: 'Sampdoria',              nameEn: 'Sampdoria' },
  'spezia':                      { nameEs: 'Spezia Calcio',          nameEn: 'Spezia' },
  'venezia-fc':                  { nameEs: 'Venezia FC',             nameEn: 'Venezia' },
  'virtus-entella':              { nameEs: 'Virtus Entella',         nameEn: 'Virtus Entella' },

  // ══ Bundesliga ════════════════════════════════════════════════
  '1-fc-koln':                   { nameEs: 'FC Köln',                nameEn: '1. FC Köln' },
  '1-fc-union-berlin':           { nameEs: 'Union Berlin',           nameEn: '1. FC Union Berlin' },
  '1-fsv-mainz-05':              { nameEs: 'Mainz 05',               nameEn: '1. FSV Mainz 05' },
  'bayer-04-leverkusen':         { nameEs: 'Bayer Leverkusen',       nameEn: 'Bayer 04 Leverkusen' },
  'borussia-dortmund':           { nameEs: 'Borussia Dortmund',      nameEn: 'Borussia Dortmund' },
  'borussia-monchengladbach':    { nameEs: 'Borussia M\'gladbach',   nameEn: 'Borussia M\'gladbach' },
  'eintracht-frankfurt':         { nameEs: 'Eintracht Frankfurt',    nameEn: 'Eintracht Frankfurt' },
  'fc-augsburg':                 { nameEs: 'FC Augsburg',            nameEn: 'FC Augsburg' },
  'fc-bayern-munchen':           { nameEs: 'Bayern Múnich',          nameEn: 'Bayern Munich' },
  'fc-koln':                     { nameEs: 'FC Köln',                nameEn: 'FC Köln' },
  'freiburg':                    { nameEs: 'SC Freiburg',            nameEn: 'SC Freiburg' },
  'hamburger-sv':                { nameEs: 'Hamburgo SV',            nameEn: 'Hamburger SV' },
  'heidenheim':                  { nameEs: '1. FC Heidenheim',       nameEn: '1. FC Heidenheim' },
  'rasenballsport-leipzig':      { nameEs: 'RB Leipzig',             nameEn: 'RB Leipzig' },
  'st-pauli':                    { nameEs: 'FC St. Pauli',           nameEn: 'FC St. Pauli' },
  'sv-werder-bremen':            { nameEs: 'Werder Bremen',          nameEn: 'Werder Bremen' },
  'tsg-1899-hoffenheim':         { nameEs: 'Hoffenheim',             nameEn: 'TSG 1899 Hoffenheim' },
  'vfb-stuttgart':               { nameEs: 'VfB Stuttgart',          nameEn: 'VfB Stuttgart' },
  'vfl-wolfsburg':               { nameEs: 'VfL Wolfsburg',          nameEn: 'VfL Wolfsburg' },

  // ══ 2. Bundesliga ═════════════════════════════════════════════
  '1-fc-magdeburg':              { nameEs: '1. FC Magdeburgo',       nameEn: '1. FC Magdeburg' },
  '1-fc-nurnberg':               { nameEs: '1. FC Núremberg',        nameEn: '1. FC Nurnberg' },
  'arminia-bielefeld':           { nameEs: 'Arminia Bielefeld',      nameEn: 'Arminia Bielefeld' },
  'darmstadt':                   { nameEs: 'SV Darmstadt 98',        nameEn: 'SV Darmstadt 98' },
  'dynamo-dresden':              { nameEs: 'Dinamo Dresde',          nameEn: 'Dynamo Dresden' },
  'eintracht-braunschweig':      { nameEs: 'E. Braunschweig',        nameEn: 'Eintracht Braunschweig' },
  'fc-schalke-04':               { nameEs: 'Schalke 04',             nameEn: 'FC Schalke 04' },
  'fortuna-dusseldorf':          { nameEs: 'Fortuna Düsseldorf',     nameEn: 'Fortuna Dusseldorf' },
  'greuther-furth':              { nameEs: 'SpVgg Greuther Fürth',   nameEn: 'Greuther Fürth' },
  'hannover-96':                 { nameEs: 'Hannover 96',            nameEn: 'Hannover 96' },
  'hertha-bsc':                  { nameEs: 'Hertha BSC',             nameEn: 'Hertha BSC' },
  'holstein-kiel':               { nameEs: 'Holstein Kiel',          nameEn: 'Holstein Kiel' },
  'kaiserslautern':              { nameEs: '1. FC Kaiserslautern',   nameEn: '1. FC Kaiserslautern' },
  'karlsruher-sc':               { nameEs: 'Karlsruher SC',          nameEn: 'Karlsruher SC' },
  'preussen-munster':            { nameEs: 'Preußen Münster',        nameEn: 'Preussen Münster' },
  'sc-paderborn-07':             { nameEs: 'SC Paderborn 07',        nameEn: 'SC Paderborn' },
  'sv-elversberg':               { nameEs: 'SV Elversberg',          nameEn: 'SV 07 Elversberg' },
  'vfl-bochum':                  { nameEs: 'VfL Bochum',             nameEn: 'VfL Bochum' },

  // ══ Ligue 1 ═══════════════════════════════════════════════════
  'angers':                      { nameEs: 'Angers SCO',             nameEn: 'Angers SCO' },
  'as-monaco':                   { nameEs: 'AS Mónaco',              nameEn: 'AS Monaco' },
  'auxerre':                     { nameEs: 'AJ Auxerre',             nameEn: 'AJ Auxerre' },
  'fc-paris-saint-germain':      { nameEs: 'Paris Saint-Germain',    nameEn: 'Paris Saint-Germain' },
  'fc-stade-rennes':             { nameEs: 'Stade Rennais',          nameEn: 'Stade Rennes' },
  'fc-toulouse':                 { nameEs: 'Toulouse FC',            nameEn: 'Toulouse FC' },
  'le-havre':                    { nameEs: 'Le Havre AC',            nameEn: 'Le Havre AC' },
  'montpellier-hsc':             { nameEs: 'Montpellier HSC',        nameEn: 'Montpellier HSC' },
  'nantes':                      { nameEs: 'FC Nantes',              nameEn: 'FC Nantes' },
  'nice':                        { nameEs: 'OGC Niza',               nameEn: 'OGC Nice' },
  'olympique-lyon':              { nameEs: 'Olympique de Lyon',      nameEn: 'Olympique Lyon' },
  'olympique-marseille':         { nameEs: 'Olympique de Marsella',  nameEn: 'Olympique Marseille' },
  'rc-lens':                     { nameEs: 'RC Lens',                nameEn: 'RC Lens' },
  'saint-etienne':               { nameEs: 'AS Saint-Étienne',       nameEn: 'AS Saint-Étienne' },
  'stade-reims':                 { nameEs: 'Stade de Reims',         nameEn: 'Stade de Reims' },
  'strasbourg':                  { nameEs: 'RC Strasbourg',          nameEn: 'RC Strasbourg' },

  // ══ Ligue 2 ═══════════════════════════════════════════════════
  'caen':                        { nameEs: 'SM Caen',                nameEn: 'SM Caen' },
  'guingamp':                    { nameEs: 'En Avant Guingamp',      nameEn: 'EA Guingamp' },
  'rodez-af':                    { nameEs: 'Rodez AF',               nameEn: 'Rodez AF' },

  // ══ Eredivisie ════════════════════════════════════════════════
  'ajax-amsterdam':              { nameEs: 'Ajax',                   nameEn: 'Ajax' },
  'az-alkmaar':                  { nameEs: 'AZ Alkmaar',             nameEn: 'AZ Alkmaar' },
  'fc-groningen':                { nameEs: 'FC Groningen',           nameEn: 'FC Groningen' },
  'fc-twente':                   { nameEs: 'FC Twente',              nameEn: 'FC Twente' },
  'fc-utrecht':                  { nameEs: 'FC Utrecht',             nameEn: 'FC Utrecht' },
  'feyenoord-rotterdam':         { nameEs: 'Feyenoord',              nameEn: 'Feyenoord' },
  'nac-breda':                   { nameEs: 'NAC Breda',              nameEn: 'NAC Breda' },
  'pec-zwolle':                  { nameEs: 'PEC Zwolle',             nameEn: 'PEC Zwolle' },
  'psv-eindhoven':               { nameEs: 'PSV Eindhoven',          nameEn: 'PSV Eindhoven' },
  'sc-heerenveen':               { nameEs: 'SC Heerenveen',          nameEn: 'SC Heerenveen' },
  'sparta-rotterdam':            { nameEs: 'Sparta Rotterdam',       nameEn: 'Sparta Rotterdam' },
  'vitesse-arnhem':              { nameEs: 'Vitesse',                nameEn: 'Vitesse Arnhem' },

  // ══ Liga Portugal ═════════════════════════════════════════════
  'benfica-lissabon':            { nameEs: 'Benfica',                nameEn: 'SL Benfica' },
  'boavista':                    { nameEs: 'Boavista FC',            nameEn: 'Boavista FC' },
  'casa-pia':                    { nameEs: 'Casa Pia AC',            nameEn: 'Casa Pia AC' },
  'famalicao':                   { nameEs: 'FC Famalicão',           nameEn: 'FC Famalicão' },
  'fc-porto':                    { nameEs: 'FC Porto',               nameEn: 'FC Porto' },
  'moreirense':                  { nameEs: 'Moreirense FC',          nameEn: 'Moreirense FC' },
  'rio-ave':                     { nameEs: 'Rio Ave FC',             nameEn: 'Rio Ave FC' },
  'sporting-cp':                 { nameEs: 'Sporting CP',            nameEn: 'Sporting CP' },
  'sporting-lissabon':           { nameEs: 'Sporting CP',            nameEn: 'Sporting CP' },
  'vitoria-guimaraes':           { nameEs: 'Vitória de Guimarães',   nameEn: 'Vitória Guimarães' },

  // ══ Premier League ════════════════════════════════════════════
  'birmingham-city':             { nameEs: 'Birmingham City',        nameEn: 'Birmingham City' },
  'blackburn-rovers':            { nameEs: 'Blackburn Rovers',       nameEn: 'Blackburn Rovers' },
  'bristol-city':                { nameEs: 'Bristol City',           nameEn: 'Bristol City' },
  'charlton-athletic':           { nameEs: 'Charlton Athletic',      nameEn: 'Charlton Athletic' },
  'coventry-city':               { nameEs: 'Coventry City',          nameEn: 'Coventry City' },
  'derby-county':                { nameEs: 'Derby County',           nameEn: 'Derby County' },
  'hull-city':                   { nameEs: 'Hull City',              nameEn: 'Hull City' },
  'ipswich-town':                { nameEs: 'Ipswich Town',           nameEn: 'Ipswich Town' },
  'leicester-city':              { nameEs: 'Leicester City',         nameEn: 'Leicester City' },
  'middlesbrough':               { nameEs: 'Middlesbrough',          nameEn: 'Middlesbrough' },
  'millwall':                    { nameEs: 'Millwall',               nameEn: 'Millwall' },
  'norwich-city':                { nameEs: 'Norwich City',           nameEn: 'Norwich City' },
  'oxford-united':               { nameEs: 'Oxford United',          nameEn: 'Oxford United' },
  'portsmouth-fc':               { nameEs: 'Portsmouth',             nameEn: 'Portsmouth' },
  'queens-park-rangers':         { nameEs: 'Queens Park Rangers',    nameEn: 'Queens Park Rangers' },
  'reading-fc':                  { nameEs: 'Reading FC',             nameEn: 'Reading FC' },
  'sheffield-united':            { nameEs: 'Sheffield United',       nameEn: 'Sheffield United' },
  'sheffield-wednesday':         { nameEs: 'Sheffield Wednesday',    nameEn: 'Sheffield Wednesday' },
  'stoke-city':                  { nameEs: 'Stoke City',             nameEn: 'Stoke City' },
  'sunderland':                  { nameEs: 'Sunderland AFC',         nameEn: 'Sunderland AFC' },
  'swansea-city':                { nameEs: 'Swansea City',           nameEn: 'Swansea City' },
  'watford-fc':                  { nameEs: 'Watford FC',             nameEn: 'Watford FC' },
  'west-bromwich-albion':        { nameEs: 'West Bromwich Albion',   nameEn: 'West Brom' },
  'wolverhampton-wanderers':     { nameEs: 'Wolverhampton',          nameEn: 'Wolverhampton Wanderers' },

  // ══ Saudi Pro League ══════════════════════════════════════════
  'al-ahli-dschidda':            { nameEs: 'Al-Ahli',                nameEn: 'Al-Ahli' },
  'al-ettifaq':                  { nameEs: 'Al-Ettifaq',             nameEn: 'Al-Ettifaq' },
  'al-ittihad-dschidda':         { nameEs: 'Al-Ittihad',             nameEn: 'Al-Ittihad' },
  'al-nasr-riad':                { nameEs: 'Al-Nassr',               nameEn: 'Al-Nassr' },
  'al-qadisiyah-fc':             { nameEs: 'Al-Qadsiah',             nameEn: 'Al-Qadsiah' },
  'al-shabab-riad':              { nameEs: 'Al-Shabab',              nameEn: 'Al-Shabab' },
  'al-hilal-saudi-fc':           { nameEs: 'Al-Hilal',               nameEn: 'Al-Hilal' },
  'al-hilal':                    { nameEs: 'Al-Hilal',               nameEn: 'Al-Hilal' },
  'al-nassr':                    { nameEs: 'Al-Nassr',               nameEn: 'Al-Nassr' },

  // ══ MLS ═══════════════════════════════════════════════════════
  'atlanta-united-fc':           { nameEs: 'Atlanta United',         nameEn: 'Atlanta United' },
  'columbus-crew-sc':            { nameEs: 'Columbus Crew',          nameEn: 'Columbus Crew' },
  'inter-miami-cf':              { nameEs: 'Inter Miami',            nameEn: 'Inter Miami' },
  'los-angeles-galaxy':          { nameEs: 'LA Galaxy',              nameEn: 'LA Galaxy' },
  'new-york-city-fc':            { nameEs: 'New York City FC',       nameEn: 'New York City FC' },
  'new-york-red-bulls-ii':       { nameEs: 'New York Red Bulls',     nameEn: 'New York Red Bulls' },
  'portland-timbers':            { nameEs: 'Portland Timbers',       nameEn: 'Portland Timbers' },
  'seattle-sounders-fc':         { nameEs: 'Seattle Sounders',       nameEn: 'Seattle Sounders' },
  'sporting-kansas-city':        { nameEs: 'Sporting Kansas City',   nameEn: 'Sporting Kansas City' },

  // ══ Scottish Premiership ══════════════════════════════════════
  'dundee-united-fc':            { nameEs: 'Dundee United',          nameEn: 'Dundee United' },

  // ══ Champions League / Europa teams ═══════════════════════════
  'fc-red-bull-salzburg':        { nameEs: 'RB Salzburgo',           nameEn: 'RB Salzburg' },
  'fc-copenhagen':               { nameEs: 'FC Copenhaguen',         nameEn: 'FC Copenhagen' },
  'club-brugge-kv':              { nameEs: 'Club Brujas',            nameEn: 'Club Brugge' },

  // ══ Fantasy / Special ════════════════════════════════════════
  'america-xi':                  { nameEs: 'América XI',             nameEn: 'America XI' },
  'best-xi-2025':                { nameEs: 'Mejores del Mundo 2025', nameEn: 'World Best XI 2025' },
  'best-xi-history':             { nameEs: 'Mejores de la Historia', nameEn: 'All-Time Best XI' },
  'europa-xi':                   { nameEs: 'Europa XI',              nameEn: 'Europe XI' },
  'resto-mundo':                 { nameEs: 'Resto del Mundo',        nameEn: 'Rest of the World' },
};

let updated = 0, skipped = 0, notFound = 0;
const files = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(SQUADS_DIR, file);
  try {
    const raw  = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const slug = data.slug || file.replace('.json', '');

    const mapping = NAME_MAP[slug];
    if (!mapping) { notFound++; continue; }

    if (data.nameEs && data.nameEn) { skipped++; continue; } // already has names

    const changed = !data.nameEs || !data.nameEn;
    if (!data.nameEs) data.nameEs = mapping.nameEs;
    if (!data.nameEn) data.nameEn = mapping.nameEn;
    // Also set the generic 'name' field for legacy compatibility
    if (!data.name) data.name = mapping.nameEn;

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  ✓ ${slug.padEnd(36)} → ${data.nameEs} / ${data.nameEn}`);
      updated++;
    } else {
      skipped++;
    }
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped (already had names), ${notFound} not in mapping`);
