'use strict';

/**
 * seed_squads.js — Pre-poblar la base de datos local de alineaciones
 * ════════════════════════════════════════════════════════════════════
 * Descarga alineaciones de Transfermarkt de forma controlada y las
 * guarda en squads/{slug}.json, evitando peticiones duplicadas y
 * bans por rate-limiting.
 *
 * USO:
 *   node seed_squads.js                     # Todo (salta los cacheados)
 *   node seed_squads.js --batch national    # Solo selecciones
 *   node seed_squads.js --batch clubs       # Solo clubes
 *   node seed_squads.js --batch winners     # Solo campeones WC/Euro/UCL
 *   node seed_squads.js --dry-run           # Vista previa sin descargar
 *   node seed_squads.js --delay 3000        # Delay entre peticiones (ms, default 2500)
 *   node seed_squads.js --team "Spain"      # Un equipo, todos sus años
 *   node seed_squads.js --from 50           # Reanudar desde el ítem Nº50
 *   node seed_squads.js --only-new          # Solo mostrar las descargas nuevas
 */

const path = require('path');
const fs   = require('fs');
const { fetchTransfermarktSquad, resolveClub, _loadTeamFile } = require('./transfermarkt');

// ── Parseo de argumentos ───────────────────────────────────────
const args     = process.argv.slice(2);
const getArg   = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null; };
const hasFlag  = (f) => args.includes(f);

const DRY_RUN  = hasFlag('--dry-run');
const DELAY    = parseInt(getArg('--delay')   || '2500', 10);
const BATCH    = getArg('--batch')            || 'all';
const ONLY_TEAM= getArg('--team');
const FROM     = parseInt(getArg('--from')    || '0', 10);
const ONLY_NEW = hasFlag('--only-new');

// ── Años por competición ───────────────────────────────────────
// (año de inicio de temporada, ej. 2010 = temporada 2010/11)
const WORLD_CUPS    = [1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022,2025];
const EUROS         = [1996,2000,2004,2008,2012,2016,2020,2025];
const COPA_AMERICA  = [1975,1979,1983,1987,1991,1993,1995,1997,1999,2001,2004,2007,2011,2015,2016,2019,2021,2025];
const AFCON         = [1994,1996,1998,2000,2002,2004,2006,2008,2010,2012,2013,2015,2017,2019,2021,2023,2025];

const uniq = (...arrs) => [...new Set(arrs.flat())].sort((a, b) => a - b);

// ── Catálogo de selecciones ────────────────────────────────────
const NATIONAL_TEAMS = [
  // ── Europa ── Mundial + Eurocopa
  ...['spain','germany','france','italy','england','netherlands','portugal',
      'belgium','croatia','czech republic','russia','poland','denmark',
      'sweden','switzerland','austria','scotland','wales','turkey','greece',
      'serbia','romania','hungary','slovakia','slovenia','iceland','ireland',
      'northern ireland','ukraine','norway','finland','albania','bosnia'].map(t => ({
    team: t,
    years: uniq(WORLD_CUPS, EUROS),
    region: 'Europa',
  })),

  // ── América ── Mundial + Copa América
  ...['argentina','brasil','uruguay','colombia','chile','ecuador','peru',
      'paraguay','venezuela','mexico','usa','costa rica','canada'].map(t => ({
    team: t,
    years: uniq(WORLD_CUPS, COPA_AMERICA),
    region: 'América',
  })),

  // ── África ── Mundial + Copa África
  ...['senegal','cameroon','ghana','nigeria','morocco','egypt',
      'ivory coast','south africa','algeria','tunisia','mali'].map(t => ({
    team: t,
    years: uniq(WORLD_CUPS, AFCON),
    region: 'África',
  })),

  // ── Asia / Oceanía ── Mundial
  ...['japan','south korea','australia','saudi arabia','iran',
      'china','iraq','jordan','uzbekistan','new zealand'].map(t => ({
    team: t,
    years: WORLD_CUPS,
    region: 'Asia/Oceanía',
  })),
];

