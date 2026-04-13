// Use ffmpeg cropdetect to find the exact content width
const { execSync } = require('child_process');
const f = require('ffmpeg-static');
// Analyze first 5s of the raw recording
const src = 'videos/golazox_2026-04-07T1533.mp4';
try {
  const out = execSync(`"${f}" -i "${src}" -vf cropdetect=24:2:0 -frames:v 150 -f null - 2>&1`).toString();
  // cropdetect output lines look like:  [Parsed_cropdetect] crop=NNNxNNN:X:Y
  const matches = [...out.matchAll(/crop=(\d+):\d+:\d+:\d+/g)];
  if (matches.length) {
    const widths = matches.map(m => parseInt(m[1]));
    widths.sort((a,b)=>b-a);
    console.log('Max crop width:', widths[0]);
    console.log('Median crop width:', widths[Math.floor(widths.length/2)]);
    console.log('Sample values:', widths.slice(0,10));
  } else {
    console.log('No cropdetect output found');
    console.log(out.slice(-500));
  }
} catch(e) {
  // ffmpeg exits with error on -f null, expected — read stderr
  const out = (e.stderr || e.stdout || Buffer.alloc(0)).toString();
  const matches = [...out.matchAll(/crop=(\d+):\d+:\d+:\d+/g)];
  if (matches.length) {
    const widths = matches.map(m => parseInt(m[1]));
    widths.sort((a,b)=>b-a);
    console.log('Max crop width:', widths[0]);
    console.log('Sample values (top 5):', widths.slice(0,5));
  } else {
    console.log(out.slice(-800));
  }
}
