const fs=require('fs'),path=require('path');
const dir='match_engine/webapp/squads';
const badgeDir='match_engine/webapp/public/img/badges';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));
const missing=[];
for(const f of files){
  try{
    const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8').replace(/^\uFEFF/,''));
    if(!d.badgeLocalPath){
      const slug=d.slug||f.replace('.json','');
      const pngPath=path.join(badgeDir,slug+'.png');
      const svgPath=path.join(badgeDir,slug+'.svg');
      if(fs.existsSync(pngPath)) missing.push(slug+' (has badge file '+slug+'.png)');
      else if(fs.existsSync(svgPath)) missing.push(slug+' (has badge file '+slug+'.svg)');
    }
  }catch(e){}
}
console.log('Teams with badge files but no badgeLocalPath:');
console.log(missing.join('\n'));
console.log('\nTotal:', missing.length);