// ── Catálogo de clubes (eras míticas) ─────────────────────────
const CLUB_TEAMS = [
  // España
  { team: 'Real Madrid',     years: [1956,1960,1966,1976,1980,1986,1998,2002,2006,2012,2013,2014,2015,2016,2017,2022,2024,2025], region: 'La Liga' },
  { team: 'Barcelona',       years: [1985,1992,1995,1999,2006,2009,2010,2011,2014,2015,2023,2025],                               region: 'La Liga' },
  { team: 'Atletico Madrid', years: [1974,1996,2004,2012,2013,2015,2016,2020,2021,2022,2025],                                    region: 'La Liga' },
  { team: 'Valencia',        years: [1999,2000,2001,2003],                                                                       region: 'La Liga' },
  { team: 'Deportivo',       years: [1999,2000,2003],                                                                            region: 'La Liga' },
  { team: 'Sevilla',         years: [2006,2015,2016,2020,2022,2023,2025],                                                        region: 'La Liga' },
  { team: 'Villarreal',      years: [2005,2021,2025],                                                                            region: 'La Liga' },

  // Italia
  { team: 'Juventus',        years: [1983,1985,1995,1996,1997,2002,2012,2015,2017,2018,2019,2020,2021,2023,2025],                region: 'Serie A' },
  { team: 'AC Milan',        years: [1988,1989,1993,1994,2002,2006,2022,2025],                                                   region: 'Serie A' },
  { team: 'Inter Milan',     years: [1964,1965,1988,1989,2004,2009,2010,2021,2023,2024,2025],                                    region: 'Serie A' },
  { team: 'Roma',            years: [2001,2006,2021,2022,2023,2024,2025],                                                        region: 'Serie A' },
  { team: 'Napoli',          years: [1986,1987,1988,2017,2022,2023,2025],                                                        region: 'Serie A' },
  { team: 'Lazio',           years: [1998,2000,2013,2025],                                                                       region: 'Serie A' },
  { team: 'Atalanta',        years: [2019,2024,2025],                                                                            region: 'Serie A' },
  { team: 'Fiorentina',      years: [1969,1999,2023,2025],                                                                       region: 'Serie A' },

  // Alemania
  { team: 'Bayern Munich',   years: [1974,1975,1976,1999,2000,2001,2012,2013,2019,2020,2023,2025],                               region: 'Bundesliga' },
  { team: 'Borussia Dortmund', years: [1996,1997,2011,2012,2019,2021,2022,2023,2024,2025],                                       region: 'Bundesliga' },
  { team: 'Bayer Leverkusen', years: [2002,2023,2024,2025],                                                                      region: 'Bundesliga' },
  { team: 'RB Leipzig',       years: [2020,2022,2025],                                                                           region: 'Bundesliga' },
  { team: 'Eintracht Frankfurt', years: [2022,2025],                                                                             region: 'Bundesliga' },

  // Inglaterra
  { team: 'Manchester United', years: [1994,1998,1999,2002,2007,2008,2025],                                                      region: 'Premier League' },
  { team: 'Arsenal',           years: [2001,2002,2003,2004,2023,2024,2025],                                                      region: 'Premier League' },
  { team: 'Liverpool',         years: [1977,1978,1984,2004,2008,2019,2025],                                                      region: 'Premier League' },
  { team: 'Chelsea',           years: [2004,2005,2011,2014,2021,2022,2023,2025],                                                  region: 'Premier League' },
  { team: 'Manchester City',   years: [2011,2012,2018,2019,2021,2022,2023,2025],                                                  region: 'Premier League' },
  { team: 'Tottenham Hotspur', years: [2017,2018,2019,2025],                                                                     region: 'Premier League' },
  { team: 'Aston Villa',       years: [1982,2019,2024,2025],                                                                     region: 'Premier League' },
  { team: 'Newcastle United',  years: [1996,1997,2023,2025],                                                                     region: 'Premier League' },

  // Francia
  { team: 'Paris Saint-Germain', years: [2012,2015,2016,2019,2020,2021,2022,2023,2025],                                          region: 'Ligue 1' },
  { team: 'Lyon',               years: [2004,2005,2006,2007,2008,2025],                                                          region: 'Ligue 1' },
  { team: 'Marseille',          years: [1992,1993,2020,2025],                                                                    region: 'Ligue 1' },
  { team: 'Monaco',             years: [2003,2016,2017,2025],                                                                    region: 'Ligue 1' },
  { team: 'Lille',              years: [2020,2025],                                                                              region: 'Ligue 1' },

  // Países Bajos
  { team: 'Ajax',               years: [1971,1972,1973,1994,1995,2018,2019,2025],                                                region: 'Eredivisie' },
  { team: 'PSV',                years: [1987,1988,1991,1997,2005,2006,2023,2025],                                                 region: 'Eredivisie' },
  { team: 'Feyenoord',          years: [1969,1982,2001,2016,2023,2025],                                                          region: 'Eredivisie' },

  // Portugal
  { team: 'Porto',              years: [1987,1994,2003,2004,2011,2025],                                                          region: 'Primeira Liga' },
  { team: 'Benfica',            years: [1961,1962,1987,2014,2015,2022,2023,2025],                                                region: 'Primeira Liga' },
  { team: 'Sporting CP',        years: [1999,2001,2021,2022,2025],                                                               region: 'Primeira Liga' },
  { team: 'Braga',              years: [2021,2025],                                                                              region: 'Primeira Liga' },

  // Escocia
  { team: 'Celtic',             years: [1967,1969,1970,2019,2022,2025],                                                          region: 'Escocia' },
  { team: 'Rangers',            years: [2021,2022,2025],                                                                         region: 'Escocia' },
];

