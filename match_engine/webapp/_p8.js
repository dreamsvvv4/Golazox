'use strict';
const H={'User-Agent':'Mozilla/5.0','Accept-Language':'es-ES,es;q=0.9'};

// Sample every 5 in 3821-3980, then every 5 in 3981-4200
const ids = [];
for(let i=3821; i<=3970; i+=3) ids.push(i);
for(let i=3971; i<=4200; i+=5) ids.push(i);

(async () => {
  for(const id of ids) {
    try {
      const r = await fetch('https://www.transfermarkt.es/test/kader/verein/'+id+'/saison_id/2005',{headers:H,signal:AbortSignal.timeout(5000)});
      const html = await r.text();
      const m = html.match(/<title>\s*([^<|]+)/i);
      const ti = m ? m[1].trim().replace(/\s+/g,' ') : '?';
      if(ti.length > 2 && !(ti.includes('Transfermarkt') && !ti.includes('/')))
        process.stdout.write(id+'='+ti.slice(0,45)+'\n');
    } catch(_) {}
    await new Promise(r=>setTimeout(r,130));
  }
  process.stdout.write('ALL DONE\n');
})();
