/**
 * Football Match Simulator — Express Backend
 * ─────────────────────────────────────────────
 * Start:  node server.js
 * API:    POST /simulate
 */

const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const compress   = require('compression');
const nodemailer = require('nodemailer');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const slowDown                         = require('express-slow-down');
const { simulateMatch, buildLineupFromCache, deriveRatings } = require('./engine');
const { describeTimeline }                      = require('./narrator');
const { lookupTeam, fetchTeamBadge } = require('./lookup');
const { SQUADS }        = require('./squads');
const { REFEREES }      = require('./referee_logic');

const app    = express();
app.set('trust proxy', 1); // Correct req.ip behind nginx/Cloudflare
app.disable('x-powered-by');  // Don't expose server fingerprint
const PORT = process.env.PORT || 3000;

// Auto-create logs/ dir (used by PM2 ecosystem config)
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Pre-build autocomplete list from local squad DB (capitalised, sorted)
const SQUAD_SUGGESTIONS = [...new Set(
  Object.keys(SQUADS).map(k => k.replace(/\b\w/g, c => c.toUpperCase()))
)].sort();

// Badge map: lowercased name → local path (built from squads/ at startup)
// Falls back to placeholder when nothing is found.
const BADGE_PLACEHOLDER = '/img/badges/_placeholder.svg';
const _squadFiles = fs.readdirSync(path.join(__dirname, 'squads'))
  .filter(f => f.endsWith('.json') && !f.startsWith('.'));
const _badgeMap = new Map();  // name.lc → localPath
const _allTeams = [];         // { name, badge, slug } — full list for /badges
for (const file of _squadFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', file), 'utf8'));
    const name  = d.name || file.replace('.json', '');
    const badge = d.badgeLocalPath || BADGE_PLACEHOLDER;
    _badgeMap.set(name.toLowerCase(), badge);
    _allTeams.push({ name, badge, slug: d.slug || file.replace('.json', '') });
  } catch(_) {}
}
_allTeams.sort((a, b) => a.name.localeCompare(b.name));

