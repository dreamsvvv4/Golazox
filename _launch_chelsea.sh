#!/bin/bash
cd ~/domains/golazox.com/nodejs
export BASE_URL="http://localhost:3000"
export FFMPEG_PATH="$(find node_modules -name ffmpeg -type f 2>/dev/null | head -1)"
NODE=$(find /opt/alt -name node -type f 2>/dev/null | grep -E 'nodejs2[02]' | tail -1)
echo "Node: $NODE"
echo "ffmpeg: $FFMPEG_PATH"
echo "Lanzando Chelsea vs Man City..."
nohup "$NODE" video_generator.js \
  --type match \
  --teamA fc-chelsea       --eraA 2025 --introEraA 2026 \
  --teamB manchester-city  --eraB 2025 --introEraB 2026 \
  --stadium wembley \
  --referee webb \
  --weather rain \
  --introTitle "Premier League 25/26" \
  --introSub "El partidazo del dia - 17:30" \
  > logs/video_chelsea_mancity.log 2>&1 &
echo "PID: $!"
echo "Sigue con: tail -f ~/domains/golazox.com/nodejs/logs/video_chelsea_mancity.log"
