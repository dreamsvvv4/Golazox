# TikTok OAuth helper — run this script, authorize in browser, paste callback URL
Add-Type -AssemblyName System.Web

$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$envFile  = Join-Path $dir ".env"
$verFile  = Join-Path $dir ".tiktok_verifier"

# Read credentials directly from .env (bypass dotenvx)
$envLines = Get-Content $envFile
$clientKey    = (($envLines | Where-Object { $_ -match "^TIKTOK_CLIENT_KEY=" }) -replace "^TIKTOK_CLIENT_KEY=","").Trim()
$clientSecret = (($envLines | Where-Object { $_ -match "^TIKTOK_CLIENT_SECRET=" }) -replace "^TIKTOK_CLIENT_SECRET=","").Trim()

Write-Host "DEBUG key=[$clientKey] secret=[$($clientSecret.Substring(0,4))...]" -ForegroundColor DarkGray

# Generate PKCE
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$codeVerifier = [Convert]::ToBase64String($bytes) -replace "\+","-" -replace "/","_" -replace "=",""
$sha = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($codeVerifier))
$codeChallenge = [Convert]::ToBase64String($hashBytes) -replace "\+","-" -replace "/","_" -replace "=",""
$stateBytes = New-Object byte[] 8
$rng.GetBytes($stateBytes)
$state = [System.BitConverter]::ToString($stateBytes) -replace "-",""

# Save verifier
@{ codeVerifier = $codeVerifier; state = $state } | ConvertTo-Json | Set-Content $verFile

$authUrl = "https://www.tiktok.com/v2/auth/authorize/?client_key=$clientKey&scope=user.info.basic,video.publish,video.upload&response_type=code&redirect_uri=https%3A%2F%2Fgolazox.com%2Ftiktok-callback&state=$state&code_challenge=$codeChallenge&code_challenge_method=S256"

Write-Host "`n[TikTok Auth] Abriendo navegador..." -ForegroundColor Cyan
Start-Process $authUrl
Write-Host "[TikTok Auth] Autoriza en el navegador y pega aqui la URL completa de golazox.com/tiktok-callback`n" -ForegroundColor Yellow

$callbackUrl = Read-Host "Pega la URL completa aqui"

# Extract code
$uri = [System.Uri]$callbackUrl
$query = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
$code = $query["code"]

if (-not $code) {
    Write-Host "ERROR: No se encontro el codigo en la URL" -ForegroundColor Red
    exit 1
}

Write-Host "`n[TikTok Auth] Intercambiando codigo..." -ForegroundColor Cyan
Write-Host "  client_key  : '$clientKey' (len=$($clientKey.Length))" -ForegroundColor DarkGray
Write-Host "  client_secret: '$($clientSecret.Substring(0,4))...$($clientSecret.Substring($clientSecret.Length-4))' (len=$($clientSecret.Length))" -ForegroundColor DarkGray
Write-Host "  code_verifier: '$($codeVerifier.Substring(0,8))...' (len=$($codeVerifier.Length))" -ForegroundColor DarkGray

$params = [System.Web.HttpUtility]::ParseQueryString("")
$params.Add("client_key", $clientKey.Trim())
$params.Add("client_secret", $clientSecret.Trim())
$params.Add("code", $code.Trim())
$params.Add("grant_type", "authorization_code")
$params.Add("redirect_uri", "https://golazox.com/tiktok-callback")
$params.Add("code_verifier", $codeVerifier.Trim())

$bodyStr = $params.ToString()
Write-Host "  body: $($bodyStr.Substring(0, [Math]::Min(80, $bodyStr.Length)))..." -ForegroundColor DarkGray

try {
    $r = Invoke-RestMethod -Uri "https://open.tiktokapis.com/v2/oauth/token/" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $bodyStr
} catch {
    Write-Host "ERROR en la peticion: $_" -ForegroundColor Red
    exit 1
}

if ($r.error) {
    Write-Host "ERROR TikTok: $($r.error) - $($r.error_description)" -ForegroundColor Red
    exit 1
}

# Save tokens to .env
$envContent = Get-Content $envFile -Raw
$envContent = $envContent -replace "TIKTOK_ACCESS_TOKEN=.*", "TIKTOK_ACCESS_TOKEN=$($r.access_token)"
$envContent = $envContent -replace "TIKTOK_REFRESH_TOKEN=.*", "TIKTOK_REFRESH_TOKEN=$($r.refresh_token)"
Set-Content $envFile $envContent

Remove-Item $verFile -ErrorAction SilentlyContinue

Write-Host "`n[TikTok Auth] Token guardado en .env!" -ForegroundColor Green
Write-Host "open_id: $($r.open_id)" -ForegroundColor Green
Write-Host "`nPrueba: node uploader.js --latest --platforms tiktok" -ForegroundColor Cyan