// ── League/group mapping: slug → display group ───────────────
// Order determines display order in the UI.
const _GROUP_ORDER = [
  '⭐ Fantasy XI',
  '🌐 Continentes Históricos',
  '🌍 Selecciones',
  '🇪🇸 La Liga', '🇪🇸 La Liga 2',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  '🇩🇪 Bundesliga', '🇩🇪 2. Bundesliga',
  '🇮🇹 Serie A', '🇮🇹 Serie B',
  '🇫🇷 Ligue 1', '🇫🇷 Ligue 2',
  '🇳🇱 Eredivisie', '🇵🇹 Liga Portugal',
  '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia',
  '🇸🇦 Saudi Pro League', '🇺🇸 MLS', '🌎 América del Sur', '🌍 Otros',
];
const _SLUG_GROUP = {
  // Selecciones nacionales — slugs alemán, inglés y español
  // Alemán (squads originales)
  argentinien:'🌍 Selecciones', belgien:'🌍 Selecciones', brasilien:'🌍 Selecciones',
  bulgarien:'🌍 Selecciones', danemark:'🌍 Selecciones',
  deutschland:'🌍 Selecciones', frankreich:'🌍 Selecciones',
  griechenland:'🌍 Selecciones', italien:'🌍 Selecciones',
  kroatien:'🌍 Selecciones', marokko:'🌍 Selecciones', niederlande:'🌍 Selecciones',
  norwegen:'🌍 Selecciones', osterreich:'🌍 Selecciones', polen:'🌍 Selecciones',
  russland:'🌍 Selecciones', schottland:'🌍 Selecciones',
  schweden:'🌍 Selecciones', schweiz:'🌍 Selecciones',
  irak:'🌍 Selecciones', jordanien:'🌍 Selecciones', kongo:'🌍 Selecciones',
  spanien:'🌍 Selecciones', tschechien:'🌍 Selecciones', 'vereinigte-staaten':'🌍 Selecciones',
  // Alemán WC2026 (nuevas descargas de Transfermarkt)
  albanien:'🌍 Selecciones', algerien:'🌍 Selecciones', australien:'🌍 Selecciones',
  'bosnien-herzegowina':'🌍 Selecciones', kamerun:'🌍 Selecciones', kanada:'🌍 Selecciones',
  'kap-verde':'🌍 Selecciones', kolumbien:'🌍 Selecciones', agypten:'🌍 Selecciones',
  finnland:'🌍 Selecciones', ungarn:'🌍 Selecciones', island:'🌍 Selecciones',
  elfenbeinkuste:'🌍 Selecciones', jamaika:'🌍 Selecciones', mexiko:'🌍 Selecciones',
  neuseeland:'🌍 Selecciones', nordkorea:'🌍 Selecciones', nordirland:'🌍 Selecciones',
  'saudi-arabien':'🌍 Selecciones', serbien:'🌍 Selecciones',
  slowakei:'🌍 Selecciones', slowenien:'🌍 Selecciones',
  sudafrika:'🌍 Selecciones', sudkorea:'🌍 Selecciones',
  'trinidad-und-tobago':'🌍 Selecciones', tunesien:'🌍 Selecciones',
  turkei:'🌍 Selecciones', usbekistan:'🌍 Selecciones',
  // Español
  marruecos:'🌍 Selecciones', noruega:'🌍 Selecciones', rusia:'🌍 Selecciones',
  japon:'🌍 Selecciones', corea:'🌍 Selecciones', holanda:'🌍 Selecciones',
  // Inglés (WC2026 + nuevas descargas)
  albania:'🌍 Selecciones', algeria:'🌍 Selecciones', argentina:'🌍 Selecciones',
  australia:'🌍 Selecciones', austria:'🌍 Selecciones', bahrain:'🌍 Selecciones',
  belgium:'🌍 Selecciones', bolivia:'🌍 Selecciones', bosnia:'🌍 Selecciones',
  brazil:'🌍 Selecciones', bulgaria:'🌍 Selecciones', cameroon:'🌍 Selecciones',
  canada:'🌍 Selecciones', 'cape-verde':'🌍 Selecciones', chile:'🌍 Selecciones',
  china:'🌍 Selecciones', colombia:'🌍 Selecciones', 'costa-rica':'🌍 Selecciones',
  croatia:'🌍 Selecciones', 'czech-republic':'🌍 Selecciones', denmark:'🌍 Selecciones',
  'democratic-republic-of-congo':'🌍 Selecciones',
  ecuador:'🌍 Selecciones', egypt:'🌍 Selecciones', england:'🌍 Selecciones',
  finland:'🌍 Selecciones', france:'🌍 Selecciones', germany:'🌍 Selecciones',
  ghana:'🌍 Selecciones', greece:'🌍 Selecciones', haiti:'🌍 Selecciones', honduras:'🌍 Selecciones',
  hungary:'🌍 Selecciones', iceland:'🌍 Selecciones', iran:'🌍 Selecciones',
  iraq:'🌍 Selecciones', ireland:'🌍 Selecciones', 'ivory-coast':'🌍 Selecciones',
  japan:'🌍 Selecciones', jordan:'🌍 Selecciones', mali:'🌍 Selecciones',
  mexico:'🌍 Selecciones', morocco:'🌍 Selecciones', netherlands:'🌍 Selecciones',
  'new-zealand':'🌍 Selecciones', nigeria:'🌍 Selecciones', norway:'🌍 Selecciones',
  'north-korea':'🌍 Selecciones', oman:'🌍 Selecciones',
  panama:'🌍 Selecciones', paraguay:'🌍 Selecciones', peru:'🌍 Selecciones',
  poland:'🌍 Selecciones', portugal:'🌍 Selecciones', 'republic-of-ireland':'🌍 Selecciones',
  romania:'🌍 Selecciones', russia:'🌍 Selecciones', 'saudi-arabia':'🌍 Selecciones',
  scotland:'🌍 Selecciones', senegal:'🌍 Selecciones', serbia:'🌍 Selecciones',
  slovakia:'🌍 Selecciones', slovenia:'🌍 Selecciones', 'south-africa':'🌍 Selecciones',
  'south-korea':'🌍 Selecciones', spain:'🌍 Selecciones', sweden:'🌍 Selecciones',
  switzerland:'🌍 Selecciones', 'trinidad-and-tobago':'🌍 Selecciones',
  tunisia:'🌍 Selecciones', turkey:'🌍 Selecciones', ukraine:'🌍 Selecciones',
  'united-states':'🌍 Selecciones', uruguay:'🌍 Selecciones',
  uzbekistan:'🌍 Selecciones', venezuela:'🌍 Selecciones', wales:'🌍 Selecciones',
  // ★ Fantasy XI
  'best-xi-history':'⭐ Fantasy XI', 'best-xi-2025':'⭐ Fantasy XI',
  'europa-xi':'⭐ Fantasy XI', 'america-xi':'⭐ Fantasy XI',
  'resto-mundo':'⭐ Fantasy XI',
  // ★ Continentes Históricos
  'europa-historica':'🌐 Continentes Históricos', 'america-historica':'🌐 Continentes Históricos',
  'africa-historica':'🌐 Continentes Históricos', 'asia-oceania-historica':'🌐 Continentes Históricos',
  // ── La Liga (Primera División) ──────────────────────────────────────────
  'athletic-club':'🇪🇸 La Liga', 'atletico-madrid':'🇪🇸 La Liga',
  'ca-osasuna':'🇪🇸 La Liga', 'celta-vigo':'🇪🇸 La Liga', 'rc-celta-vigo':'🇪🇸 La Liga',
  'deportivo-alaves':'🇪🇸 La Liga', 'elche-cf':'🇪🇸 La Liga',
  'espanyol-barcelona':'🇪🇸 La Liga', 'rcd-espanyol-barcelona':'🇪🇸 La Liga',
  'fc-barcelona':'🇪🇸 La Liga',
  'fc-girona':'🇪🇸 La Liga', 'girona-fc':'🇪🇸 La Liga',
  'fc-sevilla':'🇪🇸 La Liga', 'fc-valencia':'🇪🇸 La Liga',
  'fc-villarreal':'🇪🇸 La Liga', 'villarreal-cf':'🇪🇸 La Liga',
  'getafe-cf':'🇪🇸 La Liga', 'rayo-vallecano-de-madrid':'🇪🇸 La Liga',
  'levante-ud':'🇪🇸 La Liga',
  'rcd-mallorca':'🇪🇸 La Liga', 'real-club-deportivo-mallorca':'🇪🇸 La Liga', 'real-betis-balompie':'🇪🇸 La Liga',
  'real-madrid':'🇪🇸 La Liga', 'real-oviedo':'🇪🇸 La Liga',
  'real-sociedad-san-sebastian':'🇪🇸 La Liga',
  // ── La Liga 2 (Segunda División) ─────────────────────────────────────────
  albacete:'🇪🇸 La Liga 2', 'ud-almeria':'🇪🇸 La Liga 2',
  'burgos-cf':'🇪🇸 La Liga 2', castellon:'🇪🇸 La Liga 2',
  ceuta:'🇪🇸 La Liga 2', 'cultural-leonesa':'🇪🇸 La Liga 2',
  'cadiz-cf':'🇪🇸 La Liga 2', 'cd-mirandes':'🇪🇸 La Liga 2',
  cordoba:'🇪🇸 La Liga 2', 'rc-deportivo':'🇪🇸 La Liga 2',
  'sd-eibar':'🇪🇸 La Liga 2', 'fc-andorra':'🇪🇸 La Liga 2',
  'granada-cf':'🇪🇸 La Liga 2', 'sd-huesca':'🇪🇸 La Liga 2',
  'ud-las-palmas':'🇪🇸 La Liga 2', 'cd-leganes':'🇪🇸 La Liga 2',
  malaga:'🇪🇸 La Liga 2', 'real-racing-club':'🇪🇸 La Liga 2',
  'real-sociedad-ii':'🇪🇸 La Liga 2', 'real-valladolid':'🇪🇸 La Liga 2',
  'real-zaragoza':'🇪🇸 La Liga 2', 'sporting-gijon':'🇪🇸 La Liga 2',
  // ── Otros (ex-Liga 2 equipos fuera de categoría) ──────────────────────────
  'ad-alcorcon':'🌍 Otros', caceres:'🌍 Otros', 'cardiff-city':'🌍 Otros',
  'cd-mostoles-urjc':'🌍 Otros', 'cd-tenerife':'🌍 Otros',
  cosenza:'🌍 Otros', 'cosenza-calcio':'🌍 Otros',
  extremadura:'🌍 Otros', 'fc-cartagena':'🌍 Otros',
  'luton-town':'🌍 Otros', numancia:'🌍 Otros',
  'plymouth-argyle':'🌍 Otros', salernitana:'🌍 Otros',
  // ── Premier League ────────────────────────────────────────────────────────
  'afc-bournemouth':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'aston-villa':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'brighton-hove-albion':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'crystal-palace':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'fc-arsenal':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'fc-brentford':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'brentford-fc':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'fc-burnley':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'fc-chelsea':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'fc-everton':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'fc-fulham':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'fc-liverpool':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'leeds-united':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'manchester-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'manchester-united':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'newcastle-united':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'nottingham-forest':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  sunderland:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'tottenham-hotspur':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', 'west-ham-united':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'wolverhampton-wanderers':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  // ── Championship (Segunda División inglesa) ───────────────────────────────
  'birmingham-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'blackburn-rovers':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'bristol-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'charlton-athletic':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'coventry-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'derby-county':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'hull-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'ipswich-town':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'leicester-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', middlesbrough:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  millwall:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'norwich-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'oxford-united':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'portsmouth-fc':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'preston-north-end':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'queens-park-rangers':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'sheffield-united':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'sheffield-wednesday':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'southampton-fc':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'stoke-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'swansea-city':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'watford-fc':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  'west-bromwich-albion':'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', wrexham:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
  // ── Bundesliga ────────────────────────────────────────────────────────────
  '1-fc-union-berlin':'🇩🇪 Bundesliga', 'fc-union-berlin':'🇩🇪 Bundesliga',
  '1-fsv-mainz-05':'🇩🇪 Bundesliga', 'mainz-05':'🇩🇪 Bundesliga',
  'bayer-04-leverkusen':'🇩🇪 Bundesliga',
  'borussia-dortmund':'🇩🇪 Bundesliga', 'borussia-monchengladbach':'🇩🇪 Bundesliga',
  'eintracht-frankfurt':'🇩🇪 Bundesliga',
  'fc-augsburg':'🇩🇪 Bundesliga', 'fc-bayern-munchen':'🇩🇪 Bundesliga',
  '1-fc-koln':'🇩🇪 Bundesliga', 'fc-koln':'🇩🇪 Bundesliga',
  freiburg:'🇩🇪 Bundesliga', 'sport-club-freiburg':'🇩🇪 Bundesliga',
  'hamburger-sv':'🇩🇪 Bundesliga',
  heidenheim:'🇩🇪 Bundesliga', 'st-pauli':'🇩🇪 Bundesliga',
  'rasenballsport-leipzig':'🇩🇪 Bundesliga',
  'sv-werder-bremen':'🇩🇪 Bundesliga', 'werder-bremen':'🇩🇪 Bundesliga',
  'tsg-1899-hoffenheim':'🇩🇪 Bundesliga', 'vfl-wolfsburg':'🇩🇪 Bundesliga',
  'vfb-stuttgart':'🇩🇪 Bundesliga',
  // ── 2. Bundesliga ─────────────────────────────────────────────────────────
  'arminia-bielefeld':'🇩🇪 2. Bundesliga',
  darmstadt:'🇩🇪 2. Bundesliga', 'sv-darmstadt-98':'🇩🇪 2. Bundesliga',
  'dynamo-dresden':'🇩🇪 2. Bundesliga', 'eintracht-braunschweig':'🇩🇪 2. Bundesliga',
  'fc-schalke-04':'🇩🇪 2. Bundesliga', 'fortuna-dusseldorf':'🇩🇪 2. Bundesliga',
  'greuther-furth':'🇩🇪 2. Bundesliga', 'hannover-96':'🇩🇪 2. Bundesliga',
  'hertha-bsc':'🇩🇪 2. Bundesliga', 'holstein-kiel':'🇩🇪 2. Bundesliga',
  kaiserslautern:'🇩🇪 2. Bundesliga', 'karlsruher-sc':'🇩🇪 2. Bundesliga',
  '1-fc-magdeburg':'🇩🇪 2. Bundesliga', '1-fc-nurnberg':'🇩🇪 2. Bundesliga',
  'sc-paderborn-07':'🇩🇪 2. Bundesliga', 'preussen-munster':'🇩🇪 2. Bundesliga',
  'sv-elversberg':'🇩🇪 2. Bundesliga', 'vfl-bochum':'🇩🇪 2. Bundesliga',
  'fc-stade-payerne':'🌍 Otros',
  // ── Serie A ───────────────────────────────────────────────────────────────
  'ac-florenz':'🇮🇹 Serie A', 'acf-fiorentina':'🇮🇹 Serie A',
  'ac-mailand':'🇮🇹 Serie A',
  'as-rom':'🇮🇹 Serie A', 'atalanta-bc':'🇮🇹 Serie A',
  bologna:'🇮🇹 Serie A', 'fc-bologna-1909':'🇮🇹 Serie A',
  cagliari:'🇮🇹 Serie A', 'cfc-genua':'🇮🇹 Serie A',
  'como-1907':'🇮🇹 Serie A', cremonese:'🇮🇹 Serie A',
  'fc-turin':'🇮🇹 Serie A', 'torino-fc':'🇮🇹 Serie A',
  'hellas-verona':'🇮🇹 Serie A', 'inter-mailand':'🇮🇹 Serie A',
  'juventus-turin':'🇮🇹 Serie A', 'lazio-rom':'🇮🇹 Serie A', 'ss-lazio':'🇮🇹 Serie A',
  parma:'🇮🇹 Serie A', pisa:'🇮🇹 Serie A',
  sassuolo:'🇮🇹 Serie A', 'ssc-neapel':'🇮🇹 Serie A',
  'udinese-calcio':'🇮🇹 Serie A', 'us-lecce':'🇮🇹 Serie A',
  // ── Serie B ───────────────────────────────────────────────────────────────
  'ac-monza':'🇮🇹 Serie B', avellino:'🇮🇹 Serie B',
  bari:'🇮🇹 Serie B', carrarese:'🇮🇹 Serie B',
  catanzaro:'🇮🇹 Serie B', 'us-catanzaro':'🇮🇹 Serie B',
  cesena:'🇮🇹 Serie B', 'fc-empoli':'🇮🇹 Serie B',
  frosinone:'🇮🇹 Serie B', 'juve-stabia':'🇮🇹 Serie B',
  mantova:'🇮🇹 Serie B', modena:'🇮🇹 Serie B',
  padova:'🇮🇹 Serie B', palermo:'🇮🇹 Serie B',
  pescara:'🇮🇹 Serie B', reggiana:'🇮🇹 Serie B',
  sampdoria:'🇮🇹 Serie B', spezia:'🇮🇹 Serie B',
  'fc-sudtirol':'🇮🇹 Serie B', 'venezia-fc':'🇮🇹 Serie B',
  'virtus-entella':'🇮🇹 Serie B',
  // ── Ligue 1 ───────────────────────────────────────────────────────────────
  angers:'🇫🇷 Ligue 1', 'as-monaco':'🇫🇷 Ligue 1',
  auxerre:'🇫🇷 Ligue 1', brest:'🇫🇷 Ligue 1',
  'fc-paris-saint-germain':'🇫🇷 Ligue 1',
  'fc-stade-rennes':'🇫🇷 Ligue 1', 'stade-rennais-fc':'🇫🇷 Ligue 1',
  'fc-toulouse':'🇫🇷 Ligue 1', 'toulouse-fc':'🇫🇷 Ligue 1',
  'le-havre':'🇫🇷 Ligue 1', lille:'🇫🇷 Ligue 1',
  'montpellier-hsc':'🇫🇷 Ligue 1', nantes:'🇫🇷 Ligue 1',
  nice:'🇫🇷 Ligue 1', 'olympique-lyon':'🇫🇷 Ligue 1',
  'olympique-marseille':'🇫🇷 Ligue 1', 'rc-lens':'🇫🇷 Ligue 1',
  'saint-etienne':'🇫🇷 Ligue 1', 'stade-reims':'🇫🇷 Ligue 1',
  strasbourg:'🇫🇷 Ligue 1',
  // ── Ligue 2 ───────────────────────────────────────────────────────────────
  bordeaux:'🇫🇷 Ligue 2', caen:'🇫🇷 Ligue 2',
  guingamp:'🇫🇷 Ligue 2', lorient:'🇫🇷 Ligue 2',
  'rodez-af':'🇫🇷 Ligue 2',
  // ── Eredivisie ────────────────────────────────────────────────────────────
  'ajax-amsterdam':'🇳🇱 Eredivisie', 'az-alkmaar':'🇳🇱 Eredivisie',
  'fc-groningen':'🇳🇱 Eredivisie', 'fc-twente':'🇳🇱 Eredivisie',
  'fc-utrecht':'🇳🇱 Eredivisie', 'feyenoord-rotterdam':'🇳🇱 Eredivisie',
  'nac-breda':'🇳🇱 Eredivisie', 'pec-zwolle':'🇳🇱 Eredivisie',
  'psv-eindhoven':'🇳🇱 Eredivisie', 'sc-heerenveen':'🇳🇱 Eredivisie',
  'sparta-rotterdam':'🇳🇱 Eredivisie', 'vitesse-arnhem':'🇳🇱 Eredivisie',
  // ── Liga Portugal ─────────────────────────────────────────────────────────
  'benfica-lissabon':'🇵🇹 Liga Portugal', boavista:'🇵🇹 Liga Portugal',
  braga:'🇵🇹 Liga Portugal', 'casa-pia':'🇵🇹 Liga Portugal',
  famalicao:'🇵🇹 Liga Portugal', 'fc-porto':'🇵🇹 Liga Portugal',
  moreirense:'🇵🇹 Liga Portugal', 'rio-ave':'🇵🇹 Liga Portugal',
  'sporting-cp':'🇵🇹 Liga Portugal', 'sporting-lissabon':'🇵🇹 Liga Portugal',
  'vitoria-guimaraes':'🇵🇹 Liga Portugal',
  // ── Escocia (Scottish Premiership) ───────────────────────────────────────
  'aberdeen-fc':'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia', 'celtic-glasgow':'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia',
  'dundee-united':'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia', 'heart-of-midlothian':'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia',
  'hibernian-fc':'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia', 'motherwell-fc':'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia',
  rangers:'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia', 'st-johnstone':'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia',
  // ── Saudi Pro League ──────────────────────────────────────────────────────
  'al-ahli':'🇸🇦 Saudi Pro League', 'al-ahli-dschidda':'🇸🇦 Saudi Pro League',
  'al-ettifaq':'🇸🇦 Saudi Pro League', 'al-fateh':'🇸🇦 Saudi Pro League',
  'al-hilal':'🇸🇦 Saudi Pro League',
  'al-ittihad':'🇸🇦 Saudi Pro League', 'al-ittihad-dschidda':'🇸🇦 Saudi Pro League',
  'al-nasr-riad':'🇸🇦 Saudi Pro League', 'al-nassr':'🇸🇦 Saudi Pro League',
  'al-qadisiyah-fc':'🇸🇦 Saudi Pro League', 'al-qadsiah':'🇸🇦 Saudi Pro League',
  'al-shabab':'🇸🇦 Saudi Pro League', 'al-shabab-riad':'🇸🇦 Saudi Pro League',
  // ── MLS ───────────────────────────────────────────────────────────────────
  'atlanta-united-fc':'🇺🇸 MLS', 'atlanta-united':'🇺🇸 MLS', 'austin-fc':'🇺🇸 MLS',
  'cf-montreal':'🇺🇸 MLS', 'chicago-fire':'🇺🇸 MLS',
  'columbus-crew-sc':'🇺🇸 MLS', 'columbus-crew':'🇺🇸 MLS', 'fc-dallas':'🇺🇸 MLS',
  'inter-miami-cf':'🇺🇸 MLS', 'la-galaxy':'🇺🇸 MLS',
  'los-angeles-galaxy':'🇺🇸 MLS', 'new-york-city-fc':'🇺🇸 MLS',
  'new-york-red-bulls':'🇺🇸 MLS', 'new-york-red-bulls-ii':'🇺🇸 MLS',
  'philadelphia-union':'🇺🇸 MLS', 'portland-timbers':'🇺🇸 MLS',
  'real-salt-lake':'🇺🇸 MLS', 'seattle-sounders-fc':'🇺🇸 MLS', 'seattle-sounders':'🇺🇸 MLS',
  lafc:'🇺🇸 MLS', 'sporting-kansas-city':'🇺🇸 MLS', 'toronto-fc':'🇺🇸 MLS',
  'vancouver-whitecaps':'🇺🇸 MLS',
  // ── América del Sur ───────────────────────────────────────────────────────
  'boca-juniors':'🌎 América del Sur', botafogo:'🌎 América del Sur', 'colo-colo':'🌎 América del Sur',
  'ca-chacarita-juniors':'🌎 América del Sur',
  'club-atletico-boca-juniors':'🌎 América del Sur',
  'club-atletico-river-plate':'🌎 América del Sur',
  'club-estudiantes-de-la-plata':'🌎 América del Sur',
  corinthians:'🌎 América del Sur', 'corinthians-sao-paulo':'🌎 América del Sur',
  cruzeiro:'🌎 América del Sur', 'cruz-azul':'🌎 América del Sur',
  'deportivo-guadalajara':'🌎 América del Sur',
  estudiantes:'🌎 América del Sur', flamengo:'🌎 América del Sur',
  fluminense:'🌎 América del Sur', 'fluminense-rio-de-janeiro':'🌎 América del Sur',
  gremio:'🌎 América del Sur', guadalajara:'🌎 América del Sur',
  'immigration-fc':'🌎 América del Sur', independiente:'🌎 América del Sur',
  'juventud-de-las-piedras':'🌎 América del Sur',
  monterrey:'🌎 América del Sur', nacional:'🌎 América del Sur',
  palmeiras:'🌎 América del Sur', penarol:'🌎 América del Sur',
  'racing-club':'🌎 América del Sur', 'real-betis-sevilla':'🌎 América del Sur',
  'river-plate':'🌎 América del Sur', 'san-lorenzo':'🌎 América del Sur',
  santos:'🌎 América del Sur', 'sao-paulo-fc':'🌎 América del Sur',
  'sc-internacional':'🌎 América del Sur', 'se-palmeiras-sao-paulo':'🌎 América del Sur',
  'talleres-cordoba':'🌎 América del Sur', 'tigres-uanl':'🌎 América del Sur',
  'vasco-da-gama':'🌎 América del Sur', 'velez-sarsfield':'🌎 América del Sur',
  // ── Otros ─────────────────────────────────────────────────────────────────
  besiktas:'🌍 Otros', 'bsc-young-boys':'🌍 Otros',
  'eidsvold-turn-fotball':'🌍 Otros', 'fc-stade-lausanne-ouchy':'🌍 Otros',
  'cska-moscow':'🌍 Otros', 'dynamo-kyiv':'🌍 Otros',
  'fc-brugge':'🌍 Otros', 'fc-kopenhagen':'🌍 Otros',
  fenerbahce:'🌍 Otros', galatasaray:'🌍 Otros', 'galatasaray-istanbul':'🌍 Otros',
  'gnk-dinamo-zagreb':'🌍 Otros', partizan:'🌍 Otros',
  'rapid-vienna':'🌍 Otros', 'rsc-anderlecht':'🌍 Otros',
  'fc-red-bull-salzburg':'🌍 Otros', 'red-bull-salzburg':'🌍 Otros',
  'red-star-belgrade':'🌍 Otros', 'schachtar-donezk':'🌍 Otros',
  'shakhtar-donetsk':'🌍 Otros', 'spartak-moscow':'🌍 Otros',
  'steaua-bucharest':'🌍 Otros', 'zenit-st-petersburg':'🌍 Otros',
};

