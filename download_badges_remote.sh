#!/bin/bash
DEST="$HOME/domains/golazox.com/nodejs/public/img/badges"
BASE="https://raw.githubusercontent.com/dreamsvvv4/match-engine/main/match_engine/webapp/public/img/badges"

for badge in fk-bod-glimt.png qarabag-fk.png union-saint-gilloise.png fc-kairat-almaty.png pafos.png olympiakos-piraeus.png curacao.png katar.png; do
  curl -sSL "$BASE/$badge" -o "$DEST/$badge" && echo "OK: $badge" || echo "FAIL: $badge"
done
echo "BADGES DONE"
