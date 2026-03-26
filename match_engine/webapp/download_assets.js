'use strict';
/**
 * download_assets.js
 * Downloads stadium and referee images from Wikimedia Commons
 * and saves them locally to public/img/stadiums/ and public/img/referees/
 *
 * Usage: node download_assets.js
 */

const fs   = require('fs');
const path = require('path');

const STADIUMS_DIR = path.join(__dirname, 'public', 'img', 'stadiums');
const REFEREES_DIR = path.join(__dirname, 'public', 'img', 'referees');

fs.mkdirSync(STADIUMS_DIR, { recursive: true });
fs.mkdirSync(REFEREES_DIR, { recursive: true });

const STADIUM_FILES = [
  'Santiago_Bernabeu_Stadium.jpg',
  'Camp_Nou.jpg',
  'Wembley_stadium.jpg',
  'Maracanã.jpg',
  'San_Siro.jpg',
  'Allianz_Arena.jpg',
  'Signal_Iduna_Park.jpg',
  'Old_Trafford.jpg',
  'Anfield.jpg',
  'Estadio_azteca.jpg',
  'Luzhniki_Stadium.jpg',
  'San_Mames_stadium.jpg',
  'Celtic_Park.jpg',
];

const REFEREE_FILES = [
  'Pierluigi_Collina.jpg',
  'Howard_Webb.jpg',
  'Markus_Merk_(cropped).jpg',
  'Björn_Kuipers.jpg',
  'Felix_Brych_(cropped).jpg',
  'Antonio_Mateu_Lahoz.jpg',
  'Byron_Moreno.jpg',
  'Massimo_Busacca.jpg',
  'Mark_Clattenburg.jpg',
  'Kassai_Viktor.jpg',
  'Graham_poll.JPG',
  'Nicola_Rizzoli_final_Alemanha_Argentina_Copa_do_Mundo_2014.jpg',
];

function wikimediaUrl(filename, width) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

async function downloadFile(url, destPath) {
  const filename = path.basename(destPath);
  if (fs.existsSync(destPath)) {
    console.log(`  SKIP  ${filename} (ya existe)`);
    return true;
  }
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'FootballSimBot/1.0 (educational project)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`  ERROR ${filename}: HTTP ${res.status}`);
      return false;
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) {
      console.error(`  ERROR ${filename}: tipo inesperado "${ct}"`);
      return false;
    }
    const buf = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buf));
    console.log(`  OK    ${filename} (${(buf.byteLength / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.error(`  ERROR ${filename}: ${e.message}`);
    return false;
  }
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  let ok = 0, fail = 0;

  console.log('\n=== Estadios ===');
  for (const f of STADIUM_FILES) {
    const dest = path.join(STADIUMS_DIR, f);
    const url  = wikimediaUrl(f, 800);
    const success = await downloadFile(url, dest);
    if (success) ok++; else fail++;
    await delay(5000);
  }

  console.log('\n=== Árbitros ===');
  for (const f of REFEREE_FILES) {
    const dest = path.join(REFEREES_DIR, f);
    const url  = wikimediaUrl(f, 400);
    const success = await downloadFile(url, dest);
    if (success) ok++; else fail++;
    await delay(5000);
  }

  console.log(`\nResultado: ${ok} OK, ${fail} errores`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