// Slug → display name for national teams that don't set d.name
// English display names (for all national team slugs — German, Spanish, English)
const _SLUG_DISPLAY_NAME = {
  // German slugs — WC / histórico
  albanien:'Albania', algerien:'Algeria', argentinien:'Argentina',
  australien:'Australia', belgien:'Belgium', 'bosnien-herzegowina':'Bosnia & Herzegovina',
  brasilien:'Brazil', bulgarien:'Bulgaria', danemark:'Denmark',
  deutschland:'Germany', elfenbeinkuste:'Ivory Coast', finnland:'Finland',
  frankreich:'France', griechenland:'Greece', island:'Iceland',
  italien:'Italy', jamaika:'Jamaica', kamerun:'Cameroon',
  kanada:'Canada', 'kap-verde':'Cape Verde', kolumbien:'Colombia',
  agypten:'Egypt', irak:'Iraq', jordanien:'Jordan', kongo:'DR Congo',
  kroatien:'Croatia', mexiko:'Mexico', neuseeland:'New Zealand',
  niederlande:'Netherlands', nordirland:'Northern Ireland', nordkorea:'North Korea',
  norwegen:'Norway', osterreich:'Austria', polen:'Poland',
  russland:'Russia', 'saudi-arabien':'Saudi Arabia', schottland:'Scotland',
  schweden:'Sweden', schweiz:'Switzerland', senegal:'Senegal',
  serbien:'Serbia', slowakei:'Slovakia', slowenien:'Slovenia',
  spanien:'Spain', sudafrika:'South Africa', sudkorea:'South Korea',
  tschechien:'Czech Republic', 'trinidad-und-tobago':'Trinidad & Tobago',
  tunesien:'Tunisia', turkei:'Turkey', ungarn:'Hungary',
  usbekistan:'Uzbekistan', 'vereinigte-staaten':'United States',
  // Spanish slugs
  marruecos:'Morocco', noruega:'Norway', rusia:'Russia', japon:'Japan',
  corea:'South Korea', holanda:'Netherlands',
  // English slugs
  albania:'Albania', algeria:'Algeria', argentina:'Argentina', australia:'Australia',
  austria:'Austria', bahrain:'Bahrain', belgium:'Belgium', bolivia:'Bolivia',
  bosnia:'Bosnia & Herzegovina', brazil:'Brazil', bulgaria:'Bulgaria',
  cameroon:'Cameroon', canada:'Canada', 'cape-verde':'Cape Verde', chile:'Chile',
  china:'China PR', colombia:'Colombia', 'costa-rica':'Costa Rica', croatia:'Croatia',
  'czech-republic':'Czech Republic', denmark:'Denmark',
  'democratic-republic-of-congo':'DR Congo',
  ecuador:'Ecuador', egypt:'Egypt', england:'England', finland:'Finland',
  france:'France', germany:'Germany', ghana:'Ghana', greece:'Greece', haiti:'Haiti',
  honduras:'Honduras', hungary:'Hungary', iceland:'Iceland', iran:'Iran',
  iraq:'Iraq', ireland:'Ireland', 'ivory-coast':'Ivory Coast', japan:'Japan',
  jordan:'Jordan', mali:'Mali', mexico:'Mexico', morocco:'Morocco',
  netherlands:'Netherlands', 'new-zealand':'New Zealand', nigeria:'Nigeria',
  'north-korea':'North Korea', norway:'Norway', oman:'Oman', panama:'Panama',
  paraguay:'Paraguay', peru:'Peru', poland:'Poland', portugal:'Portugal',
  'republic-of-ireland':'Ireland', romania:'Romania', russia:'Russia',
  'saudi-arabia':'Saudi Arabia', scotland:'Scotland', senegal:'Senegal',
  serbia:'Serbia', slovakia:'Slovakia', slovenia:'Slovenia',
  'south-africa':'South Africa', 'south-korea':'South Korea', spain:'Spain',
  sweden:'Sweden', switzerland:'Switzerland', 'trinidad-and-tobago':'Trinidad & Tobago',
  tunisia:'Tunisia', turkey:'Turkey', ukraine:'Ukraine', 'united-states':'United States',
  uruguay:'Uruguay', uzbekistan:'Uzbekistan', venezuela:'Venezuela', wales:'Wales',
};

