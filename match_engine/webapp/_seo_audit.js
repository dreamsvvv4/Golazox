const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const title = html.match(/<title>[^<]+<\/title>/i)?.[0] || 'NOT FOUND';
const canonical = html.match(/<link[^>]+canonical[^>]+>/i)?.[0] || 'NOT FOUND';
const schema = (html.match(/<script[^>]+type="application\/ld\+json"[^>]*>/gi) || []).length;
const metas = html.match(/<meta[^>]+>/gi) || [];

console.log('TITLE:', title);
console.log('CANONICAL:', canonical);
console.log('SCHEMA JSON-LD scripts:', schema);
console.log('\nMETA TAGS:');
metas.forEach(m => console.log(' ', m.slice(0, 150)));

// Check h1 tags
const h1s = html.match(/<h1[^>]*>[^<]+<\/h1>/gi) || [];
console.log('\nH1 TAGS:', h1s.length);
h1s.forEach(h => console.log(' ', h));

// Index.html size
const size = Buffer.byteLength(html, 'utf8');
console.log('\nindex.html size:', Math.round(size/1024) + ' KB');
console.log('App.js script tag:', html.includes('app.js') ? 'YES' : 'NO');
console.log('Defer/async on scripts:', (html.match(/defer|async/gi) || []).length, 'occurrences');
