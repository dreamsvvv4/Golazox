const fs = require('fs');
const metaRaw = fs.readFileSync('squads-meta.json', 'utf8').replace(/^\uFEFF/, '');
const meta = JSON.parse(metaRaw);
const dir = 'squads';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const laLiga = [], laLiga2 = [];
for (const f of files) {
  const slug = f.replace('.json', '');
  const raw = fs.readFileSync(dir + '/' + f, 'utf8').replace(/^\uFEFF/, '');
  let d; try { d = JSON.parse(raw); } catch (e) { continue; }
  const m = meta[slug] || {};
  const group = m.group || d.group || '';
  const badge = m.badgeLocalPath || d.badgeLocalPath || '';
  if (!badge || badge.includes('_placeholder')) continue;
  if (group === '🇪🇸 La Liga') laLiga.push(slug);
  if (group === '🇪🇸 La Liga 2') laLiga2.push(slug);
}
console.log('=== LA LIGA (' + laLiga.length + ') ===');
laLiga.sort().forEach(t => console.log(' ', t));
console.log('\n=== LA LIGA 2 (' + laLiga2.length + ') ===');
laLiga2.sort().forEach(t => console.log(' ', t));
