const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
try {
  const out = execSync(ffmpegPath + ' -i videos/golazox_2026-04-07T1440.mp4', { stdio: 'pipe' }).toString();
  console.log(out.slice(0, 400));
} catch(e) {
  // ffmpeg returns error on -i alone, that's normal — we want stderr
  const out = (e.stderr || e.stdout || Buffer.alloc(0)).toString();
  const m = out.match(/Video:[^\n]*?(\d{3,4})x(\d{3,4})/);
  if (m) console.log('Dimensions:', m[1] + 'x' + m[2]);
  else console.log(out.slice(0, 400));
}
