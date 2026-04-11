Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GOLAZOX FULL DEPLOY" -ForegroundColor Cyan
Write-Host "  git pull + cp files + restart + scp img" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$keyFile = "C:\Users\vvvfb\.ssh\id_golazox_deploy"
$server  = "u990866731@147.93.88.37"
$sshArgs = @("-i", $keyFile, "-p", "65002", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", $server, "bash")

$bashLines = @(
  "#!/bin/bash","set -e",
  "REPO="$HOME/domains/golazox.com/public_html/.builds/source/repository"",
  "WEBAPP="$REPO/match_engine/webapp"",
  "DEST="$HOME/domains/golazox.com/nodejs"",
  "echo '==> [1/3] git pull...'",
  "cd "$REPO"","git fetch origin main",
  "git checkout -B main FETCH_HEAD","git checkout -- .","echo '    GIT_OK'",
  "echo '==> [2/3] Copiando archivos...'",
  "cp -r "$WEBAPP/public/." "$DEST/public/"",
  "cp "$WEBAPP/server.js" "$WEBAPP/engine.js" "$WEBAPP/transfermarkt.js" "$WEBAPP/player_ratings.js" "$WEBAPP/narrator.js" "$WEBAPP/squads.js" "$WEBAPP/lookup.js" "$WEBAPP/utils.js" "$WEBAPP/referee_logic.js" "$DEST/"",
  "cp -r "$WEBAPP/squads/." "$DEST/squads/"",
  "cp "$WEBAPP/squads-meta.json" "$DEST/squads-meta.json"",
  "echo "    $(ls $DEST/squads/ | wc -l) squads en disco"",
  "grep 'CACHE_VERSION  =' "$DEST/public/sw.js"","echo '    CP_OK'",
  "echo '==> [3/3] Reiniciando Node.js...'",
  "NODE_BIN=$(find /opt/alt -name node -type f 2>/dev/null | grep -E 'nodejs2[02]' | head -1)",
  "pkill -f server.js 2>/dev/null || true","sleep 2",
  "nohup "$NODE_BIN" "$DEST/server.js" >> "$DEST/logs/app.log" 2>&1 &","sleep 2",
  "pgrep -f server.js > /dev/null && echo '    SERVER_RUNNING' || echo '    SERVER_NOT_STARTED'",
  "echo '==> ALL_DONE'"
)
$bash = $bashLines -join \"
\"
$tmp = [System.IO.Path]::GetTempFileName() + ".sh"
[System.IO.File]::WriteAllText($tmp, $bash)
Write-Host "==> Ejecutando git/cp/restart en servidor..."
Get-Content $tmp -Raw | & ssh @sshArgs
$r = $LASTEXITCODE
Remove-Item $tmp -Force
if ($r -ne 0) { Write-Host "  FAILED git/cp (exit $r)" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "==> [4/4] Subiendo imagenes via tar+ssh..." -ForegroundColor Cyan
$localImg = Join-Path $PSScriptRoot "match_engine\webapp\public\img"
Push-Location $localImg
$tarArgs = @("-i", $keyFile, "-p", "65002", "-o", "StrictHostKeyChecking=no", "u990866731@147.93.88.37", "tar xzf - -C ~/domains/golazox.com/nodejs/public/img/")
tar czf - badges flags | & ssh @tarArgs
$imgExit = $LASTEXITCODE
Pop-Location
if ($imgExit -ne 0) { Write-Warning "tar+ssh imagenes fallo (exit $imgExit)" } else { Write-Host "    IMAGES_OK" -ForegroundColor Green }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL DONE! Produccion actualizada." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
