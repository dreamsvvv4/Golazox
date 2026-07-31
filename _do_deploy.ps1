$key = "$env:USERPROFILE\.ssh\id_golazox_deploy"
$srv = "u990866731@147.93.88.37"

# ── Guardia: verificar que no hay cambios sin commitear/pushear ──
$unpushed = git log origin/main..HEAD --oneline 2>&1
$dirty    = git status --porcelain 2>&1 | Where-Object { $_ -match '^\s*M|^\s*A|^\s*D' }
if ($dirty) {
    Write-Host "ERROR: Hay archivos modificados sin commitear:" -ForegroundColor Red
    $dirty | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host "Haz 'git add + git commit + git push' antes de deployar." -ForegroundColor Yellow
    exit 1
}
if ($unpushed) {
    Write-Host "ERROR: Hay commits locales sin pushear:" -ForegroundColor Red
    $unpushed | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host "Haz 'git push origin main' antes de deployar." -ForegroundColor Yellow
    exit 1
}
Write-Host "    Git OK - todo commiteado y pusheado" -ForegroundColor Green

$bash = @'
set -e
REPO="$HOME/domains/golazox.com/public_html/.builds/source/repository"
WEBAPP="$REPO/match_engine/webapp"
DEST="$HOME/domains/golazox.com/nodejs"
echo "==> git pull..."
cd "$REPO"
git fetch origin main
git reset --hard FETCH_HEAD
echo "    GIT OK"
echo "==> Copiando archivos..."
cp -r "$WEBAPP/public/." "$DEST/public/" 2>/dev/null || true
cp "$WEBAPP/server.js" "$WEBAPP/engine.js" "$WEBAPP/news.js" "$WEBAPP/player_ratings.js" "$WEBAPP/narrator.js" "$WEBAPP/squads.js" "$WEBAPP/lookup.js" "$WEBAPP/utils.js" "$WEBAPP/referee_logic.js" "$DEST/"
cp -r "$WEBAPP/squads/." "$DEST/squads/"
cp "$WEBAPP/squads-meta.json" "$DEST/squads-meta.json"
mkdir -p "$DEST/data"
cp "$WEBAPP/data/agenda.json" "$WEBAPP/data/salaries.json" "$WEBAPP/data/legends.json" "$DEST/data/"
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

# ── Verificación post-deploy: las rutas críticas deben responder 200 ──
Write-Host "==> Verificando produccion (esperando reinicio de Passenger)..." -ForegroundColor Cyan
Start-Sleep -Seconds 6
$routes = '/', '/fichajes', '/noticias', '/agenda', '/valores', '/estadisticas'
# Timeout amplio: la primera peticion a /fichajes calienta cachés (fichajes,
# rumores, Here we go) con fetches en frío que pueden tardar. Reintenta 1 vez.
function Test-Route($r) {
    for ($i = 1; $i -le 2; $i++) {
        try {
            $code = (Invoke-WebRequest -Uri "https://golazox.com$r" -Method Head -TimeoutSec 30 -UseBasicParsing).StatusCode
            if ($code -eq 200) { return $code }
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code) { return $code }
        }
        if ($i -eq 1) { Start-Sleep -Seconds 4 }
    }
    return $code
}
$failed = @()
foreach ($r in $routes) {
    $code = Test-Route $r
    if ($code -eq 200) { Write-Host ("    200  {0}" -f $r) -ForegroundColor Green }
    else { Write-Host ("    {0}  {1}" -f ($code | ForEach-Object { $_ }), $r) -ForegroundColor Red; $failed += "$r ($code)" }
}
if ($failed.Count) {
    Write-Host "`nVERIFICACION FALLIDA en:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    exit 1
}
Write-Host "==> Produccion verificada: todas las rutas responden 200." -ForegroundColor Green
