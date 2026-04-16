/**
 * gx-user.js — GolazoX Gamification Core
 * XP, niveles, logros, equipos/torneos bloqueados. 100% localStorage, sin servidor.
 * API: window.gxUser.*
 */
'use strict';
(function (w) {
  var KEY = 'gx_user';

  // XP mínimo para alcanzar cada nivel (índice 0 = Lv1 = 0 XP)
  var LEVELS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 3500, 5000, 7500];

  // Equipos históricos bloqueados — slug exacto del catálogo
  var LOCKED_TEAMS = {
    'steaua-bucharest':         { xp: 150,  label: 'Steaua Bucarest',      era: '1986' },
    'red-star-belgrade':        { xp: 150,  label: 'Estrella Roja',        era: '1991' },
    'nottingham-forest':        { xp: 200,  label: 'Nottingham Forest',    era: '1979' },
    'parma':                    { xp: 200,  label: 'Parma',                era: '1999' },
    'leeds-united':             { xp: 250,  label: 'Leeds United',         era: '1974' },
    'hamburger-sv':             { xp: 250,  label: 'Hamburgo SV',          era: '1983' },
    'ajax-amsterdam':           { xp: 300,  label: 'Ajax Amsterdam',       era: '1971' },
    'celtic-glasgow':           { xp: 300,  label: 'Celtic Glasgow',       era: '1967' },
    'feyenoord-rotterdam':      { xp: 300,  label: 'Feyenoord',            era: '1970' },
    'borussia-monchengladbach': { xp: 350,  label: 'Mönchengladbach',      era: '1974' },
    'brasilien':                { xp: 500,  label: 'Brasil 1970',          era: '1970' },
  };

  // Logros
  var ACHIEVEMENTS = {
    first_match:    { icon: '⚽', title: 'Primer Partido',      desc: 'Simulaste tu primer partido',           check: function(u){ return u.stats.matchesPlayed >= 1;    } },
    ten_matches:    { icon: '🔟', title: 'Veterano',            desc: '10 partidos simulados',                 check: function(u){ return u.stats.matchesPlayed >= 10;   } },
    fifty_matches:  { icon: '🌟', title: 'Leyenda',             desc: '50 partidos simulados',                 check: function(u){ return u.stats.matchesPlayed >= 50;   } },
    cent_matches:   { icon: '💯', title: 'Centenario',          desc: '100 partidos simulados',                check: function(u){ return u.stats.matchesPlayed >= 100;  } },
    first_trn:      { icon: '🏆', title: 'Organizador',         desc: 'Primer torneo completado',              check: function(u){ return u.stats.tournamentsCompleted >= 1; } },
    five_trn:       { icon: '👑', title: 'Magnate del Fútbol',  desc: '5 torneos completados',                 check: function(u){ return u.stats.tournamentsCompleted >= 5; } },
    streak_3:       { icon: '🔥', title: 'En Racha',            desc: '3 días seguidos en GolazoX',            check: function(u){ return u.streak.best >= 3;   } },
    streak_7:       { icon: '🔥', title: 'Semana de Fuego',     desc: '7 días seguidos en GolazoX',            check: function(u){ return u.streak.best >= 7;   } },
    globalist:      { icon: '🌍', title: 'Globalista',          desc: '10 equipos distintos utilizados',       check: function(u){ return u.stats.uniqueTeamsUsed.length >= 10; } },
    collector:      { icon: '📦', title: 'Coleccionista',       desc: '25 equipos distintos utilizados',       check: function(u){ return u.stats.uniqueTeamsUsed.length >= 25; } },
    penalty_debut:  { icon: '🎪', title: 'Debut en Penaltis',   desc: 'Primera tanda de penaltis jugada',      check: function(u){ return u.stats.penaltiesPlayed >= 1;  } },
    penalty_king:   { icon: '🥅', title: 'Rey de Penaltis',     desc: '10 tandas de penaltis jugadas',         check: function(u){ return u.stats.penaltiesPlayed >= 10; } },
    goleador:       { icon: '🎯', title: 'Goleador',            desc: '100 goles totales simulados',           check: function(u){ return u.stats.totalGoals >= 100;    } },
    replay_fan:     { icon: '🔁', title: 'Fan del Replay',      desc: 'Repetiste un partido 3 veces',          check: function(u){ return (u.stats.maxReplays || 0) >= 3; } },
    level_5:        { icon: '⭐', title: 'Nivel 5',             desc: 'Alcanzaste el nivel 5',                 check: function(u){ return u.level >= 5;  } },
    level_10:       { icon: '💎', title: 'Nivel 10',            desc: 'Alcanzaste el nivel 10',                check: function(u){ return u.level >= 10; } },
  };

  // Valores de XP por acción
  var XP = {
    match:           10,
    goalBonus:       1,   // por gol (máx 8/partido)
    replayFirst:     5,   // repetición del mismo enfrentamiento
    replayRepeat:    3,   // 3ª repetición o más
    penalties:       8,
    tournamentLiga:  60,
    tournamentCopa:  80,
    tournamentChamp: 120,
    uniqueTeam:      15,  // primer uso de un equipo
    milestone10:     30,  // bonus al llegar a 10 equipos únicos
    milestone25:     75,  // bonus al llegar a 25 equipos únicos
    streak:          5,   // por día de racha (cap 5 días)
    activity30m:     5,   // por ser 30 min activo (máx 1/día)
  };

  var _PREFIXES = ['Tigre','Rayo','Trueno','Furia','Crack','Loco','Galáctico','Mago','Rey','Cohete','Brujo','Cañón'];
  var _SUFFIXES = ['Goleador','Veloz','Maestro','Campeón','Total','Elegante','Dinámico','Supremo','Histórico','Clásico','Atómico','Legendario'];

  function _randomName() {
    var p = _PREFIXES[Math.floor(Math.random() * _PREFIXES.length)];
    var s = _SUFFIXES[Math.floor(Math.random() * _SUFFIXES.length)];
    return p + s;
  }

  function _today() {
    return new Date().toISOString().slice(0, 10);
  }

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
      },
      unlockedTeams: [],
      achievements: [],
      recentMatches: [],
    };
  }

  function _load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _save(u) {
    try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (_) {}
  }

  function _migrate(u) {
    if (!u || typeof u !== 'object') return _defaultUser();
    if (!u.stats) u.stats = {};
    if (!Array.isArray(u.stats.uniqueTeamsUsed)) u.stats.uniqueTeamsUsed = [];
    if (!Array.isArray(u.unlockedTeams)) u.unlockedTeams = [];
    if (!Array.isArray(u.achievements)) u.achievements = [];
    if (!Array.isArray(u.recentMatches)) u.recentMatches = [];
    if (!u.streak) u.streak = { current: 0, best: 0, lastDate: null };
    if (u.stats.maxReplays === undefined) u.stats.maxReplays = 0;
    if (u.stats.minutesActive === undefined) u.stats.minutesActive = 0;
    if (u.stats.lastActiveDate === undefined) u.stats.lastActiveDate = null;
    if (u.stats.matchesPlayed === undefined) u.stats.matchesPlayed = 0;
    if (u.stats.tournamentsCompleted === undefined) u.stats.tournamentsCompleted = 0;
    if (u.stats.totalGoals === undefined) u.stats.totalGoals = 0;
    if (u.stats.penaltiesPlayed === undefined) u.stats.penaltiesPlayed = 0;
    return u;
  }

  function _getOrCreate() {
    var u = _load();
    if (!u) {
      u = _defaultUser();
      _save(u);
      return u;
    }
    return _migrate(u);
  }

  function _levelForXp(xp) {
    var lv = 1;
    for (var i = 1; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i]) lv = i + 1;
      else break;
    }
    return Math.min(lv, LEVELS.length);
  }

  function _updateStreak(u) {
    var today = _today();
    if (u.streak.lastDate === today) return 0;
    var bonus = 0;
    if (u.streak.lastDate) {
      var diff = Math.round((new Date(today) - new Date(u.streak.lastDate)) / 86400000);
      if (diff === 1) u.streak.current++;
      else if (diff > 1) u.streak.current = 1;
    } else {
      u.streak.current = 1;
    }
    if (u.streak.current > u.streak.best) u.streak.best = u.streak.current;
    u.streak.lastDate = today;
    bonus = XP.streak * Math.min(u.streak.current, 5);
    return bonus;
  }

  function _checkUnlocks(u) {
    var newUnlocks = [];
    var slugs = Object.keys(LOCKED_TEAMS);
    for (var i = 0; i < slugs.length; i++) {
      var slug = slugs[i];
      var info = LOCKED_TEAMS[slug];
      if (!u.unlockedTeams.includes(slug) && u.xp >= info.xp) {
        u.unlockedTeams.push(slug);
        newUnlocks.push({ slug: slug, label: info.label, era: info.era, xp: info.xp });
      }
    }
    return newUnlocks;
  }

  function _checkAchievements(u) {
    var newAchs = [];
    var ids = Object.keys(ACHIEVEMENTS);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var ach = ACHIEVEMENTS[id];
      if (!u.achievements.includes(id) && ach.check(u)) {
        u.achievements.push(id);
        newAchs.push({ id: id, icon: ach.icon, title: ach.title, desc: ach.desc });
      }
    }
    return newAchs;
  }

  // ── Núcleo XP ───────────────────────────────────────────────
  function addXP(reason, opts) {
    opts = opts || {};
    var u = _getOrCreate();
    var oldLevel = u.level;
    var gained = 0;

    if (reason === 'match') {
      var goals = Math.min(opts.goals || 0, 8);
      gained += XP.match + goals * XP.goalBonus;
      u.stats.matchesPlayed++;
      u.stats.totalGoals += (opts.goals || 0);

      // Equipos únicos
      ['teamA', 'teamB'].forEach(function (key) {
        var slug = opts[key];
        if (slug && !u.stats.uniqueTeamsUsed.includes(slug)) {
          u.stats.uniqueTeamsUsed.push(slug);
          gained += XP.uniqueTeam;
          if (u.stats.uniqueTeamsUsed.length === 10) gained += XP.milestone10;
          if (u.stats.uniqueTeamsUsed.length === 25) gained += XP.milestone25;
        }
      });

      // Replay del mismo enfrentamiento
      var matchKey = [opts.teamA || '', opts.teamB || ''].sort().join('|');
      var recentArr = u.recentMatches || [];
      var replays = recentArr.filter(function (m) { return m === matchKey; }).length;
      if (replays > 0) gained += replays < 3 ? XP.replayFirst : XP.replayRepeat;
      if (replays + 1 > (u.stats.maxReplays || 0)) u.stats.maxReplays = replays + 1;
      u.recentMatches = recentArr.slice(-49).concat([matchKey]);

      // Racha diaria
      gained += _updateStreak(u);

    } else if (reason === 'penalties') {
      gained = XP.penalties;
      u.stats.penaltiesPlayed++;
      _updateStreak(u);

    } else if (reason === 'tournament') {
      var fmt = opts.format || 'copa';
      if (fmt === 'champions')     gained = XP.tournamentChamp;
      else if (fmt === 'liga')     gained = XP.tournamentLiga;
      else                         gained = XP.tournamentCopa;
      u.stats.tournamentsCompleted++;
      _updateStreak(u);

    } else if (reason === 'activity') {
      var today = _today();
      if (u.stats.lastActiveDate !== today) {
        u.stats.lastActiveDate = today;
        u.stats.minutesActive = 0;
      }
      u.stats.minutesActive += 30;
      if (u.stats.minutesActive <= 30) gained = XP.activity30m;
    }

    u.xp += gained;
    u.level = _levelForXp(u.xp);
    var leveled = u.level > oldLevel;
    var newUnlocks = _checkUnlocks(u);
    var newAchs = _checkAchievements(u);
    _save(u);

    return {
      gained: gained,
      leveled: leveled,
      newLevel: leveled ? u.level : null,
      newUnlocks: newUnlocks,
      newAchs: newAchs,
      user: u,
    };
  }

  // ── Export / Import (backup code) ───────────────────────────
  function exportCode() {
    var u = _getOrCreate();
    try {
      var json = JSON.stringify(u);
      var b64  = btoa(unescape(encodeURIComponent(json)));
      // Código visible: 12 caracteres alfanuméricos mayúsculas en formato XXXX-XXXX-XXXX
      var clean = b64.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
      while (clean.length < 12) clean += 'X';
      var code = clean.slice(0, 4) + '-' + clean.slice(4, 8) + '-' + clean.slice(8, 12);
      localStorage.setItem('gx_export_b64', b64);
      return { code: code, b64: b64 };
    } catch (_) { return null; }
  }

  function importCode(b64) {
    try {
      var json = decodeURIComponent(escape(atob(b64)));
      var u    = JSON.parse(json);
      if (!u || typeof u.xp !== 'number') throw new Error('invalid');
      _save(_migrate(u));
      return true;
    } catch (_) { return false; }
  }

  // ── API pública ─────────────────────────────────────────────
  w.gxUser = {
    get:          _getOrCreate,
    addXP:        addXP,

    isLocked: function (slug) {
      if (!LOCKED_TEAMS[slug]) return false;
      var u = _getOrCreate();
      return !u.unlockedTeams.includes(slug);
    },
    getLockedInfo: function (slug) { return LOCKED_TEAMS[slug] || null; },

    exportCode:   exportCode,
    importCode:   importCode,

    reset: function () {
      try { localStorage.removeItem(KEY); localStorage.removeItem('gx_export_b64'); } catch (_) {}
    },

    // Constantes expuestas para gx-ui.js
    LEVELS:       LEVELS,
    LOCKED_TEAMS: LOCKED_TEAMS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    XP:           XP,

    xpForLevel:   function (lv) { return LEVELS[Math.max(0, lv - 1)] || 0; },
    nextLevelXP:  function (lv) { return LEVELS[lv] != null ? LEVELS[lv] : null; },
    levelForXp:   _levelForXp,
  };

}(window));
