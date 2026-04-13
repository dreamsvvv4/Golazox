'use strict';
const fs = require('fs');

let c = fs.readFileSync('server.js', 'utf8');
const before = c.length;

// 1. <div class="mp-wrap"> → <main> after <body> (all 3 match page templates)
c = c.replace(/<body>\n<div class="mp-wrap">/g, '<body>\n<main class="mp-wrap">');

// 2. Closing tags — each is unique per language
c = c.replace(
  '· Sin afiliación con FIFA, UEFA ni clubes\n  </div>\n</div>\n</body>\n</html>',
  '· Sin afiliación con FIFA, UEFA ni clubes\n  </div>\n</main>\n</body>\n</html>'
);
c = c.replace(
  '· Not affiliated with FIFA, UEFA or any club\n  </div>\n</div>\n</body>\n</html>',
  '· Not affiliated with FIFA, UEFA or any club\n  </div>\n</main>\n</body>\n</html>'
);
c = c.replace(
  '· Sem afiliação com FIFA, UEFA ou clubes\n  </div>\n</div>\n</body>\n</html>',
  '· Sem afiliação com FIFA, UEFA ou clubes\n  </div>\n</main>\n</body>\n</html>'
);

// 3. viewport-fit=cover in match page templates (3 occurrences without it)
c = c.replace(
  /<meta name="viewport" content="width=device-width,initial-scale=1"\/>/g,
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>'
);

// 4. Explicit width+height on badge img elements (6 occurrences across 3 templates)
c = c.replace(
  /`<img class="mp-badge" src="\${badgeA}" alt="\${esc\(nameA\)}" loading="eager"\/>`/g,
  '`<img class="mp-badge" src="${badgeA}" alt="${esc(nameA)}" width="72" height="72" loading="eager"/>`'
);
c = c.replace(
  /`<img class="mp-badge" src="\${badgeB}" alt="\${esc\(nameB\)}" loading="eager"\/>`/g,
  '`<img class="mp-badge" src="${badgeB}" alt="${esc(nameB)}" width="72" height="72" loading="eager"/>`'
);

fs.writeFileSync('server.js', c, 'utf8');

// Verify
const mains   = (c.match(/<main class="mp-wrap">/g)  || []).length;
const divWrap = (c.match(/<body>\n<div class="mp-wrap">/g) || []).length;
const vpFit   = (c.match(/viewport-fit=cover/g)       || []).length;
const badgeWH = (c.match(/width="72" height="72"/g)   || []).length;

console.log('main.mp-wrap:', mains,   '(expect 3)');
console.log('div.mp-wrap left:', divWrap, '(expect 0)');
console.log('viewport-fit:', vpFit,   '(expect 3)');
console.log('badge w+h:', badgeWH,    '(expect 6)');
console.log('File size:', before, '->', c.length);
