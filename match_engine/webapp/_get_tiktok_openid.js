'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const https = require('https');

const token = process.env.TIKTOK_ACCESS_TOKEN;
if (!token) { console.error('TIKTOK_ACCESS_TOKEN no encontrado en .env'); process.exit(1); }

const options = {
  hostname: 'open.tiktokapis.com',
  path: '/v2/user/info/?fields=open_id,display_name,avatar_url',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json; charset=UTF-8',
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => { data += d; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.error?.code && json.error.code !== 'ok') {
        console.log('❌ Token inválido o expirado:', json.error.code, json.error.message);
        console.log('→ Necesitas refrescar el token con: node tiktok_oauth.js');
      } else {
        const u = json.data?.user;
        console.log('✅ Token válido');
        console.log('   display_name:', u?.display_name);
        console.log('   open_id:     ', u?.open_id);
        console.log('\n→ Añade a .env:');
        console.log(`TIKTOK_OPEN_ID=${u?.open_id}`);
      }
    } catch(e) {
      console.log('Respuesta raw:', data);
    }
  });
});
req.on('error', e => console.error(e));
req.end();
