// Patch: insert /subscribe route into server.js before app.get('*')
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

const MARKER = "app.get('*', (req, res) => {";
const idx = s.indexOf(MARKER);
if (idx === -1) { console.error('Marker not found!'); process.exit(1); }

const insert = `// ── POST /subscribe — Newsletter opt-in ──────────────────────────────────
// Stores emails in subscribers.json. Rate: 5/hour per IP. Deduplicates.
const SUBS_FILE = require('path').join(__dirname, 'subscribers.json');
const _subscribeLimit = _rl(5, 60 * 60000);
app.post('/subscribe', _requireJSON, _subscribeLimit, (req, res) => {
  const email = String(req.body.email || '').slice(0, 200).trim().toLowerCase();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Email inv\u00e1lido.' });
  }
  try {
    let subs = [];
    const subsFile = require('path').join(__dirname, 'subscribers.json');
    if (require('fs').existsSync(subsFile)) {
      try { subs = JSON.parse(require('fs').readFileSync(subsFile, 'utf8')); } catch (_) {}
    }
    if (subs.some(s => s.email === email)) return res.json({ ok: true, already: true });
    if (subs.length >= 10000) subs = subs.slice(-9999);
    subs.push({ email, ts: new Date().toISOString() });
    require('fs').writeFileSync(subsFile, JSON.stringify(subs, null, 2), 'utf8');
    console.log('[subscribe] ' + email + ' (total: ' + subs.length + ')');
    if (_mailer) {
      _mailer.sendMail({
        from: '"GolazoX" <' + process.env.EMAIL_USER + '>',
        to: OWNER_EMAIL,
        subject: '[GolazoX] Nuevo suscriptor #' + subs.length,
        text: 'Email: ' + email + '\\nTotal: ' + subs.length,
      }).catch(e => console.warn('[subscribe] notify:', e.message));
    }
  } catch (err) {
    console.error('[subscribe]', err.message);
    return res.status(500).json({ error: 'Error. Int\u00e9ntalo de nuevo.' });
  }
  res.json({ ok: true });
});

`;

s = s.slice(0, idx) + insert + s.slice(idx);
fs.writeFileSync(serverPath, s, 'utf8');
console.log('Done. Inserted', insert.length, 'chars before app.get(*) at index', idx);
