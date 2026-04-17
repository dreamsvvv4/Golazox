#!/usr/bin/env pwsh
# _commit_deploy.ps1 — Build, commit, push y deploy en un solo paso.
# Uso: .\_commit_deploy.ps1 "mensaje del commit"
# Si no se pasa mensaje, usa "chore: update assets" por defecto.

param([string]$msg = "chore: update assets")

Set-Location (Split-Path $MyInvocation.MyCommand.Path)
$webapp = "match_engine\webapp"

# 1. Build assets
Write-Host "==> Building assets..." -ForegroundColor Cyan
Push-Location $webapp
node _build_assets.js --force
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; Pop-Location; exit 1 }
Pop-Location

# 2. Stage todos los cambios relevantes
$files = @(
    "$webapp\public\app.js",
    "$webapp\public\app.min.js",
    "$webapp\public\tournament.js",
    "$webapp\public\tournament.min.js",
    "$webapp\public\gx-ui.js",
    "$webapp\public\gx-ui.min.js",
    "$webapp\public\gx-user.js",
    "$webapp\public\gx-user.min.js",
    "$webapp\public\style.css",
    "$webapp\public\style.min.css",
    "$webapp\public\index.html",
    "$webapp\server.js"
)
$toAdd = $files | Where-Object { Test-Path $_ }
git add $toAdd 2>&1 | Out-Null

# También añadir cualquier otro .js/.json/.css modificado en webapp
git add "$webapp\public\" "$webapp\server.js" "$webapp\squads-meta.json" 2>&1 | Out-Null

$staged = git diff --cached --name-only 2>&1
if (-not $staged) {
    Write-Host "No hay cambios para commitear." -ForegroundColor Yellow
} else {
    Write-Host "==> Commiteando..." -ForegroundColor Cyan
    git commit -m $msg 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "COMMIT FAILED" -ForegroundColor Red; exit 1 }

    Write-Host "==> Pusheando..." -ForegroundColor Cyan
    git push origin main 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "PUSH FAILED" -ForegroundColor Red; exit 1 }
}

# 3. Deploy
Write-Host "==> Deploying..." -ForegroundColor Cyan
powershell -File _do_deploy.ps1
