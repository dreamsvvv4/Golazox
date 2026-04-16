/**
 * daily_matches.js — GolazOX Daily Match Video Generator
 *
 * Consulta los partidos reales del día via football-data.org,
 * elige el más relevante que tenga equipos en el catálogo,
 * genera un video de simulación y lo devuelve listo para subir.
 *
 * Setup:
 *   1. Registro gratuito en https://www.football-data.org/
 *   2. Añadir al .env: FOOTBALL_DATA_API_KEY=tu_token
 *
 * Usage:
 *   node daily_matches.js                  → genera video del mejor partido hoy
 *   node daily_matches.js --dry-run        → muestra partido elegido sin generar video
 *   node daily_matches.js --date 2026-04-15 → fecha específica
 */

'use strict';

const fsNode = require('fs');
const fs     = fsNode;           // alias — same module, no double require
const path   = require('path');

require('dotenv').config();
const fetch  = require('node-fetch');

// ── Team name → GolazoX slug mapping ────────────────────────────────────────
// Keys are lowercased team names / aliases from football-data.org
const TEAM_SLUG_MAP = {
  // La Liga
  'real madrid cf':           'real-madrid',
  'real madrid':              'real-madrid',
  'fc barcelona':             'fc-barcelona',
  'barcelona':                'fc-barcelona',
  'atlético de madrid':       'atletico-madrid',
  'atletico madrid':          'atletico-madrid',
  'club atlético de madrid':  'atletico-madrid',
  'sevilla fc':               'sevilla-fc',
  'sevilla':                  'sevilla-fc',
  'real betis balompié':      'real-betis-balompie',
  'real betis':               'real-betis-balompie',
  'athletic club':            'athletic-club',
  'real sociedad de fútbol':  'real-sociedad',
  'real sociedad':            'real-sociedad',
  'villarreal cf':            'villarreal-cf',
  'villarreal':               'villarreal-cf',
  'fc girona':                'fc-girona',
  'girona fc':                'fc-girona',
  'girona':                   'fc-girona',
  'rcd mallorca':             'rcd-mallorca',
  'celta de vigo':            'celta-vigo',
  'celta vigo':               'celta-vigo',
  'getafe cf':                'fc-getafe',
  'rayo vallecano':           'rayo-vallecano',
  'ud las palmas':            'ud-las-palmas',
  'cd leganés':               'cd-leganes',
  'deportivo alavés':         'deportivo-alaves',
  'espanyol':                 'espanyol-barcelona',
  // Premier League
  'manchester city fc':       'manchester-city',
  'manchester city':          'manchester-city',
  'liverpool fc':             'fc-liverpool',
  'liverpool':                'fc-liverpool',
  'arsenal fc':               'fc-arsenal',
  'arsenal':                  'fc-arsenal',
  'chelsea fc':               'fc-chelsea',
  'chelsea':                  'fc-chelsea',
  'manchester united fc':     'manchester-united',
  'manchester united':        'manchester-united',
  'tottenham hotspur fc':     'tottenham-hotspur',
  'tottenham hotspur':        'tottenham-hotspur',
  'tottenham':                'tottenham-hotspur',
  'newcastle united fc':      'newcastle-united',
  'newcastle united':         'newcastle-united',
  'aston villa fc':           'aston-villa',
  'aston villa':              'aston-villa',
  'west ham united fc':       'west-ham-united',
  'west ham':                 'west-ham-united',
  'brighton & hove albion fc':'brighton-hove-albion',
  'brighton':                 'brighton-hove-albion',
  'everton fc':               'fc-everton',
  'everton':                  'fc-everton',
  'wolverhampton wanderers fc': 'wolverhampton-wanderers',
  'wolverhampton wanderers':  'wolverhampton-wanderers',
  'wolves':                   'wolverhampton-wanderers',
  'fc bayern münchen':        'fc-bayern-munchen',
  'fc bayern munich':         'fc-bayern-munchen',
  'bayern munich':            'fc-bayern-munchen',
  'borussia dortmund':        'borussia-dortmund',
  'bayer 04 leverkusen':      'bayer-04-leverkusen',
  'bayer leverkusen':         'bayer-04-leverkusen',
  'rb leipzig':               'rb-leipzig',
  'eintracht frankfurt':      'eintracht-frankfurt',
  'vfl wolfsburg':            'vfl-wolfsburg',
  'borussia mönchengladbach': 'borussia-monchengladbach',
  '1. fc union berlin':       '1-fc-union-berlin',
  'sc freiburg':              'sc-freiburg',
  'tsg 1899 hoffenheim':      'tsg-1899-hoffenheim',
  'tsg hoffenheim':           'tsg-1899-hoffenheim',
  'hoffenheim':               'tsg-1899-hoffenheim',
  'vfb stuttgart':            'vfb-stuttgart',
  '1. fsv mainz 05':          '1-fsv-mainz-05',
  '1. fc köln':               '1-fc-koln',
  'fc augsburg':              'fc-augsburg',
  'sv werder bremen':         'sv-werder-bremen',
  // Serie A
  'juventus fc':              'juventus-turin',
  'juventus':                 'juventus-turin',
  'fc internazionale milano': 'inter-mailand',
  'inter milan':              'inter-mailand',
  'inter':                    'inter-mailand',
  'ac milan':                 'ac-mailand',
  'milan':                    'ac-mailand',
  'ssc napoli':               'ssc-neapel',
  'napoli':                   'ssc-neapel',
  'as roma':                  'as-rom',
  'roma':                     'as-rom',
  'ss lazio':                 'lazio-rom',
  'lazio':                    'lazio-rom',
  'acf fiorentina':           'ac-florenz',
  'fiorentina':               'ac-florenz',
  'atalanta bc':              'atalanta-bergamo',
  'atalanta':                 'atalanta-bergamo',
  // Ligue 1
  'paris saint-germain fc':   'fc-paris-saint-germain',
  'paris saint-germain':      'fc-paris-saint-germain',
  'psg':                      'fc-paris-saint-germain',
  'olympique de marseille':   'olympique-marseille',
  'marseille':                'olympique-marseille',
  'olympique lyonnais':       'olympique-lyon',
  'lyon':                     'olympique-lyon',
  'as monaco fc':             'as-monaco',
  'as monaco':                'as-monaco',
  'monaco':                   'as-monaco',
  'paris fc':                 'fc-paris-saint-germain',
  'stade de reims':           'stade-de-reims',
  'rc lens':                  'rc-lens',
  'ogc nice':                 'ogc-nice',
  'stade rennais fc':         'stade-rennais',
  'rennes':                   'stade-rennais',
  'fc nantes':                'fc-nantes',
  'nantes':                   'fc-nantes',
  'metz':                     'fc-metz',
  'fc metz':                  'fc-metz',
  'lille osc':                'losc-lille',
  'lille':                    'losc-lille',
  // Serie A — extra
  'pisa sporting club':       'ac-pisa',
  'pisa':                     'ac-pisa',
  'ac pisa':                  'ac-pisa',
  'spezia calcio':            'spezia-calcio',
  'us lecce':                 'us-lecce',
  'lecce':                    'us-lecce',
  'hellas verona fc':         'hellas-verona',
  'hellas verona':            'hellas-verona',
  'udinese calcio':           'udinese-calcio',
  'udinese':                  'udinese-calcio',
  'cagliari calcio':          'cagliari-calcio',
  'cagliari':                 'cagliari-calcio',
  'torino fc':                'fc-torino',
  'torino':                   'fc-torino',
  'bologna fc 1909':          'fc-bologna',
  'bologna':                  'fc-bologna',
  'empoli fc':                'fc-empoli',
  'empoli':                   'fc-empoli',
  'genoa cfc':                'genoa-cfc',
  'genoa':                    'genoa-cfc',
  'us sassuolo calcio':       'us-sassuolo',
  'sassuolo':                 'us-sassuolo',
  // Champions League fixtures — extra mappings
  'fc porto':                 'fc-porto',
  'porto':                    'fc-porto',
  'sl benfica':               'benfica-lissabon',
  'benfica':                  'benfica-lissabon',
  'sporting cp':              'sporting-lissabon',
  'sporting clube de portugal': 'sporting-lissabon',
  'sporting lisbon':          'sporting-lissabon',
  'sc braga':                 'braga',
  'braga':                    'braga',
  'sporting de braga':        'braga',
  'vitória sc':               'vitoria-guimaraes',
  'vitoria sc':               'vitoria-guimaraes',
  'vitória guimarães':        'vitoria-guimaraes',
  'vitoria guimaraes':        'vitoria-guimaraes',
  'boavista fc':              'boavista',
  'boavista':                 'boavista',
  'moreirense fc':            'moreirense',
  'moreirense':               'moreirense',
  'fc famalicão':             'famalicao',
  'fc famalicao':             'famalicao',
  'famalicão':                'famalicao',
  'famalicao':                'famalicao',
  'casa pia ac':              'casa-pia',
  'casa pia':                 'casa-pia',
  'rio ave fc':               'rio-ave',
  'rio ave':                  'rio-ave',
  'cd nacional':              'nacional',
  'celtic fc':                'celtic-glasgow',
  'ajax':                     'ajax-amsterdam',
  'psv eindhoven':            'psv-eindhoven',
  'club brugge kv':           'fc-brugge',
  'galatasaray a.ş.':         'galatasaray-istanbul',
  'galatasaray':              'galatasaray-istanbul',
  'nottingham forest':        'nottingham-forest',
  'nottingham forest fc':     'nottingham-forest',
  // 🌎 LATAM (alta viralidad)
  'flamengo':                 'flamengo',
  'clube de regatas do flamengo': 'flamengo',
  'cr flamengo':              'flamengo',
  'corinthians':              'corinthians',
  'sport club corinthians paulista': 'corinthians',
  'palmeiras':                'se-palmeiras',
  'sociedade esportiva palmeiras': 'se-palmeiras',
  'fluminense':               'fluminense',
  'fluminense fc':            'fluminense',
  'botafogo':                 'botafogo',
  'botafogo de futebol e regatas': 'botafogo',
  'santos fc':                'santos',
  'santos':                   'santos',
  'sao paulo fc':             'sao-paulo-fc',
  'são paulo fc':             'sao-paulo-fc',
  'são paulo':                'sao-paulo-fc',
  'atletico mineiro':         'clube-atletico-mineiro',
  'clube atlético mineiro':   'clube-atletico-mineiro',
  'cruzeiro':                 'cruzeiro',
  'cruzeiro ec':              'cruzeiro',
  'boca juniors':             'boca-juniors',
  'club atlético boca juniors': 'boca-juniors',
  'river plate':              'river-plate',
  'club atlético river plate': 'river-plate',
  'racing club':              'racing-club',
  'independiente':            'independiente',
  'club atlético independiente': 'independiente',
  'san lorenzo':              'san-lorenzo',
  'velez sarsfield':          'velez-sarsfield',
  'club atlético vélez sarsfield': 'velez-sarsfield',
  'estudiantes':              'estudiantes',
  'talleres':                 'talleres-cordoba',
  'nacional':                 'nacional',
  'club nacional de football': 'nacional',
  'peñarol':                  'penarol',
  'club atlético peñarol':    'penarol',
  'colo-colo':                'colo-colo',
  // 🌎 Libertadores — equipos adicionales
  'always ready':             'always-ready',
  'sporting cristal':         'sporting-cristal',
  'club sporting cristal':    'sporting-cristal',
  'independiente medellín':   'independiente-medellin',
  'independiente medellin':   'independiente-medellin',
  'deportivo independiente medellín': 'independiente-medellin',
  'bolivar':                  'bolivar',
  'club bolivar':             'bolivar',
  'the strongest':            'strongest',
  'universitario de deportes': 'universitario',
  'universitario':            'universitario',
  'cerro porteño':            'cerro-porteno',
  'cerro porteno':            'cerro-porteno',
  'olimpia':                  'olimpia',
  'club olimpia':             'olimpia',
  'deportivo de la coruña':   'rc-deportivo',
  // 🌙 Nicho — Giants caídos
  'sampdoria':                'sampdoria',
  'u.c. sampdoria':           'sampdoria',
  'parma calcio 1913':        'parma',
  'parma':                    'parma',
  'as saint-étienne':         'as-saint-etienne',
  'saint-étienne':            'as-saint-etienne',
  'como 1907':                'como-1907',
  'wrexham afc':              'wrexham',
  'wrexham':                  'wrexham',
  // 🌍 Arabia — Saudi Pro League completa
  'al-hilal':                 'al-hilal',
  'al hilal':                 'al-hilal',
  'al-hilal saudi fc':        'al-hilal',
  'al nassr':                 'al-nassr',
  'al-nassr':                 'al-nassr',
  'al-nassr fc':              'al-nassr',
  'al ittihad':               'al-ittihad',
  'al-ittihad':               'al-ittihad',
  'al-ittihad jeddah':        'al-ittihad',
  'al ettifaq':               'al-ettifaq',
  'al-ettifaq':               'al-ettifaq',
  'al ettifaq fc':            'al-ettifaq',
  'al ahli':                  'al-ahli',
  'al-ahli':                  'al-ahli',
  'al-ahli jeddah':           'al-ahli',
  'al ahli jeddah':           'al-ahli',
  'al shabab':                'al-shabab',
  'al-shabab':                'al-shabab',
  'al shabab riyadh':         'al-shabab',
  'al fateh':                 'al-fateh',
  'al-fateh':                 'al-fateh',
  'al qadsiah':               'al-qadsiah',
  'al-qadsiah':               'al-qadsiah',
  'qadsiah fc':               'al-qadsiah',
  'al qadisiyah':             'al-qadisiyah-fc',
  'al-qadisiyah':             'al-qadisiyah-fc',
  'al-qadisiyah fc':          'al-qadisiyah-fc',
  'al taawoun':               'al-taawoun',
  'al-taawoun':               'al-taawoun',
  'al taawon':                'al-taawoun',
  'abha':                     'abha',
  'abha fc':                  'abha',
  'damac':                    'damac',
  'damac fc':                 'damac',
  'al fayha':                 'al-fayha',
  'al-fayha':                 'al-fayha',
  'al fayha fc':              'al-fayha',
  'al kholood':               'al-kholood',
  'al-kholood':               'al-kholood',
  'al najma':                 'al-najma',
  'al-najma':                 'al-najma',
  'neom':                     'neom',
  'neom sc':                  'neom',
  'neom fc':                  'neom',
  'damac fc':                 'damac',
  'al riyadh':                'al-riyadh',
  'al-riyadh':                'al-riyadh',
  'al riyadh fc':             'al-riyadh',
  'al okhdood':               'al-akhdood',
  'al-okhdood':               'al-akhdood',
  'al akhdood':               'al-akhdood',
  'al-akhdood':               'al-akhdood',
  'al hazm':                  'al-hazm',
  'al-hazm':                  'al-hazm',
  'al khaleej':               'al-khaleej',
  'al-khaleej':               'al-khaleej',
  // 🌏 Asia
  'persib bandung':           'persib-bandung',
  'persib':                   'persib-bandung',
  // 🇧🇷 Brasileirão — equipos adicionales
  'botafogo de futebol e regatas fr': 'botafogo',
  'club de regatas botafogo':  'botafogo',
  'grêmio':                   'gremio',
  'grêmio fbpa':              'gremio',
  'sport club internacional':  'sc-internacional',
  'internacional':             'sc-internacional',
  'vasco da gama':             'vasco-da-gama',
  'club de regatas vasco da gama': 'vasco-da-gama',
  'atletico-mg':               'clube-atletico-mineiro',
  'atlético-mg':               'clube-atletico-mineiro',
  'athletic club mineiro':     'clube-atletico-mineiro',
  'red bull bragantino':       'red-bull-bragantino',
  'rb bragantino':             'red-bull-bragantino',
  'red bull bragantino bc':    'red-bull-bragantino',
  'rbb bragantino':            'red-bull-bragantino',
  'bragantino':                'red-bull-bragantino',
  'athletico paranaense':      'athletico-paranaense',
  'athletico-paranaense':      'athletico-paranaense',
  'club athletico paranaense': 'athletico-paranaense',
  'atletico paranaense':       'athletico-paranaense',
  'ec bahia':                  'bahia',
  'bahia':                     'bahia',
  'esporte clube bahia':       'bahia',
  'fortaleza ec':              'fortaleza',
  'fortaleza':                 'fortaleza',
  'esporte clube fortaleza':   'fortaleza',
  'ec juventude':              'juventude',
  'juventude':                 'juventude',
  'cuiabá':                    'cuiaba',
  'cuiabá ec':                 'cuiaba',
  'atletico goianiense':       'atletico-goianiense',
  'atlético goianiense':       'atletico-goianiense',
  'ac goianiense':             'atletico-goianiense',
  'criciúma':                  'criciuma',
  'criciúma ec':               'criciuma',
  'criciuma ec':               'criciuma',
  'america mineiro':           'america-mg',
  'américa mineiro':           'america-mg',
  'america mg':                'america-mg',
  // 🇦🇷 Argentina — equipos adicionales
  'club atlético river plate': 'river-plate',
  'club atlético boca juniors':'boca-juniors',
  'club atlético independiente':'independiente',
  'club atlético san lorenzo': 'san-lorenzo',
  'san lorenzo de almagro':    'san-lorenzo',
  'club atlético vélez sarsfield': 'velez-sarsfield',
  'vélez sarsfield':           'velez-sarsfield',
  'club estudiantes de la plata': 'estudiantes',
  'club atlético talleres':    'talleres-cordoba',
  'club atlético talleres de córdoba': 'talleres-cordoba',
  'huracán':                   'huracan',
  'ca huracán':                'huracan',
  "newell's old boys":         'newells-old-boys',
  'newell s old boys':         'newells-old-boys',
  'newells old boys':          'newells-old-boys',
  'rosario central':           'rosario-central',
  'ca rosario central':        'rosario-central',
  'lanús':                     'lanus',
  'ca lanús':                  'lanus',
  'defensa y justicia':        'defensa-y-justicia',
  'belgrano':                  'belgrano',
  'ca belgrano':               'belgrano',
  'belgrano de córdoba':       'belgrano',
  'tigre':                     'tigre',
  'ca tigre':                  'tigre',
  'banfield':                  'banfield',
  'ca banfield':               'banfield',
  'godoy cruz':                'godoy-cruz',
  'godoy cruz antonio tomba':  'godoy-cruz',
  'platense':                  'platense',
  'ca platense':               'platense',
  'argentinos juniors':        'argentinos-juniors',
  'asociación atlética argentinos juniors': 'argentinos-juniors',
  'unión':                     'union-santa-fe',
  'union':                     'union-santa-fe',
  'unión santa fe':            'union-santa-fe',
  'atletico tucuman':          'atletico-tucuman',
  'atlético tucumán':          'atletico-tucuman',
  'ca atlético tucumán':       'atletico-tucuman',
  'sarmiento':                 'sarmiento',
  'ca sarmiento':              'sarmiento',
  'sarmiento junin':           'sarmiento',
  'central cordoba':           'central-cordoba',
  'central córdoba':           'central-cordoba',
  'central córdoba sde':       'central-cordoba',
  'deportivo riestra':         'deportivo-riestra',
  'riestra':                   'deportivo-riestra',
  'instituto':                 'instituto',
  'instituto ac':              'instituto',
  'instituto córdoba':         'instituto',
  'gimnasia mendoza':          'gimnasia-mendoza',
  'gimnasia y esgrima mendoza': 'gimnasia-mendoza',
  // Brasileirão nuevos
  'chapecoense':               'chapecoense',
  'associação chapecoense de futebol': 'chapecoense',
  'coritiba':                  'coritiba',
  'coritiba fc':               'coritiba',
  'mirassol':                  'mirassol',
  'mirassol fc':               'mirassol',
  'remo':                      'remo',
  'clube do remo':             'remo',
  'vitória':                   'vitoria',
  'vitoria':                   'vitoria',
  'ec vitória':                'vitoria',
};

