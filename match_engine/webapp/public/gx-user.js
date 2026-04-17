/**
 * gx-user.js — GolazoX Gamification Core v2
 * XP · niveles · logros · equipos bloqueados · quests diarias · flash events
 * 100% localStorage, sin servidor. API: window.gxUser.*
 */
'use strict';
(function (w) {
  var KEY = 'gx_user';

  // XP mínimo para alcanzar cada nivel (índice 0 = Lv1)
  var LEVELS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 3500, 5000, 7500];

  // ── Colecciones del Museo ──────────────────────────────────
  var COLLECTIONS = {
    pioneers: {
      label: 'Pioneros',
      desc: 'Los grandes equipos que forjaron la historia del fútbol (hasta 1975)',
      icon: '🏛️',
      slugs: ['ajax-amsterdam', 'celtic-glasgow', 'feyenoord-rotterdam', 'hamburger-sv', 'borussia-monchengladbach', 'dynamo-kyiv', 'rsc-anderlecht'],
    },
    golden: {
      label: 'Era Dorada',
      desc: 'Equipos que dominaron los años 70-90',
      icon: '✨',
      slugs: ['nottingham-forest', 'red-star-belgrade', 'steaua-bucharest', 'leeds-united', 'parma'],
    },
    classics: {
      label: 'Clásicos Europeos',
      desc: 'Las grandes potencias de Europa que conquistaron el continente',
      icon: '🏆',
      slugs: ['fc-liverpool', 'inter-mailand', 'juventus-turin', 'olympique-marseille', 'fc-porto', 'benfica-lissabon', 'psv-eindhoven'],
    },
    moderns: {
      label: 'Campeones Modernos',
      desc: 'Los clubes que marcaron el fútbol de los años 90 y 2000',
      icon: '⚡',
      slugs: ['spartak-moscow', 'fc-valencia', 'as-monaco', 'cska-moscow'],
    },
    americas: {
      label: 'América Inmortal',
      desc: 'Los colosos e íconos del fútbol sudamericano',
      icon: '🌎',
      slugs: ['santos', 'penarol', 'club-atletico-river-plate', 'club-atletico-boca-juniors', 'brasilien', 'sc-internacional'],
    },
    icons: {
      label: 'Íconos del Fútbol',
      desc: 'Los clubes que dominaron Europa y el mundo en su época dorada',
      icon: '🌟',
      slugs: ['fc-bayern-munchen', 'ac-mailand', 'manchester-united', 'frankreich'],
    },
    elite: {
      label: 'Élite Histórica',
      desc: 'Los equipos más dominantes del siglo XXI',
      icon: '💎',
      slugs: ['fc-barcelona', 'deutschland', 'atletico-madrid'],
    },
    mythics: {
      label: 'Mitológicos',
      desc: 'El pináculo absoluto del fútbol. Solo para los más dedicados',
      icon: '👑',
      slugs: ['real-madrid'],
    },
    nations: {
      label: 'Selecciones Históricas',
      desc: 'Las selecciones nacionales más legendarias de la historia del fútbol',
      icon: '🌍',
      slugs: ['england', 'jugoslawien', 'urss', 'argentinien', 'belgien', 'portugal', 'spanien'],
    },
    legends_xi: {
      label: 'Leyendas All-Stars',
      desc: 'Los mejores jugadores de la historia reunidos en un único equipo',
      icon: '⭐',
      slugs: ['best-xi-2025', 'best-xi-history'],
    },
  };

  // ── Equipos bloqueados ────────────────────────────────────
  var LOCKED_TEAMS = {
    // ── Era Dorada (150-200 XP) ────────────────────────────
    'steaua-bucharest':            { xp: 150,  label: 'Steaua Bucarest',       era: '1986', collection: 'golden'   },
    'red-star-belgrade':           { xp: 150,  label: 'Estrella Roja',         era: '1991', collection: 'golden'   },
    'nottingham-forest':           { xp: 200,  label: 'Nottingham Forest',     era: '1979', collection: 'golden'   },
    'parma':                       { xp: 200,  label: 'Parma',                 era: '1999', collection: 'golden'   },
    // ── Pioneros (250-390 XP) ────────────────────────────
    'leeds-united':                { xp: 250,  label: 'Leeds United',          era: '1974', collection: 'golden' },
    'hamburger-sv':                { xp: 250,  label: 'Hamburgo SV',           era: '1983', collection: 'pioneers' },
    'ajax-amsterdam':              { xp: 300,  label: 'Ajax Amsterdam',        era: '1971', collection: 'pioneers' },
    'celtic-glasgow':              { xp: 300,  label: 'Celtic Glasgow',        era: '1967', collection: 'pioneers' },
    'feyenoord-rotterdam':         { xp: 300,  label: 'Feyenoord',             era: '1970', collection: 'pioneers' },
    'borussia-monchengladbach':    { xp: 350,  label: 'Mönchengladbach',       era: '1974', collection: 'pioneers' },
    'dynamo-kyiv':                 { xp: 370,  label: 'Dynamo Kiev 86',        era: '1986', collection: 'pioneers' },
    'rsc-anderlecht':              { xp: 390,  label: 'Anderlecht 78',         era: '1978', collection: 'pioneers' },
    // ── Clásicos Europeos (400-620 XP) ──────────────────
    'fc-liverpool':                { xp: 400,  label: 'Liverpool 77',          era: '1977', collection: 'classics' },
    'benfica-lissabon':            { xp: 430,  label: 'Benfica 87',            era: '1987', collection: 'classics' },
    'inter-mailand':               { xp: 460,  label: 'Inter de Milán',        era: '1964', collection: 'classics' },
    'psv-eindhoven':               { xp: 490,  label: 'PSV 88',                era: '1988', collection: 'classics' },
    'juventus-turin':              { xp: 520,  label: 'Juventus 85',           era: '1985', collection: 'classics' },
    'olympique-marseille':         { xp: 565,  label: 'Olympique Marsella',    era: '1993', collection: 'classics' },
    'fc-porto':                    { xp: 610,  label: 'FC Porto 2004',         era: '2004', collection: 'classics' },
    // ── Campeones Modernos (640-780 XP) ──────────────────
    'spartak-moscow':              { xp: 645,  label: 'Spartak 94',            era: '1994', collection: 'moderns'  },
    'fc-valencia':                 { xp: 685,  label: 'Valencia 00',           era: '2000', collection: 'moderns'  },
    'as-monaco':                   { xp: 725,  label: 'Monaco 04',             era: '2004', collection: 'moderns'  },
    'cska-moscow':                 { xp: 770,  label: 'CSKA Moscú 05',         era: '2005', collection: 'moderns'  },
    // ── América Inmortal (820-1100 XP) ────────────────
    'santos':                      { xp: 820,  label: 'Santos de Pelé',            era: '1963', collection: 'americas' },
    'penarol':                     { xp: 860,  label: 'Peñarol',                   era: '1966', collection: 'americas' },
    'sc-internacional':            { xp: 900,  label: 'Internacional 06',           era: '2006', collection: 'americas' },
    'club-atletico-river-plate':   { xp: 940,  label: 'River Plate 96',             era: '1996', collection: 'americas' },
    'club-atletico-boca-juniors':  { xp: 980,  label: 'Boca Juniors 2000',          era: '2000', collection: 'americas' },
    'brasilien':                   { xp: 1100, label: 'Brasil 1970',                era: '1970', collection: 'americas' },
    // ── Íconos del Fútbol (1200-2200 XP) ─────────────
    'fc-bayern-munchen':           { xp: 1200, label: "Bayern München '74",         era: '1974', collection: 'icons'   },
    'ac-mailand':                  { xp: 1450, label: "AC Milan '89",               era: '1989', collection: 'icons'   },
    'manchester-united':           { xp: 1800, label: "Manchester United '99",      era: '1999', collection: 'icons'   },
    'frankreich':                  { xp: 2200, label: "France '98",                 era: '1998', collection: 'icons'   },
    // ── Élite Histórica (2600-3500 XP) ───────────────
    'fc-barcelona':                { xp: 2600, label: 'FC Barcelona 2009',          era: '2009', collection: 'elite'   },
    'deutschland':                 { xp: 3000, label: 'Alemania 1974',              era: '1974', collection: 'elite'   },
    'atletico-madrid':             { xp: 3500, label: 'Atlético Madrid 2014',       era: '2014', collection: 'elite'   },
    // ── Mitológicos (5000 XP) — el Santo Grial ───────
    'real-madrid':                 { xp: 5000, label: 'Real Madrid 1960',           era: '1960', collection: 'mythics' },
    // ── Selecciones Históricas (550-2100 XP) ─────────
    'england':                     { xp: 550,  label: 'Inglaterra 1966',            era: '1966', collection: 'nations' },
    'jugoslawien':                 { xp: 650,  label: 'Yugoslavia 1982',            era: '1982', collection: 'nations' },
    'urss':                        { xp: 750,  label: 'URSS 1988',                  era: '1988', collection: 'nations' },
    'argentinien':                 { xp: 1000, label: 'Argentina 1986',             era: '1986', collection: 'nations' },
    'belgien':                     { xp: 1350, label: 'Bélgica 2018',               era: '2018', collection: 'nations' },
    'portugal':                    { xp: 1700, label: 'Portugal 2016',              era: '2016', collection: 'nations' },
    'spanien':                     { xp: 2100, label: 'España 2010',                era: '2010', collection: 'nations' },
    // ── Leyendas All-Stars ────────────────────────────
    'best-xi-2025':                { xp: 1500, label: 'Mejor XI 2025',              era: '2025',     collection: 'legends_xi' },
    'best-xi-history':             { xp: 4500, label: 'Mejor XI Histórico',         era: 'all-time', collection: 'legends_xi' },
  };

  // ── Estadios bloqueados ───────────────────────────────────
  var LOCKED_STADIUMS = {
    'azteca':   { xp: 80,   label: 'Estadio Azteca'    },
    'luzhniki': { xp: 120,  label: 'Luzhniki'          },
    'celtic':   { xp: 160,  label: 'Celtic Park'       },
    'wembley':  { xp: 250,  label: 'Wembley'           },
    'anfield':  { xp: 400,  label: 'Anfield'           },
    'maracana': { xp: 600,  label: 'Maracaná'          },
    'sansiro':  { xp: 900,  label: 'San Siro'          },
    'allianz':  { xp: 1300, label: 'Allianz Arena'     },
    'campnou':  { xp: 1800, label: 'Camp Nou'          },
    'bernabeu': { xp: 2500, label: 'Santiago Bernabéu' },
  };

  // ── Climas bloqueados ─────────────────────────────────────
  var LOCKED_WEATHER = {
    'heat':  { xp: 40,  label: 'Calor extremo' },
    'storm': { xp: 60,  label: 'Tormenta' },
    'snow':  { xp: 90,  label: 'Nieve' },
  };

  // ── Árbitros bloqueados ───────────────────────────────────
  var LOCKED_REFS = {
    'brych':       { xp: 60,   label: 'Felix Brych'      },
    'kassai':      { xp: 90,   label: 'Viktor Kassai'    },
    'moreno':      { xp: 120,  label: 'Byron Moreno'     },
    'collina':     { xp: 200,  label: 'Pierluigi Collina' },
    'webb':        { xp: 350,  label: 'Howard Webb'      },
    'rizzoli':     { xp: 500,  label: 'Nicola Rizzoli'   },
    'kuipers':     { xp: 700,  label: 'Björn Kuipers'    },
    'clattenburg': { xp: 1000, label: 'Mark Clattenburg' },
    'merk':        { xp: 1500, label: 'Markus Merk'      },
  };

  // ── Formatos y torneos bloqueados ─────────────────────────
  // id = data-fmt value (format cards) or data-preset value (preset cards)
  var LOCKED_FORMATS = {
    'liga':             { xp: 100, label: 'Liga GolazoX',         icon: '📊', desc: 'Todos contra todos · Clasificación por puntos' },
    'euro2024':         { xp: 200, label: 'UEFA Euro 2024',       icon: '🏆', desc: 'Desbloqueas un nuevo torneo oficial' },
    'libertadores2025': { xp: 350, label: 'Copa Libertadores',    icon: '🌎', desc: '32 clubes sudamericanos' },
    'wc-historical':    { xp: 500, label: 'Copa del Mundo',       icon: '🌍', desc: 'Todas las ediciones históricas' },
    'ucl2026':          { xp: 700, label: 'UEFA Champions League',icon: '⭐', desc: 'La competición más prestigiosa' },
  };

  // ── Flash Events (fin de semana = viernes noche - domingo) ──
  // Se desbloquean temporalmente según la semana del año (mod rotación)
  var FLASH_ROTATION = [
    'nottingham-forest',
    'ajax-amsterdam',
    'brasilien',
    'red-star-belgrade',
    'celtic-glasgow',
    'fc-liverpool',
    'juventus-turin',
    'santos',
    'inter-mailand',
    'club-atletico-river-plate',
    'dynamo-kyiv',
    'benfica-lissabon',
    'fc-valencia',
    'psv-eindhoven',
    'fc-bayern-munchen',
    'ac-mailand',
    'manchester-united',
    'fc-barcelona',
  ];

  function _getFlashTeam() {
    var now  = new Date();
    var dow  = now.getDay(); // 0=dom,1=lun,...,5=vie,6=sab
    if (dow !== 0 && dow !== 5 && dow !== 6) return null; // solo vie/sab/dom
    var week = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
    return FLASH_ROTATION[week % FLASH_ROTATION.length];
  }

  // ── Logros ───────────────────────────────────────────────
  var ACHIEVEMENTS = {
    first_match:    { icon: '⚽', title: 'Primer Partido',       desc: 'Simulaste tu primer partido',          check: function(u){ return u.stats.matchesPlayed >= 1;    } },
    ten_matches:    { icon: '🔟', title: 'Veterano',             desc: '10 partidos simulados',                check: function(u){ return u.stats.matchesPlayed >= 10;   } },
    fifty_matches:  { icon: '🌟', title: 'Leyenda',              desc: '50 partidos simulados',                check: function(u){ return u.stats.matchesPlayed >= 50;   } },
    cent_matches:   { icon: '💯', title: 'Centenario',           desc: '100 partidos simulados',               check: function(u){ return u.stats.matchesPlayed >= 100;  } },
    first_trn:      { icon: '🏆', title: 'Organizador',          desc: 'Primer torneo completado',             check: function(u){ return u.stats.tournamentsCompleted >= 1; } },
    five_trn:       { icon: '👑', title: 'Magnate del Fútbol',   desc: '5 torneos completados',                check: function(u){ return u.stats.tournamentsCompleted >= 5; } },
    streak_3:       { icon: '🔥', title: 'En Racha',             desc: '3 días seguidos en GolazoX',           check: function(u){ return u.streak.best >= 3;   } },
    streak_7:       { icon: '🔥', title: 'Semana de Fuego',      desc: '7 días seguidos en GolazoX',           check: function(u){ return u.streak.best >= 7;   } },
    globalist:      { icon: '🌍', title: 'Globalista',           desc: '10 equipos distintos utilizados',      check: function(u){ return u.stats.uniqueTeamsUsed.length >= 10; } },
    collector:      { icon: '📦', title: 'Coleccionista',        desc: '25 equipos distintos utilizados',      check: function(u){ return u.stats.uniqueTeamsUsed.length >= 25; } },
    penalty_debut:  { icon: '🎪', title: 'Debut en Penaltis',    desc: 'Primera tanda de penaltis jugada',     check: function(u){ return u.stats.penaltiesPlayed >= 1;  } },
    penalty_king:   { icon: '🥅', title: 'Rey de Penaltis',      desc: '10 tandas de penaltis jugadas',        check: function(u){ return u.stats.penaltiesPlayed >= 10; } },
    goleador:       { icon: '🎯', title: 'Goleador',             desc: '100 goles totales simulados',          check: function(u){ return u.stats.totalGoals >= 100;    } },
    replay_fan:     { icon: '🔁', title: 'Fan del Replay',       desc: 'Repetiste un partido 3 veces',         check: function(u){ return (u.stats.maxReplays || 0) >= 3; } },
    quest_first:    { icon: '📋', title: 'Primer Misión',        desc: 'Completaste tu primera misión diaria', check: function(u){ return (u.stats.questsCompleted || 0) >= 1; } },
    quest_streak:   { icon: '📅', title: 'Disciplinado',         desc: '5 misiones diarias completadas',       check: function(u){ return (u.stats.questsCompleted || 0) >= 5; } },
    museum_pioneer: { icon: '🏛️', title: 'Conservador',         desc: 'Desbloqueaste toda la colección Pioneros', check: function(u){ return _collectionDone(u, 'pioneers'); } },
    museum_golden:  { icon: '✨', title: 'Guardián de la Era Dorada', desc: 'Desbloqueaste la Era Dorada',    check: function(u){ return _collectionDone(u, 'golden'); } },
    museum_classics:{ icon: '🏆', title: 'Maestro Clásico',      desc: 'Desbloqueaste los Clásicos Europeos', check: function(u){ return _collectionDone(u, 'classics'); } },
    museum_americas:{ icon: '🌎', title: 'Leyenda Americana',   desc: 'Desbloqueaste América Inmortal', check: function(u){ return _collectionDone(u, 'americas'); } },
    museum_all:     { icon: '🏆', title: 'El Gran Coleccionista', desc: '¡Desbloqueaste TODOS los equipos del Museo!', check: function(u){ return Object.keys(LOCKED_TEAMS).every(function(s){ return u.unlockedTeams.includes(s); }); } },
    flash_win:      { icon: '⚡', title: '¡Flash!',              desc: 'Ganaste con un equipo Flash del fin de semana', check: function(u){ return (u.stats.flashWins || 0) >= 1; } },
    level_5:        { icon: '⭐', title: 'Nivel 5',              desc: 'Alcanzaste el nivel 5',                check: function(u){ return u.level >= 5;  } },
    level_10:       { icon: '💎', title: 'Nivel 10',             desc: 'Alcanzaste el nivel 10',               check: function(u){ return u.level >= 10; } },
    // ── Modos de partido ─────────────────────────────────────
    mode_speed:     { icon: '⚡', title: 'Velocidad Total',      desc: 'Juega 5 partidos en 5v5 o 3v3',       check: function(u){ return ((u.stats.matchesByMode && u.stats.matchesByMode['5v5'] || 0) + (u.stats.matchesByMode && u.stats.matchesByMode['3v3'] || 0)) >= 5; } },
    mode_1v1:       { icon: '🎮', title: 'Duelo Individual',     desc: 'Juega un partido 1v1',                 check: function(u){ return (u.stats.matchesByMode && u.stats.matchesByMode['1v1'] || 0) >= 1; } },
    mode_instant:   { icon: '⏩', title: 'Modo Directo',         desc: 'Simula 10 partidos en modo Directo',   check: function(u){ return (u.stats.instantMatches || 0) >= 10; } },
    // ── Copa & Liga Golazox ───────────────────────────────────
    copa_golazox:   { icon: '🏅', title: 'Copa Golazox',         desc: 'Completa tu primera Copa personalizada', check: function(u){ return (u.stats.copasPlayed || 0) >= 1; } },
    liga_golazox:   { icon: '📊', title: 'Liga Golazox',         desc: 'Completa tu primera Liga',             check: function(u){ return (u.stats.ligasPlayed || 0) >= 1; } },
    copa_5:         { icon: '🥇', title: 'Organizador de Copa',  desc: 'Completa 5 Copas personalizadas',      check: function(u){ return (u.stats.copasPlayed || 0) >= 5; } },
    liga_5:         { icon: '📈', title: 'Señor de la Liga',     desc: 'Completa 5 Ligas personalizadas',      check: function(u){ return (u.stats.ligasPlayed || 0) >= 5; } },
    // ── Competiciones oficiales ───────────────────────────────
    champ_debut:    { icon: '🌟', title: 'Noche de Champions',   desc: 'Completa tu primer Champions',         check: function(u){ return (u.stats.championsCompleted || 0) >= 1; } },
    champ_10:       { icon: '👑', title: 'Rey de Europa',        desc: 'Completa 10 Champions League',         check: function(u){ return (u.stats.championsCompleted || 0) >= 10; } },
    wc_debut:       { icon: '🌍', title: 'Mundialista',          desc: 'Completa tu primer Mundial',           check: function(u){ return (u.stats.worldCupsCompleted || 0) >= 1; } },
    wc_15:          { icon: '🏆', title: 'Señor del Fútbol',     desc: 'Completa 15 Mundiales',                check: function(u){ return (u.stats.worldCupsCompleted || 0) >= 15; } },
    trn_25:         { icon: '🎖️', title: 'Maestro de Torneos',  desc: '25 torneos completados',               check: function(u){ return u.stats.tournamentsCompleted >= 25; } },
    // ── Colecciones Grandes ───────────────────────────────────
    top3_weekly:    { icon: '🏅', title: 'Top 3 Semanal',       desc: 'Terminaste entre los 3 mejores del ranking semanal',  check: function(u){ return (u.weeklyBadges || []).length >= 1; } },
    // ── Colecciones Grandes ───────────────────────────────────
    museum_icons:   { icon: '🌟', title: 'Leyenda del Fútbol',    desc: 'Desbloqueaste la colección Íconos del Fútbol',  check: function(u){ return _collectionDone(u, 'icons');   } },
    museum_elite:   { icon: '💎', title: 'Élite Total',            desc: 'Desbloqueaste la colección Élite Histórica',    check: function(u){ return _collectionDone(u, 'elite');   } },
    museum_mythics: { icon: '👑', title: 'El Inmortal del Fútbol', desc: '¡Desbloqueaste el Real Madrid 1960!',           check: function(u){ return u.unlockedTeams.includes('real-madrid'); } },
    museum_nations: { icon: '🌍', title: 'Embajador del Mundo',    desc: 'Desbloqueaste todas las Selecciones Históricas', check: function(u){ return _collectionDone(u, 'nations');  } },
    museum_legends: { icon: '⭐', title: 'El Árbitro del Tiempo',  desc: 'Desbloqueaste ambos equipos All-Stars',         check: function(u){ return _collectionDone(u, 'legends_xi'); } },
    // ── Niveles máximos ───────────────────────────────────────
    level_12:       { icon: '⭐', title: 'Inmortal',               desc: 'Alcanzaste el nivel máximo (Lv.12)',            check: function(u){ return u.level >= 12; } },
    // ── Rachas largas ─────────────────────────────────────────
    streak_14:      { icon: '🔥', title: 'Imparable',              desc: '14 días seguidos en GolazoX',                  check: function(u){ return u.streak.best >= 14; } },
    streak_30:      { icon: '🔥', title: 'Incontenible',           desc: '30 días seguidos — ¡Leyenda absoluta!',        check: function(u){ return u.streak.best >= 30; } },
    // ── Goles totales ─────────────────────────────────────────
    goals_500:      { icon: '💥', title: '500 Goles',              desc: '500 goles totales simulados',                  check: function(u){ return u.stats.totalGoals >= 500; } },
  };

  function _collectionDone(u, colKey) {
    var col = COLLECTIONS[colKey];
    if (!col) return false;
    return col.slugs.every(function (s) { return u.unlockedTeams.includes(s); });
  }

  // ── Daily Quests (semilla = fecha YYYYMMDD) ────────────────
  var QUEST_POOL = [
    { id: 'q_goals3',   tab: 'match', icon: '🎯', title: 'Goleada',          desc: 'Gana un partido marcando 3+ goles',           check: function(e){ return e.won && (e.goalsFor || 0) >= 3; } },
    { id: 'q_goals4',   tab: 'match', icon: '💥', title: 'Paliza',           desc: 'Gana un partido marcando 4+ goles',           check: function(e){ return e.won && (e.goalsFor || 0) >= 4; } },
    { id: 'q_penalty',  tab: 'pen',   icon: '🥅', title: 'Tensión Máxima',   desc: 'Juega una tanda de penaltis',                 check: function(e){ return e.isPenalties; } },
    { id: 'q_era70',    tab: 'match', icon: '📽️', title: 'Nostalgia Setentera', desc: 'Simula un partido con un equipo de los 70', check: function(e){ return e.eraA === '1970' || e.eraA === '1971' || e.eraA === '1972' || e.eraA === '1973' || e.eraA === '1974' || e.eraA === '1975' || e.eraA === '1976' || e.eraA === '1977' || e.eraA === '1978' || e.eraA === '1979' || e.eraB === '1970' || e.eraB === '1971' || e.eraB === '1972' || e.eraB === '1973' || e.eraB === '1974' || e.eraB === '1975' || e.eraB === '1976' || e.eraB === '1977' || e.eraB === '1978' || e.eraB === '1979'; } },
    { id: 'q_era80',    tab: 'match', icon: '🕹️', title: 'Feeling Ochentero', desc: 'Simula un partido con un equipo de los 80',  check: function(e){ return ['1980','1981','1982','1983','1984','1985','1986','1987','1988','1989'].some(function(y){ return e.eraA === y || e.eraB === y; }); } },
    { id: 'q_replay',   tab: 'match', icon: '🔁', title: 'Revancha',         desc: 'Repite el mismo enfrentamiento 2 veces hoy',  check: function(e){ return e.isReplay; } },
    { id: 'q_trn',      tab: 'trn',   icon: '🏆', title: 'Organizador',      desc: 'Completa cualquier torneo hoy',               check: function(e){ return e.isTournament; } },
    { id: 'q_win3x11',  tab: 'match', icon: '🛡️', title: 'Modo Clásico',    desc: 'Gana un partido 11v11',                       check: function(e){ return e.won && e.mode === '11v11'; } },
    { id: 'q_5v5',      tab: 'match', icon: '⚡', title: 'Fútbol Rápido',    desc: 'Juega un partido 5v5 o 3v3',                  check: function(e){ return e.mode === '5v5' || e.mode === '3v3'; } },
    { id: 'q_underdog', tab: 'match', icon: '🐉', title: 'El Underdog',      desc: 'Gana jugando como Equipo B',                  check: function(e){ return e.wonAsB; } },
    { id: 'q_clean',    tab: 'match', icon: '🧤', title: 'Portería a Cero',  desc: 'Gana sin encajar goles',                      check: function(e){ return e.won && e.goalsAgainst === 0; } },
    { id: 'q_historic', tab: 'match', icon: '🏛️', title: 'Historia Viva',   desc: 'Usa un equipo del Museo (desbloqueado)',       check: function(e){ return e.usedMuseumTeam; } },
    { id: 'q_champ_trn',tab: 'trn',   icon: '🌟', title: 'Noche Europea',    desc: 'Completa un Champions hoy',                   check: function(e){ return e.isTournament && e.trnFmt === 'champions'; } },
    { id: 'q_copa_trn', tab: 'trn',   icon: '🏅', title: 'Copa del Día',     desc: 'Completa una Copa o Liga hoy',                check: function(e){ return e.isTournament && (e.trnFmt === 'copa' || e.trnFmt === 'liga'); } },
    { id: 'q_thriller', tab: 'match', icon: '🔥', title: 'Partidazo',        desc: 'Partido con 5+ goles en total',               check: function(e){ return ((e.goalsFor||0)+(e.goalsAgainst||0)) >= 5; } },
    { id: 'q_instant',  tab: 'match', icon: '⏩', title: 'Sin Esperas',      desc: 'Juega en modo Directo (velocidad instantánea)', check: function(e){ return e.isInstant; } },
  ];

  function _seededRand(seed) {
    // Simple LCG determinista
    var s = seed % 2147483647;
    return function () {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function _todaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function getDailyQuests() {
    var seed  = _todaySeed();
    var rand  = _seededRand(seed);
    var pool  = QUEST_POOL.slice();
    // Fisher-Yates con semilla determinista
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, 3);
  }

  // ── Valores XP ─────────────────────────────────────────────
  var XP = {
    match:           10,
    goalBonus:       1,   // por gol en match (máx 8/partido)
    replayFirst:     5,
    replayRepeat:    3,
    penalties:       8,
    tournamentLiga:  60,
    tournamentCopa:  80,
    tournamentChamp: 120,
    uniqueTeam:      15,
    milestone10:     30,
    milestone25:     75,
    streakDay:       5,   // por día de racha (cap 5 días)
    activity30m:     5,
    questBonus:      20,  // XP extra por cada quest completada
    questDayBonus:   50,  // XP extra por completar las 3 misiones del día
    questMultiplier: 2,   // el XP base se multiplica x2 en un quest activo
  };

  // ── Títulos de nivel (no editables, se muestran junto al nivel) ──
  var LEVEL_TITLES = [
    'Hincha Novato',       // Lv1
    'Aficionado',          // Lv2
    'Crack Local',         // Lv3
    'Promesa',             // Lv4
    'Profesional',         // Lv5
    'Estrella',            // Lv6
    'Ídolo Nacional',      // Lv7
    'Figura Histórica',    // Lv8
    'Fenómeno',            // Lv9
    'Leyenda Viva',        // Lv10
    'El Elegido',          // Lv11
    'El GOAT',             // Lv12
  ];

  // ── Nombres de usuario auto-generados (userXXXXXX) ───────────
  function _randomName() {
    return 'user' + (Math.floor(Math.random() * 900000) + 100000);
  }

  function _today() { return new Date().toISOString().slice(0, 10); }

  function _defaultUser() {
    return {
      id: 'gx_' + Math.random().toString(36).slice(2, 10),
      name: _randomName(),
      createdAt: _today(),
      xp: 0,
      level: 1,
      streak: { current: 0, best: 0, lastDate: null },
      stats: {
        matchesPlayed: 0,
        tournamentsCompleted: 0,
        totalGoals: 0,
        uniqueTeamsUsed: [],
        penaltiesPlayed: 0,
        minutesActive: 0,
        lastActiveDate: null,
        maxReplays: 0,
        questsCompleted: 0,
        flashWins: 0,
        matchesByMode: {},
        instantMatches: 0,
        championsCompleted: 0,
        worldCupsCompleted: 0,
        copasPlayed: 0,
        ligasPlayed: 0,
      },
      unlockedTeams: [],
      achievements: [],
      recentMatches: [],
      recentMatchHistory: [],
      dailyQuests: { date: null, completed: [] }, // ids completados hoy
      dailyStats: { date: null, xpEarned: 0, matches: 0, goals: 0, quests: 0, tournaments: 0 },
      favoriteTeam: null,   // slug del equipo favorito
      country: '',          // ISO 2-letter, e.g. 'ES'
      flag: '',             // emoji bandera
      weeklyBadges: [],     // [{ week:'2026-W16', rank:1 }, ...]
    };
  }

  function _load() {
    try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
  }
  function _save(u) {
    try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (_) {}
  }
  function _migrate(u) {
    if (!u || typeof u !== 'object') return _defaultUser();
    if (typeof u.xp !== 'number' || isNaN(u.xp) || u.xp < 0) u.xp = 0;
    if (typeof u.level !== 'number' || isNaN(u.level) || u.level < 1) u.level = 1;
    if (!u.stats)  u.stats  = {};
    if (!Array.isArray(u.stats.uniqueTeamsUsed)) u.stats.uniqueTeamsUsed = [];
    if (!Array.isArray(u.unlockedTeams))  u.unlockedTeams  = [];
    if (!Array.isArray(u.achievements))   u.achievements   = [];
    if (!Array.isArray(u.recentMatches))  u.recentMatches  = [];
    if (!u.streak) u.streak = { current: 0, best: 0, lastDate: null };
    if (!u.dailyQuests) u.dailyQuests = { date: null, completed: [] };
    if (!u.dailyStats)  u.dailyStats  = { date: null, xpEarned: 0, matches: 0, goals: 0, quests: 0, tournaments: 0 };
    var fields = ['maxReplays','minutesActive','questsCompleted','flashWins','matchesPlayed','tournamentsCompleted','totalGoals','penaltiesPlayed','instantMatches','championsCompleted','worldCupsCompleted','copasPlayed','ligasPlayed'];
    fields.forEach(function(f){ if (u.stats[f] === undefined) u.stats[f] = 0; });
    if (!u.stats.matchesByMode || typeof u.stats.matchesByMode !== 'object') u.stats.matchesByMode = {};
    if (!u.stats.lastActiveDate) u.stats.lastActiveDate = null;
    if (!Array.isArray(u.recentMatchHistory)) u.recentMatchHistory = [];
    if (u.favoriteTeam === undefined) u.favoriteTeam = null;
    if (!u.country)  u.country  = '';
    if (!u.flag)     u.flag     = '';
    if (!Array.isArray(u.weeklyBadges)) u.weeklyBadges = [];
    return u;
  }

  function _getOrCreate() {
    var u = _load();
    if (!u) { u = _defaultUser(); _save(u); return u; }
    return _migrate(u);
  }

  function _levelForXp(xp) {
    var lv = 1;
    for (var i = 1; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i]) lv = i + 1; else break;
    }
    return Math.min(lv, LEVELS.length);
  }

  function _updateStreak(u) {
    var today = _today();
    if (u.streak.lastDate === today) return 0;
    var bonus = 0;
    if (u.streak.lastDate) {
      var diff = Math.round((new Date(today) - new Date(u.streak.lastDate)) / 86400000);
      u.streak.current = (diff === 1) ? u.streak.current + 1 : 1;
    } else {
      u.streak.current = 1;
    }
    if (u.streak.current > u.streak.best) u.streak.best = u.streak.current;
    u.streak.lastDate = today;
    return XP.streakDay * Math.min(u.streak.current, 5);
  }

  function _checkUnlocks(u) {
    var newUnlocks = [];
    // Flash unlock temporal
    var flashSlug = _getFlashTeam();
    Object.keys(LOCKED_TEAMS).forEach(function (slug) {
      var info = LOCKED_TEAMS[slug];
      if (!u.unlockedTeams.includes(slug) && u.xp >= info.xp) {
        u.unlockedTeams.push(slug);
        newUnlocks.push({ slug: slug, label: info.label, era: info.era, xp: info.xp });
      }
    });
    return newUnlocks;
  }

  function _checkAchievements(u) {
    var newAchs = [];
    Object.keys(ACHIEVEMENTS).forEach(function (id) {
      var ach = ACHIEVEMENTS[id];
      if (!u.achievements.includes(id) && ach.check(u)) {
        u.achievements.push(id);
        newAchs.push({ id: id, icon: ach.icon, title: ach.title, desc: ach.desc });
      }
    });
    return newAchs;
  }

  // ── Evaluar quests contra un evento ───────────────────────
  // opts = { won, goalsFor, goalsAgainst, eraA, eraB, mode, isReplay, isPenalties, isTournament, wonAsB, usedMuseumTeam }
  function _evalQuests(u, opts) {
    var today   = _today();
    var dq      = u.dailyQuests;
    if (dq.date !== today) { dq.date = today; dq.completed = []; }
    var quests  = getDailyQuests();
    var bonuses = [];
    quests.forEach(function (q) {
      if (dq.completed.includes(q.id)) return;
      if (q.check(opts)) {
        dq.completed.push(q.id);
        u.stats.questsCompleted++;
        bonuses.push({ id: q.id, icon: q.icon, title: q.title });
      }
    });
    return bonuses;
  }

  // ── Núcleo: addXP ──────────────────────────────────────────
  function addXP(reason, opts) {
    opts = opts || {};
    var u       = _getOrCreate();
    var oldLevel = u.level;
    var gained  = 0;
    var questBonuses = [];

    if (reason === 'match') {
      var goals    = Math.min(opts.goals || 0, 8);
      var baseXP   = XP.match + goals * XP.goalBonus;
      // Underdog bonus: equipo ganador con ≥8 pts de promedio inferior al perdedor → ×1.5 XP base
      if (opts.isUnderdog && opts.won) baseXP = Math.round(baseXP * 1.5);
      gained += baseXP;
      u.stats.matchesPlayed++;
      u.stats.totalGoals += (opts.goals || 0);

      // Historial de partidas (últimas 10)
      if (!Array.isArray(u.recentMatchHistory)) u.recentMatchHistory = [];
      u.recentMatchHistory = u.recentMatchHistory.slice(-9).concat([{
        a: opts.teamA || '', b: opts.teamB || '',
        ga: opts.goals || 0, gb: opts.goalsAgainst || 0,
        w: !!opts.won, m: opts.mode || '11v11', d: _today()
      }]);

      // Modo de partido
      var matchMode = opts.mode || '11v11';
      if (!u.stats.matchesByMode) u.stats.matchesByMode = {};
      u.stats.matchesByMode[matchMode] = (u.stats.matchesByMode[matchMode] || 0) + 1;

      // Modo directo (instantáneo)
      if (opts.isInstant) u.stats.instantMatches = (u.stats.instantMatches || 0) + 1;

      // Equipos únicos
      ['teamA','teamB'].forEach(function (k) {
        var slug = opts[k];
        if (slug && !u.stats.uniqueTeamsUsed.includes(slug)) {
          u.stats.uniqueTeamsUsed.push(slug);
          gained += XP.uniqueTeam;
          if (u.stats.uniqueTeamsUsed.length === 10) gained += XP.milestone10;
          if (u.stats.uniqueTeamsUsed.length === 25) gained += XP.milestone25;
        }
      });

      // Replay
      var matchKey = [opts.teamA||'', opts.teamB||''].sort().join('|');
      var recentArr = u.recentMatches || [];
      var replays  = recentArr.filter(function(m){ return m === matchKey; }).length;
      if (replays > 0) gained += replays < 3 ? XP.replayFirst : XP.replayRepeat;
      if (replays + 1 > u.stats.maxReplays) u.stats.maxReplays = replays + 1;
      u.recentMatches = recentArr.slice(-49).concat([matchKey]);

      // Flash win tracking
      var flashSlug = _getFlashTeam();
      if (flashSlug && (opts.teamA === flashSlug || opts.teamB === flashSlug) && opts.won) {
        u.stats.flashWins++;
      }

      // Racha
      gained += _updateStreak(u);

      // Quests del día
      var isMuseum = opts.teamA && LOCKED_TEAMS[opts.teamA] && u.unlockedTeams.includes(opts.teamA)
                  || opts.teamB && LOCKED_TEAMS[opts.teamB] && u.unlockedTeams.includes(opts.teamB);
      questBonuses = _evalQuests(u, {
        won: opts.won, goalsFor: opts.goals, goalsAgainst: opts.goalsAgainst || 0,
        eraA: opts.eraA, eraB: opts.eraB, mode: opts.mode || '11v11',
        isReplay: replays > 0, isPenalties: false, isTournament: false,
        wonAsB: opts.wonAsB, usedMuseumTeam: isMuseum, isInstant: opts.isInstant || false,
      });

    } else if (reason === 'penalties') {
      gained = XP.penalties;
      u.stats.penaltiesPlayed++;
      gained += _updateStreak(u);
      questBonuses = _evalQuests(u, { isPenalties: true });

    } else if (reason === 'tournament') {
      var fmt = opts.format || 'copa';
      gained  = fmt === 'champions' ? XP.tournamentChamp : fmt === 'liga' ? XP.tournamentLiga : XP.tournamentCopa;
      u.stats.tournamentsCompleted++;
      // +25% bonus si se usó un equipo del museo en el torneo
      if (opts.usedMuseumTeam) gained = Math.round(gained * 1.25);
      // Track por formato
      if (fmt === 'champions') {
        u.stats.championsCompleted = (u.stats.championsCompleted || 0) + 1;
      } else if (fmt === 'liga') {
        u.stats.ligasPlayed = (u.stats.ligasPlayed || 0) + 1;
      } else {
        u.stats.copasPlayed = (u.stats.copasPlayed || 0) + 1;
      }
      // Track mundiales (por preset)
      var preset = opts.preset || '';
      if (preset === 'wc2026' || preset === 'wc-historical') {
        u.stats.worldCupsCompleted = (u.stats.worldCupsCompleted || 0) + 1;
      }
      gained += _updateStreak(u);
      questBonuses = _evalQuests(u, { isTournament: true, trnFmt: fmt });

    } else if (reason === 'activity') {
      var today2 = _today();
      if (u.stats.lastActiveDate !== today2) { u.stats.lastActiveDate = today2; u.stats.minutesActive = 0; }
      u.stats.minutesActive += 30;
      if (u.stats.minutesActive <= 30) gained = XP.activity30m;
    }

    // Sumar XP bonus por quests
    gained += questBonuses.length * XP.questBonus;

    // Bonus extra por completar las 3 misiones del día (solo si se acaba de completar la 3ª)
    var questDayComplete = false;
    var _todayQD = _today();
    if (questBonuses.length > 0 && u.dailyQuests.date === _todayQD && u.dailyQuests.completed.length >= 3) {
      questDayComplete = true;
      gained += XP.questDayBonus;
    }

    u.xp    += gained;
    u.level  = _levelForXp(u.xp);
    var leveled    = u.level > oldLevel;
    var crossedLevels = [];
    if (leveled) { for (var _lv = oldLevel + 1; _lv <= u.level; _lv++) crossedLevels.push(_lv); }
    var newUnlocks = _checkUnlocks(u);
    var newAchs    = _checkAchievements(u);

    // ── Actualizar estadísticas diarias ───────────────────────────
    var todayStr = _today();
    if (!u.dailyStats || u.dailyStats.date !== todayStr) {
      u.dailyStats = { date: todayStr, xpEarned: 0, matches: 0, goals: 0, quests: 0, tournaments: 0 };
    }
    u.dailyStats.xpEarned  += gained;
    if (reason === 'match')      { u.dailyStats.matches++; u.dailyStats.goals += (opts.goals || 0); }
    if (reason === 'penalties')  { u.dailyStats.matches++; }
    if (reason === 'tournament') { u.dailyStats.tournaments++; }
    u.dailyStats.quests = (u.dailyQuests.date === todayStr) ? u.dailyQuests.completed.length : 0;

    _save(u);

    return {
      gained: gained, leveled: leveled, newLevel: leveled ? u.level : null,
      crossedLevels: crossedLevels,
      newUnlocks: newUnlocks, newAchs: newAchs, questBonuses: questBonuses, user: u,
      questDayComplete: questDayComplete,
      underdogBonus: !!(opts.isUnderdog && opts.won),
    };
  }

  // ── Export / Import base64 ─────────────────────────────────
  function exportCode() {
    var u = _getOrCreate();
    try {
      var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(u))));
      localStorage.setItem('gx_export_b64', b64);
      return { b64: b64 };
    } catch (_) { return null; }
  }

  function importCode(b64) {
    try {
      var u = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!u || typeof u.xp !== 'number') throw new Error('invalid');
      _save(_migrate(u)); return true;
    } catch (_) { return false; }
  }

  // ── API pública ─────────────────────────────────────────────
  w.gxUser = {
    get:            _getOrCreate,
    addXP:          addXP,
    getDailyQuests: getDailyQuests,

    getFlashTeam: function () { return _getFlashTeam(); },

    isLocked: function (slug, era) {
      if (!LOCKED_TEAMS[slug]) return false;
      // Era-aware: si el equipo tiene allEras=true, todas sus ediciones
      // están bloqueadas (equipos grandes como Bayern, Barça, Real Madrid).
      // Sin allEras, solo la edición histórica específica está bloqueada
      // (equipos como Ajax donde solo el 1971 requiere XP).
      if (!LOCKED_TEAMS[slug].allEras) {
        var lockedEra = LOCKED_TEAMS[slug].era;
        if (era != null && era !== '' && lockedEra) {
          if (String(era) !== String(lockedEra)) return false;
        }
      }
      // Flash: temporalmente desbloqueado
      if (_getFlashTeam() === slug) return false;
      return !_getOrCreate().unlockedTeams.includes(slug);
    },
    isFlash:       function (slug) { return _getFlashTeam() === slug; },
    getLockedInfo: function (slug) { return LOCKED_TEAMS[slug] || null; },

    // ── Estadios bloqueados ───────────────────────────────────
    isLockedStadium:      function (id) { if (!LOCKED_STADIUMS[id]) return false; return _getOrCreate().xp < LOCKED_STADIUMS[id].xp; },
    getLockedStadiumInfo: function (id) { return LOCKED_STADIUMS[id] || null; },

    // ── Climas bloqueados ─────────────────────────────────────
    isLockedWeather:      function (id) { if (!LOCKED_WEATHER[id]) return false; return _getOrCreate().xp < LOCKED_WEATHER[id].xp; },
    getLockedWeatherInfo: function (id) { return LOCKED_WEATHER[id] || null; },

    // ── Árbitros bloqueados ───────────────────────────────────
    isLockedRef:          function (id) { if (!LOCKED_REFS[id]) return false; return _getOrCreate().xp < LOCKED_REFS[id].xp; },
    getLockedRefInfo:     function (id) { return LOCKED_REFS[id] || null; },

    // ── Formatos y torneos bloqueados ─────────────────────────
    isLockedFormat:       function (id) { if (!LOCKED_FORMATS[id]) return false; return _getOrCreate().xp < LOCKED_FORMATS[id].xp; },
    getLockedFormatInfo:  function (id) { return LOCKED_FORMATS[id] || null; },

    exportCode: exportCode,
    importCode: importCode,
    reset: function () { try { localStorage.removeItem(KEY); localStorage.removeItem('gx_export_b64'); } catch(_){} },

    getLevelTitle: function (lv) { return LEVEL_TITLES[Math.min((lv || 1) - 1, LEVEL_TITLES.length - 1)]; },

    // Constantes expuestas
    LEVELS: LEVELS, LOCKED_TEAMS: LOCKED_TEAMS, ACHIEVEMENTS: ACHIEVEMENTS,
    COLLECTIONS: COLLECTIONS, XP: XP,
    LOCKED_STADIUMS: LOCKED_STADIUMS, LOCKED_WEATHER: LOCKED_WEATHER, LOCKED_REFS: LOCKED_REFS, LOCKED_FORMATS: LOCKED_FORMATS,
    LEVEL_TITLES: LEVEL_TITLES,

    xpForLevel:  function (lv) { return LEVELS[Math.max(0, lv - 1)] || 0; },
    nextLevelXP: function (lv) { return LEVELS[lv] != null ? LEVELS[lv] : null; },
    levelForXp:  _levelForXp,

    getDailyStats: function () {
      var u = _getOrCreate();
      var today = _today();
      if (!u.dailyStats || u.dailyStats.date !== today) {
        return { date: today, xpEarned: 0, matches: 0, goals: 0, quests: 0, tournaments: 0 };
      }
      // Sincronizar quests completadas hoy
      var qDone = (u.dailyQuests.date === today) ? u.dailyQuests.completed.length : 0;
      return Object.assign({}, u.dailyStats, { quests: qDone });
    },

    // Fórmula de puntuación diaria (para clasificación)
    dailyScore: function (ds) {
      if (!ds) return 0;
      return (ds.xpEarned * 10) + (ds.quests * 500) + (ds.tournaments * 200) + (ds.goals * 5);
    },

    // ── Ranking anonúmero: hash anti-spoofing (mismo algoritmo que server.js) ──
    gxHash: function (name, score, level, weekKey) {
      var salt = 'golazox_2026_xp';
      var str  = name + ':' + score + ':' + level + ':' + weekKey + ':' + salt;
      var h    = 0x811c9dc5;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h  = (Math.imul ? Math.imul(h, 0x01000193) : (h * 0x01000193)) >>> 0;
      }
      return h.toString(16);
    },

    gxWeekKey: function () {
      var d   = new Date();
      var day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      var dow = day.getUTCDay() || 7;
      day.setUTCDate(day.getUTCDate() + 4 - dow);
      var jan4 = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
      var wk   = 1 + Math.round(((day - jan4) / 86400000 - 3 + ((jan4.getUTCDay() || 7) - 1)) / 7);
      return day.getUTCFullYear() + '-W' + (wk < 10 ? '0' + wk : wk);
    },

    // Guardar equipo favorito
    setFavoriteTeam: function (slug) {
      var u = _getOrCreate();
      u.favoriteTeam = slug || null;
      _save(u);
    },

    // Guardar país + bandera
    setCountry: function (country, flag) {
      var u = _getOrCreate();
      u.country = String(country || '').replace(/[^A-Z]/g, '').slice(0, 2);
      u.flag    = String(flag    || '').slice(0, 4);
      _save(u);
    },

    // Registrar logro semanal (llamado desde gx-ui cuando el servidor confirma rank<=3)
    addWeeklyBadge: function (week, rank) {
      var u = _getOrCreate();
      if (!Array.isArray(u.weeklyBadges)) u.weeklyBadges = [];
      if (!u.weeklyBadges.find(function(b){ return b.week === week; })) {
        u.weeklyBadges.push({ week: week, rank: rank });
        var newAchs = _checkAchievements(u);
        _save(u);
        return newAchs;
      }
      _save(u);
      return [];
    },
  };

}(window));
