'use strict';
const H={'User-Agent':'Mozilla/5.0','Accept-Language':'es-ES,es;q=0.9'};
// Dense probe 3803-3880
const ids = [];
for(let i=3803; i<=3880; i++) ids.push(i);

(async () => {
  for(const id of ids) {
    try {
      const r = await fetch('https://www.transfermarkt.es/test/kader/verein/'+id+'/saison_id/2005',{headers:H,signal:AbortSignal.timeout(5000)});
      const html = await r.text();
      const m = html.match(/<title>\s*([^<|]+)/i);
      const ti = m ? m[1].trim().replace(/\s+/g,' ') : '?';
      if(ti.length > 2 && !(ti.includes('Transfermarkt') && !ti.includes('/')))
        process.stdout.write(id+'='+ti.slice(0,50)+'\n');
    } catch(_) {}
    await new Promise(r=>setTimeout(r,120));
  }
  process.stdout.write('DONE\n');
})();
