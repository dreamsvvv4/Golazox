#!/usr/bin/env node
// Resize all referee WebP images to 90x90 (handles 2x retina for 45px display / 68px mobile)
const sharp = require('sharp');
const { readdirSync, statSync } = require('fs');
const d = '/home/u990866731/domains/golazox.com/nodejs/public/img/referees';

const files = readdirSync(d).filter(f => f.endsWith('.webp') && f !== 'arbitro_3d.webp');
let saved = 0;

(async () => {
  for (const f of files) {
    const path = d + '/' + f;
    const m = await sharp(path).metadata();
    if (m.width > 90 || m.height > 90) {
      const before = statSync(path).size;
      const buf = await sharp(path)
        .resize(90, 90, { fit: 'cover', position: 'top' })
        .webp({ quality: 82 })
        .toBuffer();
      require('fs').writeFileSync(path, buf);
      const after = buf.length;
      saved += (before - after);
      console.log(f, m.width + 'x' + m.height, '->', '90x90', before + 'B ->', after + 'B', 'saved', (before-after) + 'B');
    } else {
      console.log(f, m.width + 'x' + m.height, 'SKIP (already small)');
    }
  }
  console.log('Total saved:', saved, 'bytes (' + (saved/1024).toFixed(1) + ' KB)');
})().catch(e => { console.error(e); process.exit(1); });
