(function () {
  'use strict';

  var STORAGE_KEY = 'gx_career_v1';
  var CLUBS = [
    { min: 0, name: 'CD Barrio', level: 1 },
    { min: 64, name: 'Real Zaragoza', level: 2 },
    { min: 70, name: 'Real Betis', level: 3 },
    { min: 76, name: 'Atlético de Madrid', level: 4 },
    { min: 82, name: 'FC Barcelona', level: 5 },
    { min: 88, name: 'Real Madrid', level: 6 }
  ];
  var state = null;
  var selectedFocus = '';

  function byId(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }
  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && parsed.name && Array.isArray(parsed.history)) return parsed;
    } catch (_) {}
    return null;
  }
  function currentClub(rating) {
    var club = CLUBS[0];
    CLUBS.forEach(function (candidate) { if (rating >= candidate.min) club = candidate; });
    return club;
  }
  function marketValue(rating, age) {
    var ageFactor = age <= 27 ? 1 : Math.max(.25, 1 - ((age - 27) * .1));
    var value = Math.max(.3, Math.pow(Math.max(1, rating - 52), 1.75) * .12 * ageFactor);
    return value < 10 ? value.toFixed(1).replace('.', ',') + ' M€' : Math.round(value) + ' M€';
  }
  function positionLabel(position) {
    return { DEL: 'Delantero', MED: 'Centrocampista', DEF: 'Defensa', POR: 'Portero' }[position] || position;
  }
  function render() {
    var create = byId('career-create');
    var game = byId('career-game');
    if (!create || !game) return;
    create.classList.toggle('hidden', !!state);
    game.classList.toggle('hidden', !state);
    if (!state) return;

    var club = currentClub(state.rating);
    byId('career-avatar').textContent = state.position === 'POR' ? '1' : (state.position === 'DEL' ? '9' : '10');
    byId('career-player').textContent = state.name + ' · ' + positionLabel(state.position);
    byId('career-club').textContent = club.name;
    byId('career-age').textContent = state.age;
    byId('career-rating').textContent = state.rating;
    byId('career-value').textContent = marketValue(state.rating, state.age);
    byId('career-season').textContent = state.history.length + 1;
    byId('career-history').innerHTML = state.history.slice().reverse().map(function (item) {
      return '<li><span>' + escapeHtml(item.season) + '</span><b>' + escapeHtml(item.club) + ' · ' + item.apps + ' PJ · ' + item.goals + ' G · ' + item.assists + ' A</b><em>' + escapeHtml(item.highlight) + '</em></li>';
    }).join('') || '<li><span>16 años</span><b>Tu historia empieza aquí</b><em>Cantera</em></li>';

    var retired = state.age >= 36;
    byId('career-action').classList.toggle('hidden', retired);
    if (retired) {
      var totals = state.history.reduce(function (sum, item) {
        sum.apps += item.apps; sum.goals += item.goals; sum.assists += item.assists; sum.titles += item.title ? 1 : 0; return sum;
      }, { apps: 0, goals: 0, assists: 0, titles: 0 });
      byId('career-result').classList.remove('hidden');
      byId('career-result').innerHTML = '<strong>Carrera terminada.</strong> ' + totals.apps + ' partidos, ' + totals.goals + ' goles, ' + totals.assists + ' asistencias y ' + totals.titles + ' títulos. Tu reputación de ' + state.rating + ' será el punto de partida de la futura carrera como entrenador.';
    }
  }
  function simulateSeason() {
    if (!state || !selectedFocus) return;
    var clubBefore = currentClub(state.rating);
    var prime = state.age <= 28;
    var growth = prime ? randomInt(1, 3) : (state.age <= 32 ? randomInt(-1, 1) : randomInt(-3, -1));
    if (selectedFocus === 'mental') growth += 1;
    if (state.style === 'fisico' && selectedFocus === 'fisico') growth += 1;
    if (state.style === 'tecnico' && selectedFocus === 'tecnica') growth += 1;
    state.rating = clamp(state.rating + growth, 52, 94);

    var club = currentClub(state.rating);
    var fitnessBonus = selectedFocus === 'fisico' ? 4 : 0;
    var apps = clamp(randomInt(20, 35) + fitnessBonus + Math.floor((state.rating - 65) / 4), 12, 42);
    var attack = state.position === 'DEL' ? 1 : (state.position === 'MED' ? .55 : (state.position === 'DEF' ? .18 : .02));
    var creation = state.position === 'MED' ? .75 : (state.position === 'DEL' ? .38 : .25);
    var techniqueBonus = selectedFocus === 'tecnica' ? 1.15 : 1;
    var goals = Math.max(0, Math.round(apps * attack * ((state.rating - 48) / 45) * techniqueBonus + randomInt(-2, 3)));
    var assists = Math.max(0, Math.round(apps * creation * ((state.rating - 50) / 58) * techniqueBonus + randomInt(-2, 3)));
    var titleChance = .04 + (club.level * .045) + (state.rating - 60) * .006 + (selectedFocus === 'mental' ? .05 : 0);
    var title = Math.random() < titleChance;
    var moved = club.name !== clubBefore.name;
    var highlight = title ? '🏆 Campeón' : (moved ? '✈ Fichaje' : (goals + assists >= 25 ? '★ Temporadón' : '✓ Consolidado'));
    var seasonLabel = state.age + '/' + (state.age + 1);
    state.history.push({ season: seasonLabel, club: club.name, apps: apps, goals: goals, assists: assists, title: title, highlight: highlight });
    state.age += 1;
    save();
    render();
    if (state.age >= 36) return;

    byId('career-result').classList.remove('hidden');
    byId('career-result').innerHTML = '<strong>' + escapeHtml(club.name) + ':</strong> ' + apps + ' partidos, ' + goals + ' goles y ' + assists + ' asistencias.' + (moved ? ' Tu rendimiento provoca un salto de club.' : '') + (title ? ' Terminas la temporada levantando un título.' : '') + '<div><button type="button" class="career-primary career-next" id="career-next-season">Continuar</button></div>';
    byId('career-action').classList.add('hidden');
    var next = byId('career-next-season');
    if (next) next.addEventListener('click', function () {
      selectedFocus = '';
      document.querySelectorAll('.career-focus button').forEach(function (button) { button.classList.remove('is-selected'); });
      byId('career-play-season').disabled = true;
      byId('career-result').classList.add('hidden');
      byId('career-action').classList.remove('hidden');
      render();
    });
  }
  function init() {
    if (!byId('career-zone')) return;
    state = load();
    render();
    byId('games-career-shortcut').addEventListener('click', function () { byId('career-zone').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    byId('career-create').addEventListener('submit', function (event) {
      event.preventDefault();
      var name = byId('career-name').value.trim();
      if (!name) return;
      state = { name: name, position: byId('career-position').value, style: byId('career-style').value, age: 16, rating: 58, history: [] };
      save(); render();
    });
    document.querySelectorAll('.career-focus button').forEach(function (button) {
      button.addEventListener('click', function () {
        selectedFocus = button.getAttribute('data-focus');
        document.querySelectorAll('.career-focus button').forEach(function (item) { item.classList.toggle('is-selected', item === button); });
        byId('career-play-season').disabled = false;
      });
    });
    byId('career-play-season').addEventListener('click', simulateSeason);
    byId('career-reset').addEventListener('click', function () {
      if (!window.confirm('¿Borrar esta carrera y empezar de nuevo?')) return;
      localStorage.removeItem(STORAGE_KEY); state = null; selectedFocus = ''; render();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());