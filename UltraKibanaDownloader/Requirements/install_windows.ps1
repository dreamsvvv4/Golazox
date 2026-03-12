# UltraKibanaDownloader - Instalador interactivo para Windows (PowerShell)
# Ejecuta este script como administrador

function Ask-Install($message) {
    $response = Read-Host "$message (S/N)"
    return $response -eq 'S' -or $response -eq 's'
}

Write-Host "==== UltraKibanaDownloader Instalador para Windows ====" -ForegroundColor Cyan

Write-Host "\nVerificando Java..."
& java -version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Java ya está instalado." -ForegroundColor Green
} else {
    if (Ask-Install "Java no está instalado. ¿Deseas instalarlo?") {
        Write-Host "Abriendo página de descarga de Java..." -ForegroundColor Yellow
        Start-Process "https://www.java.com/es/download/"
        Write-Host "Instala Java manualmente y vuelve a ejecutar este script." -ForegroundColor Yellow
        exit
    } else {
        Write-Host "Java es necesario para la aplicación. Abortando." -ForegroundColor Red
        exit
    }
}

Write-Host "\nVerificando Python..."
& python --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Python ya está instalado." -ForegroundColor Green
} else {
    if (Ask-Install "Python no está instalado. ¿Deseas instalarlo?") {
        Write-Host "Abriendo página de descarga de Python..." -ForegroundColor Yellow
        Start-Process "https://www.python.org/downloads/"
        Write-Host "Instala Python manualmente y vuelve a ejecutar este script." -ForegroundColor Yellow
        exit
    } else {
        Write-Host "Python es necesario para la aplicación. Abortando." -ForegroundColor Red
        exit
    }
}

Write-Host "\nVerificando tkinter..."
python -c "import tkinter" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "tkinter ya está disponible." -ForegroundColor Green
} else {
    Write-Host "tkinter no está disponible. Si instalaste Python desde python.org, debería estar incluido." -ForegroundColor Yellow
    Write-Host "Si usaste Microsoft Store, desinstala y usa el instalador oficial de python.org." -ForegroundColor Yellow
    Write-Host "Abortando." -ForegroundColor Red
    exit
}


# 4. Instalar dependencias pip y requirements.txt
Write-Host "\nInstalando dependencias pip (colorama, chardet y requirements.txt)..."
if (Ask-Install "¿Deseas instalar todas las dependencias pip ahora?") {
    python -m pip install --upgrade pip
    # Instalar dependencias de requirements.txt si existe
    if (Test-Path "requirements.txt") {
        Write-Host "Instalando dependencias de requirements.txt..." -ForegroundColor Yellow
        python -m pip install -r requirements.txt
    } else {
        Write-Host "No se encontró requirements.txt. Instalando dependencias mínimas..." -ForegroundColor Yellow
        python -m pip install elasticsearch==8.12.1 requests
    }
    Write-Host "Dependencias pip instaladas." -ForegroundColor Green
} else {
    Write-Host "Debes instalar las dependencias pip manualmente antes de usar la aplicación." -ForegroundColor Yellow
}

Write-Host "\nInstalación finalizada. Puedes ejecutar UltraKibanaDownloader."