// ── Selecciones confirmadas / probables para el Mundial 2026 (48 equipos) ─────
// Solo descargamos la plantilla actual (temporada 2025/26 = año 2025)
const WC2026_NATIONAL = [
  // UEFA (16 clasificados directos + playoffs)
  ...['spain','germany','france','italy','england','netherlands','portugal',
      'belgium','croatia','czech republic','poland','denmark','sweden',
      'switzerland','austria','scotland','wales','turkey','serbia','ukraine',
      'romania','hungary','slovakia','slovenia','albania','norway','finland',
      'greece','ireland','northern ireland','russia','iceland','bosnia'].map(t => ({
    team: t, years: [2025], region: 'WC 2026 – UEFA',
  })),
  // CONMEBOL (6 + playoff)
  ...['argentina','brasil','uruguay','colombia','chile','ecuador',
      'paraguay','peru','venezuela','bolivia'].map(t => ({
    team: t, years: [2025], region: 'WC 2026 – CONMEBOL',
  })),
  // CONCACAF (6 + playoff)
  ...['usa','mexico','canada','costa rica','panama','honduras',
      'jamaica','el salvador','haiti','trinidad and tobago'].map(t => ({
    team: t, years: [2025], region: 'WC 2026 – CONCACAF',
  })),
  // CAF (9 + playoff)
  ...['morocco','senegal','nigeria','egypt','ivory coast','ghana',
      'cameroon','tunisia','mali','algeria','south africa',
      'democratic republic of congo','cape verde'].map(t => ({
    team: t, years: [2025], region: 'WC 2026 – CAF',
  })),
  // AFC (8.5 + playoff)
  ...['japan','south korea','iran','saudi arabia','australia',
      'china','iraq','jordan','uzbekistan','oman','bahrain','north korea'].map(t => ({
    team: t, years: [2025], region: 'WC 2026 – AFC',
  })),
  // OFC
  { team: 'new zealand', years: [2025], region: 'WC 2026 – OFC' },
];

