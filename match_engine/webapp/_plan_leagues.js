'use strict';
const Module = require('module');
const _origReq = Module.prototype.require;
Module.prototype.require = function (id) { if (id === 'node-fetch') return globalThis.fetch; return _origReq.apply(this, arguments); };
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9', 'Referer': 'https://www.transfermarkt.es/',
};
const TOP = [
  { code: 'ES1', first: '🇪🇸 La Liga',                second: '🇪🇸 La Liga 2' },
  { code: 'GB1', first: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',  second: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship' },
  { code: 'IT1', first: '🇮🇹 Serie A',                 second: '🇮🇹 Serie B' },
  { code: 'L1',  first: '🇩🇪 Bundesliga',              second: '🇩🇪 2. Bundesliga' },
  { code: 'FR1', first: '🇫🇷 Ligue 1',                 second: '🇫🇷 Ligue 2' },
];

const metaRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads-meta.json'), 'utf8'));
const squadFiles = fs.readdirSync(path.join(__dirname, 'squads')).filter(f => f.endsWith('.json'));
const catalog = [];
for (const file of squadFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'squads', file), 'utf8'));
    const slug = d.slug || file.replace('.json', '');
    const meta = metaRaw[slug] || {};
    const group = meta.group || d.group || '?? Otros';
    catalog.push({ slug, nameEn: meta.nameEn || d.nameEn || d.name || slug, nameEs: meta.nameEs || d.nameEs || d.nameEn || d.name || slug, group });
  } catch (_) {}
}
const slugSet = new Set(catalog.map(c => c.slug));
const groupOf = new Map(catalog.map(c => [c.slug, c.group]));

const ZW = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff\u00ad]/g;
function norm(s) {
  return s.toLowerCase().replace(ZW, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' ')
    .replace(/\b(fc|cf|cd|ud|rc|rcd|sc|sd|ss|ssc|ac|afc|as|sk|club|deportivo|balompie|calcio|futbol|football|de|do|the|1846|1848|1860|1889|1893|1899|1900|1904|1905|1907|1909|1910|05|04|07|29|96)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
const ALIASES = {
  'fc barcelona': 'fc-barcelona', 'racing club de estrasburgo': 'strasbourg', 'estrasburgo': 'strasbourg',
  'genova': 'cfc-genua', 'genoa': 'cfc-genua', 'rc celta': 'celta-vigo', 'celta': 'celta-vigo',
  'augsburgo': 'fc-augsburg', 'niza': 'ogc-nice', 'ogc niza': 'ogc-nice', 'francfort': 'eintracht-frankfurt',
  'eintracht francfort': 'eintracht-frankfurt', 'brestois': 'brest', 'stade brestois': 'brest',
  'coruna': 'rc-deportivo', 'a coruna': 'rc-deportivo', 'deportivo a coruna': 'rc-deportivo',
};
// forma canonica compacta (sin tokens comunes, sin digitos, sin espacios) para detectar duplicados del mismo club
function canon(s) { return norm(s).replace(/\b\d+\b/g, ' ').replace(/[^a-z]/g, ''); }
const canonOf = new Map(catalog.map(c => [c.slug, canon(c.nameEn) || canon(c.slug.replace(/-/g, ' '))]));
const map = new Map();
for (const e of catalog) for (const key of [e.slug.replace(/-/g, ' '), e.nameEn, e.nameEs]) { const n = norm(key); if (n && !map.has(n)) map.set(n, e.slug); }
function resolve(name) {
  const raw = name.toLowerCase().replace(ZW, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (ALIASES[raw] && slugSet.has(ALIASES[raw])) return ALIASES[raw];
  const n = norm(name);
  if (ALIASES[n] && slugSet.has(ALIASES[n])) return ALIASES[n];
  return map.get(n) || null;
}
async function teamsOf(code) {
  const url = `https://www.transfermarkt.es/x/gesamtspielplan/wettbewerb/${code}/saison_id/2026`;
  const $ = cheerio.load(await (await fetch(url, { headers: HEADERS })).text());
  const set = new Map();
  $('.box').each((_, box) => {
    const $box = $(box);
    if (!/Jornada/i.test($box.find('.content-box-headline, .table-header').first().text())) return;
    $box.find('table tbody tr').each((__, tr) => {
      const tds = $(tr).children('td').toArray();
      if (tds.length < 7) return;
      for (const idx of [2, 6]) {
        const a = $(tds[idx]).find('a').first();
        const nm = (a.attr('title') || a.text() || '').replace(ZW, '').replace(/\s+/g, ' ').trim();
        if (nm) set.set(nm, true);
      }
    });
  });
  return [...set.keys()];
}

(async () => {
  const newGroup = new Map();
  const missing = {};
  for (const lg of TOP) {
    const names = await teamsOf(lg.code);
    const set1 = new Set();
    for (const nm of names) {
      const slug = resolve(nm);
      if (!slug) { (missing[lg.first] = missing[lg.first] || []).push(nm); continue; }
      set1.add(slug);
      newGroup.set(slug, lg.first);
    }
    // canonicals de los equipos que estan en 1a 26/27 (para no degradar duplicados del mismo club)
    const canon1 = new Set([...set1].map(s => canonOf.get(s)).filter(Boolean));
    for (const c of catalog) {
      if (c.group !== lg.first || set1.has(c.slug)) continue;
      const cn = canonOf.get(c.slug);
      if (cn && canon1.has(cn)) { console.log(`  SKIP-DUP descenso ${c.slug} (variante en 1a)`); continue; }
      newGroup.set(c.slug, lg.second);
    }
    console.log(`${lg.code} ${lg.first}: ${names.length} nombres, ${set1.size} resueltos`);
  }
  const plan = [];
  for (const [slug, grp] of newGroup) {
    const cur = groupOf.get(slug) || '(sin catalogo)';
    if (cur !== grp) plan.push({ slug, from: cur, to: grp, hasMeta: !!(metaRaw[slug]) });
  }
  plan.sort((a, b) => a.to.localeCompare(b.to) || a.slug.localeCompare(b.slug));
  console.log(`\n===== PLAN MINIMO (${plan.length}) =====`);
  plan.forEach(p => console.log(`  [${p.hasMeta ? 'meta' : 'NEW '}] ${p.slug}: «${p.from}» -> «${p.to}»`));
  console.log('\n===== FALTAN EN CATALOGO (sin plantilla, quedan fuera de su 1a) =====');
  for (const g of Object.keys(missing)) console.log(`  ${g}: ${JSON.stringify(missing[g])}`);
  fs.writeFileSync(path.join(__dirname, '_league_plan.json'), JSON.stringify(plan, null, 2));
  console.log('\nPlan escrito en _league_plan.json');
})().catch(e => console.error('ERR', e));
