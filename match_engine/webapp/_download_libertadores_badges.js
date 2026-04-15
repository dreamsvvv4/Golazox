'use strict';
// Downloads badges for the 19 Libertadores teams missing badges
require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');
const https = require('https');

const BADGES_DIR = path.join(__dirname, 'public', 'img', 'badges');
const SQUADS_DIR = path.join(__dirname, 'squads');
const SPORTSDB   = 'https://www.thesportsdb.com/api/v1/json/3';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchBadge(names) {
  for (const name of names) {
    try {
      const url = `${SPORTSDB}/searchteams.php?t=${encodeURIComponent(name)}`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'golazox/1.0' } });
      if (!res.ok) continue;
      const data = await res.json();
      const teams = data.teams;
      if (!teams || !teams.length) continue;
      const soccer = teams.find(t => !t.strSport || t.strSport.toLowerCase().includes('soccer') || t.strSport.toLowerCase().includes('football'));
      const team   = soccer || teams[0];
      const badge  = team?.strBadge || team?.strTeamBadge;
      if (badge) return { badge, teamFound: team.strTeam };
    } catch(e) {}
    await sleep(400);
  }
  return null;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get  = url.startsWith('https') ? https.get : require('http').get;
    get(url, res => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return reject(new Error('HTTP ' + res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', err => { file.close(); fs.unlink(dest, () => {}); reject(err); });
  });
}

function updateSquadBadge(slug, localPath) {
  const f = path.join(SQUADS_DIR, slug + '.json');
  if (!fs.existsSync(f)) return;
  const raw  = fs.readFileSync(f, 'utf8');
  const bom  = raw.charCodeAt(0) === 0xFEFF;
  const data = JSON.parse(bom ? raw.slice(1) : raw);
  data.badgeLocalPath = localPath;
  fs.writeFileSync(f, (bom ? '\uFEFF' : '') + JSON.stringify(data, null, 2));
}

const TARGETS = [
  { slug: 'bolivar',                   names: ['Bolivar', 'Club Bolívar', 'Club Bolivar La Paz'] },
  { slug: 'ldu-quito',                 names: ['LDU Quito', 'Liga de Quito', 'LDU', 'Liga Deportiva Universitaria'] },
  { slug: 'independiente-del-valle',   names: ['Independiente del Valle', 'Club Independiente del Valle'] },
  { slug: 'barcelona-sc',              names: ['Barcelona SC', 'Barcelona Sporting Club'] },
  { slug: 'universitario',             names: ['Universitario', 'Universitario de Deportes', 'Club Universitario de Deportes'] },
  { slug: 'sporting-cristal',          names: ['Sporting Cristal', 'Club Sporting Cristal'] },
  { slug: 'cusco-fc',                  names: ['Cusco FC', 'FC Cusco'] },
  { slug: 'independiente-medellin',    names: ['Independiente Medellin', 'Deportivo Independiente Medellín', 'DIM'] },
  { slug: 'coquimbo-unido',            names: ['Coquimbo Unido', 'Club Atletico Coquimbo Unido'] },
  { slug: 'deportes-tolima',           names: ['Deportes Tolima', 'Club Deportes Tolima'] },
  { slug: 'independiente-santa-fe',    names: ['Santa Fe', 'Club Independiente Santa Fe', 'Independiente Santa Fe'] },
  { slug: 'junior-barranquilla',       names: ['Junior FC', 'Junior Barranquilla', 'Atletico Junior'] },
  { slug: 'cerro-porteno',             names: ['Cerro Porteño', 'Cerro Porteno', 'Club Cerro Porteño'] },
  { slug: 'libertad',                  names: ['Club Libertad', 'Libertad Paraguay'] },
  { slug: 'universidad-catholica-chile',names: ['Universidad Católica', 'CD Universidad Católica', 'Club Deportivo Universidad Católica'] },
  { slug: 'deportivo-la-guaira',       names: ['Deportivo La Guaira', 'Caracas FC', 'La Guaira'] },
  { slug: 'universidad-central-vzla',  names: ['Universidad Central', 'UCV Venezuela'] },
  { slug: 'always-ready',              names: ['Always Ready', 'Club Always Ready Bolivia'] },
  { slug: 'independiente-rivadavia',   names: ['Independiente Rivadavia', 'CA Independiente Rivadavia', 'Independiente de Rivadavia'] },
];

async function main() {
  let ok = 0, failed = 0;

  for (let i = 0; i < TARGETS.length; i++) {
    const { slug, names } = TARGETS[i];
    const destPng = path.join(BADGES_DIR, slug + '.png');

    if (fs.existsSync(destPng)) {
      console.log(`⏭  ${slug} — badge already exists`);
      ok++;
      continue;
    }

    const result = await searchBadge(names);
    if (!result) {
      console.log(`⚠️  ${slug} — not found in TheSportsDB`);
      failed++;
      await sleep(500);
      continue;
    }

    const { badge: badgeUrl, teamFound } = result;
    const ext = badgeUrl.toLowerCase().includes('.png') || badgeUrl.toLowerCase().includes('/preview') ? '.png' : '.jpg';
    const destFile = path.join(BADGES_DIR, slug + ext);
    const localPath = `/img/badges/${slug}${ext}`;

    try {
      await downloadFile(badgeUrl + '/preview', destFile)
        .catch(() => downloadFile(badgeUrl, destFile));

      updateSquadBadge(slug, localPath);
      console.log(`✅ ${slug} (found: ${teamFound}) → ${localPath}`);
      ok++;
    } catch(err) {
      console.log(`❌ ${slug} — download failed: ${err.message}`);
      failed++;
    }

    if (i < TARGETS.length - 1) await sleep(900);
  }

  console.log(`\nOK: ${ok} | Failed: ${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
