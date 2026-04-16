const fs=require('fs'),path=require('path');
const dir='match_engine/webapp/squads';
const badgeDir='match_engine/webapp/public/img/badges';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));
let fixed=0;
for(const f of files){
  try{
    const filePath=path.join(dir,f);
    const raw=fs.readFileSync(filePath,'utf8').replace(/^\uFEFF/,'');
    const d=JSON.parse(raw);
    if(!d.badgeLocalPath){
      const slug=d.slug||f.replace('.json','');
      let badgePath=null;
      if(fs.existsSync(path.join(badgeDir,slug+'.png'))) badgePath='/img/badges/'+slug+'.png';
      else if(fs.existsSync(path.join(badgeDir,slug+'.svg'))) badgePath='/img/badges/'+slug+'.svg';
      if(badgePath){
        d.badgeLocalPath=badgePath;
        // Also update the inline badge field if it was placeholder
        if(!d.badge || d.badge.includes('_placeholder')) d.badge=badgePath;
        fs.writeFileSync(filePath, JSON.stringify(d,null,2)+'\n','utf8');
        console.log('Fixed: '+slug+' → '+badgePath);
        fixed++;
      }
    }
  }catch(e){ console.error('Error on '+f+':',e.message); }
}
console.log('\nTotal fixed:', fixed);
