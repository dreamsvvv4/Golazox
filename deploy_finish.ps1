Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GOLAZOX FULL DEPLOY" -ForegroundColor Cyan
Write-Host "  git pull + cp files + restart server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$keyFile = "C:\Users\vvvfb\.ssh\id_golazox_deploy"
$server  = "u990866731@147.93.88.37"
$sshArgs = @("-i", $keyFile, "-p", "65002", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", $server, "bash")

# Escribe el script bash con LF (Unix) para evitar errores de \r en bash
$tmpScript = [System.IO.Path]::GetTempFileName() + ".sh"
$bashScript = @'
#!/bin/bash
set -e

REPO="$HOME/domains/golazox.com/public_html/.builds/source/repository"
WEBAPP="$REPO/match_engine/webapp"
DEST="$HOME/domains/golazox.com/nodejs"

echo "==> [1/3] git pull en servidor..."
cd "$REPO"
git fetch origin main
git checkout -B main FETCH_HEAD
git checkout -- .
echo "    GIT_OK"

echo "==> [2/3] Copiando archivos..."
cp -r "$WEBAPP/public/." "$DEST/public/"
cp "$WEBAPP/server.js" "$WEBAPP/engine.js" "$WEBAPP/transfermarkt.js" \
   "$WEBAPP/player_ratings.js" "$WEBAPP/narrator.js" "$WEBAPP/squads.js" \
   "$WEBAPP/lookup.js" "$WEBAPP/utils.js" "$WEBAPP/referee_logic.js" "$DEST/"
cp -r "$WEBAPP/squads/." "$DEST/squads/"
echo "    $(ls $DEST/squads/ | wc -l) squads en disco"
grep 'CACHE_VERSION  =' "$DEST/public/sw.js"
echo "    CP_OK"

echo "==> [3/3] Reiniciando Node.js..."
NODE_BIN=$(find /opt/alt -name node -type f 2>/dev/null | grep -E 'nodejs2[02]' | head -1)
pkill -f server.js 2>/dev/null || true
sleep 2
nohup "$NODE_BIN" "$DEST/server.js" >> "$DEST/logs/app.log" 2>&1 &
sleep 2
pgrep -f server.js > /dev/null && echo "    SERVER_RUNNING" || echo "    SERVER_NOT_STARTED"
echo "==> ALL_DONE"
'@

# Guardar con LF
[System.IO.File]::WriteAllText($tmpScript, ($bashScript -replace "`r`n", "`n"))

# Ejecutar en servidor
Get-Content $tmpScript -Raw | & ssh @sshArgs
$exitCode = $LASTEXITCODE
Remove-Item $tmpScript -Force

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ALL DONE! Produccion actualizada." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "  FAILED (exit $exitCode)" -ForegroundColor Red
    exit 1
}
