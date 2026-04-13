const { spawnSync } = require('child_process');
const f = require('ffmpeg-static');
const src = 'videos/golazox_2026-04-07T1533.mp4';
const res = spawnSync(f, ['-i', src, '-vf', 'cropdetect=24:2:0', '-frames:v', '150', '-f', 'null', '-'], { encoding: 'utf8' });
const combined = (res.stdout || '') + (res.stderr || '');
const matches = [...combined.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
if (matches.length) {
  const widths = matches.map(m => parseInt(m[1]));
  widths.sort((a,b)=>b-a);
  console.log('Frames analyzed:', matches.length);
  console.log('Max content width:', widths[0], 'px (of', 360, 'total)');
  console.log('All unique widths:', [...new Set(widths)]);
} else {
  console.log('No matches. Combined output tail:');
  console.log(combined.slice(-600));
}
