(function () {
  'use strict';

  const KEY = 'gx_manager_career_v6';
  const CAREER_VERSION = 6;
  const MODERN_SEASON = 2025;
  const ROLE_LABELS = { manager: 'Entrenador', selector: 'Seleccionador', player: 'Jugador' };
  const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2'];
  const PYRAMIDS = [
    { first: '🇪🇸 La Liga', second: '🇪🇸 La Liga 2' },
    { first: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', second: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship' },
    { first: '🇩🇪 Bundesliga', second: '🇩🇪 2. Bundesliga' },
    { first: '🇮🇹 Serie A', second: '🇮🇹 Serie B' },
    { first: '🇫🇷 Ligue 1', second: '🇫🇷 Ligue 2' }
  ];
  const UEFA = new Set(['albanien', 'ddr', 'osterreich', 'bielorrussland', 'belgien', 'bosnien-herzegowina', 'bulgarien', 'kroatien', 'tschechien', 'danemark', 'england', 'finnland', 'frankreich', 'georgien', 'deutschland', 'griechenland', 'ungarn', 'island', 'ireland', 'israel', 'italien', 'niederlande', 'nordmazedonien', 'nordirland', 'norwegen', 'polen', 'portugal', 'rumania', 'russland', 'schottland', 'serbien', 'slowakei', 'slowenien', 'urss', 'spanien', 'schweden', 'schweiz', 'turkei', 'ukraine', 'wales', 'jugoslawien']);
  const CONMEBOL = new Set(['argentinien', 'bolivien', 'brasilien', 'chile', 'kolumbien', 'ecuador', 'paraguay', 'peru', 'uruguay', 'venezuela']);
  let catalog = [];
  let officialLeagues = {};
  let expandedLeagues = {};
  let state = null;

  const el = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const teamName = team => team?.nameEs || team?.name || team?.nameEn || team?.slug || '—';
  const money = value => `${Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
  const currentTeam = () => state.teams.find(team => team.slug === state.club.slug) || state.club;
  const findTeam = slug => state.teams.find(team => team.slug === slug) || catalog.find(team => team.slug === slug);
  const starters = () => state.squad.filter(player => player.starter);
  const average = (items, key) => items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / Math.max(1, items.length);
  const teamKey = team => teamName(team).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(fc|cf|cd|ud|rc|sd|ac|as|ss|sc|sm|club|futbol|football)\b/g, '').replace(/[^a-z0-9]/g, '');
  const isModernTeam = team => team?.seasons?.some(season => Number.parseInt(season, 10) >= MODERN_SEASON);
  const isCareerClub = team => isModernTeam(team) && team.group !== '🌍 Selecciones' && !/Otros|Fantasy XI|América del Sur/i.test(team.group || '');
  const findCareerTeam = (slug, group) => catalog.find(team => team.slug === slug && isCareerClub(team) && (!group || team.group === group));
  const activeEra = team => (team?.seasons || []).filter(season => Number.parseInt(season, 10) >= MODERN_SEASON).sort((a, b) => Number(b) - Number(a))[0] || '';
  const divisionProfile = group => {
    const pyramid = PYRAMIDS.find(item => item.first === group || item.second === group);
    return pyramid ? { ...pyramid, tier: pyramid.first === group ? 1 : 2 } : { first: group, second: null, tier: 1 };
  };
  const uniqueTeams = teams => [...new Map(teams.map(team => [teamKey(team), team])).values()];
  const catalogGroup = group => {
    const officialSlugs = officialLeagues[group] || expandedLeagues[group];
    const teams = officialSlugs?.length
      ? officialSlugs.map(slug => catalog.find(team => team.slug === slug)).filter(Boolean)
      : catalog.filter(team => team.group === group && isModernTeam(team));
    return uniqueTeams(teams.filter(isModernTeam));
  };
  const careerTeam = team => ({
    slug: team.slug, name: teamName(team), nameEs: team.nameEs, badge: team.badge,
    group: team.group, seasons: team.seasons, ovr: team.ovr || 74, seasonForm: random(-3, 3), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0
  });

  function save() {
    state.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    if (el('career-save-state')) el('career-save-state').textContent = 'Guardado automático · ahora';
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY));
      return parsed?.version === CAREER_VERSION && parsed.club && parsed.schedule ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function makeSchedule(teams) {
    const ids = shuffled(teams.map(team => team.slug));
    if (ids.length % 2) ids.push(null);
    const fixed = ids[0];
    const rotating = ids.slice(1);
    const firstLeg = [];
    for (let round = 0; round < ids.length - 1; round++) {
      const row = [fixed, ...rotating];
      const matches = [];
      for (let index = 0; index < row.length / 2; index++) {
        let home = row[index];
        let away = row[row.length - 1 - index];
        if (round % 2) [home, away] = [away, home];
        if (home && away) matches.push({ home, away, played: false, homeGoals: null, awayGoals: null });
      }
      firstLeg.push(matches);
      rotating.unshift(rotating.pop());
    }
    return firstLeg.concat(firstLeg.map(matches => matches.map(match => ({
      home: match.away, away: match.home, played: false, homeGoals: null, awayGoals: null
    }))));
  }

  function createFallbackSquad(club) {
    const positions = ['GK', 'GK', 'RB', 'CB', 'CB', 'LB', 'CB', 'DM', 'CM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST', 'ST', 'ST'];
    return positions.map((position, index) => ({
      id: `p${index}`, name: `Jugador ${index + 1}`, position,
      rating: clamp((club.ovr || 74) + random(-7, 5), 58, 92), age: random(19, 32),
      fitness: 100, morale: 72, starter: index < 11, apps: 0, goals: 0, assists: 0
    }));
  }

  async function getSquad(club) {
    try {
      const era = activeEra(club);
      const response = await fetch(`/lookup?team=${encodeURIComponent(club.slug)}&era=${encodeURIComponent(era)}`);
      if (!response.ok) throw new Error('Plantilla no disponible');
      const data = await response.json();
      const source = data.allPlayers?.length ? data.allPlayers : data.players;
      if (!source?.length || source.length < 11) throw new Error('Plantilla incompleta');
      return source.slice(0, 25).map((player, index) => ({
        id: `p${index}`, name: player.name || `Jugador ${index + 1}`,
        position: player.position || 'CM', rating: clamp(Number(player.rating) || club.ovr || 74, 55, 96),
        age: Number(player.age) || random(19, 32), fitness: 100, morale: 72,
        starter: index < 11, apps: 0, goals: 0, assists: 0
      }));
    } catch (_) {
      return createFallbackSquad(club);
    }
  }

  function matchingTeams() {
    const role = el('career-role').value;
    const group = role === 'selector' ? '🌍 Selecciones' : el('career-league').value;
    return catalogGroup(group);
  }

  function renderTeamPicker(query = '') {
    const teams = matchingTeams().sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const select = el('career-team');
    const selected = teams.find(team => team.slug === select.value) || teams[0];
    const trigger = el('career-team-trigger');
    trigger.disabled = !selected;
    if (!selected) {
      el('career-team-badge').src = '/img/badges/_placeholder.svg';
      el('career-team-name').textContent = 'Sin equipos disponibles';
      el('career-team-meta').textContent = 'Cambia de competición';
      el('career-team-grid').innerHTML = '';
      return;
    }
    select.value = selected.slug;
    el('career-team-badge').src = badge(selected);
    el('career-team-name').textContent = teamName(selected);
    el('career-team-meta').textContent = `${selected.ovr || '—'} media · ${selected.group}`;
    const needle = query.trim().toLowerCase();
    const visible = teams.filter(team => !needle || teamName(team).toLowerCase().includes(needle));
    el('career-team-grid').innerHTML = visible.length
      ? visible.map(team => `<button type="button" class="tp-team-card${team.slug === selected.slug ? ' is-selected' : ''}" data-career-team="${clean(team.slug)}"><img class="tp-team-badge" src="${clean(badge(team))}" alt=""><span class="tp-team-name">${clean(teamName(team))}</span><small>${team.ovr || '—'}</small></button>`).join('')
      : '<p class="career-team-empty">No hay equipos con ese nombre.</p>';
  }

  function populateTeams() {
    const teams = matchingTeams().sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    el('career-team').innerHTML = teams.map(team => `<option value="${clean(team.slug)}">${clean(teamName(team))} · ${team.ovr || '—'}</option>`).join('');
    el('career-team').disabled = !teams.length;
    el('career-start').disabled = !teams.length;
    const role = el('career-role').value;
    const careerTeams = role === 'selector' ? Math.min(16, teams.length) : teams.length;
    const rounds = careerTeams > 1 ? (careerTeams % 2 ? careerTeams * 2 : (careerTeams - 1) * 2) : 0;
    document.querySelector('.career-promise b').textContent = rounds || '—';
    document.querySelector('.career-promise span').textContent = roleRoundsLabel(role, careerTeams, rounds);
    el('career-team-search').value = '';
    el('career-team-menu').classList.add('hidden');
    el('career-team-trigger').setAttribute('aria-expanded', 'false');
    renderTeamPicker();
  }

  function roleRoundsLabel(role, teams, rounds) {
    return role === 'selector' ? `${teams} selecciones disponibles` : `${teams} equipos · ida y vuelta`;
  }

  function populateLeagues() {
    const select = el('career-league');
    const previous = select.value;
    const counts = new Map();
    [...new Set(catalog.filter(isCareerClub).map(team => team.group))].forEach(group => {
      counts.set(group, catalogGroup(group).length);
    });
    const groups = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    select.innerHTML = groups.map(([group, count]) => `<option value="${clean(group)}">${clean(group)} · ${count} equipos</option>`).join('');
    if (groups.some(([group]) => group === previous)) select.value = previous;
  }

  function updateRoleForm() {
    const role = el('career-role').value;
    const isPlayer = role === 'player';
    const isSelector = role === 'selector';
    el('career-position-field').classList.toggle('hidden', !isPlayer);
    el('career-style-field').classList.toggle('hidden', !isPlayer);
    el('career-league').closest('label').classList.toggle('hidden', isSelector);
    el('career-team').closest('label').childNodes[0].nodeValue = isSelector ? 'Selección' : 'Club';
    el('career-start').textContent = isPlayer ? 'Comenzar carrera' : isSelector ? 'Aceptar el cargo' : 'Firmar contrato';
    if (!isSelector) populateLeagues();
    populateTeams();
  }

  function careerLeagueTeams(group, selected, slugs) {
    const officialSlugs = officialLeagues[group] || [];
    const requestedSlugs = slugs?.length ? slugs : officialSlugs.length ? officialSlugs : catalogGroup(group).map(team => team.slug);
    const targetSize = officialSlugs.length || requestedSlugs.length;
    const primary = [...new Set(requestedSlugs)].map(slug => catalog.find(team => team.slug === slug)).filter(Boolean);
    const primarySlugs = new Set(primary.map(team => team.slug));
    const fallback = officialSlugs.filter(slug => !primarySlugs.has(slug)).map(slug => catalog.find(team => team.slug === slug)).filter(Boolean);
    const available = primary.concat(fallback).slice(0, targetSize);
    const rivals = available.filter(team => team.slug !== selected.slug).slice(0, Math.max(0, targetSize - 1));
    return rivals.concat(selected).map(careerTeam);
  }

  function competitionTeams(selected, role) {
    if (role === 'selector') {
      const national = catalogGroup('🌍 Selecciones');
      const regional = national.filter(team => UEFA.has(selected.slug) ? UEFA.has(team.slug) : CONMEBOL.has(selected.slug) ? CONMEBOL.has(team.slug) : !UEFA.has(team.slug) && !CONMEBOL.has(team.slug));
      return shuffled(regional.filter(team => team.slug !== selected.slug)).slice(0, 15).concat(selected).map(careerTeam);
    }
    return careerLeagueTeams(selected.group, selected);
  }

  function poisson(lambda) {
    const limit = Math.exp(-lambda);
    let product = 1;
    let goals = 0;
    do { goals++; product *= Math.random(); } while (product > limit && goals < 8);
    return goals - 1;
  }

  function worldScore(home, away) {
    const difference = (home.ovr || 70) + 1.5 - (away.ovr || 70);
    return [poisson(clamp(1.25 + difference / 13, 0.12, 3.8)), poisson(clamp(1.05 - difference / 13, 0.12, 3.5))];
  }

  function simulateWorldLeague(group, slugs) {
    const teams = slugs.map(slug => catalog.find(team => team.slug === slug)).filter(Boolean);
    const table = new Map(teams.map(team => [team.slug, { slug: team.slug, pts: 0, gf: 0, ga: 0 }]));
    for (let homeIndex = 0; homeIndex < teams.length; homeIndex++) {
      for (let awayIndex = homeIndex + 1; awayIndex < teams.length; awayIndex++) {
        const home = teams[homeIndex];
        const away = teams[awayIndex];
        const score = worldScore(home, away);
        const homeRow = table.get(home.slug);
        const awayRow = table.get(away.slug);
        homeRow.gf += score[0]; homeRow.ga += score[1]; awayRow.gf += score[1]; awayRow.ga += score[0];
        if (score[0] > score[1]) homeRow.pts += 3;
        else if (score[1] > score[0]) awayRow.pts += 3;
        else { homeRow.pts++; awayRow.pts++; }
      }
    }
    return [...table.values()].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf).map(row => row.slug);
  }

  function simulateFootballWorld() {
    const groups = state.world?.groups || Object.fromEntries([...new Set(catalog.filter(isCareerClub).map(team => team.group))]
      .map(group => [group, catalogGroup(group).map(team => team.slug)]));
    const rankings = {};
    Object.entries(groups).forEach(([group, slugs]) => {
      rankings[group] = group === state.league
        ? sortedTable().map(team => team.slug).concat(slugs.filter(slug => !state.teams.some(team => team.slug === slug)))
        : simulateWorldLeague(group, slugs);
    });
    PYRAMIDS.forEach(({ first, second }) => {
      if (!groups[first]?.length || !groups[second]?.length) return;
      const relegated = rankings[first].slice(-2);
      const promoted = rankings[second].slice(0, 2);
      groups[first] = groups[first].filter(slug => !relegated.includes(slug)).concat(promoted);
      groups[second] = groups[second].filter(slug => !promoted.includes(slug)).concat(relegated);
    });
    const qualifiers = PYRAMIDS.flatMap(({ first }) => (rankings[first] || []).slice(0, 4));
    const southAmericanFirsts = Object.keys(groups).filter(group => /Brasileirão|Argentina Primera|América del Sur/.test(group));
    southAmericanFirsts.forEach(group => qualifiers.push(...(rankings[group] || []).slice(0, 4)));
    state.world = { groups, rankings, qualifiers: [...new Set(qualifiers)] };
  }

  function shuffled(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = random(0, index);
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function createCompetition(id, name, type, participants, seeded, requestedSize = 16) {
    const unique = [...new Set(participants)];
    const user = state.club.slug;
    const rivals = unique.filter(slug => slug !== user);
    const availableSize = Math.max(2, 2 ** Math.floor(Math.log2(Math.max(2, unique.length))));
    const bracketSize = Math.min(requestedSize, availableSize);
    const selectedRivals = seeded
      ? rivals.sort((a, b) => (findTeam(b)?.ovr || 0) - (findTeam(a)?.ovr || 0)).slice(0, bracketSize - 1)
      : shuffled(rivals).slice(0, bracketSize - 1);
    const draw = unique.includes(user) ? selectedRivals.concat(user) : shuffled(unique).slice(0, bracketSize);
    return { id, name, type, participants: shuffled(draw), rounds: [], status: 'ready', champion: null };
  }

  function createLeaguePhaseCompetition(participants) {
    const available = [...new Set(participants)].filter(slug => findTeam(slug));
    return {
      id: 'champions', name: 'Champions League', type: 'Fase liga · 36 equipos · 8 jornadas',
      format: 'league-phase', participants: shuffled(available), rounds: [], leagueTable: [],
      leaguePhaseComplete: false, knockoutParticipants: [], knockoutStartRound: 0,
      status: 'ready', champion: null
    };
  }

  function groupRanking(group) {
    return state.world?.rankings?.[group]
      || catalogGroup(group).sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).map(team => team.slug);
  }

  function rankedPool(groups, from, to) {
    return [...new Set(groups.flatMap(group => groupRanking(group).slice(from, to)))];
  }

  function buildSeasonCompetitions() {
    if (state.role === 'selector') {
      const national = catalog.filter(team => team.group === '🌍 Selecciones' && isModernTeam(team));
      if (state.season % 2 === 0) return [createCompetition('world', 'Mundial', 'Selecciones · fase final', national.map(team => team.slug), false, 16)];
      if (UEFA.has(state.club.slug)) return [createCompetition('euro', 'Eurocopa', 'UEFA · fase final', national.filter(team => UEFA.has(team.slug)).map(team => team.slug), false, 16)];
      if (CONMEBOL.has(state.club.slug)) return [createCompetition('copa-america', 'Copa América', 'CONMEBOL · fase final', national.filter(team => CONMEBOL.has(team.slug)).map(team => team.slug), false, 16)];
      return [createCompetition('continental', 'Copa continental', 'Selecciones · fase final', national.filter(team => !UEFA.has(team.slug) && !CONMEBOL.has(team.slug)).map(team => team.slug), false, 16)];
    }
    const division = divisionProfile(state.league);
    const groups = [...new Set(catalog.filter(isCareerClub).map(team => team.group))];
    const europeanGroups = PYRAMIDS.map(pyramid => pyramid.first).filter(group => groups.includes(group));
    const domesticGroups = division.second ? [division.first, division.second] : [state.league];
    const cupSlugs = [...new Set(domesticGroups.flatMap(group => state.world?.groups?.[group] || catalogGroup(group).map(team => team.slug)))];
    const currentChampions = expandedLeagues['🏆 UEFA Champions League'] || [];
    const champions = state.season === 1 && currentChampions.length === 36
      ? currentChampions.filter(slug => findTeam(slug))
      : rankedPool(europeanGroups, 0, 8).slice(0, 36);
    const europa = rankedPool(europeanGroups, 4, 6);
    const conference = rankedPool(europeanGroups, 6, 8);
    const competitions = [createCompetition('cup', 'Copa nacional', 'Primera y Segunda · eliminación directa', cupSlugs, false, 16)];
    if (division.tier === 1 && champions.includes(state.club.slug) && champions.length === 36) competitions.push(createLeaguePhaseCompetition(champions));
    else if (division.tier === 1 && europa.includes(state.club.slug)) competitions.push(createCompetition('europa', 'Europa League', 'Torneo continental · 16 equipos', europa, false, 16));
    else if (division.tier === 1 && conference.includes(state.club.slug)) competitions.push(createCompetition('conference', 'Conference League', 'Torneo continental · 16 equipos', conference, false, 16));
    return competitions;
  }

  function playerValue(player) {
    const ageFactor = player.age <= 23 ? 1.25 : player.age >= 30 ? 0.72 : 1;
    return Number(clamp(((player.rating - 55) ** 2) / 13 * ageFactor, 0.8, 145).toFixed(1));
  }

  const squadValue = () => Number(state.squad.reduce((sum, player) => sum + playerValue(player), 0).toFixed(1));
  const clubAssets = () => Number((Math.max(0, state.budget || 0) + squadValue()).toFixed(1));

  function updateClubOverall() {
    const best = state.squad.filter(player => player.loan?.type !== 'out').sort((a, b) => b.rating - a.rating).slice(0, 11);
    if (!best.length) return;
    const overall = Math.round(average(best, 'rating'));
    state.club.ovr = overall;
    const leagueClub = state.teams.find(team => team.slug === state.club.slug);
    if (leagueClub) leagueClub.ovr = overall;
  }

  function developSquad() {
    const improvements = [];
    state.squad.forEach(player => {
      if (player.user || player.loan?.type === 'out') return;
      const previous = player.rating;
      const age = Number(player.age) || 24;
      const appearances = Number(player.apps) || 0;
      const contribution = Number(player.goals || 0) + Number(player.assists || 0);
      let growth = age <= 20 ? 1 : age <= 23 && appearances >= 8 ? 1 : 0;
      if (age <= 24 && state.training === 'youth') growth++;
      if (age <= 28 && (appearances >= 22 || contribution >= 12)) growth++;
      if (age >= 33 && appearances < 18) growth--;
      player.rating = clamp(player.rating + growth, 55, 96);
      if (player.rating !== previous) improvements.push({ name: player.name, from: previous, to: player.rating, delta: player.rating - previous });
    });
    updateClubOverall();
    return improvements.sort((a, b) => b.delta - a.delta || b.to - a.to);
  }

  function simulatedPlayerStats(player) {
    const matches = Math.max(18, state.schedule.length);
    const positionFactor = player.position === 'ST' ? 1.3 : ['LW', 'RW', 'AM'].includes(player.position) ? 1 : ['CM', 'RM', 'LM'].includes(player.position) ? .55 : .18;
    const expectedGoals = clamp((player.rating - 58) * .62 * positionFactor * (matches / 38), .5, 34);
    let goals = 0;
    for (let period = 0; period < 6; period++) goals += poisson(expectedGoals / 6);
    const assists = Math.max(0, Math.round(goals * random(20, 65) / 100 + (player.rating - 65) / 5 + random(-2, 3)));
    return { goals, assists };
  }

  function calculateSeasonAwards() {
    const userPlayers = state.squad.map(player => ({
      name: player.name, club: state.club.slug, position: player.position, rating: player.rating,
      goals: player.goals || 0, assists: player.assists || 0, user: Boolean(player.user)
    }));
    const simulated = (state.awardPool || state.market || []).map(player => {
      const stats = simulatedPlayerStats(player);
      return { name: player.name, club: player.club, position: player.position, rating: player.rating, ...stats, user: false };
    });
    const candidates = [...new Map(userPlayers.concat(simulated).map(player => [`${player.name}|${player.club}`, player])).values()];
    const goldenBoot = candidates.slice().sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.rating - a.rating)[0];
    const ballonDor = candidates.map(player => ({
      ...player,
      awardScore: player.rating * 1.2 + player.goals * .9 + player.assists * .35
    })).sort((a, b) => b.awardScore - a.awardScore)[0];
    return {
      season: state.season,
      goldenBoot: goldenBoot ? { name: goldenBoot.name, club: goldenBoot.club, goals: goldenBoot.goals, assists: goldenBoot.assists, rating: goldenBoot.rating, user: goldenBoot.user } : null,
      ballonDor: ballonDor ? { name: ballonDor.name, club: ballonDor.club, goals: ballonDor.goals, assists: ballonDor.assists, rating: ballonDor.rating, user: ballonDor.user } : null
    };
  }

  async function getMarketPlayers(club) {
    const rivals = state.teams.filter(team => team.slug !== club.slug).slice(0, 5);
    const squads = await Promise.all(rivals.map(async team => {
      try {
        const response = await fetch(`/lookup?team=${encodeURIComponent(team.slug)}&era=${encodeURIComponent(activeEra(team))}`);
        const data = response.ok ? await response.json() : {};
        const players = data.allPlayers?.length ? data.allPlayers : data.players || [];
        return players.slice(0, 5).map((player, index) => {
          const rating = clamp(Number(player.rating) || team.ovr || 72, 58, 95);
          const age = Number(player.age) || random(19, 32);
          const value = playerValue({ rating, age });
          return { id: `m-${team.slug}-${index}`, name: player.name || `Jugador ${index + 1}`, position: player.position || 'CM', rating, age, value, clause: Number((value * 1.65).toFixed(1)), club: team.slug };
        });
      } catch (_) {
        return [];
      }
    }));
    return squads.flat().sort((a, b) => b.rating - a.rating);
  }

  async function scoutTeam(slug) {
    const team = catalog.find(item => item.slug === slug);
    if (!team) return;
    try {
      const response = await fetch(`/lookup?team=${encodeURIComponent(team.slug)}&era=${encodeURIComponent(activeEra(team))}`);
      const data = response.ok ? await response.json() : {};
      const source = data.allPlayers?.length ? data.allPlayers : data.players || [];
      state.market = source.slice(0, 25).map((player, index) => {
        const rating = clamp(Number(player.rating) || team.ovr || 72, 58, 95);
        const age = Number(player.age) || random(19, 32);
        const value = playerValue({ rating, age });
        return { id: `m-${team.slug}-${index}`, name: player.name || `Jugador ${index + 1}`, position: player.position || 'CM', rating, age, value, clause: Number((value * 1.65).toFixed(1)), club: team.slug };
      }).sort((a, b) => b.rating - a.rating);
      state.marketSearch = '';
      save();
      renderMarket();
    } catch (_) {
      state.inbox.unshift({ title: 'Informe no disponible', text: `No se pudo cargar la plantilla de ${teamName(team)}.` });
      render();
    }
  }

  async function createCareer(event) {
    event.preventDefault();
    const selected = matchingTeams().find(team => team.slug === el('career-team').value);
    if (!selected) return;
    const role = el('career-role').value;
    const teams = competitionTeams(selected, role);
    const club = teams.find(team => team.slug === selected.slug) || teams[0];
    state = {
      version: CAREER_VERSION, role, name: el('career-name').value.trim() || ROLE_LABELS[role],
      league: role === 'selector' ? '🌍 Selecciones' : el('career-league').value,
      club, teams, squad: [], schedule: makeSchedule(teams), round: 0, season: 1,
      budget: role === 'selector' ? 0 : Math.max(10, Math.round(((selected.ovr || 74) - 65) * 3.2)),
      balance: 0, board: 72, fans: 68, training: 'balanced', talk: 'calm', priority: 'sport',
      tactics: { formation: '4-3-3', mentality: 'balanced', press: 'medium', tempo: 'balanced' },
      inbox: [{ title: role === 'player' ? 'Tu oportunidad empieza aquí' : 'Bienvenido al cargo', text: role === 'selector' ? 'La federación exige resultados y una convocatoria con identidad.' : role === 'player' ? 'Gana minutos, mejora tus atributos y construye tu carrera.' : 'La directiva espera identidad, resultados y cuentas bajo control.' }],
      history: [], awards: [], lastResult: null, market: [], awardPool: [], offers: [], transfers: [], competitions: [], dismissed: false,
      player: role === 'player' ? {
        name: el('career-name').value.trim() || 'Promesa', position: el('career-player-position').value,
        style: el('career-player-style').value, rating: 67, age: 18, minutes: 0, goals: 0, assists: 0,
        careerMinutes: 0, careerGoals: 0, careerAssists: 0,
        starts: 0, form: 6.5, contract: 3, salary: 0.4, earnings: 0, status: 'Suplente'
      } : null
    };
    state.squad = await getSquad(selected);
    if (state.player) injectCareerPlayer();
    if (role !== 'selector') state.market = await getMarketPlayers(club);
    state.awardPool = state.market.slice(0, 40);
    state.competitions = buildSeasonCompetitions();
    save();
    render();
  }

  function injectCareerPlayer() {
    const player = state.player;
    const profile = { id: 'career-player', name: player.name, position: player.position, rating: player.rating, age: player.age, morale: 75, fitness: 100, starter: false, user: true, apps: 0, goals: 0, assists: 0 };
    const slot = state.squad.find(candidate => !candidate.starter && candidate.position === player.position)
      || state.squad.find(candidate => !candidate.starter);
    if (slot) Object.assign(slot, profile);
    else state.squad.push(profile);
  }

  function sortedTable() {
    return state.teams.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || teamName(a).localeCompare(teamName(b)));
  }

  function userPosition() {
    return sortedTable().findIndex(team => team.slug === state.club.slug) + 1;
  }

  function nextUserMatch() {
    return state.schedule[state.round]?.find(match => match.home === state.club.slug || match.away === state.club.slug);
  }

  function badge(team) {
    return team?.badge || '/img/badges/_placeholder.svg';
  }

  function roleUi() {
    const labels = state.role === 'selector'
      ? { squad: 'Convocatoria', market: 'Observación', office: 'Federación', inbox: 'BANDEJA DE LA FEDERACIÓN', budget: 'Prestigio', board: 'Federación' }
      : state.role === 'player'
        ? { squad: 'Equipo', market: 'Ofertas', office: 'Mi carrera', inbox: 'MENSAJES DEL AGENTE', budget: 'Valor', board: 'Confianza' }
        : { squad: 'Plantilla', market: 'Mercado', office: 'Despacho', inbox: 'BANDEJA DEL MÍSTER', budget: 'Presupuesto', board: 'Directiva' };
    const setTabLabel = (name, label) => { document.querySelector(`[data-career-tab="${name}"] span:last-child`).textContent = label; };
    setTabLabel('squad', labels.squad);
    setTabLabel('tactics', state.role === 'player' ? 'Desarrollo' : state.role === 'selector' ? 'Sistema' : 'Táctica');
    setTabLabel('market', labels.market);
    setTabLabel('office', labels.office);
    el('career-game').dataset.role = state.role;
    document.querySelector('.career-inbox > span').textContent = labels.inbox;
    const terms = document.querySelectorAll('.career-scoreboard dt');
    terms[0].textContent = 'Jornada';
    terms[1].textContent = 'Posición';
    terms[2].textContent = labels.budget;
    terms[3].textContent = labels.board;
    if (state.role === 'player') {
      terms[0].textContent = 'Partido';
      terms[1].textContent = 'Rol';
      terms[2].textContent = 'Salario';
      terms[3].textContent = 'Media';
    }
    const decisionsRoot = document.querySelector('.career-decisions');
    if (decisionsRoot.dataset.role !== state.role) {
      decisionsRoot.dataset.role = state.role;
      const decisions = state.role === 'player'
        ? [
          ['Plan individual', [['balanced', 'Trabajo equilibrado'], ['intense', 'Gimnasio e intensidad'], ['recovery', 'Recuperación'], ['youth', 'Técnica y definición']]],
          ['Relación con el entrenador', [['calm', 'Perfil bajo'], ['demand', 'Pedir más minutos'], ['motivate', 'Liderar el vestuario']]],
          ['Objetivo personal', [['sport', 'Rendimiento deportivo'], ['finance', 'Mejor contrato'], ['fans', 'Popularidad']]]
        ]
        : state.role === 'selector'
          ? [
            ['Plan de concentración', [['balanced', 'Equilibrado'], ['intense', 'Alta intensidad'], ['recovery', 'Recuperación'], ['youth', 'Probar jóvenes']]],
            ['Mensaje al país', [['calm', 'Sin presión'], ['demand', 'Exigir victoria'], ['motivate', 'Motivar al grupo']]],
            ['Prioridad federativa', [['sport', 'Resultados'], ['finance', 'Proyecto sostenible'], ['fans', 'Conectar con la afición']]]
          ]
          : [
            ['Plan semanal', [['balanced', 'Equilibrado'], ['intense', 'Intensidad alta'], ['recovery', 'Recuperación'], ['youth', 'Cantera']]],
            ['Charla al equipo', [['calm', 'Sin presión'], ['demand', 'Exigir victoria'], ['motivate', 'Motivar al grupo']]],
            ['Prioridad del club', [['sport', 'Resultados'], ['finance', 'Sanear cuentas'], ['fans', 'Afición']]]
          ];
      ['training', 'talk', 'priority'].forEach((key, index) => {
        const select = el(`career-${key}`);
        select.closest('label').childNodes[0].nodeValue = decisions[index][0];
        select.innerHTML = decisions[index][1].map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
        select.value = state[key];
      });
    }
  }

  function renderHeader() {
    const club = currentTeam();
    el('career-badge').src = badge(club);
    el('career-club').textContent = teamName(club);
    el('career-manager').textContent = `${state.name} · ${ROLE_LABELS[state.role]} · Temporada ${state.season}`;
    el('career-round').textContent = `${Math.min(state.round + 1, state.schedule.length)}/${state.schedule.length}`;
    el('career-position').textContent = state.role === 'player' ? state.player.status : `${userPosition()}º`;
    el('career-budget').textContent = state.role === 'selector' ? `${Math.round((state.board + state.fans) / 2)}/100` : state.role === 'player' ? `${state.player.salary.toFixed(1)} M€/año` : money(state.budget);
    el('career-board').textContent = state.role === 'player' ? state.player.rating : `${Math.round(state.board)}%`;
  }

  function fixtureHtml(match) {
    if (!match) return state.round < state.schedule.length
      ? '<div class="career-bye"><b>Jornada de descanso</b><span>El equipo recupera energía mientras se disputa el resto de partidos.</span></div>'
      : '<p>Temporada finalizada.</p>';
    const home = findTeam(match.home);
    const away = findTeam(match.away);
    return `<div class="career-fixture"><div class="career-fixture-team"><img src="${clean(badge(home))}" alt=""><span>${clean(teamName(home))}</span></div><b class="career-fixture-vs">VS</b><div class="career-fixture-team"><img src="${clean(badge(away))}" alt=""><span>${clean(teamName(away))}</span></div></div>`;
  }

  function renderHub() {
    el('career-next-match').innerHTML = fixtureHtml(nextUserMatch());
    el('career-play-match').textContent = state.dismissed ? 'Contrato finalizado' : state.round >= state.schedule.length ? 'Comenzar nueva temporada' : state.role === 'player' ? 'Jugar partido' : `Dirigir jornada ${state.round + 1}`;
    el('career-play-match').disabled = state.dismissed;
    el('career-sim-season').disabled = state.dismissed;
    el('career-sim-career').disabled = state.dismissed;
    el('career-inbox').innerHTML = state.inbox.slice(0, 3).map(item => `<div class="career-inbox-item"><b>${clean(item.title)}</b><p>${clean(item.text)}</p></div>`).join('');
    el('career-training').value = state.training;
    el('career-talk').value = state.talk;
    el('career-priority').value = state.priority;
    const result = el('career-result');
    result.classList.toggle('hidden', !state.lastResult);
    result.classList.remove('is-win', 'is-draw', 'is-loss');
    if (state.lastResult) {
      result.classList.add(`is-${state.lastResult.outcome || 'draw'}`);
      result.innerHTML = state.lastResult.home
        ? `<div class="career-result-top"><span>${clean(state.lastResult.headline)}</span><b>JORNADA ${state.lastResult.round}</b></div><div class="career-result-board"><div><img src="${clean(badge(findTeam(state.lastResult.home)))}" alt=""><strong>${clean(teamName(findTeam(state.lastResult.home)))}</strong></div><p><b>${state.lastResult.homeGoals}</b><i>—</i><b>${state.lastResult.awayGoals}</b></p><div><img src="${clean(badge(findTeam(state.lastResult.away)))}" alt=""><strong>${clean(teamName(findTeam(state.lastResult.away)))}</strong></div></div><footer><span>${clean(state.lastResult.detail)}</span><b>${userPosition()}º en liga</b></footer>`
        : `<strong>${clean(state.lastResult.headline)}</strong><div class="career-result-score">${clean(state.lastResult.score)}</div><span>${clean(state.lastResult.detail)}</span>`;
    }
    const review = el('career-season-review');
    review.classList.toggle('hidden', !state.seasonReview);
    if (state.seasonReview) {
      const season = state.seasonReview;
      if (!season.awards) {
        season.awards = calculateSeasonAwards(season.trophies || []);
        state.awards = state.awards || [];
        if (!state.awards.some(item => item.season === season.season)) state.awards.unshift(season.awards);
        save();
      }
      const offers = state.role === 'player'
        ? state.offers.filter(offer => offer.type === 'player').map(offer => { const team = findCareerTeam(offer.club, offer.group) || findTeam(offer.club); return `<button class="career-next-offer" data-season-action="agent"><img src="${clean(badge(team))}" alt=""><span><strong>${clean(teamName(team))}</strong><small>${clean(offer.group || team?.group || 'Nuevo club')} · ${offer.contract || 1} temporadas</small></span><b>${offer.salary.toFixed(1)} M€/año</b></button>`; }).join('')
        : (state.jobOffers || []).map(offer => { const slug = offer.club || offer.slug; const team = findCareerTeam(slug, offer.group) || findTeam(slug) || offer; return `<button class="career-next-offer" data-season-action="job" data-club="${clean(slug)}"><img src="${clean(badge(team))}" alt=""><span><strong>${clean(teamName(team))}</strong><small>${clean(offer.group || team?.group || 'Nuevo proyecto')}</small></span><b>${money(offer.budget)}</b></button>`; }).join('');
      const seasonDetail = state.role === 'player' && season.playerStats
        ? `${clean(season.outcome)} · ${season.playerStats.goals} goles · ${season.playerStats.assists} asistencias · media ${season.playerStats.rating}`
        : state.role === 'selector' ? clean(season.outcome) : clean(season.outcome);
      const awardHtml = `<div class="career-season-awards"><span><b>◆ BALÓN DE ORO</b><strong>${clean(season.awards.ballonDor?.name || 'Sin ganador')}</strong></span><span><b>▲ BOTA DE ORO</b><strong>${clean(season.awards.goldenBoot?.name || 'Sin ganador')}</strong><small>${season.awards.goldenBoot?.goals || 0} goles</small></span></div>`;
      review.innerHTML = `<header><span>CIERRE DE TEMPORADA ${season.season}</span><strong>${seasonDetail}</strong></header><div class="career-season-stats"><span><small>POSICIÓN</small><b>${season.position}º</b></span><span><small>PUNTOS</small><b>${season.points}</b></span><span><small>BALANCE GOLEADOR</small><b>${season.gf}–${season.ga}</b></span><span><small>PREMIO</small><b>${money(season.prize)}</b></span></div><div class="career-season-honours"><div class="career-season-trophies"><small>PALMARÉS</small>${season.trophies.length ? season.trophies.map(trophy => `<strong>🏆 ${clean(trophy)}</strong>`).join('') : '<span>Sin títulos</span>'}</div>${awardHtml}</div>${offers ? `<section class="career-job-offers"><header><strong>${state.role === 'player' ? 'Propuestas de tu agente' : 'Tu futuro'}</strong><span>Elige proyecto o continúa construyendo el actual</span></header><div>${offers}</div></section>` : ''}<footer><button data-season-action="continue">${state.careerRun ? 'Simular siguiente temporada' : 'Continuar en el club'}</button>${state.careerRun ? '<button data-season-action="stop">Detener simulación</button>' : ''}</footer>`;
      const goalStat = review.querySelector('.career-season-stats span:nth-child(3)');
      if (goalStat) goalStat.innerHTML = `<small>GOLES A FAVOR / EN CONTRA</small><b>${season.gf} GF · ${season.ga} GC</b>`;
      if (season.development?.length) review.querySelector('footer')?.insertAdjacentHTML('beforebegin', `<section class="career-development"><header><span>EVOLUCIÓN DE MEDIA</span><strong>${season.development.filter(item => item.delta > 0).length} jugadores mejoran</strong></header><div>${season.development.slice(0, 8).map(item => `<span><b>${clean(item.name)}</b><small>${item.from} → ${item.to}</small><i class="${item.delta > 0 ? 'is-up' : 'is-down'}">${item.delta > 0 ? '+' : ''}${item.delta}</i></span>`).join('')}</div></section>`);
    }
  }

  function renderSquad() {
    el('career-lineup-count').textContent = `${starters().length}/11`;
    document.querySelector('[data-career-panel="squad"] h4').textContent = state.role === 'selector' ? 'Convocatoria y once nacional' : state.role === 'player' ? 'Competencia por un puesto' : 'Convocatoria y once titular';
    el('career-squad').innerHTML = state.squad.slice().sort((a, b) => Number(b.user) - Number(a.user) || Number(b.starter) - Number(a.starter) || b.rating - a.rating).map(player => {
      const locked = state.role === 'player' || player.loan?.type === 'out' ? ' disabled' : '';
      const status = player.loan?.type === 'out' ? `Cedido a ${teamName(findTeam(player.loan.club))}` : player.loan?.type === 'in' ? `Cedido por ${teamName(findTeam(player.loan.club))}` : player.starter ? 'Titular' : 'Suplente';
      return `<button type="button" class="career-player-row${player.starter ? ' is-starting' : ''}${player.user ? ' is-user' : ''}${player.loan ? ' is-loan' : ''}" data-player="${clean(player.id)}"${locked}><span class="career-player-pos">${clean(player.position)}</span><span><b>${clean(player.name)}${player.user ? ' · TÚ' : ''}</b><small>${clean(status)} · ${player.apps || 0} PJ · ${player.goals || 0} G · ${player.assists || 0} A</small></span><span class="career-player-rating">${player.rating}</span><span class="career-player-energy">${Math.round(player.fitness)}%</span></button>`;
    }).join('');
  }

  function renderTactics() {
    if (state.role === 'player') {
      const player = state.player;
      const progress = clamp((player.rating - 55) / 40 * 100, 0, 100);
      el('career-tactics').innerHTML = `<div class="career-player-profile"><header><span>DESARROLLO INDIVIDUAL</span><strong>${clean(player.name)}</strong><small>${clean(player.position)} · ${clean(player.style)} · ${player.age} años</small></header><div class="career-player-overall"><b>${player.rating}</b><span>MEDIA</span></div><div class="career-progress"><span style="width:${progress}%"></span></div><div class="career-player-metrics"><div><span>ROL</span><b>${clean(player.status)}</b></div><div><span>FORMA</span><b>${player.form.toFixed(1)}</b></div><div><span>TITULARIDADES</span><b>${player.starts}</b></div><div><span>MINUTOS</span><b>${player.minutes}</b></div></div><p>Tu plan semanal modifica minutos, forma y evolución. El entrenador decide el once según tu media y rendimiento.</p></div>`;
      return;
    }
    const canManage = state.role !== 'player';
    el('career-tactics').innerHTML = `<div class="career-tactic-controls"><label class="career-control">Formación<select data-tactic="formation"${canManage ? '' : ' disabled'}>${FORMATIONS.map(value => `<option${state.tactics.formation === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label class="career-control">Mentalidad<select data-tactic="mentality"${canManage ? '' : ' disabled'}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Atacante</option></select></label><label class="career-control">Presión<select data-tactic="press"${canManage ? '' : ' disabled'}><option value="low">Bloque bajo</option><option value="medium">Media</option><option value="high">Alta</option></select></label><label class="career-control">Ritmo<select data-tactic="tempo"${canManage ? '' : ' disabled'}><option value="patient">Pausado</option><option value="balanced">Mixto</option><option value="fast">Vertical</option></select></label><div class="career-tactic-summary"><div><span>MEDIA XI</span><b>${average(starters(), 'rating').toFixed(1)}</b></div><div><span>MORAL</span><b>${Math.round(average(state.squad, 'morale'))}</b></div><div><span>FÍSICO</span><b>${Math.round(average(starters(), 'fitness'))}</b></div></div><div class="career-factors"><h4>Impacto de tus decisiones <b>${careerModifier() >= 0 ? '+' : ''}${careerModifier().toFixed(1)}</b></h4>${careerFactors().map(factor => `<div class="${factor.value >= 0 ? 'is-positive' : 'is-negative'}"><span>${clean(factor.label)}</span><b>${factor.value >= 0 ? '+' : ''}${factor.value.toFixed(1)}</b></div>`).join('')}</div></div><div class="career-pitch"><div class="career-pitch-note">${state.role === 'player' ? `${clean(state.player.position)} · ${clean(state.player.status)} · valoración ${state.player.rating}` : `${state.tactics.formation} · ${state.tactics.mentality} · presión ${state.tactics.press}`}</div></div>`;
    Object.entries(state.tactics).forEach(([key, value]) => {
      const input = el('career-tactics').querySelector(`[data-tactic="${key}"]`);
      if (input) input.value = value;
    });
  }

  function renderCalendar() {
    const winterRound = Math.floor(state.schedule.length / 2);
    el('career-calendar').innerHTML = state.schedule.map((matches, index) => `<section class="career-round-block"><h5>Jornada ${index + 1}${index === state.round ? ' · próxima' : ''}${index === winterRound ? ' · mercado de invierno' : ''}</h5>${matches.map(match => `<div class="career-match-row${match.home === state.club.slug || match.away === state.club.slug ? ' is-user' : ''}"><span><img src="${clean(badge(findTeam(match.home)))}" alt="">${clean(teamName(findTeam(match.home)))}</span><b>${match.played ? `${match.homeGoals} - ${match.awayGoals}` : '—'}</b><span><img src="${clean(badge(findTeam(match.away)))}" alt="">${clean(teamName(findTeam(match.away)))}</span></div>`).join('')}</section>`).join('');
  }

  function renderTable() {
    const division = divisionProfile(state.league);
    const rows = sortedTable().map((team, index) => {
      const zone = division.tier === 2 && index < 2 ? 'is-promotion' : division.tier === 2 && index < 4 ? 'is-playoff' : division.tier === 1 && division.second && index >= state.teams.length - 2 ? 'is-relegation' : '';
      return `<tr class="${team.slug === state.club.slug ? 'is-user ' : ''}${zone}"><td>${index + 1}</td><td><img src="${clean(badge(team))}" alt="">${clean(teamName(team))}</td><td>${team.p}</td><td>${team.w}</td><td>${team.d}</td><td>${team.l}</td><td>${team.gf}</td><td>${team.ga}</td><td>${team.gf - team.ga}</td><td><b>${team.pts}</b></td></tr>`;
    }).join('');
    const legend = division.tier === 2 ? '<span class="is-promotion">Ascenso directo</span><span class="is-playoff">Playoff</span>' : division.second ? '<span class="is-relegation">Descenso</span>' : '';
    el('career-table').innerHTML = `<div class="career-table-head"><div><span>CAMPEONATO</span><h4>${clean(state.league)}</h4></div><div>${legend}</div></div><table class="career-standings"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderCompetitions() {
    const competitions = state.competitions.map(competition => {
      const champion = competition.champion ? findTeam(competition.champion) : null;
      const rounds = competition.rounds.map(round => `<div class="career-bracket-round"><h5>${clean(round.label)}</h5>${round.matches.map(match => `<div class="career-bracket-match"><span><img src="${clean(badge(findTeam(match.home)))}" alt="">${clean(teamName(findTeam(match.home)))}</span><b>${match.homeGoals} - ${match.awayGoals}</b><span><img src="${clean(badge(findTeam(match.away)))}" alt="">${clean(teamName(findTeam(match.away)))}</span></div>`).join('')}</div>`).join('');
      const leagueTable = competition.leagueTable?.length ? `<div class="career-bracket-round"><h5>Clasificación de la fase liga</h5>${competition.leagueTable.map((row, index) => `<div class="career-bracket-match"><b>${index + 1}</b><span><img src="${clean(badge(findTeam(row.slug)))}" alt="">${clean(teamName(findTeam(row.slug)))}</span><strong>${row.pts} pts · ${row.gf - row.ga >= 0 ? '+' : ''}${row.gf - row.ga}</strong></div>`).join('')}</div>` : '';
      const pending = competition.format === 'league-phase' ? 'Fase liga preparada: 36 equipos, 8 rivales por club.' : `Cuadro preparado. ${competition.participants.length} equipos, eliminación directa.`;
      return `<article class="career-competition"><header><div><span>${clean(competition.type)}</span><h4>${clean(competition.name)}</h4></div>${champion ? `<strong><img src="${clean(badge(champion))}" alt="">${clean(teamName(champion))} campeón</strong>` : `<strong>${competition.participants.length} equipos · En juego</strong>`}</header><div class="career-bracket">${leagueTable}${rounds || `<p>${pending}</p>`}</div>${competition.status === 'finished' ? '' : `<footer><button data-comp="${clean(competition.id)}">Simular ronda</button><button data-comp-all="${clean(competition.id)}">Simular torneo completo</button></footer>`}</article>`;
    }).join('') || '<p class="career-market-note">No te has clasificado para competiciones esta temporada.</p>';
    const world = state.world?.rankings ? `<section class="career-world"><header><div><span>MOTOR DE TEMPORADA</span><h4>Ligas simuladas en segundo plano</h4></div><b>${Object.keys(state.world.rankings).length} competiciones</b></header><div>${PYRAMIDS.map(({ first }) => `<article><strong>${clean(first)}</strong>${(state.world.rankings[first] || []).slice(0, 4).map((slug, index) => `<span><i>${index + 1}</i><img src="${clean(badge(findTeam(slug)))}" alt="">${clean(teamName(findTeam(slug)))}</span>`).join('')}</article>`).join('')}</div></section>` : '';
    el('career-competitions').innerHTML = competitions + world;
  }

  function renderAwards() {
    const liveRace = state.squad.filter(player => player.loan?.type !== 'out').slice().sort((a, b) => (b.goals || 0) - (a.goals || 0) || b.rating - a.rating).slice(0, 5);
    const archive = state.awards || [];
    const winner = (award, type) => award
      ? `<article class="career-award-winner ${type}"><div class="career-award-medal">${type === 'ballon' ? 'BO' : 'BG'}</div><div><span>${type === 'ballon' ? 'BALÓN DE ORO' : 'BOTA DE ORO'}</span><strong>${clean(award.name)}</strong><small>${clean(teamName(findTeam(award.club)))} · ${award.rating} media · ${award.goals} G${type === 'ballon' ? ` · ${award.assists} A` : ''}</small></div><img src="${clean(badge(findTeam(award.club)))}" alt="">${award.user ? '<b>TÚ</b>' : ''}</article>`
      : '';
    el('career-awards').innerHTML = `<header class="career-awards-head"><div><span>PREMIOS INDIVIDUALES</span><h4>Rendimiento real de cada jugador</h4></div><b>${archive.length} galas celebradas</b></header><section class="career-awards-live"><div><span>CARRERA POR LA BOTA · TEMPORADA ${state.season}</span><h5>Goles, asistencias y media individual</h5></div>${liveRace.map((player, index) => `<div class="career-award-race"><i>${index + 1}</i><span><strong>${clean(player.name)}</strong><small>${player.rating} media · ${player.apps || 0} PJ · ${player.assists || 0} A</small></span><b>${player.goals || 0} G</b></div>`).join('')}</section>${archive.length ? `<section class="career-awards-archive">${archive.map(season => `<div class="career-awards-season"><h5>TEMPORADA ${season.season}</h5>${winner(season.ballonDor, 'ballon')}${winner(season.goldenBoot, 'boot')}</div>`).join('')}</section>` : '<p class="career-market-note">La primera gala se celebrará al terminar la temporada.</p>'}`;
  }

  function transferWindow() {
    const winterRound = Math.floor(state.schedule.length / 2);
    return state.round <= 2 || (state.round >= winterRound - 1 && state.round <= winterRound + 1);
  }

  function renderMarket() {
    if (state.role === 'selector') {
      el('career-market').innerHTML = `<div class="career-market-head"><div><span>OBSERVACIÓN NACIONAL</span><h4>Base de datos de convocables</h4></div><b>${state.squad.length} jugadores seguidos</b></div><p class="career-market-note">La convocatoria se gestiona desde la pestaña Convocatoria. Compara media, posición, estado físico y estadísticas antes de decidir.</p>${marketHistoryHtml()}`;
      return;
    }
    if (state.role === 'player') {
      const offers = state.offers.filter(offer => offer.type === 'player');
      el('career-market').innerHTML = `<div class="career-market-head"><div><span>AGENTE Y CONTRATOS</span><h4>Tu futuro profesional</h4></div><b>${offers.length} ofertas</b></div><div class="career-contract-strip"><div><span>CLUB ACTUAL</span><b>${clean(teamName(currentTeam()))}</b></div><div><span>SALARIO</span><b>${state.player.salary.toFixed(1)} M€/año</b></div><div><span>CONTRATO</span><b>${state.player.contract} temporadas</b></div><div><span>VALOR ESTIMADO</span><b>${money(playerValue(state.player))}</b></div></div><div class="career-offers">${offers.length ? offers.map(offer => `<article class="career-offer"><img src="${clean(badge(findTeam(offer.club)))}" alt=""><span><strong>${clean(teamName(findTeam(offer.club)))}</strong><small>${clean(findTeam(offer.club)?.group || '')} · ${offer.salary.toFixed(1)} M€/año · ${offer.contract} temporadas</small></span><button data-market-action="accept-player" data-offer="${clean(offer.id)}">Firmar</button><button data-market-action="reject" data-offer="${clean(offer.id)}">Rechazar</button></article>`).join('') : '<p class="career-market-note">Sin propuestas formales. Jugar, rendir y mejorar tu media hará que tu agente reciba ofertas.</p>'}</div>${marketHistoryHtml()}`;
      el('career-market').querySelectorAll('.career-offer small').forEach((detail, index) => {
        const offer = offers[index];
        if (offer?.projection) detail.textContent += ` · media ${state.player.rating} · proyección ${offer.projection}`;
      });
      return;
    }
    const open = transferWindow();
    const scoutGroups = catalog.filter(isCareerClub).sort((a, b) => teamName(a).localeCompare(teamName(b)));
    const search = (state.marketSearch || '').toLowerCase();
    const visibleMarket = state.market.filter(player => !search || player.name.toLowerCase().includes(search) || teamName(findTeam(player.club)).toLowerCase().includes(search));
    const negotiation = state.negotiation;
    const negotiationHtml = negotiation ? (() => {
      const player = state.market.find(item => item.id === negotiation.player);
      if (!player) return '';
      return `<article class="career-negotiation"><header><img src="${clean(badge(findTeam(player.club)))}" alt=""><span><strong>Negociación por ${clean(player.name)}</strong><small>Ronda ${negotiation.round}/3 · valor ${money(player.value)}</small></span><b>${negotiation.counter ? `Contraoferta ${money(negotiation.counter)}` : 'Esperando tu oferta'}</b></header><p>${clean(negotiation.message)}</p><div>${negotiation.counter ? `<button data-market-action="accept-counter">Aceptar ${money(negotiation.counter)}</button>` : `<button data-market-action="bid" data-ratio="0.9">Ofrecer ${money(player.value * .9)}</button><button data-market-action="bid" data-ratio="1">Ofrecer ${money(player.value)}</button><button data-market-action="bid" data-ratio="1.12">Ofrecer ${money(player.value * 1.12)}</button>`}<button data-market-action="cancel-negotiation">Retirarse</button></div></article>`;
    })() : '';
    el('career-market').innerHTML = `<div class="career-market-head"><div><span>${open ? 'VENTANA ABIERTA' : 'MERCADO CERRADO'}</span><h4>${state.round >= 8 ? 'Mercado de invierno' : 'Mercado de fichajes'}</h4></div><b>${money(state.budget)}</b></div><div class="career-scout"><select id="career-scout-team"><option value="">Buscar plantilla de un equipo</option>${scoutGroups.map(team => `<option value="${clean(team.slug)}">${clean(teamName(team))} · ${clean(team.group)}</option>`).join('')}</select><button data-market-action="scout">Cargar equipo</button><input id="career-market-search" value="${clean(state.marketSearch || '')}" placeholder="Buscar jugador o club"></div>${negotiationHtml}<div class="career-offers">${state.offers.filter(offer => offer.type === 'sale').map(offer => { const player = state.squad.find(item => item.id === offer.player); return player ? `<article class="career-offer"><img src="${clean(badge(findTeam(offer.club)))}" alt=""><span><strong>${clean(teamName(findTeam(offer.club)))} quiere a ${clean(player.name)}</strong><small>Oferta: ${money(offer.amount)}</small></span><button data-market-action="accept-sale" data-offer="${clean(offer.id)}">Aceptar</button><button data-market-action="reject" data-offer="${clean(offer.id)}">Rechazar</button></article>` : ''; }).join('')}</div><div class="career-market-list">${visibleMarket.map(player => `<article class="career-target"><img src="${clean(badge(findTeam(player.club)))}" alt=""><span><strong>${clean(player.name)}</strong><small>${clean(player.position)} · ${player.age} años · ${clean(teamName(findTeam(player.club)))}</small></span><b>${player.rating}</b><span><strong>${money(player.value)}</strong><small>Cláusula ${money(player.clause)}</small></span><button data-market-action="buy" data-player="${clean(player.id)}"${open || negotiation ? '' : ' disabled'}>Negociar</button><button data-market-action="clause" data-player="${clean(player.id)}"${open ? '' : ' disabled'}>Cláusula</button></article>`).join('') || '<p class="career-market-note">No hay jugadores que coincidan.</p>'}</div>${marketHistoryHtml()}`;
    if (state.role === 'manager' && open) {
      el('career-market').querySelectorAll('[data-market-action="clause"]').forEach(button => {
        const loanButton = document.createElement('button');
        loanButton.className = 'career-loan-btn';
        loanButton.dataset.marketAction = 'loan-in';
        loanButton.dataset.player = button.dataset.player;
        loanButton.textContent = 'Cesión';
        button.insertAdjacentElement('afterend', loanButton);
      });
      const loanCandidates = state.squad.filter(player => !player.user && !player.loan && !player.starter).slice(0, 8);
      if (loanCandidates.length) el('career-market').insertAdjacentHTML('beforeend', `<section class="career-loan-panel"><header><span>CESIONES DE SALIDA</span><strong>Desarrolla jugadores sin perder sus derechos</strong></header><div>${loanCandidates.map(player => `<article><span><b>${clean(player.name)}</b><small>${clean(player.position)} · ${player.age} años · ${player.rating} media</small></span><button data-market-action="loan-out" data-player="${clean(player.id)}">Ceder 1 temporada</button></article>`).join('')}</div></section>`);
    }
  }

  function marketHistoryHtml() {
    return `<div class="career-transfer-history"><h4>Operaciones</h4>${state.transfers.length ? state.transfers.slice(0, 12).map(item => `<div><span>${clean(item.text)}</span><strong>${clean(item.amount)}</strong></div>`).join('') : '<div><span>Sin movimientos todavía</span><strong>—</strong></div>'}</div>`;
  }

  function renderOffice() {
    if (state.role === 'player') {
      const player = state.player;
      el('career-office').innerHTML = `<div class="career-player-contract"><span>CONTRATO PROFESIONAL</span><h4>${clean(teamName(currentTeam()))}</h4><strong>${player.salary.toFixed(1)} M€ <small>por temporada</small></strong><p>${player.contract} temporadas restantes · valor ${money(playerValue(player))} · ingresos de carrera ${money(player.earnings || 0)}</p></div><div class="career-office-kpis"><div class="career-office-kpi"><span>VALORACIÓN</span><b>${player.rating}</b></div><div class="career-office-kpi"><span>MINUTOS</span><b>${player.minutes}</b></div><div class="career-office-kpi"><span>GOLES</span><b>${player.goals}</b></div><div class="career-office-kpi"><span>ASISTENCIAS</span><b>${player.assists}</b></div></div><div class="career-objectives"><div class="career-objective"><span><strong>Rol actual</strong><small>Gana el puesto con forma y entrenamiento</small></span><b>${clean(player.status)}</b></div><div class="career-objective"><span><strong>Situación contractual</strong><small>${player.contract <= 1 ? 'Tu agente negociará la renovación o una salida' : 'Contrato estable'}</small></span><b>${player.contract} años</b></div><div class="career-objective"><span><strong>Nota media</strong><small>Rendimiento de la temporada</small></span><b>${player.form.toFixed(1)}</b></div></div>${historyHtml()}`;
      el('career-office').insertAdjacentHTML('beforeend', careerAchievementsHtml());
      return;
    }
    const target = Math.max(3, Math.ceil(state.teams.length / 2));
    el('career-office').innerHTML = `<div class="career-office-kpis"><div class="career-office-kpi"><span>${state.role === 'selector' ? 'PRESTIGIO' : 'SALDO TEMPORADA'}</span><b>${state.role === 'selector' ? Math.round((state.board + state.fans) / 2) : money(state.balance)}</b></div><div class="career-office-kpi"><span>AFICIÓN</span><b>${Math.round(state.fans)}%</b></div><div class="career-office-kpi"><span>CONFIANZA</span><b>${Math.round(state.board)}%</b></div><div class="career-office-kpi"><span>REPUTACIÓN</span><b>${Math.round((state.board + state.fans) / 2)}</b></div></div>${state.dismissed ? '<div class="career-dismissed"><strong>Has sido destituido</strong><span>Tu historial continúa. Acepta un proyecto de menor reputación para reconstruir tu carrera.</span><button data-career-action="seek-job">Buscar nuevo club</button></div>' : ''}<div class="career-objectives"><div class="career-objective"><span><strong>Objetivo deportivo</strong><small>Terminar entre los ${target} primeros</small></span><b>${userPosition() <= target ? 'En objetivo' : 'En riesgo'}</b></div><div class="career-objective"><span><strong>Vestuario</strong><small>Mantener la moral por encima de 60</small></span><b>${Math.round(average(state.squad, 'morale'))}/100</b></div></div>${historyHtml()}`;
    if (state.role === 'manager') el('career-office').insertAdjacentHTML('afterbegin', `<section class="career-assets"><div><span>PATRIMONIO TOTAL</span><strong>${money(clubAssets())}</strong><small>Presupuesto + valor de plantilla</small></div><dl><div><dt>PRESUPUESTO</dt><dd>${money(state.budget)}</dd></div><div><dt>PLANTILLA</dt><dd>${money(squadValue())}</dd></div><div><dt>MEDIA DEL CLUB</dt><dd>${currentTeam().ovr}</dd></div></dl></section>`);
    el('career-office').insertAdjacentHTML('beforeend', careerAchievementsHtml());
  }

  function careerAchievementsHtml() {
    const seasons = state.history || [];
    const trophies = seasons.flatMap(season => season.trophies || []);
    const totalGoals = seasons.reduce((sum, season) => sum + Number(season.gf || 0), 0) + Number(currentTeam()?.gf || 0);
    const achievements = [
      { code: '01', title: 'Primera temporada', detail: 'Completa una temporada', earned: seasons.length >= 1, progress: `${Math.min(seasons.length, 1)}/1` },
      { code: 'CH', title: 'Campeón de liga', detail: 'Termina primero en liga', earned: seasons.some(season => season.position === 1), progress: seasons.some(season => season.position === 1) ? '1/1' : '0/1' },
      { code: 'CP', title: 'Rey de Copa', detail: 'Gana la Copa nacional', earned: trophies.includes('Copa nacional'), progress: trophies.includes('Copa nacional') ? '1/1' : '0/1' },
      { code: 'EU', title: 'Gloria europea', detail: 'Gana una competición UEFA', earned: trophies.some(trophy => /Champions|Europa|Conference/.test(trophy)), progress: trophies.some(trophy => /Champions|Europa|Conference/.test(trophy)) ? '1/1' : '0/1' },
      { code: 'AS', title: 'Ascenso', detail: 'Sube a Primera División', earned: seasons.some(season => season.movement?.type === 'promotion'), progress: seasons.some(season => season.movement?.type === 'promotion') ? '1/1' : '0/1' },
      { code: '100', title: 'Ataque centenario', detail: 'Marca 100 goles en tu carrera', earned: totalGoals >= 100, progress: `${Math.min(totalGoals, 100)}/100` }
    ];
    const earned = achievements.filter(item => item.earned).length;
    return `<section class="career-achievements"><header><div><span>GABINETE DE LOGROS</span><h4>Tu legado</h4></div><b>${earned}/${achievements.length}</b></header><div>${achievements.map(item => `<article class="${item.earned ? 'is-earned' : 'is-locked'}"><i>${item.code}</i><span><strong>${clean(item.title)}</strong><small>${clean(item.detail)}</small></span><b>${item.earned ? 'CONSEGUIDO' : item.progress}</b></article>`).join('')}</div></section>`;
  }

  function historyHtml() {
    return `<div class="career-history"><h4>Historial</h4>${state.history.length ? state.history.slice().reverse().map(season => `<div><span>Temporada ${season.season} · ${season.position}º · ${clean(season.outcome)}</span><strong>${season.points} pts · ${season.gf}:${season.ga}</strong></div>`).join('') : '<div><span>Primera temporada en curso</span><strong>—</strong></div>'}</div>`;
  }

  function render() {
    el('career-create').classList.toggle('hidden', Boolean(state));
    el('career-game').classList.toggle('hidden', !state);
    if (!state) return;
    roleUi();
    renderHeader();
    renderHub();
    renderSquad();
    renderTactics();
    renderCalendar();
    renderTable();
    renderCompetitions();
    renderAwards();
    renderMarket();
    renderOffice();
  }

  function switchTab(name) {
    document.querySelectorAll('[data-career-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.careerTab === name));
    document.querySelectorAll('[data-career-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.careerPanel === name));
  }

  function togglePlayer(id) {
    if (state.role === 'player') return;
    const player = state.squad.find(item => item.id === id);
    if (!player || player.loan?.type === 'out') return;
    const count = starters().length;
    if ((!player.starter && count >= 11) || (player.starter && count <= 8)) return;
    player.starter = !player.starter;
    save();
    renderSquad();
    renderTactics();
  }

  function localScore(home, away, userSlug) {
    const bonus = team => team.slug === userSlug ? careerModifier() : 0;
    const basePower = team => (team.slug === state.club.slug ? average(starters(), 'rating') : (team.ovr || 70)) + (team.seasonForm || 0);
    const homePower = basePower(home) + bonus(home) + 1.5;
    const awayPower = basePower(away) + bonus(away);
    const difference = homePower - awayPower;
    return [poisson(clamp(1.25 + difference / 13, 0.12, 3.8)), poisson(clamp(1.05 - difference / 13, 0.12, 3.5))];
  }

  function careerFactors() {
    const lineup = starters();
    const fitness = average(lineup, 'fitness');
    const morale = average(state.squad, 'morale');
    const factors = [
      { label: 'Calidad del once', value: (average(lineup, 'rating') - currentTeam().ovr) / 2 },
      { label: 'Estado físico', value: (fitness - 74) / 9 },
      { label: 'Moral', value: (morale - 65) / 11 },
      { label: 'Once completo', value: lineup.length === 11 ? 1 : -Math.abs(11 - lineup.length) * 2 }
    ];
    if (state.tactics.press === 'high') factors.push({ label: 'Presión alta', value: fitness >= 74 ? 1.1 : -1.8 });
    if (state.tactics.mentality === 'attacking') factors.push({ label: 'Riesgo ofensivo', value: morale >= 68 ? 0.7 : -0.8 });
    if (state.training === 'intense') factors.push({ label: 'Carga de entrenamiento', value: fitness >= 68 ? 0.8 : -1.5 });
    if (state.training === 'recovery') factors.push({ label: 'Recuperación', value: fitness < 76 ? 1 : -0.3 });
    if (state.talk === 'motivate') factors.push({ label: 'Motivación', value: morale < 72 ? 0.8 : 0.2 });
    if (state.talk === 'demand') factors.push({ label: 'Exigencia', value: morale >= 70 ? 0.5 : -1.1 });
    if (state.priority === 'sport') factors.push({ label: 'Prioridad deportiva', value: 0.5 });
    if (state.balance < -10) factors.push({ label: 'Crisis financiera', value: -1.4 });
    if (state.player) factors.push({ label: 'Forma personal', value: (state.player.form - 6.5) / 2 });
    return factors;
  }

  function careerModifier() {
    return clamp(careerFactors().reduce((sum, factor) => sum + factor.value, 0), -6, 6);
  }

  function simulateLeaguePhase(competition) {
    const participants = competition.participants;
    const table = new Map(participants.map(slug => [slug, { slug, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
    const userMatches = [];
    for (let offset = 1; offset <= 4; offset++) {
      for (let index = 0; index < participants.length; index++) {
        const home = findTeam(participants[index]);
        const away = findTeam(participants[(index + offset) % participants.length]);
        const userInMatch = home.slug === state.club.slug || away.slug === state.club.slug;
        const score = localScore(home, away, userInMatch ? state.club.slug : '');
        const homeRow = table.get(home.slug);
        const awayRow = table.get(away.slug);
        homeRow.p++; awayRow.p++; homeRow.gf += score[0]; homeRow.ga += score[1]; awayRow.gf += score[1]; awayRow.ga += score[0];
        if (score[0] > score[1]) { homeRow.w++; awayRow.l++; homeRow.pts += 3; }
        else if (score[1] > score[0]) { awayRow.w++; homeRow.l++; awayRow.pts += 3; }
        else { homeRow.d++; awayRow.d++; homeRow.pts++; awayRow.pts++; }
        if (userInMatch) userMatches.push({ home: home.slug, away: away.slug, homeGoals: score[0], awayGoals: score[1] });
      }
    }
    competition.leagueTable = [...table.values()].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const direct = competition.leagueTable.slice(0, 8).map(row => row.slug);
    const playoffPool = competition.leagueTable.slice(8, 24).map(row => row.slug);
    const playoffMatches = [];
    for (let index = 0; index < 8; index++) {
      const home = findTeam(playoffPool[index]);
      const away = findTeam(playoffPool[15 - index]);
      let score = localScore(home, away, home.slug === state.club.slug || away.slug === state.club.slug ? state.club.slug : '');
      if (score[0] === score[1]) score[random(0, 1)]++;
      playoffMatches.push({ home: home.slug, away: away.slug, homeGoals: score[0], awayGoals: score[1], winner: score[0] > score[1] ? home.slug : away.slug });
    }
    competition.rounds.push({ label: 'Fase liga · tus 8 jornadas', matches: userMatches });
    competition.rounds.push({ label: 'Playoff de acceso a octavos', matches: playoffMatches });
    competition.knockoutParticipants = shuffled(direct.concat(playoffMatches.map(match => match.winner)));
    competition.knockoutStartRound = competition.rounds.length;
    competition.leaguePhaseComplete = true;
    competition.status = 'playing';
  }

  function simulateCompetitionRound(competition) {
    if (competition.status === 'finished') return;
    if (competition.format === 'league-phase' && !competition.leaguePhaseComplete) {
      simulateLeaguePhase(competition);
      return;
    }
    const participants = competition.format === 'league-phase' && competition.rounds.length === competition.knockoutStartRound
      ? competition.knockoutParticipants
      : competition.rounds.length
      ? competition.rounds[competition.rounds.length - 1].matches.map(match => match.winner)
      : competition.participants;
    if (participants.length <= 1) {
      competition.champion = participants[0] || null;
      competition.status = 'finished';
      return;
    }
    const labels = { 32: 'Dieciseisavos', 16: 'Octavos de final', 8: 'Cuartos de final', 4: 'Semifinales', 2: 'Final' };
    const matches = [];
    for (let index = 0; index < participants.length; index += 2) {
      const home = findTeam(participants[index]);
      const away = findTeam(participants[index + 1]);
      const userInMatch = home.slug === state.club.slug || away.slug === state.club.slug;
      let score = localScore(home, away, userInMatch ? state.club.slug : '');
      if (score[0] === score[1]) score[random(0, 1)]++;
      matches.push({ home: home.slug, away: away.slug, homeGoals: score[0], awayGoals: score[1], winner: score[0] > score[1] ? home.slug : away.slug });
    }
    competition.rounds.push({ label: labels[participants.length] || 'Eliminatoria', matches });
    competition.status = 'playing';
    if (matches.length === 1) {
      competition.champion = matches[0].winner;
      competition.status = 'finished';
      const champion = findTeam(competition.champion);
      state.inbox.unshift({ title: `${competition.name}: ${teamName(champion)} campeón`, text: competition.champion === state.club.slug ? 'Has levantado el trofeo.' : 'El torneo ha concluido.' });
    }
  }

  function simulateCompetition(id, complete) {
    const competition = state.competitions.find(item => item.id === id);
    if (!competition) return;
    do simulateCompetitionRound(competition);
    while (complete && competition.status !== 'finished') simulateCompetitionRound(competition);
    save();
    render();
    switchTab('competitions');
  }

  async function simulateUserMatch(match) {
    const home = findTeam(match.home);
    const away = findTeam(match.away);
    const isHome = match.home === state.club.slug;
    const overrides = starters().map(player => ({ name: player.name, position: player.position, rating: player.rating }));
    try {
      const response = await fetch('/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamA: home.slug, teamB: away.slug, eraA: home.seasons?.[0] || '', eraB: away.seasons?.[0] || '',
          formationA: isHome ? state.tactics.formation : '', formationB: isHome ? '' : state.tactics.formation,
          playersOverrideA: isHome ? overrides : undefined, playersOverrideB: isHome ? undefined : overrides,
          matchMode: '11v11', matchSalt: Date.now() & 0x7fffffff, lang: 'es'
        })
      });
      if (!response.ok) throw new Error('Motor no disponible');
      const data = await response.json();
      const score = data.finalScore || data.score || {};
      const goals = [Number(score.teamA ?? score.a ?? data.goalsA) || 0, Number(score.teamB ?? score.b ?? data.goalsB) || 0];
      const modifier = careerModifier();
      const userIndex = isHome ? 0 : 1;
      if (modifier > 1 && Math.random() < modifier / 9) goals[userIndex]++;
      if (modifier < -1 && Math.random() < Math.abs(modifier) / 9) goals[1 - userIndex]++;
      return { goals, engine: true };
    } catch (_) {
      return { goals: localScore(home, away, state.club.slug), engine: false };
    }
  }

  function applyResult(match, homeGoals, awayGoals) {
    Object.assign(match, { played: true, homeGoals, awayGoals });
    const home = findTeam(match.home);
    const away = findTeam(match.away);
    home.p++; away.p++; home.gf += homeGoals; home.ga += awayGoals; away.gf += awayGoals; away.ga += homeGoals;
    if (homeGoals > awayGoals) { home.w++; away.l++; home.pts += 3; }
    else if (awayGoals > homeGoals) { away.w++; home.l++; away.pts += 3; }
    else { home.d++; away.d++; home.pts++; away.pts++; }
  }

  function recordSquadStats(goalsFor) {
    const lineup = starters();
    lineup.forEach(player => { player.apps = (player.apps || 0) + 1; });
    for (let goal = 0; goal < goalsFor; goal++) {
      const scorers = lineup.map(player => ({ player, weight: player.position === 'ST' ? 5 : ['LW', 'RW', 'AM'].includes(player.position) ? 3 : 1 }));
      const total = scorers.reduce((sum, item) => sum + item.weight, 0);
      let draw = Math.random() * total;
      const scorer = scorers.find(item => (draw -= item.weight) <= 0)?.player || lineup[0];
      scorer.goals = (scorer.goals || 0) + 1;
      if (lineup.length > 1 && Math.random() < 0.72) {
        const creators = lineup.filter(player => player !== scorer);
        const assister = creators[random(0, creators.length - 1)];
        assister.assists = (assister.assists || 0) + 1;
      }
    }
  }

  function generateOffer() {
    if (state.role === 'player') {
      if ((state.round + 1) % 3 || state.offers.some(offer => offer.type === 'player')) return;
      const appeal = state.player.form + state.player.rating / 20;
      if (appeal < 9 || Math.random() > 0.75) return;
      createPlayerOffers(1, false);
      const offer = state.offers.find(item => item.type === 'player');
      if (offer) state.inbox.unshift({ title: 'Tu agente tiene una oferta', text: `${teamName(findTeam(offer.club))} quiere negociar tu fichaje.` });
      return;
    }
    const interested = state.teams.filter(team => team.slug !== state.club.slug);
    if (!interested.length) return;
    const buyingClub = interested[random(0, interested.length - 1)];
    if (state.role !== 'manager' || (state.round + 1) % 3 || state.offers.some(offer => offer.type === 'sale')) return;
    const candidates = state.squad.filter(player => !player.user && state.squad.length > 14).sort((a, b) => b.rating - a.rating).slice(0, 8);
    if (!candidates.length) return;
    const player = candidates[random(0, candidates.length - 1)];
    const amount = Number((playerValue(player) * random(105, 145) / 100).toFixed(1));
    state.offers.push({ id: `o-${Date.now()}`, type: 'sale', club: buyingClub.slug, player: player.id, amount });
    state.inbox.unshift({ title: `Oferta por ${player.name}`, text: `${teamName(buyingClub)} ofrece ${money(amount)}. Revísala en Mercado.` });
  }

  function createPlayerOffers(count, summer) {
    const existing = new Set(state.offers.filter(offer => offer.type === 'player').map(offer => offer.club));
    const player = state.player;
    const agePotential = player.age <= 20 ? 7 : player.age <= 23 ? 5 : player.age <= 26 ? 2 : player.age >= 31 ? -2 : 0;
    const performance = clamp((player.form - 6.5) * 1.6 + player.goals * .12 + player.assists * .08, -2, 6);
    const projection = clamp(player.rating + agePotential + performance, player.rating - 2, 95);
    const targetLevel = clamp(player.rating + performance * .55 + (summer ? agePotential * .35 : 0), 60, 94);
    const minimumLevel = Math.max(58, player.rating - (player.form < 6.2 ? 5 : 2));
    const maximumLevel = Math.min(96, projection + 2);
    const source = catalog.filter(isCareerClub);
    const candidates = source.filter(team => team.slug !== state.club.slug && !existing.has(team.slug)
      && (team.ovr || 70) >= minimumLevel && (team.ovr || 70) <= maximumLevel)
      .map(team => ({ team, fit: Math.abs((team.ovr || 70) - targetLevel) + Math.random() * (summer ? 2.5 : 1.2) }))
      .sort((a, b) => a.fit - b.fit);
    candidates.slice(0, count).forEach(({ team }, index) => {
      const marketSalary = playerValue(player) * clamp(((team.ovr || 70) - 58) / 30, .45, 1.35) / 8;
      const salary = Number(Math.max(.5, player.salary * 1.12, marketSalary).toFixed(1));
      state.offers.push({ id: `o-${Date.now()}-${index}`, type: 'player', club: team.slug, group: team.group, salary, contract: random(2, 5), summer, projection: Number(projection.toFixed(1)) });
    });
  }

  function updateCareerPlayer(goalsFor, won) {
    const player = state.player;
    const squadPlayer = state.squad.find(item => item.user);
    const startChance = clamp(0.28 + (player.rating - 65) * 0.045 + (state.training === 'intense' ? 0.12 : 0), 0.2, 0.95);
    const starts = Math.random() < startChance;
    const minutes = starts ? random(62, 90) : random(8, 34);
    const goalChance = player.position === 'ST' ? 0.34 : player.position === 'AM' ? 0.23 : player.position === 'CM' ? 0.14 : 0.05;
    const scored = Math.random() < goalChance * (minutes / 75) ? 1 : 0;
    const assisted = goalsFor > scored && Math.random() < (player.style === 'creator' ? 0.32 : 0.18) * (minutes / 75) ? 1 : 0;
    const note = clamp(6 + (won ? 0.45 : -0.15) + scored * 1.2 + assisted * 0.75 + random(-4, 4) / 10, 4.5, 9.8);
    player.minutes += minutes; player.goals += scored; player.assists += assisted; player.starts += Number(starts);
    player.careerMinutes = (player.careerMinutes || 0) + minutes;
    player.careerGoals = (player.careerGoals || 0) + scored;
    player.careerAssists = (player.careerAssists || 0) + assisted;
    player.form = player.form * 0.75 + note * 0.25;
    player.status = startChance > 0.72 ? 'Titular' : startChance > 0.45 ? 'Rotación' : 'Suplente';
    if (state.training === 'intense' && Math.random() < 0.18 || note >= 8.2) player.rating = clamp(player.rating + 1, 55, 95);
    squadPlayer.rating = player.rating;
    squadPlayer.starter = starts;
    if (starts) {
      const surplus = starters().length - 11;
      state.squad.filter(item => item.starter && !item.user).sort((a, b) => a.rating - b.rating).slice(0, surplus).forEach(item => { item.starter = false; });
    } else if (starters().length < 11) {
      const replacement = state.squad.filter(item => !item.starter && !item.user).sort((a, b) => b.rating - a.rating)[0];
      if (replacement) replacement.starter = true;
    }
    state.inbox.unshift({ title: starts ? `Titular · nota ${note.toFixed(1)}` : `Entraste desde el banquillo · nota ${note.toFixed(1)}`, text: `${minutes} minutos${scored ? ' · gol' : ''}${assisted ? ' · asistencia' : ''}. Tu rol actual es ${player.status.toLowerCase()}.` });
  }

  function weeklyConsequences(match) {
    const home = match.home === state.club.slug;
    const goalsFor = home ? match.homeGoals : match.awayGoals;
    const goalsAgainst = home ? match.awayGoals : match.homeGoals;
    const won = goalsFor > goalsAgainst;
    const draw = goalsFor === goalsAgainst;
    recordSquadStats(goalsFor);
    const fatigue = state.training === 'intense' ? random(10, 16) : state.training === 'recovery' ? random(3, 7) : random(7, 11);
    state.squad.forEach(player => {
      player.fitness = clamp(player.fitness - (player.starter ? fatigue : Math.round(fatigue / 3)) + (state.training === 'recovery' ? 8 : 3), 45, 100);
      player.morale = clamp(player.morale + (won ? 4 : draw ? 0 : -4) + (state.talk === 'motivate' ? 2 : 0), 35, 100);
      if (state.training === 'youth' && player.rating < 76 && Math.random() < 0.12) player.rating++;
    });
    if (state.role === 'player') updateCareerPlayer(goalsFor, won);
    else state.inbox.unshift(won ? { title: 'El grupo responde', text: 'La victoria refuerza tu plan y la confianza.' } : draw ? { title: 'Punto trabajado', text: 'La dirección pide convertir empates en victorias.' } : { title: 'Semana de presión', text: 'La derrota enfría el entorno. La próxima decisión importa.' });
    const weekly = state.role === 'selector' ? 0 : (home ? 1.4 : 0.45) + (won ? 0.55 : draw ? 0.2 : 0) - state.squad.length * 0.035;
    state.balance += weekly;
    state.budget = Math.max(0, state.budget + weekly);
    const expectedWin = currentTeam().ovr >= findTeam(home ? match.away : match.home).ovr;
    state.board = clamp(state.board + (won ? (expectedWin ? 2 : 4) : draw ? (expectedWin ? -1 : 1) : (expectedWin ? -5 : -2)) + (state.balance < -10 ? -2 : 0), 0, 100);
    state.fans = clamp(state.fans + (won ? 3 : draw ? 0 : -2), 10, 100);
    if (state.board <= 10 && state.role !== 'player') {
      state.dismissed = true;
      state.inbox.unshift({ title: 'Destitución', text: 'La directiva ha terminado tu contrato. Puedes buscar un nuevo proyecto desde el despacho.' });
    }
    generateOffer();
    state.inbox = state.inbox.slice(0, 6);
  }

  function completeSigning(target, cost, action) {
    if (state.budget < cost) {
      state.inbox.unshift({ title: 'Operación bloqueada', text: `Faltan ${money(cost - state.budget)} para cerrar el fichaje.` });
      render();
      return false;
    }
    state.budget -= cost;
    state.balance -= cost;
    state.squad.push({ id: `t-${Date.now()}`, name: target.name, position: target.position, rating: target.rating, age: target.age, fitness: 100, morale: 76, starter: false, apps: 0, goals: 0, assists: 0 });
    state.market = state.market.filter(player => player.id !== target.id);
    state.negotiation = null;
    state.transfers.unshift({ text: `${action}: ${target.name}`, amount: `-${money(cost)}` });
    state.inbox.unshift({ title: target.name + ' ya es nuevo jugador', text: `${action} por ${money(cost)}. Está disponible en Plantilla.` });
    save();
    render();
    return true;
  }

  function loanPlayerIn(id) {
    if (state.role !== 'manager' || !transferWindow()) return;
    const target = state.market.find(player => player.id === id);
    if (!target || state.squad.length >= 25) return;
    const fee = Number(Math.max(.2, target.value * .08).toFixed(1));
    if (state.budget < fee) {
      state.inbox.unshift({ title: 'Cesión bloqueada', text: `Necesitas ${money(fee)} para cubrir la cesión de ${target.name}.` });
      render();
      return;
    }
    state.budget -= fee;
    state.balance -= fee;
    state.squad.push({ id: `l-${Date.now()}`, name: target.name, position: target.position, rating: target.rating, age: target.age, fitness: 100, morale: 76, starter: false, apps: 0, goals: 0, assists: 0, loan: { type: 'in', club: target.club, expires: state.season + 1 } });
    state.market = state.market.filter(player => player.id !== id);
    state.transfers.unshift({ text: `Cesión recibida: ${target.name}`, amount: `-${money(fee)}` });
    state.inbox.unshift({ title: `${target.name} llega cedido`, text: `Se incorpora por una temporada. Coste: ${money(fee)}.` });
    updateClubOverall();
    save();
    render();
  }

  function loanPlayerOut(id) {
    if (state.role !== 'manager' || !transferWindow()) return;
    const player = state.squad.find(item => item.id === id);
    const destinations = state.teams.filter(team => team.slug !== state.club.slug);
    if (!player || player.user || player.loan || !destinations.length || state.squad.filter(item => item.loan?.type !== 'out').length <= 14) return;
    const destination = destinations[random(0, destinations.length - 1)];
    const fee = Number(Math.max(.1, playerValue(player) * .04).toFixed(1));
    player.loan = { type: 'out', club: destination.slug, expires: state.season + 1 };
    player.starter = false;
    state.budget += fee;
    state.balance += fee;
    state.transfers.unshift({ text: `Cesión: ${player.name} a ${teamName(destination)}`, amount: `+${money(fee)}` });
    state.inbox.unshift({ title: `${player.name} sale cedido`, text: `${teamName(destination)} pagará ${money(fee)} y el jugador volverá la próxima temporada.` });
    updateClubOverall();
    save();
    render();
  }

  function resolveSeasonLoans(nextSeason) {
    const returning = state.squad.filter(player => player.loan?.type === 'out' && player.loan.expires <= nextSeason);
    const departing = state.squad.filter(player => player.loan?.type === 'in' && player.loan.expires <= nextSeason);
    state.squad = state.squad.filter(player => !departing.includes(player));
    returning.forEach(player => { delete player.loan; });
    if (returning.length || departing.length) state.inbox.unshift({ title: 'Fin de cesiones', text: `${returning.length} jugadores regresan y ${departing.length} vuelven a su club de origen.` });
    updateClubOverall();
  }

  function signPlayer(id, payClause) {
    if (state.role !== 'manager' || !transferWindow()) return;
    const target = state.market.find(player => player.id === id);
    if (!target || state.squad.length >= 25) {
      state.inbox.unshift({ title: 'Plantilla completa', text: 'Debes aceptar una venta antes de incorporar más jugadores.' });
      render();
      return;
    }
    if (payClause) return completeSigning(target, target.clause, 'Cláusula pagada');
    state.negotiation = { player: id, round: 1, counter: null, message: `${teamName(findTeam(target.club))} está dispuesto a escuchar ofertas, pero no garantiza vender.` };
    save();
    render();
  }

  function submitNegotiation(ratio) {
    const negotiation = state.negotiation;
    const target = negotiation && state.market.find(player => player.id === negotiation.player);
    if (!target) return;
    const offer = Number((target.value * ratio).toFixed(1));
    const seller = findTeam(target.club);
    const importance = clamp((target.rating - (seller?.ovr || target.rating)) * .035, -.12, .22);
    const minimum = Number((target.value * (1.02 + importance + negotiation.round * .015)).toFixed(1));
    if (offer >= minimum && Math.random() < clamp(.45 + (offer / minimum - 1) * 3, .35, .95)) {
      completeSigning(target, offer, 'Fichaje negociado');
      return;
    }
    if (negotiation.round >= 3 || offer < minimum * .82) {
      state.inbox.unshift({ title: 'Negociación rota', text: `${teamName(seller)} rechaza tu oferta por ${target.name}.` });
      state.negotiation = null;
    } else {
      negotiation.round++;
      negotiation.counter = Number((Math.max(minimum, offer * 1.08)).toFixed(1));
      negotiation.message = `${teamName(seller)} no acepta ${money(offer)} y presenta una contraoferta.`;
    }
    save();
    render();
  }

  function acceptCounter() {
    const negotiation = state.negotiation;
    const target = negotiation && state.market.find(player => player.id === negotiation.player);
    if (target && negotiation.counter) completeSigning(target, negotiation.counter, 'Contraoferta aceptada');
  }

  function resolveOffer(id, accept) {
    const offer = state.offers.find(item => item.id === id);
    if (!offer) return;
    if (accept && offer.type === 'sale') {
      const player = state.squad.find(item => item.id === offer.player);
      if (player && state.squad.length > 14) {
        state.squad = state.squad.filter(item => item.id !== player.id);
        state.budget += offer.amount;
        state.balance += offer.amount;
        state.transfers.unshift({ text: `Venta: ${player.name} a ${teamName(findTeam(offer.club))}`, amount: `+${money(offer.amount)}` });
        state.inbox.unshift({ title: 'Venta completada', text: `${player.name} deja el club por ${money(offer.amount)}.` });
      }
    }
    state.offers = state.offers.filter(item => item.id !== id);
    save();
    render();
  }

  async function acceptPlayerOffer(id) {
    const offer = state.offers.find(item => item.id === id && item.type === 'player');
    const destination = offer && (findCareerTeam(offer.club, offer.group) || findCareerTeam(offer.club) || findTeam(offer.club));
    if (!destination) return;
    if (destination.group !== state.league || !state.teams.some(team => team.slug === destination.slug)) {
      state.league = destination.group;
      state.teams = careerLeagueTeams(state.league, destination, state.world?.groups?.[state.league]);
      state.schedule = makeSchedule(state.teams);
      state.round = 0;
      if (state.seasonReview) state.seasonReview.movement = null;
    }
    state.club = state.teams.find(team => team.slug === destination.slug) || careerTeam(destination);
    state.player.salary = offer.salary;
    state.player.contract = offer.contract;
    state.squad = await getSquad(destination);
    injectCareerPlayer();
    state.transfers.unshift({ text: `Fichaje por ${teamName(destination)}`, amount: `${offer.salary.toFixed(1)} M€/año` });
    if (offer.summer && state.seasonReview) {
      state.seasonReview.movement = null;
      prepareNextSeason();
      state.lastResult = { headline: 'Nuevo club', score: `${teamName(destination)} · ${destination.group}`, detail: 'Tu nueva temporada comienza en otra competición.' };
    }
    state.offers = [];
    state.competitions = buildSeasonCompetitions();
    state.inbox.unshift({ title: 'Nuevo club', text: `Has firmado por ${teamName(destination)}. Empieza una nueva competencia por el puesto.` });
    save();
    render();
  }

  async function seekJob() {
    const destination = state.teams.filter(team => team.slug !== state.club.slug).sort((a, b) => a.ovr - b.ovr)[0];
    if (!destination) return;
    state.club = destination;
    state.squad = await getSquad(destination);
    state.board = 45;
    state.fans = 38;
    state.dismissed = false;
    state.inbox.unshift({ title: 'Nuevo proyecto', text: `${teamName(destination)} te ofrece una oportunidad para recuperar tu reputación.` });
    save();
    render();
  }

  async function playRound() {
    if (state.dismissed) return;
    if (state.round >= state.schedule.length) return startNextSeason();
    const button = el('career-play-match');
    button.disabled = true;
    button.textContent = 'Simulando jornada…';
    try {
      const userMatch = nextUserMatch();
      if (!userMatch) {
        state.schedule[state.round].forEach(match => {
          const score = localScore(findTeam(match.home), findTeam(match.away), '');
          applyResult(match, score[0], score[1]);
        });
        state.squad.forEach(player => { player.fitness = clamp(player.fitness + 12, 40, 100); });
        state.lastResult = { headline: 'Jornada de descanso', outcome: 'draw', score: 'Sin partido', detail: 'La plantilla recuperó energía mientras avanzaba la competición.' };
        state.round++;
        if (state.round >= state.schedule.length) finishSeason();
        save();
        render();
        switchTab('hub');
        return;
      }
      const result = await simulateUserMatch(userMatch);
      state.schedule[state.round].forEach(match => {
        const score = match === userMatch ? result.goals : localScore(findTeam(match.home), findTeam(match.away), '');
        applyResult(match, score[0], score[1]);
      });
      weeklyConsequences(userMatch);
      const home = findTeam(userMatch.home);
      const away = findTeam(userMatch.away);
      const userHome = userMatch.home === state.club.slug;
      const userGoals = userHome ? userMatch.homeGoals : userMatch.awayGoals;
      const rivalGoals = userHome ? userMatch.awayGoals : userMatch.homeGoals;
      state.lastResult = {
        headline: userGoals > rivalGoals ? 'Victoria' : userGoals === rivalGoals ? 'Reparto de puntos' : 'Derrota',
        outcome: userGoals > rivalGoals ? 'win' : userGoals === rivalGoals ? 'draw' : 'loss',
        round: state.round + 1, home: home.slug, away: away.slug, homeGoals: userMatch.homeGoals, awayGoals: userMatch.awayGoals,
        score: `${teamName(home)} ${userMatch.homeGoals} - ${userMatch.awayGoals} ${teamName(away)}`,
        detail: `${result.engine ? 'Partido resuelto por el motor GolazoX.' : 'Resultado local de respaldo.'} Ahora el equipo es ${userPosition()}º.`
      };
      state.round++;
      if (state.round >= state.schedule.length) finishSeason();
      save();
      render();
      switchTab('hub');
    } catch (error) {
      state.inbox.unshift({ title: 'Jornada no completada', text: error.message || 'Se ha producido un error inesperado.' });
      save();
      render();
    } finally {
      el('career-play-match').disabled = state.dismissed;
    }
  }

  function simulateLocalRound() {
    const userMatch = nextUserMatch();
    state.schedule[state.round].forEach(match => {
      const score = localScore(findTeam(match.home), findTeam(match.away), userMatch ? state.club.slug : '');
      applyResult(match, score[0], score[1]);
    });
    if (userMatch) weeklyConsequences(userMatch);
    else state.squad.forEach(player => { player.fitness = clamp(player.fitness + 12, 40, 100); });
    state.round++;
    return true;
  }

  function simulateRemainingSeason() {
    while (state.round < state.schedule.length && !state.dismissed && simulateLocalRound()) {}
    state.competitions.forEach(competition => {
      while (competition.status !== 'finished') simulateCompetitionRound(competition);
    });
    if (state.round >= state.schedule.length && state.history[state.history.length - 1]?.season !== state.season) finishSeason();
  }

  function prepareNextSeason() {
    const movement = state.seasonReview?.movement;
    if (movement?.to) {
      state.league = movement.to;
      const selected = catalog.find(team => team.slug === state.club.slug) || state.club;
      state.teams = careerLeagueTeams(state.league, selected, state.world?.groups?.[state.league]);
      state.club = state.teams.find(team => team.slug === selected.slug) || state.teams[0];
    }
    if (state.role !== 'selector') {
      const selected = findCareerTeam(state.club.slug, state.league) || state.club;
      state.teams = careerLeagueTeams(state.league, selected, state.world?.groups?.[state.league]);
      state.club = state.teams.find(team => team.slug === selected.slug) || state.teams[0];
    }
    resolveSeasonLoans(state.season + 1);
    state.season++;
    if (state.player?.contract === 0) {
      state.player.contract = 1;
      state.player.salary = Number((state.player.salary * 1.05).toFixed(1));
      state.inbox.unshift({ title: 'Renovación automática por una temporada', text: 'Al no aceptar otra propuesta, tu club amplía el contrato un año con una mejora mínima.' });
    }
    if (state.player) Object.assign(state.player, { minutes: 0, goals: 0, assists: 0, starts: 0 });
    state.round = 0;
    state.schedule = makeSchedule(state.teams);
    state.teams.forEach(team => Object.assign(team, { seasonForm: random(-3, 3), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
    state.squad.forEach(player => {
      player.fitness = 100;
      player.morale = clamp(player.morale + 5, 40, 100);
      player.age = (player.age || 24) + 1;
      player.apps = 0;
      player.goals = 0;
      player.assists = 0;
    });
    state.offers = [];
    state.jobOffers = [];
    state.competitions = buildSeasonCompetitions();
    state.seasonReview = null;
    state.inbox.unshift({ title: 'Nueva temporada', text: 'Tu reputación y todas tus decisiones anteriores siguen contando.' });
    state.lastResult = null;
  }

  function simulateSeasonFast() {
    if (state.dismissed || !window.confirm('¿Simular de golpe el resto de esta temporada?')) return;
    if (state.round >= state.schedule.length) prepareNextSeason();
    simulateRemainingSeason();
    if (!state.dismissed) state.lastResult = { headline: 'Temporada simulada', score: `${userPosition()}º · ${currentTeam().pts} puntos`, detail: 'Revisa el cierre anual y decide cuándo comenzar la siguiente.' };
    save();
    render();
    switchTab('hub');
  }

  function simulateCareerFast() {
    if (state.dismissed || !window.confirm('¿Simular toda la carrera? El proceso se detendrá si te despiden o te retiras.')) return;
    const initialHistoryLength = state.history.length;
    const seasonsToRun = state.player ? Math.max(1, 36 - state.player.age) : 10;
    const finalSeason = state.season + seasonsToRun - 1;
    state.careerRun = true;
    state.careerEndSeason = finalSeason;
    while (!state.dismissed && state.season <= finalSeason && (!state.player || state.player.age < 36)) {
      if (state.round >= state.schedule.length) prepareNextSeason();
      simulateRemainingSeason();
      if (state.dismissed || state.season >= finalSeason || (state.player && state.player.age >= 36)) break;
      prepareNextSeason();
    }
    state.careerRun = false;
    const completedSeasons = state.history.length - initialHistoryLength;
    state.lastResult = state.dismissed
      ? { headline: 'Carrera interrumpida', score: `${completedSeasons} temporadas simuladas`, detail: 'La directiva te destituyó antes de completar el recorrido.' }
      : { headline: state.player ? 'Carrera completada · retirada' : 'Carrera completa', score: `${state.history.length} temporadas`, detail: `${completedSeasons} temporadas simuladas de una vez. Todo el historial está guardado.` };
    save();
    render();
    switchTab('hub');
  }

  function continueCareerRun() {
    if (!state.seasonReview || state.dismissed) return;
    const shouldContinue = state.careerRun && state.season < state.careerEndSeason && (!state.player || state.player.age < 36);
    if (!shouldContinue && state.careerRun) {
      state.careerRun = false;
      state.lastResult = { headline: state.player ? 'Carrera completada · retirada' : 'Década completada', score: `${state.history.length} temporadas`, detail: `${state.history.filter(item => item.trophies?.length).length} temporadas con títulos.` };
      save();
      render();
      return;
    }
    prepareNextSeason();
    state.seasonReview = null;
    if (state.careerRun) {
      simulateRemainingSeason();
      state.lastResult = { headline: 'Carrera en curso', score: `Temporada ${state.season} completada`, detail: 'Revisa el resultado anual antes de avanzar.' };
    }
    save();
    render();
    switchTab('hub');
  }

  function finishSeason() {
    const position = userPosition();
    const club = currentTeam();
    const division = divisionProfile(state.league);
    if (state.role !== 'selector') simulateFootballWorld();
    const movement = division.tier === 2 && position <= 2
      ? { type: 'promotion', from: state.league, to: division.first, label: position === 1 ? 'Campeón y ascenso' : 'Ascenso a Primera' }
      : division.tier === 1 && division.second && position >= state.teams.length - 1
        ? { type: 'relegation', from: state.league, to: division.second, label: 'Descenso a Segunda' }
        : null;
    if (movement && state.world?.groups) {
      state.world.groups[movement.from] = (state.world.groups[movement.from] || []).filter(slug => slug !== state.club.slug);
      state.world.groups[movement.to] = [...new Set((state.world.groups[movement.to] || []).filter(slug => slug !== state.club.slug).concat(state.club.slug))];
    }
    let outcome = 'Permanencia';
    if (state.role === 'selector') outcome = position === 1 ? 'Campeón internacional' : position <= 4 ? 'Fase final' : 'Eliminado';
    else if (movement) outcome = movement.label;
    else if (division.tier === 2) outcome = position <= 4 ? 'Playoff de ascenso' : 'Permanencia en Segunda';
    else if (position === 1) outcome = 'Campeón de liga';
    else if (position <= 4) outcome = 'Clasificado para Champions';
    else if (position === 5) outcome = 'Clasificado para Europa League';
    const trophies = state.competitions.filter(item => item.champion === state.club.slug).map(item => item.name);
    if (trophies.length) outcome += ` · ${trophies.join(' + ')}`;
    const awards = calculateSeasonAwards();
    state.awards = state.awards || [];
    state.awards.unshift(awards);
    const currentSquadValue = squadValue();
    const leaguePrize = Math.max(1, (state.teams.length - position + 1) * (division.tier === 2 ? .75 : 1.6));
    const trophyPrize = trophies.reduce((sum, trophy) => sum + (/Champions|Libertadores|Mundial/.test(trophy) ? 22 : 8), 0);
    const reputationBonus = Math.max(0, (state.board - 50) / 10);
    const prize = Number((leaguePrize + trophyPrize + reputationBonus + currentSquadValue * .018).toFixed(1));
    const playerStats = state.player ? { goals: state.player.goals, assists: state.player.assists, rating: state.player.form.toFixed(1), salary: state.player.salary } : null;
    const development = developSquad();
    const summary = { season: state.season, league: state.league, position, points: club.pts, gf: club.gf, ga: club.ga, outcome, trophies, prize, movement, playerStats, awards, development };
    state.history.push(summary);
    state.seasonReview = summary;
    state.board = clamp(state.board + (position <= 3 ? 12 : position <= 5 ? 4 : -8), 10, 100);
    state.budget += prize;
    state.balance += prize;
    if (state.role === 'manager') {
      const reputation = currentTeam().ovr + (state.board - 50) / 10 + (position <= 3 ? 3 : position >= state.teams.length - 1 ? -4 : 0);
      state.jobOffers = catalog.filter(team => isCareerClub(team) && team.slug !== state.club.slug && (team.ovr || 70) <= reputation + 3)
        .sort((a, b) => Math.abs((a.ovr || 70) - reputation) - Math.abs((b.ovr || 70) - reputation))
        .slice(0, 3)
        .map(team => ({ club: team.slug, group: team.group, budget: Math.max(8, Math.round(((team.ovr || 70) - 62) * 3.4)) }));
    }
    if (state.player) {
      state.player.earnings = Number(((state.player.earnings || 0) + state.player.salary).toFixed(1));
      state.player.age++;
      state.player.contract = Math.max(0, state.player.contract - 1);
      state.offers = state.offers.filter(offer => offer.type !== 'player');
      createPlayerOffers(3, true);
      state.inbox.unshift({ title: `${state.offers.length} propuestas de contrato`, text: 'Tu agente ha preparado opciones para la próxima temporada. Revísalas antes de decidir.' });
    }
    state.lastResult = { headline: position === 1 ? '¡Campeones!' : 'Temporada finalizada', score: `${position}º · ${club.pts} puntos`, detail: 'Tu progreso queda guardado. Puedes continuar el proyecto.' };
  }

  async function startNextSeason() {
    prepareNextSeason();
    if (state.role !== 'selector') state.market = await getMarketPlayers(currentTeam());
    state.awardPool = state.market.slice(0, 40);
    save();
    render();
  }

  async function acceptJob(slug) {
    const offer = state.jobOffers?.find(item => (item.club || item.slug) === slug);
    const destination = offer && (findCareerTeam(slug, offer.group) || findCareerTeam(slug));
    if (!destination || !offer) return;
    state.league = destination.group;
    state.season++;
    state.teams = careerLeagueTeams(state.league, destination, state.world?.groups?.[state.league]);
    state.club = state.teams.find(team => team.slug === slug);
    state.squad = await getSquad(destination);
    state.budget = offer.budget;
    state.balance = 0;
    state.board = 65;
    state.fans = 55;
    state.schedule = makeSchedule(state.teams);
    state.round = 0;
    state.offers = [];
    state.jobOffers = [];
    state.market = await getMarketPlayers(state.club);
    state.awardPool = state.market.slice(0, 40);
    state.competitions = buildSeasonCompetitions();
    state.seasonReview = null;
    state.lastResult = { headline: 'Nuevo proyecto', score: `${teamName(destination)} · Temporada ${state.season}`, detail: 'La nueva temporada está lista para comenzar.' };
    state.inbox.unshift({ title: `Nuevo cargo en ${teamName(destination)}`, text: `Cambias de proyecto con ${money(offer.budget)} de presupuesto, manteniendo todo tu historial.` });
    save();
    render();
  }

  async function loadCatalog() {
    try {
      const [catalogResponse, leaguesResponse, expandedResponse] = await Promise.all([fetch('/catalog'), fetch('/official-leagues'), fetch('/expanded-leagues')]);
      if (!catalogResponse.ok) throw new Error('Catálogo no disponible');
      catalog = await catalogResponse.json();
      officialLeagues = leaguesResponse.ok ? await leaguesResponse.json() : {};
      expandedLeagues = expandedResponse.ok ? await expandedResponse.json() : {};
      if (state && state.role !== 'selector') {
        const allowedCompetitions = new Set(['cup', 'champions', 'europa', 'conference']);
        state.competitions = (state.competitions || []).filter(competition => allowedCompetitions.has(competition.id));
        const resolved = findCareerTeam(state.club.slug, state.club.group) || findCareerTeam(state.club.slug);
        const fullLeagueSize = catalogGroup(state.league).length;
        const wrongLeague = resolved && resolved.group !== state.league;
        const untouchedLegacyLeague = state.round === 0 && state.teams.every(team => !team.p) && state.teams.length < fullLeagueSize;
        const incompleteLeague = state.round === 0 && fullLeagueSize && state.teams.length !== fullLeagueSize;
        const legacyChampions = state.round === 0 && state.competitions.some(competition => competition.id === 'champions' && competition.format !== 'league-phase');
        if (resolved && (wrongLeague || untouchedLegacyLeague || incompleteLeague)) {
          if (wrongLeague) state.league = resolved.group;
          state.teams = careerLeagueTeams(state.league, resolved, state.world?.groups?.[state.league]);
          state.club = state.teams.find(team => team.slug === resolved.slug) || state.teams[0];
          state.schedule = makeSchedule(state.teams);
          state.round = 0;
          if (wrongLeague) {
            state.seasonReview = null;
            state.competitions = buildSeasonCompetitions();
            state.lastResult = { headline: 'Competición corregida', score: `${teamName(resolved)} · ${resolved.group}`, detail: 'La carrera continúa en la liga real de tu club.' };
          }
          save();
        }
        if (legacyChampions) {
          state.competitions = buildSeasonCompetitions();
          save();
        }
      }
      updateRoleForm();
      if (state) render();
    } catch (_) {
      el('career-team').innerHTML = '<option>No se pudo cargar el catálogo</option>';
    }
  }

  function bind() {
    el('games-career-shortcut').addEventListener('click', () => el('career-zone').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    el('career-create').addEventListener('submit', createCareer);
    el('career-role').addEventListener('change', updateRoleForm);
    el('career-league').addEventListener('change', populateTeams);
    el('career-team-picker').addEventListener('click', event => {
      const team = event.target.closest('[data-career-team]');
      if (team) {
        el('career-team').value = team.dataset.careerTeam;
        el('career-team-search').value = '';
        renderTeamPicker();
        el('career-team-menu').classList.add('hidden');
        el('career-team-trigger').setAttribute('aria-expanded', 'false');
        return;
      }
      if (event.target.closest('#career-team-trigger')) {
        const menu = el('career-team-menu');
        menu.classList.toggle('hidden');
        el('career-team-trigger').setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
        if (!menu.classList.contains('hidden')) el('career-team-search').focus();
      }
    });
    el('career-team-search').addEventListener('input', event => renderTeamPicker(event.target.value));
    document.addEventListener('click', event => {
      if (!event.target.closest('#career-team-picker')) {
        el('career-team-menu').classList.add('hidden');
        el('career-team-trigger').setAttribute('aria-expanded', 'false');
      }
    });
    document.querySelector('.career-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-career-tab]');
      if (button) switchTab(button.dataset.careerTab);
    });
    el('career-squad').addEventListener('click', event => {
      const row = event.target.closest('[data-player]');
      if (row) togglePlayer(row.dataset.player);
    });
    el('career-tactics').addEventListener('change', event => {
      const key = event.target.dataset.tactic;
      if (key) { state.tactics[key] = event.target.value; save(); renderTactics(); }
    });
    el('career-market').addEventListener('click', event => {
      const button = event.target.closest('[data-market-action]');
      if (!button) return;
      const action = button.dataset.marketAction;
      if (action === 'buy' || action === 'clause') signPlayer(button.dataset.player, action === 'clause');
      else if (action === 'loan-in') loanPlayerIn(button.dataset.player);
      else if (action === 'loan-out') loanPlayerOut(button.dataset.player);
      else if (action === 'scout') scoutTeam(el('career-scout-team').value);
      else if (action === 'bid') submitNegotiation(Number(button.dataset.ratio));
      else if (action === 'accept-counter') acceptCounter();
      else if (action === 'cancel-negotiation') { state.negotiation = null; save(); render(); }
      else if (action === 'accept-sale') resolveOffer(button.dataset.offer, true);
      else if (action === 'reject') resolveOffer(button.dataset.offer, false);
      else if (action === 'accept-player') acceptPlayerOffer(button.dataset.offer);
    });
    el('career-market').addEventListener('input', event => {
      if (event.target.id === 'career-market-search') {
        state.marketSearch = event.target.value;
        renderMarket();
        const input = el('career-market-search');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
    el('career-competitions').addEventListener('click', event => {
      const roundButton = event.target.closest('[data-comp]');
      const fullButton = event.target.closest('[data-comp-all]');
      if (fullButton) simulateCompetition(fullButton.dataset.compAll, true);
      else if (roundButton) simulateCompetition(roundButton.dataset.comp, false);
    });
    el('career-office').addEventListener('click', event => {
      if (event.target.closest('[data-career-action="seek-job"]')) seekJob();
    });
    el('career-season-review').addEventListener('click', event => {
      const action = event.target.closest('[data-season-action]')?.dataset.seasonAction;
      if (action === 'continue') continueCareerRun();
      else if (action === 'stop') { state.careerRun = false; save(); render(); }
      else if (action === 'job') acceptJob(event.target.closest('[data-club]').dataset.club);
      else if (action === 'agent') switchTab('market');
    });
    ['training', 'talk', 'priority'].forEach(key => el(`career-${key}`).addEventListener('change', event => { state[key] = event.target.value; save(); }));
    el('career-play-match').addEventListener('click', playRound);
    el('career-sim-season').addEventListener('click', simulateSeasonFast);
    el('career-sim-career').addEventListener('click', simulateCareerFast);
    el('career-reset').addEventListener('click', () => {
      if (window.confirm('¿Abandonar esta carrera? Se perderá todo el progreso.')) {
        localStorage.removeItem(KEY);
        state = null;
        render();
        updateRoleForm();
      }
    });
  }

  function init() {
    if (!el('career-zone')) return;
    state = load();
    bind();
    render();
    loadCatalog();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());