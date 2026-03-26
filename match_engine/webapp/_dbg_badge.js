'use strict';
const fs = require('fs');
const path = require('path');
const BADGES_DIR = path.join(__dirname, 'public', 'img', 'badges');
const SEP = path.sep;

const badgeUrl = 'https://www.thesportsdb.com/images/media/team/badge/vuutxs1472506763.png';
const slug = 'fc-arsenal';

const parsed = new URL(badgeUrl);
console.log('hostname:', parsed.hostname);
console.log('safe?', ['www.thesportsdb.com','thesportsdb.com'].includes(parsed.hostname));
console.log('protocol:', parsed.protocol);
const ext = 'png';
const localFile = path.join(BADGES_DIR, slug + '.' + ext);
console.log('BADGES_DIR:', BADGES_DIR);
console.log('localFile: ', localFile);
console.log('expected prefix:', BADGES_DIR + SEP);
console.log('starts with?', localFile.startsWith(BADGES_DIR + SEP));
console.log('dir exists?', fs.existsSync(BADGES_DIR));
// Try fetching the badge
fetch(badgeUrl, { signal: AbortSignal.timeout(10000) })
  .then(r => {
    console.log('badge fetch status:', r.status, '| content-type:', r.headers.get('content-type'));
    return r.arrayBuffer();
  })
  .then(buf => {
    console.log('downloaded', buf.byteLength, 'bytes');
    fs.writeFileSync(localFile, Buffer.from(buf));
    console.log('written to', localFile);
  })
  .catch(e => console.error('fetch error:', e.message));
