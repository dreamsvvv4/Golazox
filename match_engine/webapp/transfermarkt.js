/**
 * transfermarkt.js — Transfermarkt squad scraper
 * ════════════════════════════════════════════════════════════
 * Historical squad data for major clubs worldwide.
 *
 * URL pattern:
 *   https://www.transfermarkt.es/{slug}/kader/verein/{id}/saison_id/{YYYY}
 *   where YYYY = start year of the season (1997-98 → 1997)
 *
 * HTML structure:
 *   <table class="items">
 *     <tr class="odd|even">
 *       <td class="zentriert rueckennummer" title="Portero">...</td>  ← position in title
 *       <td class="posrela">
 *         <table class="inline-table">
 *           <tr><td class="hauptlink"><a>Player Name</a></td></tr>
 *         </table>
 *       </td>
 *     </tr>
 *   </table>
 * ════════════════════════════════════════════════════════════
 */

'use strict';

const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');
const { buildXI, ELITE_NATIONALS, STRONG_NATIONALS } = require('./utils');
const FETCH_TIMEOUT = 10000;

// ─────────────────────────────────────────────────────────────
// Transfermarkt Spanish position text → internal position code
// ─────────────────────────────────────────────────────────────
const TM_POS = {
  'portero':                   'GK',
  'defensa':                   'CB',
  'defensa central':           'CB',
  'central':                   'CB',
  'lateral derecho':           'RB',
  'lateral izquierdo':         'LB',
  'centrocampista':            'CM',
  'centrocampista defensivo':  'DM',
  'pivote':                    'DM',
  'mediocentro':               'CM',
  'centrocampista ofensivo':   'AM',
  'mediapunta':                'AM',
  'interior derecho':          'CM',
  'interior izquierdo':        'CM',
  'extremo derecho':           'RW',
  'extremo izquierdo':         'LW',
  'delantero':                 'ST',
  'delantero centro':          'ST',
  'segunda punta':             'ST',
  'ariete':                    'ST',
  // English fallbacks (sometimes appears)
  'goalkeeper':                'GK',
  'centre-back':               'CB',
  'right back':                'RB',
  'left back':                 'LB',
  'defensive midfield':        'DM',
  'central midfield':          'CM',
  'attacking midfield':        'AM',
  'right midfield':            'RM',
  'left midfield':             'LM',
  'right winger':              'RW',
  'left winger':               'LW',
  'centre-forward':            'ST',
  'striker':                   'ST',
  // German (TM.de — primary scrape language)
  'torwart':                   'GK',
  'rechter verteidiger':       'RB',
  'innenverteidiger':          'CB',
  'linker verteidiger':        'LB',
  'defensives mittelfeld':     'DM',
  'zentrales mittelfeld':      'CM',
  'offensives mittelfeld':     'AM',
  'rechtes mittelfeld':        'RM',
  'linkes mittelfeld':         'LM',
  'rechtsaußen':               'RW',
  'linksaußen':                'LW',
  'mittelstürmer':             'ST',
  'sturmspitze':               'ST',
  'hängende spitze':           'AM',
  'zweite spitze':             'ST',
};

/**
 * Convierte valor de mercado (€) a OVR estilo FIFA usando escala logarítmica.
 * Calibrado con datos reales (Mbappé €200M~95, jugador medio Liga €3M~76, etc.)
 *   €200M+ → 93-96   €50-100M → 87-90   €20-50M → 83-86
 *   €5-20M → 78-82   €1-5M   → 73-77   <€1M    → 62-72
 */
function mvToRating(mv) {
  if (!mv || mv <= 0) return null;
  // log10 scale: log(100K)=5, log(1M)=6, log(10M)=7, log(100M)=8, log(200M)≈8.3
  const log = Math.log10(Math.max(mv, 50000));
  const raw = Math.round(30 + 8.5 * log);
  return Math.max(62, Math.min(95, raw));
}

function mapTmPos(raw) {
  if (!raw) return null;
  const p = raw.toLowerCase().trim();
  if (TM_POS[p]) return TM_POS[p];
  if (p.includes('portero') || p.includes('goalkeeper') || p.includes('torwart')) return 'GK';
  if (p.includes('lateral derecho') || p.includes('right back') || p.includes('rechter verteidiger')) return 'RB';
  if (p.includes('lateral izquierdo') || p.includes('left back') || p.includes('linker verteidiger')) return 'LB';
  if (p.includes('central') || p.includes('centre-back') || p.includes('defens') || p.includes('innenverteidiger')) return 'CB';
  if (p.includes('pivote') || p.includes('defensivo') || p.includes('defensive mid') || p.includes('defensives mittelfeld')) return 'DM';
  if (p.includes('rechtsaußen') || p.includes('extremo derecho') || p.includes('right wing')) return 'RW';
  if (p.includes('linksaußen') || p.includes('extremo izquierdo') || p.includes('left wing')) return 'LW';
  if (p.includes('mediapunta') || p.includes('ofensivo') || p.includes('attacking') || p.includes('offensives mittelfeld') || p.includes('hängende')) return 'AM';
  if (p.includes('centrocampista') || p.includes('midfield') || p.includes('medio') || p.includes('mittelfeld')) return 'CM';
  if (p.includes('delantero') || p.includes('forward') || p.includes('striker') || p.includes('stürmer') || p.includes('spitze')) return 'ST';
  return null;
}

