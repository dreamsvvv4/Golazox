// Resize stadium and referee images to 2x their CSS display size
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const stadiumsDir = path.join(__dirname, 'public/img/stadiums');
const refereesDir = path.join(__dirname, 'public/img/referees');

// Stadium: .spk-card-inner = 130x76 (2x = 260x152)
// Referee: .ref-photo-area = 90x90 (2x = 180x180)

async function resize(dir, width, height, ext = '.webp') {
const outputDir = path.join(dir, '_thumbs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const files = fs.readdirSync(dir).filter(f => f.endsWith(ext));
  let saved = 0;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const outPath = path.join(outputDir, file);
    const orig = fs.statSync(fullPath).size;
    await sharp(fullPath)
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toFile(outPath);
    const newSize = fs.statSync(outPath).size;
    if (newSize < orig) {
      saved += orig - newSize;
      console.log(`  ${file}: ${Math.round(orig/1024)}KB → ${Math.round(newSize/1024)}KB (-${Math.round((orig-newSize)/1024)}KB)`);
    } else {
      fs.unlinkSync(outPath);
      // copy original to output
      fs.copyFileSync(fullPath, outPath);
      console.log(`  ${file}: kept original (${Math.round(orig/1024)}KB)`);
    }
  }
  // Replace originals with thumbnails
  for (const file of files) {
    const outPath = path.join(outputDir, file);
    const destPath = path.join(dir, file);
    if (fs.existsSync(outPath)) {
      fs.copyFileSync(outPath, destPath);
      fs.unlinkSync(outPath);
    }
  }
  fs.rmdirSync(outputDir);
  return saved;
}

(async () => {
  console.log('\n=== Stadium images → 260x152 ===');
  const stadiumSaved = await resize(stadiumsDir, 260, 152);
  
  console.log('\n=== Referee images → 180x180 ===');
  const refSaved = await resize(refereesDir, 180, 180);
  
  console.log(`\nTotal saved: ${Math.round((stadiumSaved + refSaved)/1024)}KB`);
})();