// ── Solo campeones (modo --batch winners) ─────────────────────
// Selecciones: solo el año en que ganaron el Mundial o la Eurocopa
// Clubes: solo el año en que ganaron la Champions League
const WINNERS_TEAMS = [
  // ── Selecciones campeonas del MUNDO ──────────────────────────
  { team: 'england',    years: [1966],                       region: 'WC winner' },
  { team: 'brasil',     years: [1970,1994,2002],             region: 'WC winner' },
  { team: 'germany',    years: [1974,1990,2014],             region: 'WC winner' },
  { team: 'argentina',  years: [1978,1986,2022],             region: 'WC winner' },
  { team: 'italy',      years: [1982,2006],                  region: 'WC winner' },
  { team: 'france',     years: [1998,2018],                  region: 'WC winner' },
  { team: 'spain',      years: [2010],                       region: 'WC winner' },

  // ── Selecciones campeonas de EUROCOPA ─────────────────────────
  { team: 'spain',      years: [2008,2012,2024],             region: 'Euro winner' },
  { team: 'germany',    years: [1972,1980,1996],             region: 'Euro winner' },
  { team: 'france',     years: [1984,2000],                  region: 'Euro winner' },
  { team: 'italy',      years: [1968,2021],                  region: 'Euro winner' },
  { team: 'netherlands',years: [1988],                       region: 'Euro winner' },
  { team: 'denmark',    years: [1992],                       region: 'Euro winner' },
  { team: 'greece',     years: [2004],                       region: 'Euro winner' },
  { team: 'portugal',   years: [2016],                       region: 'Euro winner' },

  // ── Clubes campeones de CHAMPIONS LEAGUE ─────────────────────
  { team: 'Real Madrid',          years: [1956,1957,1958,1959,1966,1998,2000,2002,2014,2016,2017,2018,2022,2024], region: 'UCL winner' },
  { team: 'AC Milan',             years: [1963,1969,1989,1990,1994,2003,2007],           region: 'UCL winner' },
  { team: 'Bayern Munich',        years: [1974,1975,1976,2001,2013,2020],                region: 'UCL winner' },
  { team: 'Liverpool',            years: [1977,1978,1981,1984,2005,2019],                region: 'UCL winner' },
  { team: 'Barcelona',            years: [1992,2006,2009,2011,2015],                     region: 'UCL winner' },
  { team: 'Ajax',                 years: [1971,1972,1973,1995],                          region: 'UCL winner' },
  { team: 'Inter Milan',          years: [1964,1965,2010],                               region: 'UCL winner' },
  { team: 'Manchester United',    years: [1968,1999,2008],                               region: 'UCL winner' },
  { team: 'Juventus',             years: [1985,1996],                                    region: 'UCL winner' },
  { team: 'Borussia Dortmund',    years: [1997],                                         region: 'UCL winner' },
  { team: 'Porto',                years: [1987,2004],                                    region: 'UCL winner' },
  { team: 'Chelsea',              years: [2012,2021],                                    region: 'UCL winner' },
  { team: 'Manchester City',      years: [2023],                                         region: 'UCL winner' },
  { team: 'Benfica',              years: [1961,1962],                                    region: 'UCL winner' },
  { team: 'Marseille',            years: [1993],                                         region: 'UCL winner' },
  { team: 'PSV',                  years: [1988],                                         region: 'UCL winner' },
  { team: 'Nottingham Forest',    years: [1979,1980],                                    region: 'UCL winner' },
  { team: 'Aston Villa',          years: [1982],                                         region: 'UCL winner' },
  { team: 'Feyenoord',            years: [1970],                                         region: 'UCL winner' },
  { team: 'Celtic',               years: [1967],                                         region: 'UCL winner' },
];