// ─────────────────────────────────────────────────────────────
// Club registry: name → { id, slug }
// ─────────────────────────────────────────────────────────────
const TM_CLUBS = {
  // ── La Liga / Spanish ───────────────────────────────────────
  'real madrid':               { id: 418,   slug: 'real-madrid' },
  'real madrid cf':            { id: 418,   slug: 'real-madrid' },
  'madrid':                    { id: 418,   slug: 'real-madrid' },
  'barcelona':                 { id: 131,   slug: 'fc-barcelona' },
  'fc barcelona':              { id: 131,   slug: 'fc-barcelona' },
  'barça':                     { id: 131,   slug: 'fc-barcelona' },
  'barca':                     { id: 131,   slug: 'fc-barcelona' },
  'atletico madrid':           { id: 13,    slug: 'atletico-madrid' },
  'atlético madrid':           { id: 13,    slug: 'atletico-madrid' },
  'atletico de madrid':        { id: 13,    slug: 'atletico-madrid' },
  'atlético de madrid':        { id: 13,    slug: 'atletico-madrid' },
  'atleti':                    { id: 13,    slug: 'atletico-madrid' },
  'atletico-de-madrid':        { id: 13,    slug: 'atletico-madrid' },
  'sevilla':                   { id: 368,   slug: 'fc-sevilla' },
  'sevilla fc':                { id: 368,   slug: 'fc-sevilla' },
  'valencia':                  { id: 1049,  slug: 'fc-valencia' },
  'valencia cf':               { id: 1049,  slug: 'fc-valencia' },
  'villarreal':                { id: 1050,  slug: 'fc-villarreal' },
  'villarreal cf':             { id: 1050,  slug: 'fc-villarreal' },
  'athletic bilbao':           { id: 621,   slug: 'athletic-club' },
  'athletic club':             { id: 621,   slug: 'athletic-club' },
  'athletic':                  { id: 621,   slug: 'athletic-club' },
  'real sociedad':             { id: 681,   slug: 'real-sociedad-san-sebastian' },
  'betis':                     { id: 150,   slug: 'real-betis-balompie' },
  'real betis':                { id: 150,   slug: 'real-betis-balompie' },
  'celta vigo':                { id: 940,   slug: 'celta-vigo' },
  'celta de vigo':             { id: 940,   slug: 'celta-vigo' },
  'celta':                     { id: 940,   slug: 'celta-vigo' },
  'osasuna':                   { id: 331,   slug: 'ca-osasuna' },
  'ca osasuna':                { id: 331,   slug: 'ca-osasuna' },
  'deportivo':                 { id: 716,   slug: 'rc-deportivo' },
  'deportivo la coruña':       { id: 716,   slug: 'rc-deportivo' },
  'deportivo de la coruña':    { id: 716,   slug: 'rc-deportivo' },
  'espanyol':                  { id: 714,   slug: 'espanyol-barcelona' },
  'rcd espanyol':              { id: 714,   slug: 'espanyol-barcelona' },
  'girona':                    { id: 12321, slug: 'fc-girona' },
  'girona fc':                 { id: 12321, slug: 'fc-girona' },
  'malaga':                    { id: 59,    slug: 'malaga' },
  'málaga':                    { id: 59,    slug: 'malaga' },
  'málaga cf':                 { id: 59,    slug: 'malaga' },
  'rayo vallecano':            { id: 367,   slug: 'rayo-vallecano' },
  'rayo':                      { id: 367,   slug: 'rayo-vallecano' },
  'almeria':                   { id: 3302,  slug: 'ud-almeria' },
  'almería':                   { id: 3302,  slug: 'ud-almeria' },
  'ud almería':                { id: 3302,  slug: 'ud-almeria' },
  'levante':                   { id: 2282,  slug: 'levante-ud' },
  'levante ud':                { id: 2282,  slug: 'levante-ud' },
  'granada':                   { id: 16662, slug: 'granada-cf' },
  'granada cf':                { id: 16662, slug: 'granada-cf' },
  'valladolid':                { id: 366,   slug: 'real-valladolid-cf' },
  'real valladolid':           { id: 366,   slug: 'real-valladolid-cf' },
  'racing santander':          { id: 348,   slug: 'real-racing-club' },
  'racing de santander':       { id: 348,   slug: 'real-racing-club' },
  'zaragoza':                  { id: 142,   slug: 'real-zaragoza' },
  'real zaragoza':             { id: 142,   slug: 'real-zaragoza' },
  'cadiz':                     { id: 2055,  slug: 'cadiz-cf' },
  'cádiz':                     { id: 2055,  slug: 'cadiz-cf' },
  'mallorca':                  { id: 237,   slug: 'rcd-mallorca' },
  'real mallorca':             { id: 237,   slug: 'rcd-mallorca' },
  'eibar':                     { id: 1242,  slug: 'sd-eibar' },
  'sd eibar':                  { id: 1242,  slug: 'sd-eibar' },
  'alavés':                    { id: 1108,  slug: 'deportivo-alaves' },
  'alaves':                    { id: 1108,  slug: 'deportivo-alaves' },
  'huesca':                    { id: 4613,  slug: 'sd-huesca' },
  'sd huesca':                 { id: 4613,  slug: 'sd-huesca' },
  'elche':                     { id: 1531,  slug: 'elche-cf' },
  'elche cf':                  { id: 1531,  slug: 'elche-cf' },
  'leganes':                   { id: 13983, slug: 'cd-leganes' },
  'leganés':                   { id: 13983, slug: 'cd-leganes' },
  'cd leganés':                { id: 13983, slug: 'cd-leganes' },
  'getafe':                    { id: 3709,  slug: 'fc-getafe' },
  'getafe cf':                 { id: 3709,  slug: 'fc-getafe' },
  'sporting gijon':            { id: 755,   slug: 'sporting-de-gijon' },
  'sporting gijón':            { id: 755,   slug: 'sporting-de-gijon' },
  'las palmas':                { id: 7316,  slug: 'ud-las-palmas' },
  'ud las palmas':             { id: 7316,  slug: 'ud-las-palmas' },
  'oviedo':                    { id: 3334,  slug: 'real-oviedo' },
  'real oviedo':               { id: 3334,  slug: 'real-oviedo' },
  'tenerife':                  { id: 2379,  slug: 'cd-tenerife' },
  'cd tenerife':               { id: 2379,  slug: 'cd-tenerife' },
  'alcorcon':                  { id: 13986, slug: 'ad-alcorcon' },
  'alcorcón':                  { id: 13986, slug: 'ad-alcorcon' },
  'ponferradina':              { id: 16631, slug: 'sd-ponferradina' },
  'lugo':                      { id: 7555,  slug: 'cd-lugo' },
  'burgos cf':                 { id: 1536,  slug: 'burgos-cf' },
  'burgos':                    { id: 1536,  slug: 'burgos-cf' },
  'mirandés':                  { id: 6673,  slug: 'cd-mirandes' },
  'mirandes':                  { id: 6673,  slug: 'cd-mirandes' },
  // ── Premier League ──────────────────────────────────────────
  'manchester united':         { id: 985,   slug: 'manchester-united' },
  'man united':                { id: 985,   slug: 'manchester-united' },
  'man utd':                   { id: 985,   slug: 'manchester-united' },
  'manchester city':           { id: 281,   slug: 'manchester-city' },
  'man city':                  { id: 281,   slug: 'manchester-city' },
  'chelsea':                   { id: 631,   slug: 'fc-chelsea' },
  'arsenal':                   { id: 11,    slug: 'fc-arsenal' },
  'liverpool':                 { id: 31,    slug: 'fc-liverpool' },
  'tottenham':                 { id: 148,   slug: 'tottenham-hotspur' },
  'tottenham hotspur':         { id: 148,   slug: 'tottenham-hotspur' },
  'spurs':                     { id: 148,   slug: 'tottenham-hotspur' },
  'newcastle':                 { id: 762,   slug: 'newcastle-united' },
  'newcastle united':          { id: 762,   slug: 'newcastle-united' },
  'west ham':                  { id: 379,   slug: 'west-ham-united' },
  'west ham united':           { id: 379,   slug: 'west-ham-united' },
  'aston villa':               { id: 405,   slug: 'aston-villa' },
  'everton':                   { id: 29,    slug: 'fc-everton' },
  'leicester':                 { id: 1003,  slug: 'leicester-city' },
  'leicester city':            { id: 1003,  slug: 'leicester-city' },
  'wolves':                    { id: 543,   slug: 'wolverhampton-wanderers' },
  'wolverhampton':             { id: 543,   slug: 'wolverhampton-wanderers' },
  'brighton':                  { id: 1237,  slug: 'brighton-hove-albion' },
  'nottingham forest':         { id: 703,   slug: 'nottingham-forest' },
  'leeds':                     { id: 399,   slug: 'leeds-united' },
  'leeds united':              { id: 399,   slug: 'leeds-united' },
  // ── Bundesliga ──────────────────────────────────────────────
  'bayern munich':             { id: 27,    slug: 'fc-bayern-munchen' },
  'fc bayern':                 { id: 27,    slug: 'fc-bayern-munchen' },
  'bayern':                    { id: 27,    slug: 'fc-bayern-munchen' },
  'borussia dortmund':         { id: 16,    slug: 'borussia-dortmund' },
  'dortmund':                  { id: 16,    slug: 'borussia-dortmund' },
  'bvb':                       { id: 16,    slug: 'borussia-dortmund' },
  'bayer leverkusen':          { id: 15,    slug: 'bayer-04-leverkusen' },
  'leverkusen':                { id: 15,    slug: 'bayer-04-leverkusen' },
  'rb leipzig':                { id: 23826, slug: 'rasenballsport-leipzig' },
  'leipzig':                   { id: 23826, slug: 'rasenballsport-leipzig' },
  'schalke':                   { id: 33,    slug: 'fc-schalke-04' },
  'borussia monchengladbach':  { id: 18,    slug: 'borussia-monchengladbach' },
  'eintracht frankfurt':       { id: 24,    slug: 'eintracht-frankfurt' },
  'wolfsburg':                 { id: 82,    slug: 'vfl-wolfsburg' },
  'hoffenheim':                { id: 533,   slug: 'tsg-1899-hoffenheim' },
  // ── Serie A ─────────────────────────────────────────────────
  'juventus':                  { id: 506,   slug: 'juventus-turin' },
  'juve':                      { id: 506,   slug: 'juventus-turin' },
  'ac milan':                  { id: 5,     slug: 'ac-mailand' },
  'milan':                     { id: 5,     slug: 'ac-mailand' },
  'inter milan':               { id: 46,    slug: 'inter-mailand' },
  'inter':                     { id: 46,    slug: 'inter-mailand' },
  'internazionale':            { id: 46,    slug: 'inter-mailand' },
  'inter de milan':            { id: 46,    slug: 'inter-mailand' },
  'inter milán':               { id: 46,    slug: 'inter-mailand' },
  'inter-mailand':             { id: 46,    slug: 'inter-mailand' },
  'fc inter':                  { id: 46,    slug: 'inter-mailand' },
  'ac milan':                  { id: 5,     slug: 'ac-mailand' },
  'milan':                     { id: 5,     slug: 'ac-mailand' },
  'ac milán':                  { id: 5,     slug: 'ac-mailand' },
  'roma':                      { id: 12,    slug: 'as-rom' },
  'as roma':                   { id: 12,    slug: 'as-rom' },
  'napoli':                    { id: 6195,  slug: 'ssc-neapel' },
  'ssc napoli':                { id: 6195,  slug: 'ssc-neapel' },
  'lazio':                     { id: 398,   slug: 'lazio-rom' },
  'ss lazio':                  { id: 398,   slug: 'lazio-rom' },
  'atalanta':                  { id: 800,   slug: 'atalanta-bc' },
  'fiorentina':                { id: 430,   slug: 'ac-florenz' },
  'torino':                    { id: 416,   slug: 'fc-turin' },
  // ── Ligue 1 ─────────────────────────────────────────────────
  'paris saint-germain':       { id: 583,   slug: 'fc-paris-saint-germain' },
  'psg':                       { id: 583,   slug: 'fc-paris-saint-germain' },
  'paris saint germain':       { id: 583,   slug: 'fc-paris-saint-germain' },
  'marseille':                 { id: 244,   slug: 'olympique-marseille' },
  'olympique marseille':       { id: 244,   slug: 'olympique-marseille' },
  'lyon':                      { id: 1041,  slug: 'olympique-lyon' },
  'olympique lyonnais':        { id: 1041,  slug: 'olympique-lyon' },
  'monaco':                    { id: 162,   slug: 'as-monaco' },
  'as monaco':                 { id: 162,   slug: 'as-monaco' },
  // ── Dutch / Portuguese / Belgian ────────────────────────────
  'ajax':                      { id: 610,   slug: 'ajax-amsterdam' },
  'afc ajax':                  { id: 610,   slug: 'ajax-amsterdam' },
  'psv':                       { id: 383,   slug: 'psv-eindhoven' },
  'psv eindhoven':             { id: 383,   slug: 'psv-eindhoven' },
  'feyenoord':                 { id: 234,   slug: 'feyenoord-rotterdam' },
  'porto':                     { id: 720,   slug: 'fc-porto' },
  'fc porto':                  { id: 720,   slug: 'fc-porto' },
  'benfica':                   { id: 294,   slug: 'benfica-lissabon' },
  'sl benfica':                { id: 294,   slug: 'benfica-lissabon' },
  'sporting cp':               { id: 336,   slug: 'sporting-cp' },
  'celtic':                    { id: 371,   slug: 'celtic-glasgow' },
  'anderlecht':                { id: 28,    slug: 'rsc-anderlecht' },
  // ── Additional Premier League / Championship ─────────────────
  'fulham':                    { id: 931,   slug: 'fc-fulham' },
  'fc fulham':                 { id: 931,   slug: 'fc-fulham' },
  'crystal palace':            { id: 873,   slug: 'crystal-palace' },
  'brentford':                 { id: 1148,  slug: 'fc-brentford' },
  'brentford fc':              { id: 1148,  slug: 'fc-brentford' },
  'burnley':                   { id: 1132,  slug: 'fc-burnley' },
  'sheffield united':          { id: 350,   slug: 'sheffield-united' },
  'watford':                   { id: 1010,  slug: 'fc-watford' },
  'stoke city':                { id: 512,   slug: 'stoke-city' },
  'coventry city':             { id: 1162,  slug: 'coventry-city' },
  // ── Additional Bundesliga ────────────────────────────────────
  'union berlin':              { id: 89,    slug: '1-fc-union-berlin' },
  '1. fc union berlin':        { id: 89,    slug: '1-fc-union-berlin' },
  'augsburg':                  { id: 167,   slug: 'fc-augsburg' },
  'fc augsburg':               { id: 167,   slug: 'fc-augsburg' },
  'hertha berlin':             { id: 86,    slug: 'hertha-bsc' },
  'hertha bsc':                { id: 86,    slug: 'hertha-bsc' },
  'hamburger sv':              { id: 41,    slug: 'hamburger-sv' },
  'hsv':                       { id: 41,    slug: 'hamburger-sv' },
  'hannover 96':               { id: 534,   slug: 'hannover-96' },
  'hannover':                  { id: 534,   slug: 'hannover-96' },
  // ── Additional Serie A ───────────────────────────────────────
  'genoa':                     { id: 252,   slug: 'cfc-genua' },
  'hellas verona':             { id: 276,   slug: 'hellas-verona' },
  'verona':                    { id: 276,   slug: 'hellas-verona' },
  'udinese':                   { id: 410,   slug: 'udinese-calcio' },
  'lecce':                     { id: 1836,  slug: 'us-lecce' },
  'empoli':                    { id: 749,   slug: 'fc-empoli' },
  'monza':                     { id: 6316,  slug: 'ac-monza' },
  'ac monza':                  { id: 6316,  slug: 'ac-monza' },
  // ── Additional Ligue 1 ───────────────────────────────────────
  'lens':                      { id: 826,   slug: 'rc-lens' },
  'rc lens':                   { id: 826,   slug: 'rc-lens' },
  'rennes':                    { id: 273,   slug: 'fc-stade-rennes' },
  'stade rennais':             { id: 273,   slug: 'fc-stade-rennes' },
  'toulouse':                  { id: 415,   slug: 'fc-toulouse' },
  'montpellier':               { id: 969,   slug: 'montpellier-hsc' },
  'lille':                     { id: 1082,  slug: 'losc-lille' },
  'losc lille':                { id: 1082,  slug: 'losc-lille' },
  'nice':                      { id: 417,   slug: 'nice' },
  'ogc nice':                  { id: 417,   slug: 'nice' },
  'nantes':                    { id: 955,   slug: 'nantes' },
  'fc nantes':                 { id: 955,   slug: 'nantes' },
  'reims':                     { id: 1421,  slug: 'stade-reims' },
  'stade de reims':            { id: 1421,  slug: 'stade-reims' },
  'strasbourg':                { id: 667,   slug: 'rc-strasbourg' },
  'brest':                     { id: 3911,  slug: 'stade-brest-29' },
  'stade brestois':            { id: 3911,  slug: 'stade-brest-29' },
  'saint etienne':             { id: 618,   slug: 'as-saint-etienne' },
  'as saint etienne':          { id: 618,   slug: 'as-saint-etienne' },
  'auxerre':                   { id: 3474,  slug: 'auxerre' },
  'aj auxerre':                { id: 3474,  slug: 'auxerre' },
  // ── Championship ─────────────────────────────────────────────
  'sunderland':                { id: 289,   slug: 'sunderland' },
  'sunderland afc':            { id: 289,   slug: 'sunderland' },
  'nottingham forest':         { id: 703,   slug: 'nottingham-forest' },
  'sheffield wednesday':       { id: 1035,  slug: 'sheffield-wednesday' },
  'southampton':               { id: 180,   slug: 'southampton-fc' },
  'wba':                       { id: 984,   slug: 'west-bromwich-albion' },
  'west brom':                 { id: 984,   slug: 'west-bromwich-albion' },
  'west bromwich albion':      { id: 984,   slug: 'west-bromwich-albion' },
  'wrexham':                   { id: 67,    slug: 'wrexham' },
  'wrexham afc':               { id: 67,    slug: 'wrexham' },
  'norwich city':              { id: 1093,  slug: 'norwich-city' },
  'norwich':                   { id: 1093,  slug: 'norwich-city' },
  'middlesbrough':             { id: 1453,  slug: 'middlesbrough' },
  'swansea city':              { id: 2288,  slug: 'swansea-city' },
  'swansea':                   { id: 2288,  slug: 'swansea-city' },
  'blackburn rovers':          { id: 164,   slug: 'blackburn-rovers' },
  'blackburn':                 { id: 164,   slug: 'blackburn-rovers' },
  'hull city':                 { id: 1190,  slug: 'hull-city' },
  'derby county':              { id: 1246,  slug: 'derby-county' },
  'derby':                     { id: 1246,  slug: 'derby-county' },
  'bristol city':              { id: 1295,  slug: 'bristol-city' },
  'charlton athletic':         { id: 42,    slug: 'charlton-athletic' },
  'charlton':                  { id: 42,    slug: 'charlton-athletic' },
  'millwall':                  { id: 1353,  slug: 'millwall' },
  'oxford united':             { id: 1091,  slug: 'oxford-united' },
  'oxford':                    { id: 1091,  slug: 'oxford-united' },
  'portsmouth':                { id: 1045,  slug: 'portsmouth-fc' },
  'preston north end':         { id: 1227,  slug: 'preston-north-end' },
  'preston':                   { id: 1227,  slug: 'preston-north-end' },
  'qpr':                       { id: 1027,  slug: 'queens-park-rangers' },
  'queens park rangers':       { id: 1027,  slug: 'queens-park-rangers' },
  'birmingham city':           { id: 1069,  slug: 'birmingham-city' },
  'birmingham':                { id: 1069,  slug: 'birmingham-city' },
  // ── Bundesliga additions ──────────────────────────────────────
  'heidenheim':                { id: 41543, slug: '1-fc-heidenheim-1846' },
  '1. fc heidenheim':          { id: 41543, slug: '1-fc-heidenheim-1846' },
  'fc köln':                   { id: 3,     slug: '1-fc-koln' },
  '1. fc köln':                { id: 3,     slug: '1-fc-koln' },
  'koln':                      { id: 3,     slug: '1-fc-koln' },
  'köln':                      { id: 3,     slug: '1-fc-koln' },
  'st. pauli':                 { id: 35,    slug: 'fc-st-pauli' },
  'fc st. pauli':              { id: 35,    slug: 'fc-st-pauli' },
  'vfb stuttgart':             { id: 79,    slug: 'vfb-stuttgart' },
  'stuttgart':                 { id: 79,    slug: 'vfb-stuttgart' },
  'werder bremen':             { id: 66,    slug: 'sv-werder-bremen' },
  'sv werder bremen':          { id: 66,    slug: 'sv-werder-bremen' },
  // ── 2. Bundesliga ─────────────────────────────────────────────
  'kaiserslautern':            { id: 22,    slug: 'kaiserslautern' },
  '1. fc kaiserslautern':      { id: 22,    slug: 'kaiserslautern' },
  'fc magdeburg':              { id: 14,    slug: '1-fc-magdeburg' },
  '1. fc magdeburg':           { id: 14,    slug: '1-fc-magdeburg' },
  'nürnberg':                  { id: 4,     slug: '1-fc-nurnberg' },
  'nurnberg':                  { id: 4,     slug: '1-fc-nurnberg' },
  '1. fc nürnberg':            { id: 4,     slug: '1-fc-nurnberg' },
  'arminia bielefeld':         { id: 211,   slug: 'arminia-bielefeld' },
  'bielefeld':                 { id: 211,   slug: 'arminia-bielefeld' },
  'darmstadt':                 { id: 5390,  slug: 'darmstadt' },
  'sv darmstadt':              { id: 5390,  slug: 'darmstadt' },
  'dynamo dresden':            { id: 38,    slug: 'dynamo-dresden' },
  'sg dynamo dresden':         { id: 38,    slug: 'dynamo-dresden' },
  'eintracht braunschweig':    { id: 36,    slug: 'eintracht-braunschweig' },
  'braunschweig':              { id: 36,    slug: 'eintracht-braunschweig' },
  'fortuna düsseldorf':        { id: 440,   slug: 'fortuna-dusseldorf' },
  'fortuna dusseldorf':        { id: 440,   slug: 'fortuna-dusseldorf' },
  'greuther fürth':            { id: 2405,  slug: 'greuther-furth' },
  'greuther furth':            { id: 2405,  slug: 'greuther-furth' },
  'spvgg greuther fürth':      { id: 2405,  slug: 'greuther-furth' },
  'holstein kiel':             { id: 1503,  slug: 'holstein-kiel' },
  'karlsruher sc':             { id: 349,   slug: 'karlsruher-sc' },
  'karlsruhe':                 { id: 349,   slug: 'karlsruher-sc' },
  'preußen münster':           { id: 1046,  slug: 'preussen-munster' },
  'preussen munster':          { id: 1046,  slug: 'preussen-munster' },
  'sc paderborn':              { id: 5081,  slug: 'sc-paderborn-07' },
  'paderborn':                 { id: 5081,  slug: 'sc-paderborn-07' },
  'elversberg':                { id: 218,   slug: 'sv-07-elversberg' },
  'sv elversberg':             { id: 218,   slug: 'sv-07-elversberg' },
  'vfl bochum':                { id: 80,    slug: 'vfl-bochum' },
  'bochum':                    { id: 80,    slug: 'vfl-bochum' },
  'elversberg':                { id: 4459,  slug: 'sv-07-elversberg' },
  'sv elversberg':             { id: 4459,  slug: 'sv-07-elversberg' },
  'ipswich town':              { id: 677,   slug: 'ipswich-town' },
  'ipswich':                   { id: 677,   slug: 'ipswich-town' },
  'luton town':                { id: 1179,  slug: 'luton-town' },
  'luton':                     { id: 1179,  slug: 'luton-town' },
  // ── Ligue 1 additions ─────────────────────────────────────────
  'angers':                    { id: 3284,  slug: 'angers' },
  'sco angers':                { id: 3284,  slug: 'angers' },
  'lorient':                   { id: 1158,  slug: 'fc-lorient' },
  'fc lorient':                { id: 1158,  slug: 'fc-lorient' },
  'le havre':                  { id: 1174,  slug: 'le-havre' },
  // ── Ligue 2 additions ─────────────────────────────────────────
  'guingamp':                  { id: 296,   slug: 'guingamp' },
  'ea guingamp':               { id: 296,   slug: 'guingamp' },
  // ── UCL / Europa ─────────────────────────────────────────────
  'young boys':                { id: 2025,  slug: 'bsc-young-boys' },
  'bsc young boys':            { id: 2025,  slug: 'bsc-young-boys' },
  'red bull salzburg':         { id: 409,   slug: 'red-bull-salzburg' },
  'rb salzburg':               { id: 409,   slug: 'red-bull-salzburg' },
  'salzburg':                  { id: 409,   slug: 'red-bull-salzburg' },
  'shakhtar donetsk':          { id: 660,   slug: 'shakhtar-donetsk' },
  'dinamo zagreb':             { id: 419,   slug: 'gnk-dinamo-zagreb' },
  // ── Saudi Pro League (explicit entries to skip dynamic search) ──────────────────
  'al-nassr':                  { id: 18544, slug: 'al-nasr-riad' },
  'al nassr':                  { id: 18544, slug: 'al-nasr-riad' },
  'al-nassr fc':               { id: 18544, slug: 'al-nasr-riad' },
  // ── MLS ──────────────────────────────────────────────────────
  'inter miami':               { id: 68274, slug: 'inter-miami-cf' },
  'inter miami cf':            { id: 68274, slug: 'inter-miami-cf' },
  'inter de miami':            { id: 68274, slug: 'inter-miami-cf' },
  'inter de miami cf':         { id: 68274, slug: 'inter-miami-cf' },
  'lafc':                      { id: 38464, slug: 'los-angeles-fc' },
  'los angeles fc':            { id: 38464, slug: 'los-angeles-fc' },
  'la fc':                     { id: 38464, slug: 'los-angeles-fc' },
  // ── Saudi Pro League ─────────────────────────────────────────
  'al-hilal':                  { id: 2672,  slug: 'al-hilal-saudi-fc' },
  'al hilal':                  { id: 2672,  slug: 'al-hilal-saudi-fc' },
  // ── Scotland ─────────────────────────────────────────────────
  // Rangers — ID verificado via búsqueda TM (glasgow-rangers, ID 124)
  'rangers':                   { id: 124,   slug: 'glasgow-rangers' },
  'rangers fc':                { id: 124,   slug: 'glasgow-rangers' },
  'glasgow rangers':           { id: 124,   slug: 'glasgow-rangers' },
  // ── South American ───────────────────────────────────────────
  'internacional':             { id: 6600,  slug: 'sc-internacional' },
  'sc internacional':          { id: 6600,  slug: 'sc-internacional' },
  'flamengo':                  { id: 614,   slug: 'flamengo-rio-de-janeiro' },
  'cr flamengo':               { id: 614,   slug: 'flamengo-rio-de-janeiro' },
  'palmeiras':                 { id: 1023,  slug: 'se-palmeiras' },
  'se palmeiras':              { id: 1023,  slug: 'se-palmeiras' },
  'fluminense':                { id: 2039,  slug: 'fluminense-fc' },
  'fluminense fc':             { id: 2039,  slug: 'fluminense-fc' },
  'corinthians':               { id: 199,   slug: 'corinthians-sao-paulo' },
  'sc corinthians':            { id: 199,   slug: 'corinthians-sao-paulo' },
  'atletico mineiro':          { id: 330,   slug: 'clube-atletico-mineiro' },
  'atlético mineiro':          { id: 330,   slug: 'clube-atletico-mineiro' },
  'clube atletico mineiro':    { id: 330,   slug: 'clube-atletico-mineiro' },
  'sao paulo fc':              { id: 585,   slug: 'fc-sao-paulo' },
  'sao paulo':                 { id: 585,   slug: 'fc-sao-paulo' },
  'fc sao paulo':              { id: 585,   slug: 'fc-sao-paulo' },
  'santos fc':                 { id: 877,   slug: 'fc-santos' },
  'santos':                    { id: 877,   slug: 'fc-santos' },
  'estudiantes':               { id: 288,   slug: 'club-estudiantes-de-la-plata' },
  'estudiantes de la plata':   { id: 288,   slug: 'club-estudiantes-de-la-plata' },
  'racing club':               { id: 1444,  slug: 'racing-club' },
  'racing club avellaneda':    { id: 1444,  slug: 'racing-club' },

  // ── Liga MX ──────────────────────────────────────────────────
  'monterrey':                 { id: 2775,  slug: 'cf-monterrey' },
  'cf monterrey':              { id: 2775,  slug: 'cf-monterrey' },
  'guadalajara':               { id: 6711,  slug: 'deportivo-guadalajara' },
  'chivas':                    { id: 6711,  slug: 'deportivo-guadalajara' },
  'deportivo guadalajara':     { id: 6711,  slug: 'deportivo-guadalajara' },
  'club guadalajara':          { id: 6711,  slug: 'deportivo-guadalajara' },
  'cruz azul':                 { id: 3711,  slug: 'cd-cruz-azul' },
  'club america':              { id: 3631,  slug: 'cf-america' },
  'club américa':              { id: 3631,  slug: 'cf-america' },
  'america':                   { id: 3631,  slug: 'cf-america' },
  'pumas unam':                { id: 2793,  slug: 'pumas-unam' },
  'pumas':                     { id: 2793,  slug: 'pumas-unam' },
  'pachuca':                   { id: 2797,  slug: 'cf-pachuca' },
  'cf pachuca':                { id: 2797,  slug: 'cf-pachuca' },
  'leon':                      { id: 2800,  slug: 'club-leon' },
  'club leon':                 { id: 2800,  slug: 'club-leon' },
  'toluca':                    { id: 2780,  slug: 'deportivo-toluca' },
  'deportivo toluca':          { id: 2780,  slug: 'deportivo-toluca' },

  // ── Turkish Süper Lig ────────────────────────────────────────
  'fenerbahce':                { id: 36,    slug: 'fenerbahce-sk' },
  'fenerbahçe':                { id: 36,    slug: 'fenerbahce-sk' },
  'fenerbahce sk':             { id: 36,    slug: 'fenerbahce-sk' },
  'besiktas':                  { id: 114,   slug: 'besiktas-jk' },
  'beşiktaş':                  { id: 114,   slug: 'besiktas-jk' },
  'besiktas jk':               { id: 114,   slug: 'besiktas-jk' },
  'trabzonspor':               { id: 449,   slug: 'trabzonspor' },
  'basaksehir':                { id: 4904,  slug: 'istanbul-basaksehir' },
  'istanbul basaksehir':       { id: 4904,  slug: 'istanbul-basaksehir' },

  // ── Greek Super League ───────────────────────────────────────
  'olympiacos':                { id: 414,   slug: 'olympiakos-piraeus' },
  'olympiakos':                { id: 414,   slug: 'olympiakos-piraeus' },
  'paok':                      { id: 760,   slug: 'paok-saloniki' },
  'panathinaikos':             { id: 1034,  slug: 'panathinaikos-athen' },
  'aek athens':                { id: 4,     slug: 'aek-athen' },
  'aek':                       { id: 4,     slug: 'aek-athen' },

  // ── Belgian Pro League ───────────────────────────────────────
  'standard liege':            { id: 204,   slug: 'standard-luttich' },
  'standard liège':            { id: 204,   slug: 'standard-luttich' },
  'standard':                  { id: 204,   slug: 'standard-luttich' },
  'genk':                      { id: 210,   slug: 'krc-genk' },
  'krc genk':                  { id: 210,   slug: 'krc-genk' },
  'union saint gilloise':      { id: 72,    slug: 'royale-union-saint-gilloise' },
  // ── Norwegian Eliteserien ─────────────────────────────────────
  'bodo/glimt':                { id: 33985, slug: 'fk-bodo-glimt' },
  'fk bodo glimt':             { id: 33985, slug: 'fk-bodo-glimt' },
  // ── Other UCL ─────────────────────────────────────────────────
  'qarabag':                   { id: 3036,  slug: 'qarabag-fk' },
  'qarabag fk':                { id: 3036,  slug: 'qarabag-fk' },

  // ── Austrian Bundesliga ──────────────────────────────────────
  'rapid vienna':              { id: 6,     slug: 'sk-rapid-wien' },
  'rapid wien':                { id: 6,     slug: 'sk-rapid-wien' },
  'sk rapid':                  { id: 6,     slug: 'sk-rapid-wien' },
  'austria vienna':            { id: 503,   slug: 'fk-austria-wien' },
  'fk austria wien':           { id: 503,   slug: 'fk-austria-wien' },
  'lask':                      { id: 1988,  slug: 'lask-linz' },
  'lask linz':                 { id: 1988,  slug: 'lask-linz' },
  'wolfsberg':                 { id: 2741,  slug: 'rz-pellets-wac' },
  'wac':                       { id: 2741,  slug: 'rz-pellets-wac' },

  // ── Scottish Premiership ─────────────────────────────────────
  'aberdeen':                  { id: 61,    slug: 'fc-aberdeen' },
  'fc aberdeen':               { id: 61,    slug: 'fc-aberdeen' },
  'hearts':                    { id: 697,   slug: 'heart-of-midlothian' },
  'heart of midlothian':       { id: 697,   slug: 'heart-of-midlothian' },
  'hibernian':                 { id: 448,   slug: 'hibernian-fc' },
  'motherwell':                { id: 7439,  slug: 'motherwell-fc' },

  // ── Ukrainian Premier League ─────────────────────────────────
  'dynamo kyiv':               { id: 338,   slug: 'dynamo-kiew' },
  'dynamo kiev':               { id: 338,   slug: 'dynamo-kiew' },

  // ── Selecciones nacionales ──────────────────────────────
  // NOTA: Solo se incluyen IDs verificados que devuelven la selección correcta.
  // El resto se resuelve mediante búsqueda dinámica (Nationalelf endpoint).
  // IDs verificados manualmente (producen jugadores del país correcto):
  'alemania':                  { id: 3262,  slug: 'deutschland' },
  'germany':                   { id: 3262,  slug: 'deutschland' },
  'deutschland':               { id: 3262,  slug: 'deutschland' },
  'españa':                    { id: 3375,  slug: 'spanien' },
  'espana':                    { id: 3375,  slug: 'spanien' },
  'spain':                     { id: 3375,  slug: 'spanien' },
  'seleccion española':        { id: 3375,  slug: 'spanien' },
  'seleccion espanola':        { id: 3375,  slug: 'spanien' },
  'france':                    { id: 3377,  slug: 'frankreich' },
  'francia':                   { id: 3377,  slug: 'frankreich' },
  'italy':                     { id: 3376,  slug: 'italien' },
  'italia':                    { id: 3376,  slug: 'italien' },
  'belgium':                   { id: 3382,  slug: 'belgien' },
  'bélgica':                   { id: 3382,  slug: 'belgien' },
  'belgica':                   { id: 3382,  slug: 'belgien' },
  'argentina':                 { id: 3437,  slug: 'argentinien' },
  'brazil':                    { id: 3439,  slug: 'brasilien' },
  'brasil':                    { id: 3439,  slug: 'brasilien' },
  // ── Additional verified European national teams ─────────────
  'england':                   { id: 3299,  slug: 'england' },
  'inglaterra':                { id: 3299,  slug: 'england' },
  'portugal':                  { id: 3300,  slug: 'portugal' },
  'netherlands':               { id: 3379,  slug: 'niederlande' },
  'holanda':                   { id: 3379,  slug: 'niederlande' },
  'holland':                   { id: 3379,  slug: 'niederlande' },
  'paises bajos':              { id: 3379,  slug: 'niederlande' },
  'scotland':                  { id: 3380,  slug: 'schottland' },
  'escocia':                   { id: 3380,  slug: 'schottland' },
  'austria':                   { id: 3383,  slug: 'osterreich' },
  'österreich':                { id: 3383,  slug: 'osterreich' },
  'osterreich':                { id: 3383,  slug: 'osterreich' },
  'denmark':                   { id: 3436,  slug: 'danemark' },
  'dinamarca':                 { id: 3436,  slug: 'danemark' },
  'sweden':                    { id: 3557,  slug: 'schweden' },
  'suecia':                    { id: 3557,  slug: 'schweden' },
  'switzerland':               { id: 3384,  slug: 'schweiz' },
  'suiza':                     { id: 3384,  slug: 'schweiz' },
  'croatia':                   { id: 3556,  slug: 'kroatien' },
  'croacia':                   { id: 3556,  slug: 'kroatien' },
  'czech republic':            { id: 3445,  slug: 'tschechien' },
  'czechia':                   { id: 3445,  slug: 'tschechien' },
  'república checa':           { id: 3445,  slug: 'tschechien' },
  'republica checa':           { id: 3445,  slug: 'tschechien' },
};