// Competition priority (higher = more important)
const COMPETITION_PRIORITY = {
  'UEFA Champions League':    11,
  'UEFA Europa League':        7,
  'UEFA Conference League':    5,
  'Primera Division':         10,  // La Liga
  'Premier League':            9,
  'Copa Libertadores':         9,
  'Bundesliga':                8,
  'Serie A':                   8,
  'Ligue 1':                   7,
  'Championship':              3,
  'Copa del Rey':              6,
  'FA Cup':                    6,
  'DFB-Pokal':                 5,
  'Brasileirao Serie A':       6,
  'Argentine Primera':         6,
  'Saudi Pro League':          5,
};

// Current era mapping — what current season to use for each team
function getCurrentEra() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  // Football season: Aug-Dec = current year, Jan-Jul = previous year
  return String(month >= 8 ? year : year - 1);
}

function slugFromName(name) {
  const key = name.toLowerCase().trim();
  return TEAM_SLUG_MAP[key] || null;
}

function competitionPriority(compName) {
  for (const [k, v] of Object.entries(COMPETITION_PRIORITY)) {
    if (compName.includes(k)) return v;
  }
  return 1;
}

// ── Fetch today's matches — no API key needed ────────────────────────────────
// Source 1: TheSportsDB (free tier, key="3", no registration)
// Source 2: ESPN public API (no auth)