// ── Clubes adicionales: ligas actuales + Saudi + MLS + LatAm ──
const CY = [2025]; // temporada actual 2025/26
const EXTRA_CLUBS = [

  // ══ SAUDI PRO LEAGUE ═══════════════════════════════════════════
  // 2025 actual + 2023 (la era de los superestrellas)
  { team: 'Al-Hilal',   years: [2023, 2025], region: 'Saudi Pro League' }, // Neymar, Milinkovic-Savic, Malcom
  { team: 'Al-Nassr',   years: [2023, 2025], region: 'Saudi Pro League' }, // Cristiano Ronaldo
  { team: 'Al-Ittihad', years: [2023, 2025], region: 'Saudi Pro League' }, // Benzema, Kanté, Fabinho
  { team: 'Al-Ahli',    years: [2023, 2025], region: 'Saudi Pro League' }, // Mahrez, Firmino, Mendy
  { team: 'Al-Ettifaq', years: [2023, 2025], region: 'Saudi Pro League' }, // Henderson, Mané
  { team: 'Al-Qadsiah', years: CY,           region: 'Saudi Pro League' },
  { team: 'Al-Shabab',  years: CY,           region: 'Saudi Pro League' },

  // ══ MLS ════════════════════════════════════════════════════════
  { team: 'LA Galaxy',             years: [2011, 2025], region: 'MLS' }, // Beckham, Keane, Donovan
  { team: 'Inter Miami',           years: [2023, 2025], region: 'MLS' }, // Messi, Suárez, Busquets, Alba
  { team: 'LAFC',                  years: [2022, 2025], region: 'MLS' }, // Gareth Bale, Vela, MLS Cup
  { team: 'Atlanta United',        years: [2018, 2025], region: 'MLS' }, // Almirón, Martínez, MLS Cup
  { team: 'Seattle Sounders',      years: [2016, 2025], region: 'MLS' }, // Dempsey + MLS Cup
  { team: 'Columbus Crew',         years: [2020, 2025], region: 'MLS' }, // MLS Cup
  { team: 'Sporting Kansas City',  years: [2013, 2025], region: 'MLS' }, // MLS Cup
  { team: 'New York City FC',      years: [2021, 2025], region: 'MLS' }, // MLS Cup
  { team: 'Portland Timbers',      years: [2015, 2025], region: 'MLS' }, // MLS Cup
  { team: 'New York Red Bulls',    years: [2008, 2025], region: 'MLS' }, // Thierry Henry
  { team: 'New England Revolution',years: CY,           region: 'MLS' },

  // ══ PREMIER LEAGUE ════════════════════════════════════════════
  ...['Tottenham Hotspur','Everton','Newcastle United','West Ham United',
      'Fulham','Crystal Palace','Brentford','Bournemouth','Brighton',
      'Wolverhampton Wanderers','Leicester City','Leeds United',
      'Burnley','Sheffield United','Watford'].map(t => ({ team: t, years: CY, region: 'Premier League' })),

  // ══ BUNDESLIGA ════════════════════════════════════════════════
  ...['RB Leipzig','Eintracht Frankfurt','Wolfsburg','Union Berlin',
      'Freiburg','Hoffenheim','Mainz 05','Augsburg','Werder Bremen'].map(t => ({ team: t, years: CY, region: 'Bundesliga' })),

  // ══ SERIE A ═══════════════════════════════════════════════════
  ...['Lazio','Atalanta','Fiorentina','Torino',
      'Bologna','Monza','Hellas Verona','Udinese'].map(t => ({ team: t, years: CY, region: 'Serie A' })),

  // ══ LIGUE 1 ═══════════════════════════════════════════════════
  ...['Lens','Rennes','Toulouse','Lille','Nice','Monaco','Marseille','Lyon',
      'Brest','Montpellier'].map(t => ({ team: t, years: CY, region: 'Ligue 1' })),

  // ══ LA LIGA ═══════════════════════════════════════════════════
  ...['Villarreal','Celta Vigo','Osasuna','Mallorca','Espanyol','Girona',
      'Athletic Bilbao','Real Sociedad','Real Betis',
      'Sevilla','Rayo Vallecano','Valencia','Alavés','Getafe',
      'Leganés','Real Valladolid'].map(t => ({ team: t, years: CY, region: 'La Liga' })),

  // ══ UCL PARTICIPANTES ═════════════════════════════════════════
  ...['Galatasaray','Red Bull Salzburg','Shakhtar Donetsk',
      'Braga','Dinamo Zagreb','Young Boys','FC Copenhagen',
      'Rangers','Club Brugge'].map(t => ({ team: t, years: CY, region: 'UCL recent' })),

  // ══ SUDAMÉRICA ════════════════════════════════════════════════
  { team: 'Boca Juniors',      years: [2000,2003,2007,2025],       region: 'Argentina' },   // Libertadores winners
  { team: 'River Plate',       years: [1996,2015,2018,2025],       region: 'Argentina' },   // Libertadores winners
  { team: 'Flamengo',          years: [1981,2019,2022,2025],       region: 'Brasil' },       // Libertadores winners
  { team: 'Palmeiras',         years: [2020,2021,2025],            region: 'Brasil' },       // Libertadores winners
  { team: 'Fluminense',        years: [2023,2025],                 region: 'Brasil' },       // Libertadores winners
  { team: 'Corinthians',       years: [2012,2025],                 region: 'Brasil' },       // Libertadores + Brasileirao
  { team: 'Atletico Mineiro',  years: [2021,2025],                 region: 'Brasil' },       // Libertadores winner
  { team: 'Sao Paulo FC',      years: [1992,1993,2005,2025],       region: 'Brasil' },
  { team: 'Santos FC',         years: [1962,1963,2011,2025],       region: 'Brasil' },       // Pelé + Neymar eras
  { team: 'Internacional',     years: [2006,2010,2025],            region: 'Brasil' },
  { team: 'Estudiantes',       years: [2009,2025],                 region: 'Argentina' },
  { team: 'Racing Club',       years: [2001,2014,2025],            region: 'Argentina' },
  { team: 'San Lorenzo',       years: [2014,2025],                 region: 'Argentina' },

  // ══ LIGA MX ═══════════════════════════════════════════════════
  { team: 'Tigres UANL',       years: [2015,2016,2020,2025],       region: 'Liga MX' },      // Libertadores final 2020
  { team: 'Monterrey',         years: [2011,2012,2019,2025],       region: 'Liga MX' },
  { team: 'Guadalajara',       years: [2006,2017,2025],            region: 'Liga MX' },
  { team: 'Cruz Azul',         years: [2021,2025],                 region: 'Liga MX' },
  { team: 'Club America',      years: [2014,2018,2024,2025],       region: 'Liga MX' },
  { team: 'Pumas UNAM',        years: [2004,2025],                 region: 'Liga MX' },
  { team: 'Pachuca',           years: [2007,2025],                 region: 'Liga MX' },      // Champions Cup
  { team: 'Toluca',            years: [2002,2025],                 region: 'Liga MX' },

  // ══ TÜRKIYE SÜPER LIG ════════════════════════════════════════
  { team: 'Galatasaray',       years: [2000,2002,2012,2019,2023,2025], region: 'Süper Lig' }, // UCL win 2000 + recent titles
  { team: 'Fenerbahce',        years: [2005,2007,2014,2023,2025],  region: 'Süper Lig' },
  { team: 'Besiktas',          years: [2003,2009,2017,2021,2025],  region: 'Süper Lig' },
  { team: 'Trabzonspor',       years: [2022,2025],                 region: 'Süper Lig' },    // Şampiyonluk 2022

  // ══ GREEK SUPER LEAGUE ═══════════════════════════════════════
  { team: 'Olympiacos',        years: [1999,2000,2025],            region: 'Super League Grecia' },
  { team: 'PAOK',              years: [2019,2025],                 region: 'Super League Grecia' },
  { team: 'Panathinaikos',     years: [2025],                      region: 'Super League Grecia' },
  { team: 'AEK Athens',        years: [2018,2023,2025],            region: 'Super League Grecia' },

  // ══ BELGIAN PRO LEAGUE ═══════════════════════════════════════
  { team: 'Anderlecht',        years: [1976,1978,2012,2017,2025],  region: 'Pro League Bélgica' },
  { team: 'Standard Liege',    years: [2008,2009,2025],            region: 'Pro League Bélgica' },
  { team: 'Genk',              years: [2002,2011,2019,2025],       region: 'Pro League Bélgica' },
  { team: 'Club Brugge',       years: [2018,2020,2022,2025],       region: 'Pro League Bélgica' }, // UCL group stage regulars
  { team: 'Union Saint Gilloise', years: [2022,2023,2025],         region: 'Pro League Bélgica' },

  // ══ AUSTRIAN BUNDESLIGA ══════════════════════════════════════
  { team: 'Red Bull Salzburg', years: [2018,2019,2020,2022,2025],  region: 'Bundesliga Austria' },
  { team: 'Rapid Vienna',      years: [1996,2005,2025],            region: 'Bundesliga Austria' },
  { team: 'Austria Vienna',    years: [2006,2013,2025],            region: 'Bundesliga Austria' },
  { team: 'LASK',              years: [2020,2025],                 region: 'Bundesliga Austria' },

  // ══ OTHER EUROPEAN ═══════════════════════════════════════════
  { team: 'Dynamo Kyiv',       years: [1999,2000,2016,2025],       region: 'UPL Ucrania' },
  { team: 'Shakhtar Donetsk',  years: [2009,2012,2021,2025],       region: 'UPL Ucrania' },  // UCL winner 2009
  { team: 'Dinamo Zagreb',     years: [2019,2022,2025],            region: 'HNL Croacia' },
  { team: 'Spartak Moscow',    years: [1995,2001,2017,2025],       region: 'RPL Rusia' },
  { team: 'Young Boys',        years: [2018,2021,2025],            region: 'Super League Suiza' },
  { team: 'FC Copenhagen',     years: [2006,2023,2025],            region: 'Superliga Dinamarca' },
  { team: 'Sporting Kansas City', years: [2013,2025],              region: 'MLS' },  // duplicate-safe, seeder skips cached
];