// ─────────────────────────────────────────────────────────────
// Resolve club name → { id, slug }
// ─────────────────────────────────────────────────────────────
function resolveClub(teamName) {
  const key = teamName.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [k, info] of Object.entries(TM_CLUBS)) {
    const normK = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normK === key) return info;
  }

  // Slug-based lookup: if the input looks like a slug (e.g. "atletico-madrid"),
  // only match by exact slug value — never fall through to the fuzzy match.
  // Fuzzy substring matching on hyphenated slugs causes false positives because
  // short TM_CLUBS keys like "madrid", "athletic", "deportivo", "barcelona",
  // "sevilla", "rangers", "juventus" etc. are substrings of many unrelated slugs:
  //   "atletico-madrid"      → would fuzzy-match "madrid"     → Real Madrid
  //   "deportivo-alaves"     → would fuzzy-match "deportivo"  → RC Deportivo
  //   "rcd-espanyol-barcelona" → would fuzzy-match "barcelona" → FC Barcelona
  //   "real-betis-sevilla"   → would fuzzy-match "sevilla"    → Sevilla FC
  //   "charlton-athletic"    → would fuzzy-match "athletic"   → Athletic Club
  if (key.includes('-')) {
    for (const [, info] of Object.entries(TM_CLUBS)) {
      if (info.slug === key) return info;
    }
    return null; // slug not found in TM_CLUBS — avoid false fuzzy positives
  }

  // Partial/fuzzy match — normK.includes(key) only fires when key ≥5 chars,
  // preventing short words like 'iran' or 'peru' from matching unrelated club names.
  let best = null, bestLen = 0;
  for (const [k, info] of Object.entries(TM_CLUBS)) {
    const normK = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if ((key.includes(normK) || (key.length >= 5 && normK.includes(key))) && normK.length > bestLen) {
      best = info;
      bestLen = normK.length;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────
// Dynamic Transfermarkt search — find ANY club by name
// Caches results to avoid repeated network calls in the same session
// ─────────────────────────────────────────────────────────────
const _tmSearchCache = new Map(); // teamName.lc → { slug, id } | null  (capped at 300)
const _TM_CACHE_MAX = 300;

// ─────────────────────────────────────────────────────────────
// Persistent per-team squad store
//   squads/{slug}.json  →  { id, slug, name, seasons: { "2010": { formation, players, ... } } }
//
// One file per team/country, all seasons inside.
// Human-readable and easy to inspect / edit manually.
// ─────────────────────────────────────────────────────────────
const SQUADS_DIR = path.join(__dirname, 'squads');
if (!fs.existsSync(SQUADS_DIR)) fs.mkdirSync(SQUADS_DIR, { recursive: true });

// Count how many team files exist at startup
try {
  const count = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json')).length;
  if (count > 0) console.log(`[squads] ${count} equipos en caché local (squads/)`);
} catch (_) {}

/** In-memory cache: slug → parsed team file object */
const _teamFileCache = new Map();

/** Read a team file; returns { slug, seasons:{} } if missing */
function _loadTeamFile(slug) {
  if (_teamFileCache.has(slug)) return _teamFileCache.get(slug);
  const file = path.resolve(SQUADS_DIR, `${slug}.json`);
  // Path containment: reject any slug that escapes the squads directory
  if (!file.startsWith(SQUADS_DIR + path.sep) && file !== SQUADS_DIR) {
    console.warn('[squads] Blocked path traversal attempt for slug:', slug);
    return { slug, seasons: {} };
  }
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      _teamFileCache.set(slug, data);
      return data;
    }
  } catch (_) {}
  return { slug, seasons: {} };
}

