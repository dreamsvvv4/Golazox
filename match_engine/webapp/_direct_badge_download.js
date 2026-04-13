'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');

const SQUADS_DIR  = path.join(__dirname, 'squads');
const BADGES_DIR  = path.join(__dirname, 'public', 'img', 'badges');
const SPORTSDB    = 'https://www.thesportsdb.com/api/v1/json/3';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Direct TheSportsDB search — bypasses local slug resolution
async function searchBadgeDirect(searchName) {
  const url = `${SPORTSDB}/searchteams.php?t=${encodeURIComponent(searchName)}`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'golazox/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  const teams = data.teams;
  if (!teams || !teams.length) return null;
  // Find soccer team
  const soccer = teams.find(t => !t.strSport || t.strSport.toLowerCase().includes('soccer') || t.strSport.toLowerCase().includes('football'));
  const team   = soccer || teams[0];
  return team?.strBadge || team?.strTeamBadge || null;
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

// Targets: slug → names to try
const TARGETS = [
  // Saudi
  { slug: 'al-hazm',              names: ['Al Hazm', 'Al-Hazm FC']                          },
  // Brasileirão
  { slug: 'athletico-paranaense', names: ['Athletico Paranaense', 'Atletico Paranaense']     },
  { slug: 'atletico-goianiense',  names: ['Atletico Goianiense', 'Atletico Club Goianiense'] },
  { slug: 'bahia',                names: ['Bahia', 'EC Bahia', 'Esporte Clube Bahia']        },
  { slug: 'juventude',            names: ['EC Juventude', 'Juventude Caxias']                },
  { slug: 'red-bull-bragantino',  names: ['Bragantino', 'Red Bull Bragantino']               },
  { slug: 'remo',                 names: ['Clube do Remo', 'Remo']                           },
  // Argentina
  { slug: 'atletico-tucuman',     names: ['Atletico Tucuman', 'CA Atletico Tucuman']         },
  { slug: 'banfield',             names: ['Banfield', 'Club Atletico Banfield']              },
  { slug: 'deportivo-riestra',    names: ['Deportivo Riestra', 'CA Riestra']                 },
  { slug: 'huracan',              names: ['Huracan', 'Club Atletico Huracan']                },
  { slug: 'lanus',                names: ['Lanus', 'Club Atletico Lanus', 'Atlético Lanús']  },
  { slug: 'newells-old-boys',     names: ["Newell's Old Boys"]                               },
  { slug: 'rosario-central',      names: ['Rosario Central']                                 },
  { slug: 'union-santa-fe',       names: ['Union Santa Fe', 'Club Atletico Union']           },
];

async function main() {
  let ok = 0, failed = 0;
  for (let i = 0; i < TARGETS.length; i++) {
    const { slug, names } = TARGETS[i];
    let found = false;

    for (const name of names) {
      try {
        const badgeUrl = await searchBadgeDirect(name);
        if (!badgeUrl) { await sleep(500); continue; }

        const ext     = badgeUrl.includes('.png') ? '.png' : '.jpg';
        const destFile = path.join(BADGES_DIR, slug + ext);

        await downloadFile(badgeUrl + '/preview', destFile)
          .catch(() => downloadFile(badgeUrl, destFile));

        const localPath = `/img/badges/${slug}${ext}`;

        // Update squad JSON
        const f   = path.join(SQUADS_DIR, slug + '.json');
        const raw = fs.readFileSync(f, 'utf8');
        const bom = raw.charCodeAt(0) === 0xFEFF;
        const data = JSON.parse(bom ? raw.slice(1) : raw);
        data.badgeLocalPath = localPath;
        if (data.seasons) {
          Object.values(data.seasons).forEach(s => { if (s.badgeUrl) s.badgeUrl = localPath; });
        }
        fs.writeFileSync(f, (bom ? '\uFEFF' : '') + JSON.stringify(data, null, 2));

        console.log(`✅ ${slug} (${name}) → ${localPath}`);
        found = true;
        ok++;
        break;
      } catch (err) {
        console.log(`   ${slug} / ${name}: ${err.message}`);
      }
      await sleep(500);
    }

    if (!found) {
      console.log(`⚠️  ${slug} — not found in TheSportsDB`);
      failed++;
    }

    if (i < TARGETS.length - 1) await sleep(900);
  }

  console.log(`\nOK: ${ok} | Not found: ${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
