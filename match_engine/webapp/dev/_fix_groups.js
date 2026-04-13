'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'squads');

// National team slugs — everything that is a country/selection goes to 🌍 Selecciones
const SELECCIONES_SLUGS = new Set([
  'abchasien','agypten','albanien','algerien','angola','argentinien','armenien',
  'australien','austria','bahrain','bangladesh','belgien','benin','bolivien',
  'bosnien','brasilien','bulgarien','burkina-faso','chile','china','colombia',
  'costa-rica','curacao','danemark','deutschland','dominikanische-republik',
  'ecuador','el-salvador','emirate','england','escocia','espana','espana-historica',
  'finnland','frankreich','georgien','ghana','griechenland','guatemala','haiti',
  'honduras','indien','irak','iran','irland','island','israel','italien',
  'jamaica','japan','jordanien','kamerun','katar','kapverde','kolumbien',
  'kongo','korea-nord','korea-sud','kosova','kroatien','kuba','kuwait',
  'lesotho','libyen','luxemburg','malediven','mali','marokko','mexiko',
  'moldawien','mongolei','montenegro','mosambik','nigeria','nordirland',
  'nordmazedonien','norwegen','oman','pakistan','palastina','panama',
  'paraguay','peru','philippinen','polen','portugal','rumanien','rumania',
  'russland','sambia','saudi-arabien','schottland','schweden','schweiz',
  'senegal','serbien','sierra-leone','slowakei','slowenien','somalia',
  'south-africa','south-korea','spanien','syrien','tadschikistan','thailand',
  'togo','trinidad-und-tobago','tschechien','tunesien','turkei','turkey',
  'udssr','uglub','uganda','ukraine','ungarn','uruguay','urss','usa',
  'uzbekistan','venezuela','vietnam','wales','weissrussland','bielorrussland',
  'burkina-faso','dominikanische-republik','el-salvador','georgien',
  'guatemala','israel','mali','nordmazedonien','palastina','rumania',
  'sambia','tadschikistan','thailand','uganda','angola','bahrain','benin',
  'bolivien','jugoslawien','tschechoslowakei','england-historica',
  // also Spanish-slug equivalents
  'alemania','argentina','australia','austria','belgica','belgien',
  'bolivia','brasil','camerun','canada','cape-verde','china','colombia',
  'corea-del-norte','corea-del-sur','costa-rica','croacia','dinamarca',
  'ecuador','egipto','escocia','eslovaquia','eslovenia','espana','finlandia',
  'franca','gales','georgia','ghana','grecia','haiti','holanda','honduras',
  'hungria','india','iran','irlanda','islandia','israel','italia',
  'jamaica','japon','jordania','kenia','mali','marruecos','mexico',
  'nigeria','noruega','nuevazelandia','panama','paraguay','peru','polonia',
  'portugal','rd-congo','rumania','rusia','senegal','serbia','siria',
  'sudafrica','suecia','suiza','tailandia','tayikistan','tunez','turquia',
  'ucrania','uruguay','usa','uzbekistan','venezuela',
]);

// Keywords that signal a national team file even if slug not listed
function isNationalTeam(d, slug) {
  const g = (d.group || '').toLowerCase();
  if (g.includes('selecci')) return true;
  const name = (d.name || d.nameEs || d.nameEn || '').toLowerCase();
  // Check if it belongs to known national team patterns
  if (SELECCIONES_SLUGS.has(slug)) return true;
  return false;
}

const TARGET_SELEC = '\uD83C\uDF0D Selecciones';
const TARGET_OTROS = '\uD83C\uDF0D Otros';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('.'));
let fixedSelec = 0, fixedOtros = 0;

for (const f of files) {
  const slug = f.replace('.json', '');
  const fp = path.join(dir, f);
  try {
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const g = d.group || '';
    let changed = false;

    // Unify ALL Selecciones variants into one group
    if (g.includes('Selecci') || isNationalTeam(d, slug)) {
      if (d.group !== TARGET_SELEC) {
        d.group = TARGET_SELEC;
        changed = true;
        fixedSelec++;
      }
    }
    // Merge Otros Otros → Otros
    else if (g === '\uD83C\uDF0D Otros Otros') {
      d.group = TARGET_OTROS;
      changed = true;
      fixedOtros++;
    }

    if (changed) fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8');
  } catch (e) {}
}

console.log('Selecciones unified:', fixedSelec, 'files ->',TARGET_SELEC);
console.log('Otros Otros merged:', fixedOtros, 'files ->', TARGET_OTROS);