async function fetchFromTheSportsDB(dateStr) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateStr}&s=Soccer`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'node/golazox' } });
  if (!res.ok) throw new Error(`TheSportsDB ${res.status}`);
  const data = await res.json();
  const events = data.events || [];

  return events.map(e => ({
    homeTeam:    { name: e.strHomeTeam || '' },
    awayTeam:    { name: e.strAwayTeam || '' },
    competition: { name: e.strLeague   || '' },
    utcDate:     e.dateEvent + 'T' + (e.strTime || '00:00:00') + 'Z',
  }));
}

const ESPN_LEAGUES = [
  { id: 'uefa.champions',        name: 'UEFA Champions League',  priority: 11 },
  { id: 'esp.1',                 name: 'Primera Division',        priority: 10 },
  { id: 'eng.1',                 name: 'Premier League',          priority: 9  },
  { id: 'conmebol.libertadores', name: 'Copa Libertadores',       priority: 9  },
  { id: 'ger.1',                 name: 'Bundesliga',              priority: 8  },
  { id: 'ita.1',                 name: 'Serie A',                 priority: 8  },
  { id: 'fra.1',                 name: 'Ligue 1',                 priority: 7  },
  { id: 'uefa.europa',           name: 'UEFA Europa League',      priority: 7  },
  { id: 'bra.1',                 name: 'Brasileirao Serie A',     priority: 6  },
  { id: 'arg.1',                 name: 'Argentine Primera',       priority: 6  },
  { id: 'sau.1',                 name: 'Saudi Pro League',        priority: 5  },
];

async function fetchFromESPN(dateStr) {
  const d = dateStr.replace(/-/g, '');
  const matches = [];

  await Promise.all(ESPN_LEAGUES.map(async (league) => {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${d}`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'node/golazox' } });
      if (!res.ok) return;
      const data = await res.json();
      for (const ev of (data.events || [])) {
        const comp0 = ev.competitions?.[0] || {};
        const comps = comp0.competitors || [];
        const home  = comps.find(c => c.homeAway === 'home');
        const away  = comps.find(c => c.homeAway === 'away');
        if (!home || !away) continue;
        // Extract aggregate / first-leg note (e.g. "2nd Leg - Tied on aggregate")
        const aggNote = (comp0.notes || []).find(n => n.headline && /leg|aggregate/i.test(n.headline));
        matches.push({
          homeTeam:    { name: home.team?.displayName || '' },
          awayTeam:    { name: away.team?.displayName || '' },
          competition: { name: league.name },
          utcDate:     ev.date || dateStr,
          aggregate:   aggNote?.headline || null,
        });
      }
    } catch { /* skip league on error */ }
  }));

  return matches;
}

