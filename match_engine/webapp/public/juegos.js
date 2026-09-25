(function () {
  'use strict';

  const KEY = 'gx_manager_career_v5';
  const ROLE_LABELS = { manager: 'Entrenador', selector: 'Seleccionador', player: 'Jugador' };
  const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2'];
  const UEFA = new Set(['albanien', 'ddr', 'osterreich', 'bielorrussland', 'belgien', 'bosnien-herzegowina', 'bulgarien', 'kroatien', 'tschechien', 'danemark', 'england', 'finnland', 'frankreich', 'georgien', 'deutschland', 'griechenland', 'ungarn', 'island', 'ireland', 'israel', 'italien', 'niederlande', 'nordmazedonien', 'nordirland', 'norwegen', 'polen', 'portugal', 'rumania', 'russland', 'schottland', 'serbien', 'slowakei', 'slowenien', 'urss', 'spanien', 'schweden', 'schweiz', 'turkei', 'ukraine', 'wales', 'jugoslawien']);
  const CONMEBOL = new Set(['argentinien', 'bolivien', 'brasilien', 'chile', 'kolumbien', 'ecuador', 'paraguay', 'peru', 'uruguay', 'venezuela']);
  let catalog = [];
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

  function save() {
    state.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    if (el('career-save-state')) el('career-save-state').textContent = 'Guardado automático · ahora';
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY));
      return parsed?.version === 5 && parsed.club && parsed.schedule ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function makeSchedule(teams) {
    const ids = teams.map(team => team.slug);
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
      const era = club.seasons?.[0] || '';
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
    return catalog.filter(team => team.group === group && team.seasons?.length);
  }

  function populateTeams() {
    const teams = matchingTeams().sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    el('career-team').innerHTML = teams.map(team => `<option value="${clean(team.slug)}">${clean(teamName(team))} · ${team.ovr || '—'}</option>`).join('');
    el('career-team').disabled = !teams.length;
    el('career-start').disabled = !teams.length;
  }

  function populateLeagues() {
    const select = el('career-league');
    const previous = select.value;
    const counts = new Map();
    catalog.forEach(team => {
      if (team.group && team.group !== '🌍 Selecciones' && team.seasons?.length) counts.set(team.group, (counts.get(team.group) || 0) + 1);
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

  function competitionTeams(selected, role) {
    const pool = matchingTeams().sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const selectedIndex = pool.findIndex(team => team.slug === selected.slug);
    const from = clamp(selectedIndex - 4, 0, Math.max(0, pool.length - 10));
    const chosen = pool.slice(from, from + 10);
    if (!chosen.some(team => team.slug === selected.slug)) chosen[chosen.length - 1] = selected;
    return chosen.map(team => ({
      slug: team.slug, name: teamName(team), nameEs: team.nameEs, badge: team.badge,
      seasons: team.seasons, ovr: team.ovr || 74, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0
    }));
  }

  function shuffled(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = random(0, index);
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function createCompetition(id, name, type, participants) {
    const unique = [...new Set(participants)];
    const user = state.club.slug;
    const draw = unique.includes(user)
      ? shuffled(unique.filter(slug => slug !== user)).slice(0, 7).concat(user)
      : shuffled(unique).slice(0, 8);
    return { id, name, type, participants: shuffled(draw), rounds: [], status: 'ready', champion: null };
  }

  function buildSeasonCompetitions() {
    const slugs = state.teams.map(team => team.slug);
    if (state.role === 'selector') {
      const national = catalog.filter(team => team.group === '🌍 Selecciones');
      if (state.season % 2 === 0) return [createCompetition('world', 'Mundial', 'Selecciones · fase final', national.map(team => team.slug))];
      if (UEFA.has(state.club.slug)) return [createCompetition('euro', 'Eurocopa', 'UEFA · fase final', national.filter(team => UEFA.has(team.slug)).map(team => team.slug))];
      if (CONMEBOL.has(state.club.slug)) return [createCompetition('copa-america', 'Copa América', 'CONMEBOL · fase final', national.filter(team => CONMEBOL.has(team.slug)).map(team => team.slug))];
      return [createCompetition('continental', 'Copa continental', 'Selecciones · fase final', national.filter(team => !UEFA.has(team.slug) && !CONMEBOL.has(team.slug)).map(team => team.slug))];
    }
    const continentalName = /libertadores|brasil|argentina|conmebol/i.test(state.league) ? 'Copa Libertadores' : 'Champions League';
    const ranked = state.history.length
      ? state.history[state.history.length - 1].position <= 5
      : state.teams.slice().sort((a, b) => b.ovr - a.ovr).findIndex(team => team.slug === state.club.slug) < 5;
    const competitions = [createCompetition('cup', 'Copa nacional', 'Eliminación directa', slugs)];
    if (ranked) competitions.push(createCompetition('continental', continentalName, 'Fase final · ida única', slugs));
    return competitions;
  }

  function playerValue(player) {
    const ageFactor = player.age <= 23 ? 1.25 : player.age >= 30 ? 0.72 : 1;
    return Number(clamp(((player.rating - 55) ** 2) / 13 * ageFactor, 0.8, 145).toFixed(1));
  }

  async function getMarketPlayers(club) {
    const rivals = state.teams.filter(team => team.slug !== club.slug).slice(0, 5);
    const squads = await Promise.all(rivals.map(async team => {
      try {
        const response = await fetch(`/lookup?team=${encodeURIComponent(team.slug)}&era=${encodeURIComponent(team.seasons?.[0] || '')}`);
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

  async function createCareer(event) {
    event.preventDefault();
    const selected = catalog.find(team => team.slug === el('career-team').value);
    if (!selected) return;
    const role = el('career-role').value;
    const teams = competitionTeams(selected, role);
    const club = teams.find(team => team.slug === selected.slug) || teams[0];
    state = {
      version: 5, role, name: el('career-name').value.trim() || ROLE_LABELS[role],
      league: role === 'selector' ? '🌍 Selecciones' : el('career-league').value,
      club, teams, squad: [], schedule: makeSchedule(teams), round: 0, season: 1,
      budget: role === 'selector' ? 0 : Math.max(10, Math.round(((selected.ovr || 74) - 65) * 3.2)),
      balance: 0, board: 72, fans: 68, training: 'balanced', talk: 'calm', priority: 'sport',
      tactics: { formation: '4-3-3', mentality: 'balanced', press: 'medium', tempo: 'balanced' },
      inbox: [{ title: role === 'player' ? 'Tu oportunidad empieza aquí' : 'Bienvenido al cargo', text: role === 'selector' ? 'La federación exige resultados y una convocatoria con identidad.' : role === 'player' ? 'Gana minutos, mejora tus atributos y construye tu carrera.' : 'La directiva espera identidad, resultados y cuentas bajo control.' }],
      history: [], lastResult: null, market: [], offers: [], transfers: [], competitions: [], dismissed: false,
      player: role === 'player' ? {
        name: el('career-name').value.trim() || 'Promesa', position: el('career-player-position').value,
        style: el('career-player-style').value, rating: 67, age: 18, minutes: 0, goals: 0, assists: 0,
        starts: 0, form: 6.5, contract: 3, salary: 0.4, status: 'Suplente'
      } : null
    };
    state.squad = await getSquad(selected);
    if (state.player) injectCareerPlayer();
    if (role !== 'selector') state.market = await getMarketPlayers(club);
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
    document.querySelector('[data-career-tab="squad"]').textContent = labels.squad;
    document.querySelector('[data-career-tab="market"]').textContent = labels.market;
    document.querySelector('[data-career-tab="office"]').textContent = labels.office;
    document.querySelector('.career-inbox > span').textContent = labels.inbox;
    const terms = document.querySelectorAll('.career-scoreboard dt');
    terms[2].textContent = labels.budget;
    terms[3].textContent = labels.board;
  }

  function renderHeader() {
    const club = currentTeam();
    el('career-badge').src = badge(club);
    el('career-club').textContent = teamName(club);
    el('career-manager').textContent = `${state.name} · ${ROLE_LABELS[state.role]} · Temporada ${state.season}`;
    el('career-round').textContent = `${Math.min(state.round + 1, state.schedule.length)}/${state.schedule.length}`;
    el('career-position').textContent = `${userPosition()}º`;
    el('career-budget').textContent = state.role === 'selector' ? `${Math.round((state.board + state.fans) / 2)}/100` : state.role === 'player' ? money(state.player.rating * 0.38) : money(state.budget);
    el('career-board').textContent = `${Math.round(state.board)}%`;
  }

  function fixtureHtml(match) {
    if (!match) return '<p>Temporada finalizada.</p>';
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
    const decisionLabels = document.querySelectorAll('.career-decisions label');
    if (state.role === 'player') {
      decisionLabels[0].childNodes[0].nodeValue = 'Entrenamiento personal';
      decisionLabels[1].childNodes[0].nodeValue = 'Actitud en el vestuario';
      decisionLabels[2].childNodes[0].nodeValue = 'Objetivo personal';
    }
    const result = el('career-result');
    result.classList.toggle('hidden', !state.lastResult);
    if (state.lastResult) result.innerHTML = `<strong>${clean(state.lastResult.headline)}</strong><div class="career-result-score">${clean(state.lastResult.score)}</div><span>${clean(state.lastResult.detail)}</span>`;
  }

  function renderSquad() {
    el('career-lineup-count').textContent = `${starters().length}/11`;
    document.querySelector('[data-career-panel="squad"] h4').textContent = state.role === 'selector' ? 'Convocatoria y once nacional' : state.role === 'player' ? 'Competencia por un puesto' : 'Convocatoria y once titular';
    el('career-squad').innerHTML = state.squad.slice().sort((a, b) => Number(b.user) - Number(a.user) || Number(b.starter) - Number(a.starter) || b.rating - a.rating).map(player => {
      const locked = state.role === 'player' ? ' disabled' : '';
      return `<button type="button" class="career-player-row${player.starter ? ' is-starting' : ''}${player.user ? ' is-user' : ''}" data-player="${clean(player.id)}"${locked}><span class="career-player-pos">${clean(player.position)}</span><span><b>${clean(player.name)}${player.user ? ' · TÚ' : ''}</b><small>${player.starter ? 'Titular' : 'Suplente'} · ${player.apps || 0} PJ · ${player.goals || 0} G · ${player.assists || 0} A</small></span><span class="career-player-rating">${player.rating}</span><span class="career-player-energy">${Math.round(player.fitness)}%</span></button>`;
    }).join('');
  }

  function renderTactics() {
    const canManage = state.role !== 'player';
    el('career-tactics').innerHTML = `<div class="career-tactic-controls"><label class="career-control">Formación<select data-tactic="formation"${canManage ? '' : ' disabled'}>${FORMATIONS.map(value => `<option${state.tactics.formation === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label class="career-control">Mentalidad<select data-tactic="mentality"${canManage ? '' : ' disabled'}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Atacante</option></select></label><label class="career-control">Presión<select data-tactic="press"${canManage ? '' : ' disabled'}><option value="low">Bloque bajo</option><option value="medium">Media</option><option value="high">Alta</option></select></label><label class="career-control">Ritmo<select data-tactic="tempo"${canManage ? '' : ' disabled'}><option value="patient">Pausado</option><option value="balanced">Mixto</option><option value="fast">Vertical</option></select></label><div class="career-tactic-summary"><div><span>MEDIA XI</span><b>${average(starters(), 'rating').toFixed(1)}</b></div><div><span>MORAL</span><b>${Math.round(average(state.squad, 'morale'))}</b></div><div><span>FÍSICO</span><b>${Math.round(average(starters(), 'fitness'))}</b></div></div><div class="career-factors"><h4>Impacto de tus decisiones <b>${careerModifier() >= 0 ? '+' : ''}${careerModifier().toFixed(1)}</b></h4>${careerFactors().map(factor => `<div class="${factor.value >= 0 ? 'is-positive' : 'is-negative'}"><span>${clean(factor.label)}</span><b>${factor.value >= 0 ? '+' : ''}${factor.value.toFixed(1)}</b></div>`).join('')}</div></div><div class="career-pitch"><div class="career-pitch-note">${state.role === 'player' ? `${clean(state.player.position)} · ${clean(state.player.status)} · valoración ${state.player.rating}` : `${state.tactics.formation} · ${state.tactics.mentality} · presión ${state.tactics.press}`}</div></div>`;
    Object.entries(state.tactics).forEach(([key, value]) => {
      const input = el('career-tactics').querySelector(`[data-tactic="${key}"]`);
      if (input) input.value = value;
    });
  }

  function renderCalendar() {
    el('career-calendar').innerHTML = state.schedule.map((matches, index) => `<section class="career-round-block"><h5>Jornada ${index + 1}${index === state.round ? ' · próxima' : ''}${index === 8 ? ' · mercado de invierno' : ''}</h5>${matches.map(match => `<div class="career-match-row${match.home === state.club.slug || match.away === state.club.slug ? ' is-user' : ''}"><span><img src="${clean(badge(findTeam(match.home)))}" alt="">${clean(teamName(findTeam(match.home)))}</span><b>${match.played ? `${match.homeGoals} - ${match.awayGoals}` : '—'}</b><span><img src="${clean(badge(findTeam(match.away)))}" alt="">${clean(teamName(findTeam(match.away)))}</span></div>`).join('')}</section>`).join('');
  }

  function renderTable() {
    el('career-table').innerHTML = `<table class="career-standings"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead><tbody>${sortedTable().map((team, index) => `<tr class="${team.slug === state.club.slug ? 'is-user' : ''}"><td>${index + 1}</td><td><img src="${clean(badge(team))}" alt="">${clean(teamName(team))}</td><td>${team.p}</td><td>${team.w}</td><td>${team.d}</td><td>${team.l}</td><td>${team.gf}</td><td>${team.ga}</td><td>${team.gf - team.ga}</td><td><b>${team.pts}</b></td></tr>`).join('')}</tbody></table>`;
  }

  function renderCompetitions() {
    el('career-competitions').innerHTML = state.competitions.map(competition => {
      const champion = competition.champion ? findTeam(competition.champion) : null;
      const rounds = competition.rounds.map(round => `<div class="career-bracket-round"><h5>${clean(round.label)}</h5>${round.matches.map(match => `<div class="career-bracket-match"><span><img src="${clean(badge(findTeam(match.home)))}" alt="">${clean(teamName(findTeam(match.home)))}</span><b>${match.homeGoals} - ${match.awayGoals}</b><span><img src="${clean(badge(findTeam(match.away)))}" alt="">${clean(teamName(findTeam(match.away)))}</span></div>`).join('')}</div>`).join('');
      return `<article class="career-competition"><header><div><span>${clean(competition.type)}</span><h4>${clean(competition.name)}</h4></div>${champion ? `<strong><img src="${clean(badge(champion))}" alt="">${clean(teamName(champion))} campeón</strong>` : '<strong>En juego</strong>'}</header><div class="career-bracket">${rounds || '<p>Cuadro preparado. Ocho equipos, eliminación directa.</p>'}</div>${competition.status === 'finished' ? '' : `<footer><button data-comp="${clean(competition.id)}">Simular ronda</button><button data-comp-all="${clean(competition.id)}">Simular torneo completo</button></footer>`}</article>`;
    }).join('') || '<p class="career-market-note">No te has clasificado para competiciones esta temporada.</p>';
  }

  function transferWindow() {
    return state.round <= 2 || (state.round >= 8 && state.round <= 10);
  }

  function renderMarket() {
    if (state.role === 'selector') {
      el('career-market').innerHTML = `<div class="career-market-head"><div><span>OBSERVACIÓN NACIONAL</span><h4>Base de datos de convocables</h4></div><b>${state.squad.length} jugadores seguidos</b></div><p class="career-market-note">La convocatoria se gestiona desde la pestaña Convocatoria. Compara media, posición, estado físico y estadísticas antes de decidir.</p>${marketHistoryHtml()}`;
      return;
    }
    if (state.role === 'player') {
      const offers = state.offers.filter(offer => offer.type === 'player');
      el('career-market').innerHTML = `<div class="career-market-head"><div><span>AGENTE Y CONTRATOS</span><h4>Ofertas por tu fichaje</h4></div><b>${offers.length} ofertas</b></div><div class="career-offers">${offers.length ? offers.map(offer => `<article class="career-offer"><img src="${clean(badge(findTeam(offer.club)))}" alt=""><span><strong>${clean(teamName(findTeam(offer.club)))}</strong><small>${offer.salary.toFixed(1)} M€/año · ${offer.contract} temporadas</small></span><button data-market-action="accept-player" data-offer="${clean(offer.id)}">Aceptar</button><button data-market-action="reject" data-offer="${clean(offer.id)}">Rechazar</button></article>`).join('') : '<p class="career-market-note">Tu agente aún no ha recibido ofertas. Los minutos y el rendimiento aumentan el interés.</p>'}</div>${marketHistoryHtml()}`;
      return;
    }
    const open = transferWindow();
    el('career-market').innerHTML = `<div class="career-market-head"><div><span>${open ? 'VENTANA ABIERTA' : 'MERCADO CERRADO'}</span><h4>${state.round >= 8 ? 'Mercado de invierno' : 'Mercado de fichajes'}</h4></div><b>${money(state.budget)}</b></div><div class="career-offers">${state.offers.filter(offer => offer.type === 'sale').map(offer => { const player = state.squad.find(item => item.id === offer.player); return player ? `<article class="career-offer"><img src="${clean(badge(findTeam(offer.club)))}" alt=""><span><strong>${clean(teamName(findTeam(offer.club)))} quiere a ${clean(player.name)}</strong><small>Oferta: ${money(offer.amount)}</small></span><button data-market-action="accept-sale" data-offer="${clean(offer.id)}">Aceptar</button><button data-market-action="reject" data-offer="${clean(offer.id)}">Rechazar</button></article>` : ''; }).join('')}</div><div class="career-market-list">${state.market.map(player => `<article class="career-target"><img src="${clean(badge(findTeam(player.club)))}" alt=""><span><strong>${clean(player.name)}</strong><small>${clean(player.position)} · ${player.age} años · ${clean(teamName(findTeam(player.club)))}</small></span><b>${player.rating}</b><span><strong>${money(player.value)}</strong><small>Cláusula ${money(player.clause)}</small></span><button data-market-action="buy" data-player="${clean(player.id)}"${open ? '' : ' disabled'}>Negociar</button><button data-market-action="clause" data-player="${clean(player.id)}"${open ? '' : ' disabled'}>Cláusula</button></article>`).join('')}</div>${marketHistoryHtml()}`;
  }

  function marketHistoryHtml() {
    return `<div class="career-transfer-history"><h4>Operaciones</h4>${state.transfers.length ? state.transfers.slice(0, 12).map(item => `<div><span>${clean(item.text)}</span><strong>${clean(item.amount)}</strong></div>`).join('') : '<div><span>Sin movimientos todavía</span><strong>—</strong></div>'}</div>`;
  }

  function renderOffice() {
    if (state.role === 'player') {
      const player = state.player;
      el('career-office').innerHTML = `<div class="career-office-kpis"><div class="career-office-kpi"><span>VALORACIÓN</span><b>${player.rating}</b></div><div class="career-office-kpi"><span>MINUTOS</span><b>${player.minutes}</b></div><div class="career-office-kpi"><span>GOLES</span><b>${player.goals}</b></div><div class="career-office-kpi"><span>ASISTENCIAS</span><b>${player.assists}</b></div></div><div class="career-objectives"><div class="career-objective"><span><strong>Rol actual</strong><small>Gana el puesto con forma y entrenamiento</small></span><b>${clean(player.status)}</b></div><div class="career-objective"><span><strong>Contrato</strong><small>${player.salary.toFixed(1)} M€ por temporada</small></span><b>${player.contract} años</b></div><div class="career-objective"><span><strong>Nota media</strong><small>Rendimiento de la temporada</small></span><b>${player.form.toFixed(1)}</b></div></div>${historyHtml()}`;
      return;
    }
    const target = Math.max(3, Math.ceil(state.teams.length / 2));
    el('career-office').innerHTML = `<div class="career-office-kpis"><div class="career-office-kpi"><span>${state.role === 'selector' ? 'PRESTIGIO' : 'SALDO TEMPORADA'}</span><b>${state.role === 'selector' ? Math.round((state.board + state.fans) / 2) : money(state.balance)}</b></div><div class="career-office-kpi"><span>AFICIÓN</span><b>${Math.round(state.fans)}%</b></div><div class="career-office-kpi"><span>CONFIANZA</span><b>${Math.round(state.board)}%</b></div><div class="career-office-kpi"><span>REPUTACIÓN</span><b>${Math.round((state.board + state.fans) / 2)}</b></div></div>${state.dismissed ? '<div class="career-dismissed"><strong>Has sido destituido</strong><span>Tu historial continúa. Acepta un proyecto de menor reputación para reconstruir tu carrera.</span><button data-career-action="seek-job">Buscar nuevo club</button></div>' : ''}<div class="career-objectives"><div class="career-objective"><span><strong>Objetivo deportivo</strong><small>Terminar entre los ${target} primeros</small></span><b>${userPosition() <= target ? 'En objetivo' : 'En riesgo'}</b></div><div class="career-objective"><span><strong>Vestuario</strong><small>Mantener la moral por encima de 60</small></span><b>${Math.round(average(state.squad, 'morale'))}/100</b></div></div>${historyHtml()}`;
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
    if (!player) return;
    const count = starters().length;
    if ((!player.starter && count >= 11) || (player.starter && count <= 8)) return;
    player.starter = !player.starter;
    save();
    renderSquad();
    renderTactics();
  }

  function localScore(home, away, userSlug) {
    const bonus = team => team.slug === userSlug ? careerModifier() : 0;
    const homePower = home.ovr + random(-8, 8) + bonus(home) + 2;
    const awayPower = away.ovr + random(-8, 8) + bonus(away);
    return [
      clamp(Math.round(1.2 + (homePower - awayPower) / 12 + Math.random() * 1.5 - 0.65), 0, 6),
      clamp(Math.round(1 + (awayPower - homePower) / 12 + Math.random() * 1.5 - 0.65), 0, 6)
    ];
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

  function simulateCompetitionRound(competition) {
    if (competition.status === 'finished') return;
    const participants = competition.rounds.length
      ? competition.rounds[competition.rounds.length - 1].matches.map(match => match.winner)
      : competition.participants;
    if (participants.length <= 1) {
      competition.champion = participants[0] || null;
      competition.status = 'finished';
      return;
    }
    const labels = { 8: 'Cuartos de final', 4: 'Semifinales', 2: 'Final' };
    const matches = [];
    for (let index = 0; index < participants.length; index += 2) {
      const home = findTeam(participants[index]);
      const away = findTeam(participants[index + 1]);
      let score = localScore(home, away, state.club.slug);
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
    const interested = state.teams.filter(team => team.slug !== state.club.slug);
    if (!interested.length) return;
    const buyingClub = interested[random(0, interested.length - 1)];
    if (state.role === 'player') {
      if ((state.round + 1) % 3 || state.offers.some(offer => offer.type === 'player')) return;
      const appeal = state.player.form + state.player.rating / 20;
      if (appeal < 9 || Math.random() > 0.75) return;
      state.offers.push({ id: `o-${Date.now()}`, type: 'player', club: buyingClub.slug, salary: Number((state.player.salary * random(115, 165) / 100).toFixed(1)), contract: random(2, 5) });
      state.inbox.unshift({ title: 'Tu agente tiene una oferta', text: `${teamName(buyingClub)} quiere negociar tu fichaje.` });
      return;
    }
    if (state.role !== 'manager' || (state.round + 1) % 3 || state.offers.some(offer => offer.type === 'sale')) return;
    const candidates = state.squad.filter(player => !player.user && state.squad.length > 14).sort((a, b) => b.rating - a.rating).slice(0, 8);
    if (!candidates.length) return;
    const player = candidates[random(0, candidates.length - 1)];
    const amount = Number((playerValue(player) * random(105, 145) / 100).toFixed(1));
    state.offers.push({ id: `o-${Date.now()}`, type: 'sale', club: buyingClub.slug, player: player.id, amount });
    state.inbox.unshift({ title: `Oferta por ${player.name}`, text: `${teamName(buyingClub)} ofrece ${money(amount)}. Revísala en Mercado.` });
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

  function signPlayer(id, payClause) {
    if (state.role !== 'manager' || !transferWindow()) return;
    const target = state.market.find(player => player.id === id);
    if (!target || state.squad.length >= 25) {
      state.inbox.unshift({ title: 'Plantilla completa', text: 'Debes aceptar una venta antes de incorporar más jugadores.' });
      render();
      return;
    }
    const cost = payClause ? target.clause : Number((target.value * 1.08).toFixed(1));
    if (state.budget < cost) {
      state.inbox.unshift({ title: 'Operación bloqueada', text: `Faltan ${money(cost - state.budget)} para cerrar el fichaje.` });
      render();
      return;
    }
    state.budget -= cost;
    state.balance -= cost;
    state.squad.push({ id: `t-${Date.now()}`, name: target.name, position: target.position, rating: target.rating, age: target.age, fitness: 100, morale: 76, starter: false, apps: 0, goals: 0, assists: 0 });
    state.market = state.market.filter(player => player.id !== id);
    const action = payClause ? 'Cláusula pagada' : 'Fichaje acordado';
    state.transfers.unshift({ text: `${action}: ${target.name}`, amount: `-${money(cost)}` });
    state.inbox.unshift({ title: target.name + ' ya es nuevo jugador', text: `${action} por ${money(cost)}. Está disponible en Plantilla.` });
    save();
    render();
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
    const destination = offer && findTeam(offer.club);
    if (!destination) return;
    state.club = destination;
    state.player.salary = offer.salary;
    state.player.contract = offer.contract;
    state.squad = await getSquad(destination);
    injectCareerPlayer();
    state.transfers.unshift({ text: `Fichaje por ${teamName(destination)}`, amount: `${offer.salary.toFixed(1)} M€/año` });
    state.offers = [];
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
      if (!userMatch) throw new Error('No se encontró el partido de esta jornada');
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
    if (!userMatch) return false;
    state.schedule[state.round].forEach(match => {
      const score = localScore(findTeam(match.home), findTeam(match.away), state.club.slug);
      applyResult(match, score[0], score[1]);
    });
    weeklyConsequences(userMatch);
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
    state.season++;
    state.round = 0;
    state.schedule = makeSchedule(state.teams);
    state.teams.forEach(team => Object.assign(team, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
    state.squad.forEach(player => {
      player.fitness = 100;
      player.morale = clamp(player.morale + 5, 40, 100);
      player.age = (player.age || 24) + 1;
      player.apps = 0;
      player.goals = 0;
      player.assists = 0;
    });
    state.offers = [];
    state.competitions = buildSeasonCompetitions();
    state.inbox.unshift({ title: 'Nueva temporada', text: 'Tu reputación y todas tus decisiones anteriores siguen contando.' });
    state.lastResult = null;
  }

  function simulateSeasonFast() {
    if (state.dismissed || !window.confirm('¿Simular de golpe el resto de esta temporada?')) return;
    if (state.round >= state.schedule.length) prepareNextSeason();
    simulateRemainingSeason();
    if (!state.dismissed) state.lastResult = { headline: 'Temporada simulada', score: `${userPosition()}º · ${currentTeam().pts} puntos`, detail: 'Liga y competiciones se han resuelto usando plantilla, táctica, moral, físico y economía.' };
    save();
    render();
    switchTab('hub');
  }

  function simulateCareerFast() {
    if (state.dismissed || !window.confirm('¿Simular toda la carrera? El proceso se detendrá si te despiden o te retiras.')) return;
    if (state.round >= state.schedule.length) prepareNextSeason();
    const seasons = state.player ? Math.max(1, 36 - state.player.age) : 10;
    const firstSeason = state.season;
    for (let index = 0; index < seasons && !state.dismissed; index++) {
      simulateRemainingSeason();
      if (index < seasons - 1 && !state.dismissed) prepareNextSeason();
    }
    const completed = state.season - firstSeason + 1;
    state.lastResult = state.dismissed
      ? { headline: 'Carrera interrumpida', score: `${completed} temporadas`, detail: 'La confianza cayó al mínimo y has sido destituido.' }
      : { headline: state.player ? 'Carrera completada · retirada' : 'Década completada', score: `${completed} temporadas`, detail: `${state.history.filter(item => item.trophies?.length).length} temporadas con títulos. Consulta el historial completo.` };
    save();
    render();
    switchTab('hub');
  }

  function finishSeason() {
    const position = userPosition();
    const club = currentTeam();
    let outcome = 'Permanencia';
    if (position === 1) outcome = state.role === 'selector' ? 'Campeón internacional' : 'Campeón · Champions';
    else if (position <= 4) outcome = state.role === 'selector' ? 'Fase final' : 'Clasificado para Champions';
    else if (position === 5) outcome = state.role === 'selector' ? 'Clasificado' : 'Clasificado para Europa League';
    else if (position >= state.teams.length - 1) outcome = state.role === 'selector' ? 'Eliminado' : 'Descenso';
    const trophies = state.competitions.filter(item => item.champion === state.club.slug).map(item => item.name);
    if (trophies.length) outcome += ` · ${trophies.join(' + ')}`;
    state.history.push({ season: state.season, position, points: club.pts, gf: club.gf, ga: club.ga, outcome, trophies });
    state.board = clamp(state.board + (position <= 3 ? 12 : position <= 5 ? 4 : -8), 10, 100);
    state.budget += position === 1 ? 18 : position <= 3 ? 10 : 4;
    if (state.player) {
      state.player.age++;
      state.player.contract--;
      if (state.player.contract <= 0) {
        state.player.contract = 3;
        state.player.salary = Number((state.player.salary + Math.max(0.2, (state.player.rating - 67) * 0.08)).toFixed(1));
      }
    }
    state.lastResult = { headline: position === 1 ? '¡Campeones!' : 'Temporada finalizada', score: `${position}º · ${club.pts} puntos`, detail: 'Tu progreso queda guardado. Puedes continuar el proyecto.' };
  }

  async function startNextSeason() {
    prepareNextSeason();
    if (state.role !== 'selector') state.market = await getMarketPlayers(currentTeam());
    save();
    render();
  }

  async function loadCatalog() {
    try {
      const response = await fetch('/catalog');
      if (!response.ok) throw new Error('Catálogo no disponible');
      catalog = await response.json();
      updateRoleForm();
    } catch (_) {
      el('career-team').innerHTML = '<option>No se pudo cargar el catálogo</option>';
    }
  }

  function bind() {
    el('games-career-shortcut').addEventListener('click', () => el('career-zone').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    el('career-create').addEventListener('submit', createCareer);
    el('career-role').addEventListener('change', updateRoleForm);
    el('career-league').addEventListener('change', populateTeams);
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
      else if (action === 'accept-sale') resolveOffer(button.dataset.offer, true);
      else if (action === 'reject') resolveOffer(button.dataset.offer, false);
      else if (action === 'accept-player') acceptPlayerOffer(button.dataset.offer);
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