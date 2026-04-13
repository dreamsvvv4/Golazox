#!/bin/bash
REPO="$HOME/domains/golazox.com/public_html/.builds/source/repository/match_engine/webapp"
DEST="$HOME/domains/golazox.com/nodejs"
cp -r "$REPO/public/." "$DEST/public/"
cp "$REPO/server.js" "$REPO/engine.js" "$REPO/transfermarkt.js" "$REPO/player_ratings.js" "$REPO/narrator.js" "$REPO/squads.js" "$REPO/lookup.js" "$REPO/utils.js" "$REPO/referee_logic.js" "$DEST/"
cp -r "$REPO/squads/." "$DEST/squads/"
grep CACHE_VERSION "$DEST/public/sw.js" | head -1
# PM2 binary is in node_modules (Hostinger VPS setup)
PM2="$DEST/node_modules/.bin/pm2"
NODE_BIN=$(find /opt/alt -name node -type f 2>/dev/null | grep nodejs20 | head -1)
if [ -n "$NODE_BIN" ] && [ -f "$PM2" ]; then
  "$NODE_BIN" "$DEST/node_modules/pm2/bin/pm2" restart golazox && echo PM2_RESTARTED
else
  touch "$DEST/squads-meta.json" && echo PM2_WATCH_TRIGGERED
fi
echo DEPLOYED
