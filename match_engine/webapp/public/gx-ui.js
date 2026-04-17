/**
 * gx-ui.js — GolazoX Gamification UI v2
 * Museo Panini · Player Card Canvas · Sonido · Barra segmentada · Quests diarias
 * Requiere: gx-user.js cargado antes.  API: window.gxUI.*
 */
'use strict';
(function (w) {

  // ── i18n helper — lee el mismo lang que app.js usa ──────────
  function _gxLang() {
    try { return localStorage.getItem('golazox_lang') || 'es'; } catch(_) { return 'es'; }
  }
  var _GX_STR = {
    'hist-title':    { es: '📜 ÚLTIMAS PARTIDAS',          en: '📜 LATEST MATCHES'          },
    'daily-title':   { es: '📊 STATS DEL DÍA',             en: '📊 TODAY\'S STATS'           },
    'quest-title':   { es: '📋 MISIONES DEL DÍA',          en: '📋 DAILY QUESTS'             },
    'quest-reset':   { es: 'Renuevan a las 00:00',          en: 'Resets at midnight'          },
    'museum-title':  { es: '🏛️ MUSEO DE LEYENDAS',        en: '🏛️ LEGEND MUSEUM'           },
    'museum-sub':    { es: 'Colecciona los grandes equipos históricos', en: 'Collect the legendary historical teams' },
    'next-ach':      { es: '🎯 PRÓXIMOS LOGROS',           en: '🎯 NEXT ACHIEVEMENTS'        },
    'achievements':  { es: '🏅 LOGROS',                    en: '🏅 ACHIEVEMENTS'             },
    'card-title':    { es: '🪪 TARJETA DE JUGADOR',        en: '🪪 PLAYER CARD'              },
    'backup-title':  { es: '💾 COPIA DE SEGURIDAD',        en: '💾 SAVE / RESTORE'           },
    'backup-desc':   { es: 'Guarda tu progreso para restaurarlo en otro dispositivo o si borras el caché.', en: 'Save your progress to restore it on another device or after clearing cache.' },
    'privacy-note':  { es: '🔒 Tus datos se guardan solo en este dispositivo (localStorage). No enviamos nada a nuestros servidores.', en: '🔒 Your data is saved only on this device (localStorage). Nothing is sent to our servers.' },
    'save-btn':      { es: '💾 Guardar progreso',          en: '💾 Save progress'            },
    'restore-btn':   { es: '🔑 Restaurar',                 en: '🔑 Restore'                  },
    'delete-btn':    { es: '⚠️ Borrar progreso',           en: '⚠️ Delete progress'          },
    'stat-matches':  { es: 'partidos',                     en: 'matches'                     },
    'stat-goals':    { es: 'goles',                        en: 'goals'                       },
    'stat-gxp':      { es: 'goles/partido',                en: 'goals/match'                 },
    'stat-teams':    { es: 'equipos',                      en: 'teams'                       },
    'stat-torneos':  { es: 'torneos',                      en: 'tournaments'                 },
    'stat-racha':    { es: 'racha días',                   en: 'day streak'                  },
    'share-daily':   { es: '📤 Compartir puntuación',      en: '📤 Share score'              },
    'ranking-prox':  { es: '🌍 Ranking global',            en: '🌍 Global ranking'           },
    'coming-soon':   { es: 'Próximamente',                 en: 'Coming soon'                 },
    'xp-earned':     { es: '⚡ XP ganado',                 en: '⚡ XP earned'                },
    'cell-matches':  { es: '⚽ Partidos',                  en: '⚽ Matches'                  },
    'cell-goals':    { es: '🎯 Goles',                     en: '🎯 Goals'                    },
    'cell-quests':   { es: '📋 Misiones',                  en: '📋 Quests'                   },
    'pts-today':     { es: 'puntos hoy',                   en: 'points today'                },
    'flash-only':    { es: 'Solo hoy y mañana',            en: 'Today and tomorrow only'     },
    'unlock-ach':    { es: 'Logro desbloqueado',           en: 'Achievement unlocked'        },
    'unlock-team':   { es: '¡Equipo desbloqueado!',        en: 'Team unlocked!'              },
    'quest-done':    { es: '✅ Misión completada (+20 XP)', en: '✅ Quest done (+20 XP)'     },
    'hist-result-w': { es: 'V',                            en: 'W'                           },
    'hist-result-l': { es: 'D',                            en: 'L'                           },
    'locked-since':  { es: 'Desde',                        en: 'Since'                       },
    'locked-streak': { es: 'Racha:',                       en: 'Streak:'                     },
    'locked-days':   { es: 'días',                         en: 'days'                        },
    'locked-xp-req': { es: 'Se desbloquea al acumular',    en: 'Unlocks at'                  },
    'locked-miss':   { es: 'Te faltan',                    en: 'You need'                    },
    'locked-xp':     { es: 'XP.',                          en: 'XP.'                         },
    'locked-how':    { es: '🚀 Cómo conseguirlo:',         en: '🚀 How to unlock:'           },
    'locked-play':   { es: '⚽ Ir a jugar',                en: '⚽ Go play'                  },
    'locked-close':  { es: 'Cerrar',                       en: 'Close'                       },
    'locked-ready':  { es: '✔ Ya tienes XP suficiente — recarga la página para desbloquearlo.', en: '✔ You already have enough XP — reload the page to unlock it.' },
    'locked-title':  { es: 'Equipo bloqueado',             en: 'Locked team'                 },
    'locked-all':    { es: '(todas las ediciones)',        en: '(all editions)'              },
    'backup-input-ph': { es: 'Pega aquí el código completo de respaldo (Base64)...', en: 'Paste your full backup code here (Base64)...' },
    'backup-copy':   { es: '📋 Copiar',                    en: '📋 Copy'                     },
    'backup-copied': { es: '✔ Copiado',                    en: '✔ Copied'                    },
    'backup-restore-ok': { es: '✔ Progreso restaurado',   en: '✔ Progress restored'         },
    'backup-invalid':{ es: '⚠️ Código inválido',           en: '⚠️ Invalid code'             },
    'confirm-reset': { es: '¿Borrar todo tu progreso? Esta acción no se puede deshacer.', en: 'Delete all your progress? This cannot be undone.' },
    'reset-done':    { es: 'Progreso borrado',             en: 'Progress deleted'            },
    'name-too-short':{ es: '⚠️ El nombre debe tener al menos 3 caracteres', en: '⚠️ Name must be at least 3 characters' },
    'name-invalid':  { es: '⚠️ Solo letras, números, puntos y guiones', en: '⚠️ Only letters, numbers, dots and dashes' },
    'name-updated':  { es: '✔ Nombre actualizado: ',      en: '✔ Name updated: '            },
    'card-share':    { es: '📤 Compartir tarjeta',         en: '📤 Share card'               },
    'card-dl':       { es: '⬇️ Descargar',                en: '⬇️ Download'                 },
    'card-copied':   { es: '✔ Tarjeta copiada al portapapeles', en: '✔ Card copied to clipboard' },
    'card-name-lbl': { es: 'Nombre',                       en: 'Name'                        },
    'card-change':   { es: '✏️ Cambiar',                  en: '✏️ Change'                   },
    'card-confirm':  { es: '✔ OK',                         en: '✔ OK'                        },
    'toast-match':   { es: 'partido',                      en: 'match'                       },
    'toast-pen':     { es: 'penaltis',                     en: 'penalties'                   },
    'toast-trn':     { es: 'torneo',                       en: 'tournament'                  },
    'toast-act':     { es: '30 min activo',                en: '30 min active'               },
    'nivel':         { es: '¡Nivel ',                      en: 'Level '                      },
    'xp-max':        { es: ' XP — Nivel máximo ★',        en: ' XP — Max level ★'           },
    'xp-to-next':    { es: ' XP para Lv.',                 en: ' XP to Lv.'                  },
    'lv-since':      { es: 'Desde ',                       en: 'Since '                      },
    'ach-unlocked':  { es: 'aún sin logros',               en: 'no achievements yet'         },
    'card-wm':       { es: 'golazox.com',                  en: 'golazox.com'                 },
    'underdog-toast':{ es: '🐉 ¡Victoria del Underdog! ×1.5 XP', en: '🐉 Underdog Victory! ×1.5 XP' },
    'backup-reminder':{ es: '¡No pierdas tu legado!',            en: 'Don\'t lose your legacy!'     },
  };
  function _gt(key) {
    var lang = _gxLang();
    var s = _GX_STR[key];
    if (!s) return key;
    return s[lang] || s.es || key;
  }

  // ── Tiempo hasta medianoche (para countdown de quests) ──────
  function _hoursUntilMidnight() {
    var now = new Date();
    var midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    var ms = midnight - now;
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  // ── Utils ──────────────────────────────────────────────────
  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _pct(cur, max) { return max ? Math.min(100, Math.round((cur / max) * 100)) : 0; }

  // ── Sonido (Web Audio API, sin ficheros externos) ──────────
  var _audioCtx = null;
  function _getAudio() {
    if (_audioCtx) return _audioCtx;
    try { _audioCtx = new (w.AudioContext || w.webkitAudioContext)(); } catch(_) {}
    return _audioCtx;
  }

  function _playXpPing() {
    try {
      var ctx = _getAudio(); if (!ctx) return;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch(_) {}
  }

  function _playLevelUp() {
    try {
      var ctx = _getAudio(); if (!ctx) return;
      [523, 659, 784, 1047].forEach(function(freq, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle';
        var t = ctx.currentTime + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t); osc.stop(t + 0.28);
      });
    } catch(_) {}
  }

  function _playUnlock() {
    try {
      var ctx = _getAudio(); if (!ctx) return;
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.13, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.42);
    } catch(_) {}
  }

  // ── Toasts ──────────────────────────────────────────────────
  var _toastQ = [], _toastBusy = false;

  function _nextToast() {
    if (_toastBusy || !_toastQ.length) return;
    _toastBusy = true;
    var item = _toastQ.shift();
    var el   = document.createElement('div');
    el.className = 'gx-toast gx-toast--' + (item.type || 'xp');
    el.setAttribute('role', 'status');
    el.innerHTML  = item.html;
    document.body.appendChild(el);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('gx-toast--in'); }); });
    setTimeout(function () {
      el.classList.replace('gx-toast--in','gx-toast--out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); _toastBusy = false; _nextToast(); }, 350);
    }, item.dur || 3000);
  }

  function _toast(html, type, dur) { _toastQ.push({ html: html, type: type||'xp', dur: dur||3000 }); _nextToast(); }

  function showXpToast(gained, reason) {
    if (!gained || gained <= 0) return;
    var labels = { match: _gt('toast-match'), penalties: _gt('toast-pen'), tournament: _gt('toast-trn'), activity: _gt('toast-act') };
    var label  = labels[reason] || '';
    _toast('<span class="gx-toast-xp">+' + gained + ' XP</span>' + (label ? '<span class="gx-toast-reason"> · ' + _esc(label) + '</span>' : ''), 'xp', 2400);
    _playXpPing();
  }

  function showLevelUpToast(lv) {
    _toast('<span class="gx-toast-star">⭐</span><strong>' + _gt('nivel') + lv + '!</strong>', 'levelup', 4200);
    _playLevelUp();
  }

  function showAchievementToast(a) {
    _toast('<span class="gx-toast-ach-icon">' + _esc(a.icon) + '</span><div class="gx-toast-ach-body"><span class="gx-toast-ach-pre">' + _gt('unlock-ach') + '</span><span class="gx-toast-ach-title">' + _esc(a.title) + '</span></div>', 'achievement', 4200);
    setTimeout(_playXpPing, 300);
  }

  function showUnlockToast(u) {
    _toast('<span class="gx-toast-unlock-icon">🔓</span><div class="gx-toast-ach-body"><span class="gx-toast-ach-pre">' + _gt('unlock-team') + '</span><span class="gx-toast-ach-title">' + _esc(u.label + ' · ' + u.era) + '</span></div>', 'unlock', 4500);
    setTimeout(_playUnlock, 100);
  }

  function showQuestToast(q) {
    _toast('<span class="gx-toast-ach-icon">' + _esc(q.icon) + '</span><div class="gx-toast-ach-body"><span class="gx-toast-ach-pre">' + _gt('quest-done') + '</span><span class="gx-toast-ach-title">' + _esc(q.title) + '</span></div>', 'quest', 4000);
    setTimeout(_playXpPing, 200);
  }

  // ── Callback central ────────────────────────────────────────
  function _confetti() {
    var wrap = document.createElement('div');
    wrap.className = 'gx-confetti-wrap';
    document.body.appendChild(wrap);
    var colors = ['#00d4ff','#7b2ff7','#ffd166','#06d6a0','#ef476f','#f72585'];
    for (var i = 0; i < 52; i++) {
      var p = document.createElement('div');
      p.className = 'gx-conf-piece';
      p.style.cssText = 'left:' + (4+Math.random()*92) + '%;background:' + colors[i%colors.length]
        + ';animation-delay:' + (Math.random()*.55) + 's;animation-duration:' + (.9+Math.random()*.75) + 's'
        + ';width:' + (5+Math.round(Math.random()*7)) + 'px;height:' + (5+Math.round(Math.random()*7)) + 'px'
        + ';border-radius:' + (i%3===0?'50%':'2px') + ';transform:rotate(' + Math.round(Math.random()*360) + 'deg)';
      wrap.appendChild(p);
    }
    setTimeout(function(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 3200);
  }

  function onXpGained(result) {
    if (!result) return;
    if (result.gained > 0) showXpToast(result.gained, result._reason);
    (result.crossedLevels || (result.leveled ? [result.newLevel] : [])).forEach(function(lv, i) {
      setTimeout(function(){ showLevelUpToast(lv); }, 600 + i * 700);
    });
    (result.newAchs    || []).forEach(function(a, i){ setTimeout(function(){ showAchievementToast(a); }, 800 + i*500); });
    (result.newUnlocks || []).forEach(function(u, i){ setTimeout(function(){ showUnlockToast(u); }, 1200 + i*500); });
    (result.questBonuses || []).forEach(function(q, i){ setTimeout(function(){ showQuestToast(q); }, 400 + i*450); });
    if (result.questDayComplete) {
      setTimeout(function(){
        _confetti();
        _toast('🎉 <strong>¡3/3 MISIONES!</strong><span class="gx-toast-reason"> +50 XP bonus</span>', 'achievement', 5500);
        _playLevelUp();
      }, 1400);
    }
    if (result.underdogBonus) {
      setTimeout(function(){ _toast(_gt('underdog-toast'), 'unlock', 3500); _playUnlock(); }, 200);
    }
    _updateXpBar();
    // Auto-sync al ranking global (debounce 3s para no spamear)
    if (result.gained > 0) {
      if (_gxSyncTimer) clearTimeout(_gxSyncTimer);
      _gxSyncTimer = setTimeout(function() { _gxSyncScore(); }, 3000);
    }
  }

  // ── Barra XP en header (5 SEGMENTOS) ────────────────────────
  var _xpBarWrap = null;

  function _buildSegments(pct) {
    var segs = '';
    for (var i = 0; i < 5; i++) {
      var filled = Math.max(0, Math.min(100, pct - i * 20)) / 20;
      segs += '<div class="gx-xp-seg' + (filled >= 1 ? ' gx-xp-seg-full' : filled > 0 ? ' gx-xp-seg-part' : '') + '">'
            + (filled > 0 && filled < 1 ? '<div class="gx-xp-seg-fill" style="width:' + Math.round(filled * 100) + '%"></div>' : '')
            + '</div>';
    }
    return segs;
  }

  function _injectXpBar() {
    var hr = document.querySelector('.header-right');
    if (!hr || document.getElementById('gx-xp-bar')) return;
    var wrap = document.createElement('div');
    wrap.id  = 'gx-xp-bar';
    wrap.className = 'gx-xp-wrap';
    wrap.setAttribute('role','button'), wrap.setAttribute('tabindex','0');
    wrap.setAttribute('title','Tu progreso · Tab Perfil');
    document.getElementById('lang-toggle') ? hr.insertBefore(wrap, document.getElementById('lang-toggle')) : hr.appendChild(wrap);
    _xpBarWrap = wrap;
    wrap.addEventListener('click', function(){ _openProfileTab(); });
    wrap.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' ') _openProfileTab(); });
    _updateXpBar();
  }

  function _updateXpBar() {
    var bar = _xpBarWrap || document.getElementById('gx-xp-bar');
    if (!bar || !w.gxUser) return;
    var u    = gxUser.get();
    var lv   = u.level, xp = u.xp;
    var base = gxUser.xpForLevel(lv);
    var next = gxUser.nextLevelXP(lv);
    var pct  = next != null ? _pct(xp - base, next - base) : 100;
    // Pulso de urgencia si queda ≤50 XP para subir de nivel
    var nearLvl = next != null && (next - xp) <= 50;
    bar.classList.toggle('gx-xp-wrap--pulse', nearLvl);
    bar.innerHTML =
      '<span class="gx-xp-level" id="gx-xp-level">Lv.' + lv + '</span>' +
      '<div class="gx-xp-segs" id="gx-xp-segs">' + _buildSegments(pct) + '</div>' +
      '<span class="gx-xp-pct" id="gx-xp-pct">' + (next != null ? (xp-base)+'/'+(next-base)+' XP' : xp+' XP ★') + '</span>';
    // Pop animation
    var lel = bar.querySelector('.gx-xp-level');
    if (lel) { lel.classList.remove('gx-xp-pop'); void lel.offsetWidth; lel.classList.add('gx-xp-pop'); }
  }

  // ── Tab Perfil ───────────────────────────────────────────────
  function _openProfileTab() {
    if (typeof TRN !== 'undefined' && TRN.switchMainTab) TRN.switchMainTab('profile');
  }

  // ── i18n strings nuevas para ranking ──────────────────────
  _GX_STR['rank-title']        = { es: '🌍 Muro de la Fama',       en: '🌍 Hall of Fame'                };
  _GX_STR['rank-week']         = { es: 'Semana actual',             en: 'Current week'                   };
  _GX_STR['rank-sync']         = { es: '🔄 Sincronizar',            en: '🔄 Sync score'                  };
  _GX_STR['rank-syncing']      = { es: '⏳ Enviando…',              en: '⏳ Uploading…'                  };
  _GX_STR['rank-synced']       = { es: '✔ ¡Top ',                  en: '✔ Top '                         };
  _GX_STR['rank-pb']           = { es: '📈 ¡Nuevo récord!',         en: '📈 New personal best!'          };
  _GX_STR['rank-loading']      = { es: 'Cargando ranking…',         en: 'Loading ranking…'               };
  _GX_STR['rank-empty']        = { es: 'Sé el primero esta semana', en: 'Be the first this week'         };
  _GX_STR['fav-team-lbl']      = { es: '⭐ Equipo favorito',        en: '⭐ Favourite team'              };
  _GX_STR['fav-team-ph']       = { es: 'Escribe un equipo…',        en: 'Search a team…'                 };
  _GX_STR['fav-team-set']      = { es: '✔ Guardado',               en: '✔ Saved'                        };
  _GX_STR['country-lbl']       = { es: '🌍 Tu país',               en: '🌍 Your country'                };
  _GX_STR['top3-toast']        = { es: '🏅 ¡TOP 3 SEMANAL! ¡Eres una leyenda!', en: '🏅 WEEKLY TOP 3! You are a legend!' };

  // ── Syncing & global leaderboard ─────────────────────────
  var _gxLastSyncScore = null; // Último score sincronizado (evita duplicar llamadas)
  var _gxSyncTimer     = null; // Debounce timer para auto-sync

  function _gxSyncScore() {
    if (!w.gxUser) return;
    var ds    = gxUser.getDailyStats();
    var score = gxUser.dailyScore(ds);
    var u     = gxUser.get();
    var weekKey = gxUser.gxWeekKey();
    var hash    = gxUser.gxHash(u.name, score, u.level, weekKey);
    var btn     = document.getElementById('gx-sync-btn');
    if (btn) { btn.disabled = true; btn.textContent = _gt('rank-syncing'); }

    fetch('/gx/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: u.name, score: score, level: u.level, country: u.country || '', flag: u.flag || '', hash: hash }),
    })
    .then(function(r){ return r.json(); })
    .then(function(data) {
      _gxLastSyncScore = score;
      if (btn) { btn.disabled = false; btn.textContent = _gt('rank-sync'); }
      if (data.ok) {
        var isTop3 = data.rank <= 3;
        var wasPb  = !_gxLastSyncScore || score > (_gxLastSyncScore || 0);
        _toast(_gt('rank-synced') + data.rank + '!</span>', 'unlock', 3500);
        if (isTop3) {
          setTimeout(function(){
            _confetti();
            _toast(_gt('top3-toast'), 'achievement', 5000);
            _playLevelUp();
          }, 600);
          var newAchs = gxUser.addWeeklyBadge(data.week, data.rank);
          newAchs.forEach(function(a, i){ setTimeout(function(){ showAchievementToast(a); }, 1200 + i*500); });
        }
        // Recargar tabla global
        _gxLoadLeaderboard();
      }
    })
    .catch(function() {
      if (btn) { btn.disabled = false; btn.textContent = _gt('rank-sync'); }
    });
  }

  function _gxLoadLeaderboard() {
    var el = document.getElementById('gx-global-lb-body');
    if (!el) return;
    el.innerHTML = '<div class="gx-lb-loading">' + _gt('rank-loading') + '</div>';
    fetch('/gx/leaderboard')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var u = gxUser.get();
      if (!data.entries || data.entries.length === 0) {
        el.innerHTML = '<div class="gx-lb-empty">' + _gt('rank-empty') + '</div>';
        return;
      }
      var medals = ['🥇','🥈','🥉'];
      el.innerHTML = data.entries.slice(0, 10).map(function(e, i) {
        var isMe = e.name === u.name;
        var medal = i < 3 ? medals[i] : (i+1);
        return '<div class="gx-lb-row' + (isMe ? ' gx-lb-row--me' : '') + '">' +
          '<span class="gx-lb-pos">' + medal + '</span>' +
          '<span class="gx-lb-flag">' + _esc(e.flag || '') + '</span>' +
          '<span class="gx-lb-name">' + _esc(e.name) + '</span>' +
          '<span class="gx-lb-lv">Lv.' + _esc(String(e.level)) + '</span>' +
          '<span class="gx-lb-score">' + Number(e.score).toLocaleString() + '</span>' +
        '</div>';
      }).join('');
    })
    .catch(function() {
      if (el) el.innerHTML = '<div class="gx-lb-empty">—</div>';
    });
  }

  // ── Detección de país (una sola vez, guarda en perfil) ─────
  function _gxDetectCountry() {
    var u = gxUser.get();
    if (u.country) return; // ya se conoce
    fetch('/gx/country')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.country && d.country.length === 2) {
        // Generar emoji bandera desde código ISO
        var flag = String.fromCodePoint(
          d.country.charCodeAt(0) - 65 + 0x1F1E6,
          d.country.charCodeAt(1) - 65 + 0x1F1E6
        );
        gxUser.setCountry(d.country, flag);
        // Actualizar display si el perfil está abierto
        var cEl = document.getElementById('gx-country-display');
        if (cEl) cEl.textContent = flag + ' ' + d.country;
      }
    })
    .catch(function(){});
  }

  // ── Country/FavTeam en panel ─────────────────────────────────
  function _buildIdentityPanel() {
    var u = w.gxUser ? gxUser.get() : null;
    if (!u) return '';
    var favBadge = u.favoriteTeam
      ? '<img class="gx-fav-badge" src="/img/badges/' + _esc(u.favoriteTeam) + '.svg" onerror="this.src=\'/img/badges/_placeholder.svg\'" alt="" />'
      : '';
    var flagDisp = u.flag ? u.flag + ' ' + u.country : '—';
    return '<div class="gx-identity-panel">' +
      '<div class="gx-identity-row">' +
        '<span class="gx-identity-lbl">' + _gt('country-lbl') + '</span>' +
        '<span class="gx-identity-val" id="gx-country-display">' + _esc(flagDisp) + '</span>' +
      '</div>' +
      '<div class="gx-identity-row">' +
        '<span class="gx-identity-lbl">' + _gt('fav-team-lbl') + '</span>' +
        '<div class="gx-fav-team-row">' +
          favBadge +
          '<input id="gx-fav-input" class="gx-fav-input" type="text" placeholder="' + _gt('fav-team-ph') + '" value="' + _esc(u.favoriteTeam || '') + '" maxlength="60" autocomplete="off" />' +
          '<button class="gx-btn gx-btn-xs" id="gx-fav-save-btn">' + _gt('fav-team-set') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Hook wiring fav team input + autocomplete ────────────────
  function _wireFavTeam() {
    var btn = document.getElementById('gx-fav-save-btn');
    var inp = document.getElementById('gx-fav-input');
    if (!btn || !inp) return;
    btn.addEventListener('click', function(){
      var val = inp.value.trim().toLowerCase().replace(/\s+/g,'-');
      gxUser.setFavoriteTeam(val || null);
      _toast(_gt('fav-team-set') + (val ? ' · ' + val : ''), 'unlock', 2000);
    });
  }

  // ── Clasificación Diaria ──────────────────────────────
  function _buildDailyLeaderboard() {
    if (!w.gxUser) return '';
    var ds    = gxUser.getDailyStats();
    var score = gxUser.dailyScore(ds);
    var u     = gxUser.get();
    var emojis = ['🌱','⚡','🔥','🌟','💫','🏅','🥈','🥇','🏆','📎','👑','⭐'];
    var avatar = emojis[Math.min((u.level||1)-1, emojis.length-1)];

    // Etiqueta de fecha legible
    var now  = new Date();
    var days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    var mons = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    var dateLabel = days[now.getDay()] + ' ' + now.getDate() + ' ' + mons[now.getMonth()];

    // Barra de puntuación (relativa a 5000 pts como "buen día")
    var barPct = Math.min(100, Math.round(score / 50));  // 5000 pts = 100%

    return '<div class="gx-daily-board">' +
      '<div class="gx-daily-header">' +
        '<span class="gx-daily-title">' + _gt('daily-title') + '</span>' +
        '<span class="gx-daily-date">' + _esc(dateLabel) + '</span>' +
      '</div>' +
      '<div class="gx-daily-player-row">' +
        '<span class="gx-daily-player-avatar">' + avatar + '</span>' +
        '<div class="gx-daily-player-meta">' +
          '<span class="gx-daily-player-name" id="gx-daily-player-name">' + _esc(u.name) + '</span>' +
          '<span class="gx-daily-rank-chip">' + _esc(gxUser.getLevelTitle(u.level)) + (u.flag ? ' ' + u.flag : '') + '</span>' +
        '</div>' +
        '<button class="gx-daily-name-edit-btn" id="gx-daily-name-edit" title="Cambiar nombre">✏️</button>' +
      '</div>' +

      '<div class="gx-daily-score-wrap">' +
        '<div class="gx-daily-score-big">' + score.toLocaleString() + '</div>' +
        '<div class="gx-daily-score-label">' + _gt('pts-today') + '</div>' +
        '<div class="gx-daily-score-bar"><div class="gx-daily-score-fill" style="width:' + barPct + '%"></div></div>' +
      '</div>' +

      '<div class="gx-daily-row-grid">' +
        '<div class="gx-daily-cell"><span class="gx-daily-cell-val">' + ds.xpEarned + '</span><span class="gx-daily-cell-lbl">' + _gt('xp-earned') + '</span></div>' +
        '<div class="gx-daily-cell"><span class="gx-daily-cell-val">' + ds.matches + '</span><span class="gx-daily-cell-lbl">' + _gt('cell-matches') + '</span></div>' +
        '<div class="gx-daily-cell"><span class="gx-daily-cell-val">' + ds.goals + '</span><span class="gx-daily-cell-lbl">' + _gt('cell-goals') + '</span></div>' +
        '<div class="gx-daily-cell"><span class="gx-daily-cell-val">' + ds.quests + '/3</span><span class="gx-daily-cell-lbl">' + _gt('cell-quests') + '</span></div>' +
      '</div>' +

      '<div class="gx-daily-actions">' +
        '<button class="gx-btn gx-btn-primary" id="gx-share-daily-btn">' + _gt('share-daily') + '</button>' +
      '</div>' +

      // Muro de la Fama global
      '<div class="gx-global-lb">' +
        '<div class="gx-global-lb-header">' +
          '<span class="gx-global-lb-title">' + _gt('rank-title') + '</span>' +
          '<span class="gx-global-lb-week">' + _gt('rank-week') + ' · ' + _esc(gxUser.gxWeekKey()) + '</span>' +
        '</div>' +
        '<div id="gx-global-lb-body" class="gx-global-lb-body">' +
          '<div class="gx-lb-loading">' + _gt('rank-loading') + '</div>' +
        '</div>' +
      '</div>' +

      '</div>';
  }

  function _wireDailyShare() {
    var btn = document.getElementById('gx-share-daily-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var ds    = gxUser.getDailyStats();
      var score = gxUser.dailyScore(ds);
      var now   = new Date();
      var days  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      var mons  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      var dateLabel = days[now.getDay()] + ' ' + now.getDate() + ' ' + mons[now.getMonth()];
      var _ql = ['⬜','⬜','⬜']; for (var _qi=0;_qi<ds.quests;_qi++) _ql[_qi]='✅';
      var _slvl = score<300?1:score<800?2:score<2000?3:score<4000?4:5;
      var _sballs=''; for(var _sbi=0;_sbi<_slvl;_sbi++) _sballs+='⚽';
      var _rank = gxUser.getLevelTitle(gxUser.get().level);
      var text  = '⚽ GolazoX · ' + dateLabel + '\n'
        + _sballs + ' ' + score.toLocaleString() + ' pts\n'
        + _ql.join('') + ' Misiones: ' + ds.quests + '/3\n'
        + '🏆 ' + _rank + '\n'
        + '⚽ ' + ds.matches + ' partidos · 🎯 ' + ds.goals + ' goles\n'
        + '🔗 golazox.com';
      if (navigator.share) {
        navigator.share({ text: text }).catch(function(){});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = '✔ ¡Copiado!';
          setTimeout(function(){ btn.textContent = '📤 Compartir puntuación'; }, 2500);
        }).catch(function(){});
      }
    });
    // Wiring sync button
    var syncBtn = document.getElementById('gx-sync-btn');
    if (syncBtn) syncBtn.addEventListener('click', _gxSyncScore);
    // Load leaderboard on open
    _gxLoadLeaderboard();
    // Detect country silently if unknown
    _gxDetectCountry();
  }

  // ── Daily Quests panel (original) ────────────────────────────────

  function _wireDailyNameEdit() {
    var btn  = document.getElementById('gx-daily-name-edit');
    var disp = document.getElementById('gx-daily-player-name');
    if (!btn || !disp) return;
    btn.addEventListener('click', function() { _inlineNameEdit(disp, btn); });
  }

  function _wireCardName() {
    var btn  = document.getElementById('gx-card-name-edit');
    var disp = document.getElementById('gx-card-name-val');
    if (!btn || !disp) return;
    btn.addEventListener('click', function() {
      var cur = disp.textContent;
      var inp = document.createElement('input');
      inp.type = 'text'; inp.value = cur; inp.maxLength = 24; inp.className = 'gx-prof-name-input';
      disp.replaceWith(inp); inp.focus();
      btn.innerHTML = '✔ OK'; btn.style.minWidth = '52px';
      function _done() {
        var nm = inp.value.trim().slice(0, 24) || cur;
        _saveName(nm);
        var sp = document.createElement('span');
        sp.id = 'gx-card-name-val'; sp.className = 'gx-card-name-val'; sp.textContent = nm;
        inp.replaceWith(sp);
        btn.innerHTML = '✏️ Cambiar'; btn.style.minWidth = '';
        _toast('✔ Nombre actualizado: <strong>' + _esc(nm) + '</strong>', 'unlock', 2500);
      }
      btn.addEventListener('click', _done, { once: true });
      inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); _done(); } });
    });
  }

  var _TAB_LABEL = { match: '⚽ Partido', pen: '🥅 Penaltis', trn: '🏆 Torneo' };

  function _buildQuestsHtml() {
    if (!w.gxUser) return '';
    var u      = gxUser.get();
    var quests = gxUser.getDailyQuests();
    var today  = new Date().toISOString().slice(0,10);
    var done   = (u.dailyQuests && u.dailyQuests.date === today) ? (u.dailyQuests.completed || []) : [];
    var rows   = quests.map(function(q) {
      var isDone = done.includes(q.id);
      var tab    = q.tab || 'match';
      var goLabel = _TAB_LABEL[tab] || '⚽ Partido';
      return '<button class="gx-quest-row' + (isDone ? ' gx-quest-done' : '') + '" data-quest-tab="' + tab + '">' +
        '<span class="gx-quest-icon">' + _esc(q.icon) + '</span>' +
        '<div class="gx-quest-body">' +
          '<span class="gx-quest-title">' + _esc(q.title) + '</span>' +
          '<span class="gx-quest-desc">' + _esc(q.desc) + '</span>' +
        '</div>' +
        '<span class="gx-quest-badge">' + (isDone ? '✔' : '+20 XP') + '</span>' +
        (isDone ? '' : '<span class="gx-quest-go">' + goLabel + ' →</span>') +
        '</button>';
    }).join('');
    var doneCount = done.filter(function(id){ return quests.some(function(q){ return q.id === id; }); }).length;
    return '<div class="gx-quests-block">' +
      '<div class="gx-quests-header">' +
        '<span class="gx-qs-title">' + _gt('quest-title') + ' <span class="gx-qs-badge">' + doneCount + '/3</span></span>' +
        '<span class="gx-qs-reset">' + _gt('quest-reset') + ' · ' + _hoursUntilMidnight() + '</span>' +
      '</div>' +
      rows +
      '</div>';
  }

  function _wireQuests(wrap) {
    var container = wrap || document.getElementById('main-profile-wrap');
    if (!container) return;
    container.querySelectorAll('.gx-quest-row[data-quest-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tab = btn.getAttribute('data-quest-tab') || 'match';
        if (typeof TRN !== 'undefined' && typeof TRN.switchMainTab === 'function') {
          TRN.switchMainTab(tab);
        }
      });
    });
  }

  // ── Museo de Leyendas (estilo álbum Panini) ─────────────────
  function _buildMuseumHtml() {
    if (!w.gxUser) return '';
    var u           = gxUser.get();
    var LOCKED_TEAMS   = gxUser.LOCKED_TEAMS;
    var COLLECTIONS    = gxUser.COLLECTIONS;
    var flashSlug      = gxUser.getFlashTeam();

    var html = '<div class="gx-museum">';
    html += '<div class="gx-museum-header">' +
      '<span class="gx-museum-title">' + _gt('museum-title') + '</span>' +
      '<span class="gx-museum-sub">' + _gt('museum-sub') + '</span>' +
      '</div>';

    if (flashSlug) {
      var fi = LOCKED_TEAMS[flashSlug];
      html += '<div class="gx-flash-banner">' +
        '<span class="gx-flash-icon">⚡ FLASH</span>' +
        '<span class="gx-flash-text"><strong>' + _esc(fi.label + ' ' + fi.era) + '</strong> — Disponible este fin de semana para todos</span>' +
        '<span class="gx-flash-timer">' + _gt('flash-only') + '</span>' +
        '</div>';
    }

    Object.keys(COLLECTIONS).forEach(function(colKey) {
      var col   = COLLECTIONS[colKey];
      var total = col.slugs.length;
      var owned = col.slugs.filter(function(s){ return u.unlockedTeams.includes(s) || gxUser.isFlash(s); }).length;
      var pct   = _pct(owned, total);

      html += '<div class="gx-col-section">';
      html += '<div class="gx-col-header">' +
        '<span class="gx-col-icon">' + col.icon + '</span>' +
        '<div class="gx-col-meta">' +
          '<span class="gx-col-name">' + _esc(col.label) + '</span>' +
          '<span class="gx-col-desc">' + _esc(col.desc) + '</span>' +
        '</div>' +
        '<span class="gx-col-progress">' + owned + '/' + total + '</span>' +
        '</div>';

      // Progress bar de la colección
      var nearComplete = (owned === total - 1);
      html += '<div class="gx-col-bar"><div class="gx-col-fill' + (nearComplete ? ' gx-col-fill--near' : '') + '" style="width:' + pct + '%"></div></div>';

      // Álbum de cromos
      html += '<div class="gx-album-grid">';
      col.slugs.forEach(function(slug) {
        var info    = LOCKED_TEAMS[slug];
        var isOwned = u.unlockedTeams.includes(slug);
        var isFlash = gxUser.isFlash(slug);
        var isAvail = isOwned || isFlash;
        var isNear  = !isAvail && (u.xp + 60 >= info.xp);
        var needLv  = isAvail ? 0 : (w.gxUser ? gxUser.levelForXp(info.xp) : 0);
        html += '<div class="gx-sticker' + (isAvail ? ' gx-sticker-owned' : ' gx-sticker-locked') + (isFlash ? ' gx-sticker-flash' : '') + (isNear && !isAvail ? ' gx-sticker-near' : '') + '">' +
          (isFlash ? '<span class="gx-sticker-flash-tag">⚡</span>' : '') +
          '<div class="gx-sticker-emblem">' +
            '<img class="gx-sticker-badge' + (isAvail ? '' : ' gx-sticker-badge--locked') + '" src="/img/badges/' + _esc(slug) + '.png" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'/img/badges/_placeholder.svg\'">' +
            (!isAvail ? '<span class="gx-sticker-lock-ov">🔒</span>' : '') +
          '</div>' +
          '<div class="gx-sticker-year' + (isAvail ? '' : ' gx-sticker-year--locked') + '">' + _esc(info.era) + '</div>' +
          '<div class="gx-sticker-name">' + _esc(info.label) + '</div>' +
          (!isAvail ? '<div class="gx-sticker-tip">' + (needLv ? 'Lv.' + needLv + ' · ' : '') + info.xp + ' XP' + (isNear ? ' · ¡Casi!' : '') + '</div>' : '') +
          '</div>';
      });
      html += '</div></div>';
    });

    html += '</div>';
    return html;
  }

  // ── Player ID Card (Canvas) ─────────────────────────────────
  function _drawPlayerCard() {
    if (!w.gxUser) return;
    var u   = gxUser.get();
    var lv  = u.level, xp  = u.xp;

    var LEVELS = gxUser.LEVELS;
    var W = 540, H = 300;
    var canvas = document.getElementById('gx-player-card-canvas');
    if (!canvas) return;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    // Fondo — Lv12 = Galaxia; resto = oscuro + grid
    if (lv >= 12) {
      var bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0,    '#08001c');
      bg.addColorStop(0.45, '#0d0030');
      bg.addColorStop(0.75, '#100025');
      bg.addColorStop(1,    '#050010');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // Nebulosa violeta
      var neb1 = ctx.createRadialGradient(W*.68, H*.38, 8, W*.68, H*.38, 180);
      neb1.addColorStop(0,  'rgba(120,0,220,0.20)');
      neb1.addColorStop(0.6,'rgba(80,0,150,0.08)');
      neb1.addColorStop(1,  'rgba(0,0,0,0)');
      ctx.fillStyle = neb1; ctx.fillRect(0, 0, W, H);
      // Nebulosa dorada
      var neb2 = ctx.createRadialGradient(W*.25, H*.7, 4, W*.25, H*.7, 120);
      neb2.addColorStop(0,  'rgba(255,140,0,0.10)');
      neb2.addColorStop(1,  'rgba(0,0,0,0)');
      ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);
      // Estrellas (deterministas por user id)
      var _sid = 0;
      for (var _ci = 0; _ci < u.id.length; _ci++) _sid += u.id.charCodeAt(_ci);
      var _sr = function() { _sid = (_sid * 16807 + 7) % 2147483647; return (_sid-1)/2147483646; };
      ctx.fillStyle = '#ffffff';
      for (var _si = 0; _si < 90; _si++) {
        ctx.globalAlpha = _sr()*0.65+0.35;
        ctx.beginPath(); ctx.arc(_sr()*W, _sr()*H, _sr()*1.7+0.3, 0, Math.PI*2); ctx.fill();
      }
      // Partículas doradas
      var _gc = ['rgba(255,215,0,','rgba(255,175,0,','rgba(255,240,130,'];
      for (var _gi = 0; _gi < 22; _gi++) {
        ctx.globalAlpha = _sr()*0.55+0.25;
        ctx.fillStyle = _gc[_gi%3] + '1)';
        ctx.beginPath(); ctx.arc(_sr()*W, _sr()*H, _sr()*1.5+0.7, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      var bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0,   '#04080f');
      bg.addColorStop(0.5, '#0a1428');
      bg.addColorStop(1,   '#050c18');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // Grid pattern sutil
      ctx.strokeStyle = 'rgba(0,212,255,0.04)';
      ctx.lineWidth = 1;
      for (var gxg = 0; gxg < W; gxg += 28) { ctx.beginPath(); ctx.moveTo(gxg,0); ctx.lineTo(gxg,H); ctx.stroke(); }
      for (var gyg = 0; gyg < H; gyg += 28) { ctx.beginPath(); ctx.moveTo(0,gyg); ctx.lineTo(W,gyg); ctx.stroke(); }
    }

    // ── Marco de prestigio según nivel ──────────────────────────
    if (lv >= 12) {
      // INMORTAL: Marco triple dorado-blanco-dorado
      var brd = ctx.createLinearGradient(0, 0, W, H);
      brd.addColorStop(0,   '#ffffff');
      brd.addColorStop(0.2, '#ffd700');
      brd.addColorStop(0.5, '#fff5a0');
      brd.addColorStop(0.8, '#ffd700');
      brd.addColorStop(1,   '#ffffff');
      ctx.strokeStyle = brd; ctx.lineWidth = 5;
      _roundRect(ctx, 2, 2, W-4, H-4, 14); ctx.stroke();
      // Capa interior dorada
      ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = 1;
      _roundRect(ctx, 9, 9, W-18, H-18, 10); ctx.stroke();
      // Resplandor exterior triple
      ctx.strokeStyle = 'rgba(255,215,0,0.35)'; ctx.lineWidth = 10;
      _roundRect(ctx, 0, 0, W, H, 16); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 18;
      _roundRect(ctx, 0, 0, W, H, 16); ctx.stroke();
    } else if (lv >= 11) {
      // Nivel 11: Marco dorado con degradado de fuego
      var brd = ctx.createLinearGradient(0, 0, W, H);
      brd.addColorStop(0,    '#ffd700');
      brd.addColorStop(0.25, '#ff8c00');
      brd.addColorStop(0.5,  '#ffd700');
      brd.addColorStop(0.75, '#ff4500');
      brd.addColorStop(1,    '#ffd700');
      ctx.strokeStyle = brd;
      ctx.lineWidth = 4;
      _roundRect(ctx, 3, 3, W-6, H-6, 14);
      ctx.stroke();
      // Resplandor dorado exterior
      ctx.strokeStyle = 'rgba(255,200,0,0.2)';
      ctx.lineWidth = 8;
      _roundRect(ctx, 0, 0, W, H, 16);
      ctx.stroke();
    } else if (lv >= 6) {
      // Nivel 6-10: Marco plateado con bolones decorativos
      var brd = ctx.createLinearGradient(0, 0, W, H);
      brd.addColorStop(0,   'rgba(210,218,228,0.9)');
      brd.addColorStop(0.5, 'rgba(160,175,192,0.7)');
      brd.addColorStop(1,   'rgba(210,218,228,0.9)');
      ctx.strokeStyle = brd;
      ctx.lineWidth = 3;
      _roundRect(ctx, 4, 4, W-8, H-8, 14);
      ctx.stroke();
      // Círculos de balón a lo largo del borde superior e inferior
      ctx.strokeStyle = 'rgba(200,215,230,0.28)';
      ctx.lineWidth = 1;
      for (var bi = 22; bi < W-22; bi += 26) {
        ctx.beginPath(); ctx.arc(bi, 13, 5, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(bi, H-13, 5, 0, Math.PI*2); ctx.stroke();
      }
    } else {
      // Nivel 1-5: Borde neón cian/violeta (diseño original)
      var brd = ctx.createLinearGradient(0, 0, W, H);
      brd.addColorStop(0,   'rgba(0,212,255,0.8)');
      brd.addColorStop(0.5, 'rgba(123,47,247,0.6)');
      brd.addColorStop(1,   'rgba(0,212,255,0.8)');
      ctx.strokeStyle = brd;
      ctx.lineWidth = 2;
      _roundRect(ctx, 4, 4, W-8, H-8, 14);
      ctx.stroke();
    }

    // Emoji nivel (grande)
    var emojis = ['🌱','⚡','🔥','🌟','💫','🏅','🥈','🥇','🏆','💎','👑','⭐'];
    ctx.font = '72px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emojis[Math.min(lv-1, emojis.length-1)], 78, 140);

    // Halo detrás del emoji
    var halo = ctx.createRadialGradient(78, 110, 10, 78, 110, 62);
    if (lv >= 12) {
      halo.addColorStop(0, 'rgba(255,215,0,0.30)');
      halo.addColorStop(1, 'rgba(255,215,0,0)');
    } else {
      halo.addColorStop(0, 'rgba(0,212,255,0.18)');
      halo.addColorStop(1, 'rgba(0,212,255,0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(78, 110, 62, 0, Math.PI*2); ctx.fill();

    // Nombre
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f0f4ff';
    ctx.font      = 'bold 26px "Rajdhani", system-ui, sans-serif';
    ctx.fillText(u.name, 148, 90);

    // Nivel badge
    var base  = gxUser.xpForLevel(lv);
    var next  = gxUser.nextLevelXP(lv);
    var lvTag = 'NIVEL ' + lv + (next ? '  ·  ' + (xp - base) + '/' + (next - base) + ' XP' : '  ·  MAX');
    ctx.font      = 'bold 13px system-ui';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(lvTag, 148, 115);

    // Línea separadora
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(148, 126); ctx.lineTo(W-24, 126); ctx.stroke();

    // Stats en 3 columnas
    var stats = [
      { label: 'Partidos', val: u.stats.matchesPlayed },
      { label: 'Goles', val: u.stats.totalGoals },
      { label: 'Torneos', val: u.stats.tournamentsCompleted },
    ];
    stats.forEach(function(s, i) {
      var sx = 148 + i * 124;
      ctx.font = 'bold 28px "Rajdhani", system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(s.val), sx, 170);
      ctx.font = '11px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(s.label.toUpperCase(), sx, 188);
    });

    // Barra XP visual (5 segmentos)
    var barX = 148, barY = 208, barW = 364, barH = 8;
    var pct  = next ? _pct(xp - base, next - base) : 100;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    _roundRect(ctx, barX, barY, barW, barH, 4); ctx.fill();
    var fill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fill.addColorStop(0, '#00d4ff'); fill.addColorStop(1, '#7b2ff7');
    ctx.fillStyle = fill;
    _roundRect(ctx, barX, barY, Math.max(4, barW * pct / 100), barH, 4); ctx.fill();

    // Logros (primeros 8)
    var earned = w.gxUser ? gxUser.ACHIEVEMENTS : {};
    var achKeys = Object.keys(earned).filter(function(id){ return u.achievements.includes(id); }).slice(0, 8);
    ctx.font = '16px serif';
    achKeys.forEach(function(id, i) { ctx.fillText(earned[id].icon, 148 + i * 26, 245); });
    if (u.achievements.length === 0) {
      ctx.font = '11px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('Aún sin logros', 148, 245);
    }

    // Golazox watermark
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = 'rgba(0,212,255,0.4)';
    if (lv >= 12)      ctx.fillStyle = 'rgba(255,235,100,0.75)';
    else if (lv >= 11) ctx.fillStyle = 'rgba(255,195,0,0.55)';
    else if (lv >= 6)  ctx.fillStyle = 'rgba(200,215,230,0.45)';
    ctx.textAlign = 'right';
    ctx.fillText('golazox.com', W-20, H-14);

    // Etiqueta de marco de prestigio (Lv6+)
    if (lv >= 12) {
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = 'rgba(255,235,100,0.85)';
      ctx.textAlign = 'left';
      ctx.fillText('⭐ INMORTAL', 20, H-14);
    } else if (lv >= 11) {
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = 'rgba(255,195,0,0.7)';
      ctx.textAlign = 'left';
      ctx.fillText('✦ MARCO DORADO', 20, H-14);
    } else if (lv >= 6) {
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = 'rgba(200,215,230,0.55)';
      ctx.textAlign = 'left';
      ctx.fillText('✦ MARCO PLATA', 20, H-14);
    }
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  // ── Historial de partidas ────────────────────────────────────
  function _buildMatchHistory() {
    if (!w.gxUser) return '';
    var u       = gxUser.get();
    var history = u.recentMatchHistory;
    if (!Array.isArray(history) || !history.length) return '';
    var items = history.slice().reverse().slice(0, 7);
    var mons = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    var html = '<div class="gx-prof-section gx-history-section"><div class="gx-prof-section-title">' + _gt('hist-title') + '</div>';
    items.forEach(function(m) {
      var dateStr = '';
      if (m.d) { var dp = m.d.split('-'); if (dp.length === 3) dateStr = parseInt(dp[2]) + ' ' + mons[parseInt(dp[1])-1]; }
      var rc = m.w ? 'gx-history-result-w' : 'gx-history-result-l';
      var rl = m.w ? 'V' : 'D';
      var ml = (m.m === '5v5' || m.m === '3v3' || m.m === '1v1') ? m.m : '11v11';
      html += '<div class="gx-history-row">' +
        '<div class="gx-history-teams">' +
          '<div class="gx-history-team">' +
            '<img class="gx-history-badge" src="/img/badges/' + _esc(m.a||'') + '.png" alt="" loading="lazy" onerror="this.style.opacity=0">' +
            '<span class="gx-history-name">' + _esc((m.a||'?').replace(/-/g,' ')) + '</span>' +
          '</div>' +
          '<div class="gx-history-score">' + (m.ga||0) + ' – ' + (m.gb||0) + '</div>' +
          '<div class="gx-history-team gx-history-team-b">' +
            '<span class="gx-history-name">' + _esc((m.b||'?').replace(/-/g,' ')) + '</span>' +
            '<img class="gx-history-badge" src="/img/badges/' + _esc(m.b||'') + '.png" alt="" loading="lazy" onerror="this.style.opacity=0">' +
          '</div>' +
        '</div>' +
        '<div class="gx-history-meta">' +
          '<span class="gx-history-result ' + rc + '">' + rl + '</span>' +
          '<span class="gx-history-mode">' + _esc(ml) + '</span>' +
          (dateStr ? '<span class="gx-history-date">' + _esc(dateStr) + '</span>' : '') +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  // ── Próximos Logros ──────────────────────────────────────────
  function _buildNextAchievements() {
    if (!w.gxUser) return '';
    var u = gxUser.get();
    var ACHIEVEMENTS = gxUser.ACHIEVEMENTS;
    var PMAP = {
      ten_matches:   function(u){ return {cur:u.stats.matchesPlayed, max:10}; },
      fifty_matches: function(u){ return {cur:u.stats.matchesPlayed, max:50}; },
      cent_matches:  function(u){ return {cur:u.stats.matchesPlayed, max:100}; },
      five_trn:      function(u){ return {cur:u.stats.tournamentsCompleted, max:5}; },
      trn_25:        function(u){ return {cur:u.stats.tournamentsCompleted, max:25}; },
      streak_3:      function(u){ return {cur:u.streak.best, max:3}; },
      streak_7:      function(u){ return {cur:u.streak.best, max:7}; },
      globalist:     function(u){ return {cur:u.stats.uniqueTeamsUsed.length, max:10}; },
      collector:     function(u){ return {cur:u.stats.uniqueTeamsUsed.length, max:25}; },
      penalty_king:  function(u){ return {cur:u.stats.penaltiesPlayed, max:10}; },
      goleador:      function(u){ return {cur:u.stats.totalGoals, max:100}; },
      quest_streak:  function(u){ return {cur:u.stats.questsCompleted||0, max:5}; },
      mode_speed:    function(u){ return {cur:((u.stats.matchesByMode||{})['5v5']||0)+((u.stats.matchesByMode||{})['3v3']||0), max:5}; },
      mode_instant:  function(u){ return {cur:u.stats.instantMatches||0, max:10}; },
      champ_10:      function(u){ return {cur:u.stats.championsCompleted||0, max:10}; },
      wc_15:         function(u){ return {cur:u.stats.worldCupsCompleted||0, max:15}; },
      copa_5:        function(u){ return {cur:u.stats.copasPlayed||0, max:5}; },
      liga_5:        function(u){ return {cur:u.stats.ligasPlayed||0, max:5}; },
      level_5:       function(u){ return {cur:u.level, max:5}; },
      level_10:      function(u){ return {cur:u.level, max:10}; },
      level_12:      function(u){ return {cur:u.level, max:12}; },
      streak_14:     function(u){ return {cur:u.streak.best, max:14}; },
      streak_30:     function(u){ return {cur:u.streak.best, max:30}; },
      goals_500:     function(u){ return {cur:u.stats.totalGoals||0, max:500}; },
    };
    var candidates = [];
    Object.keys(PMAP).forEach(function(id) {
      if (u.achievements.includes(id)) return;
      var a = ACHIEVEMENTS[id]; if (!a) return;
      var p = PMAP[id](u);
      var pct = p.max > 0 ? Math.min(99, Math.round(p.cur / p.max * 100)) : 0;
      if (p.cur > 0) candidates.push({ id:id, a:a, cur:p.cur, max:p.max, pct:pct });
    });
    candidates.sort(function(x,y){ return y.pct - x.pct; });
    candidates = candidates.slice(0, 3);
    if (!candidates.length) return '';
    var html = '<div class="gx-prof-section gx-next-ach-section"><div class="gx-prof-section-title">' + _gt('next-ach') + '</div>';
    candidates.forEach(function(c) {
      html += '<div class="gx-next-ach-item">' +
        '<span class="gx-next-ach-icon">' + _esc(c.a.icon) + '</span>' +
        '<div class="gx-next-ach-body">' +
          '<span class="gx-next-ach-title">' + _esc(c.a.title) + '</span>' +
          '<span class="gx-next-ach-desc">' + _esc(c.a.desc) + '</span>' +
          '<div class="gx-next-ach-barwrap"><div class="gx-next-ach-bar" style="width:' + c.pct + '%"></div></div>' +
        '</div>' +
        '<span class="gx-next-ach-prog">' + c.cur + '/' + c.max + '</span>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  // ── Render del Tab Perfil completo ───────────────────────────
  function renderProfileTab() {
    var wrap = document.getElementById('main-profile-wrap');
    if (!wrap || !w.gxUser) return;

    var u     = gxUser.get();
    var lv    = u.level, xp  = u.xp;
    var base  = gxUser.xpForLevel(lv);
    var next  = gxUser.nextLevelXP(lv);
    var pct   = next != null ? _pct(xp - base, next - base) : 100;

    var LEVELS       = gxUser.LEVELS;
    var ACHIEVEMENTS = gxUser.ACHIEVEMENTS;
    var achIds       = Object.keys(ACHIEVEMENTS);
    var earned       = u.achievements.length;
    var emojis       = ['🌱','⚡','🔥','🌟','💫','🏅','🥈','🥇','🏆','💎','👑','⭐'];
    var avatar       = emojis[Math.min(lv-1, emojis.length-1)];
    var xpLabel      = next != null ? (xp-base) + ' / ' + (next-base) + ' XP para Lv.' + (lv+1) : xp + ' XP — Nivel máximo ★';

    // Barra segmentada grande (10 segmentos en perfil)
    function bigSegs(p) {
      var s = '';
      for (var i = 0; i < 10; i++) {
        var f = Math.max(0, Math.min(100, p - i*10)) / 10;
        s += '<div class="gx-bseg' + (f >= 1 ? ' gx-bseg-full' : f > 0 ? ' gx-bseg-part' : '') + '">'
           + (f > 0 && f < 1 ? '<div class="gx-bseg-fill" style="height:' + Math.round(f*100) + '%"></div>' : '')
           + '</div>';
      }
      return s;
    }

    // Logros
    var achHtml = achIds.map(function(id){
      var a  = ACHIEVEMENTS[id];
      var ok = u.achievements.includes(id);
      return '<div class="gx-ach-chip' + (ok ? ' gx-ach-earned' : ' gx-ach-locked') + '" title="' + _esc(a.desc) + '">' +
        '<span class="gx-ach-icon">' + (ok ? a.icon : '🔒') + '</span>' +
        '<span class="gx-ach-title">' + _esc(a.title) + '</span>' +
        '</div>';
    }).join('');

    wrap.innerHTML =
      '<div class="gx-profile-inner">' +

      // Header usuario
      '<div class="gx-prof-header">' +
        '<div class="gx-prof-avatar">' + avatar + '</div>' +
        '<div class="gx-prof-info">' +
          '<div class="gx-prof-name-row">' +
            '<span class="gx-prof-name" id="gx-prof-name-display">' + _esc(u.name) + '</span>' +
            '<button class="gx-prof-edit-btn" id="gx-prof-edit-name" title="Cambiar nombre">✏️</button>' +
          '</div>' +
          '<div class="gx-prof-rank-row">' +
            '<span class="gx-prof-level-badge">NIVEL ' + lv + '</span>' +
            '<span class="gx-prof-rank-title">' + _esc(gxUser.getLevelTitle(lv)) + '</span>' +
          '</div>' +
          '<span class="gx-prof-since">Desde ' + (u.createdAt||'?') + ' · Racha: ' + u.streak.current + ' días 🔥</span>' +
        '</div>' +
      '</div>' +

      // Barra XP segmentada
      '<div class="gx-prof-xp-section">' +
        '<div class="gx-prof-xp-label">' + _esc(xpLabel) + '</div>' +
        '<div class="gx-bsegs-row">' + bigSegs(pct) + '</div>' +
        '<div class="gx-prof-xp-total">' + xp + ' XP totales</div>' +
      '</div>' +

      // Stats
      '<div class="gx-prof-stats-grid">' +
        _sc('⚽', u.stats.matchesPlayed, _gt('stat-matches')) +
        _sc('🎯', u.stats.totalGoals,    _gt('stat-goals')) +
        _sc('📈', u.stats.matchesPlayed ? (u.stats.totalGoals / u.stats.matchesPlayed).toFixed(1) : '0.0', _gt('stat-gxp')) +
        _sc('🌍', u.stats.uniqueTeamsUsed.length, _gt('stat-teams')) +
        _sc('🏆', u.stats.tournamentsCompleted, _gt('stat-torneos')) +
        _sc('🔥', u.streak.current, _gt('stat-racha')) +
      '</div>' +

      // Historial de partidas
      _buildMatchHistory() +

      // Clasificación Diaria
      _buildDailyLeaderboard() +

      // Misiones diarias
      _buildQuestsHtml() +

      // Museo de Leyendas
      _buildMuseumHtml() +

      // Próximos logros
      _buildNextAchievements() +

      // Logros
      '<div class="gx-prof-section">' +
        '<div class="gx-prof-section-title">' + _gt('achievements') + ' <span class="gx-prof-badge">' + earned + '/' + achIds.length + '</span></div>' +
        '<div class="gx-ach-grid">' + achHtml + '</div>' +
      '</div>' +

      // Player Card
      '<div class="gx-prof-section gx-card-section">' +
        '<div class="gx-prof-section-title">' + _gt('card-title') + '</div>' +
        '<canvas id="gx-player-card-canvas" class="gx-player-card-canvas" aria-label="Tarjeta de jugador GolazoX"></canvas>' +
        '<div class="gx-card-name-row">' +
          '<span class="gx-card-name-lbl">' + _gt('card-name-lbl') + '</span>' +
          '<span class="gx-card-name-val" id="gx-card-name-val">' + _esc(u.name) + '</span>' +
          '<button class="gx-card-name-edit-btn" id="gx-card-name-edit" title="Cambiar nombre">' + _gt('card-change') + '</button>' +
        '</div>' +
        '<div class="gx-card-actions">' +
          '<button class="gx-btn gx-btn-primary" id="gx-share-card-btn">' + _gt('card-share') + '</button>' +
          '<button class="gx-btn gx-btn-secondary" id="gx-dl-card-btn">' + _gt('card-dl') + '</button>' +
        '</div>' +
      '</div>' +

      // Identidad: Equipo favorito + País
      _buildIdentityPanel() +

      // Backup
      '<div class="gx-prof-section gx-backup-section">' +
        '<div class="gx-prof-section-title">' + _gt('backup-title') + '</div>' +
        '<p class="gx-backup-desc">' + _gt('backup-desc') + '</p>' +
        '<p class="gx-backup-privacy">' + _gt('privacy-note') + '</p>' +
        (u.xp > 0 ? '<div class="gx-backup-reminder">🏆 <strong>' + _gt('backup-reminder') + '</strong> ' + u.achievements.length + ' 🏅 · ' + u.xp.toLocaleString() + ' XP</div>' : '') +
        '<div class="gx-backup-actions">' +
          '<button class="gx-btn gx-btn-primary" id="gx-export-btn">' + _gt('save-btn') + '</button>' +
          '<button class="gx-btn gx-btn-secondary" id="gx-import-btn">' + _gt('restore-btn') + '</button>' +
        '</div>' +
        '<div id="gx-export-result" class="gx-export-result hidden"></div>' +
        '<div id="gx-import-form" class="gx-import-form hidden">' +
          '<textarea id="gx-import-input" class="gx-import-textarea" placeholder="' + _gt('backup-input-ph') + '" rows="4"></textarea>' +
          '<button class="gx-btn gx-btn-primary" id="gx-import-confirm">' + _gt('restore-btn').replace('🔑 ','') + '</button>' +
          '<button class="gx-btn gx-btn-secondary" id="gx-import-cancel">' + (_gxLang() === 'en' ? 'Cancel' : 'Cancelar') + '</button>' +
        '</div>' +
      '</div>' +

      // Reset
      '<div class="gx-prof-section gx-reset-section">' +
        '<button class="gx-btn gx-btn-danger" id="gx-reset-btn">' + _gt('delete-btn') + '</button>' +
      '</div>' +

      '</div>';

    // Wiring
    _wireName();
    _wireBackup();
    _wireCard();
    _wireDailyShare();
    _wireDailyNameEdit();
    _wireQuests();
    _wireCardName();
    _wireFavTeam();

    // Dibuja la tarjeta canvas
    setTimeout(_drawPlayerCard, 60);
  }

  function _sc(icon, val, label) {
    return '<div class="gx-stat-card"><span class="gx-stat-icon">' + icon + '</span><span class="gx-stat-val">' + (val||0) + '</span><span class="gx-stat-label">' + _esc(label) + '</span></div>';
  }

  // ── Nombre compartido: guarda + refresca todos los puntos de display ─
  function _saveName(nm) {
    nm = (nm || '').trim().slice(0, 20);
    // Validación: 3-20 caracteres, solo letras, números, guión bajo o punto
    if (!nm || nm.length < 3) { _toast(_gt('name-too-short'), 'xp', 2500); return false; }
    if (!/^[\w.\-]+$/.test(nm)) { _toast(_gt('name-invalid'), 'xp', 2500); return false; }
    var uu = gxUser.get(); uu.name = nm;
    try { localStorage.setItem('gx_user', JSON.stringify(uu)); } catch(_) {}
    // Refrescar todos los elementos que muestran el nombre
    ['gx-prof-name-display','gx-daily-player-name','gx-card-name-val'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.textContent = nm;
    });
    _updateXpBar();
    // Redibujar la tarjeta canvas con el nuevo nombre
    setTimeout(_drawPlayerCard, 40);
    return true;
  }

  // ── Abre inline edit en el elemento dado y llama _saveName al confirmar ─
  function _inlineNameEdit(dispEl, btnEl) {
    if (!dispEl) return;
    var cur = dispEl.textContent;
    var inp = document.createElement('input');
    inp.type = 'text'; inp.value = cur; inp.maxLength = 20; inp.className = 'gx-prof-name-input';
    inp.placeholder = 'user123, Messi25...';
    dispEl.replaceWith(inp); inp.focus(); inp.select();
    if (btnEl) { btnEl.textContent = '✔'; btnEl.title = 'Confirmar'; }
    function _done() {
      var nm = inp.value.trim().slice(0, 20) || cur;
      var ok = _saveName(nm);
      if (ok === false) { inp.focus(); inp.select(); return; }
      var sp = document.createElement('span');
      sp.id = dispEl.id; sp.className = dispEl.className; sp.textContent = nm;
      inp.replaceWith(sp);
      if (btnEl) { btnEl.textContent = '✏️'; btnEl.title = 'Cambiar nombre'; }
    }
    if (btnEl) btnEl.addEventListener('click', _done, { once: true });
    inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); _done(); } });
    inp.addEventListener('blur', function(){ setTimeout(_done, 120); });
  }

  function _wireName() {
    var disp = document.getElementById('gx-prof-name-display');
    var btn  = document.getElementById('gx-prof-edit-name');
    if (!btn || !disp) return;
    btn.addEventListener('click', function() { _inlineNameEdit(disp, btn); });
  }

  function _wireCard() {
    var shareBtn = document.getElementById('gx-share-card-btn');
    var dlBtn    = document.getElementById('gx-dl-card-btn');
    var canvas   = document.getElementById('gx-player-card-canvas');
    if (!canvas) return;
    if (dlBtn) dlBtn.addEventListener('click', function() {
      var a = document.createElement('a');
      a.download = 'golazox-card.png'; a.href = canvas.toDataURL('image/png');
      a.click();
    });
    if (shareBtn) shareBtn.addEventListener('click', function() {
      if (!navigator.share && !navigator.clipboard) {
        dlBtn && dlBtn.click(); return;
      }
      canvas.toBlob(function(blob) {
        if (navigator.share) {
          var file = new File([blob], 'golazox-card.png', { type: 'image/png' });
          navigator.share({ files: [file], title: 'Mi progreso en GolazoX' }).catch(function(){});
        } else {
          var item = new ClipboardItem({ 'image/png': blob });
          navigator.clipboard.write([item]).then(function() {
            _toast(_gt('card-copied'), 'unlock', 3000);
          }).catch(function(){ dlBtn && dlBtn.click(); });
        }
      }, 'image/png');
    });
  }

  function _wireBackup() {
    var expBtn  = document.getElementById('gx-export-btn');
    var impBtn  = document.getElementById('gx-import-btn');
    var expRes  = document.getElementById('gx-export-result');
    var impForm = document.getElementById('gx-import-form');
    var impInp  = document.getElementById('gx-import-input');
    var impOk   = document.getElementById('gx-import-confirm');
    var impNo   = document.getElementById('gx-import-cancel');
    var resetBtn = document.getElementById('gx-reset-btn');

    if (expBtn) expBtn.addEventListener('click', function() {
      var r = gxUser.exportCode(); if (!r) return;
      expRes.innerHTML =
        '<div class="gx-backup-code">' +
          '<small>' + _gt('backup-desc') + '</small>' +
          '<textarea class="gx-backup-full" readonly rows="3">' + _esc(r.b64) + '</textarea>' +
          '<button class="gx-btn gx-btn-secondary gx-copy-btn" id="gx-copy-b64">' + _gt('backup-copy') + '</button>' +
        '</div>';
      expRes.classList.remove('hidden');
      document.getElementById('gx-copy-b64')?.addEventListener('click', function(ev) {
        navigator.clipboard.writeText(r.b64).then(function(){ ev.target.textContent = _gt('backup-copied'); setTimeout(function(){ ev.target.textContent = _gt('backup-copy'); }, 2000); }).catch(function(){});
      });
    });
    if (impBtn) impBtn.addEventListener('click', function(){ impForm.classList.toggle('hidden'); });
    if (impNo)  impNo.addEventListener('click',  function(){ impForm.classList.add('hidden'); });
    if (impOk)  impOk.addEventListener('click', function() {
      var b64 = impInp && impInp.value.trim();
      if (!b64) return;
      if (gxUser.importCode(b64)) {
        impForm.classList.add('hidden');
        _toast(_gt('backup-restore-ok'), 'unlock', 3500);
        setTimeout(function(){ renderProfileTab(); _updateXpBar(); }, 300);
      } else {
        impInp.style.borderColor = '#ff4d6d';
        _toast(_gt('backup-invalid'), 'xp', 3000);
      }
    });
    if (resetBtn) resetBtn.addEventListener('click', function() {
      if (!confirm(_gt('confirm-reset'))) return;
      gxUser.reset(); renderProfileTab(); _updateXpBar();
      _toast(_gt('reset-done'), 'xp', 3000);
    });
  }

  // ── Modal equipo bloqueado ────────────────────────────────
  function showLockModal(slug, xpRequired) {
    var ex = document.getElementById('gx-lock-modal'); if (ex) ex.remove();
    var info  = w.gxUser ? gxUser.getLockedInfo(slug) : null;
    var xp    = xpRequired || (info && info.xp) || 0;
    var label = (info && info.label) || slug;
    var era   = (info && info.era) || '';
    var allEras = !!(info && info.allEras);
    // Si allEras=true, mostrar "(todas las ediciones)" en lugar del año específico
    var eraDisplay = allEras ? _gt('locked-all') : (era ? ' · ' + era : '');
    var u     = w.gxUser ? gxUser.get() : null;
    var uxp   = u ? u.xp : 0;
    var diff  = Math.max(0, xp - uxp);
    var pct   = xp > 0 ? Math.min(100, Math.round(uxp / xp * 100)) : 100;

    // Calcular rutas rápidas para llegar al XP necesario
    var paths = '';
    if (diff > 0 && w.gxUser) {
      var XP_VAL = gxUser.XP;
      var pathItems = [];
      var matchesNeeded = Math.ceil(diff / (XP_VAL.match + 4 * XP_VAL.goalBonus));
      if (matchesNeeded <= 20) pathItems.push('⚽ ~' + matchesNeeded + ' partid' + (matchesNeeded === 1 ? 'o' : 'os'));
      var trnNeeded = Math.ceil(diff / XP_VAL.tournamentChamp);
      if (trnNeeded <= 5)  pathItems.push('🏆 ' + trnNeeded + ' torneo' + (trnNeeded === 1 ? '' : 's') + ' Champions');
      var questsNeeded = Math.ceil(diff / (XP_VAL.questBonus * 3 + XP_VAL.questDayBonus));
      if (questsNeeded <= 7) pathItems.push('📋 ' + questsNeeded + ' día' + (questsNeeded === 1 ? '' : 's') + ' con 3/3 misiones');
      if (pathItems.length) {
        paths = '<div class="gx-lm-paths"><span class="gx-lm-paths-title">' + _gt('locked-how') + '</span>' +
          pathItems.map(function(p){ return '<span class="gx-lm-path-item">' + _esc(p) + '</span>'; }).join('') +
          '</div>';
      }
    }

    var ov = document.createElement('div');
    ov.id = 'gx-lock-modal'; ov.className = 'gx-modal-overlay';
    ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
    ov.innerHTML = '<div class="gx-modal">' +
      '<button class="gx-modal-close" id="gx-lm-close">✕</button>' +
      '<div class="gx-modal-icon"><img class="gx-lm-badge-img" src="/img/badges/' + _esc(slug) + '.png" alt="" onerror="this.src=\'/img/badges/_placeholder.svg\'"></div>' +
      '<h3 class="gx-modal-title">' + _gt('locked-title') + '</h3>' +
      '<p class="gx-modal-team">' + _esc(label) + (eraDisplay ? ' <span class="gx-modal-era">' + _esc(eraDisplay) + '</span>' : '') + '</p>' +
      '<p class="gx-modal-desc">' + _gt('locked-xp-req') + ' <strong>' + xp + ' XP</strong>.</p>' +
      '<div class="gx-modal-progress">' +
        '<div class="gx-modal-prog-bar"><div class="gx-modal-prog-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="gx-modal-prog-label">' + uxp + ' / ' + xp + ' XP · ' + pct + '%</span>' +
      '</div>' +
      (diff > 0
        ? '<p class="gx-modal-hint">' + _gt('locked-miss') + ' <strong>' + diff + ' ' + _gt('locked-xp') + '</strong></p>' + paths
        : '<p class="gx-modal-hint gx-modal-hint--ready">' + _gt('locked-ready') + '</p>') +
      '<div class="gx-lm-btns">' +
        '<button class="gx-btn gx-btn-primary" id="gx-lm-play">' + _gt('locked-play') + '</button>' +
        '<button class="gx-btn gx-btn-secondary" id="gx-lm-ok">' + _gt('locked-close') + '</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ ov.classList.add('gx-modal--in'); }); });
    function _close() {
      ov.classList.remove('gx-modal--in'); ov.classList.add('gx-modal--out');
      setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
    }
    document.getElementById('gx-lm-close')?.addEventListener('click', _close);
    document.getElementById('gx-lm-ok')?.addEventListener('click', _close);
    document.getElementById('gx-lm-play')?.addEventListener('click', function() {
      _close();
      if (typeof TRN !== 'undefined' && TRN.switchMainTab) TRN.switchMainTab('match');
    });
    ov.addEventListener('click', function(e){ if(e.target===ov) _close(); });
    document.addEventListener('keydown', function _k(e){ if(e.key==='Escape'){ _close(); document.removeEventListener('keydown',_k); } });
  }

  // ── Timer actividad ─────────────────────────────────────────
  function _startActivityTimer() {
    setTimeout(function() {
      if (!w.gxUser) return;
      var r = gxUser.addXP('activity'); r._reason = 'activity';
      if (r.gained > 0 && w.gxUI) gxUI.onXpGained(r);
    }, 30 * 60 * 1000);
  }

  // ── Init ─────────────────────────────────────────────────────
  function _init() {
    if (!w.gxUser) { setTimeout(_init, 500); return; }
    _injectXpBar();
    _startActivityTimer();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', _init)
    : setTimeout(_init, 0);

  // ── API pública ───────────────────────────────────────────────
  w.gxUI = {
    onXpGained:       onXpGained,
    showLockModal:    showLockModal,
    renderProfileTab: renderProfileTab,
    updateXpBar:      _updateXpBar,
    showToast:        function(html, type, dur){ _toast(html, type||'xp', dur||3000); },
  };

}(window));
