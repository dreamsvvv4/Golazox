/**
 * TikTok OAuth helper (Node.js) — two-phase approach
 *
 * PHASE 1 – generate auth URL (no waiting):
 *   node tiktok_oauth.js
 *   → opens browser, saves verifier to .tiktok_verifier.tmp, exits
 *
 * PHASE 2 – exchange code immediately after authorizing:
 *   node tiktok_oauth.js "https://golazox.com/tiktok-callback?code=..."
 *   → reads saved verifier, exchanges code, saves tokens to .env
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath      = path.join(__dirname, '.env');
const verifierPath = path.join(__dirname, '.tiktok_verifier.tmp');

function getEnv(key) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const line = lines.find(l => l.trimStart().startsWith(key + '='));
  if (!line) throw new Error(`.env missing ${key}`);
  return line.slice(line.indexOf('=') + 1).replace(/\r/g, '').trim();
}

const clientKey = getEnv('TIKTOK_CLIENT_KEY');

// ── PHASE 2: exchange code ────────────────────────────────────────────────────
const callbackArg = process.argv[2];
if (callbackArg) {
  (async () => {
    let code;
    try {
      code = new URL(callbackArg.trim()).searchParams.get('code');
    } catch {
      console.error('URL invalida');
      process.exit(1);
    }
    if (!code) { console.error('No se encontro ?code= en la URL'); process.exit(1); }

    if (!fs.existsSync(verifierPath)) {
      console.error('No se encontro .tiktok_verifier.tmp — ejecuta primero: node tiktok_oauth.js');
      process.exit(1);
    }
    const verifier = fs.readFileSync(verifierPath, 'utf8').trim();

    console.log(`[debug] client_key : "${clientKey}" (len=${clientKey.length})`);
    console.log(`[debug] code       : "${code.slice(0,20)}..." (len=${code.length})`);
    console.log(`[debug] verifier   : "${verifier.slice(0,20)}..." (len=${verifier.length})`);

    const clientSecret = getEnv('TIKTOK_CLIENT_SECRET');
    const body = new URLSearchParams({
      client_key:    clientKey,
      client_secret: clientSecret,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  'https://golazox.com/tiktok-callback',
      code_verifier: verifier
    }).toString();

    console.log('\n[TikTok Auth] Intercambiando codigo...');
    console.log(`[debug] body: client_key=${clientKey}&client_secret=***&code=${code.slice(0,20)}...`);

    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json();
    console.log('[debug] response:', JSON.stringify(data, null, 2));

    if (data.error) {
      console.error(`\nERROR TikTok: ${data.error} - ${data.error_description}`);
      process.exit(1);
    }

    let envStr = fs.readFileSync(envPath, 'utf8');
    envStr = envStr.replace(/TIKTOK_ACCESS_TOKEN=[^\r\n]*/, `TIKTOK_ACCESS_TOKEN=${data.access_token}`);
    if (/TIKTOK_REFRESH_TOKEN=/.test(envStr)) {
      envStr = envStr.replace(/TIKTOK_REFRESH_TOKEN=[^\r\n]*/, `TIKTOK_REFRESH_TOKEN=${data.refresh_token}`);
    } else {
      envStr += `\nTIKTOK_REFRESH_TOKEN=${data.refresh_token}`;
    }
    if (/TIKTOK_OPEN_ID=/.test(envStr)) {
      envStr = envStr.replace(/TIKTOK_OPEN_ID=[^\r\n]*/, `TIKTOK_OPEN_ID=${data.open_id}`);
    } else {
      envStr += `\nTIKTOK_OPEN_ID=${data.open_id}`;
    }
    fs.writeFileSync(envPath, envStr);
    fs.unlinkSync(verifierPath); // cleanup

    console.log('\n[TikTok Auth] ¡Token guardado en .env!');
    console.log(`open_id     : ${data.open_id}`);
    console.log(`expires_in  : ${data.expires_in}s`);
    console.log('\nPrueba: node uploader.js --latest --platforms tiktok');
  })();
  return;
}

// ── PHASE 1: generate auth URL ────────────────────────────────────────────────
const verifier  = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const state     = crypto.randomBytes(8).toString('hex').toUpperCase();

fs.writeFileSync(verifierPath, verifier);
console.log(`[TikTok Auth] Verifier guardado en .tiktok_verifier.tmp`);

const authUrl = 'https://www.tiktok.com/v2/auth/authorize/'
  + '?client_key='            + clientKey
  + '&scope=user.info.basic,video.publish,video.upload'
  + '&response_type=code'
  + '&redirect_uri=https%3A%2F%2Fgolazox.com%2Ftiktok-callback'
  + '&state='                 + state
  + '&code_challenge='        + challenge
  + '&code_challenge_method=S256';

console.log('\n[TikTok Auth] Abriendo navegador...');
try { execSync(`start "" "${authUrl}"`); } catch (_) {}
console.log('\nAutoriza en el navegador, luego ejecuta INMEDIATAMENTE en la terminal:');
console.log('\n  node tiktok_oauth.js "https://golazox.com/tiktok-callback?code=..."\n');
console.log('IMPORTANTE: pon la URL entre comillas dobles (los & causan error en PowerShell)');