/** Save/update a season into the team file */
function _saveTeamFile(slug, id, teamName, saisonId, squadData) {
  const file = path.resolve(SQUADS_DIR, `${slug}.json`);
  // Path containment: never write outside the squads directory
  if (!file.startsWith(SQUADS_DIR + path.sep) && file !== SQUADS_DIR) {
    console.warn('[squads] Blocked write path traversal for slug:', slug);
    return;
  }
  const data = _loadTeamFile(slug);
  // Only set id if provided — never overwrite an existing id with null
  if (id != null) data.id = id;
  data.slug  = slug;
  // Never overwrite existing identity/group metadata — protects national team files
  // from being contaminated by club teams that share a similar slug (e.g. "england"
  // being overwritten by "New England Revolution").
  if (!data.name) data.name = teamName;
  // group, nameEs, nameEn: preserve if already set
  data.seasons             = data.seasons || {};
  data.seasons[saisonId]   = squadData;
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); _teamFileCache.set(slug, data); }
  catch (e) { console.warn('[squads] No se pudo guardar:', e.message); }
}

// ─────────────────────────────────────────────────────────────
// National team name → TM slug mapping
// Used to route national team searches to the Nationalelf endpoint
// ─────────────────────────────────────────────────────────────
const NATIONAL_TEAM_SLUGS = new Map([
  // English names → TM slug
  ['spain','spanien'],         ['england','england'],       ['france','frankreich'],
  ['germany','deutschland'],   ['italy','italien'],         ['portugal','portugal'],
  ['netherlands','niederlande'],['belgium','belgien'],      ['croatia','kroatien'],
  ['russia','russland'],       ['ukraine','ukraine'],       ['poland','polen'],
  ['denmark','danemark'],      ['sweden','schweden'],       ['norway','norwegen'],
  ['switzerland','schweiz'],   ['austria','osterreich'],    ['scotland','schottland'],
  ['wales','wales'],           ['turkey','turkei'],         ['greece','griechenland'],
  ['serbia','serbien'],        ['romania','rumanien'],      ['hungary','ungarn'],
  ['czech republic','tschechien'], ['slovakia','slowakei'], ['slovenia','slowenien'],
  ['finland','finnland'],      ['iceland','island'],        ['republic of ireland','irland'],
  ['northern ireland','nordirland'], ['bosnia','bosnien-herzegowina'], ['albania','albanien'],
  ['argentina','argentinien'], ['brazil','brasilien'],      ['brasil','brasilien'],
  ['uruguay','uruguay'],       ['colombia','kolumbien'],    ['chile','chile'],
  ['ecuador','ecuador'],       ['peru','peru'],             ['paraguay','paraguay'],
  ['venezuela','venezuela'],   ['mexico','mexiko'],         ['usa','vereinigte-staaten'],
  ['united states','vereinigte-staaten'], ['costa rica','costa-rica'], ['canada','kanada'],
  ['senegal','senegal'],       ['cameroon','kamerun'],      ['ghana','ghana'],
  ['nigeria','nigeria'],       ['morocco','marokko'],       ['egypt','agypten'],
  ['ivory coast','elfenbeinkuste'], ['south africa','sudafrika'], ['algeria','algerien'],
  ['tunisia','tunesien'],      ['mali','mali'],
  ['japan','japan'],           ['south korea','sudkorea'],  ['australia','australien'],
  ['saudi arabia','saudi-arabien'], ['iran','iran'],
  // Spanish / alternate names
  ['españa','spanien'],        ['espana','spanien'],        ['alemania','deutschland'],
  ['francia','frankreich'],    ['italia','italien'],        ['holanda','niederlande'],
  ['países bajos','niederlande'], ['paises bajos','niederlande'], ['bélgica','belgien'],
  ['belgica','belgien'],       ['croacia','kroatien'],      ['rusia','russland'],
  ['ucrania','ukraine'],       ['polonia','polen'],         ['dinamarca','danemark'],
  ['suecia','schweden'],       ['noruega','norwegen'],      ['suiza','schweiz'],
  ['escocia','schottland'],    ['gales','wales'],           ['turquía','turkei'],
  ['turquia','turkei'],        ['grecia','griechenland'],   ['rumania','rumanien'],
  ['hungría','ungarn'],        ['hungria','ungarn'],        ['república checa','tschechien'],
  ['republica checa','tschechien'], ['eslovaquia','slowakei'], ['eslovenia','slowenien'],
  ['finlandia','finnland'],    ['islandia','island'],       ['irlanda','irland'],
  ['irlanda del norte','nordirland'],
  ['argentina','argentinien'], ['brasil','brasilien'],      ['colombia','kolumbien'],
  ['perú','peru'],             ['méxico','mexiko'],         ['estados unidos','vereinigte-staaten'],
  ['canadá','kanada'],         ['camerún','kamerun'],       ['camerun','kamerun'],
  ['marruecos','marokko'],     ['egipto','agypten'],        ['costa de marfil','elfenbeinkuste'],
  ['sudáfrica','sudafrika'],   ['sudafrica','sudafrika'],   ['argelia','algerien'],
  ['túnez','tunesien'],        ['tunez','tunesien'],
  ['japón','japan'],           ['japon','japan'],           ['corea del sur','sudkorea'],
  ['corea','sudkorea'],        ['arabia saudí','saudi-arabien'], ['arabia saudi','saudi-arabien'],
  ['irán','iran'],             ['inglaterra','england'],
]);

