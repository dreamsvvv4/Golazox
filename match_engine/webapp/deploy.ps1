#!/usr/bin/env pwsh
<#
.SYNOPSIS
  GolazOX — Production deploy / crash-guard startup script.

.DESCRIPTION
  1. Reinstalls node_modules with only production dependencies (removes devDeps).
  2. Verifies no critical audit issues.
  3. Starts (or restarts) the server under PM2 with auto-restart on crash.

.USAGE
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\deploy.ps1

  Optional flags:
    .\deploy.ps1 -SkipInstall  # skip npm install step
    .\deploy.ps1 -Stop         # gracefully stop the PM2 process

.ENVIRONMENT VARIABLES (set before running, or in a .env.ps1 file)
  $env:SITE_URL      = "https://tudominio.com"
  $env:OWNER_NAME    = "Your Name"
  $env:OWNER_EMAIL   = "your@email.com"
  $env:PORT          = "3000"
#>
param(
  [switch]$SkipInstall,
  [switch]$Stop
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$AppDir  = $PSScriptRoot
$AppName = 'golazox'

# ── Optional: load .env.ps1 if it exists ──────────────────────────────────
$envFile = Join-Path $AppDir '.env.ps1'
if (Test-Path $envFile) {
  Write-Host "Loading environment from .env.ps1" -ForegroundColor Cyan
  . $envFile
}

# ── STOP mode ────────────────────────────────────────────────────────────────
if ($Stop) {
  Write-Host "Stopping $AppName..." -ForegroundColor Yellow
  npx pm2 stop $AppName 2>$null
  npx pm2 delete $AppName 2>$null
  Write-Host "Done." -ForegroundColor Green
  exit 0
}

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  GolazOX  Production Deploy           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Set-Location $AppDir

# ── Step 1: Install production dependencies ────────────────────────────────
if (-not $SkipInstall) {
  Write-Host "[1/3] Installing production dependencies (--omit=dev)..." -ForegroundColor Cyan
  npm install --omit=dev --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed."; exit 1 }
  Write-Host "      Dependencies installed." -ForegroundColor Green
} else {
  Write-Host "[1/3] Skipping npm install (--SkipInstall)." -ForegroundColor Yellow
}

# ── Step 2: Run squad audit ────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Running squad data audit..." -ForegroundColor Cyan
node audit_squads.js
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Squad audit reported errors. Review audit_squads.js output above before serving users."
}

# ── Step 3: Start / restart with PM2 ──────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Starting server under PM2 (crash-guard)..." -ForegroundColor Cyan

$pmArgs = @(
  'start', 'server.js',
  '--name', $AppName,
  '--no-autorestart',        # remove this to auto-restart on crash (add instead: '--restart-delay', '3000')
  '--max-memory-restart', '512M',
  '--time'
)

# If SITE_URL etc. are set in the environment, PM2 will inherit them.
$env:NODE_ENV = 'production'

# Try to reload if already running, else start fresh
$existing = npx pm2 list --no-color 2>$null | Select-String $AppName
if ($existing) {
  Write-Host "  Process '$AppName' already exists — reloading..." -ForegroundColor Yellow
  npx pm2 reload $AppName
} else {
  # Replace --no-autorestart with auto-restart + 3s delay for production resilience
  $pmArgs = @(
    'start', 'server.js',
    '--name', $AppName,
    '--restart-delay', '3000',
    '--max-restarts', '10',
    '--max-memory-restart', '512M',
    '--time'
  )
  npx pm2 @pmArgs
}

if ($LASTEXITCODE -ne 0) { Write-Error "PM2 start failed."; exit 1 }

# Save PM2 process list so it survives reboots (if PM2 startup is configured)
npx pm2 save

Write-Host ""
Write-Host "╔═══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  GolazOX is running! (PM2)            ║" -ForegroundColor Green
Write-Host "║  npx pm2 logs golazox   — view logs   ║" -ForegroundColor Green
Write-Host "║  npx pm2 stop golazox   — stop        ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
