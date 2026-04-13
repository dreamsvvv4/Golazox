#!/bin/bash
D=/home/u990866731/domains/golazox.com/nodejs/public/img/referees
node - <<'EOF'
const sharp = require('sharp');
const {readdirSync, statSync} = require('fs');
const d = '/home/u990866731/domains/golazox.com/nodejs/public/img/referees';
const files = readdirSync(d).filter(f => f.endsWith('.webp'));
(async () => {
  for (const f of files) {
    const m = await sharp(d + '/' + f).metadata();
    console.log(f, m.width + 'x' + m.height, statSync(d + '/' + f).size + 'B');
  }
})();
EOF