// Spanish display names (falls back to English name if not here)
const _SLUG_DISPLAY_NAME_ES = {
  // German slugs
  albanien:'Albania', algerien:'Argelia', argentinien:'Argentina',
  australien:'Australia', belgien:'Bélgica', 'bosnien-herzegowina':'Bosnia',
  brasilien:'Brasil', bulgarien:'Bulgaria', danemark:'Dinamarca',
  deutschland:'Alemania', elfenbeinkuste:'Costa de Marfil', finnland:'Finlandia',
  frankreich:'Francia', griechenland:'Grecia', island:'Islandia',
  italien:'Italia', jamaika:'Jamaica', kamerun:'Camerún',
  kanada:'Canadá', 'kap-verde':'Cabo Verde', kolumbien:'Colombia',
  agypten:'Egipto', irak:'Irak', jordanien:'Jordania', kongo:'R.D. Congo',
  kroatien:'Croacia', mexiko:'México', neuseeland:'Nueva Zelanda',
  niederlande:'Países Bajos', nordirland:'Irlanda del Norte', nordkorea:'Corea del Norte',
  norwegen:'Noruega', osterreich:'Austria', polen:'Polonia',
  russland:'Rusia', 'saudi-arabien':'Arabia Saudí', schottland:'Escocia',
  schweden:'Suecia', schweiz:'Suiza', senegal:'Senegal',
  serbien:'Serbia', slowakei:'Eslovaquia', slowenien:'Eslovenia',
  spanien:'España', sudafrika:'Sudáfrica', sudkorea:'Corea del Sur',
  tschechien:'Rep. Checa', 'trinidad-und-tobago':'Trinidad y Tobago',
  tunesien:'Túnez', turkei:'Turquía', ungarn:'Hungría',
  usbekistan:'Uzbekistán', 'vereinigte-staaten':'EE.UU.',
  // Spanish slugs (already in Spanish, kept for completeness)
  marruecos:'Marruecos', noruega:'Noruega', rusia:'Rusia', japon:'Japón',
  corea:'Corea del Sur', holanda:'Países Bajos',
  // English slugs → Spanish
  albania:'Albania', algeria:'Argelia', argentina:'Argentina', australia:'Australia',
  austria:'Austria', bahrain:'Baréin', belgium:'Bélgica', bolivia:'Bolivia',
  bosnia:'Bosnia', brazil:'Brasil', bulgaria:'Bulgaria',
  cameroon:'Camerún', canada:'Canadá', 'cape-verde':'Cabo Verde', chile:'Chile',
  china:'China', colombia:'Colombia', 'costa-rica':'Costa Rica', croatia:'Croacia',
  'czech-republic':'Rep. Checa', denmark:'Dinamarca',
  'democratic-republic-of-congo':'R.D. Congo',
  ecuador:'Ecuador', egypt:'Egipto', england:'Inglaterra', finland:'Finlandia',
  france:'Francia', germany:'Alemania', ghana:'Ghana', greece:'Grecia', haiti:'Haití',
  honduras:'Honduras', hungary:'Hungría', iceland:'Islandia', iran:'Irán',
  iraq:'Irak', ireland:'Irlanda', 'ivory-coast':'Costa de Marfil', japan:'Japón',
  jordan:'Jordania', mali:'Malí', mexico:'México', morocco:'Marruecos',
  netherlands:'Países Bajos', 'new-zealand':'Nueva Zelanda', nigeria:'Nigeria',
  'north-korea':'Corea del Norte', norway:'Noruega', oman:'Omán', panama:'Panamá',
  paraguay:'Paraguay', peru:'Perú', poland:'Polonia', portugal:'Portugal',
  'republic-of-ireland':'Irlanda', romania:'Rumanía', russia:'Rusia',
  'saudi-arabia':'Arabia Saudí', scotland:'Escocia', senegal:'Senegal',
  serbia:'Serbia', slovakia:'Eslovaquia', slovenia:'Eslovenia',
  'south-africa':'Sudáfrica', 'south-korea':'Corea del Sur', spain:'España',
  sweden:'Suecia', switzerland:'Suiza', 'trinidad-and-tobago':'Trinidad y Tobago',
  tunisia:'Túnez', turkey:'Turquía', ukraine:'Ucrania', 'united-states':'EE.UU.',
  uruguay:'Uruguay', uzbekistan:'Uzbekistán', venezuela:'Venezuela', wales:'Gales',
};

// Catalog: name + slug + available seasons (only teams with ≥1 season)
// Built once at startup from squads/ JSON files. Used by the era dropdown in the UI.
const CATALOG = [];
for (const file of _squadFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', file), 'utf8'));
    const seasons = Object.keys(d.seasons || {}).filter(s => {
      if (!/^(19[5-9]\d|20[0-2]\d|all-time)$/.test(s)) return false; // only valid years or 'all-time'
      const p = d.seasons[s];
      return p && Array.isArray(p.players) && p.players.length >= 8;
    }).sort((a, b) => Number(b) - Number(a)); // newest first
    if (seasons.length === 0) continue;
    const slug = d.slug || file.replace('.json', '');
    const isNational = (_SLUG_GROUP[slug] === '🌍 Selecciones');
    const nameEn = isNational
      ? (_SLUG_DISPLAY_NAME[slug] || d.name || slug)
      : (d.name || slug);
    const nameEs = isNational
      ? (_SLUG_DISPLAY_NAME_ES[slug] || _SLUG_DISPLAY_NAME[slug] || d.name || slug)
      : (d.name || slug);
    const badge = d.badgeLocalPath || BADGE_PLACEHOLDER;
    const group = _SLUG_GROUP[slug] || '🌍 Otros';
    CATALOG.push({ slug, nameEn, nameEs, name: nameEn, badge, seasons, group });
  } catch (_) {}
}
// Sort by group order then alphabetically within group
CATALOG.sort((a, b) => {
  const gi = _GROUP_ORDER.indexOf(a.group) - _GROUP_ORDER.indexOf(b.group);
  if (gi !== 0) return gi;
  return a.nameEn.localeCompare(b.nameEn, 'es', { sensitivity: 'base' });
});

