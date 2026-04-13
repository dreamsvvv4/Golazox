const fs = require('fs');
const h = fs.readFileSync('public/index.html', 'utf8');

const appTag = (h.match(/<script[^>]*app\.js[^>]*>/) || ['NOT FOUND'])[0];
const tnTag  = (h.match(/<script[^>]*tournament\.js[^>]*>/) || ['NOT FOUND'])[0];
const ogUrl  = (h.match(/property="og:url" content="([^"]+)"/) || [,'NOT FOUND'])[1];
const pgTag  = (h.match(/<script[^>]*player_ratings\.js[^>]*>/) || ['NOT FOUND'])[0];

console.log('app.js tag:         ', appTag);
console.log('tournament.js tag:  ', tnTag);
console.log('player_ratings tag: ', pgTag);
console.log('og:url:             ', ogUrl);
console.log('canonical:          ', h.includes('canonical') ? 'FOUND' : 'MISSING');
console.log('hreflang:           ', h.includes('hreflang') ? 'FOUND' : 'MISSING');
console.log('Sitemap in robots:  ', fs.readFileSync('public/robots.txt','utf8').includes('Sitemap') ? 'YES' : 'NO');

// Check if GSC / Search Console is verified
const gsc = h.match(/google-site-verification[^>]+content="([^"]+)"/);
console.log('Google verification:', gsc ? gsc[1].slice(0,20)+'...' : 'NOT FOUND');
