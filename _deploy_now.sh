#!/bin/bash
set -e
REPO="$HOME/domains/golazox.com/public_html/.builds/source/repository/match_engine/webapp"
DEST="$HOME/domains/golazox.com/nodejs"

echo "==> [1/4] git pull..."
cd "$HOME/domains/golazox.com/public_html/.builds/source/repository"
git fetch origin main
git checkout -B main FETCH_HEAD
git checkout -- .
echo "    GIT_OK"

echo "==> [2/4] Copiando public/..."
cp -r "$REPO/public/." "$DEST/public/"
echo "    PUBLIC_OK"

echo "==> [3/4] Copiando server y motor..."
cp "$REPO/server.js" "$REPO/engine.js" "$REPO/player_ratings.js" "$REPO/narrator.js" \
   "$REPO/squads.js" "$REPO/lookup.js" "$REPO/utils.js" "$REPO/referee_logic.js" \
   "$REPO/squads-meta.json" "$DEST/"
cp -r "$REPO/squads/." "$DEST/squads/"
echo "    CORE_OK — $(ls $DEST/squads/ | wc -l) squads"

echo "==> [4/4] Reiniciando Node.js..."
PM2="$DEST/node_modules/.bin/pm2"
NODE_BIN=$(find /opt/alt -name node -type f 2>/dev/null | grep -E 'nodejs2[02]' | head -1)
echo "    NODE_BIN=$NODE_BIN"
if [ -n "$NODE_BIN" ] && [ -f "$PM2" ]; then
  "$NODE_BIN" "$PM2" restart golazox && echo "    PM2_RESTARTED"
else
  touch "$DEST/squads-meta.json" && echo "    PM2_WATCH_TRIGGERED"
fi

echo "==> ALL_DONE"