// ── Construir cola de descargas ────────────────────────────────
function buildQueue() {
  let catalog = [];

  // Clubs first: easier to verify, not rate-limited as aggressively
  if (BATCH === 'clubs'    || BATCH === 'all') catalog.push(...CLUB_TEAMS, ...EXTRA_CLUBS);
  if (BATCH === 'national' || BATCH === 'all') catalog.push(...NATIONAL_TEAMS);
  if (BATCH === 'winners')                     catalog.push(...WINNERS_TEAMS);
  if (BATCH === 'extra')                       catalog.push(...EXTRA_CLUBS);
  if (BATCH === 'wc2026')                      catalog.push(...WC2026_NATIONAL);
  // --batch expand: solo CLUB_TEAMS (incluye mejoras recientes) sin selecciones nacionales
  if (BATCH === 'expand')                      catalog.push(...CLUB_TEAMS, ...EXTRA_CLUBS);

  if (ONLY_TEAM) {
    const key = ONLY_TEAM.toLowerCase();
    catalog = catalog.filter(c => c.team.toLowerCase() === key);
  }

  const queue = [];
  for (const { team, years, region } of catalog) {
    for (const year of years) {
      queue.push({ team, year: String(year), region: region || '' });
    }
  }
  return queue;
}

// ── Utilidades ────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Pausa caótica que simula lectura humana: base ±40% + pico ocasional de 10-20s
function humanDelay(baseMs) {
  const jitter = baseMs * 0.4;
  const delay  = baseMs - jitter + Math.random() * jitter * 2; // ±40%
  // 1 de cada 8 peticiones → pausa larga de "lectura" (10-20s)
  const longPause = Math.random() < 0.125 ? 10000 + Math.random() * 10000 : 0;
  return Math.round(delay + longPause);
}

