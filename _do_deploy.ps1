$key = "C:\Users\vvvfb\.ssh\id_golazox_deploy"
$srv = "u990866731@147.93.88.37"

$bash = @'
set -e
REPO="$HOME/domains/golazox.com/public_html/.builds/source/repository"
WEBAPP="$REPO/match_engine/webapp"
DEST="$HOME/domains/golazox.com/nodejs"
echo "==> git pull..."
cd "$REPO"
git fetch origin main
git checkout -B main FETCH_HEAD
git checkout -- .
echo "    GIT OK"
echo "==> Copiando archivos..."
cp -r "$WEBAPP/public/." "$DEST/public/"
cp "$WEBAPP/server.js" "$WEBAPP/engine.js" "$WEBAPP/player_ratings.js" "$WEBAPP/narrator.js" "$WEBAPP/squads.js" "$WEBAPP/lookup.js" "$WEBAPP/utils.js" "$WEBAPP/referee_logic.js" "$DEST/"
cp -r "$WEBAPP/squads/." "$DEST/squads/"
cp "$WEBAPP/squads-meta.json" "$DEST/squads-meta.json"
echo "    $(ls "$DEST/squads/" | wc -l) squads en disco"
echo "    CP OK"
echo "==> Reiniciando Passenger..."
touch "$DEST/tmp/restart.txt"
echo "==> ALL DONE"
'@

$tmpFile = [System.IO.Path]::GetTempFileName() + ".sh"
$lf = "`n"
[System.IO.File]::WriteAllText($tmpFile, $bash.Replace("`r`n", $lf).Replace("`r", $lf), [System.Text.Encoding]::UTF8)

Write-Host "==> Desplegando en produccion..." -ForegroundColor Cyan
Get-Content $tmpFile -Raw | ssh -i $key -p 65002 -o StrictHostKeyChecking=no $srv bash
$exit = $LASTEXITCODE
Remove-Item $tmpFile -Force
if ($exit -ne 0) { Write-Host "DEPLOY FAILED (exit $exit)" -ForegroundColor Red; exit 1 }
Write-Host "`n==> DEPLOY COMPLETADO!" -ForegroundColor Green
