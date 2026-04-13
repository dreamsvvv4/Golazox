// Newsletter subscribe form handler
(function () {
  var form  = document.getElementById('subscribe-form');
  if (!form) return;
  var btn   = form.querySelector('button');
  var msg   = document.getElementById('subscribe-msg');
  var input = document.getElementById('subscribe-email');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (input.value || '').trim();
    if (!email) return;
    btn.disabled = true;
    msg.className = 'footer-subscribe-msg';
    msg.textContent = '\u2026';

    fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          msg.textContent = d.already
            ? 'Ya est\u00e1s suscrito \u2713'
            : '\u00a1Listo! Te avisaremos cuando haya novedades \u2713';
          form.style.display = 'none';
        } else {
          msg.className = 'footer-subscribe-msg error';
          msg.textContent = d.error || 'Error. Int\u00e9ntalo de nuevo.';
          btn.disabled = false;
        }
      })
      .catch(function () {
        msg.className = 'footer-subscribe-msg error';
        msg.textContent = 'Error de conexi\u00f3n. Int\u00e9ntalo de nuevo.';
        btn.disabled = false;
      });
  });
})();
