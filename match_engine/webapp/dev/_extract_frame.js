const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const src = process.argv[2] || 'videos/golazox_2026-04-07T1519.mp4';
// Upscale to 1080×1920 then extract frame at 5s
execSync(`"${ffmpegPath}" -y -i "${src}" -vf scale=1080:1920:flags=lanczos -c:v libx264 -preset fast -crf 16 videos/_preview_1080.mp4`);
execSync(`"${ffmpegPath}" -y -i videos/_preview_1080.mp4 -ss 00:00:05 -update 1 -frames:v 1 videos/_preview_frame.png`);
console.log('done -> videos/_preview_frame.png');