function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function eta(done, total, elapsedMs, downloadsOnly) {
  if (downloadsOnly === 0) return '?';
  // ETA based on actual download time only (cached items are instant)
  const msPerDownload = elapsedMs / Math.max(downloadsOnly, 1);
  const remaining = (total - done);
  return formatTime(msPerDownload * remaining * 0.3); // rough estimate
}

// ── Comprobar si ya está en caché sin hacer petición de red ───
const SQUADS_DIR = path.join(__dirname, 'squads');

function isCachedLocally(team, year) {
  const club = resolveClub(team);
  const slug = club?.slug || team.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const data = _loadTeamFile(slug);
  return !!(data.seasons && data.seasons[String(year)]);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const queue = buildQueue();
  const total  = queue.length;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         ⚽  Squad Seeder — Base de datos local           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Batch:   ${BATCH}  |  Delay: ${DELAY}ms  |  Dry-run: ${DRY_RUN}`);
  if (ONLY_TEAM) console.log(`  Equipo:  "${ONLY_TEAM}"`);
  if (FROM > 0)  console.log(`  Desde:   ítem #${FROM}`);
  console.log(`  Total:   ${total} combinaciones equipo+año en cola`);
  console.log('─'.repeat(62));

  if (DRY_RUN) {
    const byRegion = {};
    for (const { team, year, region } of queue) {
      (byRegion[region] = byRegion[region] || []).push(`${team} ${year}`);
    }
    for (const [reg, items] of Object.entries(byRegion)) {
      console.log(`\n  📍 ${reg} (${items.length} combos):`);
      // Show unique teams
      const teams = [...new Set(items.map(i => i.split(' ')[0]))];
      console.log('    ' + teams.join(', '));
    }
    console.log(`\n  Total: ${total} descargas posibles (las cacheadas serán ≈ 0ms)`);
    return;
  }

  let downloaded = 0, cached = 0, failed = 0, skipped = 0;
  const startTime = Date.now();
  let lastRegion  = '';
  let consecutiveFails = 0; // track rate-limiting
  const PROGRESS_FILE = path.join(SQUADS_DIR, '.seed-progress.json');

  function writeProgress(i, currentTeam, currentYear) {
    try {
      const elapsed = Date.now() - startTime;
      const done = i + 1;
      const remaining = total - done;
      const msPerDl = downloaded > 0 ? elapsed / downloaded : DELAY;
      const etaSec  = Math.round((remaining * msPerDl) / 1000);
      const etaStr  = etaSec > 3600
        ? `${Math.floor(etaSec/3600)}h ${Math.floor((etaSec%3600)/60)}m`
        : etaSec > 60 ? `${Math.floor(etaSec/60)}m ${etaSec%60}s` : `${etaSec}s`;
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        progreso: `${done}/${total}`,
        porcentaje: `${Math.round((done/total)*100)}%`,
        descargados: downloaded,
        enCache:     cached,
        sinDatos:    failed,
        ahora:       `${currentTeam} ${currentYear}`,
        tiempoTranscurrido: formatTime(elapsed),
        etaRestante: etaStr,
        ultimaActualizacion: new Date().toISOString(),
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  for (let i = 0; i < total; i++) {
    if (i < FROM) { skipped++; continue; }

    const { team, year, region } = queue[i];
    const num    = String(i + 1).padStart(4);
    const pct    = String(Math.round(((i + 1) / total) * 100)).padStart(3);

    // Print region header when it changes
    if (region !== lastRegion) {
      console.log(`\n  📍 ${region}`);
      lastRegion = region;
    }

    // Skip instantly if already on disk — no network call at all
    if (isCachedLocally(team, year)) {
      cached++;
      if (!ONLY_NEW) console.log(`  [${num}/${total}] ${pct}%  💾  ${team.padEnd(22)} ${year}  (en caché)`);
      continue;
    }

    try {
      const t0     = Date.now();
      const result = await fetchTransfermarktSquad(team, year);
      const ms     = Date.now() - t0;

      if (!result) {
        if (!ONLY_NEW) console.log(`  [${num}/${total}] ${pct}%  ⬛  ${team.padEnd(22)} ${year}  — sin datos TM`);
        failed++;
        consecutiveFails++;

        // If we get ≥10 consecutive failures, TM is almost certainly blocking us — abort
        if (consecutiveFails >= 10) {
          console.log(`\n  🚫  ${consecutiveFails} fallos seguidos — TM está bloqueando la IP. Abortando.`);
          console.log(`  💡  Espera unas horas y vuelve a lanzar con --only-new para reanudar.`);
          process.exit(1);
        }

        // Back-off: avoid hammering TM when it's blocking us
        if (consecutiveFails >= 5 && consecutiveFails % 5 === 0) {
          const backoff = Math.min(consecutiveFails * 500, 10000); // up to 10s
          console.log(`  ⚠️  ${consecutiveFails} fallos consecutivos — pausa de ${backoff}ms`);
          await sleep(humanDelay(backoff));
        } else {
          await sleep(humanDelay(800)); // short delay even on failures
        }

      } else {
        // Real network download — show GK for spot-checking
        consecutiveFails = 0; // reset on success
        downloaded++;
        const gk     = result.players.find(p => p.position === 'GK');
        const gkName = gk ? gk.name : '(sin GK?)';
        const total2 = result.players.length;
        const actualDelay = humanDelay(DELAY);
        console.log(`  [${num}/${total}] ${pct}%  ⬇️   ${team.padEnd(22)} ${year}  ${result.formation}  ${total2}j  GK: ${gkName}  (${ms}ms, espera ~${Math.round(actualDelay/1000)}s)`);
        // Only throttle after actual network requests
        await sleep(actualDelay);
      }

    } catch (e) {
      console.log(`  [${num}/${total}] ${pct}%  ❌  ${team.padEnd(22)} ${year}  ERROR: ${e.message}`);
      failed++;
      await sleep(humanDelay(DELAY)); // wait even after errors
    }

    // Write progress file every 5 items
    if (i % 5 === 0) writeProgress(i, team, year);

    // Progress summary every 50 items
    if ((i + 1) % 50 === 0) {
      const elapsed = Date.now() - startTime;
      console.log(`\n  ┄ Progreso: ${downloaded} descargados | ${cached} en caché | ${failed} sin datos | ${formatTime(elapsed)} transcurrido\n`);
    }
  }
  writeProgress(total - 1, 'COMPLETADO', '');

  // ── Resumen final ────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  console.log('\n' + '═'.repeat(62));
  console.log(`  ✅  Completado en ${formatTime(totalMs)}`);
  console.log(`  ⬇️   Nuevas descargas:  ${downloaded}`);
  console.log(`  💾  En caché local:    ${cached}`);
  console.log(`  ⬛  Sin datos en TM:   ${failed}`);
  if (skipped) console.log(`  ⏩  Saltados (--from): ${skipped}`);

  // squads/ summary
  if (fs.existsSync(SQUADS_DIR)) {
    const files = fs.readdirSync(SQUADS_DIR).filter(f => f.endsWith('.json'));
    let totalSeasons = 0;
    const teamList   = [];
    files.forEach(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(SQUADS_DIR, f), 'utf8'));
        const n = Object.keys(d.seasons || {}).length;
        totalSeasons += n;
        if (n > 0) teamList.push(`${d.name || d.slug} (${n})`);
      } catch (_) {}
    });
    console.log(`\n  📁 squads/: ${files.length} equipos, ${totalSeasons} temporadas en disco`);
    console.log('  ' + teamList.sort().join(' · '));
  }
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
