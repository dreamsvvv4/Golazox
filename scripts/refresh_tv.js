(async ()=>{
  try{
    const n = require('../match_engine/webapp/news');
    const d = await n.getTvGuide();
    // Safe logging: different shapes possible
    if (d && d.data && Array.isArray(d.data.days)) {
      console.log('TV refreshed', d.data.days[0].dateStr, 'events', d.data.days[0].events.length);
    } else {
      console.log('TV refreshed (raw):', JSON.stringify(d).slice(0,1000));
    }
  }catch(e){
    console.error(e);
    process.exit(1);
  }
})();