async function fetchTodayMatches(dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);

  // If football-data.org key is set, use it (most reliable)
  if (process.env.FOOTBALL_DATA_API_KEY) {
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;
    const res  = await fetch(url, { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY } });
    if (res.ok) {
      const data = await res.json();
      console.log('[daily] Fuente: football-data.org');
      return data.matches || [];
    }
  }

  // Fallback 1: ESPN (no auth needed)
  try {
    const espnMatches = await fetchFromESPN(date);
    if (espnMatches.length) {
      console.log(`[daily] Fuente: ESPN (${espnMatches.length} partidos)`);
      return espnMatches;
    }
  } catch (e) {
    console.warn('[daily] ESPN falló:', e.message);
  }

  // Fallback 2: TheSportsDB (no auth needed)
  try {
    const tsdbMatches = await fetchFromTheSportsDB(date);
    if (tsdbMatches.length) {
      console.log(`[daily] Fuente: TheSportsDB (${tsdbMatches.length} partidos)`);
      return tsdbMatches;
    }
  } catch (e) {
    console.warn('[daily] TheSportsDB falló:', e.message);
  }

  console.log('[daily] Ninguna fuente devolvió partidos.');
  return [];
}

// ── Pick best match that has both teams in our catalog ───────────────────────
function pickBestMatch(matches) {
  const era = getCurrentEra();
  const candidates = [];

  for (const m of matches) {
    const homeSlug = slugFromName(m.homeTeam?.name || '');
    const awaySlug = slugFromName(m.awayTeam?.name || '');
    if (!homeSlug || !awaySlug) continue;

    const priority = competitionPriority(m.competition?.name || '');
    candidates.push({
      homeSlug, awaySlug, era,
      homeName: m.homeTeam.name,
      awayName: m.awayTeam.name,
      competition: m.competition?.name || 'Partido del Día',
      utcDate: m.utcDate,
      aggregate: m.aggregate || null,
      priority,
    });
  }

  if (!candidates.length) return null;

  // Sort by priority desc
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0];
}

