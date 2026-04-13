const fs = require('fs');
const h = fs.readFileSync('public/index.html', 'utf8');
const schemas = h.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi) || [];
schemas.forEach((s, i) => {
  const json = s.replace(/<script[^>]*>/, '').replace('</script>', '').trim();
  console.log(`\n=== SCHEMA ${i+1} ===`);
  console.log(json);
});
