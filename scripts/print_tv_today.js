const fs = require('fs');
const p = 'match_engine/webapp/data/.cache/tvguide.json';
try{
  const raw = fs.readFileSync(p,'utf8');
  const j = JSON.parse(raw).data || JSON.parse(raw);
  const day = (j.days||[]).find(d=>d.label==='Hoy' || d.dateStr && d.dateStr.includes('30'));
  if(!day){
    console.log('No se encontró día "Hoy" en', p);
    process.exit(0);
  }
  console.log(`Datos: Marca · parrilla España\nHoy ${day.dateStr}`);
  day.events.forEach(e=>{
    // compact formatting like user
    const time = e.time || '';
    const teams = e.teams || '';
    const comp = e.competition || '';
    const channel = e.channel || e.tv || '';
    console.log(`${time}${teams}${comp}${channel}`);
  });
}catch(err){
  console.error(err.stack||err);
  process.exit(1);
}