function isNationalTeam(teamName) {
  return NATIONAL_TEAM_SLUGS.has(teamName.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

// ── User-Agent pool — rotación anti-detección ───────────────
const _UA_POOL = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Firefox Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  // Safari macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  // Chrome macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  // Chrome Android (mobile)
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36',
  // Safari iPhone
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
];
let _uaIndex = Math.floor(Math.random() * _UA_POOL.length);
function _nextUA() {
  _uaIndex = (_uaIndex + 1) % _UA_POOL.length;
  return _UA_POOL[_uaIndex];
}

async function searchTransfermarktClub(teamName) {
  const cacheKey = teamName.toLowerCase().trim();
  if (_tmSearchCache.has(cacheKey)) return _tmSearchCache.get(cacheKey);

  const TM_HEADERS = {
    'User-Agent': _nextUA(),
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.transfermarkt.es/',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };

  // For known national team names, use the Nationalelf search endpoint instead of
  // the club (Vereinsname) endpoint — this avoids matching small clubs with country names
  const normKey = cacheKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isNational = NATIONAL_TEAM_SLUGS.has(normKey);
  const expectedSlug = NATIONAL_TEAM_SLUGS.get(normKey);

  const searchUrl = isNational
    ? `https://www.transfermarkt.es/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(teamName)}&Nationalelf_page=0`
    : `https://www.transfermarkt.es/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(teamName)}&Vereinsname=${encodeURIComponent(teamName)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: TM_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { _tmSearchCache.set(cacheKey, null); return null; }
    const html = await res.text();
    const $ = cheerio.load(html);

    let found = null;

    if (isNational) {
      // National team search: look for /verein/ or /verband/ links, filter by expected slug
      const trySlug = expectedSlug || '';
      $('a[href*="/verein/"], a[href*="/verband/"]').each((_, a) => {
        if (found) return false;
        const href = $(a).attr('href') || '';
        const mv = href.match(/^\/([^/]+)\/[^/]+\/verband\/(\d+)/);
        if (mv && (!trySlug || mv[1] === trySlug || mv[1].includes(trySlug.replace('2','')))) {
          found = { slug: mv[1], id: parseInt(mv[2], 10), type: 'verband' };
          return false;
        }
        const me = href.match(/^\/([^/]+)\/[^/]+\/verein\/(\d+)/);
        if (me && (!trySlug || me[1] === trySlug || me[1].includes(trySlug.replace('2','')))) {
          found = { slug: me[1], id: parseInt(me[2], 10), type: 'verein' };
        }
      });
      // If slug filter found nothing, take first result
      if (!found) {
        $('a[href*="/verband/"]').each((_, a) => {
          if (found) return false;
          const href = $(a).attr('href') || '';
          const m = href.match(/^\/([^/]+)\/[^/]+\/verband\/(\d+)/);
          if (m) found = { slug: m[1], id: parseInt(m[2], 10), type: 'verband' };
        });
        if (!found) {
          $('a[href*="/verein/"]').each((_, a) => {
            if (found) return false;
            const href = $(a).attr('href') || '';
            const m = href.match(/^\/([^/]+)\/[^/]+\/verein\/(\d+)/);
            if (m) found = { slug: m[1], id: parseInt(m[2], 10), type: 'verein' };
          });
        }
      }
    } else {
      // Club search: prefer /verband/ links first, fallback to /verein/
      $('a[href*="/verband/"]').each((_, a) => {
        if (found) return false;
        const href = $(a).attr('href') || '';
        const m = href.match(/^\/([^/]+)\/[^/]+\/verband\/(\d+)/);
        if (m) found = { slug: m[1], id: parseInt(m[2], 10), type: 'verband' };
      });
      if (!found) {
        $('a[href*="/verein/"]').each((_, a) => {
          if (found) return false;
          const href = $(a).attr('href') || '';
          const m = href.match(/^\/([^/]+)\/[^/]+\/verein\/(\d+)/);
          if (m) found = { slug: m[1], id: parseInt(m[2], 10), type: 'verein' };
        });
      }
    }

    if (_tmSearchCache.size >= _TM_CACHE_MAX) {
      // Evict oldest entry to keep memory bounded
      _tmSearchCache.delete(_tmSearchCache.keys().next().value);
    }
    _tmSearchCache.set(cacheKey, found);
    return found;
  } catch (_) {
    if (_tmSearchCache.size >= _TM_CACHE_MAX) {
      _tmSearchCache.delete(_tmSearchCache.keys().next().value);
    }
    _tmSearchCache.set(cacheKey, null);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Convert era string to Transfermarkt saison_id (start year)
// ─────────────────────────────────────────────────────────────
function eraToSaisonId(era) {
  if (!era) return null;
  const m = era.match(/(\d{4})/);
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────
// League-based rating estimator
// ─────────────────────────────────────────────────────────────
function ratingsFromLeague(leagueText = '', teamName = '') {
  const l = leagueText.toLowerCase();
  const t = (teamName || '').toLowerCase();
  const clamp = (v) => Math.max(60, Math.min(90, Math.round(v)));

  // Deterministic per-team variation within tier: ±6 ATK/MID/DEF, ±4 GK
  const h = [...(teamName || '').toLowerCase()].reduce((a, c) => (a * 13 + c.charCodeAt(0)) >>> 0, 7);
  const dA = ((h & 0x0F) % 13) - 6;
  const dM = (((h >> 4) & 0x0F) % 13) - 6;
  const dD = (((h >> 8) & 0x0F) % 13) - 6;
  const dG = (((h >> 12) & 0x07) % 9) - 4;

  // International competition keywords (no club league)
  const isNationalComp = /world cup|nations league|european|championship|qualifying|euro\b|copa del mundo|eliminatoria|conmebol|concacaf|afcon|caf|afc|copa america/i.test(l)
    || (l === '' && ELITE_NATIONALS.some(n => t.includes(n)));

  const tier1 = ['premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
                  'primera division', 'primera división'];
  const tier2 = ['championship', 'segunda', 'ligue 2', '2. bundesliga', 'serie b',
                  'eredivisie', 'primeira liga'];

  let base;
  if (ELITE_NATIONALS.some(n => t === n || t.startsWith(n + ' ') || t.endsWith(' ' + n))) {
    base = { attack: 84, midfield: 84, defense: 83, goalkeeping: 82 };
  } else if (isNationalComp || STRONG_NATIONALS.some(n => t.includes(n))) {
    base = { attack: 78, midfield: 78, defense: 77, goalkeeping: 76 };
  } else if (tier1.some(t2 => l.includes(t2))) {
    base = { attack: 77, midfield: 77, defense: 77, goalkeeping: 75 };
  } else if (tier2.some(t2 => l.includes(t2))) {
    base = { attack: 70, midfield: 70, defense: 70, goalkeeping: 68 };
  } else {
    base = { attack: 63, midfield: 63, defense: 63, goalkeeping: 62 };
  }

  return {
    attack:     clamp(base.attack + dA),
    midfield:   clamp(base.midfield + dM),
    defense:    clamp(base.defense + dD),
    goalkeeping:clamp(base.goalkeeping + dG),
  };
}

// ─────────────────────────────────────────────────────────────
// Main export: fetch squad from Transfermarkt
// ─────────────────────────────────────────────────────────────
async function fetchTransfermarktSquad(teamName, era) {
  // 1. Try registry first (fast, no network)
  let club = resolveClub(teamName);

  // 2. Not in registry → dynamic search on Transfermarkt
  if (!club) {
    club = await searchTransfermarktClub(teamName);
  }

  if (!club) return null;

  // ── Validation: for known national teams, reject if wrong slug was found ──
  const normKey = teamName.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const expectedSlug = NATIONAL_TEAM_SLUGS.get(normKey);
  if (expectedSlug && club.slug !== expectedSlug) {
    // Dynamic search returned a club with the wrong slug (e.g. a Serbian club
    // named "Costa Rica" instead of the Costa Rican FA). Discard it.
    console.warn(`[TM] ⚠️  Slug incorrecto para "${teamName}": esperado "${expectedSlug}", encontrado "${club.slug}" — descartando`);
    return null;
  }

  const saisonId = eraToSaisonId(era);
  if (!saisonId) return null;

  // 3. Check per-team file cache before hitting Transfermarkt
  const teamFile = _loadTeamFile(club.slug);
  if (teamFile.seasons && teamFile.seasons[saisonId]) {
    return teamFile.seasons[saisonId];
  }

  // National teams fetched via dynamic search come back with type:'verband'
  const urlType = club.type || 'verein';
  const url = `https://www.transfermarkt.es/${club.slug}/kader/${urlType}/${club.id}/saison_id/${saisonId}`;

  let html;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': _nextUA(),
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    html = await res.text();
    if (html.length < 5000) return null;
  } catch (_) {
    return null;
  }

  const $ = cheerio.load(html);
  const $table = $('table.items');
  if (!$table.length) return null;

  // ── Cross-validate: canonical URL must contain the expected slug or the team ID ──────────────────
  // TM occasionally renames slugs (e.g. atletico-de-madrid → atletico-madrid) but the ID stays stable.
  // We only discard if the slug clearly belongs to a DIFFERENT team (different root word).
  const canonicalHref = $('link[rel="canonical"]').attr('href') || '';
  const slugInPage = (canonicalHref.match(/transfermarkt\.\w+\/([^/]+)\/kader/) || [])[1] || '';
  if (slugInPage && slugInPage !== club.slug) {
    // Accept if slug is a close variant (same first token, TM renaming)
    const rootA = club.slug.split('-')[0];
    const rootB = slugInPage.split('-')[0];
    if (rootA !== rootB) {
      console.warn(`[TM] ⚠️  Página recibida para "${slugInPage}" pero esperábamos "${club.slug}" — descartando (raíces distintas)`);
      return null;
    }
    // Same root word → TM renamed the club URL; update our running reference silently
    console.info(`[TM] ℹ️  Slug renombrado: "${club.slug}" → "${slugInPage}" (ID ${club.id}) — aceptando`);
  }

  // Get league/competition name for ratings
  const leagueText = $('a.hauptlink[href*="wettbewerb"]').first().text().trim()
    || $('div.spielername-profil a.hauptlink').first().text().trim()
    || '';

  const rawPlayers = [];
  $table.find('tr.odd, tr.even').each((_, row) => {
    const $row = $(row);

    // Position from title attribute of jersey-number cell
    const posTitle = $row.find('td.zentriert').first().attr('title') || '';
    const position = mapTmPos(posTitle);
    if (!position) return;

    // Name: club pages use td.posrela > td.hauptlink > a
    //       national team pages use td.hauptlink directly (no posrela wrapper)
    const posrelaLink = $row.find('td.posrela td.hauptlink a').first().text().trim()
      || $row.find('td.posrela .hauptlink').first().text().trim();
    const directLink = !posrelaLink
      ? ($row.find('td.hauptlink a').first().text().trim()
         || $row.find('td.hauptlink').first().text().trim())
      : '';
    const name = posrelaLink || directLink;
    if (!name) return;

    // Market value — parse TM.es formats:
    //   "350 mil €"  → €350 000
    //   "1,50 mill. €" or "1,50 M €" → €1 500 000
    const mvRaw = $row.find('td.rechts.hauptlink').text().trim()
               || $row.find('td.rechts').last().text().trim();
    let marketValue = 0;
    if (mvRaw) {
      const mvClean = mvRaw.replace(/[€$\s]/g, '').replace(',', '.');
      const num = parseFloat(mvClean);
      if (!isNaN(num)) {
        if (/mill/i.test(mvRaw))           marketValue = num * 1_000_000; // "mill." = millones
        else if (/\bM\b/.test(mvRaw))      marketValue = num * 1_000_000; // "M" solamente
        else if (/mil/i.test(mvRaw))       marketValue = num * 1_000;     // "mil" = miles
        else                               marketValue = num;
      }
    }

    rawPlayers.push({ name, position, marketValue });
  });

  if (rawPlayers.length < 14) return null; // un plantel real tiene mínimo 14

  // Apply PLAYER_RATINGS overrides first (covers all famous players regardless of era),
  // then mvToRating as fallback — so Ronaldo is always 99 even if TM shows €12M today.
  const { playerRating: _pr } = require('./player_ratings');

  for (const p of rawPlayers) {
    p.rating = _pr(p.name, p.marketValue);
  }

  // Sort within each position group by rating descending (best player picked first for XI)
  rawPlayers.sort((a, b) => {
    if (a.position !== b.position) return 0;
    return (b.rating || 0) - (a.rating || 0);
  });

  // Build a representative XI just to derive formation string just to derive formation string
  const xi = buildXI(rawPlayers);
  const fwdCount = xi.filter(p => ['ST','RW','LW'].includes(p.position)).length;
  const midFull  = xi.filter(p => ['CM','DM','AM','RM','LM'].includes(p.position)).length;
  const defFull  = xi.filter(p => ['CB','RB','LB'].includes(p.position)).length;
  const formation = `${defFull}-${midFull}-${fwdCount}`;

  const result = {
    formation,
    players:   rawPlayers,  // full squad — engine picks best 11 per formation
    ratings:   ratingsFromLeague(leagueText, teamName),
    source:    `Transfermarkt — ${teamName} (${saisonId}/${parseInt(saisonId)+1})`,
    teamLabel: `${teamName} (${saisonId}-${String(parseInt(saisonId)+1).slice(-2)})`,
  };

  // Save to per-team file so future requests don't need to hit Transfermarkt
  _saveTeamFile(club.slug, club.id, teamName, saisonId, result);

  return result;
}

// ─────────────────────────────────────────────────────────────
// Local badge cache
//   Download team badge images to public/img/badges/{slug}.{ext}
//   so the frontend always uses self-hosted paths (CSP: img-src 'self').
// ─────────────────────────────────────────────────────────────
const BADGES_DIR = path.join(__dirname, 'public', 'img', 'badges');
if (!fs.existsSync(BADGES_DIR)) fs.mkdirSync(BADGES_DIR, { recursive: true });

/** Trusted badge image hosts — SSRF protection: only download from these */
const _SAFE_BADGE_HOSTS = new Set(['www.thesportsdb.com', 'thesportsdb.com', 'r2.thesportsdb.com']);
const _BADGE_MAX_BYTES  = 512 * 1024;  // 500 KB cap

/**
 * Download a badge image from a trusted TheSportsDB URL and save it locally.
 * Returns the public path "/img/badges/{slug}.{ext}", or null on failure.
 * Safe to call even if the file already exists (returns cached path immediately).
 */
async function saveBadgeLocally(badgeUrl, slug) {
  if (!badgeUrl || !slug) return null;
  if (!/^[a-z0-9][a-z0-9\-]{0,79}$/.test(slug)) return null;
  let parsedUrl;
  try { parsedUrl = new URL(badgeUrl); } catch (_) { return null; }
  if (!_SAFE_BADGE_HOSTS.has(parsedUrl.hostname)) return null;
  if (parsedUrl.protocol !== 'https:') return null;
  const extMatch = parsedUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
  const localFile = path.join(BADGES_DIR, `${slug}.${ext}`);
  if (!localFile.startsWith(BADGES_DIR + path.sep)) return null;
  if (fs.existsSync(localFile)) return `/img/badges/${slug}.${ext}`;
  try {
    // redirect:'manual' prevents SSRF via open redirects — we only allow requests
    // that stay on the original allowlisted host without following redirects.
    const res = await fetch(badgeUrl, {
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    });
    // Allow direct 200 only — reject any redirect (3xx)
    if (!res.ok || res.status !== 200) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!ct.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > _BADGE_MAX_BYTES) return null;
    fs.writeFileSync(localFile, Buffer.from(buf));
    return `/img/badges/${slug}.${ext}`;
  } catch (_) { return null; }
}

