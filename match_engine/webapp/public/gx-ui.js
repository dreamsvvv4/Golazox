/**
 * gx-ui.js — GolazoX Gamification UI
 * Maneja: toasts XP, barra XP header, tab Perfil, modal equipo bloqueado,
 *         logros, celebración de nivel, código de respaldo.
 * Requiere: gx-user.js cargado antes.
 * API: window.gxUI.*
 */
'use strict';
(function (w) {
  // ── Helpers internos ────────────────────────────────────────
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _pct(cur, max) {
    if (!max) return 0;
    return Math.min(100, Math.round((cur / max) * 100));
  }

  // ── Toast XP ────────────────────────────────────────────────
  var _toastQueue  = [];
  var _toastActive = false;

  function _showNextToast() {
    if (_toastActive || !_toastQueue.length) return;
    _toastActive = true;
    var item = _toastQueue.shift();
    var el   = document.createElement('div');
    el.className = 'gx-toast gx-toast--' + (item.type || 'xp');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = item.html;
    document.body.appendChild(el);

    // Entrada
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('gx-toast--in'); });
    });

    setTimeout(function () {
      el.classList.remove('gx-toast--in');
      el.classList.add('gx-toast--out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        _toastActive = false;
        _showNextToast();
      }, 350);
    }, item.duration || 3000);
  }

  function _enqueueToast(html, type, duration) {
    _toastQueue.push({ html: html, type: type || 'xp', duration: duration || 3000 });
    _showNextToast();
  }

  function showXpToast(gained, reason) {
    if (!gained || gained <= 0) return;
    var labels = {
      match:      'partido simulado',
      penalties:  'penaltis',
      tournament: 'torneo completado',
      activity:   '30 min activo',
    };
    var label = labels[reason] || '';
    var html  = '<span class="gx-toast-xp">+' + gained + ' XP</span>'
              + (label ? '<span class="gx-toast-reason"> · ' + _esc(label) + '</span>' : '');
    _enqueueToast(html, 'xp', 2500);
  }

  function showLevelUpToast(level) {
    var html = '<span class="gx-toast-star">⭐</span> '
             + '<strong>¡Nivel ' + level + '!</strong>'
             + ' — Has subido de nivel';
    _enqueueToast(html, 'levelup', 4000);
  }

  function showAchievementToast(ach) {
    var html = '<span class="gx-toast-ach-icon">' + _esc(ach.icon) + '</span>'
             + '<div class="gx-toast-ach-body">'
             + '<span class="gx-toast-ach-pre">Logro desbloqueado</span>'
             + '<span class="gx-toast-ach-title">' + _esc(ach.title) + '</span>'
             + '</div>';
    _enqueueToast(html, 'achievement', 4200);
  }

  function showUnlockToast(unlock) {
    var html = '<span class="gx-toast-unlock-icon">🔓</span>'
             + '<div class="gx-toast-ach-body">'
             + '<span class="gx-toast-ach-pre">¡Equipo desbloqueado!</span>'
             + '<span class="gx-toast-ach-title">' + _esc(unlock.label + ' ' + unlock.era) + '</span>'
             + '</div>';
    _enqueueToast(html, 'unlock', 4200);
  }

  // ── Callback central llamado tras cada addXP ─────────────────
  function onXpGained(result) {
    if (!result) return;
    if (result.gained > 0) {
      showXpToast(result.gained, result._reason);
    }
    if (result.leveled) {
      showLevelUpToast(result.newLevel);
    }
    (result.newAchs || []).forEach(function (a) {
      setTimeout(function () { showAchievementToast(a); }, 400);
    });
    (result.newUnlocks || []).forEach(function (u) {
      setTimeout(function () { showUnlockToast(u); }, 800);
    });
    _updateXpBar();
  }

  // ── Barra XP en el header ────────────────────────────────────
  var _xpBarEl   = null;
  var _xpFillEl  = null;
  var _xpLevelEl = null;
  var _xpPctEl   = null;

  function _injectXpBar() {
    var headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('gx-xp-bar')) return;

    var wrap     = document.createElement('div');
    wrap.id      = 'gx-xp-bar';
    wrap.className = 'gx-xp-wrap';
    wrap.setAttribute('title', 'Tu progreso en GolazoX — Tab Perfil');
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.innerHTML =
      '<span class="gx-xp-level" id="gx-xp-level">Lv.1</span>' +
      '<div class="gx-xp-track" aria-label="Barra de experiencia">' +
        '<div class="gx-xp-fill" id="gx-xp-fill" style="width:0%"></div>' +
      '</div>' +
      '<span class="gx-xp-pct" id="gx-xp-pct">0 XP</span>';

    // Insertar antes del botón de idioma
    var langBtn = document.getElementById('lang-toggle');
    if (langBtn) headerRight.insertBefore(wrap, langBtn);
    else headerRight.appendChild(wrap);

    _xpBarEl   = wrap;
    _xpFillEl  = document.getElementById('gx-xp-fill');
    _xpLevelEl = document.getElementById('gx-xp-level');
    _xpPctEl   = document.getElementById('gx-xp-pct');

    // Click → abrir tab Perfil
    wrap.addEventListener('click', function () { _openProfileTab(); });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') _openProfileTab(); });

    _updateXpBar();
  }

  function _updateXpBar() {
    if (!w.gxUser) return;
    var u    = gxUser.get();
    var lv   = u.level;
    var xp   = u.xp;
    var base = gxUser.xpForLevel(lv);
    var next = gxUser.nextLevelXP(lv);
    var pct  = next != null ? _pct(xp - base, next - base) : 100;

    if (!_xpFillEl) {
      _xpFillEl  = document.getElementById('gx-xp-fill');
      _xpLevelEl = document.getElementById('gx-xp-level');
      _xpPctEl   = document.getElementById('gx-xp-pct');
    }
    if (_xpFillEl) {
      requestAnimationFrame(function () {
        _xpFillEl.style.width = pct + '%';
      });
    }
    if (_xpLevelEl) _xpLevelEl.textContent = 'Lv.' + lv;
    if (_xpPctEl)   _xpPctEl.textContent   = next != null
      ? (xp - base) + '/' + (next - base) + ' XP'
      : xp + ' XP ★';
  }

  // ── Tab Perfil ────────────────────────────────────────────────
  function _openProfileTab() {
    if (typeof TRN !== 'undefined' && TRN.switchMainTab) {
      TRN.switchMainTab('profile');
    }
  }

  function renderProfileTab() {
    var wrap = document.getElementById('main-profile-wrap');
    if (!wrap || !w.gxUser) return;

    var u    = gxUser.get();
    var lv   = u.level;
    var xp   = u.xp;
    var base = gxUser.xpForLevel(lv);
    var next = gxUser.nextLevelXP(lv);
    var pct  = next != null ? _pct(xp - base, next - base) : 100;
    var xpLabel = next != null
      ? (xp - base) + ' / ' + (next - base) + ' XP para Lv.' + (lv + 1)
      : xp + ' XP — Nivel máximo ★';

    var LEVELS = gxUser.LEVELS;
    var ACHIEVEMENTS = gxUser.ACHIEVEMENTS;
    var LOCKED_TEAMS = gxUser.LOCKED_TEAMS;
    var achIds = Object.keys(ACHIEVEMENTS);

    // Logros ganados/total
    var earned = u.achievements.length;
    var total  = achIds.length;

    // Render equipos desbloqueados/bloqueados
    var lockedInfo = '';
    Object.keys(LOCKED_TEAMS).forEach(function (slug) {
      var info  = LOCKED_TEAMS[slug];
      var done  = u.unlockedTeams.includes(slug);
      lockedInfo += '<div class="gx-lock-row' + (done ? ' gx-lock-row--done' : '') + '">'
        + (done ? '🔓' : '🔒')
        + ' <strong>' + _esc(info.label + ' ' + info.era) + '</strong>'
        + '<span class="gx-lock-xp">' + info.xp + ' XP</span>'
        + '</div>';
    });

    // Render logros
    var achHtml = achIds.map(function (id) {
      var ach     = ACHIEVEMENTS[id];
      var isEarned = u.achievements.includes(id);
      return '<div class="gx-ach-chip' + (isEarned ? ' gx-ach-earned' : ' gx-ach-locked') + '" title="' + _esc(ach.desc) + '">'
        + '<span class="gx-ach-icon">' + (isEarned ? ach.icon : '🔒') + '</span>'
        + '<span class="gx-ach-title">' + _esc(ach.title) + '</span>'
        + '</div>';
    }).join('');

    // XP bar del perfil con segmentos de niveles
    var lvBarsHtml = LEVELS.slice(1).map(function (threshold, i) {
      var lvNum = i + 2;
      var done  = xp >= threshold;
      return '<span class="gx-prof-lv-mark' + (done ? ' done' : '') + '" style="left:' + _pct(threshold, LEVELS[LEVELS.length - 1]) + '%" title="Lv.' + lvNum + '"></span>';
    }).join('');

    wrap.innerHTML =
      '<div class="gx-profile-inner">' +

        // ── Cabecera usuario ──────────────────────────────────
        '<div class="gx-prof-header">' +
          '<div class="gx-prof-avatar">' + _levelEmoji(lv) + '</div>' +
          '<div class="gx-prof-info">' +
            '<div class="gx-prof-name-row">' +
              '<span class="gx-prof-name" id="gx-prof-name-display">' + _esc(u.name) + '</span>' +
              '<button class="gx-prof-edit-btn" id="gx-prof-edit-name" title="Cambiar nombre">✏️</button>' +
            '</div>' +
            '<span class="gx-prof-level-badge">NIVEL ' + lv + '</span>' +
            '<span class="gx-prof-since">Desde ' + (u.createdAt || '?') + '</span>' +
          '</div>' +
        '</div>' +

        // ── Barra XP grande ───────────────────────────────────
        '<div class="gx-prof-xp-section">' +
          '<div class="gx-prof-xp-label">' + _esc(xpLabel) + '</div>' +
          '<div class="gx-prof-xp-track">' +
            '<div class="gx-prof-xp-fill" style="width:' + pct + '%"></div>' +
            lvBarsHtml +
          '</div>' +
          '<div class="gx-prof-xp-total">' + xp + ' XP totales</div>' +
        '</div>' +

        // ── Stats ─────────────────────────────────────────────
        '<div class="gx-prof-stats-grid">' +
          _statCard('⚽', u.stats.matchesPlayed, 'partidos') +
          _statCard('🎯', u.stats.totalGoals, 'goles') +
          _statCard('🌍', u.stats.uniqueTeamsUsed.length, 'equipos') +
          _statCard('🥅', u.stats.penaltiesPlayed, 'tandas pen.') +
          _statCard('🏆', u.stats.tournamentsCompleted, 'torneos') +
          _statCard('🔥', u.streak.current, 'racha días') +
        '</div>' +

        // ── Logros ────────────────────────────────────────────
        '<div class="gx-prof-section">' +
          '<div class="gx-prof-section-title">🏅 LOGROS <span class="gx-prof-badge">' + earned + '/' + total + '</span></div>' +
          '<div class="gx-ach-grid">' + achHtml + '</div>' +
        '</div>' +

        // ── Equipos desbloqueados ─────────────────────────────
        '<div class="gx-prof-section">' +
          '<div class="gx-prof-section-title">🔓 EQUIPOS ESPECIALES</div>' +
          '<div class="gx-locks-list">' + lockedInfo + '</div>' +
        '</div>' +

        // ── Copia de seguridad ────────────────────────────────
        '<div class="gx-prof-section gx-backup-section">' +
          '<div class="gx-prof-section-title">💾 COPIA DE SEGURIDAD</div>' +
          '<p class="gx-backup-desc">Guarda tu progreso para restaurarlo en otro dispositivo o si borras el caché.</p>' +
          '<div class="gx-backup-actions">' +
            '<button class="gx-btn gx-btn-primary" id="gx-export-btn">💾 Guardar progreso</button>' +
            '<button class="gx-btn gx-btn-secondary" id="gx-import-btn">🔑 Restaurar</button>' +
          '</div>' +
          '<div id="gx-export-result" class="gx-export-result hidden"></div>' +
          '<div id="gx-import-form" class="gx-import-form hidden">' +
            '<textarea id="gx-import-input" class="gx-import-textarea" placeholder="Pega aquí el código completo de respaldo (texto largo en Base64)..." rows="4"></textarea>' +
            '<button class="gx-btn gx-btn-primary" id="gx-import-confirm">Restaurar progreso</button>' +
            '<button class="gx-btn gx-btn-secondary" id="gx-import-cancel">Cancelar</button>' +
          '</div>' +
        '</div>' +

        // ── Reset ─────────────────────────────────────────────
        '<div class="gx-prof-section gx-reset-section">' +
          '<button class="gx-btn gx-btn-danger" id="gx-reset-btn">⚠️ Borrar progreso</button>' +
        '</div>' +

      '</div>';

    // ── Wiring de botones del perfil ──────────────────────────
    _wireProfNameEdit(u);
    _wireProfBackup();
  }

  function _levelEmoji(lv) {
    var emojis = ['🌱','⚡','🔥','🌟','💫','🏅','🥈','🥇','🏆','💎','👑','⭐'];
    return emojis[Math.min(lv - 1, emojis.length - 1)] || '🌱';
  }

  function _statCard(icon, val, label) {
    return '<div class="gx-stat-card">'
      + '<span class="gx-stat-icon">' + icon + '</span>'
      + '<span class="gx-stat-val">' + (val || 0) + '</span>'
      + '<span class="gx-stat-label">' + _esc(label) + '</span>'
      + '</div>';
  }

  function _wireProfNameEdit(u) {
    var nameDisplay = document.getElementById('gx-prof-name-display');
    var editBtn     = document.getElementById('gx-prof-edit-name');
    if (!editBtn || !nameDisplay) return;

    editBtn.addEventListener('click', function () {
      var current = nameDisplay.textContent;
      var input   = document.createElement('input');
      input.type  = 'text';
      input.value = current;
      input.maxLength = 24;
      input.className = 'gx-prof-name-input';
      nameDisplay.replaceWith(input);
      input.focus();
      editBtn.textContent = '✔';

      function _save() {
        var newName = input.value.trim().slice(0, 24) || current;
        var user = gxUser.get();
        user.name = newName;
        try { localStorage.setItem('gx_user', JSON.stringify(user)); } catch (_) {}
        var newSpan = document.createElement('span');
        newSpan.id = 'gx-prof-name-display';
        newSpan.className = 'gx-prof-name';
        newSpan.textContent = newName;
        input.replaceWith(newSpan);
        editBtn.textContent = '✏️';
        _updateXpBar();
      }
      editBtn.addEventListener('click', _save, { once: true });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') _save(); });
    });
  }

  function _wireProfBackup() {
    var exportBtn   = document.getElementById('gx-export-btn');
    var importBtn   = document.getElementById('gx-import-btn');
    var exportResult = document.getElementById('gx-export-result');
    var importForm  = document.getElementById('gx-import-form');
    var importInput = document.getElementById('gx-import-input');
    var importConfirm = document.getElementById('gx-import-confirm');
    var importCancel  = document.getElementById('gx-import-cancel');
    var resetBtn    = document.getElementById('gx-reset-btn');

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var result = gxUser.exportCode();
        if (!result) return;
        exportResult.innerHTML =
          '<div class="gx-backup-code">' +
            '<strong>Código identificador:</strong><br>' +
            '<span class="gx-code-display">' + _esc(result.code) + '</span>' +
            '<br><small>Este código es solo identificativo. Para restaurar necesitas el texto completo:</small><br>' +
            '<textarea class="gx-backup-full" readonly rows="3">' + _esc(result.b64) + '</textarea>' +
            '<button class="gx-btn gx-btn-secondary gx-copy-btn" id="gx-copy-b64">📋 Copiar</button>' +
          '</div>';
        exportResult.classList.remove('hidden');

        var copyBtn = document.getElementById('gx-copy-b64');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(result.b64).then(function () {
              copyBtn.textContent = '✔ Copiado';
              setTimeout(function () { copyBtn.textContent = '📋 Copiar'; }, 2000);
            }).catch(function () {
              // Selector fallback
              var ta = exportResult.querySelector('.gx-backup-full');
              if (ta) { ta.select(); document.execCommand('copy'); }
              copyBtn.textContent = '✔ Copiado';
              setTimeout(function () { copyBtn.textContent = '📋 Copiar'; }, 2000);
            });
          });
        }
      });
    }

    if (importBtn) {
      importBtn.addEventListener('click', function () {
        importForm.classList.toggle('hidden');
      });
    }
    if (importCancel) {
      importCancel.addEventListener('click', function () {
        importForm.classList.add('hidden');
      });
    }
    if (importConfirm) {
      importConfirm.addEventListener('click', function () {
        var b64 = (importInput && importInput.value.trim()) || '';
        if (!b64) return;
        if (gxUser.importCode(b64)) {
          importForm.classList.add('hidden');
          _enqueueToast('✔ Progreso restaurado correctamente', 'unlock', 4000);
          setTimeout(function () { renderProfileTab(); _updateXpBar(); }, 300);
        } else {
          importInput.style.borderColor = '#ff4d6d';
          _enqueueToast('⚠️ Código inválido — asegúrate de pegar el texto completo', 'xp', 4000);
        }
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!confirm('¿Borrar todo tu progreso? Esta acción no se puede deshacer.')) return;
        gxUser.reset();
        renderProfileTab();
        _updateXpBar();
        _enqueueToast('Progreso borrado. Empezamos de cero.', 'xp', 3000);
      });
    }
  }

  // ── Modal equipo bloqueado ────────────────────────────────────
  function showLockModal(slug, xpRequired) {
    var existing = document.getElementById('gx-lock-modal');
    if (existing) existing.remove();

    var info = w.gxUser ? gxUser.getLockedInfo(slug) : null;
    var xp   = xpRequired || (info && info.xp) || 0;
    var label = (info && info.label) || slug;
    var era   = (info && info.era)  || '';

    var u    = w.gxUser ? gxUser.get() : null;
    var userXp = u ? u.xp : 0;
    var diff   = Math.max(0, xp - userXp);
    var pct    = xp > 0 ? Math.min(100, Math.round((userXp / xp) * 100)) : 100;

    var overlay = document.createElement('div');
    overlay.id  = 'gx-lock-modal';
    overlay.className = 'gx-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="gx-modal">' +
        '<button class="gx-modal-close" id="gx-lock-modal-close" aria-label="Cerrar">✕</button>' +
        '<div class="gx-modal-icon">🔒</div>' +
        '<h3 class="gx-modal-title">Equipo bloqueado</h3>' +
        '<p class="gx-modal-team">' + _esc(label + (era ? ' · ' + era : '')) + '</p>' +
        '<p class="gx-modal-desc">Este equipo histórico se desbloquea al acumular <strong>' + xp + ' XP</strong>.</p>' +
        '<div class="gx-modal-progress">' +
          '<div class="gx-modal-prog-bar"><div class="gx-modal-prog-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="gx-modal-prog-label">' + userXp + ' / ' + xp + ' XP</span>' +
        '</div>' +
        (diff > 0
          ? '<p class="gx-modal-hint">Te faltan <strong>' + diff + ' XP</strong>. Simula partidos para ganar XP.</p>'
          : '<p class="gx-modal-hint gx-modal-hint--ready">✔ Ya tienes suficiente XP. Recarga la página para desbloquearlo.</p>'
        ) +
        '<button class="gx-btn gx-btn-primary" id="gx-lock-modal-close2">Entendido</button>' +
      '</div>';

    document.body.appendChild(overlay);

    // Animar entrada
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.classList.add('gx-modal--in'); });
    });

    function _close() {
      overlay.classList.remove('gx-modal--in');
      overlay.classList.add('gx-modal--out');
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    }
    document.getElementById('gx-lock-modal-close')?.addEventListener('click', _close);
    document.getElementById('gx-lock-modal-close2')?.addEventListener('click', _close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _close(); });
    document.addEventListener('keydown', function _esc(e) {
      if (e.key === 'Escape') { _close(); document.removeEventListener('keydown', _esc); }
    });
  }

  // ── Timer de actividad (30min = +5XP) ─────────────────────────
  function _startActivityTimer() {
    setTimeout(function () {
      if (!w.gxUser) return;
      var r = gxUser.addXP('activity');
      if (r.gained > 0) {
        r._reason = 'activity';
        onXpGained(r);
      }
    }, 30 * 60 * 1000); // 30 minutos
  }

  // ── Init (espera DOM) ──────────────────────────────────────────
  function _init() {
    if (!w.gxUser) {
      // Reintenta en 500ms por si gx-user.js todavía no cargó
      setTimeout(_init, 500);
      return;
    }
    _injectXpBar();
    _startActivityTimer();

    // Si el wrap de perfil existe pero está vacío, no renderizamos hasta que se abra
    // para no bloquear el primer paint
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 0);
  }

  // ── API pública ────────────────────────────────────────────────
  w.gxUI = {
    onXpGained:       onXpGained,
    showLockModal:    showLockModal,
    renderProfileTab: renderProfileTab,
    updateXpBar:      _updateXpBar,
    showToast:        function (html, type, dur) { _enqueueToast(html, type || 'xp', dur || 3000); },
  };

}(window));
