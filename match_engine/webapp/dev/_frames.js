const { execSync } = require('child_process');
const f = require('ffmpeg-static');
const src = process.argv[2] || 'videos/golazox_2026-04-07T1544.mp4';
execSync(`"${f}" -y -i "${src}" -c copy videos/_p1080.mp4`);
[1,3,8].forEach(t => {
  execSync(`"${f}" -y -i videos/_p1080.mp4 -ss 00:00:0${t} -update 1 -frames:v 1 videos/_frame_t${t}.png`);
  console.log('frame', t, 'done');
});
