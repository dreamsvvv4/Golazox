/**
 * youtube_auth.js — Genera un nuevo refresh_token para la API de YouTube
 *
 * Pasos:
 *  1. node youtube_auth.js          → imprime la URL de autorización
 *  2. Abre la URL en el navegador, autoriza la app
 *  3. Copia el código de la URL de redirección (?code=...)
 *  4. node youtube_auth.js <code>   → imprime el nuevo refresh_token
 *
 * Pega el refresh_token en .env como YOUTUBE_REFRESH_TOKEN=...
 */
'use strict';

require('dotenv').config();
const { google } = require('googleapis');

const clientId     = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

// Must match the redirect URI configured in Google Cloud Console
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

const code = process.argv[2];

if (!code) {
  // Step 1: print auth URL
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',  // force to get refresh_token
  });
  console.log('\n👉 Abre esta URL en el navegador y autoriza la app:\n');
  console.log(url);
  console.log('\nLuego ejecuta:  node youtube_auth.js <code>\n');
} else {
  // Step 2: exchange code for tokens
  (async () => {
    try {
      const { tokens } = await oauth2.getToken(code);
      console.log('\n✅ Tokens recibidos:\n');
      console.log('YOUTUBE_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('\nCopia esta línea en tu archivo .env y reemplaza el valor anterior.\n');
    } catch (err) {
      console.error('❌ Error al obtener tokens:', err.message);
    }
  })();
}