// ── Format title for video/upload ────────────────────────────────────────────
function formatTitle(match) {
  const homeShort = match.homeName.replace(/\s(FC|CF|SC|SV|AC|AS|RC|UD|RCD|FSV|TSG|VFL|VFB)$/i, '').trim();
  const awayShort = match.awayName.replace(/\s(FC|CF|SC|SV|AC|AS|RC|UD|RCD|FSV|TSG|VFL|VFB)$/i, '').trim();
  return `${homeShort} vs ${awayShort} | ${match.competition} | golazox.com`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function getDailyMatchVideo({ dryRun = false, date = null } = {}) {
  const matches = await fetchTodayMatches(date);
  console.log(`[daily] ${matches.length} partidos encontrados para ${date || 'hoy'}`);

  const best = pickBestMatch(matches);
  if (!best) {
    console.log('[daily] Ningún partido del día tiene ambos equipos en el catálogo.');
    console.log('[daily] Equipos no mapeados:', [...new Set(
      matches.flatMap(m => [m.homeTeam?.name, m.awayTeam?.name])
        .filter(n => n && !slugFromName(n))
    )].slice(0, 10).join(', '));
    return null;
  }

  const title = formatTitle(best);
  console.log(`[daily] ✓ Partido elegido: ${title}`);
  console.log(`[daily]   Slugs: ${best.homeSlug} (${best.era}) vs ${best.awaySlug} (${best.era})`);
  console.log(`[daily]   Prioridad: ${best.priority} | Hora UTC: ${best.utcDate}`);

  if (dryRun) {
    console.log('[daily] DRY RUN — no se genera video.');
    return { title, match: best };
  }

  const { generateVideo } = require('./video_generator');

  // Friendly display names for competitions
  const COMP_DISPLAY = {
    'Primera Division':       'La Liga',
    'UEFA Champions League':  'Champions League',
    'UEFA Europa League':     'Europa League',
    'UEFA Conference League': 'Conference League',
    'Copa Libertadores':      'Copa Libertadores',
    'Brasileirao Serie A':    'Brasileirao',
    'Argentine Primera':      'Primera División ARG',
    'Saudi Pro League':       'Saudi Pro League',
  };
  const compDisplay = COMP_DISPLAY[best.competition] || best.competition;

  // Format kick-off time + date in local CET (Spain) — e.g. "JUE 16 ABR · 21:00"
  const DAYS_ES  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  const MONTHS_ES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  let introSub = compDisplay;
  let kickoffDt = null;
  try {
    kickoffDt = new Date(best.utcDate);
    const madridOpts = { timeZone: 'Europe/Madrid' };
    const timeStr  = kickoffDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', ...madridOpts });
    const localDay = parseInt(kickoffDt.toLocaleDateString('es-ES', { day: 'numeric',   ...madridOpts }), 10);
    const localDow = parseInt(kickoffDt.toLocaleDateString('es-ES', { weekday: 'short', ...madridOpts }).slice(0,1) === '?' ? kickoffDt.getDay() : kickoffDt.toLocaleDateString('en-US', { weekday: 'short', ...madridOpts }).slice(0,100), 10);
    // simpler approach: convert to Madrid timezone via Intl
    const parts = new Intl.DateTimeFormat('en-US', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Europe/Madrid' }).formatToParts(kickoffDt);
    const dow   = parts.find(p=>p.type==='weekday')?.value || '';
    const dayN  = parseInt(parts.find(p=>p.type==='day')?.value || '0', 10);
    const monN  = parts.find(p=>p.type==='month')?.value || '';
    const MONTHS_MAP = {Jan:'ENE',Feb:'FEB',Mar:'MAR',Apr:'ABR',May:'MAY',Jun:'JUN',Jul:'JUL',Aug:'AGO',Sep:'SEP',Oct:'OCT',Nov:'NOV',Dec:'DIC'};
    const DAYS_MAP   = {Sun:'DOM',Mon:'LUN',Tue:'MAR',Wed:'MIÉ',Thu:'JUE',Fri:'VIE',Sat:'SÁB'};
    const dateLabel = `${DAYS_MAP[dow]||dow} ${dayN} ${MONTHS_MAP[monN]||monN}`;
    introSub = `${dateLabel} · ${timeStr}`;
  } catch { /* use competition name only */ }

  // Format aggregate / first-leg note in Spanish
  const formatAggregate = (agg) => {
    if (!agg) return null;
    const m2 = agg.match(/2nd Leg\s*[-–]\s*Tied on aggregate/i);
    if (m2) return '2ª Vuelta · Global igualado';
    const mLead = agg.match(/2nd Leg\s*[-–]\s*(.+?)\s+lead\s+(\d+[–-]\d+)\s+on aggregate/i);
    if (mLead) return `2ª Vuelta · ${mLead[1]} gana ${mLead[2].replace('-','–')} en el global`;
    const m1 = agg.match(/1st Leg/i);
    if (m1) return '1ª Vuelta';
    return agg;
  };
  const matchDescFormatted = formatAggregate(best.aggregate);

  // hookText: "¿QUIÉN PASA?" for knockout 2nd legs, else competition name
  const isSecondLeg = best.aggregate && /2nd leg/i.test(best.aggregate);
  const introTitle  = isSecondLeg ? '¿QUIÉN PASA?' : null;  // null → default "EL DEBATE DEFINITIVO"

  const result = await generateVideo({
    type:             'match',
    teamA:            best.homeSlug,
    eraA:             best.era,
    teamB:            best.awaySlug,
    eraB:             best.era,
    introTitle,                        // "¿QUIÉN PASA?" for 2nd legs
    introSub,                          // "JUE 16 ABR · 21:00"
    introCompetition:  compDisplay,    // shown as competition label in intro card
    matchDesc:         matchDescFormatted || null,  // "2ª Vuelta · Global igualado"
  });

  // Build a score-based title if the simulation produced a result
  let uploadTitle = title;
  const finalScore = result.matchMeta?.finalScore;
  if (finalScore && typeof finalScore.scoreA === 'number' && typeof finalScore.scoreB === 'number') {
    const homeShort = best.homeName.replace(/\s(FC|CF|SC|SV|AC|AS|RC|UD|RCD|FSV|TSG|VFL|VFB)$/i, '').trim();
    const awayShort = best.awayName.replace(/\s(FC|CF|SC|SV|AC|AS|RC|UD|RCD|FSV|TSG|VFL|VFB)$/i, '').trim();
    uploadTitle = `${homeShort} ${finalScore.scoreA}-${finalScore.scoreB} ${awayShort} | ${compDisplay} | golazox.com`;
    console.log(`[daily] Título con resultado: ${uploadTitle}`);
  }

  return { title: uploadTitle, path: result.path, match: best };
}

// ── Auto-cleanup old golazox_*.mp4 files ────────────────────────────────────
// Keeps the KEEP_LAST newest golazox_* videos; never removes intro_*, preview_*, or the just-uploaded file.
const VIDEOS_DIR = path.join(__dirname, 'videos');
const KEEP_LAST  = 3;

function cleanupOldVideos(keepPath = null) {
  try {
    const files = fsNode.readdirSync(VIDEOS_DIR)
      .filter(f => /^golazox_.*\.mp4$/i.test(f))
      .map(f => ({
        name: f,
        full: path.join(VIDEOS_DIR, f),
        mtime: fsNode.statSync(path.join(VIDEOS_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    const toDelete = files.slice(KEEP_LAST).filter(f => f.full !== keepPath);
    for (const f of toDelete) {
      try {
        fsNode.unlinkSync(f.full);
        console.log('[daily] Borrado:', f.name);
      } catch (e) {
        console.warn('[daily] No se pudo borrar', f.name, '—', e.message);
      }
    }
    if (toDelete.length === 0) console.log('[daily] cleanup: nada que borrar.');
  } catch (e) {
    console.warn('[daily] cleanupOldVideos error:', e.message);
  }
}

module.exports = { getDailyMatchVideo, fetchTodayMatches, pickBestMatch, TEAM_SLUG_MAP };

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args       = process.argv.slice(2);
  const dryRun     = args.includes('--dry-run');
  const autoUpload = !dryRun && (args.includes('--upload') || process.env.AUTO_UPLOAD === '1');
  const dateArg    = args.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/));

  getDailyMatchVideo({ dryRun, date: dateArg })
    .then(async r => {
      if (!r) { process.exit(0); return; }
      console.log('\n[daily] Done:', r.title);

      if (autoUpload && r.path) {
        console.log('[daily] AUTO_UPLOAD — uploading to YouTube...');
        const { uploadAll } = require('./uploader');
        await uploadAll({
          file:      r.path,
          title:     r.title,
          platforms: 'youtube',
          type:      'match',
        });
        cleanupOldVideos(r.path);
      }

      process.exit(0);
    })
    .catch(e => {
      console.error('[daily] ERROR:', e.message);
      process.exit(1);
    });
}
