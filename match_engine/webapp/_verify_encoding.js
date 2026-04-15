const fs = require('fs');
const c = fs.readFileSync('server.js', 'utf-8');
const checks = [
  ['em dash in title', c.includes('\u2014 GolazoX')],
  ['left arrow back link', c.includes('\u2190 Volver')],
  ['Politica de Privacidad', c.includes('Pol\u00EDtica de Privacidad')],
  ['Ultima actualizacion', c.includes('\u00DAltima actualizaci\u00F3n')],
  ['diagnostico tecnico', c.includes('diagn\u00F3stico t\u00E9cnico')],
  ['dias', c.includes('d\u00EDas')],
  ['Paginas legales comment', c.includes('P\u00E1ginas legales')],
  ['no bad Politica', !c.includes('Pol\u00C3\u00AD')],
  ['no bad em dash', !c.includes('\u00E2\u20AC\u201D')],
  ['Legislacion', c.includes('Legislaci\u00F3n')],
  ['espanola', c.includes('espa\u00F1ola')],
  ['publicas', c.includes('p\u00FAblicas')],
  ['exclusion', c.includes('Exclusi\u00F3n')],
  ['futbol', c.includes('f\u00FAtbol')],
  ['codigo', c.includes('c\u00F3digo')],
  ['diseno', c.includes('dise\u00F1o')],
];
let allOk = true;
checks.forEach(([name, ok]) => {
  console.log(ok ? 'OK  ' : 'FAIL', name);
  if (!ok) allOk = false;
});
console.log(allOk ? '\nAll checks passed!' : '\nSome checks FAILED');