function _badgeFor(teamName) {
  if (!teamName) return BADGE_PLACEHOLDER;
  return _badgeMap.get(teamName.toLowerCase())
      || _badgeMap.get(teamName.toLowerCase().replace(/^(fc|ac|as|rc|sc|cd|ud|cf|ss|sk)\s+/i, ''))
      || BADGE_PLACEHOLDER;
}

// Resolve a display name / slug / localized label → canonical squad slug
// Used by /simulate so picker-submitted slugs and typed names both work.
const _catalogNameMap = (() => {
  const m = new Map();
  for (const e of CATALOG) {
    m.set(e.slug.toLowerCase(), e.slug);
    if (e.nameEn) m.set(e.nameEn.toLowerCase(), e.slug);
    if (e.nameEs) m.set(e.nameEs.toLowerCase(), e.slug);
  }
  return m;
})();
function _resolveTeamSlug(input) {
  return _catalogNameMap.get(input.trim().toLowerCase()) || input.trim();
}

// ── Middleware ────────────────────────────────
// Gzip/Brotli compression for all text responses (HTML, CSS, JS, JSON).
// Reduces bandwidth ~70-80% — essential for mobile performance and hosting costs.
app.use(compress({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '32kb' }));

// ── Per-request timeout: 25 s hard cap ───────────────────────────────────
// Prevents a hung /simulate (e.g. external API not responding) from holding
// a Node.js worker open indefinitely and eventually exhausting memory.
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timed out. Please try again.' });
    }
  }, 25_000);
  res.on('finish', () => clearTimeout(timer));
  res.on('close',  () => clearTimeout(timer));
  next();
});

// Security headers — registered FIRST so they apply to ALL responses,
// including static files (index.html, CSS, JS, images).
// upgrade-insecure-requests is only valid (and needed) when serving over HTTPS.
// On HTTP (local dev via LAN IP), it causes browsers to upgrade same-origin requests
// to HTTPS (which fails), making the page completely unstyled on mobile devices.
const _siteIsHttps = (process.env.SITE_URL || '').startsWith('https://');

app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-DNS-Prefetch-Control', 'off');  // Prevent DNS prefetch leaking browsed URLs
  res.set('Content-Security-Policy',
    "default-src 'self'; " +
    "img-src 'self' data: blob: https://www.thesportsdb.com https://media.api-sports.io https://flagcdn.com; " +
    "script-src 'self' 'unsafe-inline'; " +  // TODO: migrate 15 onclick= handlers to addEventListener() then replace unsafe-inline with nonce-{generated per request}
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "worker-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'" +
    (_siteIsHttps ? "; upgrade-insecure-requests" : ""));
  res.set('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=()');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.set('Cross-Origin-Embedder-Policy', 'credentialless');
  // HSTS: only sent over HTTPS; harmless on HTTP (ignored by browsers then)
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

// ── Dynamic index.html (injects og:url + canonical from SITE_URL env var) ──
// Must come before express.static so the route wins over the static file handler.
app.get('/', (_req, res) => {
  const cleanUrl = (process.env.SITE_URL || 'https://tudominio.com').replace(/[\\"'<>]/g, '').replace(/\/$/, '');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  // Inject og:url and canonical just after the og:type meta tag
  const injected = html.replace(
    '<meta property="og:type" content="website" />',
    `<meta property="og:type" content="website" />\n  <meta property="og:url" content="${cleanUrl}/" />\n  <link rel="canonical" href="${cleanUrl}/" />`
  );
  res.set('Cache-Control', 'no-cache').type('text/html').send(injected);
});

// Fuentes auto-alojadas: cache inmutable 1 año
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), {
  maxAge: '1y',
  immutable: true,
}));

// Service Worker — must be served from the root scope with the correct header
// so it can intercept all requests under '/'.
// The Service-Worker-Allowed header grants it scope beyond its script directory.
app.get('/sw.js', (_req, res) => {
  res.set('Service-Worker-Allowed', '/');
  res.set('Cache-Control', 'no-cache');  // SW must always re-validate
  res.set('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Versioned assets (app.js?v=N, style.css?v=N) — always serve fresh, never cached.
// The version query string already busts any CDN or browser cache.
app.get('/app.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'app.js'));
});
app.get('/style.css', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Shared JS modules — served from webapp root (used by both Node.js and browser)
app.get('/player_ratings.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'player_ratings.js'));
});

// ── Config endpoint: injects site URL into the frontend ──────────────────────
// Loaded as /config.js — exposes only safe, non-secret config to the client.
app.get('/config.js', (_req, res) => {
  const safeUrl = SITE_URL.replace(/[\\"'<>]/g, '');
  res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').send(
    `window.GOLAZOX_CONFIG=${JSON.stringify({ siteUrl: safeUrl, version: '1.0' })};`
  );
});

// Per-endpoint rate limiters (sliding window, survives restarts via express-rate-limit)
const _rl = (max, windowMs) => rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-6',
  legacyHeaders:   false,
  message:         { error: 'Too many requests. Please wait.' },
  keyGenerator:    ipKeyGenerator,
});
const _rateLimit = _rl;  // alias — all call sites unchanged

// ════════════════════════════════════════════════════════════════════════════
// CAPA DE SEGURIDAD ANTI-DDOS / ANTI-SCRAPING / ANTI-BRUTEFORCE
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Bloqueo de bots y clientes automatizados (API endpoints) ──────────
// Regla: si el UA está vacío o coincide con herramientas CLI/scraping, devuelve
// 403. Los navegadores reales siempre envían un UA con "Mozilla/". Los crawlers
// SEO legítimos (Googlebot, Bingbot) nunca deberían llamar a los endpoints de
// la API, pero si lo hacen no se les bloquea para no romper indexación.
const _BLOCKED_UA_RE = /^(curl|wget|python[\s\-/]|scrapy|go-http-client|java\/|okhttp\/|axios\/|node-fetch|got\/|libwww|libcurl|perl\/|ruby\/|php\/|nikto|sqlmap|masscan|nmap|zgrab|nuclei[/ ]|dirbuster|gobuster|wfuzz|ffuf|hydra[/ ]|acunetix|nessus|burp|zap\/)/i;

const _apiBotBlock = (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua || _BLOCKED_UA_RE.test(ua)) {
    console.warn(`[security:bot] BLOCKED IP=${req.ip} UA="${ua.slice(0, 120)}" ${req.method} ${req.path}`);
    return res.status(403).set('Retry-After', '3600').json({ error: 'Forbidden' });
  }
  next();
};
// Sólo se aplica a los endpoints de datos — NO a ficheros estáticos ni HTML
app.use(['/simulate', '/lookup', '/catalog', '/suggest', '/referees'], _apiBotBlock);

// ── 2. Presupuesto global de peticiones: 200 req / 5 min por IP ──────────
// Capa compartida para TODAS las rutas. Un usuario legítimo rara vez supera
// 40 req/min; un bot en paralelo lo satura en segundos.
// Si se supera: 429 con Retry-After. Se registra IP + ruta para análisis.
app.use(rateLimit({
  windowMs: 5 * 60 * 1000,   // ventana de 5 minutos
  max:      200,              // máximo acumulado entre TODOS los endpoints
  standardHeaders: 'draft-6',
  legacyHeaders:   false,
  message:         { error: 'Rate limit global. Espera unos minutos.' },
  keyGenerator:    ipKeyGenerator,
  handler: (req, res, _next, options) => {
    console.warn(`[security:global-rl] IP=${req.ip} ${req.method} ${req.path} → HTTP 429`);
    res.status(options.statusCode)
       .set('Retry-After', String(Math.ceil(options.windowMs / 1000)))
       .json(options.message);
  },
}));

// ── 3. Slow-down progresivo en /simulate ─────────────────────────────────
// Las primeras 3 simulaciones/min: sin demora (flujo normal de usuario).
// A partir de la 4ª: +1 s por llamada extra, máximo 6 s.
// Efecto: el usuario lo nota levemente; un script en bucle queda bloqueado
// esperando sin consumir tus créditos de hosting en cómputo intensivo.
const _simulateSlowDown = slowDown({
  windowMs:     60_000,   // ventana de 1 minuto
  delayAfter:   3,        // sin demora en las primeras 3 llamadas
  delayMs:      (used, req) => {
    const excess = used - req.slowDown.limit;   // req.slowDown.limit = delayAfter
    return Math.min(excess * 1000, 6000);       // +1 s por llamada, tope 6 s
  },
  keyGenerator: ipKeyGenerator,
  headers:      true,     // X-SlowDown-* headers para debug
});

// ── 4. Validación de Content-Type en /simulate ───────────────────────────
// Rechaza payloads que no sean JSON plano (bloquea formularios HTML y ataques
// de tipo content-type confusion que intentan bypassar parsers).
const _requireJSON = (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
};

// Whitelist of accepted formations (+ empty = auto)
const _VALID_FORMATIONS = new Set([
  '','4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2','4-5-1','4-1-4-1',
  '4-1-2-1-2','1-2-1','1-1-2','2-1-1','1-1','1-2','2-1','3-2','2-3',
]);

// ── GET /catalog ──────────────────────────────
// Returns the full catalog of local teams + their available seasons.
// Cached for 5 min (re-run seed to update).
// Rate: 8/5min per IP (1.6/min) — it's a ~150 kB JSON payload with all 471 teams;
// a legitimate client loads it once at startup and caches it for 5 minutes.
app.get('/catalog', _rateLimit(8, 5 * 60000), (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(CATALOG);
});