/**
 * Scan the badges directory for any file matching this slug.
 * Returns the public path or null (no network call).
 */
function getLocalBadgePath(slug) {
  if (!slug || !/^[a-z0-9][a-z0-9\-]{0,79}$/.test(slug)) return null;
  for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']) {
    const f = path.join(BADGES_DIR, `${slug}.${ext}`);
    if (fs.existsSync(f)) return `/img/badges/${slug}.${ext}`;
  }
  return null;
}

/**
 * Persist the local badge path at the TOP LEVEL of the team file.
 * { slug, name, badgeLocalPath: '/img/badges/slug.png', seasons: { ... } }
 */
function saveBadgePathToFile(slug, localPath) {
  if (!slug || !localPath) return;
  if (!/^[a-z0-9][a-z0-9\-]{0,79}$/.test(slug)) return;
  const file = path.resolve(SQUADS_DIR, `${slug}.json`);
  if (!file.startsWith(SQUADS_DIR + path.sep)) return;
  const data = _loadTeamFile(slug);
  if (data.badgeLocalPath === localPath) return;  // no-op if already saved
  data.badgeLocalPath = localPath;
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    _teamFileCache.set(slug, data);
  } catch (_) { /* non-critical */ }
}

module.exports = {
  fetchTransfermarktSquad, resolveClub, _loadTeamFile, _saveTeamFile,
  saveBadgeLocally, saveBadgePathToFile, getLocalBadgePath,
};
