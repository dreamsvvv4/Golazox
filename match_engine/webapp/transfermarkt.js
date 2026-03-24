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
};

function mapTmPos(raw) {
  if (!raw) return null;
  const p = raw.toLowerCase().trim();
  if (TM_POS[p]) return TM_POS[p];
  if (p.includes('portero') || p.includes('goalkeeper')) return 'GK';
  if (p.includes('lateral derecho') || p.includes('right back')) return 'RB';
  if (p.includes('lateral izquierdo') || p.includes('left back')) return 'LB';
  if (p.includes('central') || p.includes('centre-back') || p.includes('defens')) return 'CB';
  if (p.includes('pivote') || p.includes('defensivo') || p.includes('defensive mid')) return 'DM';
  if (p.includes('extremo derecho') || p.includes('right wing')) return 'RW';
  if (p.includes('extremo izquierdo') || p.includes('left wing')) return 'LW';
  if (p.includes('mediapunta') || p.includes('ofensivo') || p.includes('attacking')) return 'AM';
  if (p.includes('centrocampista') || p.includes('midfield') || p.includes('medio')) return 'CM';
  if (p.includes('delantero') || p.includes('forward') || p.includes('striker')) return 'ST';
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
  'atletico madrid':           { id: 13,    slug: 'atletico-de-madrid' },
  'atlético madrid':           { id: 13,    slug: 'atletico-de-madrid' },
  'atletico de madrid':        { id: 13,    slug: 'atletico-de-madrid' },
  'atlético de madrid':        { id: 13,    slug: 'atletico-de-madrid' },
  'atleti':                    { id: 13,    slug: 'atletico-de-madrid' },
  'sevilla':                   { id: 368,   slug: 'fc-sevilla' },
  'sevilla fc':                { id: 368,   slug: 'fc-sevilla' },
  'valencia':                  { id: 1049,  slug: 'fc-valencia' },
  'valencia cf':               { id: 1049,  slug: 'fc-valencia' },
  'villarreal':                { id: 1050,  slug: 'villarreal-cf' },
  'villarreal cf':             { id: 1050,  slug: 'villarreal-cf' },
  'athletic bilbao':           { id: 621,   slug: 'athletic-club' },
  'athletic club':             { id: 621,   slug: 'athletic-club' },
  'athletic':                  { id: 621,   slug: 'athletic-club' },
  'real sociedad':             { id: 681,   slug: 'real-sociedad-san-sebastian' },
  'betis':                     { id: 150,   slug: 'real-betis-balompie' },
  'real betis':                { id: 150,   slug: 'real-betis-balompie' },
  'celta vigo':                { id: 940,   slug: 'rc-celta-vigo' },
  'celta de vigo':             { id: 940,   slug: 'rc-celta-vigo' },
  'celta':                     { id: 940,   slug: 'rc-celta-vigo' },
  'osasuna':                   { id: 331,   slug: 'ca-osasuna' },
  'ca osasuna':                { id: 331,   slug: 'ca-osasuna' },
  'deportivo':                 { id: 716,   slug: 'rc-deportivo' },
  'deportivo la coruña':       { id: 716,   slug: 'rc-deportivo' },
  'deportivo de la coruña':    { id: 716,   slug: 'rc-deportivo' },
  'espanyol':                  { id: 714,   slug: 'rcd-espanyol-barcelona' },
  'rcd espanyol':              { id: 714,   slug: 'rcd-espanyol-barcelona' },
  'girona':                    { id: 12321, slug: 'girona-fc' },
  'girona fc':                 { id: 12321, slug: 'girona-fc' },
  'malaga':                    { id: 2517,  slug: 'malaga-cf' },
  'málaga':                    { id: 2517,  slug: 'malaga-cf' },
  'málaga cf':                 { id: 2517,  slug: 'malaga-cf' },
  'rayo vallecano':            { id: 1373,  slug: 'rayo-vallecano-de-madrid' },
  'rayo':                      { id: 1373,  slug: 'rayo-vallecano-de-madrid' },
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
  'zaragoza':                  { id: 1051,  slug: 'real-zaragoza' },
  'real zaragoza':             { id: 1051,  slug: 'real-zaragoza' },
  'cadiz':                     { id: 2055,  slug: 'cadiz-cf' },
  'cádiz':                     { id: 2055,  slug: 'cadiz-cf' },
  'mallorca':                  { id: 237,   slug: 'real-club-deportivo-mallorca' },
  'real mallorca':             { id: 237,   slug: 'real-club-deportivo-mallorca' },
  'eibar':                     { id: 1242,  slug: 'sd-eibar' },
  'sd eibar':                  { id: 1242,  slug: 'sd-eibar' },
  'alavés':                    { id: 1244,  slug: 'deportivo-alaves' },
  'alaves':                    { id: 1244,  slug: 'deportivo-alaves' },
  'huesca':                    { id: 4613,  slug: 'sd-huesca' },
  'sd huesca':                 { id: 4613,  slug: 'sd-huesca' },
  'elche':                     { id: 1045,  slug: 'elche-cf' },
  'elche cf':                  { id: 1045,  slug: 'elche-cf' },
  'leganes':                   { id: 13983, slug: 'cd-leganes' },
  'leganés':                   { id: 13983, slug: 'cd-leganes' },
  'cd leganés':                { id: 13983, slug: 'cd-leganes' },
  'getafe':                    { id: 3709,  slug: 'getafe-cf' },
  'getafe cf':                 { id: 3709,  slug: 'getafe-cf' },
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
  'burgos cf':                 { id: 78462, slug: 'burgos-cf' },
  'burgos':                    { id: 78462, slug: 'burgos-cf' },
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
  'freiburg':                  { id: 17,    slug: 'sport-club-freiburg' },
  // ── Serie A ─────────────────────────────────────────────────
  'juventus':                  { id: 506,   slug: 'juventus-fc' },
  'juve':                      { id: 506,   slug: 'juventus-fc' },
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
  'napoli':                    { id: 6195,  slug: 'ssc-napoli' },
  'ssc napoli':                { id: 6195,  slug: 'ssc-napoli' },
  'lazio':                     { id: 398,   slug: 'ss-lazio' },
  'ss lazio':                  { id: 398,   slug: 'ss-lazio' },
  'atalanta':                  { id: 800,   slug: 'atalanta-bc' },
  'fiorentina':                { id: 430,   slug: 'acf-fiorentina' },
  'torino':                    { id: 416,   slug: 'torino-fc' },
  // ── Ligue 1 ─────────────────────────────────────────────────
  'paris saint-germain':       { id: 583,   slug: 'paris-saint-germain' },
  'psg':                       { id: 583,   slug: 'paris-saint-germain' },
  'paris saint germain':       { id: 583,   slug: 'paris-saint-germain' },
  'marseille':                 { id: 244,   slug: 'olympique-de-marseille' },
  'olympique marseille':       { id: 244,   slug: 'olympique-de-marseille' },
  'lyon':                      { id: 1041,  slug: 'olympique-lyonnais' },
  'olympique lyonnais':        { id: 1041,  slug: 'olympique-lyonnais' },
  'monaco':                    { id: 162,   slug: 'as-monaco' },
  'as monaco':                 { id: 162,   slug: 'as-monaco' },
  // ── Dutch / Portuguese / Belgian ────────────────────────────
  'ajax':                      { id: 610,   slug: 'afc-ajax' },
  'afc ajax':                  { id: 610,   slug: 'afc-ajax' },
  'psv':                       { id: 383,   slug: 'psv-eindhoven' },
  'psv eindhoven':             { id: 383,   slug: 'psv-eindhoven' },
  'feyenoord':                 { id: 234,   slug: 'feyenoord-rotterdam' },
  'porto':                     { id: 720,   slug: 'fc-porto' },
  'fc porto':                  { id: 720,   slug: 'fc-porto' },
  'benfica':                   { id: 294,   slug: 'sl-benfica' },
  'sl benfica':                { id: 294,   slug: 'sl-benfica' },
  'sporting cp':               { id: 336,   slug: 'sporting-cp' },
  'celtic':                    { id: 371,   slug: 'celtic-glasgow' },
  'anderlecht':                { id: 28,    slug: 'rsc-anderlecht' },
  'club brugge':               { id: 2282,  slug: 'fc-brugge' },

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

  // Partial/fuzzy match
  let best = null, bestLen = 0;
  for (const [k, info] of Object.entries(TM_CLUBS)) {
    const normK = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if ((key.includes(normK) || normK.includes(key)) && normK.length > bestLen) {
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

/** Read a team file; returns { slug, seasons:{} } if missing */
function _loadTeamFile(slug) {
  const file = path.join(SQUADS_DIR, `${slug}.json`);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return { slug, seasons: {} };
}

/** Save/update a season into the team file */
function _saveTeamFile(slug, id, teamName, saisonId, squadData) {
  const file = path.join(SQUADS_DIR, `${slug}.json`);
  const data = _loadTeamFile(slug);
  // Only set id if provided — never overwrite an existing id with null
  if (id != null) data.id = id;
  data.slug  = slug;
  if (!data.name) data.name = teamName;
  data.seasons             = data.seasons || {};
  data.seasons[saisonId]   = squadData;
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
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

async function searchTransfermarktClub(teamName) {
  const cacheKey = teamName.toLowerCase().trim();
  if (_tmSearchCache.has(cacheKey)) return _tmSearchCache.get(cacheKey);

  const TM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.transfermarkt.es/',
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
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

  // ── Cross-validate: canonical URL must contain the expected slug ──────────
  const canonicalHref = $('link[rel="canonical"]').attr('href') || '';
  const slugInPage = (canonicalHref.match(/transfermarkt\.\w+\/([^/]+)\/kader/) || [])[1] || '';
  if (slugInPage && slugInPage !== club.slug) {
    console.warn(`[TM] ⚠️  Página recibida para "${slugInPage}" pero esperábamos "${club.slug}" — descartando`);
    return null;
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

    rawPlayers.push({ name, position });
  });

  if (rawPlayers.length < 14) return null; // un plantel real tiene mínimo 14

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

module.exports = { fetchTransfermarktSquad, resolveClub, _loadTeamFile, _saveTeamFile };