// ── GET /suggest ─────────────────────────────
// Query: ?q=bar  → returns up to 15 matching {name, badge} objects for autocomplete
// Rate: 40/min — fast autocomplete, pero con margen para que un bot necesite más.
app.get('/suggest', _rateLimit(40, 60000), (req, res) => {
  const q = String(req.query.q || '').replace(/[<>]/g, '').trim().toLowerCase().slice(0, 40);
  const matches = q.length < 1
    ? SQUAD_SUGGESTIONS.slice(0, 20)
    : SQUAD_SUGGESTIONS.filter(s => s.toLowerCase().includes(q)).slice(0, 15);
  const result = matches.map(name => ({ name, badge: _badgeFor(name) }));
  res.set('Cache-Control', 'no-store');
  res.json(result);
});

// ── GET /badges ───────────────────────────────
// Gallery page: returns all known teams with badges as HTML
app.get('/badges', _rateLimit(30, 60000), (_req, res) => {
  const rows = _allTeams.map(t =>
    `<div class="bg-card">`+
    `<img src="${t.badge.replace(/"/g,'&quot;')}" alt="" onerror="this.src='/img/badges/_placeholder.svg'">` +
    `<div class="bg-name">${t.name.replace(/</g,'&lt;')}</div>`+
    `</div>`
  ).join('');
  res.set('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Badge Gallery</title>
<style>body{background:#0d1526;color:#e2e8f0;font-family:sans-serif;padding:1rem}
h1{color:#00d4ff;margin-bottom:1.2rem}input{background:#1a2236;color:#e2e8f0;border:1px solid #2d3f5e;border-radius:6px;padding:.4rem .8rem;font-size:.9rem;margin-bottom:1rem;width:280px}
.bg-grid{display:flex;flex-wrap:wrap;gap:10px}
.bg-card{background:#1a2236;border:1px solid #2d3f5e;border-radius:8px;width:90px;padding:10px 6px 8px;text-align:center;transition:border-color .15s}
.bg-card:hover{border-color:#00d4ff}
.bg-card img{width:56px;height:56px;object-fit:contain;display:block;margin:0 auto 6px}
.bg-name{font-size:.65rem;line-height:1.3;word-break:break-word;color:#94a3b8}
</style></head><body>
<h1>⚽ Badge Gallery &nbsp;<small style="font-size:.7rem;color:#94a3b8">${_allTeams.length} equipos</small></h1>
<input id="f" placeholder="Filtrar…" oninput="document.querySelectorAll('.bg-card').forEach(c=>c.style.display=this.value&&!c.querySelector('.bg-name').textContent.toLowerCase().includes(this.value.toLowerCase())?'none':'')">
<div class="bg-grid">${rows}</div></body></html>`);
});

// ── GET /lookup ──────────────────────────────
// Query: ?team=Arsenal&era=2004
// Returns live squad data from local DB or TheSportsDB API
// Rate: 15/min — cada lookup puede llegar a hacer una llamada externa; 15 es
// más que suficiente para uso interactivo y inhibe el harvesting automatizado.
app.get('/lookup', _rateLimit(15, 60000), async (req, res) => {
  try {
    const sanitise = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 80);
    const team = sanitise(req.query.team);
    const era  = sanitise(req.query.era);

    if (!team) return res.status(400).json({ found: false, error: 'team param required' });

    const result  = await lookupTeam(team, era);

    // Team not found — return a helpful error distinguishing offline vs unknown
    if (!result.found) {
      const isOffline = process.env.OFFLINE_MODE === 'true';
      return res.status(404).json({
        found:   false,
        offline: isOffline,
        error:   isOffline
          ? `"${team}" no está en la base de datos local. Prueba con otro equipo o usa el buscador de sugerencias.`
          : `No se encontró "${team}". Comprueba el nombre o prueba otra temporada.`,
      });
    }

    const badgeUrl = result.badgeUrl ||
      await Promise.race([
        fetchTeamBadge(team),
        new Promise(r => setTimeout(() => r(null), 3000)),
      ]).catch(() => null);

    // Apply formation template so the frontend always receives a proper 11-man
    // lineup instead of the raw ~25-player squad stored in cache.
    let displayResult = result;
    if (result.found && result.players && result.players.length > 0) {
      const formationOverride = String(req.query.formation || '').replace(/[^0-9\-]/g, '').trim();
      const lineup = buildLineupFromCache(result, formationOverride || '');
      // Resolve to catalog display name (same as /simulate) so deriveRatings hint tokens match
      const slug         = _resolveTeamSlug(team);
      const catalogEntry = CATALOG.find(c => c.slug === slug);
      const displayName  = catalogEntry ? catalogEntry.nameEn : team;
      const computedRatings = deriveRatings(displayName, era, result.ratings);
      displayResult = { ...result, ...lineup, ratings: computedRatings };
    }
    res.set('Cache-Control', 'no-store');
    res.json({ ...displayResult, badgeUrl });
  } catch (err) {
    console.error('[/lookup error]', err.message);
    res.status(500).json({ found: false, error: 'Error al buscar el equipo. Inténtalo de nuevo.' });
  }
});

// ── POST /simulate ────────────────────────────
// Body: { teamA, teamB, eraA, eraB, formationA, formationB }
// Returns: { lineups, ratings, probabilities, finalScore, scorers, altScores, narrative }
// Rate: 10/min hard block + slow-down progresivo a partir de la 4ª llamada.
// Content-Type: application/json requerido (bloquea formularios y payloads raw).
app.post('/simulate', _requireJSON, _simulateSlowDown, _rateLimit(10, 60000), async (req, res) => {
  try {
    const { teamA, teamB, eraA = '', eraB = '', formationA = '', formationB = '', matchMode = '11v11', matchSalt = 0, lang: reqLang = 'es',
            refereeId = null, isFinal = false, weatherId = null,
            playersOverrideA = null, playersOverrideB = null } = req.body;

    if (!teamA || !teamB) {
      return res.status(400).json({ error: 'Both teamA and teamB are required.' });
    }

    // Sanitise inputs (max 80 chars each, strip HTML)
    const sanitise = (s) => String(s).replace(/[<>]/g, '').trim().slice(0, 80);
    const sanitiseFormation = (s) => {
      const f = String(s || '').replace(/[^0-9\-]/g, '').trim();
      return _VALID_FORMATIONS.has(f) ? f : '';
    };

    const sTeamA = sanitise(teamA);
    const sTeamB = sanitise(teamB);
    const sEraA  = sanitise(eraA);
    const sEraB  = sanitise(eraB);

    // Resolve display name / slug to canonical catalog slug for reliable local-file lookup
    const lang    = reqLang === 'en' ? 'en' : 'es';
    const slugA   = _resolveTeamSlug(sTeamA);
    const slugB   = _resolveTeamSlug(sTeamB);
    // Localized display names for the match (from catalog if available, else use submitted value)
    const entryA  = _catalogNameMap.has(sTeamA.toLowerCase()) ? CATALOG.find(c => c.slug === slugA) : null;
    const entryB  = _catalogNameMap.has(sTeamB.toLowerCase()) ? CATALOG.find(c => c.slug === slugB) : null;
    const dispA   = entryA ? (lang === 'en' ? entryA.nameEn : entryA.nameEs) : sTeamA;
    const dispB   = entryB ? (lang === 'en' ? entryB.nameEn : entryB.nameEs) : sTeamB;

    // Fetch real lineups for both teams in parallel
    // Start badge fetches immediately (in parallel with team lookups)
    const mkBadgeRace = name => Promise.race([
      fetchTeamBadge(name),
      new Promise(r => setTimeout(() => r(null), 7000)),
    ]).catch(() => null);
    const badgeRaceA = mkBadgeRace(slugA);
    const badgeRaceB = mkBadgeRace(slugB);

    const [luA, luB] = await Promise.all([
      lookupTeam(slugA, sEraA),
      lookupTeam(slugB, sEraB),
    ]);

    // Reject simulation if either team was not found anywhere
    if (!luA.found) {
      return res.status(404).json({ error: `¡Equipo no encontrado: "${dispA}"${sEraA ? ' (' + sEraA + ')' : ''}¡ Prueba sin año o con el nombre en inglés.` });
    }
    if (!luB.found) {
      return res.status(404).json({ error: `¡Equipo no encontrado: "${dispB}"${sEraB ? ' (' + sEraB + ')' : ''}¡ Prueba sin año o con el nombre en inglés.` });
    }

    // Apply pre-match player overrides (from user substitutions in the pre-match screen).
    // Sanitise each player: strip HTML, limit name to 60 chars, validate position code.
    const VALID_POSITIONS = new Set(['GK','RB','CB','LB','DM','CM','RM','LM','AM','RW','LW','ST']);
    const sanitisePlayers = (arr) => {
      if (!Array.isArray(arr) || arr.length < 8) return null;
      const cleaned = arr.slice(0, 25).map(p => ({
        name:     String(p.name || '').replace(/[<>]/g, '').trim().slice(0, 60),
        position: VALID_POSITIONS.has(String(p.position || '').toUpperCase()) ? String(p.position).toUpperCase() : null,
      })).filter(p => p.name.length > 0 && p.position);
      return cleaned.length >= 8 ? cleaned : null;
    };
    const cleanOverrideA = sanitisePlayers(playersOverrideA);
    const cleanOverrideB = sanitisePlayers(playersOverrideB);
    if (cleanOverrideA) luA.players = cleanOverrideA;
    if (cleanOverrideB) luB.players = cleanOverrideB;

    const params = {
      teamA:      dispA,
      teamB:      dispB,
      eraA:       sEraA,
      eraB:       sEraB,
      formationA:    sanitiseFormation(formationA) || (luA.found ? luA.formation : ''),
      formationB:    sanitiseFormation(formationB) || (luB.found ? luB.formation : ''),
      cachedLineupA: luA.found ? luA : null,
      cachedLineupB: luB.found ? luB : null,
      matchMode:     ['11v11','5v5','3v3','penalties'].includes(matchMode) ? matchMode : '11v11',
      matchSalt:     (Math.trunc(Number(matchSalt || 0)) || 0) & 0x7fffffff,
      refereeId:     typeof refereeId === 'string' ? refereeId.slice(0, 32) : null,
      isFinal:       !!isFinal,
      weatherId:     typeof weatherId === 'string' ? weatherId.slice(0, 24) : null,
    };

    const [badgeA, badgeB] = await Promise.all([
      luA.badgeUrl ? Promise.resolve(luA.badgeUrl) : badgeRaceA,
      luB.badgeUrl ? Promise.resolve(luB.badgeUrl) : badgeRaceB,
    ]);

    const simResult = simulateMatch(params);
    // Annotate timeline with narratives in the language the client requested
    if (Array.isArray(simResult.timeline)) {
      describeTimeline(simResult.timeline, simResult.playStyle || {}, lang, params.matchSalt);
    }
    const result = { ...simResult, badgeA, badgeB };
    res.set('Cache-Control', 'no-store');
    res.json(result);

  } catch (err) {
    console.error('[/simulate error]', err.message);
    res.status(500).json({ error: 'Simulation failed. Check server logs.' });
  }
});

// ── GET /referees ─────────────────────────────────────────────────────────
// Returns the full list of available referees (id, name, multipliers).
// Used by the client to populate the referee picker.
app.get('/referees', _rateLimit(30, 60000), (_req, res) => {
  res.json(REFEREES);
});

// Images are served as static files from public/img/ — no proxy needed.
// ── HTML escape helper (XSS prevention) ───────────────────
const _esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// ── Language helper — reads cookie or ?lang= param ────────
const _lang = (req) => {
  const q = req.query && req.query.lang;
  if (q === 'en' || q === 'es') return q;
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)golazox_lang=([^;]+)/);
  if (m && (m[1] === 'en' || m[1] === 'es')) return m[1];
  return 'es';
};
// ── Páginas legales (LSSI-CE / RGPD) ─────────────────────
const LEGAL_HTML = (title, body) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — GolazoX</title>
  <link rel="icon" type="image/png" href="/golazox-logo.png"/>
  <link rel="stylesheet" href="/style.css?v=21"/>
  <style>
    body { max-width: 760px; margin: 3rem auto; padding: 0 1.5rem; }
    h1 { font-size: 1.6rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.1rem; margin: 1.5rem 0 .5rem; color: rgba(255,255,255,.7); }
    p, li { font-size: .88rem; line-height: 1.7; color: rgba(255,255,255,.55); margin-bottom: .6rem; }
    a { color: #00d4ff; } a:hover { opacity: .75; }
    .back { display:inline-block; margin-top:2rem; font-size:.8rem; opacity:.5; }
  </style>
</head>
<body>${body}<a class="back" href="/">← Volver al simulador</a></body>
</html>`;

const OWNER_NAME  = process.env.OWNER_NAME  || 'Victor Vega Viyuela';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'vvvfbo@gmail.com'; // NEVER rendered in HTML
const SITE_URL    = process.env.SITE_URL    || 'https://tudominio.com';
const CONTACT_FILE = path.join(__dirname, 'contact_messages.json');

// ── Nodemailer transporter (optional — only active when EMAIL_PASS is set) ──
// Set env vars: EMAIL_USER=vvvfbo@gmail.com  EMAIL_PASS=<Gmail App Password>
// Gmail → Google Account → Security → 2-Step Verification → App Passwords
const _mailer = (process.env.EMAIL_USER && process.env.EMAIL_PASS)
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    })
  : null;
if (_mailer) {
  _mailer.verify(err => {
    if (err) console.warn('[mail] SMTP verify failed:', err.message);
    else     console.log('[mail] SMTP ready → will email', OWNER_EMAIL);
  });
} else {
  console.log('[mail] No EMAIL_USER/EMAIL_PASS set — contact messages saved to file only.');
}

async function _sendContactEmail({ name, email, subject, message }) {
  if (!_mailer) return;
  try {
    await _mailer.sendMail({
      from:    `"GolazoX Contact" <${process.env.EMAIL_USER}>`,
      to:      OWNER_EMAIL,
      replyTo: email,
      subject: `[GolazoX] ${subject || 'Nuevo mensaje de contacto'} – ${name}`,
      text:    `De: ${name} <${email}>\n\nAsunto: ${subject || '(sin asunto)'}\n\n${message}`,
      html:    `<p><strong>De:</strong> ${name} &lt;${email}&gt;</p>
                <p><strong>Asunto:</strong> ${subject || '(sin asunto)'}</p>
                <hr>
                <p style="white-space:pre-wrap">${message.replace(/</g,'&lt;')}</p>`,
    });
    console.log(`[mail] Contact email sent for ${email}`);
  } catch (err) {
    console.error('[mail] Failed to send email:', err.message);
  }
}

app.get('/legal', (req, res) => {
  const lang = _lang(req);
  if (lang === 'en') {
    res.type('text/html').send(LEGAL_HTML('Legal Notice', `
    <h1>Legal Notice</h1>
    <p><strong>Site Owner:</strong> \"GolazoX — Football Time Machine\" is a non-commercial personal fan project.
    Owner: ${OWNER_NAME}. Contact: <a href=\"/contact?lang=en\">Contact form</a>.</p>
    <h2>Purpose and Nature of the Service</h2>
    <p>GolazoX is a probabilistic simulation engine for historical football teams, intended solely for entertainment
    purposes. It does not provide gambling services, official match predictions, or any official sports information.</p>
    <h2>Intellectual Property — Code and Design</h2>
    <p>The source code, design, and simulation logic are the property of the site owner and are published under a
    personal non-commercial licence. Team and player names are used in a purely referential and informational capacity,
    under the descriptive trademark use doctrine and the public-domain nature of professional athletes\' public activities.</p>
    <h2>Third-Party Trademarks and Badges</h2>
    <p>The logos and visual identifiers of clubs and national teams displayed on this site are registered trademarks
    of their respective owners (clubs, national federations, UEFA, FIFA, and equivalent bodies). Their use is strictly
    limited to the referential identification of the simulated teams in a non-commercial, entertainment and educational
    context. This does not imply affiliation, sponsorship, endorsement, or association with any of those trademark holders.</p>
    <p>If you are the owner of any of these trademarks and consider their use inappropriate, please contact us via the
    <a href=\"/contact?lang=en\">contact form</a> and we will address your request as soon as possible.</p>
    <h2>Data Sources</h2>
    <p>Historical squad data is sourced from publicly accessible sources. None of these sources constitute official
    data from clubs or federations.</p>
    <h2>Disclaimer</h2>
    <p>Simulation results are fictional and randomly generated by a probabilistic model. They do not reflect real
    results and do not constitute predictions. The site owner is not responsible for any use made of the results
    or for the accuracy of historical data.</p>
    <h2>Applicable Law</h2>
    <p>This notice is governed by Spanish law (Law 34/2002 LSSI-CE) and applicable European regulations.</p>
  `, 'en'));
  } else {
  res.type('text/html').send(LEGAL_HTML('Aviso Legal', `
    <h1>Aviso Legal</h1>
    <p><strong>Identidad del titular:</strong> Este sitio web, \"GolazoX — Football Time Machine\", es un proyecto
    personal de carácter no comercial y sin ánimo de lucro. Titular: ${OWNER_NAME}.
    Contacto: <a href=\"/contact\">Formulario de contacto</a>.</p>
    <h2>Objeto y naturaleza del servicio</h2>
    <p>GolazoX es un simulador probabilístico de partidos de fútbol históricos con fines exclusivamente lúdicos
    y de entretenimiento. No ofrece servicios de apuestas, predicciones deportivas ni información oficial.</p>
    <h2>Propiedad intelectual — código y diseño</h2>
    <p>El código fuente, diseño y lógica de simulación son propiedad del titular y se publican bajo licencia
    personal no comercial. Los nombres de equipos y jugadores se usan con carácter referencial e informativo
    bajo la doctrina de uso descriptivo de marcas y de figuras públicas en el ejercicio de su actividad profesional.</p>
    <h2>Marcas registradas y escudos de terceros</h2>
    <p>Los logotipos e identificadores visuales de clubes y selecciones nacionales mostrados en este sitio son
    marcas registradas de sus respectivos titulares (clubes, federaciones nacionales, UEFA, FIFA y organismos
    equivalentes). Su uso se limita exclusivamente a la identificación referencial de los equipos simulados
    en un contexto no comercial, lúdico y educativo, sin que ello implique afiliación, patrocinio, asociación
    ni respaldo por parte de ninguno de dichos titulares.</p>
    <p>Si eres titular de alguna de estas marcas y consideras que su uso no es adecuado, puedes contactarnos a través del
    <a href=\"/contact\">formulario de contacto</a> y atenderemos tu solicitud a la mayor brevedad posible.</p>
    <h2>Fuentes de datos</h2>
    <p>Los datos de plantillas históricas se obtienen de fuentes de acceso público. Ninguna de
    estas fuentes constituye datos oficiales de los clubes o federaciones.</p>
    <h2>Exclusión de responsabilidad</h2>
    <p>Los resultados del simulador son ficticios y generados aleatoriamente mediante un modelo probabilístico.
    No reflejan resultados reales ni constituyen predicciones. El titular no se responsabiliza del uso que los
    usuarios hagan de los resultados ni de la exactitud de los datos históricos.</p>
    <h2>Legislación aplicable</h2>
    <p>Este aviso se rige por la legislación española (Ley 34/2002 LSSI-CE) y la normativa europea aplicable.</p>
  `));
  }
});

app.get('/privacy', (req, res) => {
  const lang = _lang(req);
  if (lang === 'en') {
    res.type('text/html').send(LEGAL_HTML('Privacy Policy', `
    <h1>Privacy Policy</h1>
    <p>Last updated: ${new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' })}</p>
    <h2>Data Controller</h2>
    <p>${OWNER_NAME} — <a href="/contact?lang=en">Contact form</a></p>
    <h2>Data We Collect</h2>
    <p>GolazoX <strong>does not require registration</strong>, does not use tracking cookies, and does not actively
    collect personally identifiable information.</p>
    <h2>Local Storage</h2>
    <p>The application stores only the following in your browser's local storage:</p>
    <ul>
      <li><strong>golazox_lang</strong>: your preferred interface language (ES/EN). Contains no personal data.
      Is not transmitted to any server. Is deleted when you clear your browser data.</li>
    </ul>
    <h2>Server Logs</h2>
    <p>The hosting server may automatically log the IP address of requests for security and technical diagnostic
    purposes. These logs are retained for a maximum of 30 days and are not shared with third parties.</p>
    <h2>Cookies</h2>
    <p>This website <strong>does not use</strong> any first-party or third-party cookies for tracking or advertising.</p>
    <h2>External Data Sources</h2>
    <p>To retrieve historical squad data, the application may query publicly available APIs (no user key,
    no personal data from the visitor). These services have their own privacy policies.</p>
    <h2>Your Rights</h2>
    <p>As we do not process personally identifiable data, data access/rectification/erasure rights do not formally
    apply. For any query, use the <a href="/contact?lang=en">contact form</a>.</p>
    <h2>Changes to This Policy</h2>
    <p>Any changes will be published on this page with an updated date.</p>
  `, 'en'));
  } else {
  res.type('text/html').send(LEGAL_HTML('Política de Privacidad', `
    <h1>Política de Privacidad</h1>
    <p>Última actualización: ${new Date().toLocaleDateString('es-ES', { year:'numeric', month:'long', day:'numeric' })}</p>
    <h2>Responsable del tratamiento</h2>
    <p>${OWNER_NAME} — <a href="/contact">Formulario de contacto</a></p>
    <h2>Datos que recopilamos</h2>
    <p>GolazoX <strong>no solicita registro</strong>, no usa cookies de seguimiento y no recopila datos personales
    identificativos de forma activa.</p>
    <h2>Almacenamiento local (localStorage)</h2>
    <p>La aplicación guarda en el almacenamiento local de tu navegador únicamente:</p>
    <ul>
      <li><strong>golazox_lang</strong>: idioma preferido de la interfaz (ES/EN). No contiene datos personales.
      No se transmite a ningún servidor. Se elimina al borrar los datos del navegador.</li>
    </ul>
    <h2>Registros del servidor (logs)</h2>
    <p>El servidor de alojamiento puede registrar automáticamente la dirección IP de las peticiones con fines
    de seguridad y diagnóstico técnico. Estos registros se conservan un máximo de 30 días y no se ceden a terceros.</p>
    <h2>Cookies</h2>
    <p>Este sitio web <strong>no utiliza cookies</strong> propias ni de terceros para seguimiento o publicidad.</p>
    <h2>Fuentes de datos externas</h2>
    <p>Para obtener datos de plantillas históricas, la aplicación puede consultar APIs públicas
    (sin clave de usuario, sin datos personales del visitante). Estas fuentes tienen sus propias políticas de privacidad.</p>
    <h2>Derechos del usuario</h2>
    <p>Dado que no tratamos datos personales identificativos, no aplica el ejercicio de derechos ARCO/ARCOPOL
    en sentido estricto. Para cualquier consulta: <a href="/contact">formulario de contacto</a>.</p>
    <h2>Cambios en esta política</h2>
    <p>Cualquier modificación se publicará en esta página con la fecha de actualización actualizada.</p>
  `));
  }
});

// ── Contact form ────────────────────────────────────────────────────────────
const _contactLimit = _rateLimit(5, 10 * 60 * 1000); // 5 sends per 10 minutes

app.get('/contact', (req, res) => {
  const lang = _lang(req);
  const isEn = lang === 'en';
  res.type('text/html').send(LEGAL_HTML(isEn ? 'Contact' : 'Contacto', `
    <h1>${isEn ? 'Contact' : 'Contacto'}</h1>
    <p style="color:rgba(255,255,255,.55);font-size:.88rem">${isEn
      ? 'Use this form for any enquiry, takedown notice, or suggestion. Your email address will only be used to reply to you.'
      : 'Usa este formulario para cualquier consulta, aviso de derechos o sugerencia. Tu direcci\u00f3n de correo solo se usar\u00e1 para responderte.'}</p>
    <form method="POST" action="/contact${isEn ? '?lang=en' : ''}" style="display:flex;flex-direction:column;gap:.9rem;margin-top:1.5rem">
      <!-- Honeypot: bots fill this, humans don't see it -->
      <input name="url" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0;height:0;width:0" aria-hidden="true" />
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">${isEn ? 'Name' : 'Nombre'}
        <input name="name" required maxlength="120"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;box-sizing:border-box"/>
      </label>
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">Email
        <input name="email" type="email" required maxlength="120"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;box-sizing:border-box"/>
      </label>
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">${isEn ? 'Subject' : 'Asunto'}
        <input name="subject" maxlength="200"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;box-sizing:border-box"/>
      </label>
      <label style="font-size:.85rem;color:rgba(255,255,255,.6)">${isEn ? 'Message' : 'Mensaje'}
        <textarea name="message" required maxlength="2000" rows="6"
          style="display:block;width:100%;margin-top:.3rem;padding:.5rem .7rem;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:.88rem;resize:vertical;box-sizing:border-box"></textarea>
      </label>
      <button type="submit"
        style="align-self:flex-start;padding:.55rem 1.5rem;background:#00d4ff;color:#000;font-weight:700;
        border:none;border-radius:6px;cursor:pointer;font-size:.9rem">${isEn ? 'Send' : 'Enviar'}</button>
    </form>
  `, lang));
});

app.post('/contact', _contactLimit, express.urlencoded({ extended: false, limit: '8kb' }), (req, res) => {
  const lang    = _lang(req);
  const isEn    = lang === 'en';
  // Honeypot check: bots fill the hidden 'url' field, humans leave it empty
  const honeypot = String(req.body.url || '').trim();
  if (honeypot.length > 0) {
    // Silent reject — return success to not hint to bots
    return res.type('text/html').send(LEGAL_HTML(lang === 'en' ? 'Message sent' : 'Mensaje enviado', `
      <h1>${lang === 'en' ? 'Message received ✓' : 'Mensaje recibido ✓'}</h1>
      <p><a href="/">${lang === 'en' ? 'Back to simulator' : 'Volver al simulador'}</a></p>`, lang));
  }
  const name    = String(req.body.name    || '').slice(0, 120).trim();
  const email   = String(req.body.email   || '').slice(0, 120).trim();
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  const message = String(req.body.message || '').slice(0, 2000).trim();

  if (!name || !email || !message) {
    return res.status(400).type('text/html').send(LEGAL_HTML(isEn ? 'Error' : 'Error', `
      <h1>${isEn ? 'Missing fields' : 'Faltan campos'}</h1>
      <p>${isEn ? 'Please fill in name, email and message.' : 'Por favor, rellena nombre, email y mensaje.'}
      <a href="/contact${isEn ? '?lang=en' : ''}">${isEn ? 'Back to form' : 'Volver al formulario'}</a>.</p>`, lang));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).type('text/html').send(LEGAL_HTML(isEn ? 'Error' : 'Error', `
      <h1>${isEn ? 'Invalid email' : 'Email no válido'}</h1>
      <p><a href="/contact${isEn ? '?lang=en' : ''}">${isEn ? 'Back to form' : 'Volver al formulario'}</a>.</p>`, lang));
  }

  const entry = { ts: new Date().toISOString(), name, email, subject, message };
  try {
    let messages = [];
    if (fs.existsSync(CONTACT_FILE)) {
      try { messages = JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8')); } catch (_) {}
    }
    // Cap to 1000 messages to prevent disk exhaustion
    if (messages.length >= 1000) messages = messages.slice(-999);
    messages.push(entry);
    fs.writeFileSync(CONTACT_FILE, JSON.stringify(messages, null, 2), 'utf8');
  } catch (err) {
    console.error('[contact] Error saving message:', err.message);
  }
  console.log(`[contact] New message from ${name} <${email}>`);
  _sendContactEmail({ name, email, subject, message }); // fire-and-forget

  res.type('text/html').send(LEGAL_HTML(isEn ? 'Message sent' : 'Mensaje enviado', `
    <h1>${isEn ? 'Message received \u2713' : 'Mensaje recibido \u2713'}</h1>
    <p>${isEn
      ? `Thank you, ${_esc(name)}. We have received your message and will reply to <strong>${_esc(email)}</strong> as soon as possible.`
      : `Gracias, ${_esc(name)}. Hemos recibido tu mensaje y te responderemos a <strong>${_esc(email)}</strong> a la mayor brevedad posible.`}</p>
    <p><a href="/">${isEn ? 'Back to simulator' : 'Volver al simulador'}</a></p>
  `, lang));
});

// ── Serve index.html for all other routes ─────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Process crash guards ─────────────────────
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason);
});

app.listen(PORT, '0.0.0.0', () => {
  // Print local network IPs so devices on the same WiFi can connect
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const localIPs = [];
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) localIPs.push(net.address);
    }
  }
  console.log(`\n  ⚽  Football Simulator running at:`);
  console.log(`       http://localhost:${PORT}`);
  localIPs.forEach(ip => console.log(`       http://${ip}:${PORT}  ← use this on your iPhone`));
  console.log();
});
