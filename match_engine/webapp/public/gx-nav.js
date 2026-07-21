/* gx-nav.js — Off-canvas drawer para el menú lateral en móvil. CSP-safe. */
(function () {
  var nav = document.querySelector('.side-nav');
  if (!nav) return;

  var btn = document.createElement('button');
  btn.className = 'nav-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Abrir menú');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="nt-ico" aria-hidden="true">\u2630</span>';

  var backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';

  document.body.appendChild(backdrop);
  document.body.appendChild(btn);

  function setOpen(open) {
    document.body.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    var ico = btn.querySelector('.nt-ico');
    if (ico) ico.textContent = open ? '\u2715' : '\u2630';
  }

  btn.addEventListener('click', function () {
    setOpen(!document.body.classList.contains('nav-open'));
  });
  backdrop.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) setOpen(false);
  });
  // Al pulsar un enlace del menú, cerrar el drawer.
  nav.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a')) setOpen(false);
  });
  // Al volver a escritorio, asegurar que queda cerrado.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 1040) setOpen(false);
  });
})();
